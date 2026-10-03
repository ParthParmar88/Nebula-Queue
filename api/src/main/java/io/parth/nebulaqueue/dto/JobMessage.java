package io.parth.nebulaqueue.dto;

import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.model.JobType;

/**
 * What the API publishes to RabbitMQ for a worker — just what it needs to run the job.
 * {@code submittedBy} lets the AI worker tag its streaming events so the API can route
 * them to the owner's WebSocket without a database lookup per chunk.
 */
public record JobMessage(String id, JobType type, String payload, String submittedBy) {

    public static JobMessage from(Job job) {
        return new JobMessage(job.getId(), job.getType(), job.getPayload(), job.getSubmittedBy());
    }
}
