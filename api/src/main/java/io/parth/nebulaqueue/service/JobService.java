package io.parth.nebulaqueue.service;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

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
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class JobService {

    private static final List<JobType> AI_TYPES = Arrays.stream(JobType.values()).filter(JobType::isAi).toList();
    private static final List<JobStatus> ACTIVE_STATUSES = List.of(JobStatus.PENDING, JobStatus.PROCESSING);

    private final JobRepository jobRepository;
    private final JobProducer jobProducer;
    private final JobStatusPublisher jobStatusPublisher;
    private final JobPayloadValidator payloadValidator;

    /** AI jobs cost money per call — cap how many one user can have queued or running at once. */
    @Value("${app.ai.max-active-jobs-per-user:3}")
    private int maxActiveAiJobsPerUser = 3;

    // Submit a job — always a new row, owned by the authenticated user
    public Job submitJob(SubmitJobRequest request) {
        payloadValidator.validate(request.type(), request.payload());
        String currentUser = getCurrentUsername();

        if (request.type().isAi()) {
            long active = jobRepository.countBySubmittedByAndTypeInAndStatusIn(currentUser, AI_TYPES, ACTIVE_STATUSES);
            if (active >= maxActiveAiJobsPerUser) {
                throw new TooManyJobsException("You already have " + active
                        + " AI jobs queued or running. Wait for one to finish before starting another.");
            }
        }

        Job job = new Job();
        job.setType(request.type());
        job.setPayload(request.payload());
        job.setStatus(JobStatus.PENDING);
        job.setSubmittedBy(currentUser);

        Job savedJob = jobRepository.save(job);
        jobProducer.sendJob(savedJob);
        return savedJob;
    }

    // Update status — workers call this; admins can also call it manually
    public Job updateJobStatus(String id, JobStatus status, String resultUrl) {
        Job job = getJobById(id);
        transition(job, status);
        if (resultUrl != null) {
            job.setResultUrl(resultUrl);
        }
        return saveAndPublish(job);
    }

    // Final result from a worker, including AI output and token usage
    public Job finishJob(String id, WorkerResultRequest result) {
        if (result.status() != JobStatus.COMPLETED && result.status() != JobStatus.FAILED) {
            throw new InvalidJobRequestException("A job can only finish as COMPLETED or FAILED");
        }
        Job job = getJobById(id);
        transition(job, result.status());
        if (result.resultUrl() != null) job.setResultUrl(result.resultUrl());
        if (result.output() != null) job.setOutput(result.output());
        if (result.model() != null) job.setModel(result.model());
        if (result.inputTokens() != null) job.setInputTokens(result.inputTokens());
        if (result.outputTokens() != null) job.setOutputTokens(result.outputTokens());
        if (result.costUsd() != null) job.setCostUsd(result.costUsd());
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
