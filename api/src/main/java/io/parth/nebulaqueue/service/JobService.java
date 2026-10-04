package io.parth.nebulaqueue.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import io.parth.nebulaqueue.config.JobStatusPublisher;
import io.parth.nebulaqueue.dto.AskJobPayload;
import io.parth.nebulaqueue.dto.EvalJobPayload;
import io.parth.nebulaqueue.dto.IngestJobPayload;
import io.parth.nebulaqueue.dto.SubmitJobRequest;
import io.parth.nebulaqueue.dto.WorkerResultRequest;
import io.parth.nebulaqueue.dto.WorkerRetryRequest;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobService {

    private static final List<JobType> METERED_TYPES = Arrays.stream(JobType.values()).filter(JobType::isMetered).toList();
    private static final List<JobStatus> ACTIVE_STATUSES = List.of(JobStatus.PENDING, JobStatus.PROCESSING);

    private final JobRepository jobRepository;
    private final JobProducer jobProducer;
    private final JobStatusPublisher jobStatusPublisher;
    private final JobPayloadValidator payloadValidator;
    private final DocumentRepository documentRepository;

    /** AI jobs cost money per call — cap how many one user can have queued or running at once. */
    @Value("${app.ai.max-active-jobs-per-user:3}")
    private int maxActiveAiJobsPerUser = 3;

    // Submit a job — always a new row, owned by the authenticated user
    public Job submitJob(SubmitJobRequest request) {
        if (!request.type().isUserSubmittable()) {
            throw new InvalidJobRequestException(request.type() + " jobs are created automatically and can't be submitted");
        }
        payloadValidator.validate(request.type(), request.payload());
        String currentUser = getCurrentUsername();
        checkAiQuota(request.type(), currentUser);

        String payload = switch (request.type()) {
            case AI_ASK -> resolveAskPayload(currentUser, payloadValidator.parseAsk(request.payload()));
            case EVAL_RUN -> resolveEvalPayload(currentUser, payloadValidator.parseEval(request.payload()));
            default -> request.payload();
        };
        return queue(request.type(), payload, currentUser, null);
    }

    /** Queue the indexing job for a freshly uploaded document (called by DocumentService). */
    public Job queueIngest(Document document) {
        String payload = payloadValidator.toJson(
                new IngestJobPayload(document.getId(), document.getFilename(), document.getContentType()));
        return queue(JobType.INGEST_DOCUMENT, payload, document.getOwner(), null);
    }

    /**
     * Run a failed or cancelled job again, as a new job linked to the old one (the failed
     * attempt stays in the history). Re-uses the stored payload, which for AI_ASK/EVAL_RUN
     * is already pinned to concrete documents.
     */
    public Job retryJob(String id) {
        Job old = getJobById(id);
        if (old.getStatus() != JobStatus.FAILED && old.getStatus() != JobStatus.CANCELLED) {
            throw new InvalidJobStateException("Only failed or cancelled jobs can be run again");
        }
        checkAiQuota(old.getType(), old.getSubmittedBy());

        if (old.getType() != JobType.INGEST_DOCUMENT) {
            return queue(old.getType(), old.getPayload(), old.getSubmittedBy(), old.getId());
        }
        // Re-indexing: the document goes back to PROCESSING and points at the new job
        Document document = documentRepository.findByIngestJobId(old.getId())
                .orElseThrow(() -> new InvalidJobStateException("The document for this job was deleted"));
        document.setStatus(DocumentStatus.PROCESSING);
        document.setError(null);
        documentRepository.save(document);
        Job job = queue(JobType.INGEST_DOCUMENT, old.getPayload(), old.getSubmittedBy(), old.getId());
        document.setIngestJobId(job.getId());
        documentRepository.save(document);
        return job;
    }

    private void checkAiQuota(JobType type, String user) {
        if (!type.isMetered()) {
            return;
        }
        long active = jobRepository.countBySubmittedByAndTypeInAndStatusIn(user, METERED_TYPES, ACTIVE_STATUSES);
        if (active >= maxActiveAiJobsPerUser) {
            throw new UsageLimitException("You already have " + active
                    + " AI jobs queued or running. Wait for one to finish before starting another.");
        }
    }

    private Job queue(JobType type, String payload, String owner, String retryOfJobId) {
        Job job = new Job();
        job.setType(type);
        job.setPayload(payload);
        job.setStatus(JobStatus.PENDING);
        job.setSubmittedBy(owner);
        job.setRetryOfJobId(retryOfJobId);

        Job savedJob = jobRepository.save(job);
        jobProducer.sendJob(savedJob);
        return savedJob;
    }

    private String resolveAskPayload(String user, JobPayloadValidator.AskPayload ask) {
        List<AskJobPayload.DocumentRef> refs = resolveDocuments(user, ask.documentIds());
        return payloadValidator.toJson(new AskJobPayload(ask.question().trim(), refs));
    }

    private String resolveEvalPayload(String user, JobPayloadValidator.EvalPayload eval) {
        List<AskJobPayload.DocumentRef> refs = resolveDocuments(user, eval.documentIds());
        Set<String> searchable = refs.stream().map(AskJobPayload.DocumentRef::id).collect(Collectors.toSet());

        List<EvalJobPayload.Case> cases = new ArrayList<>();
        for (int i = 0; i < eval.cases().size(); i++) {
            JobPayloadValidator.EvalCaseInput c = eval.cases().get(i);
            if (c.expectedDocumentId() != null && !searchable.contains(c.expectedDocumentId())) {
                throw new InvalidJobRequestException(
                        "Case " + (i + 1) + ": the expected document isn't among the documents being evaluated.");
            }
            cases.add(new EvalJobPayload.Case(c.question().trim(), c.expected().trim(), c.expectedDocumentId(), c.expectedPage()));
        }
        String name = eval.name() == null || eval.name().isBlank() ? "Evaluation" : eval.name().trim();
        int topK = eval.topK() == null ? JobPayloadValidator.DEFAULT_TOP_K : eval.topK();
        return payloadValidator.toJson(new EvalJobPayload(name, topK, refs, cases));
    }

    /**
     * Pin a job to concrete documents the user owns and that are ready to search.
     * No ids means "all my ready documents". Unknown or foreign ids get the same message,
     * so the API doesn't reveal which document ids exist.
     */
    private List<AskJobPayload.DocumentRef> resolveDocuments(String user, List<String> documentIds) {
        List<Document> documents;
        if (documentIds == null || documentIds.isEmpty()) {
            documents = documentRepository.findByOwnerAndStatusOrderByCreatedAtDesc(user, DocumentStatus.READY);
            if (documents.isEmpty()) {
                throw new InvalidJobRequestException(
                        "Upload a document and wait for it to finish indexing before asking questions.");
            }
        } else {
            List<String> ids = documentIds.stream().distinct().toList();
            documents = documentRepository.findAllById(ids);
            if (documents.size() != ids.size() || documents.stream().anyMatch(d -> !user.equals(d.getOwner()))) {
                throw new InvalidJobRequestException("Some selected documents don't exist.");
            }
            documents.stream().filter(d -> d.getStatus() != DocumentStatus.READY).findFirst().ifPresent(d -> {
                throw new InvalidJobRequestException("“" + d.getFilename() + "” isn't ready to search yet.");
            });
        }
        return documents.stream().map(d -> new AskJobPayload.DocumentRef(d.getId(), d.getFilename())).toList();
    }

    // Update status — workers call this; admins can also call it manually
    public Job updateJobStatus(String id, JobStatus status, String resultUrl) {
        Job job = getJobById(id);
        transition(job, status);
        if (status == JobStatus.PROCESSING) {
            markStarted(job);
        }
        if (resultUrl != null) {
            job.setResultUrl(resultUrl);
        }
        return saveAndPublish(job);
    }

    /**
     * A worker takes the job. Normally PENDING → PROCESSING. When RabbitMQ redelivers a
     * message because the worker holding it died, the job is already PROCESSING; the new
     * worker may take it over. Finished or cancelled jobs are refused (409), which is what
     * makes at-least-once delivery safe: a job never completes twice.
     */
    public Job claim(String id, boolean redelivered) {
        Job job = getJobById(id);
        boolean takeOver = redelivered && job.getStatus() == JobStatus.PROCESSING;
        if (job.getStatus() != JobStatus.PENDING && !takeOver) {
            throw new InvalidJobStateException("Job can't be started (status " + job.getStatus() + ")");
        }
        job.setStatus(JobStatus.PROCESSING);
        markStarted(job);
        return saveAndPublish(job);
    }

    /** The worker hit a temporary error and will retry: back to PENDING until it does. */
    public Job scheduleRetry(String id, WorkerRetryRequest retry) {
        Job job = getJobById(id);
        if (job.getStatus() != JobStatus.PROCESSING) {
            throw new InvalidJobStateException("Only a running job can be scheduled for retry");
        }
        job.setStatus(JobStatus.PENDING);
        job.setLastError(retry.error());
        job.setNextRetryAt(Instant.now().plusSeconds(retry.delaySeconds()));
        return saveAndPublish(job);
    }

    /**
     * Fail jobs that have been PROCESSING with no update for longer than {@code stuckAfter}
     * — their worker most likely died. Runs from a scheduler, so there's no user context.
     */
    public int failStuckJobs(Duration stuckAfter) {
        List<Job> stuck = jobRepository.findByStatusAndUpdatedAtBefore(JobStatus.PROCESSING, Instant.now().minus(stuckAfter));
        String message = "Error: The worker stopped responding (no progress for " + stuckAfter.toMinutes() + " minutes).";
        for (Job job : stuck) {
            applyFinish(job, new WorkerResultRequest(JobStatus.FAILED, message, null, null, null, null, null, null, null));
            log.warn("Marked stuck job {} ({}) as FAILED", job.getId(), job.getType());
        }
        return stuck.size();
    }

    // Final result from a worker, including AI output and token usage
    public Job finishJob(String id, WorkerResultRequest result) {
        if (result.status() != JobStatus.COMPLETED && result.status() != JobStatus.FAILED) {
            throw new InvalidJobRequestException("A job can only finish as COMPLETED or FAILED");
        }
        return applyFinish(getJobById(id), result);
    }

    private Job applyFinish(Job job, WorkerResultRequest result) {
        transition(job, result.status());
        job.setNextRetryAt(null);
        if (result.resultUrl() != null) job.setResultUrl(result.resultUrl());
        if (result.output() != null) job.setOutput(result.output());
        if (result.model() != null) job.setModel(result.model());
        if (result.inputTokens() != null) job.setInputTokens(result.inputTokens());
        if (result.outputTokens() != null) job.setOutputTokens(result.outputTokens());
        if (result.costUsd() != null) job.setCostUsd(result.costUsd());
        if (result.sources() != null) job.setSources(result.sources());
        if (result.report() != null) job.setReport(result.report());

        // Safety net: if indexing failed before the worker could report it, don't leave the
        // document stuck in PROCESSING forever.
        if (job.getType() == JobType.INGEST_DOCUMENT && result.status() == JobStatus.FAILED) {
            documentRepository.findByIngestJobId(job.getId())
                    .filter(d -> d.getStatus() == DocumentStatus.PROCESSING)
                    .ifPresent(d -> {
                        d.setStatus(DocumentStatus.FAILED);
                        d.setError(result.resultUrl());
                        documentRepository.save(d);
                    });
        }
        return saveAndPublish(job);
    }

    // All jobs — ADMIN only (enforced in the controller with @PreAuthorize)
    public List<Job> getAllJobs() {
        return jobRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    // A user's own jobs only, newest first
    public List<Job> getMyJobs() {
        return jobRepository.findBySubmittedByOrderByCreatedAtDesc(getCurrentUsername());
    }

    // Get by ID — users can only see their own jobs; admins see all
    public Job getJobById(String id) {
        Job job = jobRepository.findById(id)
            .orElseThrow(() -> new JobNotFoundException(id));

        if (!isAdmin() && !getCurrentUsername().equals(job.getSubmittedBy())) {
            throw new AccessDeniedException("You do not have access to this job");
        }
        return job;
    }

    // Cancel a job — only owner or admin, and only if still PENDING
    public Job cancelJob(String id) {
        Job job = getJobById(id);   // ownership check happens inside

        if (job.getStatus() != JobStatus.PENDING) {
            throw new InvalidJobStateException(
                "Only PENDING jobs can be cancelled (current status: " + job.getStatus() + ")");
        }

        return updateJobStatus(id, JobStatus.CANCELLED, null);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private static void transition(Job job, JobStatus status) {
        if (!job.getStatus().canTransitionTo(status)) {
            throw new InvalidJobStateException(
                "Invalid status transition: " + job.getStatus() + " → " + status);
        }
        job.setStatus(status);
        if (status == JobStatus.COMPLETED || status == JobStatus.FAILED) {
            job.setCompletedAt(Instant.now());
        }
    }

    private static void markStarted(Job job) {
        job.setAttempts(job.getAttemptCount() + 1);
        job.setNextRetryAt(null);
    }

    private Job saveAndPublish(Job job) {
        Job updated = jobRepository.save(job);
        jobStatusPublisher.publish(updated);
        return updated;
    }

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("No authenticated user");
        }
        return auth.getName();   // email, from JwtFilter
    }

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
