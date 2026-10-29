#!/usr/bin/env python3
"""Regression tests for localized brand-page title generation."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from enrich_entities import (  # noqa: E402
    brand_page_title,
    entity_meta_description,
    update_meta,
    update_page_title,
)


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

    def test_entity_meta_descriptions_are_complete_localized_and_bounded(self) -> None:
        products = [
            {"category_name": category, "subcategory_name": "Replacement Part"}
            for category in (
                "Air System", "Bearings", "Brakes", "Clutch Parts", "Cooling Pump"
            )
            for _ in range(21)
        ][:101]
        item = {"id": "tata-genuine-parts", "name": "Tata Genuine Parts"}
        descriptions = {
            language: entity_meta_description("brand", item, products, language)
            for language in ("en", "hi", "bn")
        }
        for language, description in descriptions.items():
            with self.subTest(language=language):
                self.assertGreaterEqual(len(description), 70)
                self.assertLessEqual(len(description), 158)
                self.assertIn("Tata Genuine Parts", description)
                self.assertNotIn("The listed range.", description)
                self.assertTrue(description.endswith((".", "।")))
        self.assertIn("Air System", descriptions["en"])
        self.assertIn("active products", descriptions["en"])
        self.assertIn("सक्रिय", descriptions["hi"])
        self.assertIn("সক্রিয়", descriptions["bn"])

    def test_meta_update_preserves_apostrophes_and_updates_all_previews(self) -> None:
        page = '''
        <meta name="description" content="Souviks' original description.">
        <meta property="og:description" content="Souviks' original social description.">
        <meta name="twitter:description" content="Souviks' original Twitter description.">
        '''
        description = (
            "Souviks' Tata Genuine Parts catalogue lists verified commercial-vehicle "
            "parts. Check part numbers and vehicle fitment before ordering."
        )
        updated = update_meta(page, description)
        escaped = "Souviks&#x27; Tata Genuine Parts catalogue lists verified commercial-vehicle parts."
        self.assertEqual(updated.count(escaped), 3)
        self.assertEqual(updated.count("<meta"), 3)
        self.assertIn('content="' + escaped, updated)
        self.assertNotIn("The listed range.", updated)

    def test_overlong_meta_uses_complete_sentence_boundary(self) -> None:
        first = "Tata Genuine Parts at Souviks covers truck and bus replacement components across several categories."
        second = (
            "The catalogue includes additional applications and common replacement areas for commercial vehicles."
        )
        snippet = update_meta(
            '<meta name="description" content="Old."><meta property="og:description" content="Old.">'
            '<meta name="twitter:description" content="Old.">',
            first + " " + second + " A third sentence follows."
        )
        self.assertIn('content="' + first + '"', snippet)
        self.assertNotIn("several categories. The catalogue", snippet)

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
