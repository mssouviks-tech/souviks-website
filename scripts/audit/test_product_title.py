#!/usr/bin/env python3
"""Regression tests for preserving product variant qualifiers in SEO titles."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from product_title import shorten_product_name_for_title  # noqa: E402


class ProductTitleShorteningTests(unittest.TestCase):
    def test_short_names_remain_unchanged(self) -> None:
        self.assertEqual(shorten_product_name_for_title("Front Leaf Spring", 30), "Front Leaf Spring")

    def test_left_and_right_side_suffixes_are_preserved(self) -> None:
        left = shorten_product_name_for_title(
            "H/L Assy 1312/1210 WT/P Line Glass P43 LH", 34
        )
        right = shorten_product_name_for_title(
            "H/L Assy 1312/1210 WT/P Line Glass P43 RH", 34
        )
        self.assertLessEqual(len(left), 34)
        self.assertLessEqual(len(right), 34)
        self.assertTrue(left.endswith("P43 LH"), left)
        self.assertTrue(right.endswith("P43 RH"), right)
        self.assertNotEqual(left, right)

    def test_type_number_is_preserved(self) -> None:
        title = shorten_product_name_for_title(
            "Tata LPT 3718 Front Parabolic Leaf Spring Type 2", 34
        )
        self.assertLessEqual(len(title), 34)
        self.assertTrue(title.endswith("Leaf Spring Type 2"), title)

    def test_auxiliary_variant_is_preserved(self) -> None:
        title = shorten_product_name_for_title(
            "TML Intra V30 Front Suspension Main Leaf AUX-A", 28
        )
        self.assertLessEqual(len(title), 28)
        self.assertTrue(title.endswith("Main Leaf AUX-A"), title)

    def test_size_and_oversize_qualifiers_are_preserved(self) -> None:
        size_variant = shorten_product_name_for_title(
            "25 mm Spring Leaf Side Washer 4mm Thickness", 34
        )
        oversize_variant = shorten_product_name_for_title(
            "Kingpin Thrust Pad 1st O/S", 24
        )
        self.assertLessEqual(len(size_variant), 34)
        self.assertLessEqual(len(oversize_variant), 24)
        self.assertTrue(size_variant.endswith("4mm Thickness"), size_variant)
        self.assertTrue(oversize_variant.endswith("1st O/S"), oversize_variant)

    def test_shortening_does_not_leave_dangling_punctuation(self) -> None:
        title = shorten_product_name_for_title(
            "Very Long Commercial Vehicle Component Description, RH", 24
        )
        self.assertLessEqual(len(title), 24)
        self.assertFalse(title.endswith((" ", ",", ";", ":", "-", ".")))


if __name__ == "__main__":
    unittest.main(verbosity=2)
