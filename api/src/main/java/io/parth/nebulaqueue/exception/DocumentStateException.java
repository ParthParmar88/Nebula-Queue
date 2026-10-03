package io.parth.nebulaqueue.exception;

/** The document isn't in a state that allows the request (e.g. deleting while it's indexing). Mapped to 409. */
public class DocumentStateException extends RuntimeException {

    public DocumentStateException(String message) {
        super(message);
    }
}
