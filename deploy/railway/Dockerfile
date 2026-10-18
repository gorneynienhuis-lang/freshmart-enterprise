# syntax=docker/dockerfile:1
# Exact patch tags verified in docker-library/official-images on 2026-10-18.
# Override these build ARGs with recorded @sha256 references when freezing the release.
ARG NODE_BUILD_IMAGE=node:26.12.0-bookworm-slim
ARG JAVA_BUILD_IMAGE=eclipse-temurin:21.0.12.1_1-jdk-jammy
ARG JAVA_RUNTIME_IMAGE=eclipse-temurin:21.0.12.1_1-jre-jammy

FROM ${NODE_BUILD_IMAGE} AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ /src/frontend/
COPY design/v2/ /src/design/v2/
COPY design/r04/ /src/design/r04/
COPY backend/src/main/resources/static/catalog/ /src/backend/src/main/resources/static/catalog/
COPY contracts/openapi.yaml /src/contracts/openapi.yaml
RUN npm run verify && npm run build

FROM ${JAVA_BUILD_IMAGE} AS backend
WORKDIR /src
COPY backend/ backend/
COPY database/migrations/ database/migrations/
COPY --from=frontend /src/frontend/dist/ /src/backend/src/main/resources/static/
COPY deploy/Healthcheck.java /src/Healthcheck.java
WORKDIR /src/backend
RUN chmod +x mvnw && ./mvnw -B -ntp -DskipTests package
RUN javac -d /src/healthcheck /src/Healthcheck.java

FROM ${JAVA_RUNTIME_IMAGE} AS runtime
RUN groupadd --gid 10001 freshmall && useradd --system --uid 10001 --gid 10001 --home /app freshmall
WORKDIR /app
RUN mkdir -p /app/media && chown 10001:10001 /app/media
COPY --from=backend --chown=10001:10001 /src/backend/target/fresh-mall-backend-0.1.0-SNAPSHOT.jar /app/app.jar
COPY --from=backend --chown=10001:10001 /src/healthcheck/ /app/healthcheck/
COPY deploy/railway/start.sh /app/start.sh
RUN chmod 755 /app/start.sh && command -v su
USER 10001:10001
ENV SERVER_ADDRESS=0.0.0.0 SERVER_PORT=8080 PORT=8080 APP_MEDIA_DIR=/app/media
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=7s --start-period=90s --retries=8 CMD ["java", "-Xmx32m", "-cp", "/app/healthcheck", "Healthcheck"]
ENTRYPOINT ["/app/start.sh"]
