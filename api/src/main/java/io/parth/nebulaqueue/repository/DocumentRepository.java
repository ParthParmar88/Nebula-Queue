package io.parth.nebulaqueue.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import io.parth.nebulaqueue.model.Document;
import io.parth.nebulaqueue.model.DocumentStatus;

public interface DocumentRepository extends JpaRepository<Document, String> {

    List<Document> findByOwnerOrderByCreatedAtDesc(String owner);

    List<Document> findByOwnerAndStatusOrderByCreatedAtDesc(String owner, DocumentStatus status);

    Optional<Document> findByIngestJobId(String ingestJobId);

    long countByOwner(String owner);
}
