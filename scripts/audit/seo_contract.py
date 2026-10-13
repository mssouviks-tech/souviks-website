#!/usr/bin/env python3
"""Blocking SEO snippet and image-alt contract for generated public pages."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from html import unescape
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = {"en", "hi", "bn"}
BASE = "https://www.souviks.co.in"
JSONLD_RE = re.compile(
    r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.I | re.S,
)


def clean(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", unescape(value)).strip()


def tags(raw: str, pattern: str) -> list[str]:
    return re.findall(pattern, raw, flags=re.I | re.S)


def canonical_values(raw: str) -> list[str]:
    values = []
    for tag in re.findall(r"<link\\b[^>]*>", raw, flags=re.I):
        rel = re.search(r'\\brel=["\\']([^"\\']+)["\\']', tag, flags=re.I)
        href = re.search(r'\\bhref=["\\']([^"\\']*)["\\']', tag, flags=re.I)
        if rel and "canonical" in rel.group(1).casefold().split():
            values.append(href.group(1).strip() if href else "")
    return values


def expected_canonical(path: Path) -> str:
    relative = path.relative_to(ROOT).as_posix()
    if relative == "index.html" or relative == "en/index.html":
        return BASE + "/"
    if relative in {"hi/index.html", "bn/index.html"}:
        return BASE + "/" + relative.split("/", 1)[0] + "/"
    parts = Path(relative).parts
    if len(parts) == 3 and parts[0] in LANGUAGES:
        return BASE + "/" + parts[0] + "/" + parts[1] + "/" + Path(parts[2]).stem
    if len(parts) == 2 and parts[0] in LANGUAGES:
        return BASE + "/" + parts[0] + "/" + Path(parts[1]).stem
    return ""


def meta_values(raw: str, name: str) -> list[str]:
    found = []
    for tag in re.findall(r"<meta\b[^>]*>", raw, flags=re.I):
        key = re.search(r'\bname=["\']([^"\']+)["\']', tag, flags=re.I)
        if key and key.group(1).strip().casefold() == name.casefold():
            value = re.search(r'\bcontent=["\']([^"\']*)["\']', tag, flags=re.I)
            found.append(clean(value.group(1)) if value else "")
    return found


def is_public_indexable(path: Path, raw: str) -> bool:
    if any(part in {".git", "node_modules"} for part in path.parts):
        return False
    if path.name == "404.html":
        return False
    parts = path.relative_to(ROOT).parts
    if parts and parts[0] not in LANGUAGES and path.parent == ROOT:
        # Root-level utility pages are not generated SEO pages.
        return path.name == "index.html"
    robots = meta_values(raw, "robots")
    return not any("noindex" in value.casefold() for value in robots)


def image_src(tag: str) -> str:
    match = re.search(r'\bsrc=["\']([^"\']+)["\']', tag, flags=re.I)
    return match.group(1).strip() if match else ""


def image_alt(tag: str) -> tuple[bool, str]:
    match = re.search(r'\balt=["\']([^"\']*)["\']', tag, flags=re.I)
    return (match is not None, clean(match.group(1)) if match else "")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    seen_titles: dict[str, list[str]] = defaultdict(list)
    scanned = 0
    image_count = 0
    product_schema_count = 0

    html_files = sorted(
        path for path in ROOT.rglob("*.html")
        if not any(part in {".git", "node_modules"} for part in path.parts)
        and path.name != "404.html"
    )

    for path in html_files:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        if not is_public_indexable(path, raw):
            continue
        scanned += 1
        label = path.relative_to(ROOT).as_posix()

        title_values = tags(raw, r"<title\b[^>]*>(.*?)</title>")
        if len(title_values) != 1 or not clean(title_values[0]):
            errors.append(f"{label}: expected exactly one non-empty title, found {len(title_values)}")
        else:
            title = clean(title_values[0])
            seen_titles[title.casefold()].append(label)
            if len(title) < 15 or len(title) > 70:
                warnings.append(f"{label}: title length {len(title)} is outside the 15-70 character review range")

        descriptions = meta_values(raw, "description")
        if len(descriptions) != 1 or not descriptions[0]:
            errors.append(f"{label}: expected exactly one non-empty meta description, found {len(descriptions)}")
        elif len(descriptions[0]) < 50 or len(descriptions[0]) > 170:
            warnings.append(
                f"{label}: meta description length {len(descriptions[0])} is outside the 50-170 character review range"
            )

        if not re.search(r"<h1\b[^>]*>\s*[\s\S]*?\S[\s\S]*?</h1>", raw, flags=re.I):
            errors.append(f"{label}: missing non-empty H1 heading")

        # Important product/brand/vehicle images must have meaningful alt text.
        for tag in re.findall(r"<img\b[^>]*>", raw, flags=re.I | re.S):
            src = image_src(tag)
            parsed = urlparse(src)
            image_path = parsed.path.casefold()
            is_seo_image = (
                "/assets/images/products/" in image_path
                or "/assets/images/brands/" in image_path
                or "/assets/images/vehicles/" in image_path
                or "pdpMainImage".casefold() in tag.casefold()
                or "product-image-file" in tag.casefold()
            )
            if not is_seo_image:
                continue
            image_count += 1
            has_alt, alt = image_alt(tag)
            if not has_alt or not alt:
                errors.append(f"{label}: SEO image is missing useful alt text ({src or '<missing src>'})")
            if "/assets/images/placeholder.webp" in image_path or "placeholder." in image_path:
                errors.append(f"{label}: indexable page references a placeholder as an SEO image ({src})")

        # Social previews and Product JSON-LD must never promote placeholders.
        for key in ("og:image", "twitter:image"):
            values = []
            for tag in re.findall(r"<meta\b[^>]*>", raw, flags=re.I):
                selector = re.search(r'\b(?:property|name)=["\']([^"\']+)["\']', tag, flags=re.I)
                value = re.search(r'\bcontent=["\']([^"\']*)["\']', tag, flags=re.I)
                if selector and selector.group(1).casefold() == key and value:
                    values.append(value.group(1).strip())
            if len(values) > 1:
                errors.append(f"{label}: duplicate {key} metadata ({len(values)} tags)")
            if any("placeholder" in value.casefold() for value in values):
                errors.append(f"{label}: {key} must not reference a placeholder image")

        for block in JSONLD_RE.findall(raw):
            try:
                data = json.loads(block.strip())
            except json.JSONDecodeError:
                # The dedicated structured_data audit reports JSON syntax errors.
                continue
            nodes = data.get("@graph", []) if isinstance(data, dict) else []
            if not isinstance(nodes, list):
                nodes = []
            if isinstance(data, dict) and data.get("@type"):
                nodes.append(data)
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                types = node.get("@type", [])
                if types == "Product" or isinstance(types, list) and "Product" in types:
                    product_schema_count += 1
                    schema_images = node.get("image", [])
                    if isinstance(schema_images, str):
                        schema_images = [schema_images]
                    if any("placeholder" in str(value).casefold() for value in schema_images):
                        errors.append(f"{label}: Product JSON-LD references a placeholder image")

    for title, paths in seen_titles.items():
        if len(paths) > 1:
            warnings.append(f"duplicate page title ({len(paths)} pages): {', '.join(paths[:5])}")

    print(
        f"SEO contract scanned {scanned} indexable HTML pages, "
        f"{image_count} SEO image elements, and {product_schema_count} Product schema nodes."
    )
    if warnings:
        print(f"SEO review warnings: {len(warnings)}")
        for warning in warnings[:100]:
            print(f"[WARN] {warning}")
        if len(warnings) > 100:
            print(f"... and {len(warnings) - 100} additional warnings")
    if errors:
        print(f"SEO contract FAILED: {len(errors)} issue(s)")
        for error in errors[:300]:
            print(f"[FAIL] {error}")
        if len(errors) > 300:
            print(f"... and {len(errors) - 300} additional errors")
        return 1
    print("SEO snippet, heading, image-alt and placeholder-image contract passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
