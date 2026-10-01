package io.parth.nebulaqueue.model;

import static io.parth.nebulaqueue.model.JobStatus.*;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class JobStatusTest {

    @Test
    void allowsTheNormalLifecycle() {
        assertThat(PENDING.canTransitionTo(PROCESSING)).isTrue();
        assertThat(PENDING.canTransitionTo(CANCELLED)).isTrue();
        assertThat(PROCESSING.canTransitionTo(COMPLETED)).isTrue();
        assertThat(PROCESSING.canTransitionTo(FAILED)).isTrue();
    }

    @Test
    void rejectsSkippingOrReversingStates() {
        assertThat(PENDING.canTransitionTo(COMPLETED)).isFalse();
        assertThat(PENDING.canTransitionTo(FAILED)).isFalse();
        assertThat(PROCESSING.canTransitionTo(CANCELLED)).isFalse();
        assertThat(PROCESSING.canTransitionTo(PENDING)).isFalse();
    }

    @Test
    void finishedJobsCannotChange() {
        for (JobStatus next : JobStatus.values()) {
            assertThat(COMPLETED.canTransitionTo(next)).isFalse();
            assertThat(FAILED.canTransitionTo(next)).isFalse();
            // a cancelled job still in the queue must not be picked up by the worker
            assertThat(CANCELLED.canTransitionTo(next)).isFalse();
        }
    }
}
