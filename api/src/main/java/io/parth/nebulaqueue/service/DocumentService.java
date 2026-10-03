package io.parth.nebulaqueue.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import io.parth.nebulaqueue.dto.WorkerIndexedRequest;
import io.parth.nebulaqueue.exception.DocumentNotFoundException;
import io.parth.nebulaqueue.exception.DocumentStateException;
import io.parth.nebulaqueue.exception.InvalidDocumentException;
import io.parth.nebulaqueue.exception.UsageLimitException;
import io.parth.nebulaqueue.model.Document;
import io.parth.nebulaqueue.model.DocumentBlob;
import io.parth.nebulaqueue.model.DocumentStatus;
import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.repository.DocumentBlobRepository;
import io.parth.nebulaqueue.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    public static final long MAX_BYTES = 10L * 1024 * 1024;
    public static final int MAX_DOCUMENTS_PER_USER = 20;

    /** Extension → content type we store. Checked by extension and, for PDFs, by file signature. */
    private static final Map<String, String> ALLOWED = Map.of(
            "pdf", "application/pdf",
            "txt", "text/plain",
            "md", "text/markdown");

    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    private final DocumentRepository documents;
    private final DocumentBlobRepository blobs;
    private final JobService jobService;
    private final JdbcTemplate jdbc;

    /**
     * Store the file and queue its ingest job. Deliberately not one transaction: the blob
     * must be committed before the job is published, or the worker could ask for the file
     * before it exists.
     */
    public Document upload(MultipartFile file) {
        String owner = currentUser();
        if (documents.countByOwner(owner) >= MAX_DOCUMENTS_PER_USER) {
            throw new UsageLimitException("You can keep up to " + MAX_DOCUMENTS_PER_USER
                    + " documents. Delete one to upload another.");
        }

        String filename = cleanFilename(file.getOriginalFilename());
        String contentType = contentTypeFor(filename);
        byte[] bytes = readAndCheck(file, contentType);

        Document document = new Document();
        document.setOwner(owner);
        document.setFilename(filename);
        document.setContentType(contentType);
        document.setSizeBytes(bytes.length);
        document.setStatus(DocumentStatus.PROCESSING);
        document = documents.save(document);
        blobs.save(new DocumentBlob(document.getId(), bytes));

        Job ingest = jobService.queueIngest(document);
        document.setIngestJobId(ingest.getId());
        log.info("Document {} uploaded by {} ({} bytes); ingest job {}", document.getId(), owner, bytes.length, ingest.getId());
        return documents.save(document);
    }

    public List<Document> listMine() {
        return documents.findByOwnerOrderByCreatedAtDesc(currentUser());
    }

    public Document get(String id) {
        Document document = documents.findById(id).orElseThrow(() -> new DocumentNotFoundException(id));
        if (!isAdmin() && !currentUser().equals(document.getOwner())) {
            throw new AccessDeniedException("You do not have access to this document");
        }
        return document;
    }

    public void delete(String id) {
        Document document = get(id);
        if (document.getStatus() == DocumentStatus.PROCESSING) {
            // The worker is writing its chunks right now; deleting would leave orphans behind
            throw new DocumentStateException("This document is still being indexed. Try again when it's done.");
        }
        try {
            // The AI worker owns this table; it may not exist yet if no document was ever indexed
            jdbc.update("DELETE FROM document_chunks WHERE document_id = ?", id);
        } catch (DataAccessException e) {
            log.debug("No chunks deleted for {}: {}", id, e.getMessage());
        }
        blobs.deleteById(id);
        documents.delete(document);
    }

    // ── worker side ────────────────────────────────────────────────────────

    public DocumentBlob fileFor(String id) {
        return blobs.findById(id).orElseThrow(() -> new DocumentNotFoundException(id));
    }

    public Document markIndexed(String id, WorkerIndexedRequest result) {
        Document document = documents.findById(id).orElseThrow(() -> new DocumentNotFoundException(id));
        if (result.status() == DocumentStatus.PROCESSING) {
            throw new DocumentStateException("Indexing must end as READY or FAILED");
        }
        document.setStatus(result.status());
        document.setPageCount(result.pageCount());
        document.setChunkCount(result.chunkCount());
        document.setError(result.status() == DocumentStatus.FAILED ? result.error() : null);
        return documents.save(document);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private static String cleanFilename(String original) {
        if (original == null || original.isBlank()) {
            throw new InvalidDocumentException("The file has no name.");
        }
        // Keep only the last path segment and drop control characters
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").trim();
        if (name.isEmpty()) {
            throw new InvalidDocumentException("The file has no name.");
        }
        return name.length() > 200 ? name.substring(name.length() - 200) : name;
    }

    private static String contentTypeFor(String filename) {
        int dot = filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        String type = ALLOWED.get(extension);
        if (type == null) {
            throw new InvalidDocumentException("Only PDF, .txt and .md files are supported.");
        }
        return type;
    }

    private static byte[] readAndCheck(MultipartFile file, String contentType) {
        if (file.isEmpty()) {
            throw new InvalidDocumentException("The file is empty.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new InvalidDocumentException("File is too large (max 10 MB).");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new InvalidDocumentException("The file couldn't be read.");
        }
        if ("application/pdf".equals(contentType)
                && (bytes.length < PDF_MAGIC.length || !Arrays.equals(Arrays.copyOf(bytes, PDF_MAGIC.length), PDF_MAGIC))) {
            throw new InvalidDocumentException("This doesn't look like a valid PDF.");
        }
        return bytes;
    }

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("No authenticated user");
        }
        return auth.getName();
    }

    private static boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
