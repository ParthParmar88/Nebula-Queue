package io.parth.nebulaqueue.model;

public enum JobStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED,
    CANCELLED;

    // legal transitions: PENDING → PROCESSING → COMPLETED | FAILED
    //                    PENDING → CANCELLED
    public boolean canTransitionTo(JobStatus next) {
        return switch (this) {
            case PENDING    -> next == PROCESSING || next == CANCELLED;
            case PROCESSING -> next == COMPLETED || next == FAILED;
            default         -> false;
        };
    }
}
