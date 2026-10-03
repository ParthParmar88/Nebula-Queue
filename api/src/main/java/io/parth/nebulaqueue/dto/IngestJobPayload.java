package io.parth.nebulaqueue.dto;

/** Payload of an INGEST_DOCUMENT job; the worker downloads the file by id. */
public record IngestJobPayload(String documentId, String filename, String contentType) {
}
