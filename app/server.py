#!/usr/bin/env python3
"""Dependency-free, loopback-only static server for the KumashAi web directory."""

import argparse
import json
import os
import re
from pathlib import Path
import stat
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit


WEB_ROOT = Path(__file__).resolve().parent.parent / "web"
# POSIX: descriptor-relative opens. Windows: portable checks (see _open_portable).
DIR_FD_OPEN = (os.open in os.supports_dir_fd and hasattr(os, "O_NOFOLLOW")
               and hasattr(os, "O_DIRECTORY") and hasattr(os, "O_NONBLOCK"))
PORTABLE_PART = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.-]*\Z")
WINDOWS_DEVICES = {"con", "prn", "aux", "nul",
                   *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
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

        try:
            source, size = open_web_file(parts)
        except (OSError, ValueError):
            # No filesystem path or source information is exposed in errors.
            self.error(404, "Dosya bulunamadı.")
            return
        with source:
            self.send_response(200)
            self.send_header("Content-Type", ALLOWED_TYPES[Path(parts[-1]).suffix.lower()])
            self.send_header("Content-Length", str(size))
            self.end_headers()
            if self.command != "HEAD":
                try:
                    while chunk := source.read(65536):
                        self.wfile.write(chunk)
                except OSError:
                    pass  # client went away mid-response


def open_web_file(parts):
    """Return (binary file, size) for a regular file strictly inside WEB_ROOT."""
    if DIR_FD_OPEN:
        return _open_with_dir_fd(parts)
    return _open_portable(parts)


def _open_with_dir_fd(parts):
    # Open each component relative to an open directory descriptor.
    # O_NOFOLLOW protects against symlinks, including a concurrent swap.
    descriptors = []
    try:
        current_fd = os.open(WEB_ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        descriptors.append(current_fd)
        for part in parts[:-1]:
            current_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=current_fd)
            descriptors.append(current_fd)
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=current_fd)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode):
                raise OSError("not a regular file")
            return os.fdopen(fd, "rb"), info.st_size
        except BaseException:
            os.close(fd)
            raise
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def _open_portable(parts):
    # Windows has no dir_fd / O_NOFOLLOW. Accept only plain names, refuse links
    # on the way, then require the fully resolved file to stay inside WEB_ROOT.
    for part in parts:
        if (not PORTABLE_PART.match(part) or part.endswith(".")
                or part.split(".")[0].lower() in WINDOWS_DEVICES):
            raise ValueError("unsupported name")
    current = WEB_ROOT
    for part in parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("link refused")
    root = WEB_ROOT.resolve(strict=True)
    resolved = current.resolve(strict=True)
    if root not in resolved.parents or not resolved.is_file():
        raise ValueError("outside web root")
    source = open(resolved, "rb")
    return source, os.fstat(source.fileno()).st_size


def main():
    parser = argparse.ArgumentParser(description="KumashAi yerel tekstil stüdyosu")
    parser.add_argument("--port", type=int, default=8795)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port 1–65535 arasında olmalı")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), StudioHandler)
    except OSError:
        # Most likely already running (second double-click). ASCII only: Windows consoles.
        print(f"Port {args.port} kullanimda; KumashAi zaten calisiyor olabilir: http://127.0.0.1:{args.port}", flush=True)
        return
    print(f"KumashAi: http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
