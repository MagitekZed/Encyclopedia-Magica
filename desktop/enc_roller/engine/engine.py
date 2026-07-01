"""engine.py — every roll mechanic.  Pure; stdlib only; no tkinter.

Design rules that keep the mechanics honest:
  * A single find-site, ``_match_or_gap``, so a ``None`` on a legal roll is
    structurally impossible to forget.
  * One shared ``depth`` counter threaded through item-rerolls, the
    Enchanted-Enhancement selector, and R3/S3 sub-cascades — the reroll cap is
    a single global budget (``REROLL_CAP`` executed combines).
  * The result is always a ``RollStep`` tree; ``_headline`` derives the
    read-aloud name from that tree, so display and mechanics never diverge.
"""

from __future__ import annotations

import re

from ..data.dataset import Dataset
from ..data.models import Item
from .config import MAX_POWERS_SOFT, POWER_RANDOM_POOL, REROLL_CAP
from .dice import Roller
from .results import RollResult, RollStep

EE_NAME = "Enchanted Enhancements"


class RollEngine:
    def __init__(self, ds: Dataset, roller: Roller, cap: int = REROLL_CAP,
                 power_pool=POWER_RANDOM_POOL):
        self.ds = ds
        self.roller = roller
        self.cap = cap
        self.pool = power_pool               # None -> all power tables

    # ===================================================================== #
    # The single find-site.  Every roll->row lookup goes through here.
    # ===================================================================== #
    def _match_or_gap(self, rows, roll, table, die, *, nearest=False) -> RollStep:
        row = self.ds.find(rows, roll)
        if row is None and nearest:
            row, note = self.ds.find_nearest(rows, roll)
            if row is not None:
                return RollStep(table, die, roll, row.name,
                                getattr(row, "page", None),
                                getattr(row, "page_status", "n/a"),
                                kind="roll",
                                note=f"data gap at {roll}; used nearest ({note})")
        if row is None:
            return RollStep(table, die, roll, "(no entry for roll — data gap)",
                            None, "n/a", kind="gap",
                            note="data gap; re-roll this slot")
        return RollStep(table, die, roll, row.name,
                        getattr(row, "page", None),
                        getattr(row, "page_status", "n/a"))

    # ===================================================================== #
    # Feature 1 — roll any single table
    # ===================================================================== #
    def roll_item_table(self, table: str, depth: int = 0) -> RollResult:
        rows = self.ds.items_by_table[table]
        roll = self.roller.roll(1000)
        step = self._match_or_gap(rows, roll, table, 1000)
        if step.kind == "roll":
            matched = self.ds.find(rows, roll)
            self._attach_cascade(step, matched, table, depth)
        return RollResult("single", self._headline(step), step, self.roller.seed)

    def roll_power_table(self, num: str) -> RollResult:
        return self.roll_artifact_power(num)

    def roll_mech(self, key: str) -> RollResult:
        """Roll one raw mechanics sub-table (R1/R2/S1/S2) on its own."""
        die = 1000 if key in ("R1", "S1") else 20
        roll = self.roller.roll(die)
        step = self._match_or_gap(self.ds.mech[key], roll, key, die,
                                  nearest=(key in ("R1", "S1")))
        return RollResult("single", step.label, step, self.roller.seed)

    def roll_armor(self, depth: int = 0) -> RollResult:
        root = self._assemble_armor(depth)
        return RollResult("single", self._headline(root), root, self.roller.seed)

    def roll_weapon(self, depth: int = 0) -> RollResult:
        root = self._assemble_weapon(depth)
        return RollResult("single", self._headline(root), root, self.roller.seed)

    def roll_named(self, key: str) -> RollResult:
        """UI dispatch by combo id."""
        if key in self.ds.items_by_table:
            return self.roll_item_table(key)
        if key == "R":
            return self.roll_armor()
        if key == "S":
            return self.roll_weapon()
        if key in self.ds.mech:
            return self.roll_mech(key)
        if key in self.ds.power_by_num:
            return self.roll_power_table(key)
        raise KeyError(f"unknown roll target {key!r}")

    def _attach_cascade(self, step: RollStep, item, table: str, depth: int) -> None:
        if item is None:
            return
        if item.name == EE_NAME:
            step.children = [self._resolve_enchanted_enhancements(depth + 1)]
        elif item.reroll:
            step.children = [self._resolve_item(item, table, depth + 1)]

    # ===================================================================== #
    # Feature 2 — fully random item (master -> target, with R/S assembly)
    # ===================================================================== #
    def roll_random_item(self) -> RollResult:
        d = self.roller.roll(100)
        mrow = self.ds.find(self.ds.master_rows, d)
        if mrow is None:                              # defensive: master tiles fully
            hi = max((r.roll_high for r in self.ds.master_rows), default=0)
            root = RollStep("master", 100, d,
                            f"No category — source covers d100 1-{hi}",
                            None, "n/a", kind="gap", note="master gap")
            return RollResult("random_item", "No result — master gap", root,
                              self.roller.seed)
        if mrow.target == "R":
            inner = self._assemble_armor(0)
        elif mrow.target == "S":
            inner = self._assemble_weapon(0)
        else:
            inner = self.roll_item_table(mrow.target, 0).root
        root = RollStep("master", 100, d, mrow.name, None, "n/a", children=[inner])
        return RollResult("random_item", self._headline(root), root, self.roller.seed)

    # ===================================================================== #
    # Feature 3 & 4 — artifact powers + N-power artifacts
    # ===================================================================== #
    def roll_artifact_power(self, num: str | None = None) -> RollResult:
        pt = self._pick_power_table(num)
        r = self.roller.roll(pt.die)
        step = self._match_or_gap(pt.entries, r, f"power:{pt.num}", pt.die)
        if step.note is None:
            step.note = f"{pt.category} ({pt.num})"
        return RollResult("artifact_power", step.label, step, self.roller.seed)

    def generate_artifact(self, n: int, tables=None) -> RollResult:
        if not isinstance(n, int) or n < 1:
            raise ValueError("N must be an integer >= 1")
        if tables is not None and len(tables) != n:
            raise ValueError("tables length must equal N")
        picks = tables if tables is not None else [None] * n
        children = []
        for t in picks:
            child = self.roll_artifact_power(t).root
            if child.kind == "gap":                  # a data hole -> re-roll the slot once
                child = self.roll_artifact_power(t).root
            children.append(child)
        root = RollStep("artifact", 0, 0, f"Artifact — {n} powers", None, "n/a",
                        kind="assembly", children=children)
        if n > MAX_POWERS_SOFT:
            root.note = f"large artifact (N={n} > soft cap {MAX_POWERS_SOFT})"
        return RollResult("artifact", self._headline(root), root, self.roller.seed)

    def _pick_power_table(self, num):
        if num is not None:
            return self.ds.power_by_num[num]
        pool = self.pool or sorted(self.ds.power_by_num)
        idx = self.roller.roll(len(pool)) - 1
        return self.ds.power_by_num[pool[idx]]

    # ===================================================================== #
    # Bonus — treasure hoard
    # ===================================================================== #
    def roll_hoard(self, k: int) -> RollResult:
        if not isinstance(k, int) or k < 1:
            raise ValueError("hoard size must be an integer >= 1")
        children = [self.roll_random_item().root for _ in range(k)]
        root = RollStep("hoard", 0, 0, f"Treasure Hoard — {k} items", None, "n/a",
                        kind="assembly", children=children)
        return RollResult("hoard", self._headline(root), root, self.roller.seed)

    # ===================================================================== #
    # Shared primitives — cascade, EE selector, R/S assembly
    # ===================================================================== #
    def _resolve_item(self, item: Item, table: str, depth: int) -> RollStep:
        """Execute one reroll/combine.  Invoked because ``item.reroll``; depth>=1."""
        if item.name == EE_NAME:                     # defensive: EE routes elsewhere already
            return self._resolve_enchanted_enhancements(depth)
        if depth > self.cap:
            return RollStep(table, 0, 0, "(reroll cap reached)", None, "n/a",
                            kind="cap", note=f"cap ({self.cap}) reached")
        rows = self.ds.items_by_table[table]
        roll = self.roller.roll(1000)
        step = self._match_or_gap(rows, roll, table, 1000)
        if step.kind != "roll":                      # a gap during reroll: leave it, no combine
            return step
        step.kind = "reroll"
        step.note = "reroll → combined"
        matched = self.ds.find(rows, roll)
        if matched is not None and matched.name == EE_NAME:
            step.note = "reroll → Enchanted Enhancements"
            step.children = [self._resolve_enchanted_enhancements(depth + 1)]
        elif matched is not None and matched.reroll:
            step.children = [self._resolve_item(matched, table, depth + 1)]
        return step

    def _resolve_enchanted_enhancements(self, depth: int) -> RollStep:
        if depth > self.cap:
            return RollStep("enh", 0, 0, "(reroll cap reached)", None, "n/a",
                            kind="cap", note=f"cap ({self.cap}) reached")
        d = self.roller.roll(100)
        row = self.ds.find(self.ds.enhancement, d)
        if row is None:
            return RollStep("enh", 100, d, "(no enhancement for roll — data gap)",
                            None, "n/a", kind="gap", note="data gap")
        step = RollStep("enh", 100, d, f"Enchanted: {row.type}", None, "n/a",
                        kind="enhancement")
        if row.reroll:
            step.children = [self._resolve_enchanted_enhancements(depth + 1)]
        return step

    def _assemble_armor(self, depth: int = 0) -> RollStep:
        return self._assemble_rs("armor", depth)

    def _assemble_weapon(self, depth: int = 0) -> RollStep:
        return self._assemble_rs("weapon", depth)

    def _assemble_rs(self, slot: str, depth: int) -> RollStep:
        if slot == "armor":
            t1, t2, item_table, label = "R1", "R2", "R3", "Armor"
        else:
            t1, t2, item_table, label = "S1", "S2", "S3", "Weapon"

        t = self.roller.roll(1000)
        type_step = self._match_or_gap(self.ds.mech[t1], t, t1, 1000, nearest=True)
        matched_type = self.ds.find(self.ds.mech[t1], t)

        if matched_type is not None and matched_type.is_r3_catchall:
            # Special -> roll the specific item table (cascades); no generic bonus.
            type_step.note = f"Special → roll on {item_table}"
            item_step = self.roll_item_table(item_table, depth).root   # shares the outer budget
            return RollStep(slot, 0, 0, f"{label} (Special)", None, "n/a",
                            kind="assembly", children=[type_step, item_step],
                            note=f"{t1} Special → specific item from {item_table}")

        # Generic magic armor/weapon: type + bonus (no R3/S3 roll).
        b = self.roller.roll(20)
        bonus_step = self._match_or_gap(self.ds.mech[t2], b, t2, 20)
        if slot == "weapon" and matched_type is not None and matched_type.name != "Sword":
            matched_bonus = self.ds.find(self.ds.mech[t2], b)          # S2 Wpn Adj for non-swords
            if matched_bonus is not None and getattr(matched_bonus, "wpn_adj", None):
                bonus_step.label = matched_bonus.wpn_adj
                bonus_step.note = "Wpn Adj (non-sword)"
        return RollStep(slot, 0, 0, label, None, "n/a", kind="assembly",
                        children=[type_step, bonus_step])

    def _bonus_plus(self, mech_key: str, name: str) -> str:
        """Sign-preserving bonus token; per-table because R2/S2 name formats differ."""
        if mech_key == "S2":                         # S2 name IS the bonus: "-1".."+5"
            return name.strip()
        m = re.search(r"AC Adj\s*([+-]?\d+)", name)  # R2: extract the AC Adj token
        if not m:
            return name                              # fallback: raw name, never crash
        g = m.group(1)
        return ("+" + g) if g[0] not in "+-" else g

    # ===================================================================== #
    # Headline derivation (from the tree)
    # ===================================================================== #
    def _headline(self, root: RollStep) -> str:
        base = self._primary_name(root)
        if root.table in ("artifact", "hoard"):
            return base
        combines = root.count_kinds({"reroll", "enhancement"})
        ench = root.count_kinds({"enhancement"})
        if combines == 0:
            return base
        suffix = f"  ·  +{combines} combined" + (f" ({ench} enchanted)" if ench else "")
        return base + suffix

    def _primary_name(self, root: RollStep) -> str:
        if root.table in ("armor", "weapon"):
            return self._assembled_name(root)
        if root.table == "master" and root.children:
            return self._primary_name(root.children[0])
        return root.label

    def _assembled_name(self, root: RollStep) -> str:
        type_step, second = root.children[0], root.children[1]
        if second.table in ("R2", "S2"):        # generic: "{bonus} {type}"
            plus = self._bonus_plus(second.table, second.label)
            return f"{plus} {type_step.label}".strip()
        # Special: the R3/S3 item IS the result (bonus predetermined on its page)
        return self._primary_name(second)
