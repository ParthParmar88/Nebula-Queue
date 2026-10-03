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
    void otherJobTypesAreNotValidatedHere() {
        assertThatCode(() -> validator.validate(JobType.BATCH, null)).doesNotThrowAnyException();
    }
}
