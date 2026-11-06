package br.com.faculauto;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "facul.supabase-url=", "facul.supabase-publishable-key=", "facul.supabase-owner-user-id=",
        "facul.canvas-base-url=", "facul.canvas-api-token=", "facul.canvas-submissions-enabled=false",
        "facul.allowed-origins=http://localhost:8888,http://127.0.0.1:8888"
})
@AutoConfigureMockMvc
class ApplicationHttpTest {
    @Autowired private MockMvc mvc;

    @Test
    void applicationStartsWithoutSecretsAndServesHealth() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.canvasConfigured").value(false))
                .andExpect(jsonPath("$.supabaseConfigured").value(false))
                .andExpect(jsonPath("$.submissionsEnabled").value(false))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void exactConfiguredOriginCanUseBearerPreflightWithoutCookies() throws Exception {
        mvc.perform(options("/api/canvas/courses").header("Origin", "http://localhost:8888")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Authorization,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8888"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }

    @Test
    void differentOriginsDoNotReceiveCorsPermission() throws Exception {
        mvc.perform(options("/api/canvas/courses").header("Origin", "https://unlisted.example")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Authorization"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
