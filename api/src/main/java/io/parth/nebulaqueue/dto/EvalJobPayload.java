package io.parth.nebulaqueue.dto;

import java.util.List;

/**
 * The EVAL_RUN payload as stored and queued: the test cases plus the documents the API has
 * resolved for this user. Re-running an evaluation reuses this payload.
 *
 * @param topK how many passages to retrieve per question (the knob being evaluated)
 */
public record EvalJobPayload(String name, int topK, List<AskJobPayload.DocumentRef> documents, List<Case> cases) {

    /**
     * @param expected           the reference answer the judge compares against
     * @param expectedDocumentId optional: the document that should be retrieved
     * @param expectedPage       optional: the page that should be retrieved
     */
    public record Case(String question, String expected, String expectedDocumentId, Integer expectedPage) {
    }
}
