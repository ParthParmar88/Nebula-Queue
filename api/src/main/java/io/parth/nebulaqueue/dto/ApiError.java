package io.parth.nebulaqueue.dto;

import java.time.Instant;

/**
 * Error body returned by {@link io.parth.nebulaqueue.exception.GlobalExceptionHandler}.
 * The client reads {@code message}.
 */
public record ApiError(int status, String error, String message, Instant timestamp) {
}
