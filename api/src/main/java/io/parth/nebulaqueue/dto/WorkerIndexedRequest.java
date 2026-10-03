package io.parth.nebulaqueue.dto;

import io.parth.nebulaqueue.model.DocumentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /internal/worker/documents/{id}/indexed}: the outcome of ingestion. */
public record WorkerIndexedRequest(
        @NotNull DocumentStatus status,
        @PositiveOrZero Integer pageCount,
        @PositiveOrZero Integer chunkCount,
        @Size(max = 2_000) String error) {
}
