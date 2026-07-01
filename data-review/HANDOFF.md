# Handoff — finish the data review, then polish the app

A fresh session should be able to pick up from here with **no prior chat context**. Read this file
+ the repo. Two phases, in order: **(1) finish the page-number data review**, then **(2) polish the app.**

---

## 0. Orientation (what this project is)

`Encyclopedia-Magica` — a dice-roller + table browser for the AD&D 2e *Encyclopedia Magica* magic-item
& artifact random tables. Two apps over one shared dataset; repo is on GitHub (private→public), live on Pages.

```
app/        shared dataset + design docs (SOURCE OF TRUTH)   ← the data review edits app/all_items.json
web/        the SPA  (deployed to Pages)                     ← regenerate web/data.js after data edits
desktop/    Python/Tkinter app
data-review/  THIS handoff + the reproducible review tooling + work-lists
reference/  (gitignored, present locally) source PDFs + reference/index_full.json  ← the book index
```

- **Live:** https://magitekzed.github.io/Encyclopedia-Magica/  (auto-redeploys on push to `main`)
- **Run desktop:** `/opt/homebrew/bin/python3.14 desktop/roller.py`  (system python3 = Tk 8.5 = blank window; use Homebrew 3.14)
- **Tests:** `cd desktop && python3 -m unittest discover -s tests` (46) · `node web/tests/run.js` (47)
- **Verify data:** `python3 desktop/roller.py --verify`
- User is `MagitekZed` (GitHub Pro). Ultracode has been used for the big passes (workflows/swarms are welcome).

---

## 1. What's already done (do NOT redo)

- **Rules bug fixed & shipped.** Armor/weapon assembly now branches on *Special* per the book: roll
  R1/S1 → if Special (953-000 / 975-000) roll R3/S3 for a specific item, else R2/S2 for a generic
  `"+N {type}"`; Table S2's **Sword Adj vs Wpn Adj** columns are respected (data has `wpn_adj`).
  Both engines + tests updated. (Files: `desktop/enc_roller/engine/engine.py::_assemble_rs`,
  `web/js/engine.js::assembleRS`, `app/mechanics_type_bonus.json` S2 rows.)
- **Item TYPES recovered.** Two vision-extraction swarms read the source tables PDF and captured the
  type sub-headers (Oils/Salves/Lenses/Rings/…). **`subcategory` is now populated on 5,454 / 5,709 items.**
- **Page mis-joins fixed.** Re-joining each item's `(type + name)` against the book index fixed the
  wrong-page problem (section-header pages instead of the item's real page — e.g. Salve of Far Seeing
  654→1052; the whole Oils section 899→763–780). Applied in three audited passes:
  - `app/PAGE_CORRECTIONS_applied.csv` (229) — early distinctive-name fixes
  - `app/PAGE_REJOIN_applied.csv` (774) — type-based re-join fixes
  - `app/PAGE_REVIEW_applied.csv` (313) — first review-swarm fixes
- **Un-indexed items:** down 10 → 8 (see `app/ITEMS_TO_FIND.csv`).

Current coverage (run `python3 data-review/rejoin.py` to reproduce):
`ok 4184 · multi-page 132 · ambiguous 228 · fuzzy-name 742 · absent 420 · untyped 3` (of 5,709).
~4,184 items resolve to a single index page; ~1,100 pages were corrected.

---

## 2. THE REMAINING DATA REVIEW  (do this first)

The bottleneck is the **book index itself**: `reference/index_full.json` maps `(headword=type, name-fragment) → page`.
We can only *verify* a page when the item's name appears in that index. The tooling has taken this as far as
the index allows. **The real open work is 613 items** (`data-review/still_open.json`):

### 2a. `absent_from_index` — 464 items  (the hard limit)
Their names are **not in the index at all** (no exact or fuzzy match), so the index can't confirm a page.
These keep their *original* pages (possibly right, possibly a stale mis-join — unverifiable by us).
Options, in order of preference:
- **Get the encyclopedia CONTENT pages.** We only have the index (p350-416) + the tables (p320-348) as
  PDFs — NOT the ~1,600 pages of item descriptions. With those, an item's page is directly findable.
  This is the only way to truly close these out.
- Manual/targeted lookup for high-value ones (named artifacts, etc.).
- Otherwise: **accept current pages and flag** (extend `ITEMS_TO_FIND.csv`), and move on.

