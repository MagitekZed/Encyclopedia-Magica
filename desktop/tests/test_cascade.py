"""test_cascade — the reroll/combine cap (the crux).

Asserts on the NUMBER of executed combine nodes, not tree depth: forcing a
reroll every time yields exactly REROLL_CAP executed nodes + one cap leaf,
across pure-item, pure-EE, and mixed chains, with one shared budget.
"""

from __future__ import annotations

import unittest

from enc_roller.engine.dice import FixedRoller
from enc_roller.engine.engine import RollEngine
from tests.common import (catchall_roll, ee_item, first_plain_item,
                          first_reroll_enh_roll, first_reroll_item, get_dataset)

COMBINE = {"reroll", "enhancement"}


class TestCascade(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ds = get_dataset()

    def eng(self, values):
        return RollEngine(self.ds, FixedRoller(values))

    def test_non_reroll_item_has_no_children(self):
        plain = first_plain_item(self.ds, "A")
        res = self.eng([plain.roll_low]).roll_item_table("A")
        self.assertEqual(res.root.children, [])
        self.assertEqual(res.root.count_kinds(COMBINE), 0)

    def test_pure_item_reroll_chain_caps_at_three(self):
        rr = first_reroll_item(self.ds, "A")            # non-EE reroll item
        # base roll + 3 executed rerolls (depth 4 is blocked before rolling).
        res = self.eng([rr.roll_low] * 4).roll_item_table("A")
        self.assertEqual(res.root.count_kinds(COMBINE), 3)
        self.assertEqual(res.root.count_kinds({"reroll"}), 3)
        self.assertEqual(res.root.count_kinds({"cap"}), 1)

    def test_pure_ee_chain_caps_at_three(self):
        ee = ee_item(self.ds, "A")
        aq = first_reroll_enh_roll(self.ds)             # a reroll enhancement type
        res = self.eng([ee.roll_low, aq, aq, aq]).roll_item_table("A")
        self.assertEqual(res.root.count_kinds({"enhancement"}), 3)
        self.assertEqual(res.root.count_kinds({"cap"}), 1)
        # headline advertises the enchanted combines.
        self.assertIn("enchanted", res.headline)

    def test_mixed_chain_shares_one_budget(self):
        # item-reroll -> lands on EE -> EE selector chain, all one shared cap.
        rr = first_reroll_item(self.ds, "A")
        ee = ee_item(self.ds, "A")
        aq = first_reroll_enh_roll(self.ds)
        res = self.eng([rr.roll_low, ee.roll_low, aq, aq]).roll_item_table("A")
        self.assertEqual(res.root.count_kinds(COMBINE), 3)      # 1 reroll + 2 enh
        self.assertEqual(res.root.count_kinds({"reroll"}), 1)
        self.assertEqual(res.root.count_kinds({"enhancement"}), 2)
        self.assertEqual(res.root.count_kinds({"cap"}), 1)

    def test_r3_within_armor_shares_outer_budget(self):
        # R3 is only rolled when R1 comes up Special, so script the Special row.
        special = catchall_roll(self.ds, "R1")
        rr3 = first_reroll_item(self.ds, "R3")
        # depth 2 assembly: R3 cascade may only execute 1 reroll before the cap.
        deep = self.eng([special, rr3.roll_low, rr3.roll_low])._assemble_armor(2)
        self.assertEqual(deep.count_kinds(COMBINE), 1)
        self.assertEqual(deep.count_kinds({"cap"}), 1)
        # contrast: depth 0 assembly gets the full budget of 3.
        shallow = self.eng([special] + [rr3.roll_low] * 4)._assemble_armor(0)
        self.assertEqual(shallow.count_kinds(COMBINE), 3)
        self.assertEqual(shallow.count_kinds({"cap"}), 1)


if __name__ == "__main__":
    unittest.main()
