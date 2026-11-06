package br.com.faculauto.config;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Honors the cloud's standard proxy routing, including loopback NO_PROXY entries. */
final class EnvironmentProxySelector extends ProxySelector {
    private final Map<String, String> environment;
    private final ProxySelector fallback = ProxySelector.getDefault();

    EnvironmentProxySelector(Map<String, String> environment) { this.environment = environment; }

    @Override
    public List<Proxy> select(URI uri) {
        String hostname = normalizeHost(uri.getHost() == null ? "" : uri.getHost());
        int port = uri.getPort() != -1 ? uri.getPort() : "https".equalsIgnoreCase(uri.getScheme()) ? 443 :
                "http".equalsIgnoreCase(uri.getScheme()) ? 80 : -1;
        String bypass = value("NO_PROXY");
        if (bypass != null && Arrays.stream(bypass.split(",")).anyMatch(entry -> matches(entry.trim(), hostname, port)))
            return List.of(Proxy.NO_PROXY);
        String proxyValue = value("https".equalsIgnoreCase(uri.getScheme()) ? "HTTPS_PROXY" : "HTTP_PROXY");
        if (proxyValue == null || proxyValue.isBlank()) return fallback == null ? List.of(Proxy.NO_PROXY) : fallback.select(uri);
        try {
            URI proxy = URI.create(proxyValue);
            if (!"http".equalsIgnoreCase(proxy.getScheme()) || proxy.getHost() == null || proxy.getUserInfo() != null)
                throw new IllegalArgumentException("Unsupported proxy");
            return List.of(new Proxy(Proxy.Type.HTTP, InetSocketAddress.createUnresolved(proxy.getHost(), proxy.getPort() == -1 ? 80 : proxy.getPort())));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("The configured HTTP(S) proxy must be an HTTP proxy without embedded credentials.");
        }
    }

    private String value(String key) {
        String value = environment.get(key);
        return value == null ? environment.get(key.toLowerCase(Locale.ROOT)) : value;
    }

    private static boolean matches(String entry, String host, int port) {
        if (entry.equals("*")) return true;
        if (entry.isEmpty()) return false;
        entry = entry.toLowerCase(Locale.ROOT);
        if (entry.startsWith("[")) {
            int end = entry.indexOf(']');
            if (end < 0) return false;
            String suffix = entry.substring(end + 1);
            if (!suffix.isEmpty() && (!suffix.startsWith(":") || !matchesPort(suffix.substring(1), port))) return false;
            entry = entry.substring(1, end);
        } else {
            int separator = entry.lastIndexOf(':');
            // An unbracketed IPv6 literal contains several colons and has no unambiguous port suffix.
            if (separator > 0 && entry.indexOf(':') == separator) {
                if (!matchesPort(entry.substring(separator + 1), port)) return false;
                entry = entry.substring(0, separator);
            }
        }
        if (entry.startsWith("*.")) entry = entry.substring(1);
        if (entry.startsWith(".")) return host.equals(entry.substring(1)) || host.endsWith(entry);
        return host.equals(entry);
    }

    private static boolean matchesPort(String value, int port) {
        try {
            int required = Integer.parseInt(value);
            return required >= 0 && required <= 65_535 && required == port;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private static String normalizeHost(String host) {
        host = host.toLowerCase(Locale.ROOT);
        return host.startsWith("[") && host.endsWith("]") ? host.substring(1, host.length() - 1) : host;
    }

    @Override
    public void connectFailed(URI uri, SocketAddress address, IOException error) {
        // Do not log destination credentials, request headers, or proxy configuration.
    }
}
