"""history_panel.py — persisted, pinnable roll log (shared sidebar).

Every result is logged with headline + seed + timestamp and its full trace, so
a hoard built over a prep session survives an app restart.  Pinned entries are
kept above the live cap; batch rolls (hoard/artifact) are one collapsible entry
whose children show in the detail popup.
"""

from __future__ import annotations

import datetime
import json
import tkinter as tk
from tkinter import filedialog, ttk

from .format import (ensure_hoard_summaries, hoard_block, result_to_text,
                     step_from_dict, step_to_dict, trace_lines)
from .widgets import make_trace_tree, populate_trace, set_open_all

LIVE_CAP = 200


class HistoryPanel(ttk.Frame):
    def __init__(self, parent, app, path):
        super().__init__(parent, padding=(4, 4))
        self.app = app
        self.path = path
        self.entries: list[dict] = []
        self._seq = 0

        ttk.Label(self, text="History", font=("Helvetica", 12, "bold")).pack(
            anchor="w")

        wrap = ttk.Frame(self)
        wrap.pack(fill="both", expand=True, pady=(4, 4))
        self.tree = ttk.Treeview(wrap, columns=("seed",), show="tree",
                                 selectmode="browse", height=18)
        self.tree.column("#0", width=210, stretch=True)
        vsb = ttk.Scrollbar(wrap, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        self.tree.tag_configure("pinned", foreground="#b3541e")
        self.tree.bind("<Double-1>", lambda e: self.open_selected())
        self.tree.bind("<Return>", lambda e: self.open_selected())

        btns = ttk.Frame(self)
        btns.pack(fill="x")
        ttk.Button(btns, text="Pin", width=5, command=self.toggle_pin).pack(side="left")
        ttk.Button(btns, text="View", width=6, command=self.open_selected).pack(side="left")
        ttk.Button(btns, text="Export", width=7, command=self.export).pack(side="left")
        ttk.Button(btns, text="Clear", width=6, command=self.clear).pack(side="left")

        self._load()
        self._refresh()

    # ---- mutation --------------------------------------------------------- #
    def add(self, result, seed=None):
        self._seq += 1
        entry = {
            "id": f"h{self._seq}",
            "headline": result.headline,
            "kind": result.kind,
            "seed": seed,
            "ts": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "pinned": False,
            "root": step_to_dict(result.root),
        }
        self.entries.append(entry)
        self._enforce_cap()
        self._save()
        self._refresh()

    def toggle_pin(self):
        e = self._selected_entry()
        if e:
            e["pinned"] = not e["pinned"]
            self._save()
            self._refresh()

    def clear(self):
        # Keep pinned keepers; drop the rest.
        self.entries = [e for e in self.entries if e["pinned"]]
        self._save()
        self._refresh()

    def _enforce_cap(self):
        live = [e for e in self.entries if not e["pinned"]]
        if len(live) > LIVE_CAP:
            drop = len(live) - LIVE_CAP
            trimmed, dropped = [], 0
            for e in self.entries:
                if not e["pinned"] and dropped < drop:
                    dropped += 1
                    continue
                trimmed.append(e)
            self.entries = trimmed

    # ---- display ---------------------------------------------------------- #
    def _refresh(self):
        self.tree.delete(*self.tree.get_children())
        pinned = [e for e in self.entries if e["pinned"]]
        live = [e for e in self.entries if not e["pinned"]]
        for e in reversed(pinned):
            self._insert_row(e)
        for e in reversed(live):
            self._insert_row(e)

    def _insert_row(self, e):
        prefix = "📌 " if e["pinned"] else ""
        label = prefix + (e.get("label") or e["headline"])
        tags = ("pinned",) if e["pinned"] else ()
        self.tree.insert("", "end", iid=e["id"], text=label, tags=tags)

    def _selected_entry(self):
        sel = self.tree.selection()
        if not sel:
            return None
        return next((e for e in self.entries if e["id"] == sel[0]), None)

    def open_selected(self):
        e = self._selected_entry()
        if e:
            self._popup(e)

    def _popup(self, e):
        top = tk.Toplevel(self)
        top.title(e["headline"][:60])
        top.geometry("640x420")
        ttk.Label(top, text=e["headline"], font=("Helvetica", 13, "bold"),
                  wraplength=600, anchor="w", justify="left").pack(fill="x", padx=8, pady=6)
        meta = f"{e['kind']} · {e['ts']}" + (f" · seed {e['seed']}" if e.get("seed") is not None else "")
        ttk.Label(top, text=meta, foreground="#666").pack(anchor="w", padx=8)
        bar = ttk.Frame(top)
        bar.pack(fill="x", padx=8)
        ttk.Button(bar, text="Expand all", width=11,
                   command=lambda: set_open_all(tree, True)).pack(side="left", padx=(0, 2))
        ttk.Button(bar, text="Collapse all", width=12,
                   command=lambda: set_open_all(tree, False)).pack(side="left")
        wrap = ttk.Frame(top)
        wrap.pack(fill="both", expand=True, padx=8, pady=6)
        tree = make_trace_tree(wrap)
        tree.pack(side="left", fill="both", expand=True)
        vsb = ttk.Scrollbar(wrap, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        root = step_from_dict(e["root"])
        if root.table == "hoard":
            ensure_hoard_summaries(root, self.app.engine)   # heal pre-summary hoards
        populate_trace(tree, root)

        def copy():
            top.clipboard_clear()
            top.clipboard_append(result_to_text(e["headline"], root, e.get("seed")))
        ttk.Button(top, text="Copy", command=copy).pack(pady=(0, 8))

    # ---- export / persistence -------------------------------------------- #
    def export(self):
        if not self.entries:
            self.app.flash("Nothing to export.")
            return
        fname = filedialog.asksaveasfilename(
            title="Export history", defaultextension=".txt",
            filetypes=[("Text", "*.txt"), ("Markdown", "*.md"),
                       ("JSON", "*.json"), ("All", "*.*")])
        if not fname:
            return
        try:
            if fname.lower().endswith(".json"):
                with open(fname, "w", encoding="utf-8") as fh:
                    json.dump(self.entries, fh, indent=2)
            else:
                blocks = []
                for e in self.entries:
                    root = step_from_dict(e["root"])
                    head = ("📌 " if e["pinned"] else "") + e["headline"]
                    if root.table == "hoard":                # lead with the manifest (same block as Copy)
                        ensure_hoard_summaries(root, self.app.engine)
                        body = "\n".join(hoard_block(root) + trace_lines(root))
                    else:
                        body = "\n".join(trace_lines(root))
                    seed = f"\nseed {e['seed']}" if e.get("seed") is not None else ""
                    blocks.append(f"{head}\n{body}{seed}\n({e['ts']})")
                with open(fname, "w", encoding="utf-8") as fh:
                    fh.write("\n\n".join(blocks))
            self.app.flash(f"Exported {len(self.entries)} entries.")
        except OSError as exc:
            self.app.flash(f"Export failed: {exc}")

    def _load(self):
        try:
            with open(self.path, encoding="utf-8") as fh:
                self.entries = json.load(fh)
            self._seq = len(self.entries)
            # normalise ids so new ones never collide with loaded ones
            for i, e in enumerate(self.entries, 1):
                e["id"] = f"h{i}"
            self._seq = len(self.entries)
        except (OSError, ValueError):
            self.entries = []

    def _save(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.path, "w", encoding="utf-8") as fh:
                json.dump(self.entries, fh, indent=2)
        except OSError:
            pass                        # persistence is best-effort; never block a roll
