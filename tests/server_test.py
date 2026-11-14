"""Loopback HTTP boundary tests. No external network or third-party packages."""

import http.client
import importlib.util
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("kumash_server", ROOT / "app" / "server.py")
server_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(server_module)


class ServerBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="kumash-http-test-")
        cls.base = Path(cls.temp.name)
        cls.web = cls.base / "web"
        cls.web.mkdir()
        (cls.web / "index.html").write_text("<h1>KumashAi</h1>", encoding="utf-8")
        (cls.web / "app.js").write_text("export const ready = true;", encoding="utf-8")
        (cls.web / ".env").write_text("PRIVATE=not-served", encoding="utf-8")
        (cls.web / "nested").mkdir()
        (cls.base / "secret.html").write_text("PRIVATE", encoding="utf-8")
        (cls.web / "leak.html").symlink_to(cls.base / "secret.html")
        (cls.web / "linked").symlink_to(cls.base, target_is_directory=True)
        cls.old_root = server_module.WEB_ROOT
        server_module.WEB_ROOT = cls.web

        class QuietHandler(server_module.StudioHandler):
            def log_message(self, *_args):
                pass

        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)
        server_module.WEB_ROOT = cls.old_root
        cls.temp.cleanup()

    def request(self, path, method="GET"):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        try:
            conn.request(method, path)
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def test_index_and_security_headers(self):
        status, headers, body = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn(b"KumashAi", body)
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(headers["X-Frame-Options"], "DENY")
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIn("connect-src 'none'", headers["Content-Security-Policy"])

    def test_javascript_module_mime(self):
        status, headers, body = self.request("/app.js")
        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/javascript"))
        self.assertIn(b"export const", body)

    def test_head_has_no_body(self):
        status, headers, body = self.request("/", "HEAD")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"")
        self.assertGreater(int(headers["Content-Length"]), 0)

    def test_health_check(self):
        status, _, body = self.request("/healthz")
        self.assertEqual(status, 200)
        self.assertIn(b'"status": "ok"', body)

    def test_directory_and_hidden_files_rejected(self):
        for path in ["/nested/", "/.env", "/.git/config", "/.hidden/index.html"]:
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual(status, 404)
                self.assertNotIn(b"PRIVATE", body)

    def test_traversal_and_source_rejected(self):
        paths = [
            "/../secret.html",
            "/%2e%2e/secret.html",
            "/%252e%252e/secret.html",
            "/%2e%2e%2fsecret.html",
            "/..%5csecret.html",
            "/index.html%00",
            "/app/server.py",
            "/README.md",
        ]
        for path in paths:
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertIn(status, (400, 404))
                self.assertNotIn(b"PRIVATE", body)
                self.assertNotIn(str(self.base).encode(), body)

    def test_file_and_directory_symlinks_rejected(self):
        for path in ["/leak.html", "/linked/secret.html"]:
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual(status, 404)
                self.assertNotIn(b"PRIVATE", body)

    def test_unknown_and_missing_files_rejected(self):
        for path in ["/missing.html", "/assets.json", "/database.sqlite"]:
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
