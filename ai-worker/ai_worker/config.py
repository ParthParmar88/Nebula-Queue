"""Settings, read once from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import quote


def _optional_float(name: str) -> float | None:
    value = os.environ.get(name, "").strip()
    return float(value) if value else None


@dataclass(frozen=True)
class Settings:
    api_url: str
    worker_token: str
    rabbitmq_url: str
    database_url: str
    openai_api_key: str
    model: str
    # USD per 1M tokens. Optional: without them tokens are still recorded, cost is left empty.
    price_input_per_1m: float | None
    price_output_per_1m: float | None
    default_max_output_tokens: int
    # How many jobs this worker runs at once (RabbitMQ prefetch)
    concurrency: int
    # ── retrieval (document Q&A) ──
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    price_embedding_per_1m: float | None = None
    rag_top_k: int = 5
    ask_max_output_tokens: int = 500
    # ── evaluations ── (empty = use `model`)
    judge_model: str = ""

    @property
    def effective_judge_model(self) -> str:
        return self.judge_model or self.model

    @classmethod
    def from_env(cls) -> Settings:
        user = quote(os.environ.get("RABBITMQ_USER", "admin"), safe="")
        password = quote(os.environ.get("RABBITMQ_PASS", "admin123"), safe="")
        host = os.environ.get("RABBITMQ_HOST", "localhost")
        port = os.environ.get("RABBITMQ_PORT", "5672")

        db_user = quote(os.environ.get("DB_USER", "admin"), safe="")
        db_password = quote(os.environ.get("DB_PASSWORD", "admin123"), safe="")
        db_host = os.environ.get("DB_HOST", "localhost")
        db_port = os.environ.get("DB_PORT", "5432")
        db_name = os.environ.get("DB_NAME", "nebula-queue")

        return cls(
            api_url=os.environ.get("API_URL", "http://localhost:9090").rstrip("/"),
            worker_token=os.environ.get("WORKER_INTERNAL_TOKEN", ""),
            rabbitmq_url=f"amqp://{user}:{password}@{host}:{port}/",
            database_url=f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}",
            openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            price_input_per_1m=_optional_float("OPENAI_PRICE_INPUT_PER_1M"),
            price_output_per_1m=_optional_float("OPENAI_PRICE_OUTPUT_PER_1M"),
            default_max_output_tokens=int(os.environ.get("AI_DEFAULT_MAX_OUTPUT_TOKENS", "800")),
            concurrency=int(os.environ.get("AI_WORKER_CONCURRENCY", "4")),
            embedding_model=os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
            embedding_dimensions=int(os.environ.get("OPENAI_EMBEDDING_DIMENSIONS", "1536")),
            price_embedding_per_1m=_optional_float("OPENAI_PRICE_EMBEDDING_PER_1M"),
            rag_top_k=int(os.environ.get("RAG_TOP_K", "5")),
            ask_max_output_tokens=int(os.environ.get("AI_ASK_MAX_OUTPUT_TOKENS", "500")),
            judge_model=os.environ.get("OPENAI_JUDGE_MODEL", ""),
        )
