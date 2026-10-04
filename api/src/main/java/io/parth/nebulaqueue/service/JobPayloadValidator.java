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
    public static final int MAX_EVAL_CASES = 20;
    public static final int MAX_EXPECTED_CHARS = 2_000;
    public static final int MAX_EVAL_NAME_CHARS = 100;
    public static final int MAX_TOP_K = 10;
    public static final int DEFAULT_TOP_K = 5;

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GeneratePayload(String prompt, String system, Integer maxOutputTokens) {
    }

    /** What a user sends for AI_ASK. No documentIds means "search all my ready documents". */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AskPayload(String question, List<String> documentIds) {
    }

    /** What a user sends for EVAL_RUN. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EvalPayload(String name, List<String> documentIds, Integer topK, List<EvalCaseInput> cases) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EvalCaseInput(String question, String expected, String expectedDocumentId, Integer expectedPage) {
    }

    public void validate(JobType type, String payload) {
        switch (type) {
            case AI_GENERATE -> validateGenerate(payload);
            case AI_ASK -> parseAsk(payload);
            case EVAL_RUN -> parseEval(payload);
            default -> { }
        }
    }

    public EvalPayload parseEval(String payload) {
        EvalPayload p = read(payload, EvalPayload.class,
                "EVAL_RUN payload must be a JSON object like {\"cases\": [{\"question\": \"…\", \"expected\": \"…\"}]}");
        if (p.name() != null && p.name().length() > MAX_EVAL_NAME_CHARS) {
            throw new InvalidJobRequestException("Name is too long (max " + MAX_EVAL_NAME_CHARS + " characters)");
        }
        if (p.topK() != null && (p.topK() < 1 || p.topK() > MAX_TOP_K)) {
            throw new InvalidJobRequestException("topK must be between 1 and " + MAX_TOP_K);
        }
        if (p.documentIds() != null && p.documentIds().size() > MAX_ASK_DOCUMENTS) {
            throw new InvalidJobRequestException("Evaluate at most " + MAX_ASK_DOCUMENTS + " documents at once");
        }
        if (p.cases() == null || p.cases().isEmpty()) {
            throw new InvalidJobRequestException("Add at least one test case");
        }
        if (p.cases().size() > MAX_EVAL_CASES) {
            throw new InvalidJobRequestException("An evaluation can have at most " + MAX_EVAL_CASES + " cases");
        }
        for (int i = 0; i < p.cases().size(); i++) {
            EvalCaseInput c = p.cases().get(i);
            String label = "Case " + (i + 1) + ": ";
            if (c == null || c.question() == null || c.question().isBlank()) {
                throw new InvalidJobRequestException(label + "add a question");
            }
            if (c.expected() == null || c.expected().isBlank()) {
                throw new InvalidJobRequestException(label + "add the expected answer");
            }
            if (c.question().length() > MAX_QUESTION_CHARS || c.expected().length() > MAX_EXPECTED_CHARS) {
                throw new InvalidJobRequestException(label + "keep the question and expected answer under 2,000 characters");
            }
            if (c.expectedPage() != null && c.expectedPage() < 1) {
                throw new InvalidJobRequestException(label + "the expected page must be 1 or higher");
            }
        }
        return p;
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
