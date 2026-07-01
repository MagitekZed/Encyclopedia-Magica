"""tab_artifact.py — Features 3 & 4: single artifact power + N-power artifact.

Generate supports both modes: **Random tables** (a random power table per slot)
or **Choose tables** (a combo per slot, each defaulting to 🎲 Random).  N is
validated; N above the soft cap is allowed with a note.  Duplicate tables are
legal (an artifact may have two powers from the same school).
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..engine.config import MAX_POWERS_SOFT
from .result_view import ResultView

ROLL_CAPABLE = True
RANDOM_LABEL = "🎲 Random"


class TabArtifact(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=8)
        self.app = app
        self.roll_capable = ROLL_CAPABLE
        self.nums = sorted(app.ds.power_by_num)
        self.choose_vars: list[tk.StringVar] = []

        # ---- Single power ------------------------------------------------- #
        single = ttk.LabelFrame(self, text="Single Power", padding=6)
        single.pack(fill="x")
        ttk.Label(single, text="Table:").pack(side="left")
        self.power_combo = ttk.Combobox(
            single, state="readonly", width=28,
            values=[RANDOM_LABEL] + [f"{n} — {app.ds.power_by_num[n].category}"
                                     for n in self.nums])
        self.power_combo.current(0)
        self.power_combo.pack(side="left", padx=6)
        ttk.Button(single, text="Roll Power",
                   command=self.roll_power).pack(side="left")

        # ---- Generate artifact ------------------------------------------- #
        gen = ttk.LabelFrame(self, text="Generate Artifact", padding=6)
        gen.pack(fill="x", pady=(8, 0))
        row = ttk.Frame(gen)
        row.pack(fill="x")
        ttk.Label(row, text="Powers (N):").pack(side="left")
        self.n_spin = ttk.Spinbox(row, from_=1, to=99, width=5,
                                  command=self._rebuild_choosers)
        self.n_spin.set("4")
        self.n_spin.pack(side="left", padx=(4, 12))

        self.mode = tk.StringVar(value="random")
        ttk.Radiobutton(row, text="Random tables", variable=self.mode,
                        value="random", command=self._on_mode).pack(side="left")
        ttk.Radiobutton(row, text="Choose tables", variable=self.mode,
                        value="choose", command=self._on_mode).pack(side="left")
        ttk.Button(row, text="Randomize all", command=self._randomize_all).pack(side="left", padx=8)
        ttk.Button(row, text="Generate", command=self.generate).pack(side="right")

        # Scrollable per-slot chooser area (shown only in "choose" mode).
        self.choose_wrap = ttk.Frame(gen)
        self.n_note = ttk.Label(gen, foreground="#8a4b00")

        self.view = ResultView(self, app)
        self.view.pack(fill="both", expand=True, pady=(8, 0))

    # ---- single power ----------------------------------------------------- #
    def roll_power(self):
        idx = self.power_combo.current()
        num = None if idx == 0 else self.nums[idx - 1]
        self.app.perform(lambda: self.app.engine.roll_artifact_power(num), self.view)

    def roll_default(self):
        self.roll_power()

    # ---- generate --------------------------------------------------------- #
    def _read_n(self):
        try:
            return int(self.n_spin.get())
        except ValueError:
            return None

    def _on_mode(self):
        if self.mode.get() == "choose":
            self._rebuild_choosers()
            self.choose_wrap.pack(fill="x", pady=(6, 0))    # inside `gen`, below the controls
        else:
            self.choose_wrap.pack_forget()

    def _rebuild_choosers(self):
        n = self._read_n()
        if n is None or n < 1:
            return
        self.n_note.configure(
            text=(f"Large artifact (N={n} > soft cap {MAX_POWERS_SOFT})."
                  if n > MAX_POWERS_SOFT else ""))
        if n > MAX_POWERS_SOFT:
            self.n_note.pack(anchor="w")
        else:
            self.n_note.pack_forget()

        if self.mode.get() != "choose":
            return
        prev = [v.get() for v in self.choose_vars]
        for child in self.choose_wrap.winfo_children():
            child.destroy()
        self.choose_vars = []
        values = [RANDOM_LABEL] + self.nums
        # cap visible choosers so a huge N doesn't build hundreds of widgets
        visible = min(n, 24)
        for i in range(visible):
            r = ttk.Frame(self.choose_wrap)
            r.pack(fill="x", pady=1)
            ttk.Label(r, text=f"Power {i + 1}:", width=10).pack(side="left")
            var = tk.StringVar(value=prev[i] if i < len(prev) else RANDOM_LABEL)
            cb = ttk.Combobox(r, state="readonly", width=12, values=values,
                              textvariable=var)
            cb.pack(side="left")
            ttk.Button(r, text="🎲", width=3,
                       command=lambda v=var: v.set(RANDOM_LABEL)).pack(side="left", padx=2)
            self.choose_vars.append(var)
        if n > visible:
            ttk.Label(self.choose_wrap,
                      text=f"(+{n - visible} more slots roll random)").pack(anchor="w")

    def _randomize_all(self):
        for v in self.choose_vars:
            v.set(RANDOM_LABEL)

    def _tables_arg(self, n):
        if self.mode.get() != "choose":
            return None
        tables = []
        for i in range(n):
            if i < len(self.choose_vars):
                val = self.choose_vars[i].get()
                tables.append(None if val == RANDOM_LABEL else val)
            else:
                tables.append(None)
        return tables

    def generate(self):
        n = self._read_n()
        if n is None or n < 1:
            self.app.flash("N must be a whole number ≥ 1.")
            return
        tables = self._tables_arg(n)
        try:
            res = self.app.perform(
                lambda: self.app.engine.generate_artifact(n, tables), self.view)
        except ValueError as exc:
            self.app.flash(str(exc))
            return
        if res is not None and res.root.note:
            self.app.flash(res.root.note)
