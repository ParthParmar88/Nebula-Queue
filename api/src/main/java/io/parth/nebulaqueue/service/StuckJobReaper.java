package io.parth.nebulaqueue.service;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Safety net for workers that die mid-job without RabbitMQ redelivering the message
 * (e.g. the whole worker pool is gone): jobs stuck in PROCESSING too long are failed,
 * so users see an answer and can retry instead of waiting forever.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StuckJobReaper {

    private final JobService jobService;

    @Value("${app.jobs.stuck-after:PT10M}")
    private Duration stuckAfter;

    @Scheduled(fixedDelayString = "${app.jobs.reaper-interval:PT1M}", initialDelayString = "PT1M")
    public void reap() {
        int failed = jobService.failStuckJobs(stuckAfter);
        if (failed > 0) {
            log.warn("Reaper failed {} job(s) stuck in PROCESSING for over {}", failed, stuckAfter);
        }
    }
}
