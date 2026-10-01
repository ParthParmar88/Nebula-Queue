package io.parth.nebulaqueue.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import io.parth.nebulaqueue.model.Job;
import java.util.List;

public interface JobRepository extends JpaRepository<Job, String> {

    List<Job> findBySubmittedByOrderByCreatedAtDesc(String submittedBy);

}
