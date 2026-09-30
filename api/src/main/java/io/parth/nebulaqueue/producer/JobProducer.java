package io.parth.nebulaqueue.producer;

import org.springframework.amqp.core.AmqpTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import io.parth.nebulaqueue.config.RabbitMQConfig;
import io.parth.nebulaqueue.model.Job;

@Service
public class JobProducer {

    @Autowired
    private AmqpTemplate amqpTemplate;

    public void sendJob(Job job) {
        amqpTemplate.convertAndSend(
            RabbitMQConfig.EXCHANGE_NAME,
            RabbitMQConfig.ROUTING_KEY,
            job
        );
        System.out.println("📨 Job pushed to queue: " + job.getId());
    }
}