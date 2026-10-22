#!/usr/bin/env python3
"""Guard static asset budgets, cache-version integrity, and script-loading regressions."""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Baseline recorded 2026-10-08 from the current main revision.
# A 12% headroom allows intentional small changes while still blocking drift.
BASELINES = {
    "assets/js/site-core.js": 65_901,
    "assets/js/bundles/index.js": 31_941,
    "assets/js/bundles/products.js": 175_235,
    "assets/js/bundles/product.js": 116_583,
    "assets/js/bundles/account.js": 286_432,
    "assets/css/site-base.css": 93_640,
    "assets/css/bundles/index.css": 34_101,
    "assets/css/bundles/products.css": 26_140,
    "assets/css/bundles/product.css": 44_012,
    "assets/css/bundles/account.css": 75_545,
}

HEADROOM = 1.12
MAX_PUBLIC_ASSET_BYTES = 25 * 1024 * 1024
VERSIONED_ASSET_RE = re.compile(
    r'(?P<asset>/(?:assets/js/(?:site-core|catalogue-core)\.js'
    r'|assets/js/bundles/[^"?]+\.js'
    r'|assets/js/(?:account|products|product|request-quote|components)/[^"?]+\.js'
    r'|assets/css/[^"?]+\.css))'
    r'(?P<query>\?v=(?P<version>[0-9a-f]{12}))?'
)


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def check_asset_sizes(errors: list[str]) -> None:
    for relative, baseline in BASELINES.items():
        path = ROOT / relative
        if not path.is_file():
            fail(f"missing performance-budget asset: {relative}", errors)
            continue
        actual = path.stat().st_size
        ceiling = int(baseline * HEADROOM)
        if actual > ceiling:
            growth = ((actual / baseline) - 1) * 100
            fail(
                f"{relative}: {actual:,} bytes exceeds {ceiling:,}-byte ceiling "
                f"({growth:.1f}% above baseline)",
                errors,
            )


def check_public_asset_limits(errors: list[str]) -> None:
    """Prevent any deployed asset from exceeding Cloudflare's 25 MiB file limit."""
    assets_root = ROOT / "assets"
    if not assets_root.is_dir():
        fail("missing public assets directory: assets", errors)
        return

    for path in assets_root.rglob("*"):
        if not path.is_file():
            continue
        actual = path.stat().st_size
        if actual > MAX_PUBLIC_ASSET_BYTES:
            fail(
                f"{path.relative_to(ROOT)}: {actual:,} bytes exceeds the "
                f"25 MiB per-asset deployment limit",
                errors,
            )


def check_cache_versions(errors: list[str]) -> None:
    """Require current content hashes for every locally served JS/CSS asset in HTML."""
    html_paths = [
        *sorted(ROOT.glob("*.html")),
        *sorted((ROOT / "en").rglob("*.html")),
        *sorted((ROOT / "hi").rglob("*.html")),
        *sorted((ROOT / "bn").rglob("*.html")),
    ]
    digest_cache: dict[str, str] = {}

    for html_path in html_paths:
        if not html_path.is_file():
            continue
        raw = html_path.read_text(encoding="utf-8", errors="ignore")
        for match in VERSIONED_ASSET_RE.finditer(raw):
            relative = match.group("asset").lstrip("/")
            asset_path = ROOT / relative
            if not asset_path.is_file():
                fail(
                    f"{html_path.relative_to(ROOT)} references missing cacheable asset {relative}",
                    errors,
                )
                continue

            if relative not in digest_cache:
                digest_cache[relative] = hashlib.sha256(asset_path.read_bytes()).hexdigest()[:12]

            actual = match.group("version")
            expected = digest_cache[relative]
            if actual != expected:
                observed = f"?v={actual}" if actual else "no version query"
                fail(
                    f"{html_path.relative_to(ROOT)} has a stale cache version for {relative}: "
                    f"expected ?v={expected}, got {observed}",
                    errors,
                )


def check_script_loading(errors: list[str]) -> None:
    for path in ROOT.glob("**/*.html"):
        if any(part in {".git", "node_modules"} for part in path.parts):
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")

        for match in re.finditer(
            r"<script\b([^>]*?)\bsrc=[\"']([^\"']+)[\"'][^>]*>",
            raw,
            flags=re.I | re.S,
        ):
            attrs = match.group(0)
            src = match.group(2).split("?", 1)[0]
            if "assets/js/bundles/" in src or src.endswith("/site-core.js"):
                if not re.search(r"\bdefer(?:\s*=|\s|>)", attrs, re.I):
                    fail(
                        f"{path.relative_to(ROOT)}: page runtime {src} is not deferred",
                        errors,
                    )

        analytics = re.findall(
            r"<script\b[^>]*src=[\"']([^\"']*googletagmanager\.com/gtag/js[^\"']*)[\"'][^>]*>",
            raw,
            flags=re.I | re.S,
        )
        for src in analytics:
            tag = re.search(
                rf"<script\b[^>]*src=[\"']{re.escape(src)}[\"'][^>]*>",
                raw,
                flags=re.I | re.S,
            )
            if tag and not re.search(r"\basync(?:\s*=|\s|>)", tag.group(0), re.I):
                fail(
                    f"{path.relative_to(ROOT)}: Google Analytics loader is not async: {src}",
                    errors,
                )


