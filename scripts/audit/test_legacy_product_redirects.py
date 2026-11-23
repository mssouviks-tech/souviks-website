#!/usr/bin/env python3
"""Regression checks for verified GSC legacy product URL redirects."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "bn", "hi")
MANIFEST_PATH = ROOT / "assets/data/legacy-product-redirects.json"
REDIRECTS_PATH = ROOT / "_redirects"
CATALOGUE_PATH = ROOT / "assets/data/catalogue-index.json"

ROOT_LEGACY_RULES = {
    "/products": "/en/products",
    "/products.html": "/en/products",
    "/brands": "/en/brands",
    "/brands.html": "/en/brands",
    "/categories": "/en/categories",
    "/categories.html": "/en/categories",
    "/vehicles": "/en/vehicles",
    "/vehicles.html": "/en/vehicles",
    "/about": "/en/about",
    "/about.html": "/en/about",
    "/contact": "/en/contact",
    "/contact.html": "/en/contact",
    "/terms": "/en/terms",
    "/terms.html": "/en/terms",
    "/privacy-policy": "/en/privacy-policy",
    "/privacy-policy.html": "/en/privacy-policy",
    "/refund": "/en/refund",
    "/refund.html": "/en/refund",
    "/shipping": "/en/shipping",
    "/shipping.html": "/en/shipping",
    "/request-part": "/en/request-part",
    "/request-part.html": "/en/request-part",
    "/request-quote": "/en/cart",
    "/request-quote.html": "/en/cart",
    "/thank-you": "/en/thank-you",
    "/thank-you.html": "/en/thank-you",
    "/products/12-x-12-mm-union": "/en/products/12-x-12-mm-union",
}


def load_json(path: Path):
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def read_redirects() -> dict[str, tuple[str, str]]:
    rules: dict[str, tuple[str, str]] = {}
    for lineno, line in enumerate(REDIRECTS_PATH.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = stripped.split()
        if len(parts) < 3:
            raise AssertionError(f"_redirects:{lineno}: expected source, destination and status")
        source, destination, status = parts[:3]
        if any(token in source for token in (":splat", ":lang", ":slug", "*")):
            continue
        if source in rules and rules[source] != (destination, status):
            raise AssertionError(f"_redirects:{lineno}: conflicting concrete rule for {source}")
        rules[source] = (destination, status)
    return rules


def main() -> None:
    manifest = load_json(MANIFEST_PATH)
    catalogue = load_json(CATALOGUE_PATH)
    assert manifest.get("schema_version") == 1, "unsupported redirect manifest schema"
    migrations = manifest.get("migrations")
    assert isinstance(migrations, list) and migrations, "manifest has no migrations"

    products = {
        str(product.get("id") or "").strip(): product
        for product in catalogue
        if isinstance(product, dict) and product.get("active") is not False
    }
    rules = read_redirects()
    seen_old = set()
    seen_products = set()
    expected_count = 0

    for migration in migrations:
        old_slug = str(migration.get("old_slug") or "").strip()
        new_slug = str(migration.get("new_slug") or "").strip()
        product_id = str(migration.get("product_id") or "").strip()
        assert old_slug and new_slug and product_id, f"incomplete migration: {migration!r}"
        assert old_slug != new_slug, f"old and new slugs are identical: {old_slug}"
        assert old_slug not in seen_old, f"duplicate old slug: {old_slug}"
        assert product_id not in seen_products, f"duplicate product ID: {product_id}"
        seen_old.add(old_slug)
        seen_products.add(product_id)

        product = products.get(product_id)
        assert product is not None, f"{old_slug}: {product_id} is not an active product"
        assert str(product.get("slug") or "").strip() == new_slug, (
            f"{old_slug}: target slug does not match product {product_id}"
        )

        declared_brand = str(migration.get("brand") or "").strip()
        actual_brand = str(product.get("brand_name") or product.get("brand") or "").strip()
        if declared_brand and actual_brand:
            assert declared_brand.casefold() == actual_brand.casefold(), (
                f"{old_slug}: manifest brand {declared_brand!r} != catalogue brand {actual_brand!r}"
            )

        declared_part = re.sub(r"\s+", "", str(migration.get("part_number") or "")).casefold()
        actual_part = str(
            product.get("manufacturer_part_number")
            or product.get("part_number")
            or product.get("partNumber")
            or ""
        )
        actual_part = re.sub(r"\s+", "", actual_part).casefold()
        if declared_part and actual_part:
            assert declared_part == actual_part, (
                f"{old_slug}: manifest part number {declared_part!r} != catalogue value {actual_part!r}"
            )

        for language in LANGUAGES:
            target_file = ROOT / language / "products" / f"{new_slug}.html"
            assert target_file.is_file(), f"missing destination page: {target_file.relative_to(ROOT)}"

        expected_rules = [
            (f"/products/{old_slug}", f"/en/products/{new_slug}"),
            (f"/products/{old_slug}.html", f"/en/products/{new_slug}"),
        ]
        for language in LANGUAGES:
            expected_rules.extend([
                (f"/{language}/products/{old_slug}", f"/{language}/products/{new_slug}"),
                (f"/{language}/products/{old_slug}.html", f"/{language}/products/{new_slug}"),
            ])

        for source, destination in expected_rules:
            assert rules.get(source) == (destination, "301"), (
                f"missing or incorrect direct 301: {source} -> {destination}; found {rules.get(source)!r}"
            )
            assert destination not in rules, (
                f"redirect chain: {source} -> {destination} -> {rules[destination][0]}"
            )
            expected_count += 1

    for source, destination in ROOT_LEGACY_RULES.items():
        assert rules.get(source) == (destination, "301"), (
            f"missing or incorrect root legacy 301: {source} -> {destination}"
        )
        assert destination not in rules, (
            f"root legacy redirect chain: {source} -> {destination} -> {rules[destination][0]}"
        )

    chains = [
        (source, destination, rules[destination][0])
        for source, (destination, _status) in rules.items()
        if destination in rules
    ]
    assert not chains, f"concrete redirect chains detected: {chains[:10]}"
    template_token = "$" + "{LANG}"
    assert not any(template_token in source or template_token in destination for source, (destination, _) in rules.items()), (
        "literal template token found in _redirects"
    )

    print(
        "Legacy product redirect contract PASS: "
        f"{len(migrations)} verified product migrations, "
        f"{expected_count} direct product 301 variants, "
        f"{len(ROOT_LEGACY_RULES)} root legacy rules, no concrete redirect chains."
    )


if __name__ == "__main__":
    main()
