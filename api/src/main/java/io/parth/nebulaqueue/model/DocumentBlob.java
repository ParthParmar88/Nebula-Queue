package io.parth.nebulaqueue.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The uploaded file's bytes, kept apart from {@link Document} so listing documents never
 * loads file contents. Postgres keeps this simple for now; an object store (S3/MinIO) can
 * replace it behind the same internal download endpoint.
 */
@Entity
@Table(name = "document_blobs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentBlob {

    @Id
    private String documentId;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] data;
}
