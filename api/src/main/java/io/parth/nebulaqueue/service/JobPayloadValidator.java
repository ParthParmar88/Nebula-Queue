package io.parth.nebulaqueue.service;

import java.util.List;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import io.parth.nebulaqueue.exception.InvalidJobRequestException;
import io.parth.nebulaqueue.model.JobType;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Checks a job's payload before it is queued, so bad input fails fast with a 400 instead
 * of burning a worker slot (and, for AI jobs, an API call) only to fail later.
 */
@Component
public class JobPayloadValidator {

    public static final int MAX_PROMPT_CHARS = 8_000;
    public static final int MAX_SYSTEM_CHARS = 4_000;
    public static final int MAX_OUTPUT_TOKENS = 4_000;
    public static final int MAX_QUESTION_CHARS = 2_000;
    public static final int MAX_ASK_DOCUMENTS = 20;

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GeneratePayload(String prompt, String system, Integer maxOutputTokens) {
    }

    /** What a user sends for AI_ASK. No documentIds means "search all my ready documents". */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AskPayload(String question, List<String> documentIds) {
    }

    public void validate(JobType type, String payload) {
        switch (type) {
            case AI_GENERATE -> validateGenerate(payload);
            case AI_ASK -> parseAsk(payload);
            default -> { }
        }
    }

    public AskPayload parseAsk(String payload) {
        AskPayload p = read(payload, AskPayload.class, "AI_ASK payload must be a JSON object like {\"question\": \"…\"}");
        if (p.question() == null || p.question().isBlank()) {
            throw new InvalidJobRequestException("AI_ASK payload needs a non-empty \"question\"");
        }
        if (p.question().length() > MAX_QUESTION_CHARS) {
            throw new InvalidJobRequestException("Question is too long (max " + MAX_QUESTION_CHARS + " characters)");
        }
        if (p.documentIds() != null && p.documentIds().size() > MAX_ASK_DOCUMENTS) {
            throw new InvalidJobRequestException("Ask about at most " + MAX_ASK_DOCUMENTS + " documents at once");
        }
        return p;
    }

    public String toJson(Object value) {
        return JSON.writeValueAsString(value);
    }

    private static void validateGenerate(String payload) {
        GeneratePayload p = read(payload, GeneratePayload.class,
                "AI_GENERATE payload must be a JSON object with a \"prompt\" string");
        if (p.prompt() == null || p.prompt().isBlank()) {
            throw new InvalidJobRequestException("AI_GENERATE payload needs a non-empty \"prompt\"");
        }
        if (p.prompt().length() > MAX_PROMPT_CHARS) {
            throw new InvalidJobRequestException("Prompt is too long (max " + MAX_PROMPT_CHARS + " characters)");
        }
        if (p.system() != null && p.system().length() > MAX_SYSTEM_CHARS) {
            throw new InvalidJobRequestException("System instructions are too long (max " + MAX_SYSTEM_CHARS + " characters)");
        }
        if (p.maxOutputTokens() != null && (p.maxOutputTokens() < 1 || p.maxOutputTokens() > MAX_OUTPUT_TOKENS)) {
            throw new InvalidJobRequestException("maxOutputTokens must be between 1 and " + MAX_OUTPUT_TOKENS);
        }
    }

    private static <T> T read(String payload, Class<T> type, String message) {
        if (payload == null || payload.isBlank()) {
            throw new InvalidJobRequestException(message);
        }
        try {
            T value = JSON.readValue(payload, type);
            if (value == null) {
                throw new InvalidJobRequestException(message);
            }
            return value;
        } catch (JacksonException e) {
            throw new InvalidJobRequestException(message);
        }
    }
}
