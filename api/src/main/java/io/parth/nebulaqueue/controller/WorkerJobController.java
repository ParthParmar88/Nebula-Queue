package io.parth.nebulaqueue.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.model.JobStatus;
import io.parth.nebulaqueue.service.JobService;
import lombok.RequiredArgsConstructor;

/**
 * Status updates from the queue worker. Secured by {@link io.parth.nebulaqueue.config.WorkerInternalTokenFilter}
 * ({@code X-Worker-Token}), not end-user JWT.
 */
@RestController
@RequestMapping("/internal/worker/jobs")
@RequiredArgsConstructor
public class WorkerJobController {

    private final JobService jobService;

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Job> updateStatus(@PathVariable String id,
                                            @RequestParam JobStatus status,
                                            @RequestParam(required = false) String resultUrl) {
        return ResponseEntity.ok(jobService.updateJobStatus(id, status, resultUrl));
    }
}
