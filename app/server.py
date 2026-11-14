#!/usr/bin/env python3
"""Dependency-free, loopback-only static server for the KumashAi web directory."""

import argparse
import json
import os
from pathlib import Path
import stat
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit


WEB_ROOT = Path(__file__).resolve().parent.parent / "web"
ALLOWED_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}


class StudioHandler(BaseHTTPRequestHandler):
    server_version = "KumashAi"
    sys_version = ""

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-store")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; connect-src 'none'; font-src 'self'; "
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; "
            "form-action 'none'",
        )
        super().end_headers()

    def error(self, status, message):
        body = message.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        try:
            # Split before decoding, then reject *any* residual escape sequence.
            # Never normalize dot segments or follow symlinks.
            path = unquote(urlsplit(self.path).path, errors="strict")
        except (ValueError, UnicodeError):
            self.error(400, "Geçersiz yol.")
            return
        if path == "/healthz":
            body = json.dumps({"status": "ok", "app": "KumashAi"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        if path == "/":
            path = "/index.html"
        parts = path.removeprefix("/").split("/")
        if (
            not path.startswith("/")
            or any(not p or p.startswith(".") for p in parts)
            or any(c in path for c in ("\\", "\x00", "%"))
            or any(ord(c) < 32 for c in path)
            or Path(parts[-1]).suffix.lower() not in ALLOWED_TYPES
        ):
            self.error(404, "Dosya bulunamadı.")
            return

        # Open each component relative to an open directory descriptor.
        # O_NOFOLLOW protects against symlinks, including a concurrent swap.
        descriptors = []
        try:
            root_fd = os.open(WEB_ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            descriptors.append(root_fd)
            current_fd = root_fd
            for part in parts[:-1]:
                current_fd = os.open(
                    part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                    dir_fd=current_fd,
                )
                descriptors.append(current_fd)
            fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=current_fd)
            descriptors.append(fd)
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode):
                raise OSError("not a regular file")
            self.send_response(200)
            self.send_header("Content-Type", ALLOWED_TYPES[Path(parts[-1]).suffix.lower()])
            self.send_header("Content-Length", str(info.st_size))
            self.end_headers()
            if self.command != "HEAD":
                with os.fdopen(os.dup(fd), "rb") as source:
                    while chunk := source.read(65536):
                        self.wfile.write(chunk)
        except (OSError, ValueError):
            # No filesystem path or source information is exposed in errors.
            self.error(404, "Dosya bulunamadı.")
        finally:
            for fd in reversed(descriptors):
                os.close(fd)


def main():
    parser = argparse.ArgumentParser(description="KumashAi yerel tekstil stüdyosu")
    parser.add_argument("--port", type=int, default=8795)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port 1–65535 arasında olmalı")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), StudioHandler)
    print(f"KumashAi: http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
