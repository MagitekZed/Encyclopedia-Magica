"""test_format — display conventions (roll padding, page incl. multi-page)."""

from __future__ import annotations

import unittest
from dataclasses import dataclass

from enc_roller.ui.format import fmt_roll, page_text


@dataclass
class _Stub:
    page: object
    page_status: str


class TestFmtRoll(unittest.TestCase):
    def test_d1000_zero_pad_and_max(self):
        self.assertEqual(fmt_roll(1000, 1000), "000")
        self.assertEqual(fmt_roll(1000, 604), "604")
        self.assertEqual(fmt_roll(1000, 5), "005")

    def test_d100_and_smaller(self):
        self.assertEqual(fmt_roll(100, 100), "00")
        self.assertEqual(fmt_roll(100, 88), "88")
        self.assertEqual(fmt_roll(100, 5), "05")
        self.assertEqual(fmt_roll(20, 20), "20")
        self.assertEqual(fmt_roll(10, 7), "7")

    def test_synthetic_node(self):
        self.assertEqual(fmt_roll(0, 0), "")


class TestPageText(unittest.TestCase):
    def test_single_page(self):
        self.assertEqual(page_text(_Stub(341, "filled")), "p.341")

    def test_multi_page_list(self):
        self.assertEqual(page_text(_Stub([446, 824], "filled")), "pp.446, 824")

    def test_not_in_index(self):
        self.assertEqual(page_text(_Stub(None, "not_in_index")), "not in index")

    def test_na_and_empty(self):
        self.assertEqual(page_text(_Stub(None, "n/a")), "")
        self.assertEqual(page_text(_Stub(None, "filled")), "")


if __name__ == "__main__":
    unittest.main()
