#!/usr/bin/env python3
"""Blocking SEO snippet and image-alt contract for generated public pages."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
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
    for tag in re.findall(r"<link\b[^>]*>", raw, flags=re.I):
        rel = re.search(r"""\brel=["']([^"']+)["']""", tag, flags=re.I)
        href = re.search(r"""\bhref=["']([^"']*)["']""", tag, flags=re.I)
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
    if any(part in {".git", "node_modules", ".well-known"} for part in path.parts):
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


def duplicate_title_groups(
    entries: list[tuple[str, str, str, str]],
) -> list[tuple[str, str, list[str]]]:
    """Return real title collisions, scoped to one language and distinct canonicals.

    Entry fields are (language, title, page label, canonical URL). Localized
    equivalents and multiple files resolving to the same canonical URL are not
    duplicate-title problems and should not inflate the SEO review warning count.
    """
    grouped: dict[tuple[str, str], list[tuple[str, str, str]]] = defaultdict(list)
    for language, title, label, canonical in entries:
        grouped[(language, title.casefold())].append((title, label, canonical.rstrip("/")))

    collisions: list[tuple[str, str, list[str]]] = []
    for (language, _), pages in grouped.items():
        canonical_pages: dict[str, str] = {}
        for _, label, canonical in pages:
            if canonical:
                canonical_pages.setdefault(canonical, label)
        if len(canonical_pages) > 1:
            labels = sorted(canonical_pages.values())
            collisions.append((language, pages[0][0], labels))

    return sorted(collisions, key=lambda entry: (entry[0], entry[1].casefold()))


def warning_category(warning: str) -> str:
    """Classify SEO review warnings so the log exposes actionable totals."""
    if warning.startswith("duplicate page title "):
        return "duplicate page title"
    if warning.startswith("duplicate product meta description "):
        return "duplicate product meta description"
    if "meta description length " in warning:
        return "meta description length"
    if "title length " in warning and "review range" in warning:
        return "title length"
    if "product description contains known generic boilerplate" in warning:
        return "boilerplate product description"
    return "other"


def warning_breakdown(warnings: list[str]) -> dict[str, int]:
    """Return stable, sorted counts for the SEO warning categories."""
    return dict(sorted(Counter(warning_category(warning) for warning in warnings).items()))


def duplicate_product_meta_groups(
    entries: list[dict[str, str]],
) -> list[dict[str, object]]:
    """Group repeated product snippets by language and distinct canonical URL.

    The report retains source product identifiers and URLs so reviewers can
    reconcile catalogue records instead of rewriting text to hide data issues.
    """
    grouped: dict[tuple[str, str], dict[str, list[dict[str, str]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    snippets: dict[tuple[str, str], str] = {}
    for entry in entries:
        language = str(entry.get("language") or "en").strip().lower()
        snippet = clean(str(entry.get("snippet") or ""))
        if not snippet:
            continue
        key = (language, snippet.casefold())
        canonical = str(
            entry.get("canonical") or entry.get("path") or entry.get("slug") or ""
        ).strip()
        grouped[key][canonical].append(entry)
        snippets.setdefault(key, snippet)

    collisions: list[dict[str, object]] = []
    for key, canonical_groups in grouped.items():
        # Canonical aliases for one product are one page, not a duplicate.
        if len(canonical_groups) < 2:
            continue
        language, _ = key
        products: list[dict[str, str]] = []
        for canonical, candidates in sorted(canonical_groups.items()):
            entry = sorted(candidates, key=lambda item: item.get("path", ""))[0]
            products.append({
                "product_id": str(entry.get("product_id") or ""),
                "brand": str(entry.get("brand") or ""),
                "part_number": str(entry.get("part_number") or ""),
                "product_name": str(entry.get("product_name") or ""),
                "slug": str(entry.get("slug") or ""),
                "language": language,
                "path": str(entry.get("path") or ""),
                "canonical": canonical,
            })
        collisions.append({
            "language": language,
            "snippet": snippets[key],
            "products": products,
        })
    return sorted(
        collisions,
        key=lambda item: (str(item["language"]), str(item["snippet"]).casefold()),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit SEO snippets and image alt text.")
    parser.add_argument(
        "--report-file",
        type=Path,
        default=None,
        help="Optional path to write the machine-readable SEO review report as JSON.",
    )
    args = parser.parse_args()
    errors: list[str] = []
    warnings: list[str] = []
    seen_title_entries: list[tuple[str, str, str, str]] = []
    product_meta_records: list[dict[str, str]] = []
    weak_product_copy: list[str] = []
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

        canonicals = canonical_values(raw)
        expected_url = expected_canonical(path)
        if len(canonicals) != 1 or not canonicals[0]:
            errors.append(f"{label}: expected exactly one non-empty canonical URL, found {len(canonicals)}")
        elif not canonicals[0].startswith(BASE + "/"):
            errors.append(f"{label}: canonical must use HTTPS on www.souviks.co.in ({canonicals[0]!r})")
        elif expected_url and canonicals[0].rstrip("/") != expected_url.rstrip("/"):
            errors.append(f"{label}: canonical {canonicals[0]!r} != expected route {expected_url!r}")

        title_values = tags(raw, r"<title\b[^>]*>(.*?)</title>")
        if len(title_values) != 1 or not clean(title_values[0]):
            errors.append(f"{label}: expected exactly one non-empty title, found {len(title_values)}")
        else:
            title = clean(title_values[0])
            route_parts_for_title = path.relative_to(ROOT).parts
            language = (
                route_parts_for_title[0]
                if route_parts_for_title and route_parts_for_title[0] in LANGUAGES
                else "en"
            )
            canonical_for_title = (
                canonicals[0].strip()
                if len(canonicals) == 1 and canonicals[0]
                else label
            )
            seen_title_entries.append((language, title, label, canonical_for_title))
            if len(title) < 15 or len(title) > 70:
                warnings.append(f"{label}: title length {len(title)} is outside the 15-70 character review range")

        descriptions = meta_values(raw, "description")
        if len(descriptions) != 1 or not descriptions[0]:
            errors.append(f"{label}: expected exactly one non-empty meta description, found {len(descriptions)}")
        elif len(descriptions[0]) < 50 or len(descriptions[0]) > 170:
            preview = descriptions[0][:100]
            warnings.append(
                f"{label}: meta description length {len(descriptions[0])} is outside the 50-170 character review range; "
                f"preview={preview!r}"
            )

        # Product snippets should be unique across different product routes;
        # language variants of the same slug are treated as one product.
        route_parts = path.relative_to(ROOT).parts
        is_product_page = (
            len(route_parts) >= 3
            and route_parts[0] in LANGUAGES
            and route_parts[1] == "products"
        )
        product_record: dict[str, object] = {}
        if is_product_page:
            # Read the embedded catalogue record once for both the SEO-quality
            # check and the structured duplicate-snippet report.
            product_data = re.search(
                r"window\\.SOUVIKS_PRODUCT_PAGE_DATA\\s*=\\s*(\\{.*?\\});",
                raw,
                flags=re.S,
            )
            if product_data:
                try:
                    parsed_record = json.loads(product_data.group(1))
                    if isinstance(parsed_record, dict):
                        product_record = parsed_record
                except json.JSONDecodeError:
                    product_record = {}

        if is_product_page and descriptions and descriptions[0]:
            language = route_parts[0]
            product_seo = product_record.get("seo", {})
            if not isinstance(product_seo, dict):
                product_seo = {}
            product_meta_records.append({
                "language": language,
                "snippet": clean(descriptions[0]),
                "path": label,
                "slug": str(product_record.get("slug") or path.stem),
                "canonical": str((product_seo.get("canonical") or (canonicals[0] if len(canonicals) == 1 else "")) or label),
                "product_id": str(product_record.get("id") or ""),
                "brand": str(product_record.get("brand_name") or product_record.get("brand") or ""),
                "part_number": str(product_record.get("manufacturer_part_number") or product_record.get("part_number") or product_record.get("partNumber") or ""),
                "product_name": str(product_record.get("product_name") or product_record.get("name") or ""),
            })

            # Generic product-description copy is review-only: sparse source
            # data must remain publishable while the catalogue is improved.
            product_description = clean(str(product_record.get("description") or ""))
            weak_phrases = (
                "supports the mechanical linkage or assembly identified by the product name",
                "allowing its connected parts to",
                "confirm the part number and vehicle application before ordering",
            )
            if any(phrase in product_description.casefold() for phrase in weak_phrases):
                weak_product_copy.append(label)

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

    duplicate_meta_groups = duplicate_product_meta_groups(product_meta_records)
    for group in duplicate_meta_groups:
        products = group["products"]
        slugs = sorted({str(product.get("slug") or "") for product in products})
        warnings.append(
            f"duplicate product meta description (language={group['language']}, "
            f"{len(slugs)} product slugs; {', '.join(slugs[:5])})"
        )

    for path in weak_product_copy[:100]:
        warnings.append(f"{path}: product description contains known generic boilerplate")

    duplicate_titles = duplicate_title_groups(seen_title_entries)
    for language, title, paths in duplicate_titles:
        warnings.append(
            f"duplicate page title ({len(paths)} pages, language={language}, title={title!r}): "
            f"{', '.join(paths[:5])}"
        )

    if args.report_file:
        report = {
            "schema_version": 1,
            "summary": {
                "indexable_html_pages_scanned": scanned,
                "seo_image_elements": image_count,
                "product_schema_nodes": product_schema_count,
                "weak_boilerplate_product_pages": len(weak_product_copy),
                "warning_count": len(warnings),
                "warning_breakdown": warning_breakdown(warnings),
                "blocking_error_count": len(errors),
            },
            "warnings": warnings,
            "duplicate_product_meta_description_groups": duplicate_meta_groups,
            "duplicate_page_titles": [
                {"language": language, "title": title, "paths": paths}
                for language, title, paths in duplicate_titles
            ],
            "weak_boilerplate_product_pages": sorted(set(weak_product_copy)),
            "blocking_errors": errors,
        }
        args.report_file.parent.mkdir(parents=True, exist_ok=True)
        args.report_file.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        print(f"SEO review report written to {args.report_file}")

    print(
        f"SEO contract scanned {scanned} indexable HTML pages, "
        f"{image_count} SEO image elements, and {product_schema_count} Product schema nodes; "
        f"{len(weak_product_copy)} weak-boilerplate product descriptions."
    )
    if warnings:
        print(f"SEO review warnings: {len(warnings)}")
        print(
            "SEO warning breakdown: "
            + json.dumps(warning_breakdown(warnings), ensure_ascii=False, sort_keys=True)
        )
        # SEO warnings are non-blocking review findings, so expose all current
        # rows in the Actions log while the catalogue is in a manageable state.
        # Keep a hard cap as a safeguard against unexpectedly huge audit output.
        report_limit = 500
        for warning in warnings[:report_limit]:
            print(f"[WARN] {warning}")
        if len(warnings) > report_limit:
            print(f"... and {len(warnings) - report_limit} additional warnings")
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
