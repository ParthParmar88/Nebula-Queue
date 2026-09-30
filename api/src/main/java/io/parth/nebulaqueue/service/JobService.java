package io.parth.nebulaqueue.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import io.parth.nebulaqueue.config.JobStatusPublisher;
import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.producer.JobProducer;
import io.parth.nebulaqueue.repository.JobRepository;

@Service
public class JobService {

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JobProducer jobProducer;

    @Autowired
    private JobStatusPublisher jobStatusPublisher;

    // Submit a job — tied to the authenticated user
    public Job submitJob(Job job) {
        String currentUser = getCurrentUsername();

        job.setStatus("PENDING");
        job.setCreatedAt(LocalDateTime.now());
        job.setSubmittedBy(currentUser);       // track who submitted

        Job savedJob = jobRepository.save(job);
        jobProducer.sendJob(savedJob);
        return savedJob;
    }

    // Update status — workers call this; admins can also call it manually
    public Job updateJobStatus(String id, String status, String resultUrl) {
        Job job = getJobById(id);

        validateStatusTransition(job.getStatus(), status);

        job.setStatus(status);
        job.setUpdatedAt(LocalDateTime.now());

        if (resultUrl != null) {
            job.setResultUrl(resultUrl);
        }
        if ("COMPLETED".equals(status) || "FAILED".equals(status)) {
            job.setCompletedAt(LocalDateTime.now());
        }

        Job updated = jobRepository.save(job);
        jobStatusPublisher.publishStatusUpdate(id, status);
        return updated;
    }

    // All jobs — ADMIN only (enforce this in the controller with @PreAuthorize)
    public List<Job> getAllJobs() {
        return jobRepository.findAll();
    }

    // A user's own jobs only
    public List<Job> getMyJobs() {
        return jobRepository.findBySubmittedBy(getCurrentUsername());
    }

    // Get by ID — users can only see their own jobs; admins see all
    public Job getJobById(String id) {
        Job job = jobRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Job not found: " + id));

        if (!isAdmin() && !job.getSubmittedBy().equals(getCurrentUsername())) {
            throw new AccessDeniedException("You do not have access to this job");
        }
        return job;
    }

    // Cancel a job — only owner or admin, and only if still PENDING
    public Job cancelJob(String id) {
        Job job = getJobById(id);   // ownership check happens inside

        if (!"PENDING".equals(job.getStatus())) {
            throw new IllegalStateException(
                "Cannot cancel job in status: " + job.getStatus());
        }

        return updateJobStatus(id, "CANCELLED", null);
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

    private void validateStatusTransition(String current, String next) {
        // legal transitions: PENDING → PROCESSING → COMPLETED | FAILED
        //                    PENDING → CANCELLED
        boolean valid = switch (current) {
            case "PENDING"    -> List.of("PROCESSING", "CANCELLED").contains(next);
            case "PROCESSING" -> List.of("COMPLETED", "FAILED").contains(next);
            default           -> false;
        };
        if (!valid) {
            throw new IllegalStateException(
                "Invalid status transition: " + current + " → " + next);
        }
    }
}