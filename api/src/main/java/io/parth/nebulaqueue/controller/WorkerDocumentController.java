package io.parth.nebulaqueue.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.parth.nebulaqueue.dto.WorkerIndexedRequest;
import io.parth.nebulaqueue.model.Document;
import io.parth.nebulaqueue.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Document access for the AI worker (X-Worker-Token, see WorkerInternalTokenFilter):
 * download the uploaded file, then report how indexing went.
 */
@RestController
@RequestMapping("/internal/worker/documents")
@RequiredArgsConstructor
public class WorkerDocumentController {

    private final DocumentService documentService;

    @GetMapping("/{id}/file")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> file(@PathVariable String id) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(documentService.fileFor(id).getData());
    }

    @PostMapping("/{id}/indexed")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Document> indexed(@PathVariable String id, @Valid @RequestBody WorkerIndexedRequest result) {
        return ResponseEntity.ok(documentService.markIndexed(id, result));
    }
}
