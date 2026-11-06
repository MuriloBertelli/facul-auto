package br.com.faculauto.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.Proxy;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EnvironmentProxySelectorTest {
    private EnvironmentProxySelector selector(String noProxy) {
        return new EnvironmentProxySelector(Map.of("HTTPS_PROXY", "http://proxy.example:8080",
                "HTTP_PROXY", "http://proxy.example:8080", "NO_PROXY", noProxy));
    }

    private void direct(EnvironmentProxySelector selector, String uri) {
        assertEquals(Proxy.Type.DIRECT, selector.select(URI.create(uri)).getFirst().type());
    }

    private void proxied(EnvironmentProxySelector selector, String uri) {
        assertEquals(Proxy.Type.HTTP, selector.select(URI.create(uri)).getFirst().type());
    }

    @Test
    void omittedUriPortsMatchTheirEffectiveHttpAndHttpsDefaults() {
        EnvironmentProxySelector selector = selector("secure.example:443,plain.example:80");
        direct(selector, "https://secure.example/path");
        direct(selector, "https://secure.example:443/path");
        direct(selector, "http://plain.example/path");
        direct(selector, "http://plain.example:80/path");
        proxied(selector, "http://secure.example/path");
        proxied(selector, "https://plain.example/path");
    }

    @Test
    void anExplicitNoProxyPortDoesNotBypassOtherPorts() {
        EnvironmentProxySelector selector = selector("service.example:8443");
        direct(selector, "https://service.example:8443/path");
        proxied(selector, "https://service.example/path");
        proxied(selector, "https://service.example:9443/path");
    }

    @Test
    void bareIpv6NoProxyLiteralMatchesBracketedUriHostsOnAnyPort() {
        EnvironmentProxySelector selector = selector("::1");
        direct(selector, "http://[::1]:54321/auth/v1/user");
        direct(selector, "http://[::1]/path");
        direct(selector, "https://[::1]/path");
        proxied(selector, "http://[::2]:54321/path");
    }

    @Test
    void bracketedIpv6NoProxyEntriesSupportOptionalPortRestrictions() {
        EnvironmentProxySelector portRestricted = selector("[::1]:54321");
        direct(portRestricted, "http://[::1]:54321/auth/v1/user");
        proxied(portRestricted, "http://[::1]:54322/path");
        proxied(portRestricted, "http://[::1]/path");
        direct(selector("[::1]"), "http://[::1]:54322/path");
        direct(selector("[::1]:443"), "https://[::1]/path");
    }
}
