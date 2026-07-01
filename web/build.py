#!/usr/bin/env python3
"""Bundle web/ into ONE self-contained magica_roller.html (openable via file://).

Inlines every <link rel=stylesheet> and <script src> referenced by index.html
(fonts.css, css/theme.css, data.js, js/*.js, ui/*.js) into a single file. The
bundled data JS is escaped so any stray '</script' in the data can't break the
inline script tag.
"""

from __future__ import annotations

import pathlib
import re

WEB = pathlib.Path(__file__).resolve().parent
DIST = WEB.parent / "dist"
DIST.mkdir(exist_ok=True)


def _read(rel: str) -> str:
    return (WEB / rel).read_text(encoding="utf-8")


def _inline_css(m):
    href = m.group(1)
    return f"<style>\n/* ==== {href} ==== */\n{_read(href)}\n</style>"


def _inline_js(m):
    src = m.group(1)
    code = _read(src).replace("</script", "<\\/script")   # keep the inline tag safe
    return f"<script>\n/* ==== {src} ==== */\n{code}\n</script>"


def main() -> None:
    html = _read("index.html")
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', _inline_css, html)
    html = re.sub(r'<script src="([^"]+)"></script>', _inline_js, html)
    out = DIST / "magica_roller.html"
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out}  ({out.stat().st_size:,} bytes)")
    # sanity: no leftover external references (data: URIs and in-page #anchors are fine)
    leftover = re.findall(r'(?:src|href)="(?!data:|#)([^"]+)"', html)
    if leftover:
        print("WARNING leftover external refs:", leftover)
    else:
        print("fully self-contained (no external src/href).")


if __name__ == "__main__":
    main()
