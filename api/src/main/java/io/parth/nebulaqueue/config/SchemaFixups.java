package io.parth.nebulaqueue.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * When Hibernate creates the {@code jobs} table it adds {@code CHECK (type IN (...))} listing
 * the enum values that existed at that moment, and {@code ddl-auto=update} never refreshes
 * it — so adding a job type (like AI_GENERATE) would make inserts fail on databases created
 * earlier. The Java enums are the source of truth, so drop those checks.
 *
 * TODO: replace ddl-auto with Flyway migrations, which would make this unnecessary.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SchemaFixups implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbc.execute("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_type_check");
            jdbc.execute("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check");
        } catch (Exception e) {
            log.warn("Could not drop enum check constraints on jobs: {}", e.getMessage());
        }
    }
}
