# Encyclopedia Magica Roller — Web ("Astral Observatory")

A single-page, **zero-dependency** magical dice-roller + table browser for the AD&D 2e
*Encyclopedia Magica* magic-item & artifact dataset. Deep-space jewel UI, an animated
starfield, an igniting **constellation trace tree**, synthesized WebAudio, and a persisted
Grimoire. Same data and the same roll mechanics as the desktop app — the engine is a faithful
JS port that passes the same 44 tests.

## Run

- **Single file (recommended):** open **`dist/magica_roller.html`** in any modern browser.
  Double-click it — it works completely offline (`file://`), no server, no install. ~1.6 MB,
  everything (data, fonts, code) inlined.
- **Dev / unbundled:** `python3 web/serve.py` → opens <http://127.0.0.1:8777>.

## Build & test

```bash
python3 web/build_data.py    # regenerate web/data.js from the same app/*.json
python3 web/fetch_fonts.py   # (re)embed OFL fonts into web/fonts.css   (needs network)
python3 web/build.py         # bundle everything -> dist/magica_roller.html
node    web/tests/run.js     # engine self-test — mirrors the 44 Python unit tests
```

The in-app **⚙ Diagnostics** panel runs the same self-test in the browser.

## Features

Roll any single table (A–T, Full Armor (R) / Full Weapon (S), R/S parts, artifact powers 1-00…1-24)
· fully random item (master → category → item, R/S multi-part, reroll/Enchanted-Enhancements cascade
capped at 3) · artifact powers (random or chosen) · generate an N-power artifact (random **or** choose
the table per slot) · searchable, **virtualized** Library (5,709 rows) · the expandable trace tree
· seedable/replayable RNG with reroll/replay · **seed permalink** (`#s=…`) · persisted, pinnable
**Grimoire** (localStorage) with per-roll seed **sigils** · copy/export · treasure hoards · command
palette (`⌘/Ctrl+K`) · keyboard shortcuts · synthesized sound (off by default) · reduced-motion &
`backdrop-filter` fallbacks · natural-max supernova + cursed cosmic events.

**Mobile-friendly & responsive** (verified down to 320 px): the header consolidates into a `⋯` sheet,
the trace tree reflows to two lines per node, the Grimoire becomes a drawer with a scrim, dialogs
become bottom-sheets with a ✕ close, touch targets are ≥44 px, inputs are 16 px (no iOS focus-zoom),
and safe-area insets + momentum scroll + lighter mobile-GPU blurs are applied.

**Keyboard:** `R`/`Space` roll · `Ctrl+R` reroll · `Ctrl+Z` previous · `1–4` tabs · `Ctrl+F` search
· `Ctrl+H` grimoire · `Ctrl+K` palette · `Esc` clear/close.

## Architecture

```
web/
├── index.html            shell (loads the modules below in order)
├── data.js               window.EM_DATA — the same app/*.json, bundled
├── fonts.css             base64 Cinzel / Cinzel Decorative / EB Garamond (offline)
├── css/theme.css         the Astral Observatory design system
├── js/                   ENGINE (runs in browser AND Node): ranges, rng, format, dataset, engine, selftest
├── ui/                   PRESENTATION: sky, audio, widgets, result, history, library, tabs, controller, app
├── build.py / build_data.py / fetch_fonts.py / serve.py
└── tests/run.js          Node runner for the shared self-test
```

Strict one-way dependency `ui → engine (js/) → data`, mirroring the desktop app. The engine imports
zero DOM, so `web/js/*` runs unchanged under Node for CI. Design spec: [`DESIGN.md`](DESIGN.md).
