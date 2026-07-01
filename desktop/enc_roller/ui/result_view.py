"""result_view.py — the shared result renderer: headline + trace + footer.

Renders a ``RollResult`` (headline zone + expandable trace tree) and offers
Copy / Reroll (new seed) / Replay (same seed) / ← Previous.  Reroll & Replay
delegate to the App controller, which re-runs the last action's thunk under a
new or identical seed.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from .format import result_to_text
from .widgets import make_trace_tree, populate_trace


class ResultView(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=(4, 4))
        self.app = app
        self._current = None            # (result, seed, index)
        self._back_stack = []

        self.headline = ttk.Label(self, text="Roll something to begin.",
                                  font=("Helvetica", 15, "bold"),
                                  anchor="w", justify="left", wraplength=560)
        self.headline.pack(fill="x", pady=(0, 6))

        tree_wrap = ttk.Frame(self)
        tree_wrap.pack(fill="both", expand=True)
        self.tree = make_trace_tree(tree_wrap)
        vsb = ttk.Scrollbar(tree_wrap, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        tree_wrap.rowconfigure(0, weight=1)
        tree_wrap.columnconfigure(0, weight=1)

        footer = ttk.Frame(self)
        footer.pack(fill="x", pady=(6, 0))
        self.seed_lbl = ttk.Label(footer, text="", foreground="#666")
        self.seed_lbl.pack(side="left")

        self.back_btn = ttk.Button(footer, text="← Previous", width=11,
                                   command=self.go_back, state="disabled")
        self.back_btn.pack(side="right", padx=2)
        ttk.Button(footer, text="Replay", width=8,
                   command=self.app.replay).pack(side="right", padx=2)
        ttk.Button(footer, text="Reroll", width=8,
                   command=self.app.reroll).pack(side="right", padx=2)
        ttk.Button(footer, text="Copy", width=7,
                   command=self.copy).pack(side="right", padx=2)

    # ---- rendering -------------------------------------------------------- #
    def show(self, result, seed=None, index=None, push_back=True):
        if push_back and self._current is not None:
            self._back_stack.append(self._current)
            self.back_btn.configure(state="normal")
        self._current = (result, seed, index)
        self.headline.configure(text=result.headline)
        populate_trace(self.tree, result.root)
        parts = []
        if seed is not None:
            parts.append(f"seed {seed}")
        if index is not None:
            parts.append(f"roll #{index}")
        self.seed_lbl.configure(text="  ·  ".join(parts))

    def go_back(self):
        if not self._back_stack:
            return
        result, seed, index = self._back_stack.pop()
        self.show(result, seed, index, push_back=False)
        if not self._back_stack:
            self.back_btn.configure(state="disabled")

    def copy(self):
        if self._current is None:
            return
        result, seed, _ = self._current
        text = result_to_text(result.headline, result.root, seed)
        self.clipboard_clear()
        self.clipboard_append(text)
        self.app.flash("Result copied to clipboard.")
