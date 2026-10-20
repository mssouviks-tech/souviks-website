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


def add_product_hero_preloads(mapping: dict[str, str]) -> int:
    source = "assets/images/hero/product-hero.png"
    target = mapping.get(source)
    if not target or not (ROOT / target).is_file():
        return 0
    digest = hashlib.sha256((ROOT / target).read_bytes()).hexdigest()[:12]
    href = f"/{target}?v={digest}"
    link = f'<link rel="preload" as="image" href="{href}" fetchpriority="high">'
    changed = 0
    for language in ("en", "hi", "bn"):
        page = ROOT / language / "products.html"
        if not page.is_file():
            continue
        text = page.read_text(encoding="utf-8")
        if href in text or "product-hero" in text and re.search(r'<link\b[^>]*rel=["\']preload["\'][^>]*product-hero', text, re.I):
            continue
        updated, count = re.subn(r"</head>", f"    {link}\n</head>", text, count=1, flags=re.IGNORECASE)
        if count and updated != text:
            page.write_text(updated, encoding="utf-8", newline="")
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

    rewritten = rewrite_references(mapping)
    versioned = version_webp_references(mapping)
    css_changes = flatten_base_css_imports()
    preloads = add_product_hero_preloads(mapping)
    preconnects = add_supabase_preconnects()
    print(
        f"[IMAGE] Optimised {converted} shared images; saved {saved_bytes:,} bytes; "
        f"rewrote {rewritten} files, versioned image refs in {versioned}, "
        f"flattened {css_changes} CSS imports/HTML links, added {preloads} hero preloads, "
        f"and added {preconnects} Supabase CDN preconnects. Product images were not touched or resized."
    )


if __name__ == "__main__":
    main()
