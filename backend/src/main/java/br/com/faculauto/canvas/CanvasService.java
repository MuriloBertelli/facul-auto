package br.com.faculauto.canvas;

import br.com.faculauto.api.ApiException;
import br.com.faculauto.api.ApiModels.Assignment;
import br.com.faculauto.api.ApiModels.Course;
import br.com.faculauto.api.ApiModels.Submission;
import br.com.faculauto.config.AppProperties;
import br.com.faculauto.config.HttpTransport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public final class CanvasService {
    private static final int MAX_PAGES = 20;
    private static final int MAX_RESPONSE_BYTES = 2_097_152;
    private static final Pattern LINK = Pattern.compile("^\\s*<([^>]+)>\\s*;(.*)$");
    private static final Pattern NEXT = Pattern.compile("\\brel\\s*=\\s*(?:\"[^\"]*\\bnext\\b[^\"]*\"|next)(?:\\s*;|\\s*$)", Pattern.CASE_INSENSITIVE);
    private static final Set<String> SUBMITTED_STATES = Set.of("submitted", "graded", "pending_review");
    private final AppProperties properties;
    private final HttpTransport transport;
    private final ObjectMapper mapper;

    public CanvasService(AppProperties properties, HttpTransport transport, ObjectMapper mapper) {
        this.properties = properties;
        this.transport = transport;
        this.mapper = mapper;
    }

    public List<Course> courses() {
        List<Course> courses = new ArrayList<>();
        for (JsonNode course : list("/api/v1/courses?enrollment_state=active&per_page=100")) {
            courses.add(new Course(remoteId(course.path("id")), text(course.path("name"), "Curso sem nome"), text(course.path("course_code"), "")));
        }
        return courses;
    }

    public List<Assignment> assignments(String courseId) {
        resourceId(courseId);
        List<Assignment> assignments = new ArrayList<>();
        for (JsonNode assignment : list("/api/v1/courses/" + courseId + "/assignments?per_page=100&include[]=submission")) {
            String htmlUrl = text(assignment.path("html_url"), null);
            JsonNode submission = assignment.path("submission");
            String submittedAt = timestamp(submission.path("submitted_at"));
            String gradedAt = timestamp(submission.path("graded_at"));
            String workflow = text(submission.path("workflow_state"), "");
            boolean redo = submission.path("redo_request").asBoolean(false);
            boolean missing = submission.path("missing").asBoolean(false);
            boolean hasSubmission = submittedAt != null || Set.of("submitted", "pending_review").contains(workflow);
            String completion = submission.path("excused").asBoolean(false) ? "excused"
                    : redo ? "pending"
                    : hasSubmission ? "submitted"
                    : "graded".equals(workflow) && !missing && (gradedAt != null
                        || submission.path("score").isNumber() || submission.path("grade").isTextual()) ? "graded"
                    : "pending";
            boolean group = assignment.path("group_category_id").asLong(0) > 0
                    || submission.path("group_id").asLong(0) > 0;
            assignments.add(new Assignment(remoteId(assignment.path("id")), courseId,
                    text(assignment.path("name"), "Trabalho sem nome"), text(assignment.path("due_at"), null),
                    htmlUrl != null && htmlUrl.startsWith("https://") ? htmlUrl : null,
                    submissionTypes(assignment), "submitted".equals(completion), completion, group, missing,
                    submission.path("late").asBoolean(false), submittedAt, gradedAt, redo));
        }
        return assignments;
    }

    public Submission submit(JsonNode body) {
        if (!properties.canvasSubmissionsEnabled()) throw new ApiException(403, "As entregas pelo aplicativo estão desativadas.");
        if (body == null || !body.isObject()) throw new ApiException(400, "Os dados enviados não são um objeto JSON válido.");
        if (!body.path("confirm").isBoolean() || !body.path("confirm").booleanValue())
            throw new ApiException(400, "Confirme a entrega antes de enviar o trabalho.");
        String courseId = resourceId(text(body.path("courseId"), null));
        String assignmentId = resourceId(text(body.path("assignmentId"), null));
        String projectUrl = publicHttpsUrl(text(body.path("url"), null));
        URI assignmentUri = base().resolve("/api/v1/courses/" + courseId + "/assignments/" + assignmentId);
        JsonNode details = readJson(request(assignmentUri, "GET", new byte[0]));
        if (!details.isObject()) throw new ApiException(502, "O Canvas retornou um trabalho inválido.");
        if (!submissionTypes(details).contains("online_url"))
            throw new ApiException(409, "Este trabalho não aceita entrega por URL. Faça a entrega diretamente no Canvas.");
        if (details.path("locked_for_user").asBoolean(false)) throw new ApiException(409, "Este trabalho está bloqueado para entrega no Canvas.");

        // After dispatch, transport failure cannot prove that Canvas did not accept the submission.
        try {
            byte[] payload = mapper.writeValueAsBytes(Map.of("submission", Map.of("submission_type", "online_url", "url", projectUrl)));
            JsonNode receipt = readJson(request(URI.create(assignmentUri + "/submissions"), "POST", payload));
            if (!receipt.isObject()) throw ApiException.submissionUnknown(502);
            String submittedAt = timestamp(receipt.path("submitted_at"));
            if (submittedAt == null && !SUBMITTED_STATES.contains(text(receipt.path("workflow_state"), "")))
                throw ApiException.submissionUnknown(502);
            return new Submission(true, submittedAt);
        } catch (ApiException exception) {
            throw ApiException.submissionUnknown(exception.status());
        } catch (IOException | RuntimeException exception) {
            throw ApiException.submissionUnknown(502);
        }
    }

    private URI base() {
        URI base = properties.canvasBase();
        if (base == null || !AppProperties.present(properties.canvasApiToken()))
            throw new ApiException(503, "Configure a URL HTTPS e o token do Canvas no servidor.");
        return base;
    }

    private HttpTransport.Reply request(URI uri, String method, byte[] body) {
        URI base = base();
        if (!validCanvasUri(uri, base)) throw new ApiException(502, "O Canvas retornou um endereço de paginação inválido.");
        Map<String, String> headers = new HashMap<>();
        headers.put("accept", "application/json");
        headers.put("authorization", "Bearer " + properties.canvasApiToken());
        if (body.length != 0) headers.put("content-type", "application/json");
        HttpTransport.Reply reply;
        try {
            reply = transport.exchange(uri, method, headers, body, MAX_RESPONSE_BYTES);
        } catch (HttpTimeoutException exception) {
            throw new ApiException(504, "O Canvas demorou para responder. Tente novamente.");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ApiException(502, "Não foi possível conectar ao Canvas.");
        } catch (IOException | IllegalArgumentException exception) {
            throw new ApiException(502, "Não foi possível conectar ao Canvas.");
        }
        if (!reply.successful()) {
            if (reply.status() == 429) throw new ApiException(503, "O Canvas limitou as consultas. Aguarde antes de tentar novamente.");
            if (reply.status() == 404) throw new ApiException(404, "Curso ou trabalho não encontrado no Canvas.");
            if (reply.status() == 401 || reply.status() == 403)
                throw new ApiException(502, "O Canvas recusou o acesso. Verifique o token e as permissões.");
            throw new ApiException(502, "O Canvas não conseguiu concluir a operação.");
        }
        return reply;
    }

    private JsonNode readJson(HttpTransport.Reply reply) {
        try {
            JsonNode body = mapper.readTree(reply.body());
            if (body == null) throw new IOException("Missing JSON body");
            return body;
        } catch (IOException exception) {
            throw new ApiException(502, "O Canvas retornou uma resposta inválida.");
        }
    }

    private List<JsonNode> list(String path) {
        URI base = base();
        URI next = base.resolve(path);
        Set<URI> visited = new HashSet<>();
        List<JsonNode> items = new ArrayList<>();
        for (int page = 0; next != null && page < MAX_PAGES; page++) {
            if (!visited.add(next)) throw new ApiException(502, "O Canvas retornou uma paginação repetida.");
            URI current = next;
            HttpTransport.Reply reply = request(current, "GET", new byte[0]);
            JsonNode body = readJson(reply);
            if (!body.isArray() || body.size() > 1_000) throw new ApiException(502, "O Canvas retornou uma lista inválida.");
            for (JsonNode item : body) {
                if (!item.isObject()) throw new ApiException(502, "O Canvas retornou uma lista inválida.");
                items.add(item);
            }
            next = nextPage(reply.header("link"), current, base);
        }
        if (next != null) throw new ApiException(502, "A consulta excedeu o limite de páginas. Abra o Canvas para consultar todos os itens.");
        return items;
    }

    private URI nextPage(String links, URI current, URI base) {
        if (links == null) return null;
        for (String link : links.split(",(?=\\s*<)")) {
            Matcher match = LINK.matcher(link);
            if (!match.matches() || !NEXT.matcher(match.group(2)).find()) continue;
            URI next;
            try {
                String value = match.group(1);
                next = value.startsWith("?") ? URI.create(current.toString().split("\\?", 2)[0] + value) : current.resolve(value);
            } catch (IllegalArgumentException exception) {
                throw new ApiException(502, "O Canvas retornou um endereço de paginação inválido.");
            }
            if (!validCanvasUri(next, base) || !next.getRawPath().equals(current.getRawPath()))
                throw new ApiException(502, "O Canvas retornou um endereço de paginação inválido.");
            return next;
        }
        return null;
    }

    private boolean validCanvasUri(URI uri, URI base) {
        return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null &&
                uri.getHost().equalsIgnoreCase(base.getHost()) && effectivePort(uri) == effectivePort(base) &&
                uri.getUserInfo() == null && uri.getRawFragment() == null && uri.getRawPath().startsWith("/api/v1/") &&
                uri.normalize().equals(uri);
    }

    private static int effectivePort(URI uri) { return uri.getPort() == -1 ? 443 : uri.getPort(); }

    private static String resourceId(String value) {
        if (value == null || !value.matches("[0-9]{1,20}")) throw new ApiException(400, "Informe um identificador válido do Canvas.");
        return value;
    }

    private static String remoteId(JsonNode value) {
        if (!(value.isTextual() || value.isIntegralNumber()) || !value.asText().matches("[0-9]{1,20}"))
            throw new ApiException(502, "O Canvas retornou um identificador inválido.");
        return value.asText();
    }

    private static String text(JsonNode value, String fallback) { return value.isTextual() ? value.asText() : fallback; }

    private static List<String> submissionTypes(JsonNode assignment) {
        List<String> values = new ArrayList<>();
        if (assignment.path("submission_types").isArray()) {
            for (JsonNode type : assignment.path("submission_types")) if (type.isTextual()) values.add(type.asText());
        }
        return values;
    }

    private static String timestamp(JsonNode value) {
        if (!value.isTextual()) return null;
        try { OffsetDateTime.parse(value.asText()); return value.asText(); }
        catch (DateTimeParseException exception) { return null; }
    }

    private static String publicHttpsUrl(String value) {
        if (value == null || value.length() > 2_048) throw new ApiException(400, "Informe a URL HTTPS publicada do trabalho.");
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getUserInfo() != null ||
                    Set.of("localhost", "[::1]", "::1").contains(host) || host.endsWith(".localhost") || host.startsWith("127."))
                throw new IllegalArgumentException("invalid URL");
            return uri.toASCIIString();
        } catch (IllegalArgumentException exception) {
            throw new ApiException(400, "Informe uma URL HTTPS pública, sem usuário ou senha.");
        }
    }
}
