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
import io.parth.nebulaqueue.exception.UsageLimitException;
import io.parth.nebulaqueue.model.Document;
import io.parth.nebulaqueue.model.DocumentStatus;
import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.model.JobStatus;
import io.parth.nebulaqueue.model.JobType;
import io.parth.nebulaqueue.producer.JobProducer;
import io.parth.nebulaqueue.repository.DocumentRepository;
import io.parth.nebulaqueue.repository.JobRepository;

class JobServiceTest {

    private JobRepository jobRepository;
    private JobProducer jobProducer;
    private JobStatusPublisher publisher;
    private DocumentRepository documentRepository;
    private JobService jobService;

    @BeforeEach
    void setUp() {
        jobRepository = mock(JobRepository.class);
        jobProducer = mock(JobProducer.class);
        publisher = mock(JobStatusPublisher.class);
        documentRepository = mock(DocumentRepository.class);
        jobService = new JobService(jobRepository, jobProducer, publisher, new JobPayloadValidator(), documentRepository);
        when(jobRepository.save(any(Job.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    // ── document Q&A ─────────────────────────────────────────────────────────

    @Test
    void askWithoutSelectionSearchesAllReadyDocumentsOfTheUser() {
        signIn("alice@example.com", "ROLE_USER");
        when(documentRepository.findByOwnerAndStatusOrderByCreatedAtDesc("alice@example.com", DocumentStatus.READY))
                .thenReturn(List.of(document("d1", "alice@example.com", DocumentStatus.READY)));

        Job saved = jobService.submitJob(new SubmitJobRequest(JobType.AI_ASK, "{\"question\": \" What is it? \"}"));

        assertThat(saved.getPayload())
                .isEqualTo("{\"question\":\"What is it?\",\"documents\":[{\"id\":\"d1\",\"filename\":\"d1.pdf\"}]}");
        verify(jobProducer).sendJob(saved);
    }

    @Test
    void askFailsClearlyWhenTheUserHasNoReadyDocuments() {
        signIn("alice@example.com", "ROLE_USER");
        when(documentRepository.findByOwnerAndStatusOrderByCreatedAtDesc("alice@example.com", DocumentStatus.READY))
                .thenReturn(List.of());

        assertThatThrownBy(() -> jobService.submitJob(new SubmitJobRequest(JobType.AI_ASK, "{\"question\": \"Hi?\"}")))
                .isInstanceOf(InvalidJobRequestException.class)
                .hasMessageContaining("Upload a document");
    }

    @Test
    void askCannotTargetSomeoneElsesDocument() {
        signIn("mallory@example.com", "ROLE_USER");
        when(documentRepository.findAllById(List.of("d1")))
                .thenReturn(List.of(document("d1", "alice@example.com", DocumentStatus.READY)));

        assertThatThrownBy(() -> jobService.submitJob(
                new SubmitJobRequest(JobType.AI_ASK, "{\"question\": \"Hi?\", \"documentIds\": [\"d1\"]}")))
                .isInstanceOf(InvalidJobRequestException.class)
                .hasMessageContaining("don't exist");
        verify(jobProducer, never()).sendJob(any());
    }

    // ── evaluations ──────────────────────────────────────────────────────────

    @Test
    void evalIsPinnedToReadyDocumentsWithDefaults() {
        signIn("alice@example.com", "ROLE_USER");
        when(documentRepository.findByOwnerAndStatusOrderByCreatedAtDesc("alice@example.com", DocumentStatus.READY))
                .thenReturn(List.of(document("d1", "alice@example.com", DocumentStatus.READY)));

        Job saved = jobService.submitJob(new SubmitJobRequest(JobType.EVAL_RUN,
                "{\"cases\": [{\"question\": \" Q? \", \"expected\": \" A \", \"expectedDocumentId\": \"d1\", \"expectedPage\": 2}]}"));

        assertThat(saved.getPayload()).isEqualTo("{\"name\":\"Evaluation\",\"topK\":5,"
                + "\"documents\":[{\"id\":\"d1\",\"filename\":\"d1.pdf\"}],"
                + "\"cases\":[{\"question\":\"Q?\",\"expected\":\"A\",\"expectedDocumentId\":\"d1\",\"expectedPage\":2}]}");
    }

    @Test
    void evalRejectsAnExpectedDocumentOutsideTheEvaluatedSet() {
        signIn("alice@example.com", "ROLE_USER");
        when(documentRepository.findByOwnerAndStatusOrderByCreatedAtDesc("alice@example.com", DocumentStatus.READY))
                .thenReturn(List.of(document("d1", "alice@example.com", DocumentStatus.READY)));

        assertThatThrownBy(() -> jobService.submitJob(new SubmitJobRequest(JobType.EVAL_RUN,
                "{\"cases\": [{\"question\": \"Q?\", \"expected\": \"A\", \"expectedDocumentId\": \"someone-elses\"}]}")))
                .isInstanceOf(InvalidJobRequestException.class)
                .hasMessageContaining("Case 1");
    }

    @Test
    void evalCountsTowardTheAiCap() {
        signIn("alice@example.com", "ROLE_USER");
        when(jobRepository.countBySubmittedByAndTypeInAndStatusIn(eq("alice@example.com"), anyCollection(), anyCollection()))
                .thenReturn(3L);

        assertThatThrownBy(() -> jobService.submitJob(new SubmitJobRequest(JobType.EVAL_RUN,
                "{\"cases\": [{\"question\": \"Q?\", \"expected\": \"A\"}]}")))
                .isInstanceOf(UsageLimitException.class);
    }

    @Test
    void finishStoresTheEvalReport() {
        signIn("worker", "ROLE_ADMIN");
        when(jobRepository.findById("j1")).thenReturn(Optional.of(job("j1", "alice@example.com", JobStatus.PROCESSING)));

        Job done = jobService.finishJob("j1", new WorkerResultRequest(
                JobStatus.COMPLETED, null, "summary", null, null, null, null, null, "{\"summary\":{}}"));

        assertThat(done.getReport()).isEqualTo("{\"summary\":{}}");
    }

    @Test
    void ingestJobsCannotBeSubmittedByUsers() {
        signIn("alice@example.com", "ROLE_USER");

        assertThatThrownBy(() -> jobService.submitJob(new SubmitJobRequest(JobType.INGEST_DOCUMENT, "{}")))
                .isInstanceOf(InvalidJobRequestException.class);
    }

    @Test
    void failedIngestMarksTheDocumentFailed() {
        signIn("worker", "ROLE_ADMIN");
        Job ingest = job("j1", "alice@example.com", JobStatus.PROCESSING);
        ingest.setType(JobType.INGEST_DOCUMENT);
        Document doc = document("d1", "alice@example.com", DocumentStatus.PROCESSING);
        when(jobRepository.findById("j1")).thenReturn(Optional.of(ingest));
        when(documentRepository.findByIngestJobId("j1")).thenReturn(Optional.of(doc));

        jobService.finishJob("j1", new WorkerResultRequest(
                JobStatus.FAILED, "Error: worker crashed", null, null, null, null, null, null, null));

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.FAILED);
        assertThat(doc.getError()).isEqualTo("Error: worker crashed");
        verify(documentRepository).save(doc);
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
                .isInstanceOf(UsageLimitException.class);
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
                JobStatus.COMPLETED, null, "Hello!", "gpt-test", 12, 3, new BigDecimal("0.000042"), null, null));

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
                new WorkerResultRequest(JobStatus.PROCESSING, null, null, null, null, null, null, null, null)))
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

    private static Document document(String id, String owner, DocumentStatus status) {
        Document doc = new Document();
        doc.setId(id);
        doc.setOwner(owner);
        doc.setFilename(id + ".pdf");
        doc.setStatus(status);
        return doc;
    }

    private static void signIn(String name, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(name, null, List.of(new SimpleGrantedAuthority(role))));
    }
}
