"""The retrieval index: document chunks and their embeddings in Postgres (pgvector).

The AI worker owns this table; the API owns documents and jobs. The API only touches
it to delete a document's chunks."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from .documents import Chunk


@dataclass(frozen=True)
class SearchHit:
    document_id: str
    chunk_index: int
    page: int | None
    text: str
    score: float  # cosine similarity, 1 = identical


class VectorStore(Protocol):
    async def replace_chunks(self, document_id: str, chunks: Sequence[Chunk], vectors: Sequence[list[float]]) -> None: ...

    async def search(self, vector: list[float], document_ids: Sequence[str], limit: int) -> list[SearchHit]: ...


def _vector_literal(vector: Sequence[float]) -> str:
    # pgvector's text format; avoids needing a binary codec (and numpy) on the client
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


class PgVectorStore:
    def __init__(self, pool, dimensions: int) -> None:
        self._pool = pool
        self._dimensions = int(dimensions)

    @classmethod
    async def connect(cls, database_url: str, dimensions: int) -> PgVectorStore:
        import asyncpg

        pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5)
        store = cls(pool, dimensions)
        await store.ensure_schema()
        return store

    async def ensure_schema(self) -> None:
        async with self._pool.acquire() as conn, conn.transaction():
            # Several workers may start at once; serialize the DDL
            await conn.execute("SELECT pg_advisory_xact_lock(727274)")
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            await conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS document_chunks (
                    id          BIGSERIAL PRIMARY KEY,
                    document_id VARCHAR(64) NOT NULL,
                    chunk_index INT NOT NULL,
                    page        INT,
                    content     TEXT NOT NULL,
                    embedding   vector({self._dimensions}) NOT NULL,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (document_id, chunk_index)
                )
                """
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx "
                "ON document_chunks USING hnsw (embedding vector_cosine_ops)"
            )

    async def replace_chunks(self, document_id: str, chunks: Sequence[Chunk], vectors: Sequence[list[float]]) -> None:
        """Atomically swap a document's chunks, so re-indexing never leaves a mix."""
        rows = [
            (document_id, chunk.index, chunk.page, chunk.text, _vector_literal(vector))
            for chunk, vector in zip(chunks, vectors, strict=True)
        ]
        async with self._pool.acquire() as conn, conn.transaction():
            await conn.execute("DELETE FROM document_chunks WHERE document_id = $1", document_id)
            await conn.executemany(
                "INSERT INTO document_chunks (document_id, chunk_index, page, content, embedding) "
                "VALUES ($1, $2, $3, $4, $5::vector)",
                rows,
            )

    async def search(self, vector: list[float], document_ids: Sequence[str], limit: int) -> list[SearchHit]:
        rows = await self._pool.fetch(
            """
            SELECT document_id, chunk_index, page, content, 1 - (embedding <=> $1::vector) AS score
            FROM document_chunks
            WHERE document_id = ANY($2::varchar[])
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            """,
            _vector_literal(vector),
            list(document_ids),
            limit,
        )
        return [
            SearchHit(r["document_id"], r["chunk_index"], r["page"], r["content"], float(r["score"])) for r in rows
        ]

    async def close(self) -> None:
        await self._pool.close()
