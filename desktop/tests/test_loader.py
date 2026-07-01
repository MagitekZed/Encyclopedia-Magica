"""test_loader — parsers against the real files; tiling warnings; quirk fixes."""

from __future__ import annotations

import unittest

from tests.common import get_dataset


class TestLoader(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ds = get_dataset()

    def test_item_count_and_tables(self):
        self.assertEqual(self.ds.item_count, 5709)
        expected = set("ABCDEFGHIJKLMNOPQ") | {"R3", "S3", "T"}
        self.assertEqual(set(self.ds.items_by_table), expected)

    def test_reroll_and_ee_counts(self):
        all_items = [it for rows in self.ds.items_by_table.values() for it in rows]
        self.assertEqual(sum(1 for it in all_items if it.reroll), 75)
        self.assertEqual(sum(1 for it in all_items
                             if it.name == "Enchanted Enhancements"), 19)

    def test_not_in_index_items(self):
        all_items = [it for rows in self.ds.items_by_table.values() for it in rows]
        nii = [it for it in all_items if it.page_status != "filled"]
        self.assertEqual(len(nii), 10)
        self.assertTrue(all(it.page is None for it in nii))

    def test_master_targets_and_tiling(self):
        # Master routes 78-100 -> Weapons (S); tiles d100 with no gap warning.
        row78 = self.ds.find(self.ds.master_rows, 78)
        self.assertEqual((row78.target, row78.name), ("S", "Weapons"))
        self.assertEqual(self.ds.find(self.ds.master_rows, 100).target, "S")
        self.assertFalse(any("master: gap" in w for w in self.ds.data_warnings()))

    def test_s1_die_pinned_1000(self):
        # 'Quarrel (Bolt)' is the S1 "98-100" row; with die pinned 1000 it stays
        # 98..100 (NOT 980..1000, which naive d100 inference would produce).
        q = next(r for r in self.ds.mech["S1"] if r.name.startswith("Quarrel"))
        self.assertEqual((q.roll_low, q.roll_high), (98, 100))
        # S1 tail catch-all reaches the d1000 max.
        tail = self.ds.mech["S1"][-1]
        self.assertEqual(tail.roll_high, 1000)
        self.assertTrue(tail.is_r3_catchall)

    def test_r1_catchall_flagged_and_tiles(self):
        catch = [r for r in self.ds.mech["R1"] if r.is_r3_catchall]
        self.assertEqual(len(catch), 1)
        self.assertIn("R3", catch[0].name)
        # R1 is fixed at source: no 576 gap anymore.
        self.assertFalse(any(w.startswith("R1:") for w in self.ds.data_warnings()))

    def test_enhancement_tolerates_extra_keys(self):
        # File has desc/descriptions/descriptions_note beyond entries/die.
        self.assertEqual(len(self.ds.enhancement), 10)
        self.assertEqual(sum(1 for e in self.ds.enhancement if e.reroll), 9)

    def test_only_warning_is_1_16_gap(self):
        # The one genuine, faithful data hole: artifact table 1-16 @ roll 37.
        warnings = self.ds.data_warnings()
        self.assertTrue(any("power 1-16: gap at 37" in w for w in warnings),
                        f"expected 1-16@37 gap warning, got {warnings}")
        self.assertFalse(any(w.startswith("power 1-15") for w in warnings))
        self.assertEqual(len(warnings), 1,
                         f"expected exactly one data warning, got {warnings}")


if __name__ == "__main__":
    unittest.main()
