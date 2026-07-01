# Encyclopedia Magica

A dice-roller and searchable table browser for the AD&D 2e **Encyclopedia Magica** magic-item &
artifact random-determination tables — digitized into a clean dataset and wrapped in two apps that
share one proven roll engine.

- 🌐 **Web app (live):** https://magitekzed.github.io/Encyclopedia-Magica/ — a slick, magical
  single-page app. Zero install, works offline, mobile-friendly.
- 🖥️ **Desktop app:** a Python/Tkinter version (stdlib only).

Both roll the exact same **5,709 items** across Tables A–T, the R/S armor/weapon multi-part
assemblies, the reroll / "Enchanted Enhancements" cascade, and all 25 artifact power tables — and
both render the signature **"explain this roll" trace tree**.

---

## Quick start

### Web (recommended)
- **Live:** open the Pages link above.
- **Single file:** `python3 web/build.py` → open `dist/magica_roller.html` (one self-contained
  file, opens by double-click, fully offline).
- **Dev server:** `python3 web/serve.py` → http://127.0.0.1:8777

### Desktop (Python / Tkinter)
```bash
python3 desktop/roller.py            # launch the app
python3 desktop/roller.py --verify   # data self-test report
```
> **macOS:** use a modern Python with **Tk ≥ 8.6** — the system `/usr/bin/python3` ships Tk 8.5,
> which renders blank windows. Install once with `brew install python-tk` (Python 3.14 + Tk 9.0),
> then run `/opt/homebrew/bin/python3.14 desktop/roller.py`, or just double-click
> `desktop/run.command` (it auto-selects a working Python).

---

## What's in here

```
Encyclopedia-Magica/
├── app/          Shared dataset + design docs (the single source of truth)
│   ├── all_items.json            5,709 items (table, roll range, name, reroll, page)
│   ├── table_1_master.json       d100 master → category → sub-table
│   ├── mechanics_type_bonus.json R/S armor & weapon type + bonus sub-tables
│   ├── artifact_tables/          25 power tables + the Enchanted-Enhancement selector
│   ├── tables/                   the 20 item tables (A–T), one .json + .csv each
│   ├── ROLLER_DESIGN.md / BUILD_HANDOFF.md / DATA_README.md
│   └── ITEMS_TO_FIND.csv · PAGE_CORRECTIONS_applied.csv
├── web/          The single-page web app (deployed to Pages)
│   ├── index.html · css/ · js/ (engine, runs in browser AND Node) · ui/ (presentation)
│   ├── data.js · fonts.css       generated, required-to-run assets
│   └── build.py · build_data.py · fetch_fonts.py · serve.py · tests/run.js · DESIGN.md
├── desktop/      The Python / Tkinter app
│   ├── roller.py · enc_roller/ (data → engine → ui) · tests/ · run.command · run.bat · build.py
└── .github/workflows/pages.yml   deploys web/ to GitHub Pages
```

The **engine is identical in spirit across both** (`desktop/enc_roller/engine` ↔ `web/js`) and each
is covered by the same suite of tests.

## Tests

```bash
# desktop (Python, stdlib unittest)
cd desktop && python3 -m unittest discover -s tests      # 44 tests

# web engine (Node — mirrors the same 44 checks)
node web/tests/run.js
```

## Data

Rolls are 100% validated (every table tiles its die with no gaps/overlaps, bar the one faithful
source omission at artifact table 1-16 roll 37). Page numbers are cross-referenced against the
book's own index; corrections are logged in
[`app/PAGE_CORRECTIONS_applied.csv`](app/PAGE_CORRECTIONS_applied.csv). Ten items are genuinely
un-indexed (see `app/ITEMS_TO_FIND.csv`).

## Attribution

This is a fan-made reference tool. *Encyclopedia Magica* and *Advanced Dungeons & Dragons* are the
property of Wizards of the Coast / TSR; this project is **not affiliated with or endorsed by** them.
The original book scans are **not** included in this repository.
