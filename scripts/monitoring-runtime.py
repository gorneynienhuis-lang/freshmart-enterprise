#!/usr/bin/env python3
"""Pinned, repository-local Prometheus. No system install, remote targets, or secret CLI values."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import secrets
import signal
import socket
import stat
import subprocess
import sys
import tarfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / "deploy" / "monitoring"
RUNTIME = ROOT / ".runtime" / "monitoring"
PRIVATE = RUNTIME / "private"
TOKEN = PRIVATE / "scrape-token"
STATE = PRIVATE / "process.json"
LOCK = json.loads((DEPLOY / "prometheus.lock.json").read_text())
INSTALL = RUNTIME / ("prometheus-" + LOCK["version"])
ENVIRONMENT = {"PATH": "/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "en_US.UTF-8", "LC_ALL": "en_US.UTF-8", "TZ": "UTC"}


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def fail(message):
    raise RuntimeError(message)


def private_directory(path):
    if not path.is_relative_to(ROOT / ".runtime"):
        fail("Runtime directory escaped repository")
    current = ROOT
    for part in path.relative_to(ROOT).parts:
        current = current / part
        if current.is_symlink():
            fail("Runtime directories cannot be symlinks")
        if not current.exists():
            current.mkdir(mode=0o700)
        info = current.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid():
            fail("Runtime directory is not privately owned")
        os.chmod(current, 0o700)


def private_write(path, data, exclusive=False):
    private_directory(path.parent)
    flags = os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW
    flags |= os.O_EXCL if exclusive else os.O_TRUNC
    descriptor = os.open(path, flags, 0o600)
    with os.fdopen(descriptor, "wb") as target:
        os.fchmod(target.fileno(), 0o600)
        target.write(data if isinstance(data, bytes) else data.encode())


def ensure_token():
    private_directory(PRIVATE)
    if not TOKEN.exists() and not TOKEN.is_symlink():
        private_write(TOKEN, secrets.token_urlsafe(48) + "\n", exclusive=True)
    info = TOKEN.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600 or not 43 <= info.st_size <= 256:
        fail("Scrape credential file is unsafe")
    if not re.fullmatch(r"[A-Za-z0-9_-]{43,128}\n?", TOKEN.read_text(encoding="ascii")):
        fail("Scrape credential format is invalid")
    return TOKEN


class OfficialRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        check_official_url(new_url)
        return super().redirect_request(request, fp, code, message, headers, new_url)


def check_official_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in {"github.com", "api.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"} or parsed.username or parsed.password:
        fail("Artifact URL is outside the official HTTPS release hosts")


def official_download(url, path, maximum):
    check_official_url(url)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), OfficialRedirects())
    request = urllib.request.Request(url, headers={"User-Agent": "freshmall-local-monitoring/1", "Accept": "application/octet-stream"})
    digest = hashlib.sha256()
    total = 0
    try:
        with opener.open(request, timeout=45) as response:
            check_official_url(response.url)
            private_directory(path.parent)
            with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600), "wb") as target:
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > maximum:
                        fail("Official artifact exceeded the pinned size limit")
                    digest.update(chunk)
                    target.write(chunk)
    except Exception:
        fail("Official artifact download failed; no artifact was executed")
    return digest.hexdigest(), total


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def fetch():
    if (platform.system(), platform.machine()) != ("Darwin", "arm64"):
        fail("Pinned package is only for Darwin arm64; review a new lock for this platform")
    private_directory(RUNTIME)
    checksums = RUNTIME / "sha256sums.txt"
    checksum_digest, _ = official_download(LOCK["checksum_url"], checksums, 32 * 1024)
    if checksum_digest != LOCK["checksum_sha256"]:
        fail("Official checksum file failed the pinned SHA256 check")
    entries = [line.split() for line in checksums.read_text().splitlines() if line.strip()]
    matches = [entry[0] for entry in entries if len(entry) == 2 and entry[1].lstrip("*") == LOCK["archive"]]
    if matches != [LOCK["archive_sha256"]]:
        fail("Official checksum manifest disagrees with the reviewed archive lock")
    archive = RUNTIME / LOCK["archive"]
    if archive.is_symlink():
        fail("Artifact cache cannot be a symlink")
    if not archive.is_file() or archive.stat().st_size != LOCK["archive_bytes"] or sha256(archive) != LOCK["archive_sha256"]:
        digest, size = official_download(LOCK["archive_url"], archive, LOCK["archive_bytes"])
        if (digest, size) != (LOCK["archive_sha256"], LOCK["archive_bytes"]):
            fail("Official archive failed the pinned size or SHA256 check")
    if STATE.exists() and owned_process(json.loads(STATE.read_text())):
        fail("Stop this owned monitor before replacing executables")
    private_directory(INSTALL)
    prefix = LOCK["archive"].removesuffix(".tar.gz") + "/"
    required = {prefix + name for name in ("prometheus", "promtool", "LICENSE", "NOTICE")}
    copied = set()
    with tarfile.open(archive, "r:gz") as bundle:
        for entry in bundle:
            if entry.name not in required:
                continue
            if not entry.isfile() or not 0 < entry.size < 300 * 1024 * 1024:
                fail("Official archive contains an unsafe executable member")
            destination = INSTALL / Path(entry.name).name
            stream = bundle.extractfile(entry)
            with os.fdopen(os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600), "wb") as output:
                while chunk := stream.read(1024 * 1024):
                    output.write(chunk)
            os.chmod(destination, 0o700 if destination.name in {"prometheus", "promtool"} else 0o600)
            copied.add(entry.name)
    if copied != required:
        fail("Official archive is missing a required binary or license")
    receipt = {"verified_at": utc_now(), "version": LOCK["version"], "platform": LOCK["platform"], "release_url": LOCK["release_url"], "archive_sha256": sha256(archive), "manifest_sha256": checksum_digest, "binaries": {name: sha256(INSTALL / name) for name in ("prometheus", "promtool")}}
    private_write(RUNTIME / "artifact-receipt.json", json.dumps(receipt, indent=2) + "\n")
    return receipt


def binary(name):
    candidate = INSTALL / name
    receipt_path = RUNTIME / "artifact-receipt.json"
    if candidate.is_symlink() or not candidate.is_file() or not receipt_path.is_file():
        fail("Run fetch to install verified repository-local binaries")
    receipt = json.loads(receipt_path.read_text())
    if receipt["archive_sha256"] != LOCK["archive_sha256"] or sha256(candidate) != receipt["binaries"][name]:
        fail("Local executable does not match its verified receipt")
    return candidate


def render(target_port):
    if not 1024 <= target_port <= 65535 or target_port in {3306, 9090, 5173, 8080}:
        fail("Select a distinct unprivileged isolated backend port, not a main service port")
    token_file = ensure_token()
    config = (DEPLOY / "prometheus.yml.template").read_text()
    for key, value in {"@TOKEN_PATH@": json.dumps(str(token_file)), "@RULES_PATH@": json.dumps(str(DEPLOY / "alerts.yml")), "@TARGET_PORT@": str(target_port)}.items():
        config = config.replace(key, value)
    if re.search(r"@[A-Z_]+@", config):
        fail("Monitoring configuration has an unexpanded variable")
    destination = PRIVATE / "prometheus.yml"
    private_write(destination, config)
    return destination


def check(target_port):
    executable = str(binary("promtool"))
    configuration = render(target_port)
    results = []
    for arguments in (["check", "config", str(configuration)], ["check", "rules", str(DEPLOY / "alerts.yml")], ["test", "rules", str(DEPLOY / "alerts.test.yml")]):
        result = subprocess.run([executable, *arguments], cwd=DEPLOY, env=ENVIRONMENT, capture_output=True, text=True, timeout=40)
        results.append({"command": ["promtool", *arguments], "exit_code": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
        if result.returncode:
            private_write(RUNTIME / "promtool-checks.json", json.dumps({"scope": "synthetic rule tests and configuration only", "checks": results}, indent=2) + "\n")
            fail("Official promtool check failed; inspect local promtool-checks.json")
    report = {"checked_at": utc_now(), "scope": "synthetic rule tests and configuration only; not live application evidence", "checks": results}
    private_write(RUNTIME / "promtool-checks.json", json.dumps(report, indent=2) + "\n")
    return report


def ps_value(pid, field):
    result = subprocess.run(["/bin/ps", "-p", str(pid), "-o", field + "="], capture_output=True, text=True, env=ENVIRONMENT, timeout=3)
    return result.stdout.strip() if result.returncode == 0 else ""


def process_fingerprint(pid):
    return {"pid": pid, "started": ps_value(pid, "lstart"), "command_sha256": hashlib.sha256(ps_value(pid, "command").encode()).hexdigest(), "executable": ps_value(pid, "comm")}


def owned_process(state):
    pid = state.get("pid")
    if not isinstance(pid, int) or pid <= 1 or state.get("binary") != str(INSTALL / "prometheus"):
        return False
    actual = process_fingerprint(pid)
    return bool(actual["started"]) and all(actual[key] == state.get(key) for key in ("pid", "started", "command_sha256", "executable")) and actual["executable"] == state["binary"]


def request_json(path, parameters=None):
    # No arbitrary remote URL, no auth headers, and no token in query strings.
    query = "?" + urllib.parse.urlencode(parameters) if parameters else ""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open("http://127.0.0.1:9090" + path + query, timeout=5) as response:
        data = response.read(8 * 1024 * 1024 + 1)
        if len(data) > 8 * 1024 * 1024:
            fail("Prometheus response exceeded the bounded evidence size")
        return json.loads(data)


def start(target_port):
    private_directory(PRIVATE)
    if STATE.exists():
        state = json.loads(STATE.read_text())
        if owned_process(state):
            return {"status": "already_running", "pid": state["pid"], "url": "http://127.0.0.1:9090"}
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", 9090))
        except OSError:
            fail("Port 9090 belongs to another process; it will not be stopped or replaced")
    check(target_port)
    executable = binary("prometheus")
    data = RUNTIME / "data"
    private_directory(data)
    args = [str(executable), "--config.file=" + str(PRIVATE / "prometheus.yml"), "--storage.tsdb.path=" + str(data), "--storage.tsdb.retention.time=1d", "--storage.tsdb.retention.size=256MB", "--web.listen-address=127.0.0.1:9090", "--web.external-url=http://127.0.0.1:9090", "--web.max-connections=64", "--query.max-concurrency=4", "--query.timeout=5s", "--query.max-samples=1000000"]
    with os.fdopen(os.open(RUNTIME / "prometheus.log", os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600), "ab") as log:
        process = subprocess.Popen(args, cwd=RUNTIME, env=ENVIRONMENT, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    time.sleep(0.2)
    state = {**process_fingerprint(process.pid), "binary": str(executable), "target_port": target_port, "recorded_at": utc_now()}
    if not state["started"] or state["executable"] != str(executable):
        # A process we just created can be terminated directly without consulting a stale PID file.
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)
        fail("Prometheus did not start with the expected executable")
    private_write(STATE, json.dumps(state, indent=2) + "\n")
    for _ in range(40):
        if process.poll() is not None:
            fail("Prometheus exited during startup; inspect the private runtime log")
        try:
            request_json("/api/v1/status/buildinfo")
            return {"status": "running", "pid": process.pid, "target": "127.0.0.1:" + str(target_port), "url": "http://127.0.0.1:9090", "scope": "isolated real application scrape; no external notification configured"}
        except Exception:
            time.sleep(0.25)
    fail("Owned Prometheus started but was not ready within ten seconds")


def stop():
    if not STATE.exists():
        return {"status": "not_owned_or_not_running"}
    state = json.loads(STATE.read_text())
    if not owned_process(state):
        return {"status": "recorded_process_is_not_running_or_identity_changed", "stopped": False}
    os.kill(state["pid"], signal.SIGTERM)
    for _ in range(80):
        if not owned_process(state):
            STATE.unlink()
            return {"status": "stopped", "pid": state["pid"]}
        time.sleep(0.1)
    fail("Owned process is still shutting down; no unrelated process was killed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("fetch", "init", "check", "start", "stop", "status", "query", "alerts", "targets"))
    parser.add_argument("--target-port", type=int, default=18081)
    parser.add_argument("--expression", default='up{job="freshmall"}')
    arguments = parser.parse_args()
    if arguments.action == "fetch":
        result = fetch()
    elif arguments.action == "init":
        result = {"credential_file": str(ensure_token()), "configuration_file": str(render(arguments.target_port)), "credential_value": "never printed"}
    elif arguments.action == "check":
        result = check(arguments.target_port)
    elif arguments.action == "start":
        result = start(arguments.target_port)
    elif arguments.action == "stop":
        result = stop()
    elif arguments.action == "status":
        state = json.loads(STATE.read_text()) if STATE.exists() else {}
        result = {"owned_running": owned_process(state), "pid": state.get("pid"), "url": "http://127.0.0.1:9090"}
    else:
        state = json.loads(STATE.read_text()) if STATE.exists() else {}
        if not owned_process(state):
            fail("No matching owned Prometheus process is running")
        if arguments.action == "query":
            if len(arguments.expression) > 4096:
                fail("Query is too long")
            result = request_json("/api/v1/query", {"query": arguments.expression})
        else:
            result = request_json("/api/v1/" + arguments.action)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        # All RuntimeError messages above are fixed strings with no token/path/cause interpolation.
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        # Runtime files can be inspected locally. Never echo an exception containing credential data.
        print("Monitoring command failed safely; inspect the runtime checks/log and reviewed configuration.", file=sys.stderr)
        sys.exit(1)
