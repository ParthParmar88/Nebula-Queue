package io.parth.nebulaqueue.consumer;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import io.parth.nebulaqueue.config.JobStatusPublisher;
import io.parth.nebulaqueue.config.RabbitMQConfig;
import io.parth.nebulaqueue.dto.JobStreamEvent;
import lombok.RequiredArgsConstructor;

/**
 * Forwards text chunks from the AI worker (RabbitMQ {@code job-events}) to the browser
 * (WebSocket). Workers never talk to browsers directly; the API stays the only gateway
 * and applies the same per-user routing as status updates.
 */
@Component
@RequiredArgsConstructor
public class JobStreamRelay {

    private final JobStatusPublisher publisher;

    @RabbitListener(queues = RabbitMQConfig.STREAM_QUEUE)
    public void onStreamEvent(JobStreamEvent event) {
        if (event.jobId() == null || event.delta() == null || event.delta().isEmpty()) {
            return;
        }
        publisher.publishStreamDelta(event);
    }
}
