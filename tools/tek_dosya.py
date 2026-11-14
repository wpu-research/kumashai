#!/usr/bin/env python3
"""web/ klasörünü tek bir HTML dosyasına toplar: dist/KumashAi.html

Bu dosya çift tıklanarak (file://) açılır; Python, sunucu veya internet gerekmez.
Her modül kendi kapsamında (IIFE) kalır; import/export satırları dönüştürülür.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
ORDER = ["design", "render", "atolye", "recolor", "figur", "app"]  # bağımlılık sırası
IMPORT = re.compile(r"^import\s*\{([^}]*)\}\s*from\s*'\./(\w+)\.js';[ \t]*\n", re.MULTILINE)
EXPORT = re.compile(r"^export\s+((?:async\s+)?function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)", re.MULTILINE)


def bundle_module(name):
    source = (WEB / f"{name}.js").read_text(encoding="utf-8")

    def to_const(match):
        names = [part.strip() for part in match.group(1).split(",") if part.strip()]
        fields = ", ".join(n.replace(" as ", ": ") for n in names)
        return f"const {{ {fields} }} = __{match.group(2)};\n"

    source = IMPORT.sub(to_const, source)
    exported = [m.group(2) for m in EXPORT.finditer(source)]
    source = EXPORT.sub(lambda m: f"{m.group(1)} {m.group(2)}", source)
    leftovers = [line for line in source.splitlines() if re.match(r"\s*(import|export)\b", line)]
    if leftovers or "</script" in source:
        sys.exit(f"{name}.js: dönüştürülemeyen satır: {leftovers[:1] or '</script'}")
    return (f"/* ---- {name}.js ---- */\nconst __{name} = (() => {{\n'use strict';\n{source}\n"
            f"return {{ {', '.join(exported)} }};\n}})();\n")


def build():
    html = (WEB / "index.html").read_text(encoding="utf-8")
    css = (WEB / "styles.css").read_text(encoding="utf-8")
    script = "\n".join(bundle_module(name) for name in ORDER)
    replacements = [
        ('  <link rel="stylesheet" href="/styles.css">\n', f"  <style>\n{css}\n  </style>\n"),
        ('  <script type="module" src="/app.js"></script>\n', ""),
        ('<a class="brand" href="/"', '<a class="brand" href="#"'),
        ("</body>", f"<script>\n{script}</script>\n</body>"),
    ]
    for old, new in replacements:
        if html.count(old) != 1:
            sys.exit(f"index.html içinde beklenen parça bulunamadı: {old.strip()[:50]}")
        html = html.replace(old, new)
    out = ROOT / "dist" / "KumashAi.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out


if __name__ == "__main__":
    path = build()
    print(f"{path} ({path.stat().st_size // 1024} KB)")
