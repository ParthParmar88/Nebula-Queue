package io.parth.nebulaqueue.exception;

/** The request is well-formed JSON but its content isn't acceptable (e.g. a missing prompt). Mapped to 400. */
public class InvalidJobRequestException extends RuntimeException {

    public InvalidJobRequestException(String message) {
        super(message);
    }
}
