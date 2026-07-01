"""dataset.py — indexed, read-only view over the loaded models.

All range lookups go through ``find`` / ``find_nearest`` (bisect over sorted,
non-overlapping ``(roll_low, roll_high)`` ranges) so no engine or UI site
re-implements matching.  ``search`` powers the Library's live filter.
"""

from __future__ import annotations

import bisect

from . import loader
from .models import EnhRow, Item, MasterRow, MechRow, PowerTable


class Dataset:
    """Everything the engine and UI need, indexed for lookup and search."""

    def __init__(self, loaded: dict):
        self.items_by_table: dict[str, list[Item]] = loaded["items_by_table"]
        self.master_rows: list[MasterRow] = loaded["master_rows"]
        self.mech: dict[str, list[MechRow]] = loaded["mech"]
        self.power_by_num: dict[str, PowerTable] = loaded["power_by_num"]
        self.enhancement: list[EnhRow] = loaded["enhancement"]
        self._warnings: list[str] = list(loaded.get("warnings", []))

        # Cache the sorted low-bounds per row-list for bisect (keyed by identity).
        self._lows_cache: dict[int, list[int]] = {}

        # Flat search index for the Library: (item, lowercased haystack).
        self._search_index: list[tuple[Item, str]] = []
        for rows in self.items_by_table.values():
            for it in rows:
                hay = " ".join(str(x) for x in (
                    it.name, it.category, it.table, it.subcategory or "",
                    it.page if it.page is not None else "",
                )).lower()
                self._search_index.append((it, hay))

    # ---- classmethod constructor ----------------------------------------- #
    @classmethod
    def from_app(cls, app_dir) -> "Dataset":
        return cls(loader.load_all(app_dir))

    # ---- range lookups ---------------------------------------------------- #
    def _lows(self, rows) -> list[int]:
        key = id(rows)
        lows = self._lows_cache.get(key)
        if lows is None:
            lows = [r.roll_low for r in rows]
            self._lows_cache[key] = lows
        return lows

    def find(self, rows, roll: int):
        """Return the row whose ``[roll_low, roll_high]`` contains ``roll``, else None.

        Assumes ``rows`` is sorted ascending by ``roll_low`` (loader guarantees it).
        """
        if not rows:
            return None
        lows = self._lows(rows)
        idx = bisect.bisect_right(lows, roll) - 1
        if idx < 0:
            return None
        r = rows[idx]
        if r.roll_low <= roll <= r.roll_high:
            return r
        return None

    def find_nearest(self, rows, roll: int):
        """For a runtime gap (R1/S1): return ``(row, note)`` for the nearest range.

        Defensive fallback only — the shipped data tiles fully, so this should
        never fire.  ``note`` describes the distance for the trace.
        """
        if not rows:
            return None, "no rows"
        best = None
        best_dist = None
        for r in rows:
            if roll < r.roll_low:
                dist = r.roll_low - roll
            elif roll > r.roll_high:
                dist = roll - r.roll_high
            else:
                return r, "exact"
            if best_dist is None or dist < best_dist:
                best, best_dist = r, dist
        return best, f"nearest range {best.roll_low}-{best.roll_high}"

    # ---- search ----------------------------------------------------------- #
    def search(self, tokens: list[str]) -> list[Item]:
        """AND of lowercased tokens across name/category/table/subcategory/page."""
        toks = [t.lower() for t in tokens if t.strip()]
        if not toks:
            return [it for it, _ in self._search_index]
        return [it for it, hay in self._search_index
                if all(t in hay for t in toks)]

    @property
    def item_count(self) -> int:
        return len(self._search_index)

    # ---- diagnostics ------------------------------------------------------ #
    def data_warnings(self) -> list[str]:
        return list(self._warnings)
