#!/usr/bin/env python3
"""Generate smaller WebP variants for shared decorative/site images.

Product catalogue imagery is intentionally excluded: product image files and
their native pixel dimensions are never modified or upscaled by this script.
"""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SKIP_DIRS = {".git", "node_modules", ".venv", "__pycache__", ".pytest_cache"}
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".webmanifest", ".txt"}
PHOTO_QUALITY = 82
GRAPHIC_QUALITY = 88
LOGO_QUALITY = 92
MAX_DIMENSIONS = {
    "hero": (1920, 1920),
    "categories": (512, 512),
    "support": (256, 256),
    "logo": (512, 512),
}


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
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        if target.stat().st_size < source.stat().st_size * 0.95:
            return target
        target.unlink()

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


def rewrite_references(mapping: dict[str, str]) -> int:
    changed = 0
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        relative_parts = path.relative_to(ROOT).parts
        if any(part in SKIP_DIRS for part in relative_parts):
            continue
        if relative_parts[0] in {"scripts", "docs"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        original = text
        for old, new in mapping.items():
            text = text.replace(old, new)
        # Keep image preloads' MIME type consistent with their WebP URL.
        text = re.sub(
            r'(<link\b[^>]*href=["\'][^"\']+\.webp["\'][^>]*type=["\'])image/(?:png|jpe?g)(["\'])',
            r'\1image/webp\2',
            text,
            flags=re.IGNORECASE,
        )
        # The about-page support illustration was incorrectly declared at
        # source resolution even though it is displayed as a small UI graphic.
        text = re.sub(
            r'(<img\b(?=[^>]*src=["\'][^"\']*/assets/icons/support\.webp["\'])[^>]*?)width=["\']1254["\']',
            r'\1width="256"', text, flags=re.IGNORECASE | re.DOTALL,
        )
        text = re.sub(
            r'(<img\b(?=[^>]*src=["\'][^"\']*/assets/icons/support\.webp["\'])[^>]*?)height=["\']1254["\']',
            r'\1height="256"', text, flags=re.IGNORECASE | re.DOTALL,
        )
        if text != original:
            path.write_text(text, encoding="utf-8", newline="")
            changed += 1
    return changed


def main() -> None:
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
        if target is None:
            print(f"[IMAGE] Keeping source format (WebP savings below 5%): {relative}")
            continue
        relative_source = source.relative_to(ROOT).as_posix()
        relative_target = target.relative_to(ROOT).as_posix()
        mapping[relative_source] = relative_target
        saved = original_size - target.stat().st_size
        saved_bytes += saved
        converted += 1
        print(
            f"[IMAGE] {relative_source}: {original_size:,} -> {target.stat().st_size:,} bytes "
            f"({saved / original_size:.1%} smaller; no upscaling)"
        )

    changed_files = rewrite_references(mapping)
    print(
        f"[IMAGE] Optimised {converted} shared images; saved {saved_bytes:,} bytes; "
        f"updated references in {changed_files} text files. Product images were not touched or resized."
    )


if __name__ == "__main__":
    main()
