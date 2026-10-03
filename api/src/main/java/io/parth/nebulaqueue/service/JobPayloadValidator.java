package io.parth.nebulaqueue.service;

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

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GeneratePayload(String prompt, String system, Integer maxOutputTokens) {
    }

    public void validate(JobType type, String payload) {
        if (type == JobType.AI_GENERATE) {
            validateGenerate(payload);
        }
    }

    private static void validateGenerate(String payload) {
        if (payload == null || payload.isBlank()) {
            throw new InvalidJobRequestException("AI_GENERATE needs a payload like {\"prompt\": \"…\"}");
        }
        GeneratePayload p;
        try {
            p = JSON.readValue(payload, GeneratePayload.class);
        } catch (JacksonException e) {
            throw new InvalidJobRequestException("AI_GENERATE payload must be a JSON object with a \"prompt\" string");
        }
        if (p == null || p.prompt() == null || p.prompt().isBlank()) {
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
}
