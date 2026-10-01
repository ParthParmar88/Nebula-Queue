package io.parth.nebulaqueue.service;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import io.parth.nebulaqueue.config.JobStatusPublisher;
import io.parth.nebulaqueue.dto.SubmitJobRequest;
import io.parth.nebulaqueue.exception.InvalidJobStateException;
import io.parth.nebulaqueue.exception.JobNotFoundException;
import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.model.JobStatus;
import io.parth.nebulaqueue.producer.JobProducer;
import io.parth.nebulaqueue.repository.JobRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final JobProducer jobProducer;
    private final JobStatusPublisher jobStatusPublisher;

    // Submit a job — always a new row, owned by the authenticated user
    public Job submitJob(SubmitJobRequest request) {
        Job job = new Job();
        job.setType(request.type());
        job.setPayload(request.payload());
        job.setStatus(JobStatus.PENDING);
        job.setSubmittedBy(getCurrentUsername());

        Job savedJob = jobRepository.save(job);
        jobProducer.sendJob(savedJob);
        return savedJob;
    }

    // Update status — workers call this; admins can also call it manually
    public Job updateJobStatus(String id, JobStatus status, String resultUrl) {
        Job job = getJobById(id);

        if (!job.getStatus().canTransitionTo(status)) {
            throw new InvalidJobStateException(
                "Invalid status transition: " + job.getStatus() + " → " + status);
        }

        job.setStatus(status);
        if (resultUrl != null) {
            job.setResultUrl(resultUrl);
        }
        if (status == JobStatus.COMPLETED || status == JobStatus.FAILED) {
            job.setCompletedAt(Instant.now());
        }

        Job updated = jobRepository.save(job);
        jobStatusPublisher.publish(updated);
        return updated;
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
