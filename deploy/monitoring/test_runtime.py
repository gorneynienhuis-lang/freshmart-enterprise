"""Safety tests for the local runtime controller; no process, download or database is started."""
import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("monitoring_runtime", ROOT / "scripts" / "monitoring-runtime.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class RuntimeSafetyTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="freshmall-monitoring-test-")
        self.root = Path(self.directory.name).resolve()
        self.base = self.root / ".runtime" / "monitoring"
        values = {"ROOT": self.root, "RUNTIME": self.base, "PRIVATE": self.base / "private", "TOKEN": self.base / "private" / "scrape-token", "STATE": self.base / "private" / "process.json", "INSTALL": self.base / "prometheus-test"}
        self.globals = patch.multiple(runtime, **values)
        self.globals.start()

    def tearDown(self):
        self.globals.stop()
        self.directory.cleanup()

    def test_token_is_private_stable_and_not_in_rendered_config(self):
        file = runtime.ensure_token()
        secret = file.read_text().strip()
        self.assertGreaterEqual(len(secret), 43)
        self.assertEqual(0o600, stat.S_IMODE(file.stat().st_mode))
        self.assertEqual(0o700, stat.S_IMODE(file.parent.stat().st_mode))
        self.assertEqual(secret, runtime.ensure_token().read_text().strip())
        configuration = runtime.render(18081).read_text()
        self.assertNotIn(secret, configuration)
        self.assertIn("credentials_file:", configuration)
        self.assertIn("127.0.0.1:18081", configuration)
        self.assertNotIn("Bearer " + secret, configuration)

    def test_unsafe_permissions_and_symlink_are_rejected(self):
        file = runtime.ensure_token()
        os.chmod(file, 0o644)
        with self.assertRaises(RuntimeError):
            runtime.ensure_token()
        file.unlink()
        target = self.root / "outside-token"
        target.write_text("x" * 64)
        file.symlink_to(target)
        with self.assertRaises(RuntimeError):
            runtime.ensure_token()
        file.unlink()
        (self.base / "private").rmdir()
        (self.base / "private").symlink_to(self.root)
        with self.assertRaises(RuntimeError):
            runtime.ensure_token()

    def test_main_ports_and_untrusted_download_hosts_are_rejected(self):
        for port in (80, 3306, 5173, 8080, 9090, 65536):
            with self.assertRaises(RuntimeError):
                runtime.render(port)
        for url in ("http://github.com/file", "https://evil.example/file", "https://github.com.evil.example/file", "https://user:password@github.com/file"):
            with self.assertRaises(RuntimeError):
                runtime.check_official_url(url)
        runtime.check_official_url("https://github.com/prometheus/prometheus/releases/download/v3.15.0/sha256sums.txt")

    def test_stop_never_signals_a_reused_or_unrelated_pid(self):
        runtime.private_directory(runtime.PRIVATE)
        state = {"pid": 12345, "binary": str(runtime.INSTALL / "prometheus"), "started": "old-start", "command_sha256": "old-command", "executable": str(runtime.INSTALL / "prometheus")}
        runtime.private_write(runtime.STATE, json.dumps(state))
        actual = dict(state, started="different-start", command_sha256="different-command")
        with patch.object(runtime, "process_fingerprint", return_value=actual), patch.object(runtime.os, "kill") as kill:
            self.assertFalse(runtime.owned_process(state))
            self.assertFalse(runtime.stop()["stopped"])
            kill.assert_not_called()


if __name__ == "__main__":
    unittest.main()
