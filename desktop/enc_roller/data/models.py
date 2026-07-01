"""models.py — typed value objects for the dataset.

Every "row" type exposes ``roll_low`` / ``roll_high`` so a single generic
``Dataset.find`` (bisect over sorted ranges) works across all of them.
Loading and quirk-fixing happen in ``loader.py``; these are plain data.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Item:
    """One row of an item table (A-Q, R3, S3, T).  Die is always d1000."""
    table: str
    category: str
    subcategory: str | None
    roll_display: str
    roll_low: int
    roll_high: int
    name: str
    reroll: bool
    page: int | list | None     # some items span several pages -> list of ints
    page_status: str            # "filled" | "not_in_index"


@dataclass
class MasterRow:
    """One row of the d100 master category table."""
    roll: str
    roll_low: int
    roll_high: int
    name: str                   # category name, e.g. "Weapons"
    target: str                 # 'A'..'Q', 'R', 'S'


@dataclass
class MechRow:
    """One row of an R/S mechanics sub-table (R1/R2/S1/S2).

    R1/S1 are item TYPE tables (d1000); R2/S2 are magic BONUS tables (d20).
    ``is_r3_catchall`` marks the "Special (Roll on Table R3/S3)" row.
    """
    table: str                  # "R1" | "R2" | "S1" | "S2"
    roll: str
    roll_low: int
    roll_high: int
    name: str
    reroll: bool = False
    is_r3_catchall: bool = False


@dataclass
class PowerEntry:
    """One entry of an artifact power table."""
    roll: str
    roll_low: int
    roll_high: int
    text: str

    @property
    def name(self) -> str:      # uniform label access for _match_or_gap
        return self.text


@dataclass
class PowerTable:
    """An artifact power table ('1-00'..'1-24')."""
    num: str
    category: str
    die: int                    # 20 | 100 | 10
    entries: list[PowerEntry]
    note: str | None = None


@dataclass
class EnhRow:
    """One row of the d100 Enchanted-Enhancement selector."""
    roll: str
    roll_low: int
    roll_high: int
    type: str
    reroll: bool

    @property
    def name(self) -> str:
        return self.type
