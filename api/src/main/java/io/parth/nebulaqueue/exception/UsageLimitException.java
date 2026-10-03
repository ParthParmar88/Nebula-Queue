package io.parth.nebulaqueue.exception;

/** The user hit a usage limit (too many AI jobs running, too many documents…). Mapped to 429. */
public class UsageLimitException extends RuntimeException {

    public UsageLimitException(String message) {
        super(message);
    }
}
