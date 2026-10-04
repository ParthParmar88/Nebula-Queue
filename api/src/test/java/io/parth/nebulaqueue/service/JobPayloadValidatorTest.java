package io.parth.nebulaqueue.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import io.parth.nebulaqueue.exception.InvalidJobRequestException;
import io.parth.nebulaqueue.model.JobType;

class JobPayloadValidatorTest {

    private final JobPayloadValidator validator = new JobPayloadValidator();

    @Test
    void acceptsAPromptWithOptionalFields() {
        assertThatCode(() -> validator.validate(JobType.AI_GENERATE,
                "{\"prompt\": \"Summarise this\", \"system\": \"Be brief\", \"maxOutputTokens\": 200, \"extra\": true}"))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsMissingOrInvalidPayloads() {
        for (String payload : new String[] { null, "", "not json", "[1, 2]", "{}", "{\"prompt\": \"\"}", "{\"prompt\": null}" }) {
            assertThatThrownBy(() -> validator.validate(JobType.AI_GENERATE, payload))
                    .as("payload %s", payload)
                    .isInstanceOf(InvalidJobRequestException.class);
        }
    }

    @Test
    void rejectsOversizedInput() {
        String longPrompt = "x".repeat(JobPayloadValidator.MAX_PROMPT_CHARS + 1);
        assertThatThrownBy(() -> validator.validate(JobType.AI_GENERATE, "{\"prompt\": \"" + longPrompt + "\"}"))
                .isInstanceOf(InvalidJobRequestException.class);
        assertThatThrownBy(() -> validator.validate(JobType.AI_GENERATE, "{\"prompt\": \"hi\", \"maxOutputTokens\": 999999}"))
                .isInstanceOf(InvalidJobRequestException.class);
    }

    @Test
    void evalNeedsCasesWithQuestionAndExpectedAnswer() {
        for (String payload : new String[] {
                "{}",
                "{\"cases\": []}",
                "{\"cases\": [{\"question\": \"Q\"}]}",
                "{\"cases\": [{\"expected\": \"A\"}]}",
                "{\"topK\": 0, \"cases\": [{\"question\": \"Q\", \"expected\": \"A\"}]}",
                "{\"topK\": 11, \"cases\": [{\"question\": \"Q\", \"expected\": \"A\"}]}",
                "{\"cases\": [{\"question\": \"Q\", \"expected\": \"A\", \"expectedPage\": 0}]}" }) {
            assertThatThrownBy(() -> validator.validate(JobType.EVAL_RUN, payload))
                    .as("payload %s", payload)
                    .isInstanceOf(InvalidJobRequestException.class);
        }
    }

    @Test
    void evalCasesAreCapped() {
        String cases = String.join(",", java.util.Collections.nCopies(
                JobPayloadValidator.MAX_EVAL_CASES + 1, "{\"question\": \"Q\", \"expected\": \"A\"}"));
        assertThatThrownBy(() -> validator.validate(JobType.EVAL_RUN, "{\"cases\": [" + cases + "]}"))
                .isInstanceOf(InvalidJobRequestException.class);
    }

    @Test
    void acceptsAValidEval() {
        assertThatCode(() -> validator.validate(JobType.EVAL_RUN,
                "{\"name\": \"Baseline\", \"topK\": 3, \"cases\": [{\"question\": \"Q\", \"expected\": \"A\", \"expectedPage\": 1}]}"))
                .doesNotThrowAnyException();
    }

    @Test
    void otherJobTypesAreNotValidatedHere() {
        assertThatCode(() -> validator.validate(JobType.BATCH, null)).doesNotThrowAnyException();
    }
}
