import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Internal container probe only. Does not expose actuator publicly or call a business command. */
public final class Healthcheck {
    public static void main(String[] args) throws Exception {
        try (var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()) {
            var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8080/actuator/health"))
                    .timeout(Duration.ofSeconds(4)).GET().build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || !response.body().matches("(?s).*\"status\"\\s*:\\s*\"UP\".*")) {
                System.exit(1);
            }
        }
    }
}
