"""Shared test fixtures — the real Dataset + data-driven roll finders.

Tests assert against the REAL ``app/*.json`` (per the spec).  Rather than
hard-coding roll values that could drift if the data is re-fixed, these helpers
derive the exact roll a scripted ``FixedRoller`` needs from the dataset itself.
Zero tkinter is imported anywhere in this package.
"""

from __future__ import annotations

import functools
from pathlib import Path

from enc_roller.data.dataset import Dataset

APP_DIR = Path(__file__).resolve().parent.parent.parent / "app"   # repo-root/app, from desktop/tests/


@functools.lru_cache(maxsize=1)
def get_dataset() -> Dataset:
    return Dataset.from_app(APP_DIR)


def first_reroll_item(ds: Dataset, table: str, exclude_ee: bool = True):
    for it in ds.items_by_table[table]:
        if it.reroll and (not exclude_ee or it.name != "Enchanted Enhancements"):
            return it
    raise AssertionError(f"no reroll item in table {table}")


def first_plain_item(ds: Dataset, table: str):
    for it in ds.items_by_table[table]:
        if not it.reroll:
            return it
    raise AssertionError(f"no plain item in table {table}")


def ee_item(ds: Dataset, table: str):
    for it in ds.items_by_table[table]:
        if it.name == "Enchanted Enhancements":
            return it
    raise AssertionError(f"no Enchanted Enhancements item in table {table}")


def first_reroll_enh_roll(ds: Dataset) -> int:
    """A d100 value landing on a reroll=True enhancement row (e.g. Aquatic)."""
    for row in ds.enhancement:
        if row.reroll:
            return row.roll_low
    raise AssertionError("no reroll enhancement row")


def mech_row_roll(ds: Dataset, key: str, name_substr: str) -> int:
    """roll_low of the R/S sub-table row whose name contains ``name_substr``."""
    for r in ds.mech[key]:
        if name_substr.lower() in r.name.lower():
            return r.roll_low
    raise AssertionError(f"no {key} row matching {name_substr!r}")


def catchall_roll(ds: Dataset, key: str) -> int:
    """roll_low of the 'Special (Roll on Table R3/S3)' catch-all in R1/S1."""
    for r in ds.mech[key]:
        if r.is_r3_catchall:
            return r.roll_low
    raise AssertionError(f"no catch-all row in {key}")
