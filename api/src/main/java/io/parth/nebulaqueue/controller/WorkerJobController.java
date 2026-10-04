package io.parth.nebulaqueue.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.parth.nebulaqueue.dto.WorkerResultRequest;
import io.parth.nebulaqueue.dto.WorkerRetryRequest;
import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.model.JobStatus;
import io.parth.nebulaqueue.service.JobService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Status updates from the queue workers. Secured by {@link io.parth.nebulaqueue.config.WorkerInternalTokenFilter}
 * ({@code X-Worker-Token}), not end-user JWT.
 */
@RestController
@RequestMapping("/internal/worker/jobs")
@RequiredArgsConstructor
public class WorkerJobController {

    private final JobService jobService;

    /** Simple transitions (e.g. PROCESSING) and short results. Answers 409 if the job was cancelled. */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Job> updateStatus(@PathVariable String id,
                                            @RequestParam JobStatus status,
                                            @RequestParam(required = false) String resultUrl) {
        return ResponseEntity.ok(jobService.updateJobStatus(id, status, resultUrl));
    }

    /** Final state with a JSON body — generated output and token usage for AI jobs. */
    @PostMapping("/{id}/finish")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Job> finish(@PathVariable String id, @Valid @RequestBody WorkerResultRequest result) {
        return ResponseEntity.ok(jobService.finishJob(id, result));
    }

    /**
     * Take the job (→ PROCESSING). {@code redelivered=true} lets a worker take over a job
     * whose previous worker died mid-run. 409 if the job is finished or cancelled.
     */
    @PostMapping("/{id}/claim")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Job> claim(@PathVariable String id, @RequestParam(defaultValue = "false") boolean redelivered) {
        return ResponseEntity.ok(jobService.claim(id, redelivered));
    }

    /** Temporary failure: the job goes back to PENDING until the worker retries it. */
    @PostMapping("/{id}/retry-scheduled")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Job> retryScheduled(@PathVariable String id, @Valid @RequestBody WorkerRetryRequest retry) {
        return ResponseEntity.ok(jobService.scheduleRetry(id, retry));
    }
}
