package io.parth.nebulaqueue.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import io.parth.nebulaqueue.config.JobStatusPublisher;
import io.parth.nebulaqueue.dto.SubmitJobRequest;
import io.parth.nebulaqueue.dto.WorkerResultRequest;
import io.parth.nebulaqueue.exception.InvalidJobRequestException;
import io.parth.nebulaqueue.exception.InvalidJobStateException;
import io.parth.nebulaqueue.exception.JobNotFoundException;
import io.parth.nebulaqueue.exception.TooManyJobsException;
import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.model.JobStatus;
import io.parth.nebulaqueue.model.JobType;
import io.parth.nebulaqueue.producer.JobProducer;
import io.parth.nebulaqueue.repository.JobRepository;

class JobServiceTest {

    private JobRepository jobRepository;
    private JobProducer jobProducer;
    private JobStatusPublisher publisher;
    private JobService jobService;

    @BeforeEach
    void setUp() {
        jobRepository = mock(JobRepository.class);
        jobProducer = mock(JobProducer.class);
        publisher = mock(JobStatusPublisher.class);
        jobService = new JobService(jobRepository, jobProducer, publisher, new JobPayloadValidator());
        when(jobRepository.save(any(Job.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    // ── AI jobs ──────────────────────────────────────────────────────────────

    @Test
    void aiJobWithoutPromptIsRejectedBeforeQueueing() {
        signIn("alice@example.com", "ROLE_USER");

        assertThatThrownBy(() -> jobService.submitJob(new SubmitJobRequest(JobType.AI_GENERATE, "{\"prompt\": \"  \"}")))
                .isInstanceOf(InvalidJobRequestException.class);
        verify(jobProducer, never()).sendJob(any());
    }

    @Test
    void aiJobsAreCappedPerUser() {
        signIn("alice@example.com", "ROLE_USER");
        when(jobRepository.countBySubmittedByAndTypeInAndStatusIn(eq("alice@example.com"), anyCollection(), anyCollection()))
                .thenReturn(3L);

        assertThatThrownBy(() -> jobService.submitJob(new SubmitJobRequest(JobType.AI_GENERATE, "{\"prompt\": \"hi\"}")))
                .isInstanceOf(TooManyJobsException.class);
        verify(jobProducer, never()).sendJob(any());
    }

    @Test
    void aiJobUnderTheCapIsQueued() {
        signIn("alice@example.com", "ROLE_USER");
        when(jobRepository.countBySubmittedByAndTypeInAndStatusIn(eq("alice@example.com"), anyCollection(), anyCollection()))
                .thenReturn(2L);

        Job saved = jobService.submitJob(new SubmitJobRequest(JobType.AI_GENERATE, "{\"prompt\": \"hi\"}"));

        verify(jobProducer).sendJob(saved);
    }

    @Test
    void finishStoresOutputAndUsage() {
        signIn("worker", "ROLE_ADMIN");
        when(jobRepository.findById("j1")).thenReturn(Optional.of(job("j1", "alice@example.com", JobStatus.PROCESSING)));

        Job done = jobService.finishJob("j1", new WorkerResultRequest(
                JobStatus.COMPLETED, null, "Hello!", "gpt-test", 12, 3, new BigDecimal("0.000042")));

        assertThat(done.getStatus()).isEqualTo(JobStatus.COMPLETED);
        assertThat(done.getOutput()).isEqualTo("Hello!");
        assertThat(done.getModel()).isEqualTo("gpt-test");
        assertThat(done.getInputTokens()).isEqualTo(12);
        assertThat(done.getOutputTokens()).isEqualTo(3);
        assertThat(done.getCostUsd()).isEqualByComparingTo("0.000042");
        assertThat(done.getCompletedAt()).isNotNull();
        verify(publisher).publish(done);
    }

    @Test
    void finishRejectsNonTerminalStatus() {
        signIn("worker", "ROLE_ADMIN");

        assertThatThrownBy(() -> jobService.finishJob("j1",
                new WorkerResultRequest(JobStatus.PROCESSING, null, null, null, null, null, null)))
                .isInstanceOf(InvalidJobRequestException.class);
    }

    // ── existing behaviour ───────────────────────────────────────────────────

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void submitCreatesPendingJobOwnedByCaller() {
        signIn("alice@example.com", "ROLE_USER");

        Job saved = jobService.submitJob(new SubmitJobRequest(JobType.EMAIL_SEND, "{}"));

        assertThat(saved.getId()).isNull();   // always a new row, never an existing id
        assertThat(saved.getStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(saved.getSubmittedBy()).isEqualTo("alice@example.com");
        verify(jobProducer).sendJob(saved);
    }

    @Test
    void userCannotReadSomeoneElsesJob() {
        signIn("mallory@example.com", "ROLE_USER");
        when(jobRepository.findById("j1")).thenReturn(Optional.of(job("j1", "alice@example.com", JobStatus.PENDING)));

        assertThatThrownBy(() -> jobService.getJobById("j1")).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void missingJobIsNotFound() {
        signIn("alice@example.com", "ROLE_USER");
        when(jobRepository.findById("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> jobService.getJobById("nope")).isInstanceOf(JobNotFoundException.class);
    }

    @Test
    void cancellingAStartedJobIsAConflict() {
        signIn("alice@example.com", "ROLE_USER");
        when(jobRepository.findById("j1")).thenReturn(Optional.of(job("j1", "alice@example.com", JobStatus.PROCESSING)));

        assertThatThrownBy(() -> jobService.cancelJob("j1")).isInstanceOf(InvalidJobStateException.class);
        verify(publisher, never()).publish(any());
    }

    @Test
    void workerCannotStartACancelledJob() {
        signIn("worker", "ROLE_ADMIN");
        when(jobRepository.findById("j1")).thenReturn(Optional.of(job("j1", "alice@example.com", JobStatus.CANCELLED)));

        assertThatThrownBy(() -> jobService.updateJobStatus("j1", JobStatus.PROCESSING, null))
                .isInstanceOf(InvalidJobStateException.class);
    }

    @Test
    void completingAJobRecordsResultAndPublishesIt() {
        signIn("worker", "ROLE_ADMIN");
        when(jobRepository.findById("j1")).thenReturn(Optional.of(job("j1", "alice@example.com", JobStatus.PROCESSING)));

        Job updated = jobService.updateJobStatus("j1", JobStatus.COMPLETED, "done");

        assertThat(updated.getStatus()).isEqualTo(JobStatus.COMPLETED);
        assertThat(updated.getResultUrl()).isEqualTo("done");
        assertThat(updated.getCompletedAt()).isNotNull();
        verify(publisher).publish(updated);
    }

    private static Job job(String id, String owner, JobStatus status) {
        Job job = new Job();
        job.setId(id);
        job.setType(JobType.BATCH);
        job.setStatus(status);
        job.setSubmittedBy(owner);
        return job;
    }

    private static void signIn(String name, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(name, null, List.of(new SimpleGrantedAuthority(role))));
    }
}
