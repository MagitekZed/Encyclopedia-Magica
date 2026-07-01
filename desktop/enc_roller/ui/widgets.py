"""widgets.py — small shared Tkinter helpers (DieBadge, trace-tree filler)."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..engine.results import RollStep
from .format import page_text, where_text

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
    tree.column("page", width=90, minwidth=60, stretch=False, anchor="w")
    tree.column("note", width=200, minwidth=100, stretch=True, anchor="w")
    for kind, color in KIND_COLORS.items():
        tree.tag_configure(kind, foreground=color)
    tree.tag_configure("not_in_index", foreground="#8a8a8a")
    return tree


def populate_trace(tree: ttk.Treeview, root: RollStep) -> None:
    """Clear ``tree`` and render the full ``root`` trace, all nodes expanded."""
    tree.delete(*tree.get_children())

    def insert(step: RollStep, parent_id: str) -> None:
        tags = []
        if step.kind in KIND_COLORS:
            tags.append(step.kind)
        if step.page_status == "not_in_index":
            tags.append("not_in_index")
        node = tree.insert(parent_id, "end", text=step.label,
                           values=(where_text(step), page_text(step), step.note or ""),
                           open=True, tags=tags)
        for c in step.children:
            insert(c, node)

    insert(root, "")
