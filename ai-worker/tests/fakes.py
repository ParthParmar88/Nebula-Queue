from __future__ import annotations

from ai_worker.api import JobNotRunnable
from ai_worker.config import Settings
from ai_worker.llm import Completion, Embeddings, TextDelta, Usage
from ai_worker.vector_store import SearchHit


def settings(**overrides) -> Settings:
    values = dict(
        api_url="http://api",
        worker_token="t",
        rabbitmq_url="amqp://x",
        database_url="postgresql://x",
        openai_api_key="sk-test",
        model="test-model",
        price_input_per_1m=0.5,
        price_output_per_1m=1.5,
        default_max_output_tokens=800,
        concurrency=1,
        embedding_model="test-embed",
        embedding_dimensions=3,
        price_embedding_per_1m=0.02,
        rag_top_k=2,
        ask_max_output_tokens=100,
    )
    values.update(overrides)
    return Settings(**values)


class FakeProvider:
    """Streams the given chunks, then reports usage. Can fail midway. Embeds deterministically."""

    def __init__(
        self,
        chunks=("Hel", "lo", "!"),
        usage=Usage(10, 3),
        fail_after: int | None = None,
        judge_reply='{"correctness": 1, "faithfulness": 0.5, "reasoning": "Matches the reference."}',
    ):
        self.chunks = chunks
        self.usage = usage
        self.fail_after = fail_after
        self.judge_reply = judge_reply
        self.calls = []
        self.judged = []
        self.embedded = []

    async def stream(self, *, model, prompt, system, max_output_tokens, temperature=None):
        self.calls.append(dict(model=model, prompt=prompt, system=system, max_output_tokens=max_output_tokens,
                               temperature=temperature))
        for i, chunk in enumerate(self.chunks):
            if self.fail_after is not None and i == self.fail_after:
                raise RuntimeError("provider exploded")
            yield TextDelta(chunk)
        if self.usage:
            yield self.usage

    async def complete(self, *, model, prompt, system, max_output_tokens, json_mode=False):
        self.judged.append(dict(model=model, prompt=prompt, json_mode=json_mode))
        return Completion(text=self.judge_reply, usage=Usage(20, 8))

    async def embed(self, texts, *, model, dimensions):
        self.embedded.append(list(texts))
        return Embeddings(vectors=[[float(len(t)), 0.0, 1.0][:dimensions] for t in texts], tokens=5 * len(texts))


class FakeApi:
    def __init__(self, start_error: Exception | None = None, document: bytes = b"Hello world.\n\nSecond paragraph."):
        self.start_error = start_error
        self.document = document
        self.started = []
        self.take_overs = []
        self.finished = []
        self.indexed = []
        self.retries = []

    async def claim(self, job_id, *, take_over=False):
        if self.start_error:
            raise self.start_error
        self.started.append(job_id)
        self.take_overs.append(take_over)

    async def schedule_retry(self, job_id, *, error, delay_seconds):
        self.retries.append((job_id, error, delay_seconds))

    async def finish(self, job_id, **kwargs):
        self.finished.append((job_id, kwargs))

    async def download_document(self, document_id):
        return self.document

    async def report_indexed(self, document_id, **kwargs):
        self.indexed.append((document_id, kwargs))


class FakeStore:
    def __init__(self, hits: list[SearchHit] | None = None):
        self.hits = hits or []
        self.replaced = {}
        self.searches = []

    async def replace_chunks(self, document_id, chunks, vectors):
        assert len(chunks) == len(vectors)
        self.replaced[document_id] = list(chunks)

    async def search(self, vector, document_ids, limit):
        self.searches.append((vector, list(document_ids), limit))
        return [h for h in self.hits if h.document_id in document_ids][:limit]


class Recorder:
    def __init__(self):
        self.events = []

    async def __call__(self, event):
        self.events.append(event)


class CallRecorder:
    """Records every call's positional arguments (for the retry / dead-letter publishers)."""

    def __init__(self):
        self.calls = []

    async def __call__(self, *args):
        self.calls.append(args)


NOT_RUNNABLE = JobNotRunnable("HTTP 409")
