#!/usr/bin/env python3
"""Regression tests for localized brand-page title generation."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from enrich_entities import brand_page_title, update_page_title  # noqa: E402


class BrandPageTitleTests(unittest.TestCase):
    def test_titles_are_descriptive_localized_and_bounded(self) -> None:
        expected_terms = {
            "en": "Commercial Vehicle Parts",
            "hi": "ट्रक स्पेयर पार्ट्स",
            "bn": "ট্রাক স্পেয়ার পার্টস",
        }
        for language, term in expected_terms.items():
            with self.subTest(language=language):
                title = brand_page_title("JAI", language)
                self.assertGreaterEqual(len(title), 15)
                self.assertLessEqual(len(title), 70)
                self.assertIn("JAI", title)
                self.assertIn("Souviks", title)
                self.assertIn(term, title)

    def test_long_brand_name_stays_within_title_contract(self) -> None:
        for language in ("en", "hi", "bn"):
            with self.subTest(language=language):
                title = brand_page_title("Extraordinarily Long Commercial Vehicle Manufacturer Brand", language)
                self.assertLessEqual(len(title), 70)
                self.assertIn("Souviks", title)

    def test_document_and_social_titles_are_updated_together(self) -> None:
        page = """
        <title>JAI | Souviks</title>
        <meta property="og:title" content="JAI | Souviks">
        <meta name="twitter:title" content="JAI | Souviks">
        """
        title = "JAI Commercial Vehicle Parts | Souviks"
        updated = update_page_title(page, title)
        self.assertEqual(updated.count(title), 3)
        self.assertNotIn('content="JAI | Souviks"', updated)


if __name__ == "__main__":
    unittest.main(verbosity=2)
