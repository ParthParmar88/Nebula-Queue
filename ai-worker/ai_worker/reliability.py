"""Retry policy for AI jobs.

Temporary failures (rate limits, timeouts, provider 5xx, the API or database being briefly
unreachable) are retried with increasing delays; permanent ones (bad input, invalid key,
exhausted quota) fail immediately, since retrying can't fix them.

Delays are implemented with one RabbitMQ queue per delay: messages sit in
`ai-job-retry-5s` / `ai-job-retry-30s` until their TTL expires, then dead-letter back to
`ai-job-queue`. One queue per delay (instead of per-message TTLs on a single queue)
avoids head-of-line blocking — a 30 s retry never holds up a 5 s one."""

from __future__ import annotations

import asyncio

RETRY_DELAYS_SECONDS = (5, 30)  # wait before attempt 2, attempt 3
MAX_ATTEMPTS = len(RETRY_DELAYS_SECONDS) + 1

# Topology (declared by the AI worker on startup)
WORK_EXCHANGE = "job-exchange"
WORK_ROUTING_KEY = "job.ai"
RETRY_EXCHANGE = "job-retry"
DEAD_LETTER_EXCHANGE = "job-dlx"
DEAD_LETTER_QUEUE = "ai-job-dlq"
DEAD_LETTER_ROUTING_KEY = "job.ai.dead"


def retry_queue(delay_seconds: int) -> str:
    return f"ai-job-retry-{delay_seconds}s"


def retry_routing_key(delay_seconds: int) -> str:
    return f"ai.retry.{delay_seconds}s"


def retry_delay(attempt: int) -> int | None:
    """Seconds to wait before the next attempt, or None if `attempt` was the last one."""
    return RETRY_DELAYS_SECONDS[attempt - 1] if attempt < MAX_ATTEMPTS else None


def is_transient(err: Exception) -> bool:
    """Would trying again later plausibly succeed?"""
    try:
        import openai
    except ImportError:  # pragma: no cover - the SDK is a runtime dependency
        openai = None
    import httpx

    if openai is not None:
        if isinstance(err, openai.RateLimitError):
            # A 429 can mean "slow down" (retry) or "no credit left" (don't)
            return getattr(err, "code", None) != "insufficient_quota"
        if isinstance(err, (openai.APITimeoutError, openai.APIConnectionError, openai.InternalServerError)):
            return True
        if isinstance(err, openai.APIStatusError):
            return False  # 400/401/403/404…: our request or credentials are wrong

    if isinstance(err, httpx.HTTPStatusError):
        return err.response.status_code >= 500  # our API had a hiccup
    if isinstance(err, httpx.TransportError):
        return True  # couldn't reach our API
    if isinstance(err, (ConnectionError, TimeoutError, asyncio.TimeoutError)):
        return True
    try:
        import asyncpg

        if isinstance(err, (asyncpg.PostgresConnectionError, asyncpg.CannotConnectNowError)):
            return True
    except ImportError:  # pragma: no cover
        pass
    return False
