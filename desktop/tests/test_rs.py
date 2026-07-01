"""test_rs — faithful R/S procedure: generic (type+bonus) vs Special (roll R3/S3).

Per Tables R & S: roll R1/S1; if the result is *Special* roll R3/S3 for a
specific item, otherwise roll R2/S2 for the bonus -> a generic "+N {type}".
Table S2 has two columns: Sword Adj vs the smaller Wpn Adj.
"""

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

    def test_generic_weapon_is_type_plus_bonus_no_s3(self):
        sword = mech_row_roll(self.ds, "S1", "Sword")
        plus2 = mech_row_roll(self.ds, "S2", "+2")
        res = self.eng([sword, plus2]).roll_weapon()          # only 2 rolls — no S3
        self.assertEqual([c.table for c in res.root.children], ["S1", "S2"])
        self.assertEqual(res.root.children[0].label, "Sword")
        self.assertEqual(res.headline, "+2 Sword")

    def test_s2_sword_vs_wpn_adj_column(self):
        # roll 11-14: Sword Adj +2, Wpn Adj +1 — a Sword gets +2, an Axe gets +1.
        r = mech_row_roll(self.ds, "S2", "+2")                # roll_low of the 11-14 row
        sword = mech_row_roll(self.ds, "S1", "Sword")
        axe = mech_row_roll(self.ds, "S1", "Axe")
        self.assertEqual(self.eng([sword, r]).roll_weapon().headline, "+2 Sword")
        self.assertEqual(self.eng([axe, r]).roll_weapon().headline, "+1 Axe")

    def test_cursed_weapon_minus_one(self):
        sword = mech_row_roll(self.ds, "S1", "Sword")
        minus1 = mech_row_roll(self.ds, "S2", "-1")
        self.assertEqual(self.eng([sword, minus1]).roll_weapon().headline, "-1 Sword")

    def test_generic_armor_ac_adj(self):
        armor = mech_row_roll(self.ds, "R1", "Armor")
        plus2 = mech_row_roll(self.ds, "R2", "AC Adj +2")
        res = self.eng([armor, plus2]).roll_armor()
        self.assertEqual([c.table for c in res.root.children], ["R1", "R2"])
        self.assertEqual(res.headline, "+2 Armor")
        self.assertIn("XP Value", res.root.children[1].label)   # full R2 string in the node
        # cursed armor
        acm1 = mech_row_roll(self.ds, "R2", "AC Adj -1")
        self.assertEqual(self.eng([armor, acm1]).roll_armor().headline, "-1 Armor")

    def test_special_weapon_rolls_s3(self):
        special = catchall_roll(self.ds, "S1")                 # "Special (Roll on ... S3)"
        item = first_plain_item(self.ds, "S3")
        res = self.eng([special, item.roll_low]).roll_weapon()
        self.assertEqual([c.table for c in res.root.children], ["S1", "S3"])
        self.assertTrue(res.root.label.endswith("(Special)"))
        self.assertIn("Special", res.root.children[0].note or "")
        self.assertEqual(res.headline, item.name)              # the S3 item IS the result

    def test_special_armor_rolls_r3(self):
        special = catchall_roll(self.ds, "R1")
        item = first_plain_item(self.ds, "R3")
        res = self.eng([special, item.roll_low]).roll_armor()
        self.assertEqual([c.table for c in res.root.children], ["R1", "R3"])
        self.assertEqual(res.headline, item.name)

    def test_bonus_plus_helper(self):
        eng = self.eng([])
        self.assertEqual(eng._bonus_plus("S2", "-1"), "-1")
        self.assertEqual(eng._bonus_plus("S2", "+3"), "+3")
        self.assertEqual(eng._bonus_plus("R2", "AC Adj +2 / XP Value +1,000"), "+2")
        self.assertEqual(eng._bonus_plus("R2", "AC Adj -1 / XP Value +0"), "-1")
        self.assertEqual(eng._bonus_plus("R2", "totally unexpected"), "totally unexpected")


if __name__ == "__main__":
    unittest.main()
