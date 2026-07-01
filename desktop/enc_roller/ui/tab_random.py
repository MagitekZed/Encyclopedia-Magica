"""tab_random.py — Feature 2 + 5 (fully random item + cascade) and the hoard.

This is the opening tab: one prominent verb, plus a Treasure Hoard batch.
A master-gap result (defensive; the shipped master tiles fully) shows a calm,
actionable banner instead of a dead end.
"""

from __future__ import annotations

from tkinter import ttk

from .result_view import ResultView

ROLL_CAPABLE = True


class TabRandom(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=8)
        self.app = app
        self.roll_capable = ROLL_CAPABLE

        bar = ttk.Frame(self)
        bar.pack(fill="x")
        ttk.Button(bar, text="🎲  Roll Random Magic Item",
                   command=self.roll_default).pack(side="left", ipady=4)

        hoard = ttk.Frame(bar)
        hoard.pack(side="right")
        ttk.Label(hoard, text="Treasure Hoard:").pack(side="left")
        self.hoard_n = ttk.Spinbox(hoard, from_=1, to=999, width=5)
        self.hoard_n.set("12")
        self.hoard_n.pack(side="left", padx=(4, 4))
        ttk.Button(hoard, text="Roll Hoard", command=self.roll_hoard).pack(side="left")

        # Master-gap banner (hidden until needed).
        self.banner = ttk.Frame(self, padding=6)
        self.banner_lbl = ttk.Label(self.banner, foreground="#8a4b00",
                                    wraplength=560, justify="left")
        self.banner_lbl.pack(side="left", fill="x", expand=True)
        ttk.Button(self.banner, text="Pick category",
                   command=lambda: self.app.select_tab("Single Table")).pack(side="right")

        self.view = ResultView(self, app)
        self.view.pack(fill="both", expand=True, pady=(8, 0))

    def roll_default(self):
        res = self.app.perform(lambda: self.app.engine.roll_random_item(), self.view)
        self._banner_for(res)

    def roll_hoard(self):
        try:
            k = int(self.hoard_n.get())
        except ValueError:
            self.app.flash("Hoard size must be a whole number.")
            return
        if k < 1:
            self.app.flash("Hoard size must be at least 1.")
            return
        self.app.perform(lambda: self.app.engine.roll_hoard(k), self.view)
        self._hide_banner()

    def _banner_for(self, res):
        if res is not None and res.root.kind == "gap":
            self.banner_lbl.configure(text=res.root.label + " — pick a category or reroll.")
            self.banner.pack(fill="x", before=self.view)
        else:
            self._hide_banner()

    def _hide_banner(self):
        self.banner.pack_forget()
