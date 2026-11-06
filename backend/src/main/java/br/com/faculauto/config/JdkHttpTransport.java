package br.com.faculauto.config;

import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.Map;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.stereotype.Component;

@Component
public final class JdkHttpTransport implements HttpTransport {
    private final HttpClient client;

    public JdkHttpTransport() {
        this(System.getenv());
    }

    JdkHttpTransport(Map<String, String> environment) {
        client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NEVER)
                .proxy(new EnvironmentProxySelector(environment))
                .build();
    }

    @Override
    public Reply exchange(URI uri, String method, Map<String, String> headers, byte[] body, int maxBodyBytes)
            throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(12));
        headers.forEach(request::header);
        request.method(method, body.length == 0 ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofByteArray(body));
        CompletableFuture<HttpResponse<byte[]>> pending = client.sendAsync(request.build(), ignored -> new LimitedBodySubscriber(maxBodyBytes));
        try {
            // Bound the entire response, including a stalled streaming body after headers arrive.
            HttpResponse<byte[]> response = pending.get(12, TimeUnit.SECONDS);
            return new Reply(response.statusCode(), response.headers().map(), response.body());
        } catch (TimeoutException exception) {
            pending.cancel(true);
            throw new HttpTimeoutException("Upstream request timed out.");
        } catch (InterruptedException exception) {
            pending.cancel(true);
            throw exception;
        } catch (ExecutionException exception) {
            if (exception.getCause() instanceof IOException cause) throw cause;
            throw new IOException("Upstream request failed.");
        }
    }

    private static final class LimitedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final int limit;
        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        private final CompletableFuture<byte[]> result = new CompletableFuture<>();
        private Flow.Subscription subscription;

        private LimitedBodySubscriber(int limit) { this.limit = limit; }

        @Override
        public CompletionStage<byte[]> getBody() { return result; }

        @Override
        public void onSubscribe(Flow.Subscription value) {
            subscription = value;
            value.request(1);
        }

        @Override
        public void onNext(List<ByteBuffer> buffers) {
            long incoming = buffers.stream().mapToLong(ByteBuffer::remaining).sum();
            if (incoming + bytes.size() > limit) {
                subscription.cancel();
                result.completeExceptionally(new IOException("Upstream response exceeded the configured size limit."));
                return;
            }
            for (ByteBuffer buffer : buffers) {
                byte[] chunk = new byte[buffer.remaining()];
                buffer.get(chunk);
                bytes.writeBytes(chunk);
            }
            subscription.request(1);
        }

        @Override
        public void onError(Throwable error) { result.completeExceptionally(error); }

        @Override
        public void onComplete() { result.complete(bytes.toByteArray()); }
    }
}
