"""Token cost calculation. Prices come from configuration because they change over time
and differ per model — check your provider's pricing page and set them in .env."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from .llm import Usage

_PER_MILLION = Decimal(1_000_000)
_SIX_PLACES = Decimal("0.000001")


def cost_usd(usage: Usage | None, price_input_per_1m: float | None, price_output_per_1m: float | None) -> Decimal | None:
    """Cost of one call in USD (6 decimal places), or None if usage or prices are unknown."""
    if usage is None or price_input_per_1m is None or price_output_per_1m is None:
        return None
    cost = (
        Decimal(usage.input_tokens) * Decimal(str(price_input_per_1m))
        + Decimal(usage.output_tokens) * Decimal(str(price_output_per_1m))
    ) / _PER_MILLION
    return cost.quantize(_SIX_PLACES, rounding=ROUND_HALF_UP)


def embedding_cost_usd(tokens: int, price_per_1m: float | None) -> Decimal | None:
    if price_per_1m is None:
        return None
    return (Decimal(tokens) * Decimal(str(price_per_1m)) / _PER_MILLION).quantize(_SIX_PLACES, rounding=ROUND_HALF_UP)


def add_costs(*costs: Decimal | None) -> Decimal | None:
    """Sum of the known costs; None only if none are known."""
    known = [c for c in costs if c is not None]
    return sum(known, Decimal(0)) if known else None
