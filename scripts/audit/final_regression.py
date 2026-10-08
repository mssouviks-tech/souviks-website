#!/usr/bin/env python3
"""Blocking multilingual/static regression matrix for the Souviks site."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
UTILITY_PAGES = (
    "account",
    "login",
    "register",
    "forgot-password",
    "reset-password",
    "request-part",
    "request-quote",
    "thank-you",
)
LANDING_PAGES = (
    "index",
    "products",
    "brands",
    "categories",
    "vehicles",
    "about",
    "contact",
    "privacy-policy",
    "terms",
    "refund",
)


def fail(errors: list[str]) -> None:
    if errors:
        print("[final regression] FAIL")
        for error in errors[:300]:
            print("  -", error)
        if len(errors) > 300:
            print(f"  ... and {len(errors) - 300} more")
        raise SystemExit(1)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def robots_content(raw: str) -> str:
    match = re.search(
        r'<meta\b[^>]*name=["\']robots["\'][^>]*content=["\']([^"\']+)',
        raw,
        flags=re.I,
    )
    return match.group(1).strip().lower() if match else ""


def canonical(raw: str) -> str:
    match = re.search(
        r'<link\b[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)',
        raw,
        flags=re.I,
    )
    return match.group(1).strip() if match else ""


def main() -> None:
    errors: list[str] = []

    required_json = (
        "assets/data/catalogue-index.json",
        "assets/data/products.json",
        "assets/data/brands.json",
        "assets/data/categories.json",
        "assets/data/vehicles.json",
        "assets/data/search.json",
    )
    for relative in required_json:
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing JSON dataset: {relative}")
            continue
        try:
            payload = json.loads(read(path))
        except json.JSONDecodeError as exc:
            errors.append(f"invalid JSON dataset {relative}: {exc}")
            continue
        if not isinstance(payload, list):
            errors.append(f"JSON dataset must be an array: {relative}")

    catalogue_path = ROOT / "assets/data/catalogue-index.json"
    try:
        catalogue = json.loads(read(catalogue_path))
    except Exception:
        catalogue = []

    active_products = [
        item for item in catalogue
        if isinstance(item, dict)
        and item.get("active") is not False
        and str(item.get("slug") or "").strip()
    ]

    # 1. Multilingual static page parity.
    for page_name in LANDING_PAGES + UTILITY_PAGES:
        for lang in LANGUAGES:
            path = ROOT / lang / f"{page_name}.html"
            if not path.is_file():
                errors.append(f"missing {lang}/{page_name}.html")
                continue
            raw = read(path)
            if not re.search(
                rf'<html\b[^>]*lang=["\']{re.escape(lang)}["\']',
                raw,
                flags=re.I,
            ):
                errors.append(f"{path}: incorrect/missing html lang")
            if not re.search(r'<meta\s+name=["\']viewport["\']', raw, flags=re.I):
                errors.append(f"{path}: missing viewport")
            if not canonical(raw):
                errors.append(f"{path}: missing canonical")

    # 2. Account/utility pages must remain non-indexable.
    for page_name in UTILITY_PAGES:
        for lang in LANGUAGES:
            path = ROOT / lang / f"{page_name}.html"
            if not path.is_file():
                continue
            robots = robots_content(read(path))
            if "noindex" not in robots or "follow" not in robots:
                errors.append(
                    f"{path}: utility page must use noindex,follow"
                )

    # 3. Localized 404 contract.
    for lang in LANGUAGES:
        path = ROOT / lang / "404.html"
        if not path.is_file():
            errors.append(f"{path}: missing localized 404")
            continue
        raw = read(path)
        if "noindex" not in robots_content(raw):
            errors.append(f"{path}: 404 must be noindex")
        if not re.search(r"<h[1-3]\b[^>]*>", raw, flags=re.I):
            errors.append(f"{path}: 404 has no heading")
        if f'href="/{lang}/"' not in raw:
            errors.append(f"{path}: 404 missing localized home link")
        if f'href="/{lang}/products"' not in raw:
            errors.append(f"{path}: 404 missing localized products link")

    # 4. Search/query hardening contract.
    core = read(ROOT / "assets/js/site-core.js")
    products_js = read(ROOT / "assets/js/bundles/products.js")
    if "Utils.queryNumber = function" not in core:
        errors.append("site-core.js: missing bounded numeric query helper")
    if 'Utils.queryNumber("page", 1, 1, 1000000)' not in products_js:
        errors.append("products.js: page query is not bounded")
    if 'Utils.queryNumber("pageSize", 20, 1, 100)' not in products_js:
        errors.append("products.js: pageSize query is not bounded")

    # 5. Browser failure boundary.
    for token in (
        'window.addEventListener("error"',
        'window.addEventListener("unhandledrejection"',
        "function sanitiseError",
        "Something went wrong. Please refresh the page and try again.",
    ):
        if token not in core:
            errors.append(f"site-core.js: missing runtime failure contract: {token}")

    # 6. No internal link should advertise a legacy public HTML URL.
    legacy = re.compile(
        r'(?:(?:href|src)\s*=\s*["\'][^"\']*|https://www\.souviks\.co\.in/[^"\']*)'
        r'(?:/)(?:index|account|login|register|forgot-password|reset-password|request-part|request-quote|thank-you|products|brands|categories|vehicles|about|contact|privacy-policy|terms|refund)\.html(?:[?#"\']|$)',
        flags=re.I,
    )
    for path in ROOT.glob("**/*.html"):
        if any(part in {".git", "node_modules"} for part in path.parts):
            continue
        raw = read(path)
        if legacy.search(raw):
            errors.append(f"{path}: legacy .html public link remains")

    # 7. Product-page regression matrix.
    for lang in LANGUAGES:
        for product in active_products:
            slug = str(product.get("slug") or "").strip()
            path = ROOT / lang / "products" / f"{slug}.html"
            if not path.is_file():
                errors.append(f"missing product page: {path}")
                continue
            raw = read(path)
            expected_url = f"https://www.souviks.co.in/{lang}/products/{slug}"
            if canonical(raw).rstrip("/") != expected_url.rstrip("/"):
                errors.append(f"{path}: canonical mismatch")
            if "window.SOUVIKS_PRODUCT_PAGE_DATA" not in raw:
                errors.append(f"{path}: missing embedded product data")
            if '"@type": "Product"' not in raw:
                errors.append(f"{path}: missing Product schema")
            if '"@type": "BreadcrumbList"' not in raw:
                errors.append(f"{path}: missing BreadcrumbList")
            if "/assets/images/placeholder.webp" in raw:
                errors.append(
                    f"{path}: generic placeholder is embedded in static product markup"
                )

    # 8. Sitemap URLs must remain clean.
    for relative in (
        "sitemap.xml",
        "sitemaps/pages.xml",
        "sitemaps/products.xml",
        "sitemaps/brands.xml",
        "sitemaps/categories.xml",
        "sitemaps/vehicles.xml",
    ):
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing sitemap: {relative}")
            continue
        raw = read(path)
        if ".html" in raw:
            errors.append(f"{relative}: contains legacy .html URL")

    fail(errors)

    print("[final regression] PASS")
    print(f"  languages: {len(LANGUAGES)}")
    print(f"  active products: {len(active_products)}")
    print(f"  utility pages checked: {len(UTILITY_PAGES) * len(LANGUAGES)}")
    print(f"  localized 404 pages checked: {len(LANGUAGES)}")


if __name__ == "__main__":
    main()
