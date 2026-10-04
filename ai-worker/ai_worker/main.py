"""Entry point: python -m ai_worker.main"""

from __future__ import annotations

import asyncio
import json
import logging
import signal

import aio_pika

from . import reliability
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


async def declare_reliability_topology(channel: aio_pika.abc.AbstractChannel):
    """Retry delay queues and the dead-letter queue (owned by the AI worker).

    Each delay queue has a TTL; expired messages dead-letter back to the work exchange
    with the AI routing key, i.e. straight back into ai-job-queue."""
    await channel.declare_exchange(reliability.WORK_EXCHANGE, aio_pika.ExchangeType.DIRECT, durable=True)
    retry_exchange = await channel.declare_exchange(reliability.RETRY_EXCHANGE, aio_pika.ExchangeType.DIRECT, durable=True)
    for delay in reliability.RETRY_DELAYS_SECONDS:
        queue = await channel.declare_queue(
            reliability.retry_queue(delay),
            durable=True,
            arguments={
                "x-message-ttl": delay * 1000,
                "x-dead-letter-exchange": reliability.WORK_EXCHANGE,
                "x-dead-letter-routing-key": reliability.WORK_ROUTING_KEY,
            },
        )
        await queue.bind(retry_exchange, routing_key=reliability.retry_routing_key(delay))

    dead_letter_exchange = await channel.declare_exchange(
        reliability.DEAD_LETTER_EXCHANGE, aio_pika.ExchangeType.DIRECT, durable=True
    )
    dlq = await channel.declare_queue(reliability.DEAD_LETTER_QUEUE, durable=True)
    await dlq.bind(dead_letter_exchange, routing_key=reliability.DEAD_LETTER_ROUTING_KEY)
    return retry_exchange, dead_letter_exchange


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

        retry_exchange, dead_letter_exchange = await declare_reliability_topology(channel)

        async def publish_event(event: dict) -> None:
            await events.publish(
                aio_pika.Message(json.dumps(event).encode(), content_type="application/json"),
                routing_key=STREAM_ROUTING_KEY,
            )

        async def publish_retry(body: bytes, attempt: int, delay: int) -> None:
            # Sits in the delay queue until its TTL expires, then dead-letters back to ai-job-queue
            await retry_exchange.publish(
                aio_pika.Message(
                    body,
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    headers={"x-attempt": attempt},
                ),
                routing_key=reliability.retry_routing_key(delay),
            )

        async def publish_dead_letter(body: bytes, reason: str, attempts: int) -> None:
            await dead_letter_exchange.publish(
                aio_pika.Message(
                    body,
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    headers={"x-error": reason[:500], "x-attempts": attempts},
                ),
                routing_key=reliability.DEAD_LETTER_ROUTING_KEY,
            )

        runner = JobRunner(
            settings, api, provider, publish_event, store, retry=publish_retry, dead_letter=publish_dead_letter
        )

        async def on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
            attempt = int((message.headers or {}).get("x-attempt", 1))
            try:
                ok = await runner.handle(message.body, attempt=attempt, redelivered=message.redelivered)
            except Exception:
                # e.g. the broker refused a retry publish: let RabbitMQ redeliver this message
                log.exception("Unexpected error handling a message; requeueing it")
                await message.reject(requeue=True)
                return
            if ok:
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
