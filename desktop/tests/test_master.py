"""test_master — d100 master routing + the defensive master-gap path."""

from __future__ import annotations

import unittest

from enc_roller.data.dataset import Dataset
from enc_roller.engine.dice import FixedRoller
from enc_roller.engine.engine import RollEngine
from tests.common import (APP_DIR, first_plain_item, get_dataset,
                          mech_row_roll)


class TestMaster(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ds = get_dataset()

    def test_78_routes_to_weapon_assembly(self):
        sword = mech_row_roll(self.ds, "S1", "Sword")
        plus2 = mech_row_roll(self.ds, "S2", "+2")
        item = first_plain_item(self.ds, "S3")
        res = RollEngine(self.ds, FixedRoller([78, sword, plus2, item.roll_low])) \
            .roll_random_item()
        self.assertEqual(res.root.table, "master")
        self.assertEqual(res.root.rolled, 78)
        self.assertEqual(res.root.label, "Weapons")
        self.assertEqual(res.root.children[0].table, "weapon")

    def test_low_roll_routes_to_item_table(self):
        item_a = first_plain_item(self.ds, "A")
        res = RollEngine(self.ds, FixedRoller([1, item_a.roll_low])).roll_random_item()
        self.assertEqual(res.root.children[0].table, "A")
        self.assertEqual(res.root.children[0].label, item_a.name)

    def test_master_gap_defensive_path(self):
        # Real master tiles 1-100, so synthesize a hole by dropping the Weapons
        # row on a FRESH dataset (never the shared singleton), then roll into it.
        ds2 = Dataset.from_app(APP_DIR)
        ds2.master_rows = [r for r in ds2.master_rows if r.target != "S"]
        res = RollEngine(ds2, FixedRoller([90])).roll_random_item()
        self.assertEqual(res.root.kind, "gap")
        self.assertTrue(res.headline.startswith("No result"))


if __name__ == "__main__":
    unittest.main()
