package io.parth.nebulaqueue.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.parth.nebulaqueue.model.DocumentBlob;

public interface DocumentBlobRepository extends JpaRepository<DocumentBlob, String> {
}
