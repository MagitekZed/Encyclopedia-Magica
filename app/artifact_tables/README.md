# Artifact Random Power Tables

From *Encyclopedia Magica* Vol. 1, pp. 8–22 ("Random Power Tables for Artifacts", Book of Artifacts).
Roll on these to generate the powers of an artifact/relic, and to resolve an
`Enchanted Enhancements*` result from the main item tables (A–T).

## Files
- `artifact_power_tables.json` / `.csv` — **25 power tables** (`Table 1-00 Abjuration` … `1-24 Divination Results`),
  each a category of artifact power. Fields: table_num, category, die, roll, power (full text).
  - Most are **d20** (roll 1–20 → power). Exceptions:
    - `1-15 Major Powers` & `1-16 Minor Powers` are **d100** (ranged rolls)
    - `1-24 Divination Results` is **d10**
  - Faithful source quirks (as printed): 1-15 ranges 61-63 & 63-67 both include 63; 1-16 skips roll 37.
- `enchanted_enhancement.json` / `.csv` — the **d100 Enchanted Enhancement selector**: roll → one of 10
  enhancement types (Anything Item, Aquatic*, Cloaked Wizardry*, Lightweight Equipment*, Miniature Gear*,
  Polymorphed Gear*, Psionic Dampener*, Quirk*, Racial Enhancements*, Weightless Item*). `*` = reroll/combine.
  Includes XP/GP values + descriptions for the 4 types printed in this PDF (the other 6 continue on the
  next book page, not included here).

## How it connects
Every main table (A–T) has an `Enchanted Enhancements*` result. When rolled, come here:
roll d100 on the Enchanted Enhancement selector for the type, then (per the DM's choice / the book's rules)
roll on the relevant power table(s) above for the specific artifact powers.

## Coverage
25 tables · 532 power entries · rolls validated against each table's die (all complete except the 2 noted source quirks).
