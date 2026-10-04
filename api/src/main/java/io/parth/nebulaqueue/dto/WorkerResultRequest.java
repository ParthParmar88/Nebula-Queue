package io.parth.nebulaqueue.dto;

import java.math.BigDecimal;

import io.parth.nebulaqueue.model.JobStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /internal/worker/jobs/{id}/finish}: the final state of a job plus
 * what it produced. Used by the AI worker, whose output is too large for query params.
 * {@code sources} is a JSON array of cited passages (AI_ASK) and {@code report} the
 * evaluation report (EVAL_RUN); both are stored as-is for the UI.
 */
public record WorkerResultRequest(
        @NotNull JobStatus status,
        @Size(max = 2_000) String resultUrl,
        @Size(max = 200_000) String output,
        @Size(max = 100) String model,
        @PositiveOrZero Integer inputTokens,
        @PositiveOrZero Integer outputTokens,
        @PositiveOrZero BigDecimal costUsd,
        @Size(max = 100_000) String sources,
        @Size(max = 500_000) String report) {
}
