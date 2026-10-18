package com.freshmart.cache;

import io.lettuce.core.ClientOptions;
import io.lettuce.core.MaintNotificationsConfig;
import io.lettuce.core.protocol.ProtocolVersion;
import org.springframework.boot.data.redis.autoconfigure.LettuceClientOptionsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Keep optional-cache outages bounded; RESP2 works with the narrow GET/SET/DEL/PING ACL. */
@Configuration(proxyBeanMethods = false)
public class CatalogRedisClientConfiguration {
    @Bean
    LettuceClientOptionsBuilderCustomizer catalogRedisClientOptions() {
        return builder -> builder.protocolVersion(ProtocolVersion.RESP2)
                .maintNotificationsConfig(MaintNotificationsConfig.disabled())
                .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
                .requestQueueSize(32);
    }
}
