"""format.py — display conventions + trace (de)serialization.

Roll-string display quirks (1000->"000", 100->"00", d1000 zero-padded to 3)
live ONLY here, never in engine math.  Also hosts RollStep <-> dict so the
History sidebar can persist and restore full traces across app restarts.
"""

from __future__ import annotations

from dataclasses import asdict

from ..engine.results import RollStep


def fmt_roll(die: int, rolled: int) -> str:
    """Render a rolled number the way the source book prints it."""
    if die == 0:                       # synthetic assembly/cap node — nothing rolled
        return ""
    if die == 1000:
        return "000" if rolled == 1000 else f"{rolled:03d}"
    if die == 100:
        return "00" if rolled == 100 else f"{rolled:02d}"
    return str(rolled)


def where_text(step: RollStep) -> str:
    """The 'S1 · d1000 → 604' middle column for a trace row."""
    if step.die == 0:
        return ""
    return f"d{step.die} → {fmt_roll(step.die, step.rolled)}"


def page_text(step) -> str:
    """Render a page reference.  ``page`` may be an int, a list of ints
    (an item printed across several pages), or None (not in index)."""
    p = getattr(step, "page", None)
    if step.page_status == "filled" and p is not None:
        if isinstance(p, list):
            return "pp." + ", ".join(str(x) for x in p)
        return f"p.{p}"
    if step.page_status == "not_in_index":
        return "not in index"
    return ""


def trace_lines(step: RollStep, depth: int = 0) -> list[str]:
    """Flatten a trace into indented text lines (for Copy / Export)."""
    indent = "    " * depth
    bits = []
    if step.table and step.die:
        bits.append(f"{step.table} · {where_text(step)}")
    bits.append(step.label)
    pg = page_text(step)
    if pg:
        bits.append(f"({pg})")
    line = indent + " · ".join(b for b in bits if b)
    if step.note:
        line += f"    [{step.note}]"
    out = [line]
    for c in step.children:
        out.extend(trace_lines(c, depth + 1))
    return out


def result_to_text(headline: str, root: RollStep, seed=None) -> str:
    lines = [headline, ""]
    lines.extend(trace_lines(root))
    if seed is not None:
        lines.append("")
        lines.append(f"seed {seed}")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# RollStep <-> dict (History persistence)
# --------------------------------------------------------------------------- #
def step_to_dict(step: RollStep) -> dict:
    return asdict(step)


def step_from_dict(d: dict) -> RollStep:
    return RollStep(
        table=d["table"], die=d["die"], rolled=d["rolled"], label=d["label"],
        page=d.get("page"), page_status=d.get("page_status", "n/a"),
        children=[step_from_dict(c) for c in d.get("children", [])],
        kind=d.get("kind", "roll"), note=d.get("note"),
    )
