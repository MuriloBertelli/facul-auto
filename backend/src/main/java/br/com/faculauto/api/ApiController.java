package br.com.faculauto.api;

import br.com.faculauto.auth.OwnerAuthenticator;
import br.com.faculauto.canvas.CanvasService;
import br.com.faculauto.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public final class ApiController {
    private static final int MAX_BODY_BYTES = 8_192;
    private final AppProperties properties;
    private final OwnerAuthenticator authenticator;
    private final CanvasService canvas;
    private final ObjectMapper mapper;

    public ApiController(AppProperties properties, OwnerAuthenticator authenticator, CanvasService canvas, ObjectMapper mapper) {
        this.properties = properties;
        this.authenticator = authenticator;
        this.canvas = canvas;
        this.mapper = mapper;
    }

    @GetMapping("/health")
    public ApiModels.Health health() {
        return new ApiModels.Health("ok", properties.canvasConfigured(), properties.supabaseConfigured(),
                properties.canvasSubmissionsEnabled() && properties.canvasConfigured() && properties.supabaseConfigured());
    }

    @GetMapping("/canvas/courses")
    public Map<String, List<ApiModels.Course>> courses(@RequestHeader(value = "Authorization", required = false) String authorization) {
        authenticator.requireOwner(authorization);
        return Map.of("courses", canvas.courses());
    }

    @GetMapping("/canvas/assignments")
    public Map<String, List<ApiModels.Assignment>> assignments(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam String courseId) {
        authenticator.requireOwner(authorization);
        return Map.of("assignments", canvas.assignments(courseId));
    }

    @PostMapping(value = "/canvas/submissions", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiModels.Submission submit(@RequestHeader(value = "Authorization", required = false) String authorization,
                                      HttpServletRequest request) {
        authenticator.requireOwner(authorization);
        if (!properties.canvasSubmissionsEnabled()) throw new ApiException(403, "As entregas pelo aplicativo estão desativadas.");
        if (request.getContentLengthLong() > MAX_BODY_BYTES) throw new ApiException(413, "A solicitação é muito grande.");
        try {
            byte[] bytes = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
            if (bytes.length > MAX_BODY_BYTES) throw new ApiException(413, "A solicitação é muito grande.");
            JsonNode body = mapper.readTree(bytes);
            return canvas.submit(body);
        } catch (IOException exception) {
            throw new ApiException(400, "Os dados enviados não são um objeto JSON válido.");
        }
    }
}
