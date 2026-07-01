#!/usr/bin/env python3
"""Reproducible page re-join / review-worklist generator for the data review.

Reads the shipped dataset + the book index + the recovered type sub-headers, and
for every item decides which index page its (type + name) points to. Prints a
coverage summary and writes `review_remaining.json` — the work-list of items that
still need human/agent judgment.

    python3 data-review/rejoin.py

Inputs (all local; reference/ is gitignored but present on the dev machine):
  app/all_items.json                     the 5,709 items (now with subcategory + fixed pages)
  reference/index_full.json              the digitized book index (name+headword -> page)
  data-review/type_headers.json          403 recovered type sub-headers (2 extraction swarms)

Buckets an item can fall in:
  ok               name resolves to a single index page (already applied where it differed)
  multi-page       name resolves to a head but the index lists >1 page  -> pick one (review)
  ambiguous        name under several index heads, no confident type match -> disambiguate (review)
  fuzzy-name       name not exactly in index but a close spelling exists   -> confirm/reject (review)
  absent           name nowhere in the index (no fuzzy match)              -> needs content PDFs / manual
  untyped          no recovered type (mostly Table T named artifacts)
"""
from __future__ import annotations
import json, re, collections, difflib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ai = json.load(open(ROOT / "app/all_items.json"))
idx = json.load(open(ROOT / "reference/index_full.json"))

def norm(s): return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", str(s).lower())).strip()
def ratio(a, b): return difflib.SequenceMatcher(None, a, b).ratio()

# Single-category tables: the table itself implies the type (used to disambiguate).
TABLE_TYPE = {"B": "scroll", "C": "ring", "D": "rod", "E": "staff", "F": "wand"}

# index: many name-forms (fragment, head+name, comma-inversions) -> (headword, page)
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

def stored(it):
    p = it["page"]; return set() if p is None else (set(p) if isinstance(p, list) else {p})

def resolve(it):
    """Return (bucket, chosen_page_or_None, candidates)."""
    if not it.get("subcategory") and it["table"] not in TABLE_TYPE:
        untyped = True
    else:
        untyped = False
    c = name2hp.get(norm(it["name"]))
    if not c:
        m = difflib.get_close_matches(norm(it["name"]), formlist, n=4, cutoff=0.82)
        if m:
            cand = sorted(set((h, p) for f in m for h, p in name2hp.get(f, [])))
            return ("fuzzy-name", None, cand)
        return ("untyped" if untyped else "absent", None, [])
    bh = collections.defaultdict(set)
    for h, p in c: bh[h].add(p)
    cand = sorted(set(c))
    if len(bh) == 1:
        pg = next(iter(bh.values()))
        return ("ok" if len(pg) == 1 else "multi-page", (sorted(pg)[0] if len(pg) == 1 else None), cand)
    nw = norm(it["name"]).split()
    hints = [x for x in [it.get("subcategory") and norm(it["subcategory"]),
                         TABLE_TYPE.get(it["table"]), nw[0] if nw else "", " ".join(nw[:2])] if x]
    r, head = sorted(((max(ratio(hint, hh) for hint in hints), hh) for hh in bh), reverse=True)[0]
    if r < 0.5:
        return ("ambiguous", None, cand)
    pg = bh[head]
    return ("ok" if len(pg) == 1 else "multi-page", (sorted(pg)[0] if len(pg) == 1 else None), cand)

buckets = collections.Counter(); review = []
for it in ai:
    b, pg, cand = resolve(it)
    buckets[b] += 1
    if b in ("multi-page", "ambiguous", "fuzzy-name"):
        review.append({"table": it["table"], "roll": it["roll_display"], "name": it["name"],
                       "type": it.get("subcategory"), "current_page": it["page"],
                       "bucket": b, "candidates": [list(x) for x in cand]})

typed = sum(1 for it in ai if it.get("subcategory"))
nii = sum(1 for it in ai if it["page_status"] != "filled")
print(f"items: {len(ai)} | typed(subcategory): {typed} | not_in_index: {nii}")
print("resolve buckets:", dict(buckets))
print(f"needs review (multi-page + ambiguous + fuzzy-name): {len(review)}")
out = ROOT / "data-review/review_remaining.json"
json.dump(review, open(out, "w"), ensure_ascii=False, indent=0)
print(f"wrote work-list -> {out.relative_to(ROOT)}  ({len(review)} items)")
