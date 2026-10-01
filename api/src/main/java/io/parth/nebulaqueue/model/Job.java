package io.parth.nebulaqueue.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "jobs")
@Data
@NoArgsConstructor
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JobType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JobStatus status;

    @Column(columnDefinition = "TEXT")
    private String payload;      // job input data stored as JSON string

    @Column(columnDefinition = "TEXT")
    private String resultUrl;    // where the output file lives after completion

    private String submittedBy;  // email from JWT

    // Instant (UTC) so the JSON always carries a timezone ("...Z") and the browser
    // shows the right local time regardless of the server's timezone.
    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;

    @PrePersist
    public void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) {
            this.status = JobStatus.PENDING;
        }
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
