#!/usr/bin/env python3
"""Regression tests for factual product descriptions and SEO snippets."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from product_seo import (  # noqa: E402
    build_factual_product_description,
    build_product_meta_description,
    build_product_schema_description,
    is_weak_product_description,
    schema_availability_url,
)


class ProductSeoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.product = {
            "id": "SVKS000123",
            "brand_name": "Texspin",
            "product_name": "TX-430-CRK9 Collector Ring",
            "name": "TX-430-CRK9 Collector Ring",
            "part_number": "TX-430-CRK9",
            "manufacturer_part_number": "TX-430-CRK9",
            "category_name": "Clutch Components",
            "subcategory_name": "Clutch Accessories",
            "description": (
                "The Texspin Tata Prima 430 dia. collector ring supports the "
                "mechanical linkage or assembly identified by the product name, "
                "allowing its connected parts to."
            ),
            "applications": ["Tata Prima 430"],
            "vehicles": ["Tata Prima 430"],
        }

    def test_known_generic_description_is_replaced_with_catalogue_facts(self) -> None:
        original = self.product["description"]
        self.assertTrue(is_weak_product_description(original))
        improved = build_product_schema_description(self.product)
        self.assertNotIn("supports the mechanical linkage", improved.lower())
        self.assertNotIn("allowing its connected parts", improved.lower())
        self.assertIn("Texspin", improved)
        self.assertIn("TX-430-CRK9", improved)
        self.assertIn("Clutch Accessories", improved)
        self.assertIn("Tata Prima 430", improved)
        self.assertNotIn("before ordering", improved.lower())

    def test_existing_specific_description_is_preserved_for_product_content(self) -> None:
        product = dict(self.product)
        product["description"] = (
            "The collector ring is a component in the Texspin TX-430-CRK9 assembly "
            "listed for the Tata Prima 430 application."
        )
        improved = build_product_schema_description(product)
        self.assertEqual(improved, product["description"])
        self.assertGreater(len(improved), 80)

    def test_fallback_does_not_repeat_part_number(self) -> None:
        result = build_factual_product_description(self.product)
        self.assertEqual(result.casefold().count("tx-430-crk9"), 1)

    def test_meta_description_is_bounded_and_page_specific(self) -> None:
        for language in ("en", "hi", "bn"):
            snippet = build_product_meta_description(self.product, language=language)
            self.assertGreaterEqual(len(snippet), 50)
            self.assertLessEqual(len(snippet), 158)
            self.assertIn("TX-430-CRK9", snippet)
            self.assertNotIn("allowing its connected parts", snippet.lower())
            self.assertFalse(snippet.endswith((" ", ",", ";", ":")))

    def test_meta_description_uses_explicit_factual_suffix_when_room_allows(self) -> None:
        product = {
            "brand_name": "TVS Girling",
            "product_name": "18 mm Union",
            "part_number": "18MM-UNION",
            "category_name": "Air System",
            "subcategory_name": "Air Repair Kit",
            "description": (
                "TVS Girling 18 mm Union joins matching air-line tube ends in a "
                "compressed-air connection."
            ),
            "vehicles": ["Universal"],
        }
        snippet = build_product_meta_description(product, language="en")
        self.assertLessEqual(len(snippet), 158)
        self.assertIn("TVS Girling", snippet)
        self.assertIn("Souviks", snippet)

    def test_meta_description_keeps_first_sentence_when_it_exceeds_snippet_budget(self) -> None:
        product = {
            "brand_name": "Texspin",
            "product_name": "380 CRK7 lever kit",
            "part_number": "TX-380-CRK7",
            "category_name": "Clutch Parts",
            "subcategory_name": "Collector Ring",
            "description": (
                "The Texspin 380 CRK7 lever kit (part TX-380-CRK7) has a descriptive "
                "sentence that exceeds the available search snippet space while retaining "
                "the product identity and core component context for prospective buyers. "
                "Vehicle applications include Tata LPT."
            ),
            "vehicles": ["Tata LPT"],
        }
        snippet = build_product_meta_description(product, language="en")
        self.assertLessEqual(len(snippet), 158)
        self.assertGreaterEqual(len(snippet), 80)
        self.assertIn("Texspin", snippet)
        self.assertIn("TX-380-CRK7", snippet)
        self.assertNotEqual(snippet, "Vehicle applications include Tata LPT.")
        self.assertTrue(snippet.endswith("Check fitment, price and availability at Souviks."))

    def test_availability_is_never_inferred(self) -> None:
        self.assertEqual(
            schema_availability_url({"availability": "in_stock"}),
            "https://schema.org/InStock",
        )
        self.assertEqual(
            schema_availability_url({"stock_status": "OUT OF STOCK"}),
            "https://schema.org/OutOfStock",
        )
        self.assertIsNone(schema_availability_url({"availability": "available on request"}))
        self.assertIsNone(schema_availability_url({"selling_price": 95}))


if __name__ == "__main__":
    unittest.main(verbosity=2)
