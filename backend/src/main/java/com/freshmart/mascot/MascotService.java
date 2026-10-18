package com.freshmart.mascot;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static com.freshmart.mascot.MascotModels.ChatReply;
import static com.freshmart.mascot.MascotModels.ChatRequest;

@Service
public class MascotService {
    private static final Logger log = LoggerFactory.getLogger(MascotService.class);
    private static final List<String> SUGGESTIONS = List.of("怎么下单？", "如何预约配送？", "如何修改收货地址？");
    private static final String SYSTEM_PROMPT = "你是东华大学社区生鲜超市的吉祥物东小锦。只回答本系统操作问题，回答简洁、准确、分点清楚。系统支持商品搜索、购物车、地址、配送时段、优惠券、称重商品多退少补、订单、售后和员工工作台。明确说明这是课程演示和沙箱支付，不要声称是真实学校官方运营。不了解的内容请说请联系管理员，不要编造接口、价格、账号、密码或个人信息。";

    private final ObjectMapper json;
    private final HttpClient client;
    private final boolean enabled;
    private final String apiKey;
    private final String endpoint;
    private final String model;
    private final Duration timeout;

    public MascotService(ObjectMapper json,
                         @Value("${app.mascot.enabled:false}") boolean enabled,
                         @Value("${app.mascot.api-key:}") String apiKey,
                         @Value("${app.mascot.endpoint:https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions}") String endpoint,
                         @Value("${app.mascot.model:qwen-flash}") String model,
                         @Value("${app.mascot.timeout-ms:8000}") long timeoutMs) {
        this.json = json;
        this.enabled = enabled;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.endpoint = endpoint;
        this.model = model;
        this.timeout = Duration.ofMillis(Math.max(1000, Math.min(timeoutMs, 15000)));
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    }

    public ChatReply answer(ChatRequest request) {
        if (!enabled || apiKey.isBlank()) {
            return new ChatReply(List.of("问答服务尚未配置，当前请使用面板里的常见问题。"), SUGGESTIONS, "fallback");
        }
        try {
            return callModel(request);
        } catch (Exception error) {
            log.warn("Mascot model call failed type={}", error.getClass().getSimpleName());
            return new ChatReply(List.of("暂时没有收到问答服务的回复，请稍后再试。"), SUGGESTIONS, "fallback");
        }
    }

    private ChatReply callModel(ChatRequest request) throws Exception {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", SYSTEM_PROMPT));
        if (request.history() != null) {
            request.history().stream().limit(6).forEach(item -> {
                String role = "assistant".equals(item.role()) ? "assistant" : "user";
                messages.add(Map.of("role", role, "content", item.content().substring(0, Math.min(item.content().length(), 2000))));
            });
        }
        messages.add(Map.of("role", "user", "content", request.message()));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("temperature", 0.2);
        payload.put("max_tokens", 300);
        HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(timeout)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload)))
                .build();
        HttpResponse<String> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) throw new IllegalStateException("model http " + response.statusCode());
        JsonNode root = json.readTree(response.body());
        String content = root.path("choices").path(0).path("message").path("content").asString("").trim();
        if (content.isBlank()) throw new IllegalStateException("model response missing content");
        return new ChatReply(List.of(content), SUGGESTIONS, "model");
    }
}
