#!/usr/bin/env python3
"""Generate correctly cropped AVIF/WebP mobile hero assets and wire them into listings."""

from __future__ import annotations
import hashlib
import re
from pathlib import Path
from PIL import Image
import pillow_avif  # noqa: F401; registers AVIF support

ROOT = Path(__file__).resolve().parents[2]
HERO = ROOT / "assets/images/hero"
SOURCE = HERO / "product-hero-mobile.webp"
AVIF = HERO / "product-hero-mobile-crop.avif"
WEBP = HERO / "product-hero-mobile-crop.webp"
LANGUAGES = ("en", "hi", "bn")


def short_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def build_assets() -> None:
    if AVIF.exists() and WEBP.exists():
        return
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source image: {SOURCE}")
    with Image.open(SOURCE) as source:
        source = source.convert("RGB")
        width, height = source.size
        crop_width = round(height * 412 / 463)
        left = round((width - crop_width) * 0.72)
        left = max(0, min(left, width - crop_width))
        crop = source.crop((left, 0, left + crop_width, height))
        crop.save(AVIF, format="AVIF", quality=50, speed=6)
        crop.save(WEBP, format="WEBP", quality=78, method=6)
    if AVIF.stat().st_size >= SOURCE.stat().st_size or WEBP.stat().st_size >= SOURCE.stat().st_size:
        raise SystemExit("Optimized mobile hero crops must both be smaller than the source")


def patch_pages() -> None:
    avif_hash, webp_hash = short_hash(AVIF), short_hash(WEBP)
    old_preload = re.compile(
        r'<link rel="preload" as="image" href="/assets/images/hero/product-hero-mobile\.webp\?v=[0-9a-f]{12}" type="image/webp" media="\(max-width: 768px\)" fetchpriority="high">'
    )
    new_preload = (
        f'<link rel="preload" as="image" href="/assets/images/hero/product-hero-mobile-crop.avif?v={avif_hash}" '
        'type="image/avif" media="(max-width: 768px)" fetchpriority="high">'
    )
    old_picture_source = re.compile(
        r'        <source\n            media="\(max-width: 768px\)"\n'
        r'            srcset="/assets/images/hero/product-hero-mobile\.webp\?v=[0-9a-f]{12}"\n'
        r'            type="image/webp">'
    )
    new_picture_sources = (
        '        <source\n            media="(max-width: 768px)"\n'
        f'            srcset="/assets/images/hero/product-hero-mobile-crop.avif?v={avif_hash}"\n'
        '            type="image/avif">\n'
        '        <source\n            media="(max-width: 768px)"\n'
        f'            srcset="/assets/images/hero/product-hero-mobile-crop.webp?v={webp_hash}"\n'
        '            type="image/webp">'
    )

    for language in LANGUAGES:
        path = ROOT / language / "products.html"
        html = path.read_text(encoding="utf-8")
        if "product-hero-mobile-crop.avif" not in html:
            html, count = old_preload.subn(new_preload, html, count=1)
            if count != 1:
                raise SystemExit(f"{path}: mobile hero preload not found")
            html, count = old_picture_source.subn(new_picture_sources, html, count=1)
            if count != 1:
                raise SystemExit(f"{path}: mobile hero WebP source not found")
        else:
            html = re.sub(
                r'product-hero-mobile-crop\.avif\?v=[0-9a-f]{12}',
                f'product-hero-mobile-crop.avif?v={avif_hash}', html
            )
            html = re.sub(
                r'product-hero-mobile-crop\.webp\?v=[0-9a-f]{12}',
                f'product-hero-mobile-crop.webp?v={webp_hash}', html
            )
        # The AVIF crop is the sole mobile hero preload. Remove stale
        # full-image/WebP and previous crop preloads while keeping the picture
        # source as a fallback for browsers without AVIF support.
        mobile_hero_preloads = re.compile(
            r'<link\\b'
            r'(?=[^>]*\\brel=["\\']preload["\\'])'
            r'(?=[^>]*\\bas=["\\']image["\\'])'
            r'(?=[^>]*\\bhref=["\\'][^"\\']*/assets/images/hero/'
            r'product-hero-mobile(?:-crop)?\\.(?:avif|webp)(?:\\?[^"\\']*)?["\\'])'
            r'[^>]*>\\s*',
            flags=re.I | re.S,
        )
        html = mobile_hero_preloads.sub("", html)
        html, preload_count = re.subn(
            r'(<head\\b[^>]*>)',
            lambda match: match.group(1) + "\\n    " + new_preload + "\\n",
            html,
            count=1,
            flags=re.I,
        )
        if preload_count != 1:
            raise SystemExit(f"{path}: unable to insert the single AVIF mobile hero preload")
        html = html.replace('decoding="sync">', 'decoding="async">')

        grid_at = html.find('id="product-grid"')
        if grid_at < 0:
            raise SystemExit(f"{path}: #product-grid not found")
        prefix, grid = html[:grid_at], html[grid_at:]

        def lazy_card(match: re.Match[str]) -> str:
            tag = re.sub(r'\bloading="eager"', 'loading="lazy"', match.group(0), flags=re.I)
            return re.sub(r'\s+fetchpriority="high"', '', tag, flags=re.I)

        grid = re.sub(
            r'<img\b(?=[^>]*\bclass="[^"]*\bproduct-image-file\b[^"]*")[^>]*>',
            lazy_card, grid, flags=re.I | re.S
        )
        path.write_text(prefix + grid, encoding="utf-8", newline="")


