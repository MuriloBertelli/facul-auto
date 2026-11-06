package br.com.faculauto.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import br.com.faculauto.auth.OwnerAuthenticator;
import br.com.faculauto.canvas.CanvasService;
import br.com.faculauto.config.AppProperties;
import br.com.faculauto.config.HttpTransport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ApiControllerTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private StubTransport transport;
    private MockMvc mvc;
    private AppProperties properties;
    private static final String DELIVERY = "{\"courseId\":\"10\",\"assignmentId\":\"22\",\"url\":\"https://work.netlify.app/\",\"confirm\":true}";

    @BeforeEach
    void setUp() {
        transport = new StubTransport();
        properties = configured(true);
        configureMvc(properties);
    }

    private AppProperties configured(boolean submissionsEnabled) {
        return new AppProperties("https://project.supabase.co", "test-publishable-key", "owner-user",
                "https://college.instructure.com", "test-canvas-token", submissionsEnabled, "http://localhost:8888");
    }

    private void configureMvc(AppProperties config) {
        mvc = MockMvcBuilders.standaloneSetup(new ApiController(config,
                        new OwnerAuthenticator(config, transport, mapper), new CanvasService(config, transport, mapper), mapper))
                .setControllerAdvice(new ApiErrorHandler()).addFilters(new ApiHeadersFilter()).build();
    }

    private MockHttpServletRequestBuilder authorized(String path) {
        return get(path).header("Authorization", "Bearer test-user-session");
    }

    private MockHttpServletRequestBuilder submit(String body) {
        return post("/api/canvas/submissions").header("Authorization", "Bearer test-user-session")
                .contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private JsonNode body(MvcResult result) throws IOException {
        return mapper.readTree(result.getResponse().getContentAsByteArray());
    }

    @Test
    void healthExposesSafeReadinessOnly() throws Exception {
        MvcResult result = mvc.perform(get("/api/health")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.canvasConfigured").value(true))
                .andExpect(jsonPath("$.supabaseConfigured").value(true))
                .andExpect(jsonPath("$.submissionsEnabled").value(true)).andReturn();
        assertEquals(4, body(result).size());
        assertFalse(result.getResponse().getContentAsString().contains("test-canvas-token"));
        assertTrue(transport.calls.isEmpty());
    }

    @Test
    void healthWorksWithNoIntegrations() throws Exception {
        configureMvc(new AppProperties("", "", "", "", "", false, ""));
        mvc.perform(get("/api/health")).andExpect(status().isOk())
                .andExpect(jsonPath("$.canvasConfigured").value(false))
                .andExpect(jsonPath("$.supabaseConfigured").value(false))
                .andExpect(jsonPath("$.submissionsEnabled").value(false));
    }

    @Test
    void unauthenticatedRequestNeverCallsUpstream() throws Exception {
        mvc.perform(get("/api/canvas/courses")).andExpect(status().isUnauthorized());
        assertTrue(transport.calls.isEmpty());
    }

    @Test
    void expiredSessionCannotAccessCanvas() throws Exception {
        transport.auth = reply(401, "{\"message\":\"expired\"}");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isUnauthorized());
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void differentAuthenticatedUserCannotAccessOwnerCanvas() throws Exception {
        transport.auth = reply(200, "{\"id\":\"other-user\"}");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isForbidden());
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void missingOwnerFailsClosed() throws Exception {
        configureMvc(new AppProperties(properties.supabaseUrl(), properties.supabasePublishableKey(), "",
                properties.canvasBaseUrl(), properties.canvasApiToken(), true, ""));
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isServiceUnavailable());
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void authServiceFailureDoesNotLeakDiagnostics() throws Exception {
        transport.auth = reply(500, "sensitive service diagnostics");
        MvcResult result = mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isServiceUnavailable()).andReturn();
        assertFalse(result.getResponse().getContentAsString().contains("sensitive"));
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void getUserUsesBrowserSessionAndCanvasUsesServerToken() throws Exception {
        transport.responder = call -> reply(200, "[{\"id\":10,\"name\":\"Circuitos\",\"course_code\":\"ELE\"}]");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isOk()).andExpect(jsonPath("$.courses[0].id").value("10"));
        assertEquals("https://project.supabase.co/auth/v1/user", transport.calls.getFirst().uri().toString());
        assertEquals("Bearer test-user-session", transport.calls.getFirst().headers().get("authorization"));
        assertEquals("test-publishable-key", transport.calls.getFirst().headers().get("apikey"));
        assertEquals("Bearer test-canvas-token", transport.calls.get(1).headers().get("authorization"));
    }

    @Test
    void coursesFollowSameOriginPagination() throws Exception {
        AtomicInteger count = new AtomicInteger();
        transport.responder = call -> count.incrementAndGet() == 1
                ? reply(200, "[{\"id\":10,\"name\":\"Circuitos\",\"course_code\":\"ELE\"}]",
                    "<https://college.instructure.com/api/v1/courses?page=2>; rel=\"next\"")
                : reply(200, "[{\"id\":11,\"name\":\"Cálculo\",\"course_code\":\"MAT\"}]");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isOk())
                .andExpect(jsonPath("$.courses.length()").value(2))
                .andExpect(jsonPath("$.courses[1].id").value("11"));
        assertEquals(2, transport.canvasCalls());
    }

    @Test
    void relativeQueryPaginationKeepsTheCurrentResourcePath() throws Exception {
        AtomicInteger count = new AtomicInteger();
        transport.responder = call -> {
            if (count.incrementAndGet() == 1) return reply(200, "[]", "<?page=2>; rel=\"next\"");
            assertEquals("/api/v1/courses", call.uri().getPath());
            assertEquals("page=2", call.uri().getQuery());
            return reply(200, "[]");
        };
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isOk());
        assertEquals(2, count.get());
    }

    @Test
    void paginationCannotLeakTokenToAnotherOrigin() throws Exception {
        transport.responder = call -> reply(200, "[]", "<https://attacker.example/api/v1/courses?page=2>; rel=\"next\"");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isBadGateway());
        assertEquals(1, transport.canvasCalls());
    }

    @Test
    void paginationCannotSwitchResourcePaths() throws Exception {
        transport.responder = call -> reply(200, "[]", "<https://college.instructure.com/api/v1/users?page=2>; rel=\"next\"");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isBadGateway());
        assertEquals(1, transport.canvasCalls());
    }

    @Test
    void paginationRejectsLoops() throws Exception {
        transport.responder = call -> reply(200, "[]", "<" + call.uri() + ">; rel=\"next\"");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isBadGateway());
        assertEquals(1, transport.canvasCalls());
    }

    @Test
    void paginationIsBoundedInsteadOfSilentlyTruncated() throws Exception {
        AtomicInteger count = new AtomicInteger();
        transport.responder = call -> reply(200, "[]", "<https://college.instructure.com/api/v1/courses?page=" + (count.incrementAndGet() + 1) + ">; rel=\"next\"");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isBadGateway());
        assertEquals(20, count.get());
    }

    @Test
    void assignmentsNormalizeIdsAndIndividualSubmissionState() throws Exception {
        transport.responder = call -> {
            assertTrue(call.uri().getQuery().contains("include[]=submission"));
            return reply(200, "[{\"id\":22,\"name\":\"Projeto web\",\"due_at\":null,\"html_url\":\"https://college.instructure.com/courses/10/assignments/22\",\"submission_types\":[\"online_url\"],\"submission\":{\"workflow_state\":\"submitted\"}}]");
        };
        mvc.perform(authorized("/api/canvas/assignments").param("courseId", "10")).andExpect(status().isOk())
                .andExpect(jsonPath("$.assignments[0].id").value("22"))
                .andExpect(jsonPath("$.assignments[0].courseId").value("10"))
                .andExpect(jsonPath("$.assignments[0].submitted").value(true));
    }

    @Test
    void groupDeliveryCompletesTheAssignmentWithoutClaimingWhoSubmittedIt() throws Exception {
        transport.responder = call -> reply(200, """
                [{"id":22,"group_category_id":7,"submission":{"workflow_state":"submitted","submitted_at":"2026-10-01T12:00:00Z","user_id":999}}]
                """);
        mvc.perform(authorized("/api/canvas/assignments").param("courseId", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignments[0].completionState").value("submitted"))
                .andExpect(jsonPath("$.assignments[0].groupAssignment").value(true))
                .andExpect(jsonPath("$.assignments[0].submitted").value(true))
                .andExpect(jsonPath("$.assignments[0].submittedByMe").doesNotExist());
    }

    @Test
    void aGradedMissingAssignmentIsStillPending() throws Exception {
        assertCompletion("{\"workflow_state\":\"graded\",\"score\":0,\"grade\":\"0\",\"missing\":true}", "pending", false);
    }

    @Test
    void gradingWithoutAnOnlineSubmissionIsNotReportedAsADelivery() throws Exception {
        assertCompletion("{\"workflow_state\":\"graded\",\"score\":8,\"missing\":false}", "graded", false);
    }

    @Test
    void excusedAssignmentsAreSeparateFromSubmittedAssignments() throws Exception {
        assertCompletion("{\"workflow_state\":\"unsubmitted\",\"excused\":true}", "excused", false);
    }

    @Test
    void instructorReopeningAnAssignmentOverridesAnEarlierDelivery() throws Exception {
        assertCompletion("{\"workflow_state\":\"submitted\",\"submitted_at\":\"2026-10-01T12:00:00Z\",\"redo_request\":true}", "pending", false);
    }

    @Test
    void pendingReviewIsAlreadyDelivered() throws Exception {
        assertCompletion("{\"workflow_state\":\"pending_review\"}", "submitted", true);
    }

    @Test
    void submissionsByOtherStudentsDoNotCompleteTheCurrentUsersAssignment() throws Exception {
        transport.responder = call -> reply(200, "[{\"id\":22,\"group_category_id\":7,\"has_submitted_submissions\":true,\"submission\":{\"workflow_state\":\"unsubmitted\"}}]");
        mvc.perform(authorized("/api/canvas/assignments").param("courseId", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignments[0].completionState").value("pending"))
                .andExpect(jsonPath("$.assignments[0].groupAssignment").value(true));
    }

    private void assertCompletion(String submission, String state, boolean submitted) throws Exception {
        transport.responder = call -> reply(200, "[{\"id\":22,\"submission\":" + submission + "}]");
        mvc.perform(authorized("/api/canvas/assignments").param("courseId", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignments[0].completionState").value(state))
                .andExpect(jsonPath("$.assignments[0].submitted").value(submitted));
    }

    @Test
    void invalidCourseIdCannotConstructArbitraryApiPath() throws Exception {
        mvc.perform(authorized("/api/canvas/assignments").param("courseId", "../users")).andExpect(status().isBadRequest());
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void runtimeCanvasConfigurationRequiresHttps() throws Exception {
        configureMvc(new AppProperties(properties.supabaseUrl(), properties.supabasePublishableKey(), properties.supabaseOwnerUserId(),
                "http://college.instructure.com", properties.canvasApiToken(), true, ""));
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isServiceUnavailable());
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void networkErrorsNeverLeakCredentials() throws Exception {
        transport.responder = call -> { throw new IOException("Connection failed with test-canvas-token"); };
        MvcResult result = mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isBadGateway()).andReturn();
        assertFalse(result.getResponse().getContentAsString().contains("test-canvas-token"));
    }

    @Test
    void readTimeoutsAreRetryableAndNotUnknownSubmissions() throws Exception {
        transport.responder = call -> { throw new HttpTimeoutException("test timeout"); };
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isGatewayTimeout()).andExpect(jsonPath("$.code").doesNotExist());
    }

    @Test
    void canvasErrorsNeverExposeRawBody() throws Exception {
        transport.responder = call -> reply(403, "sensitive test-canvas-token");
        MvcResult result = mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isBadGateway()).andReturn();
        assertFalse(result.getResponse().getContentAsString().contains("test-canvas-token"));
        assertFalse(result.getResponse().getContentAsString().contains("sensitive"));
    }

    @Test
    void redirectsAreNotTreatedAsSuccessfulCanvasResponses() throws Exception {
        transport.responder = call -> reply(302, "");
        mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isBadGateway());
        assertEquals(1, transport.canvasCalls());
    }

    @Test
    void malformedJsonOrListShapeFailsExplicitly() throws Exception {
        for (String invalid : List.of("not-json", "{\"errors\":[]}", "[null]")) {
            transport.responder = call -> reply(200, invalid);
            mvc.perform(authorized("/api/canvas/courses")).andExpect(status().isBadGateway());
        }
    }

    @Test
    void submissionsAreDisabledByDefault() throws Exception {
        configureMvc(configured(false));
        mvc.perform(submit(DELIVERY)).andExpect(status().isForbidden());
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void submissionRequiresBooleanConfirmation() throws Exception {
        for (String confirm : List.of("false", "\"true\"", "null")) {
            mvc.perform(submit(DELIVERY.replace("\"confirm\":true", "\"confirm\":" + confirm))).andExpect(status().isBadRequest());
        }
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void insecureCredentialAndLocalProjectUrlsAreRejected() throws Exception {
        for (String url : List.of("http://project.example", "javascript:alert(1)", "https://user:password@example.test", "https://localhost/project")) {
            mvc.perform(submit(DELIVERY.replace("https://work.netlify.app/", url))).andExpect(status().isBadRequest());
        }
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void submissionRequiresJsonAndBoundedBody() throws Exception {
        mvc.perform(post("/api/canvas/submissions").header("Authorization", "Bearer session").contentType(MediaType.TEXT_PLAIN).content("hello"))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(submit("{")).andExpect(status().isBadRequest());
        mvc.perform(submit("x".repeat(9_000))).andExpect(status().isPayloadTooLarge());
        assertEquals(0, transport.canvasCalls());
    }

    @Test
    void incompatibleOrLockedAssignmentsCannotBeSubmitted() throws Exception {
        transport.responder = call -> reply(200, "{\"submission_types\":[\"online_upload\"]}");
        mvc.perform(submit(DELIVERY)).andExpect(status().isConflict());
        transport.responder = call -> reply(200, "{\"submission_types\":[\"online_url\"],\"locked_for_user\":true}");
        mvc.perform(submit(DELIVERY)).andExpect(status().isConflict());
        assertTrue(transport.calls.stream().noneMatch(call -> call.method().equals("POST")));
    }

    @Test
    void confirmedSubmissionWritesOnlySelectedUrlAndReturnsReceipt() throws Exception {
        transport.responder = call -> {
            if (call.method().equals("POST")) {
                assertEquals("/api/v1/courses/10/assignments/22/submissions", call.uri().getPath());
                assertEquals(mapper.readTree("{\"submission\":{\"submission_type\":\"online_url\",\"url\":\"https://work.netlify.app/\"}}"), mapper.readTree(call.body()));
                return reply(200, "{\"workflow_state\":\"submitted\",\"submitted_at\":\"2026-11-05T01:00:00Z\"}");
            }
            return reply(200, "{\"submission_types\":[\"online_url\"]}");
        };
        mvc.perform(submit(DELIVERY)).andExpect(status().isOk()).andExpect(jsonPath("$.submitted").value(true))
                .andExpect(jsonPath("$.submittedAt").value("2026-11-05T01:00:00Z"));
        assertEquals(2, transport.canvasCalls());
    }

    @Test
    void acceptedSubmissionWithLostResponseIsUnknownAndMustNotBeRetriedBlindly() throws Exception {
        AtomicInteger accepted = new AtomicInteger();
        transport.responder = call -> {
            if (call.method().equals("POST")) {
                accepted.incrementAndGet();
                throw new HttpTimeoutException("Response lost after commit");
            }
            return reply(200, "{\"submission_types\":[\"online_url\"]}");
        };
        MvcResult result = mvc.perform(submit(DELIVERY)).andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.code").value("SUBMISSION_UNKNOWN")).andReturn();
        assertEquals(1, accepted.get());
        assertTrue(body(result).path("error").asText().contains("Confira o recibo diretamente no Canvas antes de qualquer nova tentativa"));
        assertFalse(body(result).path("error").asText().contains("Tente novamente"));
    }

    @Test
    void malformedAndUnconfirmedPostResponsesHaveUnknownOutcome() throws Exception {
        for (String malformed : List.of("not-json", "null", "[]", "{\"workflow_state\":\"unsubmitted\"}")) {
            transport.responder = call -> reply(200, call.method().equals("POST") ? malformed : "{\"submission_types\":[\"online_url\"]}");
            mvc.perform(submit(DELIVERY)).andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("SUBMISSION_UNKNOWN"));
        }
    }

    @Test
    void postNetworkOrServerFailureCannotPromptBlindRetry() throws Exception {
        transport.responder = call -> {
            if (call.method().equals("POST")) throw new IOException("connection reset");
            return reply(200, "{\"submission_types\":[\"online_url\"]}");
        };
        mvc.perform(submit(DELIVERY)).andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("SUBMISSION_UNKNOWN"));
        transport.responder = call -> reply(call.method().equals("POST") ? 500 : 200,
                call.method().equals("POST") ? "upstream internals" : "{\"submission_types\":[\"online_url\"]}");
        mvc.perform(submit(DELIVERY)).andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("SUBMISSION_UNKNOWN"));
    }

    @Test
    void assignmentLookupTimeoutDoesNotClaimPostWasDispatched() throws Exception {
        transport.responder = call -> { throw new HttpTimeoutException("preflight timeout"); };
        mvc.perform(submit(DELIVERY)).andExpect(status().isGatewayTimeout()).andExpect(jsonPath("$.code").doesNotExist());
        assertTrue(transport.calls.stream().noneMatch(call -> call.method().equals("POST")));
    }

    @Test
    void unsupportedMethodsAndMissingParametersRemainErrors() throws Exception {
        mvc.perform(post("/api/canvas/courses")).andExpect(status().isMethodNotAllowed());
        mvc.perform(authorized("/api/canvas/assignments")).andExpect(status().isBadRequest());
    }

    private static HttpTransport.Reply reply(int status, String body) {
        return new HttpTransport.Reply(status, Map.of(), body.getBytes(StandardCharsets.UTF_8));
    }

    private static HttpTransport.Reply reply(int status, String body, String link) {
        return new HttpTransport.Reply(status, Map.of("Link", List.of(link)), body.getBytes(StandardCharsets.UTF_8));
    }

    @FunctionalInterface
    private interface Responder {
        HttpTransport.Reply reply(Call call) throws IOException, InterruptedException;
    }

    private record Call(URI uri, String method, Map<String, String> headers, byte[] body) { }

    private static final class StubTransport implements HttpTransport {
        final List<Call> calls = new ArrayList<>();
        Reply auth = reply(200, "{\"id\":\"owner-user\"}");
        Responder responder = call -> reply(200, "[]");

        @Override
        public Reply exchange(URI uri, String method, Map<String, String> headers, byte[] body, int maxBodyBytes)
                throws IOException, InterruptedException {
            Call call = new Call(uri, method, Map.copyOf(headers), body);
            calls.add(call);
            assertTrue(maxBodyBytes > 0);
            return uri.getHost().equals("project.supabase.co") ? auth : responder.reply(call);
        }

        long canvasCalls() { return calls.stream().filter(call -> call.uri().getHost().equals("college.instructure.com")).count(); }
    }
}
