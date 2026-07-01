"""test_artifact — power-table holes, gap re-roll, duplicates, N validation."""

from __future__ import annotations

import unittest

from enc_roller.engine.dice import DefaultRoller, FixedRoller
from enc_roller.engine.engine import RollEngine
from tests.common import get_dataset


class TestArtifact(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ds = get_dataset()

    def eng(self, values):
        return RollEngine(self.ds, FixedRoller(values))

    def test_power_hole_1_16_at_37_is_a_gap_no_crash(self):
        res = self.eng([37]).roll_artifact_power("1-16")
        self.assertEqual(res.root.kind, "gap")
        self.assertEqual(res.root.rolled, 37)

    def test_1_15_normalized_no_backwards_range(self):
        t = self.ds.power_by_num["1-15"]
        self.assertTrue(all(e.roll_low <= e.roll_high for e in t.entries))
        self.assertFalse(any(w.startswith("power 1-15") for w in self.ds.data_warnings()))

    def test_generate_rerolls_a_gap_slot_once(self):
        # 1-16 rolls 37 (gap) then 38 (real) -> the slot becomes a real power.
        res = self.eng([37, 38]).generate_artifact(1, ["1-16"])
        self.assertEqual(res.root.children[0].kind, "roll")
        self.assertNotIn("data gap", res.root.children[0].label)

    def test_duplicate_tables_allowed(self):
        res = self.eng([3, 4]).generate_artifact(2, ["1-00", "1-00"])
        self.assertEqual([c.table for c in res.root.children],
                         ["power:1-00", "power:1-00"])

    def test_n_validation(self):
        with self.assertRaises(ValueError):
            self.eng([]).generate_artifact(0)
        with self.assertRaises(ValueError):
            self.eng([]).generate_artifact(-3)
        with self.assertRaises(ValueError):
            self.eng([]).generate_artifact(2.5)             # non-int
        with self.assertRaises(ValueError):
            self.eng([1, 1]).generate_artifact(3, ["1-00", "1-00"])  # len != N

    def test_soft_cap_note_above_20(self):
        res = self.eng([1] * 21).generate_artifact(21, ["1-00"] * 21)
        self.assertIsNotNone(res.root.note)
        self.assertIn("large artifact", res.root.note)

    def test_random_pick_is_seed_reproducible(self):
        a = RollEngine(self.ds, DefaultRoller(2024)).roll_artifact_power()
        b = RollEngine(self.ds, DefaultRoller(2024)).roll_artifact_power()
        self.assertEqual(a.headline, b.headline)
        self.assertEqual(a.root.table, b.root.table)


if __name__ == "__main__":
    unittest.main()
