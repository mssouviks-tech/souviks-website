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
SERVED_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".webmanifest"}
PHOTO_QUALITY = 82
GRAPHIC_QUALITY = 88
LOGO_QUALITY = 92
MAX_DIMENSIONS = {
    "hero": (1920, 1920),
    "categories": (512, 512),
    "support": (256, 256),
    "logo": (512, 512),
    "brands": (512, 512),
    "about": (1600, 1600),
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


def referenced_image_paths(group: str) -> list[Path]:
    """Return shared UI image sources that are actually referenced by served content."""
    prefix = f"assets/images/{group}/"
    pattern = re.compile(
        r"(?<![A-Za-z0-9])/?"
        + re.escape(prefix)
        + r"""[^"'\s<>?#,]+"""
    )
    referenced: set[Path] = set()
    for text_path in served_text_files():
        try:
            content = text_path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for match in pattern.finditer(content):
            candidate = ROOT / match.group(0).lstrip("/")
            if candidate.is_file():
                referenced.add(candidate)
    return sorted(referenced)


def referenced_image_sources(group: str) -> list[Path]:
    """Resolve referenced WebP derivatives back to retained source images."""
    source_extensions = (".png", ".jpg", ".jpeg")
    sources: set[Path] = set()
    for referenced in referenced_image_paths(group):
        suffix = referenced.suffix.lower()
        if suffix in source_extensions:
            if referenced.is_file():
                sources.add(referenced)
            continue
        if suffix != ".webp":
            continue
        for extension in source_extensions:
            source = referenced.with_suffix(extension)
            if source.is_file():
                sources.add(source)
                break
    return sorted(sources)


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

    # Brand logos appear on the directory and brand-detail pages. Only optimise
    # files referenced by served HTML/data, retain alpha, and cap their native
    # canvas to a 512px ceiling without upscaling.
    result.extend(
        (path, LOGO_QUALITY)
        for path in referenced_image_sources("brands")
    )

    # The about page uses real store/gallery photography. These are shared UI
    # assets (not product master images); preserve aspect ratio and never enlarge.
    result.extend(
        (path, PHOTO_QUALITY)
        for path in referenced_image_sources("about")
    )
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


def version_image_references(mapping: dict[str, str]) -> int:
    """Add content hashes to referenced WebP and AVIF image URLs."""
    versions: dict[str, str] = {}
    for target in set(mapping.values()):
        path = ROOT / target
        if path.is_file() and path.suffix.lower() in {".webp", ".avif"}:
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
                re.escape(asset_path) + r"(?:\?v=[0-9a-f]{12})?(?![A-Za-z0-9])",
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
    """Create responsive hero derivatives without enlarging or altering source files."""
    created: dict[str, str] = {}
    hero_dir = ROOT / "assets" / "images" / "hero"

    # The mobile homepage hero is displayed in a tall, right-aligned viewport.
    # Crop to its approximate 2:3 aspect ratio before encoding, keeping the
    # right edge to match CSS object-position: center right.
    home_source = hero_dir / "index-hero.webp"
    if home_source.is_file():
        home_avif = hero_dir / "index-hero-mobile-crop.avif"
        home_webp = hero_dir / "index-hero-mobile-crop.webp"
        with Image.open(home_source) as original:
            original.load()
            source_width, source_height = original.size
            crop_width = min(source_width, round(source_height * 2 / 3))
            crop_left = max(0, source_width - crop_width)
            image = original.convert("RGB")
            crop = image.crop((crop_left, 0, crop_left + crop_width, source_height))
            if crop.width > source_width or crop.height > source_height:
                raise RuntimeError("Homepage mobile hero crop must never upscale its source")
            crop.save(home_avif, format="AVIF", quality=38, speed=6)
            crop.save(home_webp, format="WEBP", quality=58, method=6, exact=True)

        for target in (home_avif, home_webp):
            if target.stat().st_size > 80_000:
                raise SystemExit(
                    f"{target.relative_to(ROOT)} exceeds the 80,000-byte mobile hero budget: "
                    f"{target.stat().st_size:,} bytes"
                )
            key = "index-hero-mobile-crop-avif" if target.suffix == ".avif" else "index-hero-mobile-crop-webp"
            created[key] = target.relative_to(ROOT).as_posix()
            print(
                f"[IMAGE] Mobile homepage hero {target.suffix[1:].upper()}: "
                f"{source_width}x{source_height} -> {crop.width}x{crop.height}, "
                f"{target.stat().st_size:,} bytes; right-aligned native-resolution crop."
            )
    else:
        print(f"[IMAGE] Mobile homepage hero crop skipped; source missing: {home_source.relative_to(ROOT)}")

    # Keep the existing listing hero derivative process unchanged.
    source = hero_dir / "product-hero.webp"
    target = hero_dir / "product-hero-mobile.webp"
    if not source.is_file():
        print(f"[IMAGE] Mobile listing hero derivative skipped; source missing: {source.relative_to(ROOT)}")
        target.unlink(missing_ok=True)
    else:
        with Image.open(source) as original:
            original.load()
            source_dimensions = original.size
            has_alpha = "A" in original.getbands() or "transparency" in original.info
            image = original.convert("RGBA" if has_alpha else "RGB")
            image.thumbnail((1440, 1440), Image.Resampling.LANCZOS)
            if image.width > source_dimensions[0] or image.height > source_dimensions[1]:
                raise RuntimeError(f"Mobile hero derivative must not upscale {source.relative_to(ROOT)}")
            image.save(target, format="WEBP", quality=73, method=6, exact=True)

        original_bytes = source.stat().st_size
        derivative_bytes = target.stat().st_size
        if derivative_bytes >= original_bytes * 0.98:
            target.unlink(missing_ok=True)
            print(
                f"[IMAGE] Mobile listing hero derivative skipped; less than 2% saving: "
                f"{source.relative_to(ROOT)}"
            )
        else:
            created["product-hero-mobile"] = target.relative_to(ROOT).as_posix()
            print(
                f"[IMAGE] Mobile product hero: {original_bytes:,} -> {derivative_bytes:,} bytes "
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

    Home and product listing pages use a responsive <picture> with fetchpriority=high.
    Their desktop fallback therefore needs no separate preload: mobile Chromium
    and Lighthouse can still fetch a media-conditioned desktop preload alongside
    the mobile source, creating a duplicate transfer.
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


def sync_home_hero_picture(
    page: Path,
    mobile_avif_path: str | None,
    mobile_webp_path: str | None,
) -> bool:
    """Wire AVIF with WebP fallback into the mobile homepage hero picture."""
    if not page.is_file() or not mobile_avif_path or not mobile_webp_path:
        return False

    raw = page.read_text(encoding="utf-8")
    original = raw
    source_markup = (
        '<source media="(max-width: 768px)" '
        f'srcset="/{mobile_avif_path}" type="image/avif">\n'
        '<source media="(max-width: 768px)" '
        f'srcset="/{mobile_webp_path}" type="image/webp">\n'
    )
    picture_pattern = re.compile(
        r'<picture\b(?=[^>]*\bclass=["\'][^"\']*\bhome-hero-picture\b[^"\']*["\'])'
        r'[^>]*>([\s\S]*?)</picture\s*>',
        flags=re.I | re.S,
    )
    picture_match = picture_pattern.search(raw)

    if picture_match:
        inner = picture_match.group(1)
        inner = re.sub(
            r'<source\b(?=[^>]*\bmedia=["\']\(max-width:\s*768px\)["\'])'
            r'(?=[^>]*\bsrcset=["\'][^"\']*/assets/images/hero/index-hero(?:-mobile(?:-crop)?)?\.(?:avif|webp)(?:\?[^"\']*)?["\'])'
            r'[^>]*>\s*',
            "",
            inner,
            flags=re.I | re.S,
        )
        image_pattern = re.compile(
            r'<img\b(?=[^>]*\bclass=["\'][^"\']*\bhome-hero-image\b[^"\']*["\'])[^>]*>',
            flags=re.I | re.S,
        )
        image_match = image_pattern.search(inner)
        if not image_match:
            return False
        inner = inner[:image_match.start()] + source_markup + image_match.group(0) + inner[image_match.end():]
        opening_end = picture_match.group(0).find(">") + 1
        updated_picture = picture_match.group(0)[:opening_end] + inner + "</picture>"
        raw = raw[:picture_match.start()] + updated_picture + raw[picture_match.end():]
    else:
        image_pattern = re.compile(
            r'<img\b(?=[^>]*\bclass=["\'][^"\']*\bhome-hero-image\b[^"\']*["\'])[^>]*>',
            flags=re.I | re.S,
        )
        image_match = image_pattern.search(raw)
        if not image_match:
            return False
        replacement = '<picture class="home-hero-picture">\n' + source_markup + image_match.group(0) + '\n</picture>'
        raw = raw[:image_match.start()] + replacement + raw[image_match.end():]

    if raw != original:
        page.write_text(raw, encoding="utf-8", newline="")
        return True
    return False


def sync_home_hero_preload(page: Path, mobile_avif_path: str | None) -> bool:
    """Preload only the AVIF selected by the mobile homepage picture."""
    if not page.is_file() or not mobile_avif_path:
        return False

    raw = page.read_text(encoding="utf-8")
    original = raw
    old_preloads = re.compile(
        r'<link\b'
        r'(?=[^>]*\brel=["\']preload["\'])'
        r'(?=[^>]*\bas=["\']image["\'])'
        r'(?=[^>]*\bhref=["\'][^"\']*/assets/images/hero/index-hero(?:-mobile(?:-crop)?)?\.(?:avif|webp)(?:\?[^"\']*)?["\'])'
        r'[^>]*>\s*',
        flags=re.I | re.S,
    )
    raw = old_preloads.sub("", raw)
    preload = (
        f'<link rel="preload" as="image" href="/{mobile_avif_path}" '
        'type="image/avif" media="(max-width: 768px)" fetchpriority="high">'
    )
    updated, count = re.subn(
        r'(<head\b[^>]*>)',
        lambda match: match.group(1) + "\n    " + preload + "\n",
        raw,
        count=1,
        flags=re.I,
    )
    if count and updated != original:
        page.write_text(updated, encoding="utf-8", newline="")
        return True
    return False


def sync_responsive_hero_assets(mobile_variants: dict[str, str]) -> int:
    """Wire AVIF/WebP art direction for the homepage and retain listing hero behavior."""
    changed = 0

    index_avif = mobile_variants.get("index-hero-mobile-crop-avif")
    index_webp = mobile_variants.get("index-hero-mobile-crop-webp")
    for relative in ("index.html", "en/index.html", "hi/index.html", "bn/index.html"):
        page = ROOT / relative
        changed += sync_home_hero_picture(page, index_avif, index_webp)
        changed += sync_home_hero_preload(page, index_avif)

    product_mobile = mobile_variants.get("product-hero-mobile")
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
            r"\n*/\* Generated responsive mobile product-hero source\. \*/[\s\S]*$",
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
        elif "/images/brands/" in relative:
            max_dimensions = MAX_DIMENSIONS["brands"]
        elif "/images/about/" in relative:
            max_dimensions = MAX_DIMENSIONS["about"]
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
    versioned = version_image_references(mapping)
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
