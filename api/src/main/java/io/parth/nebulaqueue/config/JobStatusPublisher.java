package io.parth.nebulaqueue.config;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import io.parth.nebulaqueue.model.Job;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Pushes job updates over STOMP: to the job's owner on their private queue, and to admins.
 * The payload is the full job, so the UI can show results/errors without reloading.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JobStatusPublisher {

    /** Clients subscribe to {@code /user/queue/jobs}; Spring routes it to the owner's sessions only. */
    public static final String USER_QUEUE = "/queue/jobs";
    /** Every job's updates; subscribing requires ROLE_ADMIN (see {@link WebSocketAuthInterceptor}). */
    public static final String ADMIN_TOPIC = "/topic/admin/jobs";

    private final SimpMessagingTemplate messagingTemplate;

    public void publish(Job job) {
        if (job.getSubmittedBy() != null) {
            messagingTemplate.convertAndSendToUser(job.getSubmittedBy(), USER_QUEUE, job);
        }
        messagingTemplate.convertAndSend(ADMIN_TOPIC, job);
        log.info("📡 Job {} → {}", job.getId(), job.getStatus());
    }
}
