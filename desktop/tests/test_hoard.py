"""test_hoard — treasure-hoard manifest functional parity with the web app.

Covers: per-item ``summary`` capture, the manifest-line derivation, Copy/Export
leading with the manifest block, legacy-hoard healing, and summary round-trip.
"""

from __future__ import annotations

import unittest

from enc_roller.data.dataset import Dataset
from enc_roller.engine.dice import DefaultRoller
from enc_roller.engine.engine import RollEngine
from enc_roller.ui.format import (ensure_hoard_summaries, hoard_block,
                                   hoard_items, hoard_manifest_lines,
                                   result_to_text, step_from_dict, step_to_dict)
from tests.common import get_dataset


class TestHoard(unittest.TestCase):
    def setUp(self):
        self.ds = get_dataset()

    def _hoard(self, k=8, seed=424242):
        return RollEngine(self.ds, DefaultRoller(seed)).roll_hoard(k)

    def test_every_item_gets_a_resolved_summary(self):
        res = self._hoard(k=8)
        self.assertEqual(res.kind, "hoard")
        self.assertEqual(len(res.root.children), 8)
        for m in res.root.children:
            self.assertTrue(m.summary, "each hoard child must carry a resolved summary")
            # summary is the resolved item name, never the bare master-category label
            self.assertNotEqual(m.summary, m.label)

    def test_assembled_items_show_resolved_name_not_category(self):
        # Any armor/weapon item in a hoard must read "+N Type"/specific, never "Armor"/"Weapon".
        res = self._hoard(k=40)
        for it in hoard_items(res.root):
            self.assertNotIn(it["name"], ("Armor", "Weapon"),
                             f"unresolved assembly leaked into the manifest: {it}")

    def test_manifest_lines_are_one_per_item_with_pages(self):
        res = self._hoard(k=6)
        lines = hoard_manifest_lines(res.root)
        self.assertEqual(len(lines), 6)
        for n, line in enumerate(lines, 1):
            self.assertTrue(line.startswith(f"{n:02d}. "))

    def test_copy_leads_with_manifest_then_full_trace(self):
        res = self._hoard(k=5)
        txt = result_to_text(res.headline, res.root, 424242)
        self.assertIn("— full trace —", txt)
        body = txt.split("\n")
        # first manifest line appears before the "— full trace —" separator
        first_item = hoard_manifest_lines(res.root)[0]
        self.assertLess(body.index(first_item), body.index("— full trace —"))

    def test_healing_reproduces_the_same_names(self):
        res = self._hoard(k=6)
        original = [m.summary for m in res.root.children]
        # strip summaries (simulate a hoard persisted before summaries existed)
        for m in res.root.children:
            m.summary = None
        engine = RollEngine(self.ds, DefaultRoller(1))
        ensure_hoard_summaries(res.root, engine)
        self.assertEqual([m.summary for m in res.root.children], original)

    def test_summary_survives_dict_round_trip(self):
        res = self._hoard(k=4)
        restored = step_from_dict(step_to_dict(res.root))
        self.assertEqual([m.summary for m in restored.children],
                         [m.summary for m in res.root.children])

    def test_block_shape(self):
        res = self._hoard(k=3)
        block = hoard_block(res.root)
        self.assertEqual(block[-3:], ["", "— full trace —", ""])


if __name__ == "__main__":
    unittest.main()
