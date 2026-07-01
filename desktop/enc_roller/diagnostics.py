"""diagnostics.py — the tiling/gap self-test, shared by `--verify` and the UI.

Independently re-derives tiling for every table (rather than trusting the
loader) and turns the known data holes into a copy-pasteable ticket report.
The one *expected* hole — artifact table 1-16 @ roll 37 — does not fail the
self-test; anything else does.
"""

from __future__ import annotations

from .data.dataset import Dataset

# The single faithful source omission we ship with (engine re-rolls the slot).
EXPECTED_GAPS = {"power 1-16": [(37, 37)]}


def _tiling(rows, die: int):
    ordered = sorted(rows, key=lambda r: (r.roll_low, r.roll_high))
    expect, gaps, overlaps = 1, [], []
    for r in ordered:
        if r.roll_low > expect:
            gaps.append((expect, r.roll_low - 1))
        elif r.roll_low < expect:
            overlaps.append((r.roll_low, expect - 1))
        expect = max(expect, r.roll_high + 1)
    if expect - 1 < die:
        gaps.append((expect, die))
    return gaps, overlaps


def _groups(ds: Dataset):
    yield ("master", ds.master_rows, 100)
    for k in ("R1", "R2", "S1", "S2"):
        yield (k, ds.mech[k], 1000 if k in ("R1", "S1") else 20)
    for t, rows in sorted(ds.items_by_table.items()):
        yield (f"item {t}", rows, 1000)
    for num, pt in sorted(ds.power_by_num.items()):
        yield (f"power {num}", pt.entries, pt.die)
    yield ("enhancement", ds.enhancement, 100)


def build_report(ds: Dataset):
    """Return ``(report_text, ok)``.  ``ok`` is False only for UNEXPECTED holes."""
    lines = [
        "Encyclopedia Magica Roller — data self-test",
        "=" * 44,
        f"Items loaded          : {ds.item_count}",
        f"Item tables           : {', '.join(sorted(ds.items_by_table))}",
        f"Master rows           : {len(ds.master_rows)}  (d100)",
        f"Mechanics sub-tables  : {', '.join(sorted(ds.mech))}",
        f"Artifact power tables : {len(ds.power_by_num)}  (1-00 … 1-24)",
        f"Enhancement rows      : {len(ds.enhancement)}  (d100)",
        "",
    ]

    unexpected = []
    anomalies = []
    for label, rows, die in _groups(ds):
        gaps, overlaps = _tiling(rows, die)
        if not gaps and not overlaps:
            continue
        anomalies.append((label, gaps, overlaps))
        if EXPECTED_GAPS.get(label) == gaps and not overlaps:
            continue
        unexpected.append((label, gaps, overlaps))

    if anomalies:
        lines.append("Tiling anomalies:")
        for label, gaps, overlaps in anomalies:
            tag = "" if (EXPECTED_GAPS.get(label) == gaps and not overlaps) else "  ** UNEXPECTED **"
            if gaps:
                lines.append(f"  {label}: gap(s) {gaps}{tag}")
            if overlaps:
                lines.append(f"  {label}: overlap(s) {overlaps}{tag}")
    else:
        lines.append("Tiling: every table tiles fully — no gaps, no overlaps.")

    lines.append("")
    lines.append("Known faithful data hole (non-blocking):")
    lines.append("  - Artifact table 1-16 has no entry for roll 37 (source omission).")
    lines.append("    The engine re-rolls that slot when generating artifacts.")

    if ds.data_warnings():
        lines.append("")
        lines.append("Loader warnings:")
        for w in ds.data_warnings():
            lines.append(f"  - {w}")

    lines.append("")
    lines.append("SELF-TEST: " + ("PASS" if not unexpected
                                   else f"FAIL — {len(unexpected)} unexpected anomaly(ies)"))
    return "\n".join(lines), not unexpected


def run_self_test(app_dir) -> tuple[str, bool]:
    return build_report(Dataset.from_app(app_dir))
