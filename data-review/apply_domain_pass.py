#!/usr/bin/env python3
"""Apply the domain-review switches from the 2nd (this-session) pass over the punted-149.

Each switch is index-verified (the new page is a real index entry for the item's
type+name) AND cluster-verified (matches the item's same-type sibling/base page,
with the current page being the lone wrong-type outlier). Old pages are asserted
before writing so we can never hit the wrong row. Appends an audit CSV.

    python3 data-review/apply_domain_pass.py            # dry-run: show + verify
    python3 data-review/apply_domain_pass.py --write     # apply + write CSV
"""
from __future__ import annotations
import json, csv, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
AI = ROOT / "app/all_items.json"
AUDIT = ROOT / "app/PAGE_DOMAIN_applied.csv"

# (table, roll_display, name, old_page, new_page, confidence, reason)
SWITCHES = [
    ("C", "425-428", "of Invisibility", 771, [952, 971], "high",
     "table C=ring; index 'Ring of Invisibility'=[952,971]; current 771 is not a ring page."),
    ("H", "873-874", "Jade of Defending II", 626, 1062, "high",
     "Scepter; base sibling 'Jade of Defending' (871-872)=1062; index 'Jade Scepter of Defending'=[1062,1063]; 626 wrong-type."),
    ("O", "332-335", "Harp of Charming II", 86, 1323, "high",
     "base 'Harp of Charming' (327-331)=1323; index 'Harp of Charming'=[1323,1326]; current 86 (arrow region) wrong."),
    ("O", "336-340", "Harp of Charming III", 86, 1323, "high",
     "variant of 'Harp of Charming'=1323; current 86 wrong."),
    ("P", "806-808", "of Pearl", 807, [1086, 1108], "high",
     "Ship; index 'Ship of Pearl'=[1086,1108]; sibling ships cluster 1105-1110 (1108 shared); current 807 is the lone outlier."),
    ("B", "811-820", "of Seven Wizard Spells", 1018, 1083, "high",
     "Scroll; index 'Seven Wizard Spells, Scroll of'=1083; sits between 'Six'=[1083,1084]; first pass wrongly kept 1018."),
    ("H", "932", "Fiend II", 32, 1422, "high",
     "Talisman; base sibling 'Fiend' (930-931)=1422; current 32 is the Amulet-of-the-Fiend page (wrong item type)."),
]

def key(it): return (it["table"], str(it["roll_display"]))

ai = json.load(open(AI))
idx = {key(it): it for it in ai}

ok = True
for table, roll, name, old, new, conf, reason in SWITCHES:
    it = idx.get((table, str(roll)))
    if it is None:
        print(f"MISSING  {table} {roll} {name!r}"); ok = False; continue
    if it["name"] != name:
        print(f"NAME MISMATCH {table} {roll}: have {it['name']!r} want {name!r}"); ok = False; continue
    cur = it["page"]
    if cur != old:
        print(f"OLD MISMATCH {table} {roll} {name!r}: have {cur} expected {old}"); ok = False; continue
    print(f"OK  [{table}] {roll:9} {name!r:26} {cur} -> {new}  ({conf})")

if not ok:
    print("\nABORT: pre-checks failed, nothing written."); sys.exit(1)

if "--write" not in sys.argv:
    print("\nDry-run OK. Re-run with --write to apply."); sys.exit(0)

for table, roll, name, old, new, conf, reason in SWITCHES:
    idx[(table, str(roll))]["page"] = new

# format-preserving round-trip (verified exact in prior passes)
AI.write_text(json.dumps(ai, ensure_ascii=False, separators=(", ", ": ")), encoding="utf-8")

newfile = not AUDIT.exists()
with open(AUDIT, "a", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    if newfile:
        w.writerow(["table", "roll", "name", "old_page", "new_page", "confidence", "reason"])
    for table, roll, name, old, new, conf, reason in SWITCHES:
        w.writerow([table, roll, name, old, json.dumps(new) if isinstance(new, list) else new, conf, reason])

print(f"\nWROTE {len(SWITCHES)} switches to {AI.name} + audit {AUDIT.name}")