def check_responsive_mobile_hero_assets(errors: list[str]) -> None:
    """Keep mobile LCP hero derivatives, source selection, and preload hints synchronized."""
    hero_dir = ROOT / "assets" / "images" / "hero"
    for stem in ("index-hero", "product-hero"):
        desktop = hero_dir / f"{stem}.webp"
        mobile = hero_dir / f"{stem}-mobile.webp"
        if not desktop.is_file():
            fail(f"missing desktop hero image: {desktop.relative_to(ROOT)}", errors)
            continue
        if not mobile.is_file():
            fail(f"missing responsive mobile hero image: {mobile.relative_to(ROOT)}", errors)
            continue
        if mobile.stat().st_size >= desktop.stat().st_size:
            fail(
                f"{mobile.relative_to(ROOT)} must be smaller than "
                f"{desktop.relative_to(ROOT)} for mobile delivery",
                errors,
            )

    home_pages = [
        ROOT / "index.html",
        ROOT / "en" / "index.html",
        ROOT / "hi" / "index.html",
        ROOT / "bn" / "index.html",
    ]
    for path in home_pages:
        if not path.is_file():
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")
        if "home-hero-image" not in raw:
            continue
        mobile_source = re.search(
            r'<source\b(?=[^>]*\bmedia=["\']\(max-width:\s*768px\)["\'])'
            r'(?=[^>]*\bsrcset=["\'][^"\']*/assets/images/hero/index-hero-mobile\.webp\?v=[0-9a-f]{12}["\'])[^>]*>',
            raw,
            flags=re.I | re.S,
        )
        if not mobile_source:
            fail(f"{path.relative_to(ROOT)}: home hero is missing its versioned mobile <source>", errors)
        for stem, media in (
            ("index-hero", r"\(min-width:\s*769px\)"),
            ("index-hero-mobile", r"\(max-width:\s*768px\)"),
        ):
            preload = re.search(
                r'<link\b(?=[^>]*\brel=["\']preload["\'])'
                r'(?=[^>]*\bas=["\']image["\'])'
                r'(?=[^>]*\bhref=["\'][^"\']*/assets/images/hero/'
                + re.escape(stem)
                + r'\.webp\?v=[0-9a-f]{12}["\'])'
                r'(?=[^>]*\bmedia=["\']' + media + r'["\'])[^>]*>',
                raw,
                flags=re.I | re.S,
            )
            if not preload:
                fail(
                    f"{path.relative_to(ROOT)}: missing {stem} preload with matching media condition",
                    errors,
                )

    product_pages = [ROOT / language / "products.html" for language in ("en", "hi", "bn")]
    for path in product_pages:
        if not path.is_file():
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")
        for stem, media in (
            ("product-hero", r"\(min-width:\s*769px\)"),
            ("product-hero-mobile", r"\(max-width:\s*768px\)"),
        ):
            preload = re.search(
                r'<link\b(?=[^>]*\brel=["\']preload["\'])'
                r'(?=[^>]*\bas=["\']image["\'])'
                r'(?=[^>]*\bhref=["\'][^"\']*/assets/images/hero/'
                + re.escape(stem)
                + r'\.webp\?v=[0-9a-f]{12}["\'])'
                r'(?=[^>]*\bmedia=["\']' + media + r'["\'])[^>]*>',
                raw,
                flags=re.I | re.S,
            )
            if not preload:
                fail(
                    f"{path.relative_to(ROOT)}: missing {stem} preload with matching media condition",
                    errors,
                )

    base_css = ROOT / "assets" / "css" / "site-base.css"
    if not base_css.is_file():
        fail("missing assets/css/site-base.css for responsive product-hero source", errors)
    else:
        css = base_css.read_text(encoding="utf-8", errors="ignore")
        if not re.search(
            r'@media\s*\(max-width:\s*768px\)[\s\S]{0,500}'
            r'\.products-hero\s*\{[\s\S]{0,250}product-hero-mobile\.webp\?v=[0-9a-f]{12}',
            css,
            flags=re.I,
        ):
            fail(
                "assets/css/site-base.css: product listing has no versioned mobile hero background override",
                errors,
            )


def main() -> int:
    errors: list[str] = []
    check_asset_sizes(errors)
    check_public_asset_limits(errors)
    check_cache_versions(errors)
    check_script_loading(errors)
    check_responsive_mobile_hero_assets(errors)

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        print(f"Performance guard failed: {len(errors)} issue(s).", file=sys.stderr)
        return 1

    print(
        f"Performance guard passed: {len(BASELINES)} asset budgets, "
        "25 MiB public-asset limits, JS/CSS cache hashes, script-loading contracts, "
        "and responsive mobile hero assets/preloads checked."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
