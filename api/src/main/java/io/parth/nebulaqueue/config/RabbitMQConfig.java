package io.parth.nebulaqueue.config;

import org.springframework.amqp.core.AmqpTemplate;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topology:
 * <pre>
 *  API ──job-exchange──┬─ job.routing.key ─▶ job-queue     ─▶ Node worker (email, …)
 *                      └─ job.ai          ─▶ ai-job-queue  ─▶ Python AI worker
 *
 *  AI worker ──job-events── job.stream ─▶ job-stream-events ─▶ API ─▶ WebSocket
 * </pre>
 * Job state changes go through the API's validated HTTP endpoints; only the ephemeral
 * token stream travels over {@code job-events}.
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "job-exchange";

    public static final String QUEUE_NAME    = "job-queue";
    public static final String ROUTING_KEY   = "job.routing.key";

    public static final String AI_QUEUE_NAME  = "ai-job-queue";
    public static final String AI_ROUTING_KEY = "job.ai";

    public static final String EVENTS_EXCHANGE    = "job-events";
    public static final String STREAM_QUEUE       = "job-stream-events";
    public static final String STREAM_ROUTING_KEY = "job.stream";

    /** Stream chunks older than this are useless to a viewer; drop them if the API was down. */
    private static final int STREAM_EVENT_TTL_MS = 30_000;

    @Bean
    public DirectExchange jobExchange() {
        return new DirectExchange(EXCHANGE_NAME);
    }

    @Bean
    public Queue jobQueue() {
        return new Queue(QUEUE_NAME, true);
    }

    @Bean
    public Binding jobBinding() {
        return BindingBuilder.bind(jobQueue()).to(jobExchange()).with(ROUTING_KEY);
    }

    @Bean
    public Queue aiJobQueue() {
        return new Queue(AI_QUEUE_NAME, true);
    }

    @Bean
    public Binding aiJobBinding() {
        return BindingBuilder.bind(aiJobQueue()).to(jobExchange()).with(AI_ROUTING_KEY);
    }

    @Bean
    public DirectExchange eventsExchange() {
        return new DirectExchange(EVENTS_EXCHANGE);
    }

    @Bean
    public Queue streamQueue() {
        return QueueBuilder.nonDurable(STREAM_QUEUE).ttl(STREAM_EVENT_TTL_MS).build();
    }

    @Bean
    public Binding streamBinding() {
        return BindingBuilder.bind(streamQueue()).to(eventsExchange()).with(STREAM_ROUTING_KEY);
    }

    /** Also used by @RabbitListener methods (Spring Boot picks up this bean). */
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new JacksonJsonMessageConverter();
    }

    @Bean
    public AmqpTemplate amqpTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(jsonMessageConverter());
        return rabbitTemplate;
    }
}
