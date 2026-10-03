from __future__ import annotations

from ai_worker.api import JobNotRunnable
from ai_worker.config import Settings
from ai_worker.llm import TextDelta, Usage


def settings(**overrides) -> Settings:
    values = dict(
        api_url="http://api",
        worker_token="t",
        rabbitmq_url="amqp://x",
        openai_api_key="sk-test",
        model="test-model",
        price_input_per_1m=0.5,
        price_output_per_1m=1.5,
        default_max_output_tokens=800,
        concurrency=1,
    )
    values.update(overrides)
    return Settings(**values)


class FakeProvider:
    """Streams the given chunks, then reports usage. Can fail midway."""

    def __init__(self, chunks=("Hel", "lo", "!"), usage=Usage(10, 3), fail_after: int | None = None):
        self.chunks = chunks
        self.usage = usage
        self.fail_after = fail_after
        self.calls = []

    async def stream(self, *, model, prompt, system, max_output_tokens):
        self.calls.append(dict(model=model, prompt=prompt, system=system, max_output_tokens=max_output_tokens))
        for i, chunk in enumerate(self.chunks):
            if self.fail_after is not None and i == self.fail_after:
                raise RuntimeError("provider exploded")
            yield TextDelta(chunk)
        if self.usage:
            yield self.usage


class FakeApi:
    def __init__(self, start_error: Exception | None = None):
        self.start_error = start_error
        self.started = []
        self.finished = []

    async def start(self, job_id):
        if self.start_error:
            raise self.start_error
        self.started.append(job_id)

    async def finish(self, job_id, **kwargs):
        self.finished.append((job_id, kwargs))


class Recorder:
    def __init__(self):
        self.events = []

    async def __call__(self, event):
        self.events.append(event)


NOT_RUNNABLE = JobNotRunnable("HTTP 409")
