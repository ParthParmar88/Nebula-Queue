package io.parth.nebulaqueue.config;

import java.util.Map;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import io.parth.nebulaqueue.dto.JobStreamEvent;
import io.parth.nebulaqueue.model.Job;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Pushes job updates over STOMP: to the job's owner on their private queues, and to admins.
 * Status updates carry the full job; stream updates carry a chunk of generated text.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JobStatusPublisher {

    /** Clients subscribe to {@code /user/queue/jobs}; Spring routes it to the owner's sessions only. */
    public static final String USER_QUEUE = "/queue/jobs";
    /** Every job's updates; subscribing requires ROLE_ADMIN (see {@link WebSocketAuthInterceptor}). */
    public static final String ADMIN_TOPIC = "/topic/admin/jobs";

    /** Live text chunks of AI jobs, per owner ({@code /user/queue/job-stream}) and for admins. */
    public static final String USER_STREAM_QUEUE = "/queue/job-stream";
    public static final String ADMIN_STREAM_TOPIC = "/topic/admin/job-stream";

    private final SimpMessagingTemplate messagingTemplate;

    public void publish(Job job) {
        if (job.getSubmittedBy() != null) {
            messagingTemplate.convertAndSendToUser(job.getSubmittedBy(), USER_QUEUE, job);
        }
        messagingTemplate.convertAndSend(ADMIN_TOPIC, job);
        log.info("📡 Job {} → {}", job.getId(), job.getStatus());
    }

    public void publishStreamDelta(JobStreamEvent event) {
        // The owner comes from the worker's event, so the browser never sees other users' chunks
        // typed as Object: with a Map, convertAndSend(String, Map) can't tell payload from headers
        Object payload = Map.of("jobId", event.jobId(), "seq", event.seq(), "delta", event.delta());
        if (event.owner() != null) {
            messagingTemplate.convertAndSendToUser(event.owner(), USER_STREAM_QUEUE, payload);
        }
        messagingTemplate.convertAndSend(ADMIN_STREAM_TOPIC, payload);
    }
}
