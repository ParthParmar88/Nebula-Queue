"""Entry point: python -m ai_worker.main"""

from __future__ import annotations

import asyncio
import json
import logging
import signal

import aio_pika

from .api import ApiClient
from .config import Settings
from .llm import OpenAIProvider
from .runner import JobRunner
from .vector_store import PgVectorStore

# Must match RabbitMQConfig on the API
AI_QUEUE = "ai-job-queue"
EVENTS_EXCHANGE = "job-events"
STREAM_ROUTING_KEY = "job.stream"

log = logging.getLogger("ai_worker")


async def connect_with_retry(url: str, attempts: int = 20, delay: float = 3.0) -> aio_pika.abc.AbstractRobustConnection:
    """RabbitMQ may still be starting (e.g. under Docker Compose). After the first connect,
    the robust connection reconnects and restores the consumer on its own."""
    for attempt in range(1, attempts + 1):
        try:
            return await aio_pika.connect_robust(url)
        except Exception as err:
            if attempt == attempts:
                raise
            log.info("RabbitMQ not ready (%s). Retrying in %.0fs… (%d/%d)", err, delay, attempt, attempts)
            await asyncio.sleep(delay)
    raise RuntimeError("unreachable")


async def connect_store_with_retry(settings: Settings, attempts: int = 20, delay: float = 3.0) -> PgVectorStore:
    """Postgres may still be starting; the store also creates its table and index on connect."""
    for attempt in range(1, attempts + 1):
        try:
            return await PgVectorStore.connect(settings.database_url, settings.embedding_dimensions)
        except Exception as err:
            if attempt == attempts:
                raise
            log.info("Postgres not ready (%s). Retrying in %.0fs… (%d/%d)", err, delay, attempt, attempts)
            await asyncio.sleep(delay)
    raise RuntimeError("unreachable")


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = Settings.from_env()

    if not settings.worker_token:
        log.warning("WORKER_INTERNAL_TOKEN is not set — the API will reject this worker's status updates")
    provider = OpenAIProvider(settings.openai_api_key) if settings.openai_api_key else None
    if provider is None:
        log.warning("OPENAI_API_KEY is not set — AI jobs will fail with a clear error until it is")

    api = ApiClient(settings.api_url, settings.worker_token)
    store = await connect_store_with_retry(settings)
    connection = await connect_with_retry(settings.rabbitmq_url)

    async with connection:
        channel = await connection.channel()
        # Prefetch = how many jobs run concurrently on this worker
        await channel.set_qos(prefetch_count=settings.concurrency)
        queue = await channel.declare_queue(AI_QUEUE, durable=True)
        events = await channel.declare_exchange(EVENTS_EXCHANGE, aio_pika.ExchangeType.DIRECT, durable=True)

        async def publish_event(event: dict) -> None:
            await events.publish(
                aio_pika.Message(json.dumps(event).encode(), content_type="application/json"),
                routing_key=STREAM_ROUTING_KEY,
            )

        runner = JobRunner(settings, api, provider, publish_event, store)

        async def on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
            if await runner.handle(message.body):
                await message.ack()
            else:
                await message.reject(requeue=False)

        await queue.consume(on_message)
        log.info("AI worker listening on %s (model %s, concurrency %d)", AI_QUEUE, settings.model, settings.concurrency)

        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop.set)
            except NotImplementedError:  # Windows
                pass
        await stop.wait()
        log.info("Shutting down")

    await api.aclose()
    await store.close()
    if provider is not None:
        await provider.aclose()


if __name__ == "__main__":
    asyncio.run(main())
