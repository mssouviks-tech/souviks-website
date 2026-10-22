#!/usr/bin/env python3
"""Regression test for the approved Souviks product pricing updates.

Run after scripts/catalogue/build.py so the catalogue overrides have been
reconciled into the master catalogue, HTML pages, and search projections.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

EXPECTED = {
    "SVKS000111": {
        "mrp": 1490,
        "selling_price": 1400.6,
        "discount_percent": 6,
        "part_number": "282942103701",
    },
    "SVKS000149": {
        "mrp": 2124,
        "selling_price": 1996.56,
        "discount_percent": 6,
        "part_number": "571020100106",
    },
    "SVKS000182": {
        "mrp": 205,
        "selling_price": 200,
        "discount_percent": 2,
        "part_number": "885426012829",
    },
    "SVKS000183": {
        "mrp": 353,
        "selling_price": 350,
        "discount_percent": 1,
        "part_number": "885499102829",
    },
    "SVKS000975": {
        "mrp": 316,
        "selling_price": 297.04,
        "discount_percent": 6,
        "part_number": "269533403101",
        "manufacturer_part_number": "269533403101",
        "name": "TAPER ROLLER BRG 30204",
        "slug": "tata-genuine-parts-269533403101-taper-roller-brg-30204",
    },
    "SVKS000211": {
        "mrp": 1200,
        "selling_price": 1080,
        "discount_percent": 10,
        "part_number": "32308",
    },
    "SVKS000938": {
        "mrp": 800,
        "selling_price": 760,
        "discount_percent": 5,
        "part_number": "820080500",
    },
}

EXPECTED_AVAILABILITY_LABELS = {
    "en": "Availability subject to confirmation",
    "hi": "उपलब्धता की पुष्टि आवश्यक",
    "bn": "উপলভ্যতা নিশ্চিতকরণ সাপেক্ষে",
}

def display_price(value: float | int) -> str:
    amount = float(value)
    if abs(amount - round(amount)) < 0.00001:
        return f"₹{int(round(amount)):,}"
    return f"₹{amount:,.2f}".rstrip("0").rstrip(".")

catalogue = json.loads((ROOT / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
products_by_id = {
    str(product.get("id")): product
    for product in catalogue
    if isinstance(product, dict) and product.get("id")
}

for product_id, expected in EXPECTED.items():
    product = products_by_id.get(product_id)
    assert product is not None, f"{product_id}: missing from catalogue-index.json"

    for field in ("mrp", "selling_price"):
        actual = product.get(field)
        assert actual is not None and abs(float(actual) - expected[field]) < 0.00001, (
            f"{product_id}: catalogue {field} expected {expected[field]!r}, got {actual!r}"
        )

    assert int(product.get("discount_percent", -1)) == expected["discount_percent"], (
        f"{product_id}: incorrect catalogue discount_percent {product.get('discount_percent')!r}"
    )
    assert str(product.get("part_number") or product.get("partNumber") or "") == expected["part_number"], (
        f"{product_id}: incorrect catalogue part number"
    )

    if "manufacturer_part_number" in expected:
        assert product.get("manufacturer_part_number") == expected["manufacturer_part_number"], (
            f"{product_id}: incorrect manufacturer_part_number"
        )
    if "name" in expected:
        assert (product.get("product_name") or product.get("name")) == expected["name"], (
            f"{product_id}: incorrect product name"
        )
    if "slug" in expected:
        assert product.get("slug") == expected["slug"], f"{product_id}: incorrect product slug"

    slug = str(product.get("slug") or "")
    assert slug, f"{product_id}: missing product slug"

    for language in ("en", "hi", "bn"):
        page_path = ROOT / language / "products" / f"{slug}.html"
        assert page_path.is_file(), f"{product_id}: missing {language} product page {page_path}"
        page = page_path.read_text(encoding="utf-8")

        embedded_match = re.search(
            r"window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});",
            page,
            flags=re.S,
        )
        assert embedded_match, f"{product_id}: missing embedded product data in {language} page"
        embedded = json.loads(embedded_match.group(1))

        for field in ("mrp", "selling_price"):
            actual = embedded.get(field)
            assert actual is not None and abs(float(actual) - expected[field]) < 0.00001, (
                f"{product_id}: {language} embedded {field} expected {expected[field]!r}, got {actual!r}"
            )
        assert int(embedded.get("discount_percent", -1)) == expected["discount_percent"], (
            f"{product_id}: incorrect {language} embedded discount"
        )
        assert str(embedded.get("part_number") or embedded.get("partNumber") or "") == expected["part_number"], (
            f"{product_id}: incorrect {language} embedded part number"
        )

        pricing_match = re.search(
            r'<div\b(?=[^>]*class=["\'][^"\']*\bpdp-pricing\b[^"\']*["\'])'
            r'[^>]*>.*?</div>\s*(?=<div\b[^>]*class=["\'][^"\']*\bpdp-meta\b)',
            page,
            flags=re.I | re.S,
        )
        assert pricing_match, f"{product_id}: missing server-rendered pricing block on {language} page"
        pricing = pricing_match.group(0)
        assert display_price(expected["mrp"]) in pricing, (
            f"{product_id}: {language} pricing block missing MRP {display_price(expected['mrp'])}"
        )
        assert display_price(expected["selling_price"]) in pricing, (
            f"{product_id}: {language} pricing block missing selling price {display_price(expected['selling_price'])}"
        )
        assert f'{expected["discount_percent"]}% OFF' in pricing, (
            f"{product_id}: {language} pricing block missing rounded discount"
        )

        stock_match = re.search(
            r'<span\b(?=[^>]*class=["\'][^"\']*\bpdp-stock\b[^"\']*["\'])[^>]*>(.*?)</span>',
            page,
            flags=re.I | re.S,
        )
        assert stock_match, f"{product_id}: {language} page missing stock/availability badge"
        assert EXPECTED_AVAILABILITY_LABELS[language] in stock_match.group(1), (
            f"{product_id}: stale or incorrect {language} availability badge: {stock_match.group(1)!r}"
        )

        if product_id == "SVKS000975":
            assert "269533403101" in page and "Available on request" not in re.search(
                r'<div\b[^>]*class=["\'][^"\']*\bpdp-row\b[^"\']*["\'][^>]*>\s*'
                r'<strong>\s*(?:Part Number|भाग संख्या|पार्ट नंबर|পার্ট নম্বর|পার্ট নং)\s*</strong>\s*<span>.*?</span>',
                page,
                flags=re.I | re.S,
            ).group(0), f"{product_id}: visible part number not synchronized in {language} page"

redirects = (ROOT / "_redirects").read_text(encoding="utf-8")
old_slug = "tata-genuine-parts-249533403101-tapper-roller-bearing-30204"
new_slug = EXPECTED["SVKS000975"]["slug"]
for language in ("en", "hi", "bn"):
    expected_redirect = f"/{language}/products/{old_slug} /{language}/products/{new_slug} 301"
    assert expected_redirect in redirects, f"Missing legacy bearing URL redirect: {expected_redirect}"

print(f"Static product pricing regression passed for {len(EXPECTED)} SKUs across en/hi/bn pages.")
