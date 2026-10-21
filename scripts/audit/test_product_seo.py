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
            self.assertGreaterEqual(len(snippet), 70)
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
        self.assertTrue(snippet.endswith("Check part fitment, current price and availability with Souviks."))

    def test_short_lead_is_expanded_to_the_minimum_and_retains_part_number(self) -> None:
        product = {
            "brand_name": "ASK",
            "product_name": "Brake Linings",
            "part_number": "AFFBPTTS1",
            "category_name": "Brake Components",
            "subcategory_name": "Brake Linings",
            "description": (
                "ASK Brake Linings. These brake linings are listed for commercial-vehicle "
                "applications in the Souviks catalogue."
            ),
            "vehicles": ["Tata LPT"],
        }
        snippets = [
            build_product_meta_description(product, language=language)
            for language in ("en", "hi", "bn")
        ]
        for snippet in snippets:
            self.assertGreaterEqual(len(snippet), 70)
            self.assertLessEqual(len(snippet), 158)
            self.assertIn("AFFBPTTS1", snippet)
            self.assertIn("ASK Brake Linings", snippet)

        second_product = dict(product)
        second_product["part_number"] = "AFFBPTTS2"
        second_snippet = build_product_meta_description(second_product, language="en")
        self.assertNotEqual(snippets[0], second_snippet)
        self.assertIn("AFFBPTTS2", second_snippet)

    def test_long_product_snippet_keeps_recorded_vehicle_fitment(self) -> None:
        product = {
            "brand_name": "KFL",
            "product_name": "UJ Cross 48 x 135",
            "part_number": "KF5122",
            "category_name": "Suspension & Steering",
            "subcategory_name": "Cross Joint",
            "description": (
                "The KFL KF5122 UJ Cross 48 x 135 transmits torque between connected "
                "shafts while accommodating changes in shaft angle during driveline movement."
            ),
            "vehicles": ["Tata LPT", "Ashok Leyland 2516"],
            "applications": ["Propeller Shaft Assembly", "Driveline System"],
        }
        broad = build_product_meta_description(product, language="en")
        narrowed_product = dict(product)
        narrowed_product["vehicles"] = ["Ashok Leyland 2516"]
        narrowed_product["description"] = (
            "The KFL KF5122 UJ Cross 48 x 135 transmits torque between connected "
            "shafts while accommodating changes in shaft angle during driveline movement."
        )
        narrowed = build_product_meta_description(narrowed_product, language="en")

        for snippet in (broad, narrowed):
            self.assertGreaterEqual(len(snippet), 70)
            self.assertLessEqual(len(snippet), 158)
            self.assertIn("KF5122", snippet)
            self.assertTrue(snippet.endswith("Check part fitment, current price and availability with Souviks."))
        self.assertIn("Tata LPT", broad)
        self.assertIn("Ashok Leyland 2516", broad)
        self.assertNotEqual(broad, narrowed)
        self.assertIn("Ashok Leyland 2516", narrowed)

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
