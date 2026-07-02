"""results.py — the trace tree the engine returns.

Every mechanic produces a ``RollResult`` whose ``.root`` is a ``RollStep``
tree.  Cascade / multi-part / combine logic lives in exactly one place and is
unit-tested against the tree; "explain this roll" is free because the trace
*is* the explanation.  Display conventions (000/00 padding) live only in the
renderer, never here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterator


@dataclass
class RollStep:
    table: str                 # "A","R1","master","enh","power:1-15","armor","artifact"...
    die: int                   # 1000/100/20/10; 0 for synthetic assembly nodes
    rolled: int                # the number rolled; 0 for synthetic nodes
    label: str                 # matched entry / item name / power text
    page: int | list | None    # int, list of ints (multi-page item), or None
    page_status: str           # "filled" | "not_in_index" | "n/a"
    children: list["RollStep"] = field(default_factory=list)
    kind: str = "roll"         # roll | assembly | cap | gap | reroll | enhancement
    note: str | None = None    # human-readable annotation
    summary: str | None = None # resolved display name (set on hoard item roots)

    def walk(self) -> Iterator["RollStep"]:
        """Depth-first iterator over this node and all descendants."""
        yield self
        for c in self.children:
            yield from c.walk()

    def count_kinds(self, kinds) -> int:
        """How many nodes in the subtree have ``kind`` in ``kinds``."""
        return sum(1 for n in self.walk() if n.kind in kinds)


@dataclass
class RollResult:
    kind: str                  # single | random_item | artifact_power | artifact | hoard
    headline: str
    root: RollStep
    seed: int | None
