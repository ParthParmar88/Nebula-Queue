package io.parth.nebulaqueue.dto;

import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.model.JobType;

/**
 * What the API publishes to RabbitMQ for the worker — just what it needs to run the job.
 */
public record JobMessage(String id, JobType type, String payload) {

    public static JobMessage from(Job job) {
        return new JobMessage(job.getId(), job.getType(), job.getPayload());
    }
}
