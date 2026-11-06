package br.com.faculauto.config;

import java.net.URI;
import java.util.Arrays;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    private final String[] origins;

    public WebConfiguration(AppProperties properties) {
        String configured = properties.allowedOrigins() == null ? "http://127.0.0.1:8888,http://localhost:8888" : properties.allowedOrigins();
        origins = Arrays.stream(configured.split(","))
                .map(String::trim).filter(value -> !value.isEmpty()).distinct().toArray(String[]::new);
        for (String origin : origins) {
            URI uri;
            try { uri = URI.create(origin); }
            catch (IllegalArgumentException exception) { throw new IllegalArgumentException("APP_ALLOWED_ORIGINS must contain exact HTTP(S) origins."); }
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null ||
                    !(uri.getRawPath().isEmpty()) || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
                throw new IllegalArgumentException("APP_ALLOWED_ORIGINS must contain exact HTTP(S) origins without a path or wildcard.");
            }
        }
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type")
                .allowCredentials(false)
                .maxAge(600);
    }
}
