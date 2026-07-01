"""tab_library.py — Feature 6: searchable browser of every item table.

Live substring filter (AND of tokens over name/category/table/subcategory/page,
debounced ~150 ms), a table filter, sortable columns, an item count, and a
detail popover with a one-click "Roll this table" that jumps to Single Table.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from .format import page_text

ROLL_CAPABLE = False
DEBOUNCE_MS = 150
COLUMNS = ("table", "roll", "name", "page", "reroll")
HEADINGS = {"table": "Table", "roll": "Roll", "name": "Name",
            "page": "Page", "reroll": "Reroll?"}


class TabLibrary(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=8)
        self.app = app
        self.roll_capable = ROLL_CAPABLE
        self._after = None
        self._rows = []                 # currently displayed Items
        self._sort_col = None
        self._sort_rev = False

        bar = ttk.Frame(self)
        bar.pack(fill="x")
        ttk.Label(bar, text="Search:").pack(side="left")
        self.query = tk.StringVar()
        self.entry = ttk.Entry(bar, textvariable=self.query, width=32)
        self.entry.pack(side="left", padx=6)
        self.entry.bind("<KeyRelease>", lambda e: self._schedule())
        self.entry.bind("<Escape>", lambda e: self.clear_search())

        ttk.Label(bar, text="Table:").pack(side="left", padx=(8, 0))
        self.table_filter = ttk.Combobox(bar, state="readonly", width=8,
                                         values=["All"] + sorted(app.ds.items_by_table))
        self.table_filter.current(0)
        self.table_filter.pack(side="left", padx=6)
        self.table_filter.bind("<<ComboboxSelected>>", lambda e: self.refilter())

        self.count = ttk.Label(bar, text="", foreground="#666")
        self.count.pack(side="right")

        wrap = ttk.Frame(self)
        wrap.pack(fill="both", expand=True, pady=(8, 0))
        self.tree = ttk.Treeview(wrap, columns=COLUMNS, show="headings",
                                 selectmode="browse")
        for col in COLUMNS:
            self.tree.heading(col, text=HEADINGS[col],
                              command=lambda c=col: self.sort_by(c))
        self.tree.column("table", width=60, anchor="center", stretch=False)
        self.tree.column("roll", width=90, anchor="w", stretch=False)
        self.tree.column("name", width=360, anchor="w", stretch=True)
        self.tree.column("page", width=90, anchor="w", stretch=False)
        self.tree.column("reroll", width=70, anchor="center", stretch=False)
        vsb = ttk.Scrollbar(wrap, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        wrap.rowconfigure(0, weight=1)
        wrap.columnconfigure(0, weight=1)
        self.tree.tag_configure("nii", foreground="#8a8a8a")
        self.tree.bind("<Double-1>", lambda e: self.open_detail())
        self.tree.bind("<Return>", lambda e: self.open_detail())

        self.refilter()

    # ---- search / filter -------------------------------------------------- #
    def focus_search(self):
        self.entry.focus_set()
        self.entry.select_range(0, "end")

    def clear_search(self):
        self.query.set("")
        self.refilter()

    def _schedule(self):
        if self._after is not None:
            self.after_cancel(self._after)
        self._after = self.after(DEBOUNCE_MS, self.refilter)

    def refilter(self):
        self._after = None
        tokens = self.query.get().split()
        rows = self.app.ds.search(tokens)
        tf = self.table_filter.get()
        if tf and tf != "All":
            rows = [it for it in rows if it.table == tf]
        self._rows = rows
        self._render()

    def _render(self):
        if self._sort_col:
            self._apply_sort()
        self.tree.delete(*self.tree.get_children())
        total = self.app.ds.item_count
        for i, it in enumerate(self._rows):
            tags = ("nii",) if it.page_status != "filled" else ()
            self.tree.insert("", "end", iid=str(i),
                             values=(it.table, it.roll_display, it.name,
                                     page_text_or_dash(it), "★" if it.reroll else ""),
                             tags=tags)
        q = self.query.get().strip()
        if not self._rows and q:
            self.count.configure(text=f"No items match '{q}' — clear (Esc)")
        else:
            self.count.configure(text=f"{len(self._rows)} of {total}")

    # ---- sorting ---------------------------------------------------------- #
    def sort_by(self, col):
        if self._sort_col == col:
            self._sort_rev = not self._sort_rev
        else:
            self._sort_col, self._sort_rev = col, False
        self._render()

    def _apply_sort(self):
        col = self._sort_col
        def key(it):
            if col == "table":
                return (it.table, it.roll_low)
            if col == "roll":
                return it.roll_low
            if col == "name":
                return it.name.lower()
            if col == "page":
                p = it.page
                if p is None:
                    return 10 ** 9
                return min(p) if isinstance(p, list) else p
            if col == "reroll":
                return (not it.reroll, it.roll_low)
            return it.roll_low
        self._rows.sort(key=key, reverse=self._sort_rev)

    # ---- detail popover --------------------------------------------------- #
    def _selected_item(self):
        sel = self.tree.selection()
        if not sel:
            return None
        return self._rows[int(sel[0])]

    def open_detail(self):
        it = self._selected_item()
        if it is None:
            return
        top = tk.Toplevel(self)
        top.title(it.name)
        top.geometry("460x260")
        frm = ttk.Frame(top, padding=10)
        frm.pack(fill="both", expand=True)
        ttk.Label(frm, text=it.name, font=("Helvetica", 14, "bold"),
                  wraplength=420, anchor="w", justify="left").pack(fill="x")
        rows = [
            ("Table", it.table),
            ("Category", it.category or "—"),
            ("Subcategory", it.subcategory or "—"),
            ("Roll (d1000)", it.roll_display),
            ("Page", page_text(it) if page_text(it) else "not in index"),
            ("Reroll / combine", "yes ★" if it.reroll else "no"),
        ]
        for k, v in rows:
            line = ttk.Frame(frm)
            line.pack(fill="x", pady=1)
            ttk.Label(line, text=k + ":", width=16, foreground="#555").pack(side="left")
            ttk.Label(line, text=str(v), wraplength=280, anchor="w",
                      justify="left").pack(side="left")

        def roll_this():
            top.destroy()
            self.app.select_tab("Single Table")
            self.app.tabs["Single Table"].select_key(it.table)
        ttk.Button(frm, text=f"Roll this table ({it.table})",
                   command=roll_this).pack(pady=(10, 0))


def page_text_or_dash(it) -> str:
    t = page_text(it)
    return t if t else "—"
