package io.parth.nebulaqueue.exception;

/** The uploaded file can't be accepted (empty, wrong type, not really a PDF…). Mapped to 400. */
public class InvalidDocumentException extends RuntimeException {

    public InvalidDocumentException(String message) {
        super(message);
    }
}
