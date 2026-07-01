"""tab_single.py — Feature 1: roll on any single table.

The combo exposes every item table (A–T), the synthetic **Full Armor (R)** and
**Full Weapon (S)** (type+bonus+item), the raw R/S parts (R1/R2/S1/S2 and the
R3/S3 item lists), and every artifact power table.  A DieBadge shows which die
the current selection rolls so the mechanic stays transparent.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from .result_view import ResultView
from .widgets import DieBadge

ROLL_CAPABLE = True


def build_options(ds):
    """Return ``list[(label, key, die)]`` for the grouped selector."""
    cat = {m.target: m.name for m in ds.master_rows}    # A..Q, R, S names
    opts = []
    for L in "ABCDEFGHIJKLMNOPQ":
        if L in ds.items_by_table:
            opts.append((f"{L} — {cat.get(L, L)}", L, 1000))
    opts.append(("T — Artifacts", "T", 1000))
    opts.append(("———  Full assemblies  ———", None, 0))
    opts.append(("Full Armor (R): type + bonus + item", "R", 1000))
    opts.append(("Full Weapon (S): type + bonus + item", "S", 1000))
    opts.append(("———  Armor / Weapon parts  ———", None, 0))
    opts.append(("R1 — Armor type", "R1", 1000))
    opts.append(("R2 — Armor bonus", "R2", 20))
    opts.append(("R3 — Armor items (list only)", "R3", 1000))
    opts.append(("S1 — Weapon type", "S1", 1000))
    opts.append(("S2 — Weapon bonus", "S2", 20))
    opts.append(("S3 — Weapon items (list only)", "S3", 1000))
    opts.append(("———  Artifact powers  ———", None, 0))
    for num in sorted(ds.power_by_num):
        pt = ds.power_by_num[num]
        opts.append((f"{num} — {pt.category}", num, pt.die))
    return opts


class TabSingle(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=8)
        self.app = app
        self.roll_capable = ROLL_CAPABLE
        self.options = build_options(app.ds)
        self._by_label = {lbl: (key, die) for lbl, key, die in self.options}

        bar = ttk.Frame(self)
        bar.pack(fill="x")
        ttk.Label(bar, text="Table:").pack(side="left")
        self.combo = ttk.Combobox(bar, state="readonly", width=44,
                                  values=[lbl for lbl, _, _ in self.options])
        self.combo.pack(side="left", padx=6)
        self.combo.bind("<<ComboboxSelected>>", lambda e: self._on_select())
        self.badge = DieBadge(bar)
        self.badge.pack(side="left", padx=6)
        ttk.Button(bar, text="Roll", command=self.roll_default).pack(side="left", padx=6)

        # default to the first real (rollable) option
        first = next(i for i, (_, k, _) in enumerate(self.options) if k is not None)
        self.combo.current(first)
        self._on_select()

        self.view = ResultView(self, app)
        self.view.pack(fill="both", expand=True, pady=(8, 0))

    def _current(self):
        lbl = self.combo.get()
        return self._by_label.get(lbl, (None, 0))

    def _on_select(self):
        key, die = self._current()
        if key is None:                 # a separator row — snap to the next real option
            idx = self.combo.current()
            for j in range(idx + 1, len(self.options)):
                if self.options[j][1] is not None:
                    self.combo.current(j)
                    key, die = self.options[j][1], self.options[j][2]
                    break
        self.badge.set(die)

    def roll_default(self):
        key, _ = self._current()
        if key is None:
            return
        self.app.perform(lambda: self.app.engine.roll_named(key), self.view)

    def select_key(self, key):
        """Jump the combo to a given table key (used by Library 'Roll this table')."""
        for i, (_, k, _) in enumerate(self.options):
            if k == key:
                self.combo.current(i)
                self._on_select()
                return
