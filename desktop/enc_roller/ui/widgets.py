"""widgets.py — small shared Tkinter helpers (DieBadge, trace-tree filler)."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..engine.results import RollStep
from .format import hoard_items, page_text, where_text

# Tag -> foreground colour for special trace rows.
KIND_COLORS = {
    "cap": "#b3541e",
    "gap": "#b3541e",
    "reroll": "#1f6f43",
    "enhancement": "#5b3a91",
    "assembly": "#555555",
}


class DieBadge(ttk.Label):
    """A little pill that shows which die a control will roll (d1000/d20/…)."""

    def __init__(self, parent, **kw):
        super().__init__(parent, text="d—", width=8, anchor="center",
                         relief="groove", padding=(6, 2), **kw)

    def set(self, die) -> None:
        self.configure(text=f"d{die}" if die else "d—")


def make_trace_tree(parent) -> ttk.Treeview:
    """A Treeview configured for rendering a RollStep trace in tree mode."""
    tree = ttk.Treeview(parent, columns=("where", "page", "note"),
                        show="tree headings", selectmode="browse")
    tree.heading("#0", text="Result")
    tree.heading("where", text="Roll")
    tree.heading("page", text="Page")
    tree.heading("note", text="Notes")
    tree.column("#0", width=340, minwidth=180, stretch=True)
    tree.column("where", width=120, minwidth=90, stretch=False, anchor="w")
    tree.column("page", width=110, minwidth=70, stretch=False, anchor="w")
    tree.column("note", width=200, minwidth=100, stretch=True, anchor="w")
    for kind, color in KIND_COLORS.items():
        tree.tag_configure(kind, foreground=color)
    tree.tag_configure("not_in_index", foreground="#8a8a8a")
    return tree


def populate_trace(tree: ttk.Treeview, root: RollStep) -> None:
    """Clear ``tree`` and render ``root``.  Ordinary rolls render fully expanded;
    a hoard renders as a manifest — each row is the item *category* (e.g. "Scrolls")
    with its page, and expanding reveals the specific item + full dice cascade.  So
    the collapsed view reads as a clean list of loot *types*, no name repeated."""
    tree.delete(*tree.get_children())

    def insert(step: RollStep, parent_id: str, open_: bool = True) -> str:
        tags = []
        if step.kind in KIND_COLORS:
            tags.append(step.kind)
        if step.page_status == "not_in_index":
            tags.append("not_in_index")
        node = tree.insert(parent_id, "end", text=step.label,
                           values=(where_text(step), page_text(step), step.note or ""),
                           open=open_, tags=tags)
        for c in step.children:
            insert(c, node)
        return node

    if root.table == "hoard":
        hoard_id = tree.insert("", "end", text=root.label, values=("", "", ""),
                               open=True, tags=["assembly"])
        for it in hoard_items(root):
            m = it["node"]
            page = ", ".join(it["pages"]) if it["pages"] else \
                ("not in index" if it["unindexed"] else "—")
            cat = it["cat"] or m.label                 # gap fallback
            tags = ["not_in_index"] if (it["unindexed"] and not it["pages"]) else []
            if it["gap"]:
                tags.append("gap")
            # row = the item TYPE + its page; expand reveals the specific item.
            row = tree.insert(hoard_id, "end", text=f"{it['n']:02d}. {cat}",
                              values=(where_text(m), page, ""), open=False, tags=tags)
            for c in m.children:
                insert(c, row)
        return

    insert(root, "")


def set_open_all(tree: ttk.Treeview, open_: bool) -> None:
    """Expand or collapse every node.  On collapse, top-level containers stay open
    so a hoard's type list (and a normal result's first level) remains visible."""
    def walk(node):
        for c in tree.get_children(node):
            tree.item(c, open=open_)
            walk(c)
    walk("")
    if not open_:
        for top in tree.get_children(""):
            tree.item(top, open=True)
