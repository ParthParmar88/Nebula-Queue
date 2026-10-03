"""Client for the API's internal worker endpoints (authenticated with X-Worker-Token)."""

from __future__ import annotations

from decimal import Decimal

import httpx

from .llm import Usage


class JobNotRunnable(Exception):
    """The API refused to start the job: it was cancelled (409) or no longer exists (404)."""


class ApiClient:
    def __init__(self, base_url: str, token: str, client: httpx.AsyncClient | None = None) -> None:
        self._client = client or httpx.AsyncClient(base_url=base_url, timeout=15.0)
        self._headers = {"X-Worker-Token": token}

    async def start(self, job_id: str) -> None:
        """Claim the job (PENDING → PROCESSING)."""
        response = await self._client.patch(
            f"/internal/worker/jobs/{job_id}/status", params={"status": "PROCESSING"}, headers=self._headers
        )
        if response.status_code in (404, 409):
            raise JobNotRunnable(f"HTTP {response.status_code}")
        response.raise_for_status()

    async def finish(
        self,
        job_id: str,
        *,
        status: str,
        output: str | None = None,
        result: str | None = None,
        model: str | None = None,
        usage: Usage | None = None,
        cost: Decimal | None = None,
    ) -> None:
        body = {
            "status": status,
            "output": output,
            "resultUrl": result,
            "model": model,
            "inputTokens": usage.input_tokens if usage else None,
            "outputTokens": usage.output_tokens if usage else None,
            "costUsd": str(cost) if cost is not None else None,
        }
        response = await self._client.post(
            f"/internal/worker/jobs/{job_id}/finish",
            json={k: v for k, v in body.items() if v is not None},
            headers=self._headers,
        )
        response.raise_for_status()

    async def aclose(self) -> None:
        await self._client.aclose()
