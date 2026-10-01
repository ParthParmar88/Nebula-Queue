package io.parth.nebulaqueue.producer;

import org.springframework.amqp.core.AmqpTemplate;
import org.springframework.stereotype.Service;

import io.parth.nebulaqueue.config.RabbitMQConfig;
import io.parth.nebulaqueue.dto.JobMessage;
import io.parth.nebulaqueue.model.Job;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobProducer {

    private final AmqpTemplate amqpTemplate;

    public void sendJob(Job job) {
        amqpTemplate.convertAndSend(
            RabbitMQConfig.EXCHANGE_NAME,
            RabbitMQConfig.ROUTING_KEY,
            JobMessage.from(job)
        );
        log.info("📨 Job pushed to queue: {}", job.getId());
    }
}
