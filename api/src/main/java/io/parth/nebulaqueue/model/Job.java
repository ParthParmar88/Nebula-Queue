package io.parth.nebulaqueue.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "jobs")
@Data
@NoArgsConstructor
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    @NotBlank
    private String type;         // "IMAGE_RESIZE", "PDF_GENERATE", "EMAIL_SEND"

    @Column(nullable = false)
    private String status;       // "PENDING", "PROCESSING", "COMPLETED", "FAILED"

    @Column(columnDefinition = "TEXT")
    private String payload;      // job input data stored as JSON string

    @Column(columnDefinition = "TEXT")
    private String resultUrl;    // where the output file lives after completion

    private String createdBy;    // which user submitted this job

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private String submittedBy;       // email from JWT
    private LocalDateTime completedAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.status = "PENDING";
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public String getSubmittedBy() {
        return submittedBy;
    }
    
    public void setSubmittedBy(String submittedBy) {
        this.submittedBy = submittedBy;
    }
    
    public LocalDateTime getCompletedAt() {
        return completedAt;
    }
    
    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}