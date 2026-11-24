#!/usr/bin/env python3
"""Regression checks for generated vehicle-detail layout and content order."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from enrich_entities import build_entity_link_indexes, linked_entity_card  # noqa: E402

LANGUAGES = ("en", "hi", "bn")
PRODUCT_LABELS = {"en": "Products", "hi": "उत्पाद", "bn": "পণ্য"}


def fail(message: str) -> None:
    raise SystemExit(f"VEHICLE PAGE LAYOUT ERROR: {message}")


def validate_cross_entity_link_helpers() -> None:
    brands = [
        {"id": "acme", "slug": "acme", "name": "ACME", "active": True},
        {"id": "inactive", "slug": "inactive", "name": "Inactive", "active": False},
        {"id": "same-a", "slug": "same-a", "name": "Shared Name", "active": True},
        {"id": "same-b", "slug": "same-b", "name": "Shared Name", "active": True},
    ]
    categories = [
        {"id": "filters", "slug": "filters", "name": "Filters", "active": True},
        {"id": "inactive-category", "slug": "inactive-category", "name": "Hidden", "active": False},
    ]
    vehicles = [
        {"id": "tata-signa", "slug": "tata-signa", "model": "Tata Signa", "active": True},
        {"id": "rare-model", "slug": "rare-model", "model": "Rare Model", "active": True},
    ]
    catalogue = (
        [{"active": True, "vehicles": ["Tata Signa"]} for _ in range(6)]
        + [{"active": True, "vehicles": ["Rare Model"]} for _ in range(5)]
    )
    indexes = build_entity_link_indexes(brands, categories, vehicles, catalogue)

    category_html = linked_entity_card(
        "Categories",
        [
            {"id": "filters", "name": "Filters"},
            {"id": "unknown", "name": "Unmapped category"},
            {"id": "wrong-id", "name": "Filters"},
            {"id": "filters", "name": "Filters"},
            {"id": "inactive-category", "name": "Hidden"},
        ],
        "category",
        "en",
        indexes,
    )
    if category_html.count('href="/en/categories/filters"') != 1:
        fail("category context must link each verified category once")
    if "wrong-id" in category_html and 'href="/en/categories/filters"' in category_html.split("wrong-id", 1)[-1]:
        fail("an explicit invalid entity ID must not fall back to a different record by label")
    if "Unmapped category" not in category_html or "href=\"/en/categories/unknown\"" in category_html:
        fail("unresolved category labels must remain text, not guessed links")
    if "href=\"/en/categories/inactive-category\"" in category_html or ">Hidden</a>" in category_html:
        fail("inactive category records must not become link destinations")

    brand_html = linked_entity_card(
        "Brands",
        [{"id": "acme", "name": "ACME"}, "Shared Name"],
        "brand",
        "hi",
        indexes,
    )
    if 'href="/hi/brands/acme"' not in brand_html:
        fail("verified brand identity must use the requested locale route")
    if "href=\"/hi/brands/same-a\"" in brand_html or "href=\"/hi/brands/same-b\"" in brand_html:
        fail("ambiguous label-only brand references must not generate links")

    vehicle_html = linked_entity_card(
        "Vehicle applications",
        ["Tata Signa", "Rare Model", "Unknown Model"],
        "vehicle",
        "bn",
        indexes,
    )
    if 'href="/bn/vehicles/tata-signa"' not in vehicle_html:
        fail("verified vehicle labels must link to the localized vehicle page")
    if "href=\"/bn/vehicles/rare-model\"" in vehicle_html:
        fail("noindex vehicle pages with five or fewer products must not be linked")
    if "Unknown Model" not in vehicle_html or "href=\"/bn/vehicles/Unknown-Model\"" in vehicle_html:
        fail("unresolved vehicle labels must remain plain text")


def validate_generated_vehicle_entity_links() -> None:
    brands = json.loads((ROOT / "assets/data/brands.json").read_text(encoding="utf-8"))
    categories = json.loads((ROOT / "assets/data/categories.json").read_text(encoding="utf-8"))
    vehicles = json.loads((ROOT / "assets/data/vehicles.json").read_text(encoding="utf-8"))
    products = json.loads((ROOT / "assets/data/products.json").read_text(encoding="utf-8"))
    build_entity_link_indexes(brands, categories, vehicles, products)
    category_by_id = {
        str(item.get("id") or "").strip(): item
        for item in categories
        if item.get("active") is not False
    }
    brand_by_id = {
        str(item.get("id") or "").strip(): item
        for item in brands
        if item.get("active") is not False
    }

    noindex_vehicle_slugs = {
        str(item.get("slug") or "").strip()
        for item in vehicles
        if item.get("active") is not False
        and str(item.get("slug") or "").strip()
        and str(item.get("product_count") or 0).isdigit()
        and int(item.get("product_count") or 0) <= 5
    }

    checked = 0
    for language in LANGUAGES:
        directory = ROOT / language / "vehicles"
        for path in sorted(directory.glob("*.html")):
            item = next((row for row in vehicles if str(row.get("slug") or "") == path.stem), None)
            if item is None:
                fail(f"{path.relative_to(ROOT)} does not map to vehicles.json")
            page = path.read_text(encoding="utf-8")
            marker_at = page.find("<!-- ENTITY_CONTEXT_VEHICLE -->")
            section_at = page.find('<section class="entity-context section-spacing">', marker_at)
            section_end = page.find("</section>", section_at) if section_at >= 0 else -1
            if section_at < 0 or section_end < 0:
                fail(f"{path.relative_to(ROOT)} is missing its vehicle context section")
            context = page[section_at:section_end]

            for relationship, target_index, route in (
                ("categories", category_by_id, "categories"),
                ("brands", brand_by_id, "brands"),
            ):
                for value in item.get(relationship) or []:
                    identity = str(value.get("id") or "").strip() if isinstance(value, dict) else str(value).strip()
                    target = target_index.get(identity)
                    if target is None:
                        continue
                    slug = str(target.get("slug") or "").strip()
                    if slug and f'href="/{language}/{route}/{slug}"' not in context:
                        fail(
                            f"{path.relative_to(ROOT)} is missing its verified "
                            f"{relationship[:-1]} link to {slug}"
                        )

        # Indexable vehicle destinations are linked by exact model/name from brand
        # and category pages. A noindex vehicle detail page must never be a target.
        vehicle_by_label = {}
        for item in vehicles:
            if item.get("active") is False:
                continue
            model = str(item.get("model") or item.get("name") or "").strip()
            if model:
                vehicle_by_label.setdefault(model.casefold(), []).append(item)
        vehicle_by_label = {
            label: matches[0]
            for label, matches in vehicle_by_label.items()
            if len(matches) == 1
        }

        for route, records, relation_field in (
            ("brands", brands, "vehicles"),
            ("categories", categories, "vehicles"),
        ):
            for record in records:
                if record.get("active") is False:
                    continue
                path = ROOT / language / route / f'{record.get("slug")}.html'
                if not path.is_file():
                    continue
                page = path.read_text(encoding="utf-8")
                marker_at = page.find(f"<!-- ENTITY_CONTEXT_{route[:-1].upper()} -->")
                section_at = page.find('<section class="entity-context section-spacing">', marker_at)
                section_end = page.find("</section>", section_at) if section_at >= 0 else -1
                context = page[section_at:section_end] if section_at >= 0 and section_end >= 0 else page

                for label in record.get(relation_field) or []:
                    target = vehicle_by_label.get(str(label).strip().casefold())
                    if target is None:
                        continue
                    target_slug = str(target.get("slug") or "").strip()
                    target_count = int(target.get("product_count") or 0)
                    if target_slug and target_count > 5 and f'href="/{language}/vehicles/{target_slug}"' not in context:
                        fail(
                            f"{path.relative_to(ROOT)} is missing indexable vehicle link {target_slug}"
                        )

                for slug in noindex_vehicle_slugs:
                    if f'href="/{language}/vehicles/{slug}"' in page:
                        fail(
                            f"{path.relative_to(ROOT)} links to noindex vehicle page {slug}"
                        )
        checked += 1

    if checked != len(LANGUAGES):
        fail("not all supported languages were checked")


def main() -> None:
    validate_cross_entity_link_helpers()
    validate_generated_vehicle_entity_links()
    vehicles_path = ROOT / "assets/data/vehicles.json"
    vehicles = json.loads(vehicles_path.read_text(encoding="utf-8"))
    by_slug = {str(item.get("slug") or "").strip(): item for item in vehicles}

    css = (ROOT / "assets/css/bundles/vehicle.css").read_text(encoding="utf-8")
    gallery_rule = re.search(
        r"body\.page-vehicle\s+#product-grid\.products-grid\s*\{([^}]*)\}",
        css,
        flags=re.I | re.S,
    )
    if not gallery_rule:
        fail("shared vehicle gallery layout override is missing from vehicle.css")
    if not re.search(r"display\s*:\s*flex\s*;", gallery_rule.group(1), flags=re.I):
        fail("vehicle gallery wrapper must use flex layout")
    if not re.search(r"flex-direction\s*:\s*column\s*;", gallery_rule.group(1), flags=re.I):
        fail("vehicle category galleries must stack vertically")

    checked = 0
    for language in LANGUAGES:
        directory = ROOT / language / "vehicles"
        for path in sorted(directory.glob("*.html")):
            page = path.read_text(encoding="utf-8")
            marker = "<!-- ENTITY_CONTEXT_VEHICLE -->"
            if page.count(marker) != 1:
                fail(f"{path.relative_to(ROOT)} must contain exactly one vehicle context marker")

            marker_at = page.find(marker)
            section_at = page.find('<section class="entity-context section-spacing">', marker_at)
            section_end = page.find("</section>", section_at) if section_at >= 0 else -1
            main_open = re.search(r"<main\b", page, flags=re.I)
            main_close = re.search(r"</main\s*>", page, flags=re.I)
            footer = re.search(r"<footer\b", page, flags=re.I)

            if not (main_open and main_close and footer):
                fail(f"{path.relative_to(ROOT)} is missing main/footer landmarks")
            if not (
                main_open.start() < marker_at < section_at < section_end < main_close.start() < footer.start()
            ):
                fail(
                    f"{path.relative_to(ROOT)} must place vehicle context inside main, "
                    "after compatible products and before the footer"
                )

            hero_count = re.search(
                r'<div class=["\']vehicle-info["\'][\s\S]*?<div>\s*Products:\s*(\d+)\s*</div>',
                page,
                flags=re.I,
            )
            if not hero_count:
                fail(f"{path.relative_to(ROOT)} has no readable vehicle product count")

            context = page[section_at:section_end]
            label = re.escape(PRODUCT_LABELS[language])
            context_count = re.search(
                rf'<div class="entity-context-card"><span>{label}</span><strong>(\d+)</strong></div>',
                context,
            )
            if not context_count:
                fail(f"{path.relative_to(ROOT)} has no product count in its context cards")

            expected = by_slug.get(path.stem, {}).get("product_count")
            counts = (int(hero_count.group(1)), int(context_count.group(1)))
            if counts[0] != counts[1]:
                fail(
                    f"{path.relative_to(ROOT)} shows inconsistent hero/context counts: "
                    f"{counts[0]} vs {counts[1]}"
                )
            if expected is not None and counts[0] != int(expected):
                fail(
                    f"{path.relative_to(ROOT)} shows {counts[0]} products but vehicles.json "
                    f"declares {expected}"
                )
            checked += 1

    if checked == 0:
        fail("no generated vehicle detail pages were found")
    print(f"Vehicle page layout checks passed for {checked} pages across {len(LANGUAGES)} languages.")


if __name__ == "__main__":
    main()
