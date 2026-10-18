package com.freshmart.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import java.net.URI;

/** A public course sandbox must not silently inherit local HTTP cookie/origin settings. */
@Configuration
@Profile("showcase")
public class ShowcaseConfiguration {
    public ShowcaseConfiguration(@Value("${app.secure-cookies}") boolean secure,
                                 @Value("${app.allowed-origins}") String origins,
                                 Environment environment) {
        if (!secure || environment.acceptsProfiles(Profiles.of("demo", "dev", "test", "prod", "production")))
            throw new IllegalStateException("Showcase must run alone with secure cookies");
        validateOrigins(origins);
    }
    static void validateOrigins(String origins) {
        if (origins == null || origins.isBlank()) throw new IllegalStateException("Showcase HTTPS origin is required");
        for (String raw : origins.split(",", -1)) {
            URI uri;
            try { uri = URI.create(raw.trim()); }
            catch (IllegalArgumentException e) { throw new IllegalStateException("Invalid showcase HTTPS origin"); }
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || (uri.getPath() != null && !uri.getPath().isEmpty()) || uri.getQuery() != null
                    || uri.getFragment() != null || uri.getPort() == 0)
                throw new IllegalStateException("Showcase allows only exact HTTPS origins without a path");
        }
    }
}
