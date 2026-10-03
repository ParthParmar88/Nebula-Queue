import asyncio
from decimal import Decimal

import pytest

from ai_worker.jobs import MAX_PROMPT_CHARS, parse_generate_payload
from ai_worker.llm import Usage
from ai_worker.pricing import cost_usd
from ai_worker.streaming import DeltaBatcher

# ── pricing ──────────────────────────────────────────────────────────────────


def test_cost_from_per_million_prices():
    assert cost_usd(Usage(1_000_000, 500_000), 0.15, 0.60) == Decimal("0.450000")


def test_cost_unknown_without_prices_or_usage():
    assert cost_usd(Usage(10, 10), None, 0.6) is None
    assert cost_usd(None, 0.15, 0.6) is None


# ── payload ──────────────────────────────────────────────────────────────────


def test_parses_prompt_and_defaults():
    req = parse_generate_payload('{"prompt": "Hi"}', default_max_output_tokens=800)
    assert (req.prompt, req.system, req.max_output_tokens) == ("Hi", None, 800)


def test_parses_optional_fields():
    req = parse_generate_payload('{"prompt": "Hi", "system": "Be brief", "maxOutputTokens": 50}', 800)
    assert (req.system, req.max_output_tokens) == ("Be brief", 50)


@pytest.mark.parametrize(
    "payload",
    [None, "", "nope", "[]", "{}", '{"prompt": "  "}', '{"prompt": 5}', '{"prompt": "x", "maxOutputTokens": 0}',
     '{"prompt": "x", "maxOutputTokens": true}', '{"prompt": "' + "x" * (MAX_PROMPT_CHARS + 1) + '"}'],
)
def test_rejects_bad_payloads(payload):
    with pytest.raises(ValueError):
        parse_generate_payload(payload, 800)


# ── delta batching ───────────────────────────────────────────────────────────


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def test_batches_until_size_or_interval():
    sent = []

    async def publish(seq, text):
        sent.append((seq, text))

    async def scenario():
        clock = FakeClock()
        batcher = DeltaBatcher(publish, max_chars=5, max_interval=0.1, clock=clock)
        await batcher.add("ab")        # buffered
        await batcher.add("cd")        # still < 5 chars
        assert sent == []
        await batcher.add("e")         # 5 chars → flush
        clock.now = 0.05
        await batcher.add("f")         # buffered
        clock.now = 0.2
        await batcher.add("g")         # interval passed → flush
        await batcher.flush()          # nothing left
        await batcher.add("h")
        await batcher.flush()          # final flush

    asyncio.run(scenario())
    assert sent == [(0, "abcde"), (1, "fg"), (2, "h")]
