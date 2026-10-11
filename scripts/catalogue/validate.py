#!/usr/bin/env python3
"""Validate the static catalogue contract without modifying generated files."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")

CATALOGUE_PATH = ROOT / "assets/data/catalogue-index.json"
PRODUCTS_PATH = ROOT / "assets/data/products.json"
SEARCH_PATH = ROOT / "assets/data/search.json"
SITEMAP_PATH = ROOT / "sitemaps/products.xml"


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"Missing required JSON file: {path}")
    except json.JSONDecodeError as exc:
        fail(f"Invalid JSON in {path}: {exc}")


def fail(message: str) -> None:
    print(f"CATALOGUE ARCHITECTURE ERROR: {message}")
    raise SystemExit(1)


def duplicate_keys(records, key):
    seen = {}
    duplicates = []
    for record in records:
        value = str(record.get(key) or "").strip()
        if not value:
            continue
        seen.setdefault(value, 0)
        seen[value] += 1
    for value, count in seen.items():
        if count > 1:
            duplicates.append((value, count))
    return duplicates


def assert_unique(records, key, label):
    duplicates = duplicate_keys(records, key)
    if duplicates:
        sample = ", ".join(f"{value} ({count})" for value, count in duplicates[:10])
        fail(f"{label} contains duplicate {key} values: {sample}")


def validate_master(catalogue):
    if not isinstance(catalogue, list):
        fail("catalogue-index.json must contain a JSON array.")
    if not catalogue:
        fail("catalogue-index.json is empty.")

    assert_unique(catalogue, "id", "Catalogue master")
    assert_unique(catalogue, "slug", "Catalogue master")

    active = [p for p in catalogue if p.get("active") is not False and p.get("id")]
    for product in active:
        if not str(product.get("slug") or "").strip():
            fail(f"{product.get('id')} has no slug.")
        if not str(product.get("product_name") or product.get("name") or "").strip():
            fail(f"{product.get('id')} has no product name.")
    return active


def validate_projection(active, projection, label):
    if not isinstance(projection, list):
        fail(f"{label} must contain a JSON array.")

    active_by_id = {str(p["id"]): p for p in active}
    projection_by_id = {
        str(p.get("id")): p
        for p in projection
        if p.get("id")
    }

    missing = sorted(set(active_by_id) - set(projection_by_id))
    orphan = sorted(set(projection_by_id) - set(active_by_id))
    if missing:
        fail(f"{label} is missing {len(missing)} catalogue IDs: {', '.join(missing[:10])}")
    if orphan:
        fail(f"{label} contains {len(orphan)} IDs not present in the active master: {', '.join(orphan[:10])}")

    for product_id, source in active_by_id.items():
        target = projection_by_id[product_id]
        if str(target.get("slug") or "").strip() != str(source.get("slug") or "").strip():
            fail(
                f"{label} slug mismatch for {product_id}: "
                f"{target.get('slug')!r} != {source.get('slug')!r}"
            )


def validate_search(active, search):
    products = [item for item in search if item.get("type") == "product" and item.get("id")]
    assert_unique(products, "id", "Search projection")
    validate_projection(active, products, "Search projection")


def validate_static_routing_layer():
    """Fail if a duplicate dynamic product-routing layer is committed."""
    forbidden = (
        ROOT / "functions/products/[slug].js",
        ROOT / "functions/en/products/[slug].js",
        ROOT / "functions/bn/products/[slug].js",
        ROOT / "functions/hi/products/[slug].js",
    )
    found = [str(path.relative_to(ROOT)) for path in forbidden if path.exists()]
    if found:
        fail("Static catalogue must not contain duplicate routing files: " + ", ".join(found))


def validate_static_pages(active):
    expected = {str(p["slug"]).strip() for p in active}

    embedded_pattern = re.compile(
        r"window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});",
        re.S,
    )

    for language in LANGUAGES:
        directory = ROOT / language / "products"
        if not directory.exists():
            fail(f"Missing product page directory: {directory}")

        actual = {path.stem for path in directory.glob("*.html")}
        missing = sorted(expected - actual)
        orphan = sorted(actual - expected)

        if missing:
            fail(f"{language}: {len(missing)} active product pages are missing: {', '.join(missing[:10])}")
        if orphan:
            fail(f"{language}: {len(orphan)} product pages have no active catalogue record: {', '.join(orphan[:10])}")

        for path in directory.glob("*.html"):
            html = path.read_text(encoding="utf-8", errors="ignore")
            match = embedded_pattern.search(html)
            if not match:
                fail(f"{path}: missing SOUVIKS_PRODUCT_PAGE_DATA.")

            try:
                data = json.loads(match.group(1))
            except json.JSONDecodeError as exc:
                fail(f"{path}: invalid SOUVIKS_PRODUCT_PAGE_DATA: {exc}")

            expected_product = next(
                (p for p in active if str(p["slug"]) == path.stem),
                None,
            )
            if expected_product is None:
                fail(f"{path}: filename does not map to the active catalogue.")

            if str(data.get("id")) != str(expected_product["id"]):
                fail(
                    f"{path}: embedded product ID {data.get('id')!r} "
                    f"does not match {expected_product['id']!r}."
                )
            if str(data.get("slug") or "").strip() != path.stem:
                fail(
                    f"{path}: embedded slug {data.get('slug')!r} "
                    f"does not match filename {path.stem!r}."
                )


def validate_sitemap(active):
    try:
        sitemap = SITEMAP_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        fail(f"Missing product sitemap: {SITEMAP_PATH}")

    expected = {
        f"https://www.souviks.co.in/{language}/products/{p['slug']}"
        for language in LANGUAGES
        for p in active
    }
    actual = set(re.findall(r"<loc>([^<]+)</loc>", sitemap))

    missing = sorted(expected - actual)
    orphan = sorted(actual - expected)
    if missing:
        fail(f"Product sitemap is missing {len(missing)} URLs: {', '.join(missing[:5])}")
    if orphan:
        fail(f"Product sitemap contains {len(orphan)} URLs outside the active catalogue: {', '.join(orphan[:5])}")


def main() -> None:
    catalogue = load_json(CATALOGUE_PATH)
    products = load_json(PRODUCTS_PATH)
    search = load_json(SEARCH_PATH)

    active = validate_master(catalogue)
    validate_projection(active, products, "Product projection")
    validate_search(active, search)
    validate_static_routing_layer()
    validate_static_pages(active)
    validate_sitemap(active)

    print(
        "Catalogue architecture OK: "
        f"{len(active)} active products; "
        f"{len(LANGUAGES)} language page sets; "
        f"{len(active) * len(LANGUAGES)} product pages."
    )


if __name__ == "__main__":
    main()
