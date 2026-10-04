package io.parth.nebulaqueue.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enables @Scheduled tasks (see StuckJobReaper). */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
