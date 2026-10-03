package io.parth.nebulaqueue.dto;

import java.math.BigDecimal;

import io.parth.nebulaqueue.model.JobStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /internal/worker/jobs/{id}/finish}: the final state of a job plus
 * what it produced. Used by the AI worker, whose output is too large for query params.
 */
public record WorkerResultRequest(
        @NotNull JobStatus status,
        @Size(max = 2_000) String resultUrl,
        @Size(max = 200_000) String output,
        @Size(max = 100) String model,
        @PositiveOrZero Integer inputTokens,
        @PositiveOrZero Integer outputTokens,
        @PositiveOrZero BigDecimal costUsd) {
}
