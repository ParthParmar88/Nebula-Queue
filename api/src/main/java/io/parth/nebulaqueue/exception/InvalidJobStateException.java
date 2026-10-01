package io.parth.nebulaqueue.exception;

/**
 * The job is not in a state that allows the requested change (e.g. cancelling a job that
 * already started, or a worker picking up a job that was cancelled). Mapped to 409.
 */
public class InvalidJobStateException extends RuntimeException {

    public InvalidJobStateException(String message) {
        super(message);
    }
}
