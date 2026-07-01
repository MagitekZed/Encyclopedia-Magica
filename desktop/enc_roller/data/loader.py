"""loader.py — the ONLY place that touches raw JSON or knows about quirks.

Reads ``app/*.json`` into typed models.  Ranges are always decoded through
``ranges.parse_range`` with the die **pinned** (never inferred).  Every file
read is wrapped so a single corrupt file degrades to a warning instead of a
crash, and the app runs with whatever loaded.  Tiling is checked generically;
real gaps/overlaps are recorded in ``warnings`` (never asserted).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .models import EnhRow, Item, MasterRow, MechRow, PowerEntry, PowerTable
from .ranges import parse_range

# A row whose name says "roll on table R3/S3" is the type-table catch-all.
CATCHALL_RE = re.compile(r"roll on\s+(the\s+)?table\s*[RS]3", re.I)

ITEM_TABLE_FILE = "all_items.json"
MASTER_FILE = "table_1_master.json"
MECH_FILE = "mechanics_type_bonus.json"
POWER_FILE = "artifact_tables/artifact_power_tables.json"
ENH_FILE = "artifact_tables/enchanted_enhancement.json"


def _read_json(path: Path, warnings: list[str]):
    """Read+parse one JSON file; on any failure record a warning and return None."""
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:                                  # noqa: BLE001
        warnings.append(f"FAILED to read {path}: {exc}")
        return None


def _tile_check(rows, die: int, label: str, warnings: list[str]) -> None:
    """Record any gap/overlap in a set of ``(roll_low, roll_high)`` ranges.

    Sorted, non-overlapping, contiguous 1..die is the expectation.  This never
    aborts — a real gap (e.g. artifact 1-16 @ 37) is a warning, not a crash.
    """
    ordered = sorted(rows, key=lambda r: (r.roll_low, r.roll_high))
    expect = 1
    for r in ordered:
        if r.roll_low > expect:
            warnings.append(f"{label}: gap at {expect}-{r.roll_low - 1}")
        elif r.roll_low < expect:
            warnings.append(f"{label}: overlap at {r.roll_low}-{expect - 1}")
        expect = max(expect, r.roll_high + 1)
    if expect - 1 < die:
        warnings.append(f"{label}: gap at {expect}-{die} (tail)")


# --------------------------------------------------------------------------- #
# Per-file loaders
# --------------------------------------------------------------------------- #
def load_items(app_dir: Path, warnings: list[str]) -> dict[str, list[Item]]:
    raw = _read_json(app_dir / ITEM_TABLE_FILE, warnings) or []
    by_table: dict[str, list[Item]] = {}
    for r in raw:
        try:
            it = Item(
                table=r["table"],
                category=r.get("category") or "",
                subcategory=r.get("subcategory"),
                roll_display=r.get("roll_display", ""),
                roll_low=int(r["roll_low"]),
                roll_high=int(r["roll_high"]),
                name=r.get("name") or "",
                reroll=bool(r.get("reroll", False)),
                page=r.get("page"),
                page_status=r.get("page_status", "filled"),
            )
        except (KeyError, TypeError, ValueError) as exc:
            warnings.append(f"{ITEM_TABLE_FILE}: bad item row {r!r}: {exc}")
            continue
        by_table.setdefault(it.table, []).append(it)
    for table, rows in by_table.items():
        rows.sort(key=lambda x: x.roll_low)
        _tile_check(rows, 1000, f"item table {table}", warnings)
    return by_table


def load_master(app_dir: Path, warnings: list[str]) -> list[MasterRow]:
    raw = _read_json(app_dir / MASTER_FILE, warnings) or []
    rows: list[MasterRow] = []
    for r in raw:
        # Authoritative range is the printed roll string; die pinned d100.
        lo, hi = parse_range(r["roll"], 100)
        rows.append(MasterRow(roll=r["roll"], roll_low=lo, roll_high=hi,
                              name=r.get("name") or "", target=r.get("target") or ""))
    rows.sort(key=lambda x: x.roll_low)
    _tile_check(rows, 100, "master", warnings)
    return rows


def load_mech(app_dir: Path, warnings: list[str]) -> dict[str, list[MechRow]]:
    raw = _read_json(app_dir / MECH_FILE, warnings) or {}
    mech: dict[str, list[MechRow]] = {}
    # R1/S1 are TYPE tables (d1000); R2/S2 are BONUS tables (d20). Die is pinned.
    pinned = {"R1": 1000, "R2": 20, "S1": 1000, "S2": 20}
    for key, die in pinned.items():
        out: list[MechRow] = []
        for r in raw.get(key, []):
            lo, hi = parse_range(r["roll"], die)
            name = r.get("name") or ""
            out.append(MechRow(
                table=key, roll=r["roll"], roll_low=lo, roll_high=hi,
                name=name, reroll=bool(r.get("reroll", False)),
                is_r3_catchall=bool(CATCHALL_RE.search(name)),
            ))
        out.sort(key=lambda x: x.roll_low)
        _tile_check(out, die, key, warnings)
        mech[key] = out
    return mech


def load_powers(app_dir: Path, warnings: list[str]) -> dict[str, PowerTable]:
    raw = _read_json(app_dir / POWER_FILE, warnings) or {}
    tables: dict[str, PowerTable] = {}
    for t in raw.get("power_tables", []):
        die = int(t["die"])
        entries: list[PowerEntry] = []
        for e in t["entries"]:
            lo, hi = parse_range(e["roll"], die)
            if hi < lo:                                      # backwards range -> swap + warn
                warnings.append(
                    f"power {t['num']}: backwards range {e['roll']} -> swapped")
                lo, hi = hi, lo
            entries.append(PowerEntry(roll=e["roll"], roll_low=lo, roll_high=hi,
                                      text=e.get("text") or ""))
        entries.sort(key=lambda x: x.roll_low)
        pt = PowerTable(num=t["num"], category=t.get("category") or "",
                        die=die, entries=entries, note=t.get("note"))
        _tile_check(entries, die, f"power {pt.num}", warnings)
        tables[pt.num] = pt
    return tables


def load_enhancement(app_dir: Path, warnings: list[str]) -> list[EnhRow]:
    raw = _read_json(app_dir / ENH_FILE, warnings) or {}
    die = int(raw.get("die", 100))
    rows: list[EnhRow] = []
    for e in raw.get("entries", []):                        # tolerate desc/descriptions_note keys
        lo, hi = parse_range(e["roll"], die)
        rows.append(EnhRow(roll=e["roll"], roll_low=lo, roll_high=hi,
                           type=e.get("type") or "", reroll=bool(e.get("reroll", False))))
    rows.sort(key=lambda x: x.roll_low)
    _tile_check(rows, die, "enhancement", warnings)
    return rows


def load_all(app_dir) -> dict:
    """Load every dataset file; return a dict of parsed pieces + ``warnings``.

    Never raises for data problems: missing/corrupt files and range anomalies
    are all funnelled into ``warnings`` so the caller (Dataset / Diagnostics)
    can surface them while the app keeps running.
    """
    app_dir = Path(app_dir)
    warnings: list[str] = []
    return {
        "items_by_table": load_items(app_dir, warnings),
        "master_rows": load_master(app_dir, warnings),
        "mech": load_mech(app_dir, warnings),
        "power_by_num": load_powers(app_dir, warnings),
        "enhancement": load_enhancement(app_dir, warnings),
        "warnings": warnings,
    }
