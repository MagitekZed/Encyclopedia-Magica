# Encyclopedia Magica Roller — Final Design Spec

A cross-platform Python **desktop** application (explicitly **not** a web app) that is a dice-roller plus table browser for the digitized AD&D 2e *Encyclopedia Magica* magic-item & artifact dataset. This is a **build-ready design**, not code. A developer should be able to implement directly from it.

---

## ⚑ LOCKED DECISIONS (v1) — these override anything below

1. **Framework: Tkinter + `ttk` (stdlib, zero deps).** Run with `python roller.py`.
2. **Item pages: DISPLAY the page number only** (e.g. `p.442`) as a reference; `null`/`not_in_index` → show "not in index". **Do NOT build the open-PDF-at-page / search-PDF feature** — the page numbers point to main-Encyclopedia *content* pages that are **not** among the available PDFs (we only have the index/tables/artifact excerpts). The optional "report bad page → append to `ITEMS_TO_FIND.csv`" is fine to keep. (This supersedes the "Read-the-rules path" in §(e)/§(g)#5.)
3. **Scope: everything** — all 6 features + artifact generator (random **or** user-chosen table per power) + all the extras (seedable/replayable RNG, persisted roll history, copy/export, treasure-hoard batch, keyboard shortcuts, and the expandable "explain this roll" trace tree).
4. **Asterisk/reroll mechanic: the two-mechanic reading (as specified in §c).** The 19 items literally named "Enchanted Enhancements" → roll d100 on the enhancement selector (which chains if the type is `reroll`); the other 56 asterisk items → roll again on the SAME table and combine. **One shared cap = 3** executed rerolls across the whole cascade.
5. **All source-data caveats are FIXED** except artifact table `1-16`'s faithful gap at roll 37 (source omission) — the engine re-rolls that slot per §(f). Master tiles 1–100; R1/S1 tile 1–1000; 1-15 overlap resolved.

---

## 0. Ground-truth data facts (re-verified against the bytes in `app/`)

Every fact below was checked by running a parser over the real files. Bugs in earlier drafts (fabricated regex strings, phantom gaps, unguarded `find`) are corrected here.

- **`all_items.json`** — 5,709 items. Each: `{table, category, subcategory, roll_display, roll_low, roll_high, name, reroll, page, page_status}`. Tables present: `A–Q, R3, S3, T`. 75 items have `reroll=true`; 19 are literally named "Enchanted Enhancements". Item tables are d1000 (ranges tile 1..1000).
- **`table_1_master.json`** — a **flat list of 19 rows**. Each row: `{roll_low, roll_high, name, target, roll, ...}`. **FIXED against the source page:** the last row is `roll="78-00"` = **78–100 → Weapons (S)**; `roll_high` corrected from 78 to **100**. The master now **tiles d100 1–100 completely (no gap, no overlap)** — verified. Targets: `A–Q, R, S`. (The `MASTER_TRUST_PRINTED_RANGE` discussion below is therefore moot for real data; the gap path is now a pure defensive fallback that should never fire.)
- **`mechanics_type_bonus.json`** — a **dict** with keys `R1, R2, S1, S2`.
  - `R1`/`S1` = item **TYPE**. Their `roll_low/roll_high` are **mangled (=1)**; the authoritative range is the `roll` string (`"001-491"`, `"98-100"`, `"975-000"`). **These are d1000 tables** — this must be *pinned*, never inferred (S1's first row `"01-97"` looks like d100 but the table is d1000).
  - **R1 does NOT fully tile**: there is a real **gap at roll 576** (Caparison ends 575, Shield starts 577). This is confirmed data, not hypothetical.
  - `R1`/`S1` each have a `Special (Roll on Table R3/S3)` catch-all entry at the top of the range.
  - `R2`/`S2` = magic **BONUS**, d20, `roll_low/roll_high` reliable.
    - **R2 `name` format:** `"AC Adj +1 / XP Value +500 / GP Value +5,000"` (includes a `-1` cursed row: `"AC Adj -1 / XP Value +0 / GP Value +0"`).
    - **S2 `name` format:** bare `"-1"`, `"+1"`, … `"+5"`. **Different format from R2.** One regex cannot serve both.
- **`artifact_power_tables.json`** — `{power_tables: [...]}`. Each table keyed by **`num`** (`"1-00".."1-24"`), fields `category`, `die` ∈ {20, 100, 10}, `entries[].roll` (bare string, e.g. `"1"`, `"1-3"`, `"91-00"`). **Holes confirmed:** table `1-16` (d100) has **no entry for roll 37**; table `1-15` (d100) has a **backwards/overlapping range around 62–64**. `find` can legitimately return `None` on these.
- **`enchanted_enhancement.json`** — keys `entries, die (=100), descriptions, desc, descriptions_note`. Each entry: `{roll, type, reroll}`. **9 of 10** types have `reroll=true`. Loader must tolerate the extra `desc`/`descriptions_note` keys.

---

## (a) Framework, dependencies, packaging

### Recommendation: **Tkinter + `ttk` (Python standard library). Zero third-party runtime dependencies.**

Rationale (resolving the PySide6-vs-Tkinter question in favor of Tkinter):

1. **The user "always builds web apps and wants to try something different."** The thing that kills a hobby tool-change is setup friction. Tkinter runs with `python roller.py` on any stock CPython — no `pip`, no venv, no ~100 MB Qt download, no build step required to *try* it. That zero-friction first run beats nicer table theming for a single-user DM tool.
2. **The two "hard" widgets are not hard at this scale.** 5,709 rows is small. `ttk.Treeview` handles it; the only real UX need — live substring filter — is a debounced list-comprehension refill, not a model/view stack. The cascade chain renders cleanly in a `ttk.Treeview` in tree mode.
3. **The architecture makes the framework a thin, swappable skin.** The engine and data layers import **zero** GUI code, so a later swap to PySide6 is contained. We lose nothing by starting on Tkinter.

**Python:** target **3.10+**. Stdlib only: `json, random, re, csv, pathlib, dataclasses, tkinter, bisect, webbrowser, subprocess, sys, os, typing, datetime`.

### Packaging — three tiers, easiest first

1. **Run it:** `python roller.py` from the repo. Works on any Windows/macOS with stock Python. **This is the primary path and avoids all binary-signing friction.**
2. **Double-click launchers:** ship `run.command` (macOS, `chmod +x`) and `run.bat` (Windows) that invoke `python3 roller.py`.
3. **Standalone binary (optional, documented):** via `build.py`, which constructs the PyInstaller command **per-OS** using `os.pathsep` for `--add-data`:
   - macOS/Linux: `--add-data "app:app"`
   - Windows: `--add-data "app;app"`
   - **Default to `--onedir`** (fast cold start, simple data bundling); document `--onefile` as the "single portable exe" tradeoff (slower launch, unpacks to temp).
   - `--windowed` to suppress the console.
   - Data resolved via `resource_path()` checking `sys._MEIPASS` (PyInstaller) then the source tree.
   - **macOS Gatekeeper:** an unsigned `.app` triggers "developer cannot be verified." Document the right-click → Open workaround and `xattr -dr com.apple.quarantine <App>`. Steer non-developer users to Tier 1/2, which avoid Gatekeeper entirely.

> **Decisions note:** PySide6's `QAbstractTableModel`/`QTextBrowser` advantages are real but are "nice-to-have polish," not worth a dependency + build step for this app given the user's stated "easy to run / try something different" constraint. The design keeps the PySide6 swap cheap.

---

## (b) Architecture — three hard-separated layers

Dependency direction is strictly one-way: **`ui → engine → data → stdlib`.** The engine never imports `tkinter`; the data layer never imports the engine or tkinter. This makes the engine headless-unit-testable and the GUI swappable.

```
roller.py                      # entry point: resolve app/, build Dataset → RollEngine → App(Tk root)
enc_roller/
├── __init__.py
├── data/
│   ├── models.py              # dataclasses: Item, MasterRow, MechRow, PowerTable, PowerEntry, EnhRow
│   ├── ranges.py              # parse_range(), contains() — the ONLY roll-string decoder
│   ├── loader.py              # read app/*.json → typed models; fix R1/S1; tolerate extra keys
│   └── dataset.py             # Dataset: indexed sorted lookups (bisect); search index; data_warnings
├── engine/
│   ├── dice.py                # Roller protocol; DefaultRoller(seed); FixedRoller(scripted, tests)
│   ├── results.py             # RollStep (trace-tree node) + RollResult value objects
│   ├── config.py              # REROLL_CAP=3, MAX_POWERS_SOFT=20, MASTER_TRUST_PRINTED_RANGE
│   └── engine.py              # RollEngine: every mechanic; pure; stdlib only
├── ui/
│   ├── app.py                 # main window, ttk.Notebook, header (seed/random/diagnostics), History
│   ├── tab_random.py          # Feature 2 + 5  (DEFAULT/opening tab)
│   ├── tab_single.py          # Feature 1
│   ├── tab_artifact.py        # Features 3 + 4
│   ├── tab_library.py         # Feature 6
│   ├── result_view.py         # renders a RollStep tree (ttk.Treeview) + headline; back-stack
│   ├── history_panel.py       # roll log sidebar (persisted, pinnable, grouped batches)
│   └── widgets.py             # DieBadge, TableCombo, PageLink, validated Spinbox helpers
app/                           # existing JSON dataset (unchanged, bundled read-only)
tests/
└── test_*.py                  # pytest + FixedRoller; ZERO tkinter imported
```

**Core architectural decision: the engine returns a trace *tree*, not a string.** Every mechanic produces a `RollResult` whose `.root` is a `RollStep` tree (table, die, number rolled, matched entry, page, `children` for cascade/multi-part). The GUI renders that tree. Combine/cascade/multi-part logic lives in exactly one place, is unit-tested against the tree, and "explain this roll" is free because **the trace *is* the explanation.**

---

## Data layer

### `ranges.py` — the single source of roll-string correctness

All quirks (`000`=1000, `953-000`, `91-00`, `78-00`, bare `1`) collapse into two tested functions.

```python
def parse_range(s: str, die: int) -> tuple[int, int]:
    """Decode a printed roll string against a known die.
       Rules:
         - split on '-' into (lo, hi); a bare '5' -> (5, 5).
         - a trailing ALL-ZEROS token ('0','00','000') maps to the die max.
       Examples (die given explicitly, NEVER inferred from the string):
         parse_range('001-000', 1000) -> (1, 1000)
         parse_range('953-000', 1000) -> (953, 1000)
         parse_range('98-100',  1000) -> (98, 100)     # S1 row, die pinned 1000
         parse_range('91-00',   100)  -> (91, 100)
         parse_range('78-00',   100)  -> (78, 100)
         parse_range('1',       20)   -> (1, 1)
    """

def contains(low: int, high: int, roll: int) -> bool:
    return low <= roll <= high
```

Unit tests pin every boundary **for every die used** (1000, 100, 20, 10), including max-encoding at each die (`"00"`→100, `"0"`→10/20, `"000"`→1000) and the backwards-range guard (if `hi < lo`, `loader` normalizes/flags — see below).

### `loader.py` — the ONLY place that touches raw JSON or knows about quirks

1. `all_items.json` → `list[Item]`, grouped `dict[str, list[Item]]` by table, each sorted by `roll_low`.
2. **Master** → `list[MasterRow]` sorted. If `MASTER_TRUST_PRINTED_RANGE` (see config default below), re-parse the `78-00` row's high via `parse_range(row.roll, 100)` → `(78, 100)`, so 78–100 route to Weapons. Assert master rows tile 1..100 → log gaps/overlaps to `data_warnings`.
3. **`mechanics_type_bonus.json`:**
   - **R1/S1: pin `die=1000` explicitly** (never infer). Derive `(low, high)` from `parse_range(row.roll, 1000)`.
   - **R2/S2: pin `die=20`**, trust `roll_low/roll_high`.
   - Record the R1/S1 catch-all entry (name matches `/roll on .*table\s*[RS]3/i`) with a flag `is_r3_catchall=True` on the `MechRow` — used by assembly (see Alg 3).
   - Assert R1/S1 tile 1..1000; **the R1 gap at 576 WILL fire** — record it in `data_warnings` (never `assert`/abort). Build a "nearest range" fallback map for runtime gap resolution.
4. **Power tables** keyed by `num`; each entry's `(low, high)` from `parse_range(roll, die)`. **If `hi < lo` (the 1-15 backwards range), swap and log a warning.** Assert each table tiles 1..die; log the 1-16 hole at 37 to `data_warnings`.
5. **Enhancement** rows likewise (`die=100`); ignore extra `desc`/`descriptions_note` keys.
6. Build a lowercased combined search index (`name + category + table + subcategory + str(page)`) for the library.
7. **Every file read is wrapped in try/except**; a failed file is reported (with resolved path) in a startup Diagnostics dialog, and the app runs with whatever loaded.

### `dataset.py`

```python
class Dataset:
    items_by_table: dict[str, list[Item]]    # 'A'..'Q','R3','S3','T'
    master_rows:    list[MasterRow]
    mech:           dict[str, list[MechRow]]  # 'R1','R2','S1','S2'
    power_by_num:   dict[str, PowerTable]     # '1-00'..'1-24'
    enhancement:    list[EnhRow]
    _warnings:      list[str]

    def find(self, rows, roll: int):          # generic bisect over sorted (low,high) ranges
        ...                                   # returns matched row or None
    def find_nearest(self, rows, roll: int):  # for R1/S1 runtime gap: nearest range + a note
        ...
    def search(self, tokens: list[str]) -> list[Item]:  # AND of tokens over the index
        ...
    def data_warnings(self) -> list[str]:
        return self._warnings
```

All range lookups go through `find` / `find_nearest` — no view or engine site re-implements matching.

---

## (c) Roll engine — algorithms + API

### `config.py`

```python
REROLL_CAP = 3                       # max COMBINED rerolls beyond the base item (DM guideline)
MAX_POWERS_SOFT = 20                 # soft cap; above this, warn but allow
MASTER_TRUST_PRINTED_RANGE = False   # DEFAULT False — see decision note below
POWER_RANDOM_POOL = None             # None = all power tables; UI may override to exclude meta tables
```

> **RESOLVED by source check:** the master data was fixed at source — `78-00 → Weapons` is now stored as `78–100`, and the master tiles d100 1–100 with no gap. So the `MASTER_TRUST_PRINTED_RANGE` flag/banner is no longer needed for correctness; the master `_match_or_gap` path is retained only as a defensive fallback (should never fire on the shipped data). The flag can be dropped or left as a harmless safety net.

### `dice.py` — the determinism seam

```python
class Roller(Protocol):
    def roll(self, die: int) -> int: ...        # 1..die inclusive
    @property
    def seed(self) -> int | None: ...

class DefaultRoller:
    def __init__(self, seed: int | None = None):
        self._seed = seed if seed is not None else random.randrange(2**31)
        self._r = random.Random(self._seed)
    def roll(self, die): return self._r.randint(1, die)
    @property
    def seed(self): return self._seed

class FixedRoller:                              # tests: scripted queue of results
    def __init__(self, values): self._q = list(values); self._seed = None
    def roll(self, die): return self._q.pop(0)
    @property
    def seed(self): return None
```

**Seed semantics (resolving Review 3/#2):** a locked seed means "the RNG is a `random.Random(seed)` **sequence**; each roll advances it, producing a *reproducible sequence*, not a frozen single value." The UI shows `seed 4127 · roll #N`. **Reroll (new seed)** = new `DefaultRoller()`. **Replay (same seed)** = fresh `DefaultRoller(seed)` re-run from the start of the sequence.

### `results.py` — trace tree

```python
@dataclass
class RollStep:
    table: str                 # "A","R1","master","enh","power:1-15","armor","weapon","artifact"
    die: int                   # 1000/100/20/10; 0 for synthetic assembly nodes
    rolled: int                # 0 for synthetic nodes
    label: str                 # matched entry / item name / power text
    page: int | None
    page_status: str           # "filled" | "not_in_index" | "n/a"
    children: list["RollStep"] = field(default_factory=list)
    kind: str = "roll"         # "roll" | "assembly" | "cap" | "gap" | "reroll" | "enhancement"
    note: str | None = None    # human-readable annotation

@dataclass
class RollResult:
    kind: str                  # "single"|"random_item"|"artifact_power"|"artifact"|"hoard"
    headline: str
    root: RollStep
    seed: int | None
```

Display conventions (`1000→"000"`, `100→"00"`, zero-pad d1000 to 3 digits) live **only in the renderer's `_fmt_roll`**, never in engine math (`random.randint(1,1000)` already yields 1..1000; stored ranges were parsed to match).

### `_match_or_gap` — the mandatory None-guard helper (resolving Review 2/D)

**Every** engine site that calls `find` goes through this, so a `None` on a legal roll is *structurally impossible to forget* (this is exactly how the R1@576 / power-hole crashes slipped into earlier drafts):

```python
def _match_or_gap(self, rows, roll, table, die, *, nearest=False) -> RollStep:
    row = self.ds.find(rows, roll)
    if row is None and nearest:
        row, note = self.ds.find_nearest(rows, roll)      # R1/S1 gap path
        if row is not None:
            return RollStep(table, die, roll, row.name, getattr(row,'page',None),
                            getattr(row,'page_status','n/a'), kind="roll",
                            note=f"data gap at {roll}; used nearest ({note})")
    if row is None:
        return RollStep(table, die, roll, "(no entry for roll — data gap)",
                        None, "n/a", kind="gap",
                        note="data gap; re-roll this slot")
    return RollStep(table, die, roll, row.name,
                    getattr(row, 'page', None), getattr(row, 'page_status', 'n/a'))
```

### `engine.py` — API sketch

```python
class RollEngine:
    def __init__(self, ds: Dataset, roller: Roller, cap: int = REROLL_CAP): ...

    # ---- Feature 1: roll any single table --------------------------------
    def roll_item_table(self, table: str, depth: int = 0) -> RollResult
    def roll_power_table(self, num: str) -> RollResult
    def roll_armor(self, depth: int = 0) -> RollResult          # synthetic "R" -> full armor
    def roll_weapon(self, depth: int = 0) -> RollResult         # synthetic "S" -> full weapon
    def roll_named(self, key: str) -> RollResult                # UI dispatch by combo id

    # ---- Feature 2 + 5: fully random item + cascade ----------------------
    def roll_random_item(self) -> RollResult

    # ---- Feature 3: random artifact power --------------------------------
    def roll_artifact_power(self, num: str | None = None) -> RollResult   # None -> random table

    # ---- Feature 4: generate an artifact with N powers -------------------
    def generate_artifact(self, n: int,
                          tables: list[str | None] | None = None) -> RollResult

    # ---- Bonus: treasure hoard -------------------------------------------
    def roll_hoard(self, k: int) -> RollResult                  # k random items, one grouped result

    # ---- shared primitives (directly testable) ---------------------------
    def _resolve_item(self, item: Item, table: str, depth: int) -> RollStep
    def _resolve_enchanted_enhancements(self, depth: int) -> RollStep
    def _assemble_armor(self, depth: int) -> RollStep           # R1 type + R2 bonus + R3 item
    def _assemble_weapon(self, depth: int) -> RollStep          # S1 + S2 + S3
    def _bonus_plus(self, mech_key: str, name: str) -> str      # "+2" / "-1", sign-preserving
    def _headline(self, root: RollStep) -> str
```

### Algorithm 1 — roll any item table (Feature 1)

```
roll_item_table(table, depth=0):
    step = _match_or_gap(items_by_table[table], roller.roll(1000), table, 1000)
    if step.kind == "roll":
        _attach_cascade(step, table, depth)     # see Alg 4 helper
    return RollResult("single", _headline(step), step, roller.seed)
```

`_attach_cascade(step, table, depth)`:
```
if step.label == "Enchanted Enhancements":
    step.children = [ _resolve_enchanted_enhancements(depth + 1) ]
elif item_is_reroll(step):                       # matched Item.reroll is True
    step.children = [ _resolve_item(matched_item, table, depth + 1) ]
```

**The Single-Table combo also exposes synthetic `"R"` (full Armor) and `"S"` (full Weapon)** which dispatch to `roll_armor`/`roll_weapon` (Alg 3). `R3`/`S3` remain selectable as the *raw item sub-lists*, documented in the combo as "(item list only)". This closes Review 1/#1 — a DM can roll a complete armor/weapon from Tab 1.

Power tables use `roll_power_table(num)` (Alg 6); no cascade.

### Algorithm 2 — fully random item (Feature 2), with master-gap + R/S

```
roll_random_item():
    d = roller.roll(100)
    mrow = ds.find(master_rows, d)
    if mrow is None:                              # true gap (79-100, or 79 only if TRUST=True)
        hi = max(r.roll_high for r in master_rows)
        root = RollStep("master", 100, d,
                        f"No category — source index covers d100 1–{hi}",
                        None, "n/a", kind="gap", note="master gap")
        return RollResult("random_item", "No result — master gap", root, roller.seed)
    if   mrow.target == "R": inner = _assemble_armor(depth=0)
    elif mrow.target == "S": inner = _assemble_weapon(depth=0)
    else:                    inner = roll_item_table(mrow.target, depth=0).root
    root = RollStep("master", 100, d, mrow.name, None, "n/a", children=[inner])
    return RollResult("random_item", _headline(root), root, roller.seed)
```

### Algorithm 3 — R/S multi-part assembly (with catch-all resolution)

```
_assemble_armor(depth):
    t = roller.roll(1000)
    type_step = _match_or_gap(mech["R1"], t, "R1", 1000, nearest=True)   # handles 576 gap
    b = roller.roll(20)
    bonus_step = _match_or_gap(mech["R2"], b, "R2", 20)                  # keep full XP/GP label
    matched_r1 = ds.find(mech["R1"], t)

    if matched_r1 is not None and matched_r1.is_r3_catchall:
        # R1 rolled "Special (Roll on Table R3)": do NOT keep a separate type node;
        # the R3 roll below IS the item. Collapse per Review 1/#2.
        item_step = roll_item_table("R3", depth).root
        parent = RollStep("armor", 0, 0, "Armor (Special)", None, "n/a",
                          kind="assembly",
                          children=[type_step, bonus_step, item_step],
                          note="R1 catch-all → R3 is the item; type node informational")
    else:
        item_step = roll_item_table("R3", depth).root
        parent = RollStep("armor", 0, 0, "Armor", None, "n/a", kind="assembly",
                          children=[type_step, bonus_step, item_step])
    return parent
# headline: "{plus} {type}, {item}"  e.g. "+2 Plate Mail, of Etherealness"
```

**Bonus extraction (`_bonus_plus`), sign-preserving, per-table (resolving Review 2/B4):**
```
_bonus_plus(mech_key, name):
    if mech_key == "S2":                 # S2 name IS the bonus: "-1".."+5"
        return name.strip()
    # R2: extract the AC Adj token specifically, preserving sign
    m = re.search(r"AC Adj\s*([+-]?\d+)", name)
    return (("+"+m.group(1)) if m and not m.group(1)[0] in "+-" else m.group(1)) if m else name
```
The **full** R2 XP/GP string stays in `bonus_step.label` so the DM sees values. If extraction fails, the headline falls back to the raw name (no crash). A `-1` cursed weapon/armor is preserved (never silently coerced to `+1`). Weapons are identical with S1/S2/S3.

**Reroll "same table" rule (resolving Review 1/#3):** the cascade re-rolls the **leaf item table the item came from** — `R3` for armor, `S3` for weapons — never re-running type+bonus. This is the `depth` threaded into `roll_item_table("R3", depth)` above.

### Algorithm 4 — reroll/combine cascade WITH cap (Feature 5, the crux)

**Cap semantics (resolving Review 1/#4 off-by-one):** `REROLL_CAP = 3` means **up to 3 rerolls executed beyond the base item** (base + 3 combines = 4 items max). `depth` counts *executed rerolls*. The base item is `depth=0`; its first reroll runs at `depth=1`. We **execute** the roll while `depth <= cap`, and emit a cap-marker leaf only when a further reroll is demanded at `depth > cap`.

```
_resolve_item(item, table, depth):               # invoked because item.reroll is True; depth>=1
    if item.name == "Enchanted Enhancements":
        return _resolve_enchanted_enhancements(depth)
    if depth > cap:                              # depth 4 would be the 4th reroll -> blocked
        return RollStep(table, 0, 0, "(reroll cap reached)", None, "n/a",
                        kind="cap", note=f"cap ({cap}) reached")
    r2 = roller.roll(1000)
    step = _match_or_gap(items_by_table[table], r2, table, 1000)
    step.kind = "reroll"; step.note = "reroll → combined"
    if step.label == "Enchanted Enhancements":
        step.note = "reroll → Enchanted Enhancements"
        step.children = [ _resolve_enchanted_enhancements(depth + 1) ]
    elif matched_reroll(step):                   # this reroll itself landed on a reroll=true item
        step.children = [ _resolve_item(matched_item, table, depth + 1) ]
    return step
```

**Executed-reroll count is pinned by test** (assert on the number of `kind in {"reroll","enhancement"}` nodes, not tree depth): force reroll every time → exactly **3** executed reroll nodes + one `kind="cap"` leaf.

**Duplicate self-combine (Review 1/#10):** allowed. A reroll may re-draw the same item ("X + X"); this is rules-legal and rare given range widths. Documented, not looped.

### Algorithm 5 — Enchanted-Enhancement selector cascade

```
_resolve_enchanted_enhancements(depth):
    if depth > cap:
        return RollStep("enh", 0, 0, "(reroll cap reached)", None, "n/a",
                        kind="cap", note=f"cap ({cap}) reached")
    d = roller.roll(100)
    row = ds.find(enhancement, d)                # "91-00"->(91,100); tiles fully
    step = RollStep("enh", 100, d, f"Enchanted: {row.type}", None, "n/a",
                    kind="enhancement")
    if row.reroll:                               # 9 of 10 chain
        step.children = [ _resolve_enchanted_enhancements(depth + 1) ]
    return step
```

**Shared vs. per-mechanic cap (resolving Review 1/#9):** the cap is **global across the whole assembly** — one `depth` counter threaded through item-rerolls (Alg 4) *and* EE-selector chains (Alg 5) *and* R3/S3 sub-cascades (Alg 3). Rationale: the DM guideline is a runaway guard ("cap at 3"), and a single shared budget is the faithful reading of "combined into one item … capped at 3." This means a mixed chain (item→reroll→item→Enchanted Enhancements→enh→enh…) is capped at **3 total executed combines**. Tests cover a pure-EE chain, a pure item-reroll chain, and a mixed chain, each asserting the exact executed-node count.

**Threading through R3/S3 (resolving Review 2/B6):** `roll_item_table` takes `depth` and threads it into `_attach_cascade`, so an R3 item rolled inside `_assemble_armor(depth)` shares the outer budget — no independent budget reset.

### Algorithm 6 — artifacts (Features 3 & 4), with None-guard

```
roll_artifact_power(num):
    pt = power_by_num[num] if num else roller-pick from POWER_RANDOM_POOL (default: all tables)
    r = roller.roll(pt.die)
    step = _match_or_gap(pt.entries, r, f"power:{pt.num}", pt.die)   # 1-16@37 / 1-15 -> gap leaf
    return RollResult("artifact_power", step.label, step, roller.seed)

generate_artifact(n, tables=None):
    if not (1 <= n): raise ValueError("N must be >= 1")
    if tables is not None and len(tables) != n: raise ValueError("tables length must equal N")
    picks = tables if tables is not None else [None] * n
    children = []
    for t in picks:
        child = roll_artifact_power(t).root
        if child.kind == "gap":                 # a data hole -> re-roll this slot once
            child = roll_artifact_power(t).root
        children.append(child)
    root = RollStep("artifact", 0, 0, f"Artifact — {n} powers", None, "n/a",
                    kind="assembly", children=children)
    return RollResult("artifact", _headline(root), root, roller.seed)
```

- **Both bonus modes:** `tables=None` → random per power; a list with `None` slots = random for that slot, explicit `num` = chosen for that slot. **Duplicate tables allowed** (an artifact may legitimately have two Major Powers).
- **N cap (Review 3/#3):** no hard block. `MAX_POWERS_SOFT=20` is a *soft warning* ("N above 20 — large artifact"), not a `ValueError`. Only N<1 or non-integer is rejected.
- **Random pool (Review 1/#8):** default pool = all power tables; the UI exposes a checkbox "exclude meta tables (1-00, 1-24 Divination)" so a DM can restrict random picks to actual power tables. Documented default: **include all**.
- **Data-hole slots (Review 2/B3):** a `kind="gap"` power triggers one re-roll of that slot rather than emitting an empty power.

### `_headline` — assembly rules (resolving Review 1/#11 and Review 3/#8)

Produce a **read-aloud-friendly** primary name plus a compact count badge; details stay in the trace.

```
_headline(root):
    base = primary_name(root)                    # armor/weapon -> "{plus} {type} {item}";
                                                 # random_item -> the target item's name;
                                                 # single -> the item/power label
    combines = count nodes with kind in {"reroll","enhancement"} (excluding cap leaves)
    ench = count nodes with kind == "enhancement"
    if combines == 0: return base
    suffix = f"  ·  +{combines} combined" + (f" ({ench} enchanted)" if ench else "")
    return base + suffix
# e.g. "+2 Long Sword of Speed  ·  +2 combined (1 enchanted)"
```

The headline stays "one breath long"; the full chain (including which enhancement types) lives in the expandable trace.

---

## (d) Screens & navigation

Single `ttk.Notebook` with **4 tabs**, a persistent header, and a toggleable **History** sidebar shared across tabs. **The app opens on the Random Item tab** (the primary verb; Review 3/#1). The header carries a **seed field + lock/position indicator**, a persistent **🎲 Random Item** button (works from any tab), and a **⚙ Diagnostics** button (shows `data_warnings` + a `--verify`-style self-test report).

```
┌────────────────────────────────────────────────────────────────────┐
│ Enc. Magica Roller   [🎲 Random Item]   seed:[____] 🔒 #N  [⚙]      │
├───────────────────────────────────────────────┬────────────────────┤
│ [Random Item][Single Table][Artifacts][Library]│  History           │
│                                                │  📌 Boss's Sword    │
│   ...active tab...                             │  ▸ Hoard (30) …     │
│                                                │  › Potion of Flying │
│                                                │  [Copy][Export][Clr]│
└───────────────────────────────────────────────┴────────────────────┘
```

**Tab: Random Item (F2 + F5) — default/opening tab.** One prominent **Roll Random Magic Item** button (also the header button). ResultView shows the assembled headline + expandable trace: master → category/target → (R/S: type + bonus + item) → cascade chain. **Master-gap** rolls render a calm, explanatory banner (see (e)) with a **category picker** and a **Reroll within range** action — never a dead end. A **Treasure Hoard** control (Spinbox K + "Roll Hoard") lives here too (bonus).

**Tab: Single Table (F1).** Grouped `ttk.Combobox`:
- "Item Tables A–T" (named, e.g. `A — Magical Liquids`)
- **"Full Armor (R)"** and **"Full Weapon (S)"** (synthetic; roll type+bonus+item)
- "Armor parts: R1 type / R2 bonus / R3 item list only"
- "Weapon parts: S1 / S2 / S3 (item list only)"
- "Artifact Powers 1-00 … 1-24"

A **DieBadge** shows the die that will roll (d1000/d20/d100/d10) so the mechanic is transparent. Big **Roll** button (Enter / `R`). Result rendered in the shared ResultView; cascades auto-expand.

**Tab: Artifacts (F3 + F4).**
- **Single Power:** combobox (or "🎲 Random table") + **Roll Power**.
- **Generate Artifact:** a **validated** `Spinbox` for N (see edge cases), radio `( ) Random tables  ( ) Choose tables`.
  - "Choose" reveals N comboboxes, **each defaulting to "🎲 Random"** (unset = varied). Prior selections are **preserved** when N shrinks then grows. Per-row **🎲** randomizes one slot; **Randomize all** for the set. A **"Major/Minor mix" preset** (e.g. 1 major + 3 minor) covers the common case (Review 3/#4).
  - **Generate** assembles one artifact card; each power is a child line with source table + die + roll.

**Tab: Library (F6).** Left: table list (all item + power tables). Center: `ttk.Treeview`, columns **Table · Roll · Name · Page · Reroll?**, sortable by header click. Top: live **search box**.
- **Search (Review 3/#6):** tokenize the query and **AND** the terms across `name + category + table + subcategory + page`; case-insensitive. So "flame tongue" and "tongue flame" both hit; "sword", "R3", "armor", "341" all work. **Debounced ~150 ms** (`after`) so typing on 5,709 rows stays smooth.
- Empty state: **"No items match 'xyz' — clear (Esc)"**. Result count shown: **"37 of 5,709"**.
- Page column: the number, or **"—"** for null/`not_in_index`.
- Double-click a row → detail popover ("what this roll gives", full page/status) + **Roll this table** (jump to Single Table, pre-selected).

---

## (e) How a result is displayed

Shared **ResultView**: a bold **headline** zone + an expandable **trace** rendered as a `ttk.Treeview` in tree mode (indented children = cascade/multi-part, so every combine is literally visible). One line per `RollStep`:

```
master · d100 → 78 · Weapons (S)
  └ S1 · d1000 → 604 · Long Sword
  └ S2 · d20  → 12  · +2
  └ S3 · d1000 → 251 · Sword of Speed        (p.341)
      └ reroll → S3 · d1000 → 000 · Enchanted Enhancements
          └ enh · d100 → 14 · Aquatic
```

- **Roll display (`_fmt_roll`):** d1000 renders `1000→"000"` zero-padded to 3; d100 renders `100→"00"`. Formatting only.
- **Page:** `page_status=="filled"` → `(p.341)`; `null`/`"not_in_index"` → muted **"not in index"**; `"n/a"` (powers, enh, bonus, assembly nodes) → omitted. Never blank/crash.
- **Cap** shows as an explicit `(reroll cap reached)` leaf. **Master gap** shows the explanatory banner (below). **R1/S1 nearest-range** and **power-hole** show their `note`.
- **Footer:** `seed 483920117 · roll #N`, plus **Copy** (headline + full trace), **Reroll (new seed)**, **Replay (same seed)**, and a **← Previous** back-stack arrow (`Ctrl+Z`) to restore the last-shown result (Review 3/#10).

**Master-gap banner (calm + actionable, Review 3/#5):**
> "The digitized master table covers d100 rolls 1–{hi}; {gap-range} aren't in the source yet. Pick a category, or reroll within 1–{hi}."
> `[ Category ▾ ]  [ Reroll 1–{hi} ]`

The category dropdown lists the known categories and jumps straight to that table's roll. Banner copy adapts to the active `MASTER_TRUST_PRINTED_RANGE` flag (gap = 79–100 when False, 79 only when True).

**Read-the-rules path (the single highest-value addition, Review 3/#7 + #11):** every result offers **"Open rules"**:
- `page` present → **[Open p.NNN]** opens the source PDF at that page via the OS viewer (`subprocess`/`webbrowser`).
- `page` missing → degrade to **[Search PDF for "<name>"]** (open the PDF and hand off its find), not a greyed-out dead link.
- A one-click **"report bad page"** appends the item to `ITEMS_TO_FIND.csv` (already in the repo) so live discoveries feed the data-fix backlog.

---

## (f) Edge cases & error handling

- **Invalid N (Review 3/#3):** the artifact Spinbox uses a `validatecommand` permitting only empty-or-digits while typing; on focus-out/Enter it coerces empty→1, non-numeric keystrokes rejected, N above `MAX_POWERS_SOFT` allowed with an inline "large artifact" note. Engine still raises `ValueError` for N<1 as a backstop (caught → inline red, Generate disabled until valid). **Do not rely on the exception path for the common case.**
- **Master no-match:** engine returns a labeled `kind="gap"` result; UI shows the explanatory banner + category picker + range-reroll. Documented known gap; default flag makes it *visible*.
- **Unreliable R1/S1 ranges:** fixed once in loader via `parse_range(roll, 1000)` with die pinned. Startup tiling check logs the **real 576 gap** (and any S1 issue) to Diagnostics as a **warning, never an `assert`** (an assert would abort startup on real data). At runtime, `_match_or_gap(..., nearest=True)` fills the gap with the nearest range + a note; **never crashes**.
- **Power-table holes (1-16@37, 1-15 backwards range):** loader swaps backwards ranges and logs both to Diagnostics. `roll_artifact_power` routes through `_match_or_gap`; a `kind="gap"` slot in `generate_artifact` is re-rolled once.
- **`d1000` "000":** internal 1000; displayed "000"; `find(1000)` matches the `…-000`→high=1000 row. `parse_range` max-encoding tested for **every** die (1000/100/20/10).
- **Empty/short table, missing key:** `find` → None → `_match_or_gap` returns a `kind="gap"` step; never throws.
- **Cascade runaway:** hard shared cap `REROLL_CAP=3`; config-editable in Settings.
- **Missing/corrupt `app/`:** loader wraps each file in try/except; a startup dialog names the failed file with its resolved path; the app runs with whatever loaded.
- **Search on 5,709 rows:** debounced; Treeview refill via list-comprehension; result count + empty state shown.
- **Hotkey scope (Review 3/#10):** `Space`/`R` roll only on roll-capable tabs and are **no-ops (not errors)** on Library; **unbound when focus is in a text/search field** so typing a query never triggers a roll.

---

## (g) Additions beyond the user's request (recommended, ranked)

I recommend implementing all of 1–6; 7 is a stretch nicety.

1. **Seedable RNG + lock/replay** — already wired via the injected `Roller`; seed stored on every `RollResult`. Reproduce/share a session ("seed 4127 · roll #3"), pre-roll a hoard and replay at the table. **Why:** near-free given the architecture; the single most powerful DM feature for a random generator.
2. **Roll History sidebar — persisted, pinnable, grouped (Review 3/#9)** — every result logged with headline + timestamp + seed; **persisted to `history.json`** on each append and reloaded on launch (with a "clear session" control); **capped live list (~200)** with older entries exportable; **pin/label** an entry ("Boss's Sword") so batch noise doesn't bury keepers; **batch/hoard rolls grouped under one collapsible parent**. **Why:** a hoard built over a prep session must survive app restart.
3. **Copy / Export result** — per-result Copy (headline + trace) to clipboard; export a session/hoard to `.txt`/`.md`/`.json` stat blocks. **Why:** DMs paste into their notes.
4. **"Explain this roll" trace** — the expandable node tree, collapsible to just the headline for quick play (players see the item; DM sees the dice). **Why:** the killer feature for a mechanics-heavy dataset; it's free because the engine already returns the tree.
5. **Read-the-rules path (page → PDF, or name → PDF search fallback)** — closes the loop from "what I rolled" to "what it does," even for `not_in_index` items. **Why:** at the table, this is the actual job; the app is far less useful if it can only name an item.
6. **Treasure Hoard batch** (`roll_hoard(k)`) — loop `roll_random_item` K times into one exportable, grouped result. **Why:** the real treasure-generation use case.
7. **Keyboard shortcuts** — `R`/`Space` roll active (roll-capable) tab, `Ctrl+R` reroll last, `Ctrl+C` copy, `Ctrl+F` focus library search, `Esc` clear search, `Ctrl+Z` previous result, `1`–`4` switch tabs, `Ctrl+H` toggle history. **Why:** fast live play; scoped carefully per (f) to avoid accidental rolls.

---

## Testing (delivering "provably correct")

`tests/` uses `pytest` + `FixedRoller`, **zero tkinter imported**:

- `test_ranges` — every `parse_range` boundary for **die ∈ {1000, 100, 20, 10}**, including max-encoding (`"000"`/`"00"`/`"0"`), `"953-000"`, `"91-00"`, `"78-00"`, bare `"1"`, and backwards-range normalization.
- `test_cascade` — force reroll every time → exactly **3 executed reroll nodes + 1 cap leaf** (assert on node count, not depth); non-reroll item has no children; **pure-EE chain**, **pure item-reroll chain**, and **mixed chain** each with explicit expected executed-node counts; **R3-within-armor** shares the outer budget.
- `test_rs` — scripted R/S → 3-part trace; headline `"+2 Long Sword …"`; **real S2 `"-1"` row → cursed sign preserved**; **real R2 `"AC Adj -1 / …"` row → `_bonus_plus` extracts `-1`**; regex-failure fallback to raw name; **R1 catch-all → R3-is-item collapse** asserted.
- `test_master` — d100=88 (TRUST=False) → `kind="gap"` note; d100=78 → Weapons.
- `test_artifact` — power hole **1-16 roll 37** → `kind="gap"` step (no crash); **1-15 backwards range** normalized; `generate_artifact` re-rolls a gap slot; duplicate tables allowed; N<1 raises.
- `test_loader` — R1 tiling logs the **576 gap** as a warning (not an abort); 5,709 items; table set == `A..Q,R3,S3,T`; S1 die pinned 1000; extra enhancement keys tolerated.

A **`--verify` CLI flag** (and the Diagnostics dialog) runs the tiling/gap self-test and prints a copy-pasteable report (R1@576, 1-16@37, 1-15 overlap, master 79–100), turning the known data bugs into actionable tickets.

---

## Known data-fix tickets (non-blocking; the engine handles all gracefully)

1. **R1 gap at roll 576** — fill the missing type (or extend a neighbor). Engine currently uses nearest-range fallback.
2. **Master 79–100** — ✅ FIXED at source (Weapons row corrected to 78–100, verified against the book page). Master tiles d100 fully; no gap.
3. **Power table 1-16 missing roll 37; table 1-15 backwards range** — repair entries. Engine re-rolls/normalizes.
4. **R1/S1 `roll_low/roll_high` mangled** — repair at source. Engine reads authoritative `roll` strings with die pinned 1000.

---

## Build order

1. `models.py` + `ranges.py` + `loader.py` + `dataset.py`; unit-test parsers against the real files (this catches the 576 / 37 / 1-15 issues immediately).
2. `dice.py` → `results.py` → `engine.py` with `_match_or_gap` as the single find-site; prove correctness in `tests/` with no GUI.
3. `ui/`: Notebook + header + ResultView/History, then the 4 tabs (Random Item first), then the ranked additions.
