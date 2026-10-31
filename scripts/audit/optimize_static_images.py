#!/usr/bin/env python3
"""Optimise shared UI imagery and make its references safe for CDN caching.

Product catalogue imagery is deliberately excluded: product image files and
their native pixel dimensions are never modified or upscaled by this script.
"""
from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SKIP_DIRS = {".git", "node_modules", ".venv", "__pycache__", ".pytest_cache"}
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".webmanifest", ".txt"}
SERVED_SUFFIXES = {".html", ".css", ".js", ".xml", ".webmanifest"}
PHOTO_QUALITY = 82
GRAPHIC_QUALITY = 88
LOGO_QUALITY = 92
MAX_DIMENSIONS = {
    "hero": (1920, 1920),
    "categories": (512, 512),
    "support": (256, 256),
    "logo": (512, 512),
}
GA_BLOCK_RE = re.compile(
    r'^[ \t]*<!--\s*Google tag \(gtag\.js\)\s*-->\s*'
    r'<script\s+async\s+src=["\']https://www\.googletagmanager\.com/gtag/js\?id=G-FDLYP5QB8V["\']\s*>\s*</script>\s*'
    r'<script>\s*window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\];\s*'
    r'function\s+gtag\(\)\s*\{\s*dataLayer\.push\(arguments\);\s*\}\s*'
    r'gtag\(\s*[\'"]js[\'"]\s*,\s*new Date\(\)\s*\);\s*'
    r'gtag\(\s*[\'"]config[\'"]\s*,\s*[\'"]G-FDLYP5QB8V[\'"]\s*\);\s*</script>\s*',
    flags=re.IGNORECASE | re.DOTALL | re.MULTILINE,
)


