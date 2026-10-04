package io.parth.nebulaqueue.model;

public enum JobType {
    AI_GENERATE(true, true),
    AI_ASK(true, true),
    /** Runs a set of test questions through the RAG pipeline and scores the answers. */
    EVAL_RUN(true, true),
    /** Created by the API when a document is uploaded; not submittable directly. */
    INGEST_DOCUMENT(true, false),
    EMAIL_SEND(false, true),
    IMAGE_RESIZE(false, true),
    PDF_GENERATE(false, true),
    BATCH(false, true);

    private final boolean ai;
    private final boolean userSubmittable;

    JobType(boolean ai, boolean userSubmittable) {
        this.ai = ai;
        this.userSubmittable = userSubmittable;
    }

    /** AI jobs are routed to the Python AI worker's queue; everything else to the Node worker. */
    public boolean isAi() {
        return ai;
    }

    /** Whether users may submit this type through POST /api/jobs. */
    public boolean isUserSubmittable() {
        return userSubmittable;
    }

    /** AI jobs that call a chat model on the user's behalf — these count toward the per-user cap. */
    public boolean isMetered() {
        return ai && userSubmittable;
    }
}
