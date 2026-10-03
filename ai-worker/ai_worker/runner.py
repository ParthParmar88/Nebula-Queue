"""Runs one job message end to end. Independent of RabbitMQ so it can be tested with fakes."""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable

from .api import ApiClient, JobNotRunnable
from .config import Settings
from .jobs import parse_generate_payload, run_generate
from .llm import LLMProvider
from .pricing import cost_usd
from .streaming import DeltaBatcher

log = logging.getLogger(__name__)

PublishEvent = Callable[[dict], Awaitable[None]]


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


class JobRunner:
    def __init__(
        self, settings: Settings, api: ApiClient, provider: LLMProvider | None, publish_event: PublishEvent
    ) -> None:
        self._settings = settings
        self._api = api
        self._provider = provider
        self._publish_event = publish_event

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

        model = self._settings.model
        try:
            if self._provider is None:
                raise ValueError("OPENAI_API_KEY is not set on the AI worker.")
            if job.get("type") != "AI_GENERATE":
                raise ValueError(f"The AI worker can’t run {job.get('type')} jobs.")

            request = parse_generate_payload(job.get("payload"), self._settings.default_max_output_tokens)
            owner = job.get("submittedBy")
            batcher = DeltaBatcher(lambda seq, text: self._publish_delta(job_id, owner, seq, text))

            result = await run_generate(request, self._provider, model, batcher.add)
            await batcher.flush()

            cost = cost_usd(result.usage, self._settings.price_input_per_1m, self._settings.price_output_per_1m)
            await self._api.finish(
                job_id, status="COMPLETED", output=result.output, model=model, usage=result.usage, cost=cost
            )
            log.info(
                "Job %s completed: %s tokens in, %s out, cost %s",
                job_id,
                result.usage.input_tokens if result.usage else "?",
                result.usage.output_tokens if result.usage else "?",
                cost if cost is not None else "n/a",
            )
            return True
        except Exception as err:
            reason = describe_error(err)
            log.warning("Job %s failed: %s", job_id, reason)
            try:
                await self._api.finish(job_id, status="FAILED", result=f"Error: {reason}", model=model)
            except Exception:
                log.exception("Could not mark job %s FAILED", job_id)
            return False

    async def _publish_delta(self, job_id: str, owner: str | None, seq: int, text: str) -> None:
        # Live text is best-effort: a lost chunk must never fail the job (the final output
        # is saved through the API regardless).
        try:
            await self._publish_event({"jobId": job_id, "owner": owner, "seq": seq, "delta": text})
        except Exception:
            log.warning("Could not publish stream chunk %s for job %s", seq, job_id, exc_info=True)
