package io.parth.nebulaqueue.controller;

import java.util.List;

import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.QueueInformation;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.parth.nebulaqueue.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;

/** Operational views for admins (the /api/admin/** path also requires ROLE_ADMIN in SecurityConfig). */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    /** Every queue in the system and what it's for; the retry/DLQ ones are declared by the workers. */
    private static final List<QueueRole> QUEUES = List.of(
            new QueueRole(RabbitMQConfig.QUEUE_NAME, "work", "Node worker jobs"),
            new QueueRole(RabbitMQConfig.AI_QUEUE_NAME, "work", "AI worker jobs"),
            new QueueRole("ai-job-retry-5s", "retry", "AI retries waiting 5 s"),
            new QueueRole("ai-job-retry-30s", "retry", "AI retries waiting 30 s"),
            new QueueRole("ai-job-dlq", "dead-letter", "AI jobs that failed every attempt"),
            new QueueRole("job-dlq", "dead-letter", "Node worker jobs that failed"),
            new QueueRole(RabbitMQConfig.STREAM_QUEUE, "events", "Live AI output to browsers"));

    private final AmqpAdmin amqpAdmin;

    record QueueRole(String name, String role, String description) {
    }

    public record QueueStats(String name, String role, String description, boolean exists, long messages, int consumers) {
    }

    /** Depth and consumers per queue, read live from RabbitMQ. */
    @GetMapping("/queues")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<QueueStats>> queues() {
        return ResponseEntity.ok(QUEUES.stream().map(q -> {
            QueueInformation info = amqpAdmin.getQueueInfo(q.name());
            return info == null
                    ? new QueueStats(q.name(), q.role(), q.description(), false, 0, 0)
                    : new QueueStats(q.name(), q.role(), q.description(), true, info.getMessageCount(), info.getConsumerCount());
        }).toList());
    }
}
