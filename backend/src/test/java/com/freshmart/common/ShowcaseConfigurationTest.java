package com.freshmart.common;

import com.freshmart.commerce.SandboxSignature;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import java.time.Clock;
import static org.junit.jupiter.api.Assertions.*;

class ShowcaseConfigurationTest {
    @Test void onlyExactHttpsOriginsAreAccepted() {
        assertDoesNotThrow(() -> ShowcaseConfiguration.validateOrigins("https://shop.example.com,https://other.example.com:8443"));
        for (String value : new String[]{"", "*", "http://shop.example.com", "https://shop.example.com/", "https://shop.example.com/path", "https://user@shop.example.com", "https://shop.example.com?x=1", "https://shop.example.com#x", "https://*.example.com", "https://shop.example.com,"})
            assertThrows(IllegalStateException.class, () -> ShowcaseConfiguration.validateOrigins(value), value);
    }
    @Test void localProfilesCannotOverridePublicCookieSafety() {
        MockEnvironment env = new MockEnvironment(); env.setActiveProfiles("showcase");
        assertDoesNotThrow(() -> new ShowcaseConfiguration(true, "https://shop.example.com", env));
        assertThrows(IllegalStateException.class, () -> new ShowcaseConfiguration(false, "https://shop.example.com", env));
        for (String incompatible : new String[]{"demo", "dev", "test", "prod", "production"}) {
            env.setActiveProfiles("showcase", incompatible);
            assertThrows(IllegalStateException.class, () -> new ShowcaseConfiguration(true, "https://shop.example.com", env));
        }
    }
    @Test void publicCourseSandboxIsExplicitAndProductionStillRejectsIt() {
        MockEnvironment env = new MockEnvironment(); env.setActiveProfiles("showcase");
        String secret = "test-only-showcase-signing-secret-at-least-32-bytes";
        assertTrue(new SandboxSignature(true, secret, env, Clock.systemUTC()).enabled());
        env.setActiveProfiles("showcase", "production");
        assertFalse(new SandboxSignature(true, secret, env, Clock.systemUTC()).enabled());
        env.setActiveProfiles("showcase");
        assertThrows(IllegalStateException.class, () -> new SandboxSignature(true, "short", env, Clock.systemUTC()));
    }
}
