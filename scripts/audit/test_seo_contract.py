#!/usr/bin/env python3
"""Regression tests for multilingual duplicate-title audit behavior."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "audit"))

from seo_contract import duplicate_title_groups, warning_breakdown  # noqa: E402


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


if __name__ == "__main__":
    unittest.main(verbosity=2)
