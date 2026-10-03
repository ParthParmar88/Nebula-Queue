package io.parth.nebulaqueue.model;

public enum JobType {
    AI_GENERATE(true),
    EMAIL_SEND(false),
    IMAGE_RESIZE(false),
    PDF_GENERATE(false),
    BATCH(false);

    private final boolean ai;

    JobType(boolean ai) {
        this.ai = ai;
    }

    /** AI jobs are routed to the Python AI worker's queue; everything else to the Node worker. */
    public boolean isAi() {
        return ai;
    }
}
