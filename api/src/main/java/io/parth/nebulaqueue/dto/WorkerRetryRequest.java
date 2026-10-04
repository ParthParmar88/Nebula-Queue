package io.parth.nebulaqueue.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /internal/worker/jobs/{id}/retry-scheduled}: the worker hit a
 * temporary error and will try again after {@code delaySeconds}.
 */
public record WorkerRetryRequest(
        @NotBlank @Size(max = 2_000) String error,
        @Min(1) @Max(3_600) int delaySeconds) {
}
