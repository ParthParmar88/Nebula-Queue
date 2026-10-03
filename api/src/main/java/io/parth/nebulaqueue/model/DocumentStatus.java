package io.parth.nebulaqueue.model;

public enum DocumentStatus {
    /** Uploaded; the ingest job is extracting text and creating embeddings. */
    PROCESSING,
    /** Indexed and searchable by AI_ASK jobs. */
    READY,
    FAILED
}
