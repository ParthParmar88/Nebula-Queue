import asyncio
import json
from decimal import Decimal

from ai_worker.runner import JobRunner

from .fakes import NOT_RUNNABLE, FakeApi, FakeProvider, Recorder, settings


def message(**overrides):
    job = {"id": "j1", "type": "AI_GENERATE", "payload": json.dumps({"prompt": "Say hello"}), "submittedBy": "alice@x.com"}
    job.update(overrides)
    return json.dumps(job).encode()


def run(runner, body):
    return asyncio.run(runner.handle(body))


def test_completes_job_with_output_usage_and_cost():
    api, provider, events = FakeApi(), FakeProvider(), Recorder()
    runner = JobRunner(settings(), api, provider, events)

    assert run(runner, message()) is True

    assert api.started == ["j1"]
    job_id, result = api.finished[0]
    assert job_id == "j1"
    assert result["status"] == "COMPLETED"
    assert result["output"] == "Hello!"
    assert result["model"] == "test-model"
    assert (result["usage"].input_tokens, result["usage"].output_tokens) == (10, 3)
    # 10 * 0.5 / 1M + 3 * 1.5 / 1M
    assert result["cost"] == Decimal("0.000010")


def test_streams_text_to_the_owner():
    events = Recorder()
    runner = JobRunner(settings(), FakeApi(), FakeProvider(), events)

    run(runner, message())

    assert "".join(e["delta"] for e in events.events) == "Hello!"
    assert all(e["jobId"] == "j1" and e["owner"] == "alice@x.com" for e in events.events)
    assert [e["seq"] for e in events.events] == list(range(len(events.events)))


def test_skips_cancelled_job_without_calling_the_model():
    api, provider = FakeApi(start_error=NOT_RUNNABLE), FakeProvider()
    runner = JobRunner(settings(), api, provider, Recorder())

    assert run(runner, message()) is True  # ack: nothing left to do
    assert provider.calls == []
    assert api.finished == []


def test_invalid_payload_fails_job_with_a_clear_reason():
    api, provider = FakeApi(), FakeProvider()
    runner = JobRunner(settings(), api, provider, Recorder())

    assert run(runner, message(payload=json.dumps({"prompt": ""}))) is False

    status, result = api.finished[0][1]["status"], api.finished[0][1]["result"]
    assert status == "FAILED"
    assert "prompt" in result
    assert provider.calls == []


def test_provider_error_marks_job_failed():
    api = FakeApi()
    runner = JobRunner(settings(), api, FakeProvider(fail_after=1), Recorder())

    assert run(runner, message()) is False
    assert api.finished[0][1]["status"] == "FAILED"
    assert "provider exploded" in api.finished[0][1]["result"]


def test_missing_api_key_fails_job_instead_of_crashing():
    api = FakeApi()
    runner = JobRunner(settings(openai_api_key=""), api, None, Recorder())

    assert run(runner, message()) is False
    assert "OPENAI_API_KEY" in api.finished[0][1]["result"]


def test_stream_publish_failure_does_not_fail_the_job():
    async def broken_publish(event):
        raise ConnectionError("broker down")

    api = FakeApi()
    runner = JobRunner(settings(), api, FakeProvider(), broken_publish)

    assert run(runner, message()) is True
    assert api.finished[0][1]["output"] == "Hello!"


def test_malformed_message_is_dropped():
    api = FakeApi()
    runner = JobRunner(settings(), api, FakeProvider(), Recorder())

    assert run(runner, b"not json") is False
    assert api.started == []
