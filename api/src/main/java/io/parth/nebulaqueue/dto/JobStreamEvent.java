package io.parth.nebulaqueue.dto;

/**
 * A chunk of generated text published by the AI worker to the {@code job-events} exchange.
 * {@code seq} increases by one per chunk so clients can detect gaps and ordering.
 */
public record JobStreamEvent(String jobId, String owner, int seq, String delta) {
}
