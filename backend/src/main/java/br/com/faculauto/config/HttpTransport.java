package br.com.faculauto.config;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;

/** Outbound HTTP boundary; tests replace it without relaxing production URL validation. */
@FunctionalInterface
public interface HttpTransport {
    Reply exchange(URI uri, String method, Map<String, String> headers, byte[] body, int maxBodyBytes)
            throws IOException, InterruptedException;

    record Reply(int status, Map<String, List<String>> headers, byte[] body) {
        public String header(String name) {
            return headers.entrySet().stream()
                    .filter(entry -> entry.getKey().equalsIgnoreCase(name))
                    .flatMap(entry -> entry.getValue().stream())
                    .findFirst().orElse(null);
        }

        public boolean successful() {
            return status >= 200 && status < 300;
        }
    }
}
