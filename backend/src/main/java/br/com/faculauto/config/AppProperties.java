package br.com.faculauto.config;

import java.net.URI;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "facul")
public record AppProperties(
        String supabaseUrl,
        String supabasePublishableKey,
        String supabaseOwnerUserId,
        String canvasBaseUrl,
        String canvasApiToken,
        boolean canvasSubmissionsEnabled,
        String allowedOrigins) {

    public boolean supabaseConfigured() {
        return supabaseBase() != null && present(supabasePublishableKey);
    }

    public boolean canvasConfigured() {
        return canvasBase() != null && present(canvasApiToken) && present(supabaseOwnerUserId);
    }

    public URI canvasBase() {
        URI uri = rootUri(canvasBaseUrl);
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) ? uri : null;
    }

    public URI supabaseBase() {
        URI uri = rootUri(supabaseUrl);
        if (uri == null) return null;
        if ("https".equalsIgnoreCase(uri.getScheme())) return uri;
        if ("http".equalsIgnoreCase(uri.getScheme()) &&
                Set.of("localhost", "127.0.0.1", "[::1]", "::1").contains(uri.getHost())) return uri;
        return null;
    }

    private static URI rootUri(String value) {
        try {
            URI uri = URI.create(value == null ? "" : value);
            if (!uri.isAbsolute() || uri.getHost() == null || uri.getUserInfo() != null ||
                    uri.getRawQuery() != null || uri.getRawFragment() != null ||
                    !(uri.getRawPath().isEmpty() || uri.getRawPath().equals("/"))) return null;
            return uri;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    public static boolean present(String value) {
        return value != null && !value.isBlank();
    }
}
