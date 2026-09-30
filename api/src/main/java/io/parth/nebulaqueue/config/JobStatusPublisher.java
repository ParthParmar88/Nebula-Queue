package io.parth.nebulaqueue.config;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class JobStatusPublisher {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public void publishStatusUpdate(String jobId, String status) {
        // Send to /topic/jobs — React will listen here
        messagingTemplate.convertAndSend("/topic/jobs", (Object) Map.of(
            "jobId", jobId,
            "status", status
        ));
        System.out.println("📡 Broadcasted: " + jobId + " → " + status);
    }
}