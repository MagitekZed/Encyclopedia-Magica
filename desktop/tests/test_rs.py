"""test_rs — R/S multi-part assembly, sign-preserving bonus, catch-all collapse."""

from __future__ import annotations

import unittest

from enc_roller.engine.dice import FixedRoller
from enc_roller.engine.engine import RollEngine
from tests.common import (catchall_roll, first_plain_item, get_dataset,
                          mech_row_roll)


class TestRSAssembly(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ds = get_dataset()

    def eng(self, values):
        return RollEngine(self.ds, FixedRoller(values))

    def test_weapon_three_part_trace_and_headline(self):
        sword = mech_row_roll(self.ds, "S1", "Sword")     # S1 "Sword" type
        plus2 = mech_row_roll(self.ds, "S2", "+2")        # S2 "+2"
        item = first_plain_item(self.ds, "S3")
        res = self.eng([sword, plus2, item.roll_low]).roll_weapon()
        # three children: type, bonus, item.
        self.assertEqual(len(res.root.children), 3)
        self.assertEqual(res.root.children[0].label, "Sword")
        self.assertEqual(res.root.children[2].label, item.name)
        self.assertTrue(res.headline.startswith("+2 Sword "),
                        f"headline was {res.headline!r}")

    def test_s2_cursed_minus_one_preserved(self):
        sword = mech_row_roll(self.ds, "S1", "Sword")
        minus1 = mech_row_roll(self.ds, "S2", "-1")       # S2 bare "-1"
        item = first_plain_item(self.ds, "S3")
        res = self.eng([sword, minus1, item.roll_low]).roll_weapon()
        self.assertTrue(res.headline.startswith("-1 Sword "),
                        f"cursed weapon headline was {res.headline!r}")

    def test_r2_ac_adj_minus_one_extracted(self):
        armor_type = mech_row_roll(self.ds, "R1", "Armor")
        ac_minus1 = mech_row_roll(self.ds, "R2", "AC Adj -1")   # "AC Adj -1 / ..."
        item = first_plain_item(self.ds, "R3")
        res = self.eng([armor_type, ac_minus1, item.roll_low]).roll_armor()
        self.assertTrue(res.headline.startswith("-1 "),
                        f"cursed armor headline was {res.headline!r}")
        # full XP/GP string stays visible in the bonus node.
        self.assertIn("XP Value", res.root.children[1].label)

    def test_bonus_plus_helper(self):
        eng = self.eng([])
        self.assertEqual(eng._bonus_plus("S2", "-1"), "-1")
        self.assertEqual(eng._bonus_plus("S2", "+3"), "+3")
        self.assertEqual(eng._bonus_plus("R2", "AC Adj +2 / XP Value +1,000"), "+2")
        self.assertEqual(eng._bonus_plus("R2", "AC Adj -1 / XP Value +0"), "-1")
        # regex-failure fallback: return the raw name, never crash.
        self.assertEqual(eng._bonus_plus("R2", "totally unexpected"), "totally unexpected")

    def test_r1_catchall_collapses_to_r3_item(self):
        catch = catchall_roll(self.ds, "R1")              # "Special (Roll on Table R3)"
        plus2 = mech_row_roll(self.ds, "R2", "+2")
        item = first_plain_item(self.ds, "R3")
        res = self.eng([catch, plus2, item.roll_low]).roll_armor()
        self.assertEqual(len(res.root.children), 3)
        self.assertTrue(res.root.label.endswith("(Special)"))
        self.assertTrue(res.root.children[0].label.startswith("Special"))
        # headline is "+2 <item>" — the "Special" type word is collapsed out.
        self.assertEqual(res.headline, f"+2 {item.name}")


if __name__ == "__main__":
    unittest.main()
