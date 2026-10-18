#!/bin/sh
set -eu
# Railway volumes arrive root-owned. Initialize only the configured mount, then drop privileges.
if [ "$(id -u)" = 0 ]; then
    [ "${APP_MEDIA_DIR:-}" = /app/media ] || { echo 'Expected APP_MEDIA_DIR=/app/media' >&2; exit 1; }
    [ ! -L /app/media ] || { echo 'Media mount cannot be a symlink' >&2; exit 1; }
    mkdir -p /app/media
    chown 10001:10001 /app/media
    chmod 700 /app/media
    exec su -s /bin/sh freshmall -c 'exec java -XX:MaxRAMPercentage=65.0 -XX:+ExitOnOutOfMemoryError -jar /app/app.jar'
fi
exec java -XX:MaxRAMPercentage=65.0 -XX:+ExitOnOutOfMemoryError -jar /app/app.jar
