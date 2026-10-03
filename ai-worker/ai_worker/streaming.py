"""Batches token deltas before publishing them.

Models emit a token every few milliseconds; sending each one as its own RabbitMQ message
and WebSocket frame would be wasteful. Flushing every ~100 ms (or ~200 characters) keeps
the UI feeling live at a fraction of the message count."""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable

Publish = Callable[[int, str], Awaitable[None]]


class DeltaBatcher:
    def __init__(
        self,
        publish: Publish,
        *,
        max_chars: int = 200,
        max_interval: float = 0.1,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._publish = publish
        self._max_chars = max_chars
        self._max_interval = max_interval
        self._clock = clock
        self._parts: list[str] = []
        self._size = 0
        self._seq = 0
        self._last_flush = clock()

    async def add(self, text: str) -> None:
        self._parts.append(text)
        self._size += len(text)
        if self._size >= self._max_chars or self._clock() - self._last_flush >= self._max_interval:
            await self.flush()

    async def flush(self) -> None:
        if self._parts:
            chunk = "".join(self._parts)
            self._parts.clear()
            self._size = 0
            await self._publish(self._seq, chunk)
            self._seq += 1
        self._last_flush = self._clock()
