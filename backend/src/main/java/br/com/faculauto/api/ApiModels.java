package br.com.faculauto.api;

import java.util.List;

public final class ApiModels {
    private ApiModels() { }

    public record Health(String status, boolean canvasConfigured, boolean supabaseConfigured, boolean submissionsEnabled) { }
    public record Course(String id, String name, String code) { }
    public record Assignment(String id, String courseId, String name, String dueAt, String url,
                             List<String> submissionTypes, boolean submitted, String completionState,
                             boolean groupAssignment, boolean missing, boolean late,
                             String submittedAt, String gradedAt, boolean resubmissionRequired) { }
    public record Submission(boolean submitted, String submittedAt) { }
}
