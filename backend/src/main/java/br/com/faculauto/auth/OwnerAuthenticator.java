package br.com.faculauto.auth;

import br.com.faculauto.api.ApiException;
import br.com.faculauto.config.AppProperties;
import br.com.faculauto.config.HttpTransport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public final class OwnerAuthenticator {
    private static final Pattern BEARER = Pattern.compile("^Bearer ([^\\s]+)$", Pattern.CASE_INSENSITIVE);
    private final AppProperties properties;
    private final HttpTransport transport;
    private final ObjectMapper mapper;

    public OwnerAuthenticator(AppProperties properties, HttpTransport transport, ObjectMapper mapper) {
        this.properties = properties;
        this.transport = transport;
        this.mapper = mapper;
    }

    public void requireOwner(String authorization) {
        Matcher match = BEARER.matcher(authorization == null ? "" : authorization);
        if (!match.matches() || match.group(1).length() > 8_192)
            throw new ApiException(401, "Entre na sua conta para acessar o Canvas.");
        if (!properties.supabaseConfigured())
            throw new ApiException(503, "Configure a autenticação do Supabase no servidor.");

        HttpTransport.Reply reply;
        JsonNode user;
        try {
            reply = transport.exchange(properties.supabaseBase().resolve("/auth/v1/user"), "GET", Map.of(
                    "accept", "application/json",
                    "apikey", properties.supabasePublishableKey(),
                    "authorization", "Bearer " + match.group(1)), new byte[0], 262_144);
            if (reply.status() == 401 || reply.status() == 403)
                throw new ApiException(401, "Sua sessão expirou. Entre novamente.");
            if (!reply.successful()) throw new ApiException(503, "Não foi possível validar sua sessão. Tente novamente.");
            user = mapper.readTree(reply.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ApiException(503, "Não foi possível validar sua sessão. Tente novamente.");
        } catch (IOException | IllegalArgumentException exception) {
            throw new ApiException(503, "Não foi possível validar sua sessão. Tente novamente.");
        }
        if (user == null || !user.isObject() || !user.path("id").isTextual() || user.path("id").asText().isBlank())
            throw new ApiException(401, "Sua sessão expirou. Entre novamente.");
        if (!AppProperties.present(properties.supabaseOwnerUserId()))
            throw new ApiException(503, "Configure o usuário autorizado a usar o Canvas.");
        if (!properties.supabaseOwnerUserId().equals(user.path("id").asText()))
            throw new ApiException(403, "Esta conta não tem acesso à integração pessoal do Canvas.");
    }
}
