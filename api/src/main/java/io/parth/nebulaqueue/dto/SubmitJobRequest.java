package io.parth.nebulaqueue.dto;

import io.parth.nebulaqueue.model.JobType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/jobs}. Only these fields are client-controlled; id, status,
 * owner and timestamps are always set by the server.
 */
public record SubmitJobRequest(
        @NotNull JobType type,
        @Size(max = 10_000) String payload) {
}
