"""app.py — main window, header, Notebook, History sidebar, and the controller.

The App owns the engine and the seed seam: every roll goes through ``perform``,
which builds a ``DefaultRoller`` (locked seed or fresh), runs the action's
thunk, shows the result, and logs it.  ``reroll`` re-runs the last thunk under a
new seed; ``replay`` re-runs it under the same seed for an identical result.
"""

from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText

from ..diagnostics import build_report
from ..engine.dice import DefaultRoller
from ..engine.engine import RollEngine
from .history_panel import HistoryPanel
from .tab_artifact import TabArtifact
from .tab_library import TabLibrary
from .tab_random import TabRandom
from .tab_single import TabSingle

TAB_ORDER = [("Random Item", TabRandom), ("Single Table", TabSingle),
             ("Artifacts", TabArtifact), ("Library", TabLibrary)]
TEXT_WIDGET_CLASSES = {"Entry", "TEntry", "Spinbox", "TCombobox", "Text"}


class App:
    def __init__(self, root, ds, history_path, seed=None):
        self.root = root
        self.ds = ds
        self.engine = RollEngine(ds, DefaultRoller(seed))

        self.current_seed = None
        self.action_count = 0
        self.last_thunk = None
        self.last_view = None
        self._flash_after = None

        self._build_header(seed)
        self._build_body(history_path)
        self._build_statusbar()
        self._bind_shortcuts()

        self.select_tab("Random Item")
        if any("FAILED" in w for w in ds.data_warnings()):
            self.show_diagnostics()

    # ================================================================== #
    # Layout
    # ================================================================== #
    def _build_header(self, seed):
        hdr = ttk.Frame(self.root, padding=(8, 6))
        hdr.pack(fill="x")
        ttk.Label(hdr, text="Enc. Magica Roller",
                  font=("Helvetica", 14, "bold")).pack(side="left")
        ttk.Button(hdr, text="🎲 Random Item",
                   command=self.header_random).pack(side="left", padx=(12, 0))

        ttk.Button(hdr, text="⚙ Diagnostics",
                   command=self.show_diagnostics).pack(side="right")
        ttk.Button(hdr, text="History ⇄",
                   command=self.toggle_history).pack(side="right", padx=6)

        seedbox = ttk.Frame(hdr)
        seedbox.pack(side="right", padx=6)
        ttk.Label(seedbox, text="seed:").pack(side="left")
        self.seed_var = tk.StringVar(value="" if seed is None else str(seed))
        ttk.Entry(seedbox, textvariable=self.seed_var, width=11).pack(side="left")
        self.lock_var = tk.BooleanVar(value=seed is not None)
        ttk.Checkbutton(seedbox, text="🔒", variable=self.lock_var).pack(side="left")
        self.count_lbl = ttk.Label(seedbox, text="#0", foreground="#666")
        self.count_lbl.pack(side="left", padx=(4, 0))

    def _build_body(self, history_path):
        body = ttk.Frame(self.root)
        body.pack(fill="both", expand=True)

        self.nb = ttk.Notebook(body)
        self.nb.pack(side="left", fill="both", expand=True)
        self.tabs = {}
        self._frames = {}
        for name, cls in TAB_ORDER:
            tab = cls(self.nb, self)
            self.nb.add(tab, text=name)
            self.tabs[name] = tab
            self._frames[name] = tab

        self.history = HistoryPanel(body, self, history_path)
        self._history_visible = True
        self.history.pack(side="right", fill="y")

    def _build_statusbar(self):
        self.status = ttk.Label(self.root, text="Ready.", anchor="w",
                                foreground="#555", padding=(8, 2))
        self.status.pack(fill="x", side="bottom")

    # ================================================================== #
    # The roll seam
    # ================================================================== #
    def _make_roller(self):
        if self.lock_var.get():
            try:
                s = int(self.seed_var.get())
            except (ValueError, TypeError):
                s = None
            return DefaultRoller(s)
        return DefaultRoller(None)

    def _run(self, thunk, view, seed_roller, *, log, count):
        self.engine.roller = seed_roller
        try:
            result = thunk()
        except ValueError as exc:
            self.flash(str(exc))
            return None
        self.current_seed = seed_roller.seed
        self.last_thunk = thunk
        self.last_view = view
        if count:
            self.action_count += 1
        self.seed_var.set(str(seed_roller.seed))
        self.count_lbl.configure(text=f"#{self.action_count}")
        view.show(result, seed=seed_roller.seed, index=self.action_count)
        if log:
            self.history.add(result, seed=seed_roller.seed)
        return result

    def perform(self, thunk, view):
        return self._run(thunk, view, self._make_roller(), log=True, count=True)

    def reroll(self):
        if self.last_thunk is None:
            return
        self._run(self.last_thunk, self.last_view, DefaultRoller(None),
                  log=True, count=True)

    def replay(self):
        if self.last_thunk is None or self.current_seed is None:
            return
        self._run(self.last_thunk, self.last_view, DefaultRoller(self.current_seed),
                  log=False, count=False)

    def header_random(self):
        self.select_tab("Random Item")
        self.tabs["Random Item"].roll_default()

    # ================================================================== #
    # Navigation / chrome
    # ================================================================== #
    def select_tab(self, name):
        self.nb.select(self._frames[name])

    def _active_tab(self):
        return self.nb.nametowidget(self.nb.select())

    def toggle_history(self):
        if self._history_visible:
            self.history.pack_forget()
        else:
            self.history.pack(side="right", fill="y")
        self._history_visible = not self._history_visible

    def flash(self, msg):
        self.status.configure(text=msg)
        if self._flash_after is not None:
            self.root.after_cancel(self._flash_after)
        self._flash_after = self.root.after(4000,
                                            lambda: self.status.configure(text="Ready."))

    def show_diagnostics(self):
        report, ok = build_report(self.ds)
        top = tk.Toplevel(self.root)
        top.title("Diagnostics — data self-test")
        top.geometry("620x460")
        txt = ScrolledText(top, wrap="word", font=("Menlo", 11))
        txt.pack(fill="both", expand=True)
        txt.insert("1.0", report)
        txt.configure(state="disabled")

    # ================================================================== #
    # Keyboard shortcuts
    # ================================================================== #
    def _bind_shortcuts(self):
        r = self.root
        r.bind("<Control-r>", lambda e: self.reroll())
        r.bind("<Control-z>", lambda e: self._back())
        r.bind("<Control-h>", lambda e: self.toggle_history())
        r.bind("<Control-f>", lambda e: self._focus_search())
        for i, (name, _) in enumerate(TAB_ORDER, 1):
            r.bind(str(i), lambda e, n=name: self._digit_switch(n))
        r.bind("<r>", lambda e: self._roll_active())
        r.bind("<R>", lambda e: self._roll_active())
        r.bind("<space>", lambda e: self._roll_active())

    def _typing(self):
        w = self.root.focus_get()
        return w is not None and w.winfo_class() in TEXT_WIDGET_CLASSES

    def _roll_active(self):
        if self._typing():
            return
        tab = self._active_tab()
        if getattr(tab, "roll_capable", False):
            tab.roll_default()

    def _digit_switch(self, name):
        if not self._typing():
            self.select_tab(name)

    def _back(self):
        tab = self._active_tab()
        view = getattr(tab, "view", None)
        if view is not None:
            view.go_back()

    def _focus_search(self):
        self.select_tab("Library")
        self.tabs["Library"].focus_search()


def launch(app_dir, seed=None):
    from ..data.dataset import Dataset

    root = tk.Tk()
    root.title("Encyclopedia Magica Roller")
    root.geometry("1060x700")
    ds = Dataset.from_app(app_dir)
    history_path = Path(app_dir).parent / "history.json"
    App(root, ds, history_path, seed=seed)
    root.mainloop()
