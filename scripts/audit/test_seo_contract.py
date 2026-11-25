#!/usr/bin/env python3
"""Regression tests for generated multilingual SEO contracts."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "audit"))

import seo_contract  # noqa: E402
from seo_contract import (  # noqa: E402
    alternate_page_path,
    alternate_values,
    canonical_target_from_anchor,
    internal_anchor_hrefs,
    sitemap_internal_discovery,
    localized_product_copy_audit,
    duplicate_product_meta_groups,
    duplicate_title_groups,
    embedded_product_record,
    expected_hreflang,
    warning_breakdown,
)




class LocalizedEntityCopyAuditTests(unittest.TestCase):
    def test_extracts_only_the_entity_introduction_after_the_h1(self) -> None:
        raw = """
        <div class="vehicle-info">
          <h1>Tata LPT</h1>
          <p>Souviks lists parts for Tata LPT, a Tata Motors application.</p>
          <div>Products: 332</div>
        </div>
        """
        record = seo_contract.localized_entity_intro_record(
            ROOT / "hi" / "vehicles" / "tata-lpt.html",
            raw,
        )
        self.assertIsNotNone(record)
        self.assertEqual(record["entity_type"], "vehicle")
        self.assertEqual(record["entity_slug"], "tata-lpt")
        self.assertEqual(record["language"], "hi")
        self.assertEqual(
            record["introduction"],
            "Souviks lists parts for Tata LPT, a Tata Motors application.",
        )

    def test_reports_identical_introductions_by_locale_and_entity_type(self) -> None:
        shared = "Filters covers active commercial-vehicle spare parts across recorded applications."
        entries = [
            {"entity_type": "category", "entity_slug": "filters", "language": "en",
             "canonical": "https://www.souviks.co.in/en/categories/filters", "introduction": shared,
             "title": "Filters | Souviks", "h1": "Filters"},
            {"entity_type": "category", "entity_slug": "filters", "language": "hi",
             "canonical": "https://www.souviks.co.in/hi/categories/filters", "introduction": shared,
             "title": "Filters स्पेयर पार्ट्स | Souviks", "h1": "Filters"},
            {"entity_type": "category", "entity_slug": "filters", "language": "bn",
             "canonical": "https://www.souviks.co.in/bn/categories/filters", "introduction": shared,
             "title": "Filters স্পেয়ার পার্টস | Souviks", "h1": "Filters"},
            {"entity_type": "brand", "entity_slug": "skf", "language": "en",
             "canonical": "https://www.souviks.co.in/en/brands/skf", "introduction": shared},
            {"entity_type": "brand", "entity_slug": "skf", "language": "hi",
             "canonical": "https://www.souviks.co.in/hi/brands/skf",
             "introduction": "Souviks पर SKF के सक्रिय पार्ट्स उपलब्ध हैं।"},
            {"entity_type": "vehicle", "entity_slug": "tata-lpt", "language": "hi",
             "canonical": "https://www.souviks.co.in/hi/vehicles/tata-lpt", "introduction": shared},
        ]

        result = seo_contract.localized_entity_copy_audit(entries)
        self.assertEqual(result["entities_compared"], 2)
        self.assertEqual(result["localized_pages_compared"], 3)
        self.assertEqual(result["pages_with_introduction_identical_to_english"], 2)
        self.assertEqual(result["identical_by_language"], {"bn": 1, "hi": 1})
        self.assertEqual(
            [(item["entity_type"], item["language"], item["entity_slug"])
             for item in result["records"]],
            [("category", "bn", "filters"), ("category", "hi", "filters")],
        )
        self.assertEqual(result["records"][0]["h1_matches_english"], "true")
        self.assertEqual(result["records"][0]["title_matches_english"], "false")

    def test_missing_english_counterpart_is_not_compared(self) -> None:
        result = seo_contract.localized_entity_copy_audit([
            {"entity_type": "brand", "entity_slug": "skf", "language": "hi",
             "introduction": "ब्रांड के पुर्जे।"},
        ])
        self.assertEqual(result["entities_compared"], 0)
        self.assertEqual(result["localized_pages_compared"], 0)
        self.assertEqual(result["pages_with_introduction_identical_to_english"], 0)

    def test_non_entity_and_empty_introduction_records_are_ignored(self) -> None:
        result = seo_contract.localized_entity_copy_audit([
            {"entity_type": "product", "entity_slug": "part", "language": "en",
             "introduction": "Description."},
            {"entity_type": "vehicle", "entity_slug": "model", "language": "en",
             "introduction": "   "},
        ])
        self.assertEqual(result["entities_compared"], 0)
        self.assertEqual(result["records"], [])


class LocalizedProductCopyAuditTests(unittest.TestCase):
    def test_reports_only_localized_descriptions_identical_to_english(self) -> None:
        records = [
            {
                "product_id": "SVKS000050",
                "language": "en",
                "slug": "15mm-pu-connector-socket-pvc-straight",
                "canonical": "https://www.souviks.co.in/en/products/15mm-pu-connector-socket-pvc-straight",
                "title": "Rider - 15mm PU connector socket PVC Straight | Souviks",
                "h1": "15mm PU connector socket PVC Straight",
                "description": "The Rider connector joins air-line ends for compressed air.",
            },
            {
                "product_id": "SVKS000050",
                "language": "hi",
                "slug": "15mm-pu-connector-socket-pvc-straight",
                "canonical": "https://www.souviks.co.in/hi/products/15mm-pu-connector-socket-pvc-straight",
                "title": "Rider - 15mm PU connector socket PVC Straight | Souviks",
                "h1": "15mm PU connector socket PVC Straight",
                "description": "The Rider connector joins air-line ends for compressed air.",
            },
            {
                "product_id": "SVKS000050",
                "language": "bn",
                "slug": "15mm-pu-connector-socket-pvc-straight",
                "canonical": "https://www.souviks.co.in/bn/products/15mm-pu-connector-socket-pvc-straight",
                "title": "Rider - 15mm PU connector socket PVC Straight | Souviks",
                "h1": "15mm PU connector socket PVC Straight",
                "description": "Rider-এর কানেক্টরটি কমপ্রেসড এয়ার লাইনের সংযোগে ব্যবহৃত হয়।",
            },
        ]
        report = localized_product_copy_audit(records)
        self.assertEqual(report["products_compared"], 1)
        self.assertEqual(report["localized_pages_compared"], 2)
        self.assertEqual(report["pages_with_description_identical_to_english"], 1)
        self.assertEqual(report["identical_by_language"], {"hi": 1})
        self.assertEqual(report["records"][0]["language"], "hi")
        self.assertEqual(report["records"][0]["english_url"], records[0]["canonical"])
        # Identical technical titles/H1s are reported as context, not treated
        # as a problem by themselves.
        self.assertEqual(report["records"][0]["title_matches_english"], "true")
        self.assertEqual(report["records"][0]["h1_matches_english"], "true")

    def test_ignores_products_without_an_english_counterpart_or_with_empty_copy(self) -> None:
        records = [
            {"product_id": "ONLY-HI", "language": "hi", "description": "Hindi description"},
            {"product_id": "EMPTY-EN", "language": "en", "description": ""},
            {"product_id": "EMPTY-EN", "language": "bn", "description": "Bengali description"},
        ]
        report = localized_product_copy_audit(records)
        self.assertEqual(report["products_compared"], 2)
        self.assertEqual(report["localized_pages_compared"], 0)
        self.assertEqual(report["pages_with_description_identical_to_english"], 0)
        self.assertEqual(report["records"], [])

    def test_uses_one_locale_record_per_product_and_sorts_the_result(self) -> None:
        records = [
            {"product_id": "B", "language": "en", "description": "Same description"},
            {"product_id": "B", "language": "bn", "description": "Same description", "canonical": "https://www.souviks.co.in/bn/products/b"},
            {"product_id": "A", "language": "en", "description": "Same description"},
            {"product_id": "A", "language": "hi", "description": "Same description", "canonical": "https://www.souviks.co.in/hi/products/a"},
            {"product_id": "A", "language": "hi", "description": "Alternate alias", "path": "hi/products/a-alias.html"},
        ]
        report = localized_product_copy_audit(records)
        self.assertEqual(report["pages_with_description_identical_to_english"], 2)
        self.assertEqual(
            [(r["language"], r["product_id"]) for r in report["records"]],
            [("hi", "A"), ("bn", "B")],
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


class InternalDiscoveryTests(unittest.TestCase):
    def test_anchor_extractor_ignores_link_tags_and_non_anchor_hrefs(self) -> None:
        raw = (
            '<link rel="canonical" href="https://www.souviks.co.in/en/products">'
            '<link rel="alternate" hreflang="bn" href="https://www.souviks.co.in/bn/products">'
            '<a href="/en/products/part">Part</a>'
            "<a href='https://www.souviks.co.in/hi/products/part'>Hindi</a>"
            '<button data-href="/en/products/other">Other</button>'
        )
        self.assertEqual(
            internal_anchor_hrefs(raw),
            [
                "/en/products/part",
                "https://www.souviks.co.in/hi/products/part",
            ],
        )

    def test_canonical_internal_anchor_targets_are_normalized(self) -> None:
        self.assertEqual(
            canonical_target_from_anchor("/en/products/part"),
            "https://www.souviks.co.in/en/products/part",
        )
        self.assertEqual(
            canonical_target_from_anchor("https://www.souviks.co.in/bn/products/part"),
            "https://www.souviks.co.in/bn/products/part",
        )
        self.assertEqual(
            canonical_target_from_anchor("/"),
            "https://www.souviks.co.in/",
        )
        self.assertEqual(
            canonical_target_from_anchor("/en/"),
            "https://www.souviks.co.in/",
        )
        self.assertEqual(
            canonical_target_from_anchor("/bn/"),
            "https://www.souviks.co.in/bn/",
        )

    def test_noncanonical_or_nonindexable_links_do_not_count_as_discovery(self) -> None:
        for href in (
            "http://www.souviks.co.in/en/products/part",
            "https://souviks.co.in/en/products/part",
            "https://external.example/en/products/part",
            "/en/products/part?brand_id=bosch",
            "/en/request-part?product_id=SVKS000001",
            "/en/products/part#specifications",
            "/en/products/part.html",
            "/products/part",
            "/brands/example",
            "mailto:sales@souviks.co.in",
            "javascript:void(0)",
        ):
            with self.subTest(href=href):
                self.assertEqual(canonical_target_from_anchor(href), "")



    def test_sitemap_discovery_report_counts_only_canonical_direct_links(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sitemap_dir = root / "sitemaps"
            sitemap_dir.mkdir()
            (sitemap_dir / "products.xml").write_text(
                '<?xml version="1.0"?>'
                '<urlset><url><loc>https://www.souviks.co.in/en/products/a</loc></url>'
                '<url><loc>https://www.souviks.co.in/bn/products/b</loc></url></urlset>',
                encoding="utf-8",
            )
            previous_root = seo_contract.ROOT
            seo_contract.ROOT = root
            try:
                report = sitemap_internal_discovery({
                    "https://www.souviks.co.in/en/products/a": {"source-page-1", "source-page-2"},
                })
            finally:
                seo_contract.ROOT = previous_root

        self.assertEqual(report["sitemap_urls_scanned"], 2)
        self.assertEqual(report["with_internal_anchor_links"], 1)
        self.assertEqual(report["without_internal_anchor_links"], 1)
        self.assertEqual(
            report["zero_inbound_urls"],
            [{
                "url": "https://www.souviks.co.in/bn/products/b",
                "language": "bn",
                "type": "products",
                "inbound_anchor_pages": 0,
                "inbound_source_pages": [],
            }],
        )
        low_by_url = {record["url"]: record for record in report["low_inbound_urls"]}
        self.assertEqual(
            low_by_url["https://www.souviks.co.in/en/products/a"]["inbound_source_pages"],
            ["source-page-1", "source-page-2"],
        )
        self.assertEqual(
            low_by_url["https://www.souviks.co.in/bn/products/b"]["inbound_source_pages"],
            [],
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
