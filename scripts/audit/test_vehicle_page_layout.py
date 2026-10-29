#!/usr/bin/env python3
"""Regression checks for generated vehicle-detail layout and content order."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
PRODUCT_LABELS = {"en": "Products", "hi": "उत्पाद", "bn": "পণ্য"}


def fail(message: str) -> None:
    raise SystemExit(f"VEHICLE PAGE LAYOUT ERROR: {message}")


def main() -> None:
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
