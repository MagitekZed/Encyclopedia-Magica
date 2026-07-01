#!/usr/bin/env python3
"""Bundle the SAME app/*.json into web/data.js as a single JS global.

The web app reuses the exact dataset the desktop app uses — this just packs the
five source files into one `window.EM_DATA` object so the SPA needs no fetch()
(works from file://).  The JS dataset layer parses ranges identically to the
Python loader, so the data stays raw here (single source of truth).
"""

from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "app"
WEB = ROOT / "web"
WEB.mkdir(exist_ok=True)


def load(rel: str):
    with open(APP / rel, encoding="utf-8") as fh:
        return json.load(fh)


def main() -> None:
    data = {
        "items": load("all_items.json"),
        "master": load("table_1_master.json"),
        "mech": load("mechanics_type_bonus.json"),
        "powerTables": load("artifact_tables/artifact_power_tables.json")["power_tables"],
        "enhancement": load("artifact_tables/enchanted_enhancement.json"),
    }
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    out = "window.EM_DATA = " + payload + ";\n"
    (WEB / "data.js").write_text(out, encoding="utf-8")
    print(f"wrote web/data.js: {len(out):,} bytes | "
          f"items={len(data['items'])} master={len(data['master'])} "
          f"powerTables={len(data['powerTables'])} enh={len(data['enhancement']['entries'])}")


if __name__ == "__main__":
    main()
