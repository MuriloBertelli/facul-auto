package br.com.faculauto.config;

import static org.junit.jupiter.api.Assertions.*;

import br.com.faculauto.auth.OwnerAuthenticator;
import br.com.faculauto.canvas.CanvasService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HttpTransportTest {
    private HttpServer server;
    private URI base;
    private JdkHttpTransport transport;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        transport = new JdkHttpTransport(Map.of("NO_PROXY", "*"));
    }

    @AfterEach
    void stopServer() { server.stop(0); }

    @Test
    void actualHttpClientNeverFollowsUpstreamRedirects() throws Exception {
        AtomicInteger destinationCalls = new AtomicInteger();
        server.createContext("/redirect", exchange -> {
            exchange.getResponseHeaders().set("Location", base.resolve("/destination").toString());
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/destination", exchange -> {
            destinationCalls.incrementAndGet();
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        HttpTransport.Reply reply = transport.exchange(base.resolve("/redirect"), "GET", Map.of(), new byte[0], 100);
        assertEquals(302, reply.status());
        assertEquals(0, destinationCalls.get());
    }

    @Test
    void actualHttpClientRejectsOversizedResponseBeforeBufferingUnboundedData() {
        server.createContext("/large", exchange -> {
            byte[] bytes = "x".repeat(1_000).getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        assertThrows(IOException.class, () -> transport.exchange(base.resolve("/large"), "GET", Map.of(), new byte[0], 32));
    }

    @Test
    void injectedLocalUpstreamExercisesRealAuthThenCanvasHttpWithoutRelaxingProductionHttps() throws Exception {
        AtomicInteger authCalls = new AtomicInteger();
        AtomicInteger canvasCalls = new AtomicInteger();
        server.createContext("/auth/v1/user", exchange -> {
            assertEquals("Bearer browser-session", exchange.getRequestHeaders().getFirst("authorization"));
            assertEquals("test-publishable", exchange.getRequestHeaders().getFirst("apikey"));
            authCalls.incrementAndGet();
            byte[] bytes = "{\"id\":\"owner\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.createContext("/api/v1/courses", exchange -> {
            assertEquals("Bearer server-canvas-token", exchange.getRequestHeaders().getFirst("authorization"));
            canvasCalls.incrementAndGet();
            byte[] bytes = "[{\"id\":10,\"name\":\"Circuitos\",\"course_code\":\"ELE\"}]".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        HttpTransport localAdapter = (uri, method, headers, body, limit) -> transport.exchange(
                base.resolve(uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery())), method, headers, body, limit);
        AppProperties properties = new AppProperties("https://project.supabase.co", "test-publishable", "owner",
                "https://college.instructure.com", "server-canvas-token", false, "");
        ObjectMapper mapper = new ObjectMapper();
        new OwnerAuthenticator(properties, localAdapter, mapper).requireOwner("Bearer browser-session");
        var courses = new CanvasService(properties, localAdapter, mapper).courses();
        assertEquals("10", courses.getFirst().id());
        assertEquals(1, authCalls.get());
        assertEquals(1, canvasCalls.get());
        assertEquals("https", properties.canvasBase().getScheme());
    }

    @Test
    void standardProxyRoutingKeepsNoProxyLoopbackLocal() {
        EnvironmentProxySelector selector = new EnvironmentProxySelector(Map.of(
                "HTTPS_PROXY", "http://proxy.example:8080", "NO_PROXY", "127.0.0.1,localhost,.internal.example"));
        assertEquals(List.of(Proxy.NO_PROXY), selector.select(URI.create("http://127.0.0.1:54321/auth/v1/user")));
        assertEquals(List.of(Proxy.NO_PROXY), selector.select(URI.create("https://service.internal.example/path")));
        Proxy proxy = selector.select(URI.create("https://college.instructure.com/api/v1/courses")).getFirst();
        assertEquals(Proxy.Type.HTTP, proxy.type());
        assertEquals("proxy.example", ((InetSocketAddress) proxy.address()).getHostString());
    }

    @Test
    void unsafeCorsWildcardIsRejected() {
        AppProperties properties = new AppProperties("", "", "", "", "", false, "*");
        assertThrows(IllegalArgumentException.class, () -> new WebConfiguration(properties));
    }
}
