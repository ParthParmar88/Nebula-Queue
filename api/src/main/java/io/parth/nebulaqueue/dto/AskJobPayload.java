package io.parth.nebulaqueue.dto;

import java.util.List;

/**
 * The AI_ASK payload as stored and queued, after the API has resolved which documents the
 * user may search. The worker only ever searches these ids, so it never needs to check
 * ownership itself.
 */
public record AskJobPayload(String question, List<DocumentRef> documents) {

    public record DocumentRef(String id, String filename) {
    }
}
