package io.parth.nebulaqueue.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import io.parth.nebulaqueue.exception.DocumentStateException;
import io.parth.nebulaqueue.exception.InvalidDocumentException;
import io.parth.nebulaqueue.exception.UsageLimitException;
import io.parth.nebulaqueue.model.Document;
import io.parth.nebulaqueue.model.DocumentBlob;
import io.parth.nebulaqueue.model.DocumentStatus;
import io.parth.nebulaqueue.model.Job;
import io.parth.nebulaqueue.repository.DocumentBlobRepository;
import io.parth.nebulaqueue.repository.DocumentRepository;

class DocumentServiceTest {

    private DocumentRepository documents;
    private DocumentBlobRepository blobs;
    private JobService jobService;
    private DocumentService service;

    @BeforeEach
    void setUp() {
        documents = mock(DocumentRepository.class);
        blobs = mock(DocumentBlobRepository.class);
        jobService = mock(JobService.class);
        service = new DocumentService(documents, blobs, jobService, mock(JdbcTemplate.class));
        when(documents.save(any(Document.class))).thenAnswer(inv -> {
            Document d = inv.getArgument(0);
            if (d.getId() == null) d.setId("d1");
            return d;
        });
        Job ingest = new Job();
        ingest.setId("job-1");
        when(jobService.queueIngest(any())).thenReturn(ingest);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "alice@example.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void uploadStoresTheFileBeforeQueueingIngest() {
        Document doc = service.upload(file("notes.md", "# Hello"));

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.PROCESSING);
        assertThat(doc.getOwner()).isEqualTo("alice@example.com");
        assertThat(doc.getContentType()).isEqualTo("text/markdown");
        assertThat(doc.getIngestJobId()).isEqualTo("job-1");
        verify(blobs).save(any(DocumentBlob.class));
        verify(jobService).queueIngest(doc);
    }

    @Test
    void rejectsUnsupportedTypesAndFakePdfs() {
        assertThatThrownBy(() -> service.upload(file("virus.exe", "MZ")))
                .isInstanceOf(InvalidDocumentException.class);
        assertThatThrownBy(() -> service.upload(file("report.pdf", "not really a pdf")))
                .isInstanceOf(InvalidDocumentException.class)
                .hasMessageContaining("valid PDF");
        verify(jobService, never()).queueIngest(any());
    }

    @Test
    void acceptsARealPdfSignature() {
        Document doc = service.upload(file("report.pdf", "%PDF-1.7\n..."));
        assertThat(doc.getContentType()).isEqualTo("application/pdf");
    }

    @Test
    void stripsPathsFromFilenames() {
        Document doc = service.upload(file("C:\\Users\\me\\secret\\plan.txt", "hi"));
        assertThat(doc.getFilename()).isEqualTo("plan.txt");
    }

    @Test
    void capsDocumentsPerUser() {
        when(documents.countByOwner("alice@example.com")).thenReturn((long) DocumentService.MAX_DOCUMENTS_PER_USER);

        assertThatThrownBy(() -> service.upload(file("a.txt", "x"))).isInstanceOf(UsageLimitException.class);
    }

    @Test
    void cannotDeleteWhileIndexing() {
        Document doc = new Document();
        doc.setId("d1");
        doc.setOwner("alice@example.com");
        doc.setStatus(DocumentStatus.PROCESSING);
        when(documents.findById("d1")).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> service.delete("d1")).isInstanceOf(DocumentStateException.class);
    }

    private static MockMultipartFile file(String name, String content) {
        return new MockMultipartFile("file", name, "application/octet-stream", content.getBytes(StandardCharsets.UTF_8));
    }
}
