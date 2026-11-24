#!/usr/bin/env python3
"""Regression tests for generated multilingual SEO contracts."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "audit"))

from seo_contract import (  # noqa: E402
    alternate_page_path,
    alternate_values,
    duplicate_product_meta_groups,
    duplicate_title_groups,
    embedded_product_record,
    expected_hreflang,
    warning_breakdown,
)


class DuplicateTitleAuditTests(unittest.TestCase):
    def test_same_title_across_languages_is_not_a_collision(self) -> None:
        entries = [
            ("en", "JAI - 0181N | Souviks", "en/products/part.html", "https://www.souviks.co.in/en/products/part"),
            ("hi", "JAI - 0181N | Souviks", "hi/products/part.html", "https://www.souviks.co.in/hi/products/part"),
            ("bn", "JAI - 0181N | Souviks", "bn/products/part.html", "https://www.souviks.co.in/bn/products/part"),
        ]
        self.assertEqual(duplicate_title_groups(entries), [])

    def test_same_language_same_title_on_distinct_canonicals_is_reported(self) -> None:
        entries = [
            ("en", "JAI | Souviks", "en/brands/jai.html", "https://www.souviks.co.in/en/brands/jai"),
            ("en", "JAI | Souviks", "en/brands/jai-spares.html", "https://www.souviks.co.in/en/brands/jai-spares"),
        ]
        self.assertEqual(
            duplicate_title_groups(entries),
            [("en", "JAI | Souviks", ["en/brands/jai-spares.html", "en/brands/jai.html"])],
        )

    def test_files_with_the_same_canonical_are_not_counted_twice(self) -> None:
        entries = [
            ("en", "Souviks | Commercial Vehicle Parts", "index.html", "https://www.souviks.co.in/"),
            ("en", "Souviks | Commercial Vehicle Parts", "en/index.html", "https://www.souviks.co.in/"),
        ]
        self.assertEqual(duplicate_title_groups(entries), [])

    def test_canonical_aliases_do_not_inflate_collision_page_count(self) -> None:
        entries = [
            ("en", "Souviks | Commercial Vehicle Parts", "index.html", "https://www.souviks.co.in/"),
            ("en", "Souviks | Commercial Vehicle Parts", "en/index.html", "https://www.souviks.co.in/"),
            ("en", "Souviks | Commercial Vehicle Parts", "en/about.html", "https://www.souviks.co.in/en/about"),
        ]
        self.assertEqual(
            duplicate_title_groups(entries),
            [(
                "en",
                "Souviks | Commercial Vehicle Parts",
                ["en/about.html", "index.html"],
            )],
        )

    def test_distinct_same_language_product_titles_remain_visible(self) -> None:
        entries = [
            ("en", "JAI - 0181N - Tata 1210D Front Leaf Spring | Souviks", "en/products/front-spring.html", "https://www.souviks.co.in/en/products/front-spring"),
            ("en", "JAI - 0181N - Tata 1210D Front Leaf Spring | Souviks", "en/products/front-spring-svks000612.html", "https://www.souviks.co.in/en/products/front-spring-svks000612"),
        ]
        self.assertEqual(
            duplicate_title_groups(entries),
            [(
                "en",
                "JAI - 0181N - Tata 1210D Front Leaf Spring | Souviks",
                ["en/products/front-spring-svks000612.html", "en/products/front-spring.html"],
            )],
        )


class EmbeddedProductRecordTests(unittest.TestCase):
    def test_extracts_product_identity_from_generated_page_script(self) -> None:
        raw = (
            '<script>window.SOUVIKS_PRODUCT_PAGE_DATA = '
            '{"id":"SVKS000596","brand_name":"JAI","part_number":"0181N"};'
            '</script>'
        )
        record = embedded_product_record(raw)
        self.assertEqual(record["id"], "SVKS000596")
        self.assertEqual(record["brand_name"], "JAI")
        self.assertEqual(record["part_number"], "0181N")

    def test_missing_or_malformed_embedded_record_returns_empty_object(self) -> None:
        self.assertEqual(embedded_product_record("<html></html>"), {})
        self.assertEqual(
            embedded_product_record(
                "window.SOUVIKS_PRODUCT_PAGE_DATA = {not-json};"
            ),
            {},
        )


class DuplicateProductMetaDescriptionTests(unittest.TestCase):
    def test_duplicate_snippets_include_product_identity_and_language(self) -> None:
        records = [
            {
                "language": "en",
                "snippet": "Same factual snippet for buyers.",
                "product_id": "SVKS000596",
                "brand": "JAI",
                "part_number": "0181N",
                "product_name": "Tata 1210D Front Leaf Spring",
                "slug": "0181n-tata-1210d-front-leaf-spring",
                "path": "en/products/0181n-tata-1210d-front-leaf-spring.html",
                "canonical": "https://www.souviks.co.in/en/products/0181n-tata-1210d-front-leaf-spring",
            },
            {
                "language": "en",
                "snippet": "Same factual snippet for buyers.",
                "product_id": "SVKS000612",
                "brand": "JAI",
                "part_number": "0181N",
                "product_name": "Tata 1210D Front Leaf Spring",
                "slug": "0181n-tata-1210d-front-leaf-spring-svks000612",
                "path": "en/products/0181n-tata-1210d-front-leaf-spring-svks000612.html",
                "canonical": "https://www.souviks.co.in/en/products/0181n-tata-1210d-front-leaf-spring-svks000612",
            },
        ]
        groups = duplicate_product_meta_groups(records)
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["language"], "en")
        self.assertEqual(groups[0]["snippet"], "Same factual snippet for buyers.")
        products = groups[0]["products"]
        self.assertEqual([p["product_id"] for p in products], ["SVKS000596", "SVKS000612"])
        self.assertEqual([p["part_number"] for p in products], ["0181N", "0181N"])

    def test_identical_snippets_across_languages_are_separate(self) -> None:
        records = [
            {"language": "en", "snippet": "Shared text", "slug": "a", "canonical": "https://example.test/en/a"},
            {"language": "hi", "snippet": "Shared text", "slug": "b", "canonical": "https://example.test/hi/b"},
        ]
        self.assertEqual(duplicate_product_meta_groups(records), [])

    def test_canonical_aliases_are_not_duplicate_product_pages(self) -> None:
        records = [
            {"language": "en", "snippet": "Shared text", "slug": "a", "path": "index.html", "canonical": "https://example.test/en/a"},
            {"language": "en", "snippet": "Shared text", "slug": "a-alias", "path": "en/a.html", "canonical": "https://example.test/en/a"},
        ]
        self.assertEqual(duplicate_product_meta_groups(records), [])


class WarningSummaryTests(unittest.TestCase):
    def test_warning_breakdown_counts_each_review_category(self) -> None:
        warnings = [
            "en/brands/jai.html: title length 13 is outside the 15-70 character review range",
            "en/products/a.html: meta description length 45 is outside the 50-170 character review range",
            "duplicate product meta description shared by 2 product slugs (a, b)",
            "duplicate page title (2 pages, language=en, title='JAI | Souviks'): a.html, b.html",
            "en/products/c.html: product description contains known generic boilerplate",
        ]
        self.assertEqual(
            warning_breakdown(warnings),
            {
                "boilerplate product description": 1,
                "duplicate page title": 1,
                "duplicate product meta description": 1,
                "meta description length": 1,
                "title length": 1,
            },
        )


class HreflangContractTests(unittest.TestCase):
    def test_root_homepages_share_the_expected_language_alternates(self) -> None:
        expected = {
            "en": "https://www.souviks.co.in/",
            "bn": "https://www.souviks.co.in/bn/",
            "hi": "https://www.souviks.co.in/hi/",
            "x-default": "https://www.souviks.co.in/",
        }
        for relative in ("index.html", "en/index.html", "bn/index.html", "hi/index.html"):
            with self.subTest(path=relative):
                self.assertEqual(expected_hreflang(ROOT / relative), expected)

    def test_product_and_listing_routes_keep_matching_locale_paths(self) -> None:
        product = expected_hreflang(ROOT / "en/products/sample-part.html")
        self.assertEqual(
            product,
            {
                "en": "https://www.souviks.co.in/en/products/sample-part",
                "bn": "https://www.souviks.co.in/bn/products/sample-part",
                "hi": "https://www.souviks.co.in/hi/products/sample-part",
                "x-default": "https://www.souviks.co.in/en/products/sample-part",
            },
        )
        listing = expected_hreflang(ROOT / "bn/products.html")
        self.assertEqual(listing["bn"], "https://www.souviks.co.in/bn/products")
        self.assertEqual(listing["en"], "https://www.souviks.co.in/en/products")

    def test_alternate_parser_ignores_canonical_and_stylesheet_links(self) -> None:
        raw = (
            '<link rel="canonical" href="https://www.souviks.co.in/en/products">'
            '<link rel="stylesheet" href="/assets/site.css">'
            '<link rel="alternate" hreflang="en" href="https://www.souviks.co.in/en/products">'
            '<link rel="alternate" hreflang="bn" href="https://www.souviks.co.in/bn/products">'
        )
        self.assertEqual(
            alternate_values(raw),
            {
                "en": ["https://www.souviks.co.in/en/products"],
                "bn": ["https://www.souviks.co.in/bn/products"],
            },
        )

    def test_alternate_parser_preserves_duplicate_values_for_validation(self) -> None:
        raw = (
            '<link rel="alternate" hreflang="en" href="https://www.souviks.co.in/en/a">'
            '<link rel="alternate" hreflang="en" href="https://www.souviks.co.in/en/a">'
        )
        self.assertEqual(
            alternate_values(raw)["en"],
            [
                "https://www.souviks.co.in/en/a",
                "https://www.souviks.co.in/en/a",
            ],
        )

    def test_alternate_route_resolves_to_static_html_page(self) -> None:
        self.assertEqual(
            alternate_page_path("https://www.souviks.co.in/"),
            ROOT / "index.html",
        )
        self.assertEqual(
            alternate_page_path("https://www.souviks.co.in/bn/"),
            ROOT / "bn" / "index.html",
        )
        self.assertEqual(
            alternate_page_path("https://www.souviks.co.in/hi/products/sample-part"),
            ROOT / "hi" / "products" / "sample-part.html",
        )

    def test_nonlocalized_root_document_has_no_inferred_hreflang_group(self) -> None:
        self.assertEqual(expected_hreflang(ROOT / "robots.html"), {})



if __name__ == "__main__":
    unittest.main(verbosity=2)
