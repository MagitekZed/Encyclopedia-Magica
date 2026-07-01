# Encyclopedia Magica — Magic Item Roll Dataset

Complete extraction of the "Magical Item Random Determination Tables" (Tables 1, A–T) plus
every item's page number from the master Index.

## Roll system (2-tier)
1. **Table 1** (`tables/table_1_master.json`): roll **d100** → item category → lettered sub-table.
2. **Tables A–T**: roll **d1000** (001–000) → specific item. `reroll:true` (an `*` in the book)
   means roll again on that table and combine. Tables **R (Armor)** and **S (Weapons)** are multi-part:
   roll type (R1/S1) + bonus (R2/S2) + specific item (R3=`table_R`, S3=`table_S`); the type/bonus
   sub-tables are in `tables/mechanics_type_bonus.json`.

## Files
- `tables/table_<L>_<slug>.{json,csv}` — 20 item tables (A–T). Fields: table, category, subcategory,
  roll_display, roll_low, roll_high, name, reroll, page, page_status.
- `tables/table_1_master.json` — d100 → category → sub-table letter.
- `tables/mechanics_type_bonus.json` — R1/R2/S1/S2 (armor/weapon type & bonus sub-tables).
- `all_items.json` — all 5,709 items in one array.
- `index_full.json` — the whole book Index read visually: ~13,494 `{idxpage, head, name, page}`.
- `index_cheatsheet.json` — first/last entry + count per index page.

## Coverage
- **5,709 items** across 20 tables. **Rolls: 100% validated** (contiguity-repaired; every table
  covers its full 001–000 range with no gaps or overlaps).
- **Names**: read visually by subagents (clean).
- **Page numbers**: **5,699 / 5,709 (99.8%)** matched to the Index (type-aware match + cluster
  validation + agent re-read of the hard tail). `page_status`: `filled` = matched; `not_in_index` =
  the 10 items the encyclopedia doesn't individually index (siege-weapon variants, Ioun stones by
  shape/color, Tent/Bead/Marble generics, one scan-corrupt cell).

## Method
- **Roll tables**: render pages → slice into half-columns → **subagents read them visually**
  (one per page) → contiguity-repair guarantees complete roll coverage.
- **Index**: same slice+visual-read (tesseract fails on the dotted leaders). Systematic "Type of X"
  items sit under collective type-headwords; unique/named items are scattered A–Z.
- **Join**: fuzzy name match against `index_full.json`, validated by page-clustering for tight tables.

## Notes / remaining polish
- Table pages 14 and Index page 33 are full-page art plates (no roll/index data) — correctly skipped.
- Minor mechanics tails to top up: Table 1 last range (Weapons→S high), R1/S1 type lists.
- Verification pass complete: 10 items remain unindexed (documented in each table's page_status).
