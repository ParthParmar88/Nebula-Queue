"""LLM providers behind one small interface, so the rest of the worker doesn't know which
vendor it is talking to. Adding Anthropic, Gemini or a local model means adding a class."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol, Union


@dataclass(frozen=True)
class TextDelta:
    """A chunk of generated text, in order."""

    text: str


@dataclass(frozen=True)
class Usage:
    """Token counts reported by the provider once generation ends."""

    input_tokens: int
    output_tokens: int


StreamEvent = Union[TextDelta, Usage]


class LLMProvider(Protocol):
    def stream(
        self, *, model: str, prompt: str, system: str | None, max_output_tokens: int
    ) -> AsyncIterator[StreamEvent]:
        """Yield TextDelta events as text is generated, then a Usage event."""
        ...


class OpenAIProvider:
    def __init__(self, api_key: str, *, timeout: float = 120.0, max_retries: int = 2) -> None:
        # Imported here so tests (which use a fake provider) don't need the SDK configured
        from openai import AsyncOpenAI

        # The SDK retries connection errors, 429s and 5xx with exponential backoff
        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout, max_retries=max_retries)

    async def stream(
        self, *, model: str, prompt: str, system: str | None, max_output_tokens: int
    ) -> AsyncIterator[StreamEvent]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        stream = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            max_completion_tokens=max_output_tokens,
            stream=True,
            # Ask for token usage in the final chunk so we can record cost
            stream_options={"include_usage": True},
        )
        async for chunk in stream:
            if chunk.choices:
                content = chunk.choices[0].delta.content
                if content:
                    yield TextDelta(content)
            if chunk.usage:
                yield Usage(chunk.usage.prompt_tokens, chunk.usage.completion_tokens)

    async def aclose(self) -> None:
        await self._client.close()
