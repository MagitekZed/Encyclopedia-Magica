#!/usr/bin/env python3
"""QA the already-applied page corrections against the book index.

Re-checks every row in the three applied-correction CSVs:
  app/PAGE_CORRECTIONS_applied.csv  (229)
  app/PAGE_REJOIN_applied.csv       (774)
  app/PAGE_REVIEW_applied.csv       (313)

For each correction we recompute the item's index candidates (same map as rejoin.py)
and classify the applied new_page:

  GOOD  new_page is an index candidate for the name AND the head that yields it
        semantically matches the item's type/subcategory.
  WEAK  new_page is an index candidate BUT no candidate head matches the type
        (possible semantic mis-pick, e.g. Earth Command -> 989 quasielemental head).
  BAD   new_page is NOT among the item's index candidates at all
        (safety-guard violation -- the page can't be justified from the index).
  NOIDX name is absent/fuzzy in the index -> can't QA from the index (needs content pages).

Prints a summary + the WEAK/BAD rows to eyeball.  Read-only; writes nothing.
"""
from __future__ import annotations
import json, re, csv, collections, difflib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ai = json.load(open(ROOT / "app/all_items.json"))
idx = json.load(open(ROOT / "reference/index_full.json"))

def norm(s): return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", str(s).lower())).strip()
def ratio(a, b): return difflib.SequenceMatcher(None, a, b).ratio()

TABLE_TYPE = {"B": "scroll", "C": "ring", "D": "rod", "E": "staff", "F": "wand"}

# index: name-form -> list of (headword, page)   (mirror rejoin.py exactly)
name2hp = collections.defaultdict(list); allforms = set()
for e in idx:
    n = (e.get("name") or "").strip(); h = (e.get("head") or "").strip()
    ps = [p for p in (e.get("page") or []) if isinstance(p, int)]
    forms = {norm(n)}
    if h: forms |= {norm(h + " " + n), norm(n + " " + h)}
    if "," in n:
        pr = [x.strip() for x in n.split(",")]
        if len(pr) == 2:
            forms.add(norm(pr[1] + " " + pr[0]))
            if h: forms.add(norm(pr[1] + " " + pr[0] + " " + h))
    for f in forms:
        if f:
            allforms.add(f)
            for p in ps: name2hp[f].append((norm(h), p))
formlist = list(allforms)

# lookup current item by (table, roll_display) and by (table, name) to recover subcategory
by_tr = {}; by_tn = collections.defaultdict(list)
for it in ai:
    by_tr[(it["table"], str(it["roll_display"]))] = it
    by_tn[(it["table"], norm(it["name"]))].append(it)

def candidates(name):
    """(exact_or_fuzzy, [(head,page)...]) for a name, mirroring rejoin.resolve."""
    c = name2hp.get(norm(name))
    if c:
        return ("exact", sorted(set(c)))
    m = difflib.get_close_matches(norm(name), formlist, n=4, cutoff=0.82)
    if m:
        return ("fuzzy", sorted(set((h, p) for f in m for h, p in name2hp.get(f, []))))
    return ("none", [])

def type_hints(it, name):
    nw = norm(name).split()
    return [x for x in [it and it.get("subcategory") and norm(it["subcategory"]),
                        it and TABLE_TYPE.get(it["table"]),
                        nw[0] if nw else "", " ".join(nw[:2])] if x]

def classify(table, roll, name, new_page):
    it = by_tr.get((table, str(roll))) or (by_tn[(table, norm(name))][0] if by_tn[(table, norm(name))] else None)
    kind, cand = candidates(name)
    if kind == "none":
        return ("NOIDX", it, cand, None)
    cand_pages = {p for _, p in cand}
    if new_page not in cand_pages:
        return ("BAD", it, cand, None)
    hints = type_hints(it, name)
    heads_for_page = [h for h, p in cand if p == new_page]
    best = max((max((ratio(x, h) for x in hints), default=0.0) for h in heads_for_page), default=0.0)
    # does ANY candidate head (for any page) match the type better, pointing elsewhere?
    match_pages = {p for h, p in cand if h and max((ratio(x, h) for x in hints), default=0) >= 0.72}
    if best >= 0.72 or (not any(h for h, _ in cand)):  # good head-match, or all heads blank
        return ("GOOD", it, cand, best)
    if match_pages and new_page not in match_pages:
        return ("WEAK", it, cand, best)     # a better-matching head points to a DIFFERENT page
    return ("GOOD", it, cand, best)         # in-candidate, no better-matching alternative

rows = []
for fname, cols in [("app/PAGE_CORRECTIONS_applied.csv", ("roll_display", "new_page")),
                    ("app/PAGE_REJOIN_applied.csv", ("roll", "new_page")),
                    ("app/PAGE_REVIEW_applied.csv", ("roll", "new_page"))]:
    for r in csv.DictReader(open(ROOT / fname)):
        try: np = int(r[cols[1]])
        except (ValueError, TypeError): continue
        rows.append((fname.split("/")[-1], r["table"], r[cols[0]], r["name"], np))

buckets = collections.Counter(); flagged = []
for src, table, roll, name, np in rows:
    verdict, it, cand, best = classify(table, roll, name, np)
    buckets[verdict] += 1
    if verdict in ("WEAK", "BAD"):
        flagged.append((verdict, src, table, roll, name, np, it and it.get("subcategory"), cand))

print(f"QA'd {len(rows)} applied corrections")
print("verdicts:", dict(buckets))
print()
for v in ("BAD", "WEAK"):
    fl = [x for x in flagged if x[0] == v]
    print(f"===== {v} ({len(fl)}) =====")
    for verdict, src, table, roll, name, np, sub, cand in fl:
        cs = "; ".join(f"{h or '(none)'}:{p}" for h, p in cand)
        print(f"[{table}] {sub} :: {name}  applied->{np}  cand=[{cs}]  ({src})")
    print()
