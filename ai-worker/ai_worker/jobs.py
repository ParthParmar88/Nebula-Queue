"""AI job handlers. Pure logic: they take a provider and callbacks, so they're easy to test."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from .llm import LLMProvider, TextDelta, Usage

# Mirrors JobPayloadValidator on the API (which rejects bad payloads before queueing);
# checked again here because the queue is a trust boundary too.
MAX_PROMPT_CHARS = 8_000
MAX_SYSTEM_CHARS = 4_000
MAX_OUTPUT_TOKENS = 4_000


@dataclass(frozen=True)
class GenerateRequest:
    prompt: str
    system: str | None
    max_output_tokens: int


@dataclass(frozen=True)
class GenerateResult:
    output: str
    model: str
    usage: Usage | None


def parse_generate_payload(payload: str | None, default_max_output_tokens: int) -> GenerateRequest:
    """Turn the job's JSON payload into a request; raises ValueError with a user-facing message."""
    if not payload:
        raise ValueError('AI_GENERATE needs a payload like {"prompt": "…"}')
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        raise ValueError("AI_GENERATE payload must be valid JSON") from None
    if not isinstance(data, dict):
        raise ValueError('AI_GENERATE payload must be a JSON object with a "prompt"')

    prompt = data.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError('AI_GENERATE payload needs a non-empty "prompt"')
    if len(prompt) > MAX_PROMPT_CHARS:
        raise ValueError(f"Prompt is too long (max {MAX_PROMPT_CHARS} characters)")

    system = data.get("system")
    if system is not None and (not isinstance(system, str) or len(system) > MAX_SYSTEM_CHARS):
        raise ValueError(f"System instructions must be text of at most {MAX_SYSTEM_CHARS} characters")

    max_tokens = data.get("maxOutputTokens", default_max_output_tokens)
    if not isinstance(max_tokens, int) or isinstance(max_tokens, bool) or not 1 <= max_tokens <= MAX_OUTPUT_TOKENS:
        raise ValueError(f"maxOutputTokens must be between 1 and {MAX_OUTPUT_TOKENS}")

    return GenerateRequest(prompt=prompt, system=system or None, max_output_tokens=max_tokens)


async def run_generate(
    request: GenerateRequest,
    provider: LLMProvider,
    model: str,
    on_delta: Callable[[str], Awaitable[None]],
) -> GenerateResult:
    """Stream a completion, forwarding each text chunk to `on_delta` as it arrives."""
    parts: list[str] = []
    usage: Usage | None = None
    async for event in provider.stream(
        model=model, prompt=request.prompt, system=request.system, max_output_tokens=request.max_output_tokens
    ):
        if isinstance(event, TextDelta):
            parts.append(event.text)
            await on_delta(event.text)
        elif isinstance(event, Usage):
            usage = event
    return GenerateResult(output="".join(parts), model=model, usage=usage)
