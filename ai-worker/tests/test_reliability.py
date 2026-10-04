import asyncio
import json

import httpx
import openai

from ai_worker.reliability import MAX_ATTEMPTS, RETRY_DELAYS_SECONDS, is_transient, retry_delay
from ai_worker.runner import JobRunner

from .fakes import CallRecorder, FakeApi, FakeProvider, Recorder, settings

REQUEST = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")


def openai_error(cls, status, code=None):
    response = httpx.Response(status, request=REQUEST, json={"error": {"code": code, "message": "x"}})
    return cls("x", response=response, body={"code": code, "message": "x"})


# ── classification ───────────────────────────────────────────────────────────


def test_temporary_failures_are_retried():
    assert is_transient(openai_error(openai.RateLimitError, 429, "rate_limit_exceeded"))
    assert is_transient(openai_error(openai.InternalServerError, 503))
    assert is_transient(openai.APITimeoutError(request=REQUEST))
    assert is_transient(openai.APIConnectionError(request=REQUEST))
    assert is_transient(httpx.ConnectError("api down", request=REQUEST))
    assert is_transient(httpx.HTTPStatusError("502", request=REQUEST, response=httpx.Response(502, request=REQUEST)))
    assert is_transient(ConnectionError("db down"))


def test_permanent_failures_are_not():
    # An exhausted quota is also a 429, but waiting won't add credit
    assert not is_transient(openai_error(openai.RateLimitError, 429, "insufficient_quota"))
    assert not is_transient(openai_error(openai.AuthenticationError, 401))
    assert not is_transient(openai_error(openai.BadRequestError, 400))
    assert not is_transient(ValueError("bad payload"))
    assert not is_transient(httpx.HTTPStatusError("409", request=REQUEST, response=httpx.Response(409, request=REQUEST)))


def test_backoff_schedule():
    assert [retry_delay(a) for a in range(1, MAX_ATTEMPTS + 1)] == [*RETRY_DELAYS_SECONDS, None]
    assert RETRY_DELAYS_SECONDS == tuple(sorted(RETRY_DELAYS_SECONDS))  # delays grow


# ── the runner's retry flow ──────────────────────────────────────────────────


class FlakyProvider(FakeProvider):
    """Fails with a temporary error the given number of times, then works."""

    def __init__(self, failures, error=None):
        super().__init__()
        self.failures = failures
        self.error = error or openai.APITimeoutError(request=REQUEST)

    async def stream(self, **kwargs):
        if self.failures > 0:
            self.failures -= 1
            raise self.error
        async for event in super().stream(**kwargs):
            yield event


def message():
    job = {"id": "j1", "type": "AI_GENERATE", "payload": json.dumps({"prompt": "Hi"}), "submittedBy": "a@x"}
    return json.dumps(job).encode()


def runner_with(provider, api=None):
    api = api or FakeApi()
    retries, dead = CallRecorder(), CallRecorder()
    runner = JobRunner(settings(), api, provider, Recorder(), retry=retries, dead_letter=dead)
    return runner, api, retries, dead


def test_temporary_error_schedules_a_delayed_retry():
    runner, api, retries, dead = runner_with(FlakyProvider(failures=1))

    assert asyncio.run(runner.handle(message(), attempt=1)) is True

    # the job goes back to PENDING with the reason, and the message is re-published for attempt 2
    assert api.retries == [("j1", "The request to OpenAI timed out.", RETRY_DELAYS_SECONDS[0])]
    assert retries.calls == [(message(), 2, RETRY_DELAYS_SECONDS[0])]
    assert api.finished == [] and dead.calls == []


def test_a_retried_delivery_succeeds_and_may_take_over_the_job():
    runner, api, retries, dead = runner_with(FakeProvider())

    assert asyncio.run(runner.handle(message(), attempt=2)) is True

    assert api.take_overs == [True]
    assert api.finished[0][1]["status"] == "COMPLETED"
    assert retries.calls == [] and dead.calls == []


def test_last_attempt_fails_the_job_and_dead_letters_it():
    runner, api, retries, dead = runner_with(FlakyProvider(failures=1))

    assert asyncio.run(runner.handle(message(), attempt=MAX_ATTEMPTS)) is True

    assert retries.calls == []
    result = api.finished[0][1]
    assert result["status"] == "FAILED"
    assert result["result"] == f"Error: The request to OpenAI timed out. (after {MAX_ATTEMPTS} attempts)"
    assert dead.calls == [(message(), "The request to OpenAI timed out.", MAX_ATTEMPTS)]


def test_permanent_error_fails_immediately():
    bad_key = openai_error(openai.AuthenticationError, 401)
    runner, api, retries, dead = runner_with(FlakyProvider(failures=1, error=bad_key))

    assert asyncio.run(runner.handle(message(), attempt=1)) is True

    assert retries.calls == [] and api.retries == []
    assert "rejected the API key" in api.finished[0][1]["result"]
    assert len(dead.calls) == 1


def test_api_unreachable_when_claiming_retries_without_touching_the_job():
    api = FakeApi(start_error=httpx.ConnectError("api down", request=REQUEST))
    runner, api, retries, dead = runner_with(FakeProvider(), api=api)

    assert asyncio.run(runner.handle(message(), attempt=1)) is True

    assert retries.calls == [(message(), 2, RETRY_DELAYS_SECONDS[0])]
    assert api.retries == []  # the job is still PENDING; nothing to record
    assert api.finished == []


def test_redelivery_after_a_crash_takes_over():
    runner, api, _, _ = runner_with(FakeProvider())

    asyncio.run(runner.handle(message(), attempt=1, redelivered=True))

    assert api.take_overs == [True]


def test_malformed_messages_are_dead_lettered():
    runner, api, retries, dead = runner_with(FakeProvider())

    assert asyncio.run(runner.handle(b"{not json", attempt=1)) is True

    assert dead.calls == [(b"{not json", "Malformed message", 1)]
    assert api.started == []
