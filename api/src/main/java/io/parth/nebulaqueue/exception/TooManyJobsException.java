package io.parth.nebulaqueue.exception;

/** The user hit a usage limit (e.g. too many AI jobs running at once). Mapped to 429. */
public class TooManyJobsException extends RuntimeException {

    public TooManyJobsException(String message) {
        super(message);
    }
}
