#!/usr/bin/env python3
"""Report maintainability debt in the static Souviks frontend.

This is intentionally non-blocking. It makes the Pointer 33 backlog measurable
while the live bundles are migrated incrementally.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS_ROOT = ROOT / "assets" / "js"
BUNDLES = JS_ROOT / "bundles"
CSS_ROOT = ROOT / "assets" / "css" / "bundles"


def files(root: Path, pattern: str):
    return sorted(p for p in root.glob(pattern) if p.is_file())


def occurrences(pattern: str, paths):
    rx = re.compile(pattern, re.I | re.M)
    rows = []
    for path in paths:
        text = path.read_text(encoding="utf-8", errors="ignore")
        count = len(rx.findall(text))
        if count:
            rows.append((path.relative_to(ROOT).as_posix(), count))
    return rows


def main() -> int:
    js_files = files(JS_ROOT, "**/*.js")
    css_files = files(CSS_ROOT, "*.css")
    html_files = files(ROOT, "**/*.html")

    large_js = sorted(
        (
            (p.relative_to(ROOT).as_posix(), p.stat().st_size)
            for p in js_files
            if p.stat().st_size >= 100_000
        ),
        key=lambda item: item[1],
        reverse=True,
    )
    legacy_bundle_sizes = sorted(
        (
            (p.relative_to(ROOT).as_posix(), p.stat().st_size)
            for p in files(BUNDLES, "*.js")
            if p.stat().st_size >= 25_000
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    duplicate_shared_markers = occurrences(
        r"/\* ===== (?:utils\.js|auth/supabase\.js|main\.js|image-protection\.js) ===== \*/",
        js_files,
    )

    auth_initializers = occurrences(
        r"(?:createClient\s*\(|onAuthStateChange\s*\()",
        js_files,
    )

    card_implementations = occurrences(
        r"\b(?:function\s+card|card\s*\([^\)]*\)\s*\{|product_card_html\s*\()",
        js_files + [ROOT / "scripts" / "catalogue" / "enrich_entities.py"],
    )
    runtime_card_sources = [
        path for path in (
            ROOT / "assets" / "js" / "components" / "product-card.js",
            ROOT / "assets" / "js" / "products" / "products.js",
            ROOT / "assets" / "js" / "product" / "products.js",
        )
        if path.is_file() and "return ProductCard.render" in path.read_text(encoding="utf-8", errors="ignore")
    ]

    nav_markup = occurrences(
        r'id=["\']mainNavigation["\']',
        html_files,
    )

    bad_js_names = [
        p.relative_to(ROOT).as_posix()
        for p in files(BUNDLES, "*.js")
        if not re.fullmatch(r"(?:[0-9]+|[a-z0-9]+(?:-[a-z0-9]+)*)\.js", p.name)
    ]
    bad_css_names = [
        p.relative_to(ROOT).as_posix()
        for p in css_files
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*\.css", p.name)
    ]

    print("Pointer 33 code-quality report")
    print("--------------------------------")
    print(f"JavaScript files: {len(js_files)}")
    print(f"CSS bundle files: {len(css_files)}")
    print(f"HTML files: {len(html_files)}")

    print("\nLargest JavaScript files (>=100 KB):")
    for path, size in large_js:
        print(f"  {path}: {size:,} bytes")
    if not large_js:
        print("  none")

    print("\nLegacy compatibility bundles still over 25 KB:")
    if legacy_bundle_sizes:
        for path, size in legacy_bundle_sizes:
            print(f"  {path}: {size:,} bytes")
    else:
        print("  none")

    print("\nShared-runtime duplication markers:")
    if duplicate_shared_markers:
        for path, count in duplicate_shared_markers:
            print(f"  {path}: {count}")
    else:
        print("  none")

    print("\nAuthentication initializers/listeners:")
    for path, count in auth_initializers:
        print(f"  {path}: {count}")

    print("\nProduct-card implementations:")
    for path, count in card_implementations:
        print(f"  {path}: {count}")

    print("\nNavigation markup copies:")
    print(f"  {len(nav_markup)} HTML files contain #mainNavigation")

    print("\nJS/CSS naming violations:")
    for path in bad_js_names + bad_css_names:
        print(f"  {path}")
    if not bad_js_names and not bad_css_names:
        print("  none")

    print("\nRefactor ownership targets:")
    print("  Shared navigation/session runtime: assets/js/site-core.js")
    print("  Catalogue shared runtime: assets/js/catalogue-core.js")
    print("  Primary navigation markup/source: scripts/catalogue/navigation.py")
    print("  Primary navigation synchronization: scripts/catalogue/sync_navigation.py")
    print("  Product-card markup/source: scripts/catalogue/product_card.py")
    print("  Product-card synchronization: scripts/catalogue/sync_product_cards.py")
    print("  Product listing runtime modules: assets/js/products/")
    print("  PDP runtime modules: assets/js/product/")
    print("  Account runtime modules: assets/js/account/")
    print("  Static catalogue/schema generation: scripts/catalogue/build.py")
    print("  Entity page generation: scripts/catalogue/enrich_entities.py")
    print("  Remaining debt: deeper utility/component/service separation, page-module bundling, "
          "and broader TypeScript/JSDoc adoption. ESLint, syntax checks, and Prettier run in CI.")


    return 0


if __name__ == "__main__":
    raise SystemExit(main())