def patch_generators_and_guard() -> None:
    generator = ROOT / "scripts/catalogue/sync_product_cards.py"
    source = generator.read_text(encoding="utf-8")
    source = source.replace(
        '        product_card_html(product, language, eager=index < 2)\n'
        '        for index, product in enumerate(products[:INITIAL_PAGE_SIZE])',
        '        product_card_html(product, language, eager=False)\n'
        '        for product in products[:INITIAL_PAGE_SIZE]',
        1
    )
    generator.write_text(source, encoding="utf-8", newline="")

    guard_path = ROOT / "scripts/audit/performance_guard.py"
    guard = guard_path.read_text(encoding="utf-8")
    # Update the existing product hero preload and WebP source path contracts.
    guard = guard.replace(
        r'product-hero-mobile\.webp\?v=[0-9a-f]{12}',
        r'product-hero-mobile-crop\.avif\?v=[0-9a-f]{12}', 1
    )
    guard = guard.replace(
        r'product-hero-mobile\.webp\?v=[0-9a-f]{12}',
        r'product-hero-mobile-crop\.webp\?v=[0-9a-f]{12}', 1
    )
    start = guard.index("def check_listing_critical_image_loading")
    end = guard.index("\ndef main()", start)
    revised = '''def check_listing_critical_image_loading(errors: list[str]) -> None:
    """Keep priority on the LCP hero and defer all product-card images."""
    for language in ("en", "hi", "bn"):
        path = ROOT / language / "products.html"
        if not path.is_file():
            fail(f"missing {language} product listing for image priority contract", errors)
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")
        hero = re.search(
            r'<img\\b(?=[^>]*\\bclass=["\\'][^"\\']*\\bproducts-hero-media\\b[^"\\']*["\\'])[^>]*>',
            raw, flags=re.I | re.S
        )
        if not hero:
            fail(f"{path.relative_to(ROOT)}: missing product hero image", errors)
        else:
            tag = hero.group(0)
            for attr, label in ((r'\\bloading=["\\']eager["\\']', "eager loading"),
                                (r'\\bfetchpriority=["\\']high["\\']', "high fetch priority"),
                                (r'\\bdecoding=["\\']async["\\']', "asynchronous decoding")):
                if not re.search(attr, tag, re.I):
                    fail(f"{path.relative_to(ROOT)}: LCP hero must retain {label}", errors)

        grid_start = raw.find('id="product-grid"')
        if grid_start < 0:
            fail(f"{path.relative_to(ROOT)}: missing #product-grid", errors)
            continue
        image_tags = re.findall(
            r'<img\\b(?=[^>]*\\bclass=["\\'][^"\\']*\\bproduct-image-file\\b[^"\\']*["\\'])[^>]*>',
            raw[grid_start:], flags=re.I | re.S
        )[:4]
        if len(image_tags) != 4:
            fail(f"{path.relative_to(ROOT)}: expected four initial product-card images, found {len(image_tags)}", errors)
            continue
        for index, tag in enumerate(image_tags):
            loading = re.search(r'\\bloading=["\\']([^"\\']+)["\\']', tag, re.I)
            priority = re.search(r'\\bfetchpriority=["\\']([^"\\']+)["\\']', tag, re.I)
            if not loading or loading.group(1).lower() != "lazy":
                fail(f"{path.relative_to(ROOT)}: product image {index + 1} must be lazy loaded", errors)
            if priority and priority.group(1).lower() == "high":
                fail(f"{path.relative_to(ROOT)}: product image {index + 1} must not be high priority", errors)


def check_mobile_listing_hero_assets(errors: list[str]) -> None:
    """Validate crop files, content hashes, and AVIF/WebP responsive source order."""
    hero_dir = ROOT / "assets/images/hero"
    expected = {}
    for filename in ("product-hero-mobile-crop.avif", "product-hero-mobile-crop.webp"):
        path = hero_dir / filename
        if not path.is_file():
            fail(f"missing optimized mobile product hero: {path.relative_to(ROOT)}", errors)
        else:
            expected[filename] = hashlib.sha256(path.read_bytes()).hexdigest()[:12]

    for language in ("en", "hi", "bn"):
        page = ROOT / language / "products.html"
        if not page.is_file():
            continue
        raw = page.read_text(encoding="utf-8", errors="ignore")
        for filename, version in expected.items():
            if f"{filename}?v={version}" not in raw:
                fail(f"{page.relative_to(ROOT)}: stale or missing content hash for {filename}", errors)
        picture = re.search(
            r'<picture\\b(?=[^>]*\\bclass=["\\'][^"\\']*\\bproducts-hero-picture\\b[^"\\']*["\\'])'
            r'[^>]*>([\\s\\S]*?)</picture\\s*>',
            raw, flags=re.I | re.S
        )
        if not picture:
            fail(f"{page.relative_to(ROOT)}: missing responsive product hero picture", errors)
            continue
        markup = picture.group(1)
        avif = re.search(
            r'<source\\b(?=[^>]*\\bmedia=["\\']\\(max-width:\\s*768px\\)["\\'])'
            r'(?=[^>]*\\bsrcset=["\\'][^"\\']*product-hero-mobile-crop\\.avif\\?v=[0-9a-f]{12}["\\'])'
            r'(?=[^>]*\\btype=["\\']image/avif["\\'])[^>]*>',
            markup, flags=re.I | re.S
        )
        webp = re.search(
            r'<source\\b(?=[^>]*\\bmedia=["\\']\\(max-width:\\s*768px\\)["\\'])'
            r'(?=[^>]*\\bsrcset=["\\'][^"\\']*product-hero-mobile-crop\\.webp\\?v=[0-9a-f]{12}["\\'])'
            r'(?=[^>]*\\btype=["\\']image/webp["\\'])[^>]*>',
            markup, flags=re.I | re.S
        )
        if not avif or not webp:
            fail(f"{page.relative_to(ROOT)}: AVIF source and cropped WebP fallback are required", errors)
        elif markup.find(avif.group(0)) > markup.find(webp.group(0)):
            fail(f"{page.relative_to(ROOT)}: AVIF source must precede WebP fallback", errors)

'''
    guard = guard[:start] + revised + guard[end:]
    guard = guard.replace(
        "    check_listing_critical_image_loading(errors)\n",
        "    check_listing_critical_image_loading(errors)\n    check_mobile_listing_hero_assets(errors)\n",
        1
    )
    guard_path.write_text(guard, encoding="utf-8", newline="")


def main() -> int:
    build_assets()
    patch_pages()
    patch_generators_and_guard()
    print(
        f"Created mobile hero crop: AVIF {AVIF.stat().st_size:,} bytes "
        f"({short_hash(AVIF)}); WebP {WEBP.stat().st_size:,} bytes "
        f"({short_hash(WEBP)}). Original pixels are cropped, never enlarged."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
