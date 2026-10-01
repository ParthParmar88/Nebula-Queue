package io.parth.nebulaqueue.exception;

public class JobNotFoundException extends RuntimeException {

    public JobNotFoundException(String id) {
        super("Job not found: " + id);
    }
}
