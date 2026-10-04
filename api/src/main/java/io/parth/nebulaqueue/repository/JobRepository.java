package io.parth.nebulaqueue.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.model.JobStatus;
import io.parth.nebulaqueue.model.JobType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface JobRepository extends JpaRepository<Job, String> {

    List<Job> findBySubmittedByOrderByCreatedAtDesc(String submittedBy);

    long countBySubmittedByAndTypeInAndStatusIn(String submittedBy, Collection<JobType> types, Collection<JobStatus> statuses);

    /** Jobs in a status that haven't changed since the cutoff — used to find stuck work. */
    List<Job> findByStatusAndUpdatedAtBefore(JobStatus status, Instant cutoff);

}