### 2b. `punted_or_low_confidence` — 149 items  (the first review swarm was unsure)
These had index candidates but the first 28-agent review swarm returned `page:0` (keep current) or
`confidence:low`. A **second review swarm with a sharper lens** (or manual pass) can likely resolve many.
Each entry in `still_open.json` includes the candidates and the first pass's reason.

### 2c. `multi-page` (132) — the book index legitimately lists the name on 2+ pages
Often correct as-is (the item genuinely spans pages, or there are same-named variants). Decide per-item:
keep the list, or pick the primary page. Low priority.

### 2d. Optional
- **QA** a random sample of the ~1,100 applied corrections against the index for confidence.
- **Table T artifacts** (~147, mostly untyped — named artifacts aren't type-grouped in the source).

---

## 3. How to continue the review (reproducible tooling in `data-review/`)

| file | what |
|---|---|
| `rejoin.py` | **run this** — recomputes buckets from current data + index + types, rewrites `review_remaining.json`. Self-contained; edit the resolve logic here. |
| `type_headers.json` | 403 recovered type sub-headers (both extraction swarms). Used to derive `subcategory`. |
| `review_remaining.json` | the 1,102 candidate items (multi-page + ambiguous + fuzzy-name) with their index candidates. |
| `still_open.json` | **the focused work-list** — `{punted_or_low_confidence: 149, absent_from_index: 464}`. |
| `_review_decisions.json` | the first review swarm's 1,102 decisions (page + confidence + reason). |
| `_extract_pass1.json` / `_extract_pass2.json` | raw type-extraction swarm outputs (provenance). |

**The method (already validated — mirror it):**
1. Build an index map: for each `reference/index_full.json` entry, key `norm(name)` **and** `norm(head+" "+name)`
   and comma-inversions → `(headword, page)`. (See `rejoin.py`.)
2. Resolve an item by its name: **one head → that page**; **multiple heads → disambiguate** by matching the
   item's `subcategory`/`TABLE_TYPE` fallback (`C→ring D→rod E→staff F→wand B→scroll`)/name-leading-word to the head.
3. **Safety guard (critical):** only ever apply a page that is one of the item's real index candidates —
   this blocked 13 hallucinated pages from the review swarm. Keep it.
4. **Cluster-confidence:** a change is "confident" if its new page is shared by / within ±8 of same-type peers.

**To run a 2nd review swarm** (the pattern that worked): split `still_open.json`'s `punted_or_low_confidence`
into ~40-item batch files, one agent per batch reads its file and returns `{roll,name,page(0=keep),confidence,reason}`,
then apply high/med decisions **through the safety guard**. (The prior workflow scripts are in the session's
`workflows/scripts/` — `magica-page-review-*.js` is the template.)

**Editing the data safely:**
- `app/all_items.json` is compact JSON. Round-trip format-preserving with:
  `json.dumps(ai, ensure_ascii=False, separators=(", ", ": "))` (verified exact).
- After editing: `python3 web/build_data.py` (regenerate `web/data.js`) → `python3 web/build.py` (rebuild
  `dist/magica_roller.html`) → run both test suites → `git commit && git push` (Pages auto-redeploys).
- Append every change to an audit CSV in `app/` (keep the trail reviewable/reversible).

**Data shapes:** `all_items.json` item = `{table, category, subcategory, roll_display, roll_low, roll_high,
name, reroll, page (int | list[int] | null), page_status}`. `index_full.json` entry =
`{idxpage, head, name, page:[int,…]}`.

---

## 4. Phase 2 — App polish (after the data review)

The app already passed an adversarial review (26/27 findings fixed) + a full mobile pass, and is live.
Candidate polish ideas to consider (get the user's direction):
- Surface the new **`subcategory`** in the UI (Library column/filter; result trace) now that items are typed.
- Visual refinement of the "Astral Observatory" theme; dice-roll/reveal animation tuning.
- Table T artifact display; the master-gap banner (unreachable but present).
- Perf sweep on low-end mobile; the one deferred review item (SPA listener teardown).
- See `web/DESIGN.md` for the design system and the "nice-to-have" bells list.

---

## TL;DR for the next session
1. `python3 data-review/rejoin.py` → see current buckets.
2. Work `data-review/still_open.json`: 2nd review swarm on the 149 punted items; decide policy on the 464
   absent (need content PDFs to truly fix — else accept+flag). Apply through the safety guard, audit CSV,
   regenerate/rebuild/test/commit.
3. Then move to app polish (§4), with the user setting priorities.
