"""Runs one job message end to end. Independent of RabbitMQ so it can be tested with fakes."""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from decimal import Decimal

from .api import ApiClient, JobNotRunnable
from .config import Settings
from .documents import chunk_pages, extract_pages
from .jobs import parse_generate_payload, run_generate
from .llm import LLMProvider, TextDelta, Usage
from .pricing import add_costs, cost_usd, embedding_cost_usd
from .rag import NO_RESULTS_ANSWER, SYSTEM_PROMPT, build_user_prompt, sources_json, to_sources
from .streaming import DeltaBatcher
from .vector_store import VectorStore

log = logging.getLogger(__name__)

PublishEvent = Callable[[dict], Awaitable[None]]

MAX_QUESTION_CHARS = 2_000  # mirrors JobPayloadValidator on the API


def describe_error(err: Exception) -> str:
    """A message that tells the user what went wrong and, where possible, what to do."""
    try:
        import openai
    except ImportError:  # pragma: no cover - the SDK is a runtime dependency
        openai = None

    if openai is not None:
        if isinstance(err, openai.AuthenticationError):
            return "OpenAI rejected the API key. Check OPENAI_API_KEY on the AI worker."
        if isinstance(err, openai.RateLimitError):
            return "OpenAI rate limit or quota exceeded. Try again shortly, or check your OpenAI billing."
        if isinstance(err, openai.APITimeoutError):
            return "The request to OpenAI timed out."
        if isinstance(err, openai.APIConnectionError):
            return "Couldn’t reach OpenAI."
        if isinstance(err, openai.NotFoundError):
            return "The configured model isn’t available to this API key. Check OPENAI_MODEL."
        if isinstance(err, openai.APIStatusError):
            return f"OpenAI rejected the request: {err.message}"
    if isinstance(err, ValueError):
        return str(err)
    return f"{type(err).__name__}: {err}"


@dataclass
class Outcome:
    """What a handler produced; sent to the API as the job's final state."""

    output: str | None = None
    result: str | None = None
    model: str | None = None
    usage: Usage | None = None
    cost: Decimal | None = None
    sources: str | None = None