def candidate_images() -> list[tuple[Path, int]]:
    result: list[tuple[Path, int]] = []
    hero_dir = ROOT / "assets/images/hero"
    categories_dir = ROOT / "assets/images/categories"
    support_icon = ROOT / "assets/icons/support.png"
    logo_dir = ROOT / "assets/logo"

    if hero_dir.exists():
        result.extend((path, PHOTO_QUALITY) for path in sorted(hero_dir.iterdir())
                      if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg"})
    if categories_dir.exists():
        result.extend((path, GRAPHIC_QUALITY) for path in sorted(categories_dir.glob("*.png")))
    if support_icon.exists():
        result.append((support_icon, GRAPHIC_QUALITY))
    for name in ("souviks-logo.png", "souviks-logo-white.png"):
        path = logo_dir / name
        if path.exists():
            result.append((path, LOGO_QUALITY))
    return result


def create_webp(source: Path, quality: int, max_dimensions: tuple[int, int]) -> Path | None:
    target = source.with_suffix(".webp")
    with Image.open(source) as original:
        original.load()
        # Preserve transparency and aspect ratio. Only downscale shared UI
        # imagery when its source exceeds the appropriate display ceiling.
        has_alpha = "A" in original.getbands() or "transparency" in original.info
        image = original.convert("RGBA" if has_alpha else "RGB")
        image.thumbnail(max_dimensions, Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=quality, method=6, exact=True)

    if target.stat().st_size >= source.stat().st_size * 0.95:
        target.unlink(missing_ok=True)
        return None
    return target


def served_text_files():
    for directory, dirnames, filenames in os.walk(ROOT):
        relative_dir = Path(directory).relative_to(ROOT)
        parts = relative_dir.parts
        if any(part in SKIP_DIRS for part in parts):
            dirnames[:] = []
            continue
        if parts and (parts[0] in {"scripts", "docs", ".github"} or parts[:2] == ("assets", "images")):
            dirnames[:] = []
            continue
        dirnames[:] = [name for name in dirnames if name not in SKIP_DIRS]
        for filename in filenames:
            path = Path(directory) / filename
            if path.suffix.lower() in TEXT_SUFFIXES:
                yield path


def rewrite_references(mapping: dict[str, str]) -> int:
    changed = 0
    for path in served_text_files():
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        original = text
        for old, new in mapping.items():
            text = text.replace(old, new)
        if path.suffix.lower() == ".html":
            text = GA_BLOCK_RE.sub("", text)
            # Keep image preloads' MIME type consistent with their WebP URL.
            text = re.sub(
                r'(<link\b[^>]*href=["\'][^"\']+\.webp(?:\?[^"\']*)?["\'][^>]*type=["\'])image/(?:png|jpe?g)(["\'])',
                r'\1image/webp\2',
                text,
                flags=re.IGNORECASE,
            )
            # The support illustration is a small UI graphic, not a 1254px image.
            text = re.sub(
                r'(<img\b(?=[^>]*src=["\'][^"\']*/assets/icons/support(?:\.webp)?(?:\?[^"\']*)?["\'])[^>]*?)width=["\']1254["\']',
                r'\1width="256"', text, flags=re.IGNORECASE | re.DOTALL,
            )
            text = re.sub(
                r'(<img\b(?=[^>]*src=["\'][^"\']*/assets/icons/support(?:\.webp)?(?:\?[^"\']*)?["\'])[^>]*?)height=["\']1254["\']',
                r'\1height="256"', text, flags=re.IGNORECASE | re.DOTALL,
            )
        if text != original:
            path.write_text(text, encoding="utf-8", newline="")
            changed += 1
    return changed


def version_webp_references(mapping: dict[str, str]) -> int:
    versions: dict[str, str] = {}
    for target in set(mapping.values()):
        path = ROOT / target
        if path.is_file() and path.suffix.lower() == ".webp":
            versions[target] = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    changed = 0
    for path in served_text_files():
        if path.suffix.lower() not in SERVED_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        original = text
        for asset_path, digest in versions.items():
            text = re.sub(
                re.escape(asset_path) + r"(?!\?v=)",
                asset_path + "?v=" + digest,
                text,
            )
        if text != original:
            path.write_text(text, encoding="utf-8", newline="")
            changed += 1
    return changed


def flatten_base_css_imports() -> int:
    base_css = ROOT / "assets/css/site-base.css"
    bundles_dir = ROOT / "assets/css/bundles"
    if not base_css.is_file() or not bundles_dir.is_dir():
        return 0

    changed = 0
    for bundle in sorted(bundles_dir.glob("*.css")):
        text = bundle.read_text(encoding="utf-8")
        updated = re.sub(
            r'^\s*@import\s+["\']\.\./site-base\.css(?:\?v=[^"\']*)?["\']\s*;\s*',
            "",
            text,
            count=1,
            flags=re.IGNORECASE,
        )
        if updated != text:
            bundle.write_text(updated, encoding="utf-8", newline="")
            changed += 1

    # Load base CSS explicitly before each page bundle so both stylesheets are
    # discovered together rather than waiting for a CSS @import waterfall.
    for path in served_text_files():
        if path.suffix.lower() != ".html":
            continue
        text = path.read_text(encoding="utf-8")
        if not re.search(r'<link\b[^>]*href=["\'][^"\']*/assets/css/bundles/[^"\']+\.css(?:\?[^"\']*)?["\']', text, re.I):
            continue
        if re.search(r'<link\b[^>]*href=["\'][^"\']*/assets/css/site-base\.css(?:\?[^"\']*)?["\']', text, re.I):
            continue
        updated, count = re.subn(
            r'(?=<link\b[^>]*href=["\'][^"\']*/assets/css/bundles/[^"\']+\.css(?:\?[^"\']*)?["\'])',
            '<link rel="stylesheet" href="/assets/css/site-base.css">\n    ',
            text,
            count=1,
            flags=re.IGNORECASE,
        )
        if count and updated != text:
            path.write_text(updated, encoding="utf-8", newline="")
            changed += 1
    return changed


def create_mobile_hero_variants() -> dict[str, str]:
    """Create smaller, never-upscaled mobile derivatives for the two LCP hero images."""
    configs = {
        "index-hero": ((1440, 1440), 74),
        "product-hero": ((1440, 1440), 73),
    }
    created: dict[str, str] = {}
    hero_dir = ROOT / "assets" / "images" / "hero"

    for stem, (max_dimensions, quality) in configs.items():
        source = hero_dir / f"{stem}.webp"
        target = hero_dir / f"{stem}-mobile.webp"
        if not source.is_file():
            print(f"[IMAGE] Mobile hero derivative skipped; source missing: {source.relative_to(ROOT)}")
            target.unlink(missing_ok=True)
            continue

        with Image.open(source) as original:
            original.load()
            source_dimensions = original.size
            has_alpha = "A" in original.getbands() or "transparency" in original.info
            image = original.convert("RGBA" if has_alpha else "RGB")
            image.thumbnail(max_dimensions, Image.Resampling.LANCZOS)
            if image.width > source_dimensions[0] or image.height > source_dimensions[1]:
                raise RuntimeError(f"Mobile hero derivative must not upscale {source.relative_to(ROOT)}")
            image.save(target, "WEBP", quality=quality, method=6, exact=True)

        original_bytes = source.stat().st_size
        derivative_bytes = target.stat().st_size
        if derivative_bytes >= original_bytes * 0.98:
            target.unlink(missing_ok=True)
            print(
                f"[IMAGE] Mobile hero derivative skipped; less than 2% saving: "
                f"{source.relative_to(ROOT)}"
            )
            continue

        relative_target = target.relative_to(ROOT).as_posix()
        created[stem] = relative_target
        print(
            f"[IMAGE] Mobile {stem}: {original_bytes:,} -> {derivative_bytes:,} bytes "
            f"({1 - derivative_bytes / original_bytes:.1%} smaller; no upscaling)"
        )

    return created


def sync_hero_preloads(
    page: Path,
    stem: str,
    has_mobile_variant: bool,
    preload_desktop: bool = True,
) -> bool:
    """Place responsive hero preloads at the start of <head>, before large inline metadata.

    Product listing pages use a responsive <picture> with fetchpriority=high.
    Their desktop fallback therefore needs no separate preload: some mobile
    browser/Lighthouse combinations still fetch a media-conditioned desktop
    preload alongside the mobile source, creating a duplicate transfer.
    """
    if not page.is_file():
        return False

    source_path = f"/assets/images/hero/{stem}.webp"
    mobile_path = f"/assets/images/hero/{stem}-mobile.webp"
    desktop_media = ' media="(min-width: 769px)"' if has_mobile_variant else ""
    links = []
    if preload_desktop:
        desktop_link = (
            f'<link rel="preload" as="image" href="{source_path}" type="image/webp"'
            f'{desktop_media} fetchpriority="high">'
        )
        links.append(desktop_link)
    if has_mobile_variant:
        links.append(
            f'<link rel="preload" as="image" href="{mobile_path}" type="image/webp" '
            'media="(max-width: 768px)" fetchpriority="high">'
        )

    raw = page.read_text(encoding="utf-8")
    original = raw
    preload_pattern = re.compile(
        r'<link\b'
        r'(?=[^>]*\brel=["\']preload["\'])'
        r'(?=[^>]*\bas=["\']image["\'])'
        r'(?=[^>]*\bhref=["\'][^"\']*/assets/images/hero/'
        + re.escape(stem)
        + r'(?:-mobile)?\.webp(?:\?[^"\']*)?["\'])'
        r'[^>]*>\s*',
        flags=re.I | re.S,
    )
    raw = preload_pattern.sub("", raw)
    insert = "\n    " + "\n    ".join(links) + "\n"
    updated, count = re.subn(
        r"(<head\b[^>]*>)",
        lambda match: match.group(1) + insert,
        raw,
        count=1,
        flags=re.I,
    )
    if count and updated != original:
        page.write_text(updated, encoding="utf-8", newline="")
        return True
    return False


def sync_home_hero_picture(page: Path, mobile_path: str | None) -> bool:
    """Let mobile browsers select the smaller home hero without downloading desktop imagery."""
    if not page.is_file():
        return False

    raw = page.read_text(encoding="utf-8")
    original = raw
    image_pattern = re.compile(
        r'<img\b(?=[^>]*\bclass=["\'][^"\']*\bhome-hero-image\b[^"\']*["\'])[^>]*>',
        flags=re.I | re.S,
    )
    image_match = image_pattern.search(raw)
    if not image_match:
        return False

    picture_open = (
        '<picture class="home-hero-picture">'
        f'<source media="(max-width: 768px)" srcset="/{mobile_path}" type="image/webp">'
    ) if mobile_path else ""
    picture_close = "</picture>" if mobile_path else ""

    surrounding = raw[max(0, image_match.start() - 350):image_match.start()]
    if "<picture" in surrounding and "home-hero-picture" in surrounding:
        # Idempotently update the source element if the generator runs again.
        picture_source_pattern = re.compile(
            r'<source\b(?=[^>]*\bmedia=["\']\(max-width:\s*768px\)["\'])'
            r'(?=[^>]*\bsrcset=["\'][^"\']*index-hero(?:-mobile)?\.webp(?:\?[^"\']*)?["\'])[^>]*>',
            flags=re.I | re.S,
        )
        if mobile_path:
            updated, count = picture_source_pattern.subn(
                f'<source media="(max-width: 768px)" srcset="/{mobile_path}" type="image/webp">',
                raw,
                count=1,
            )
            if count:
                raw = updated
        else:
            raw = picture_source_pattern.sub("", raw, count=1)
            raw = re.sub(r'<picture\b[^>]*class=["\']home-hero-picture["\']>(.*?)</picture>', r'\1', raw, count=1, flags=re.I | re.S)
    elif mobile_path:
        raw = raw[:image_match.start()] + picture_open + image_match.group(0) + picture_close + raw[image_match.end():]
    if raw != original:
        page.write_text(raw, encoding="utf-8", newline="")
        return True
    return False


def sync_responsive_hero_assets(mobile_variants: dict[str, str]) -> int:
    """Wire mobile hero derivatives through picture/source selection, CSS, and early preloads."""
    changed = 0

    index_mobile = mobile_variants.get("index-hero")
    if index_mobile:
        for relative in ("index.html", "en/index.html", "hi/index.html", "bn/index.html"):
            page = ROOT / relative
            changed += sync_home_hero_picture(page, index_mobile)
    for relative in ("index.html", "en/index.html", "hi/index.html", "bn/index.html"):
        changed += sync_hero_preloads(
            ROOT / relative,
            "index-hero",
            bool(index_mobile),
            preload_desktop=False,
        )

    product_mobile = mobile_variants.get("product-hero")
    for language in ("en", "hi", "bn"):
        changed += sync_hero_preloads(
            ROOT / language / "products.html",
            "product-hero",
            bool(product_mobile),
            preload_desktop=False,
        )

    css_path = ROOT / "assets" / "css" / "site-base.css"
    if css_path.is_file():
        css = css_path.read_text(encoding="utf-8")
        original = css
        marker = "/* Generated responsive mobile product-hero source. */"
        block = ""
        if product_mobile:
            block = (
                marker + "\n"
                "@media (max-width: 768px) {\n"
                "    .products-hero {\n"
                f'        --hero-image: url("/{product_mobile}");\n'
                "    }\n"
                "}\n"
            )
        existing_block = re.compile(
            r"\n?/\* Generated responsive mobile product-hero source\. \*/[\s\S]*$",
            flags=re.I,
        )
        if existing_block.search(css):
            css = existing_block.sub("\n\n" + block if block else "", css).rstrip() + "\n"
        elif block:
            css = css.rstrip() + "\n\n" + block
        if css != original:
            css_path.write_text(css, encoding="utf-8", newline="")
            changed += 1

    return changed


def add_supabase_preconnects() -> int:
    """Open the CDN connection early on pages that load the Supabase browser client."""
    changed = 0
    link = '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'
    for path in served_text_files():
        if path.suffix.lower() != ".html":
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if "cdn.jsdelivr.net/npm/@supabase/supabase-js" not in text or link in text:
            continue
        updated, count = re.subn(
            r"(<head\b[^>]*>)",
            r"\1\n    " + link + r"\n",
            text,
            count=1,
            flags=re.IGNORECASE,
        )
        if count and updated != text:
            path.write_text(updated, encoding="utf-8", newline="")
            changed += 1
    return changed


def main() -> None:
    # Run this before generation and again after generation to catch templates.
    mapping: dict[str, str] = {}
    saved_bytes = 0
    converted = 0
    for source, quality in candidate_images():
        original_size = source.stat().st_size
        relative = source.relative_to(ROOT).as_posix()
        if "/images/hero/" in relative:
            max_dimensions = MAX_DIMENSIONS["hero"]
        elif "/images/categories/" in relative:
            max_dimensions = MAX_DIMENSIONS["categories"]
        elif "/icons/support." in relative:
            max_dimensions = MAX_DIMENSIONS["support"]
        else:
            max_dimensions = MAX_DIMENSIONS["logo"]

        target = create_webp(source, quality, max_dimensions)
        relative_source = source.relative_to(ROOT).as_posix()
        relative_webp = source.with_suffix(".webp").relative_to(ROOT).as_posix()
        if target is None:
            mapping[relative_source] = relative_source
            mapping[relative_webp] = relative_source
            print(f"[IMAGE] Keeping source format (WebP savings below 5%): {relative}")
            continue
        mapping[relative_source] = relative_webp
        saved = original_size - target.stat().st_size
        saved_bytes += saved
        converted += 1
        print(
            f"[IMAGE] {relative_source}: {original_size:,} -> {target.stat().st_size:,} bytes "
            f"({saved / original_size:.1%} smaller; no upscaling)"
        )

    mobile_hero_variants = create_mobile_hero_variants()
    # Include generated derivatives in the cache-version pass without rewriting their own paths.
    for relative_path in mobile_hero_variants.values():
        mapping[relative_path] = relative_path

    rewritten = rewrite_references(mapping)
    responsive_hero_updates = sync_responsive_hero_assets(mobile_hero_variants)
    versioned = version_webp_references(mapping)
    css_changes = flatten_base_css_imports()
    preconnects = add_supabase_preconnects()
    print(
        f"[IMAGE] Optimised {converted} shared images; saved {saved_bytes:,} bytes; "
        f"rewrote {rewritten} files, versioned image refs in {versioned}, "
        f"flattened {css_changes} CSS imports/HTML links, synchronized responsive hero markup in "
        f"{responsive_hero_updates} files, and added {preconnects} Supabase CDN preconnects. "
        "Product images were not touched or resized."
    )


if __name__ == "__main__":
    main()
