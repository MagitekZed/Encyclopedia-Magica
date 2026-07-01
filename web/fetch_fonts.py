#!/usr/bin/env python3
"""Fetch OFL magical fonts from Google Fonts and base64-embed them into web/fonts.css.

Embedding (data: URIs) keeps the single-file build fully offline.  All fonts are
SIL Open Font License (embeddable).  If the network is unavailable the app falls
back to a system serif stack, so this is best-effort.
"""

from __future__ import annotations

import base64
import pathlib
import re
import sys
import urllib.request

WEB = pathlib.Path(__file__).resolve().parent
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

FAMILIES = [
    ("Cinzel Decorative", "family=Cinzel+Decorative:wght@700;900"),
    ("Cinzel", "family=Cinzel:wght@500;600;700"),
    ("EB Garamond", "family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400"),
]
KEEP_SUBSETS = {"latin"}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=25).read()


def main() -> int:
    faces = []
    for name, query in FAMILIES:
        css = fetch(f"https://fonts.googleapis.com/css2?{query}&display=swap").decode("utf-8")
        blocks = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{[^}]*\})", css)
        for subset, block in blocks:
            if subset not in KEEP_SUBSETS:
                continue
            m = re.search(r"url\((https://[^)]+\.woff2)\)", block)
            if not m:
                continue
            b64 = base64.b64encode(fetch(m.group(1))).decode()
            block = re.sub(r"src:\s*url\(https://[^)]+\.woff2\)\s*format\('woff2'\)",
                           f"src: url(data:font/woff2;base64,{b64}) format('woff2')", block)
            block = re.sub(r"\s*unicode-range:[^;]+;", "", block)   # apply broadly
            faces.append(block.strip())
        print(f"  {name}: embedded {sum(1 for s,_ in blocks if s in KEEP_SUBSETS)} face(s)")
    if not faces:
        print("no faces embedded", file=sys.stderr)
        return 1
    (WEB / "fonts.css").write_text(
        "/* Embedded OFL fonts (Cinzel, Cinzel Decorative, EB Garamond) */\n"
        + "\n".join(faces) + "\n", encoding="utf-8")
    total = (WEB / "fonts.css").stat().st_size
    print(f"wrote web/fonts.css: {total:,} bytes, {len(faces)} faces")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:                                  # noqa: BLE001
        print(f"font fetch failed ({exc}); app will use system serif fallback", file=sys.stderr)
        raise SystemExit(1)