class JobRunner:
    def __init__(
        self,
        settings: Settings,
        api: ApiClient,
        provider: LLMProvider | None,
        publish_event: PublishEvent,
        store: VectorStore | None = None,
    ) -> None:
        self._settings = settings
        self._api = api
        self._provider = provider
        self._publish_event = publish_event
        self._store = store
        self._handlers = {
            "AI_GENERATE": self._generate,
            "INGEST_DOCUMENT": self._ingest,
            "AI_ASK": self._ask,
        }

    async def handle(self, body: bytes) -> bool:
        """Process one message. Returns True to ack it, False to drop it (no redelivery)."""
        try:
            job = json.loads(body)
            job_id = job["id"]
        except (ValueError, KeyError, TypeError):
            log.error("Dropping malformed message: %r", body[:200])
            return False

        # Claim the job. 409/404 mean it was cancelled or deleted while queued — skip it.
        try:
            await self._api.start(job_id)
        except JobNotRunnable as err:
            log.info("Skipping job %s: no longer runnable (%s)", job_id, err)
            return True
        except Exception:
            log.exception("Could not start job %s", job_id)
            return False

        try:
            handler = self._handlers.get(job.get("type"))
            if handler is None:
                raise ValueError(f"The AI worker can’t run {job.get('type')} jobs.")
            if self._provider is None:
                raise ValueError("OPENAI_API_KEY is not set on the AI worker.")
            outcome = await handler(job)
            await self._api.finish(
                job_id,
                status="COMPLETED",
                output=outcome.output,
                result=outcome.result,
                model=outcome.model,
                usage=outcome.usage,
                cost=outcome.cost,
                sources=outcome.sources,
            )
            log.info(
                "Job %s (%s) completed: %s tokens in, %s out, cost %s",
                job_id,
                job.get("type"),
                outcome.usage.input_tokens if outcome.usage else "?",
                outcome.usage.output_tokens if outcome.usage else "?",
                outcome.cost if outcome.cost is not None else "n/a",
            )
            return True
        except Exception as err:
            reason = describe_error(err)
            log.warning("Job %s failed: %s", job_id, reason)
            try:
                await self._api.finish(job_id, status="FAILED", result=f"Error: {reason}")
            except Exception:
                log.exception("Could not mark job %s FAILED", job_id)
            return False

    # ── AI_GENERATE ──────────────────────────────────────────────────────────

    async def _generate(self, job: dict) -> Outcome:
        model = self._settings.model
        request = parse_generate_payload(job.get("payload"), self._settings.default_max_output_tokens)
        batcher = self._batcher(job)
        result = await run_generate(request, self._provider, model, batcher.add)
        await batcher.flush()
        cost = cost_usd(result.usage, self._settings.price_input_per_1m, self._settings.price_output_per_1m)
        return Outcome(output=result.output, model=model, usage=result.usage, cost=cost)

    # ── INGEST_DOCUMENT ─────────────────────────────────────────────────────

    async def _ingest(self, job: dict) -> Outcome:
        payload = _json_object(job.get("payload"))
        document_id = payload.get("documentId")
        if not isinstance(document_id, str):
            raise ValueError("INGEST_DOCUMENT payload needs a documentId")
        try:
            store = self._require_store()
            data = await self._api.download_document(document_id)
            pages = extract_pages(data, payload.get("contentType", "text/plain"))
            chunks = chunk_pages(pages)
            embeddings = await self._provider.embed(
                [c.text for c in chunks],
                model=self._settings.embedding_model,
                dimensions=self._settings.embedding_dimensions,
            )
            await store.replace_chunks(document_id, chunks, embeddings.vectors)
        except Exception as err:
            # Tell the documents page why, then let the job fail as usual
            try:
                await self._api.report_indexed(document_id, status="FAILED", error=describe_error(err))
            except Exception:
                log.exception("Could not mark document %s FAILED", document_id)
            raise

        page_count = sum(1 for p in pages if p.number is not None) or 1
        await self._api.report_indexed(
            document_id, status="READY", page_count=page_count, chunk_count=len(chunks)
        )
        return Outcome(
            result=f"Indexed {len(chunks)} chunk{'s' if len(chunks) != 1 else ''} from "
            f"{page_count} page{'s' if page_count != 1 else ''} of {payload.get('filename', 'the document')}",
            model=self._settings.embedding_model,
            usage=Usage(embeddings.tokens, 0),
            cost=embedding_cost_usd(embeddings.tokens, self._settings.price_embedding_per_1m),
        )

    # ── AI_ASK ───────────────────────────────────────────────────────────────

    async def _ask(self, job: dict) -> Outcome:
        payload = _json_object(job.get("payload"))
        question = payload.get("question")
        documents = payload.get("documents") or []
        if not isinstance(question, str) or not question.strip() or len(question) > MAX_QUESTION_CHARS:
            raise ValueError("AI_ASK needs a question of at most 2,000 characters")
        filenames = {d["id"]: d.get("filename", "document") for d in documents if isinstance(d, dict) and "id" in d}
        if not filenames:
            raise ValueError("AI_ASK needs at least one document to search")

        store = self._require_store()
        query = await self._provider.embed(
            [question], model=self._settings.embedding_model, dimensions=self._settings.embedding_dimensions
        )
        embed_cost = embedding_cost_usd(query.tokens, self._settings.price_embedding_per_1m)
        hits = await store.search(query.vectors[0], list(filenames), self._settings.rag_top_k)

        if not hits:
            # Nothing indexed matches — answer without spending a chat call
            await self._publish_delta(job["id"], job.get("submittedBy"), 0, NO_RESULTS_ANSWER)
            return Outcome(output=NO_RESULTS_ANSWER, model=self._settings.embedding_model,
                           usage=Usage(query.tokens, 0), cost=embed_cost, sources="[]")

        sources = to_sources(hits, filenames)
        model = self._settings.model
        batcher = self._batcher(job)
        parts: list[str] = []
        usage: Usage | None = None
        async for event in self._provider.stream(
            model=model,
            prompt=build_user_prompt(question.strip(), sources),
            system=SYSTEM_PROMPT,
            max_output_tokens=self._settings.ask_max_output_tokens,
        ):
            if isinstance(event, TextDelta):
                parts.append(event.text)
                await batcher.add(event.text)
            elif isinstance(event, Usage):
                usage = event
        await batcher.flush()

        chat_cost = cost_usd(usage, self._settings.price_input_per_1m, self._settings.price_output_per_1m)
        return Outcome(
            output="".join(parts),
            model=model,
            usage=usage,
            # the chat call plus the (tiny) question embedding
            cost=add_costs(chat_cost, embed_cost) if chat_cost is not None else None,
            sources=sources_json(sources),
        )

    # ── helpers ──────────────────────────────────────────────────────────────

    def _require_store(self) -> VectorStore:
        if self._store is None:
            raise ValueError("The AI worker isn’t connected to the vector database.")
        return self._store

    def _batcher(self, job: dict) -> DeltaBatcher:
        job_id, owner = job["id"], job.get("submittedBy")
        return DeltaBatcher(lambda seq, text: self._publish_delta(job_id, owner, seq, text))

    async def _publish_delta(self, job_id: str, owner: str | None, seq: int, text: str) -> None:
        # Live text is best-effort: a lost chunk must never fail the job (the final output
        # is saved through the API regardless).
        try:
            await self._publish_event({"jobId": job_id, "owner": owner, "seq": seq, "delta": text})
        except Exception:
            log.warning("Could not publish stream chunk %s for job %s", seq, job_id, exc_info=True)


def _json_object(payload: str | None) -> dict:
    try:
        data = json.loads(payload or "")
    except json.JSONDecodeError:
        raise ValueError("The job payload isn’t valid JSON") from None
    if not isinstance(data, dict):
        raise ValueError("The job payload must be a JSON object")
    return data
