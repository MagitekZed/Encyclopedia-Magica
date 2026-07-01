"""test_ranges — every parse_range boundary for die in {1000, 100, 20, 10}."""

from __future__ import annotations

import unittest

from enc_roller.data.ranges import contains, parse_range


class TestParseRange(unittest.TestCase):
    def test_d1000_examples(self):
        self.assertEqual(parse_range("001-000", 1000), (1, 1000))
        self.assertEqual(parse_range("953-000", 1000), (953, 1000))
        self.assertEqual(parse_range("98-100", 1000), (98, 100))   # S1 row, die pinned
        self.assertEqual(parse_range("560-958", 1000), (560, 958))

    def test_d100_examples(self):
        self.assertEqual(parse_range("91-00", 100), (91, 100))
        self.assertEqual(parse_range("78-00", 100), (78, 100))
        self.assertEqual(parse_range("01-20", 100), (1, 20))

    def test_bare_and_small_dice(self):
        self.assertEqual(parse_range("1", 20), (1, 1))
        self.assertEqual(parse_range("20", 20), (20, 20))
        self.assertEqual(parse_range("5", 10), (5, 5))

    def test_max_encoding_every_die(self):
        # An all-zeros token encodes the die maximum, for every die used.
        self.assertEqual(parse_range("000", 1000), (1000, 1000))
        self.assertEqual(parse_range("00", 100), (100, 100))
        self.assertEqual(parse_range("0", 20), (20, 20))
        self.assertEqual(parse_range("0", 10), (10, 10))

    def test_die_never_inferred(self):
        # Same string, different pinned die -> different high (the S1 lesson).
        self.assertEqual(parse_range("01-97", 1000), (1, 97))
        self.assertEqual(parse_range("01-97", 100), (1, 97))
        self.assertEqual(parse_range("91-00", 1000), (91, 1000))
        self.assertEqual(parse_range("91-00", 100), (91, 100))

    def test_backwards_range_is_literal(self):
        # parse_range decodes literally; the loader is what swaps backwards ranges.
        self.assertEqual(parse_range("10-5", 100), (10, 5))

    def test_whitespace_tolerated(self):
        self.assertEqual(parse_range(" 3 - 10 ", 20), (3, 10))

    def test_bad_string_raises(self):
        with self.assertRaises(ValueError):
            parse_range("1-2-3", 100)
        with self.assertRaises(ValueError):
            parse_range("5-", 100)


class TestContains(unittest.TestCase):
    def test_boundaries(self):
        self.assertTrue(contains(1, 1000, 1))
        self.assertTrue(contains(1, 1000, 1000))
        self.assertTrue(contains(78, 100, 88))
        self.assertFalse(contains(78, 100, 77))
        self.assertFalse(contains(78, 100, 101))
        self.assertFalse(contains(10, 5, 7))       # backwards range contains nothing


if __name__ == "__main__":
    unittest.main()
