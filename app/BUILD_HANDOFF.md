# Build Handoff — Encyclopedia Magica Roller

**Goal:** build a Python **Tkinter** desktop dice-roller + table browser for the digitized
AD&D 2e *Encyclopedia Magica* magic-item & artifact dataset.

**Read first:** [`ROLLER_DESIGN.md`](ROLLER_DESIGN.md) — the complete, build-ready spec (architecture,
engine API with function signatures, roll algorithms, screen layouts, edge cases, tests, build order).
This file captures the **locked decisions + data facts** so a fresh session needs only:
`BUILD_HANDOFF.md` + `ROLLER_DESIGN.md` + the `app/` data. No prior chat context required.

---

## Locked decisions (v1)

1. **Framework:** Tkinter + `ttk` (Python **stdlib, zero third-party deps**). Runs with `python roller.py`.
2. **Item pages:** **display the page number only** (e.g. `p.442`); `null` / `not_in_index` → show
   "not in index". **Do NOT** build any open-/search-PDF feature — the page numbers reference the
   main-Encyclopedia *content* pages, which are **not** in the available PDFs (we only have the
   index/tables/artifact excerpts in `reference/source_pdfs/`). Optional: a "report bad page" action
   that appends to `ITEMS_TO_FIND.csv`.
3. **Scope: everything** — all 6 features + the artifact generator (random **or** user-chosen table per
   power) + the extras: seedable/replayable RNG, persisted roll history (`history.json`), copy/export,
   treasure-hoard batch, keyboard shortcuts, and the expandable **"explain this roll" trace tree**.
4. **Asterisk / reroll mechanic (two-mechanic reading):**
   - the **19 items literally named "Enchanted Enhancements"** → roll **d100** on
     `enchanted_enhancement.json` for the type (which itself chains if that type is `reroll`);
   - the **other 56 asterisk (`reroll:true`) items** → **roll again on the SAME table and combine**;
   - **one shared cap = 3** executed rerolls across the whole cascade (base item + up to 3 combines).

---

## The 6 features (+ bonus)

1. Roll on **any single table** — every item table (A–T) and artifact power table (1-00…1-24); show roll, result, page.
2. Roll a **fully random item** — d100 master → category/target table → d1000 item, incl. R/S multi-part and the reroll cascade.
3. Roll a **random artifact power** — random or chosen power table.
4. **Generate an artifact with N powers** — validated N; **random tables OR choose the table per power**.
5. **Enchanted Enhancements works** — the cascade in decision #4.
6. **Table library** — searchable browser of all tables (items + artifact), with roll ranges and pages.

---

## Data (all in `app/`, validated — do not re-derive)

| file | what | key facts |
|---|---|---|
| `all_items.json` | 5,709 items | `{table, category, subcategory, roll_display, roll_low, roll_high, name, reroll, page, page_status}`; tables `A–Q, R3, S3, T`; **d1000** (ranges tile 1–1000); 75 `reroll`, 19 named "Enchanted Enhancements" |
| `table_1_master.json` | d100 master | `{roll_low, roll_high, name(category), target}`; **tiles 1–100** (fixed); targets `A–Q, R, S` (R→armor, S→weapons) |
| `mechanics_type_bonus.json` | R/S sub-tables | `R1,R2,S1,S2`. **R1/S1 = type, d1000, tile 1–1000** (fixed — trust `roll_low/high` now). **R2/S2 = bonus, d20**. R2 `name`="AC Adj +N / XP.. / GP.."; S2 `name`= bare "+N"/"-1". R1/S1 have a "Special (Roll on R3/S3)" catch-all row |
| `tables/table_<L>_<slug>.{json,csv}` | per-table item lists | same items as `all_items`, grouped |
| `artifact_tables/artifact_power_tables.json` | 25 power tables | `{power_tables:[{num "1-00".."1-24", category, die 20\|100\|10, entries:[{roll,text}], note?}]}`; **1-15 overlap fixed; 1-16 has a faithful gap at roll 37** |
| `artifact_tables/enchanted_enhancement.json` | d100 selector | `{die:100, entries:[{roll,type,reroll}], descriptions:[…]}`; 9 of 10 types `reroll` |

`roll` strings encode the die's max as trailing zeros: `000`=1000, `00`=100, `0`=10. Parse against a
**known die** (never infer the die from the string — S1's `01-97` is d1000, not d100). See `ROLLER_DESIGN.md`
`ranges.parse_range`.

---

## Roll mechanics (summary — full algorithms in `ROLLER_DESIGN.md §c`)

- **Single table:** roll the table's die → entry whose `roll_low..roll_high` contains it. Then attach the cascade if the matched item is `reroll` / "Enchanted Enhancements".
- **Random item:** d100 on master → target; if `R`/`S`, assemble = roll **R1/S1 type** (d1000) + **R2/S2 bonus** (d20) + roll the **R3/S3 item** (d1000); headline like `"+2 Long Sword, of Speed"`. Reroll re-rolls the **leaf item list** (R3/S3), not type+bonus.
- **Cascade (decision #4):** one shared `depth` counter, cap 3; Enchanted-Enhancements → d100 selector (chains), other asterisks → same-table re-roll (combine); the R1 catch-all "Special → R3" collapses (the R3 roll IS the item).
- **Artifact:** power table → roll its die (d20/d100/d10) → power text. `generate_artifact(n, tables)` — `tables=None` = random per slot; a list with `None`/explicit `num` per slot = choose. A gap slot (1-16 @37) re-rolls once.
- **Engine returns a trace TREE** (`RollStep` with children), not a string → renders the "explain this roll" view and keeps all combine logic in one tested place. Inject the RNG (`Roller` protocol) for seeding + a `FixedRoller` for tests.

---

## Caveats (all handled by the engine; none blocking)

- **Artifact 1-16 roll 37**: genuine source omission → the engine re-rolls that slot (kept faithful).
- **10 items** have `page=null` / `page_status="not_in_index"` (siege/Ioun/generic items, listed in
  `ITEMS_TO_FIND.csv`) → UI shows "not in index". Everything else previously flagged (master 79–100,
  R1@576, R1/S1 ranges, 1-15 overlap) is **fixed at source**.

---

## Build order

1. `data/` (`models`, `ranges.parse_range`, `loader`, `dataset`) → **unit-test the parsers against the real `app/*.json`** (catches any range issue immediately).
2. `engine/` (`dice`, `results` trace tree, `engine` with the single `_match_or_gap` find-site) → **pytest + `FixedRoller`, zero tkinter**; prove the cascade cap (exactly 3 executed rerolls), R/S assembly, master tiling, artifact gaps.
3. `ui/` (Tkinter `Notebook` + shared `ResultView` + History sidebar, then the 4 tabs — **Random Item opens first** — Single Table, Artifacts, Library) → then the extras.
4. Verify: `python roller.py`; a `--verify` CLI flag runs the data self-test.

**Start with steps 1–2 (data + engine + tests) before any GUI.**
