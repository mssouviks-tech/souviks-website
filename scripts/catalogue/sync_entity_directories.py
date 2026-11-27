#!/usr/bin/env python3
"""Synchronize static brand and vehicle directory cards and catalogue counters."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "assets" / "data"
LANGUAGES = ("en", "hi", "bn")
COUNT_LABELS = {
    "en": "Products",
    "hi": "उत्पाद",
    "bn": "পণ্যসমূহ",
}


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def clean(value: Any) -> str:
    return str(value or "").strip()


def active_records(records: list[dict]) -> list[dict]:
    return [
        item for item in records
        if isinstance(item, dict)
        and item.get("active") is not False
        and clean(item.get("id"))
        and clean(item.get("slug"))
    ]


def div_end(source: str, opening: re.Match) -> int:
    """Return the end offset of the div opened by opening."""
    depth = 1
    tag_pattern = re.compile(r"</?div\b[^>]*>", re.I)
    for tag in tag_pattern.finditer(source, opening.end()):
        token = tag.group(0)
        if re.match(r"</div\b", token, re.I):
            depth -= 1
            if depth == 0:
                return tag.end()
        elif not re.search(r"/\s*>$", token):
            depth += 1
    raise ValueError("Unclosed div while updating a static directory.")


def replace_div_contents(source: str, element_id: str, contents: str) -> str:
    pattern = re.compile(
        r"<div\b(?=[^>]*\bid=[\"']" + re.escape(element_id) + r"[\"'])[^>]*>",
        re.I,
    )
    opening = pattern.search(source)
    if not opening:
        raise ValueError(f"Missing static directory container #{element_id}.")
    end = div_end(source, opening)
    close = source.rfind("</div>", opening.end(), end)
    if close < 0:
        raise ValueError(f"Could not locate closing tag for #{element_id}.")
    return source[:opening.end()] + "\n\n" + contents + "\n\n" + source[close:]


def replace_numeric_id(source: str, element_id: str, value: int, *, required: bool = True) -> str:
    pattern = re.compile(
        r"(<(?P<tag>span|div|strong)\b(?=[^>]*\bid=[\"']"
        + re.escape(element_id)
        + r"[\"'])[^>]*>\s*)\d[\d,]*(\s*</(?P=tag)\s*>)",
        re.I,
    )
    updated, count = pattern.subn(
        lambda match: match.group(1) + str(value) + match.group(3),
        source,
        count=1,
    )
    if required and count != 1:
        raise ValueError(f"Expected exactly one numeric #{element_id} counter.")
    return updated


def update_hero_stat(source: str, icon_name: str, value: int, *, required: bool = True) -> str:
    openings = re.compile(
        r"<div\b[^>]*class=[\"'][^\"']*\bhero-stat\b[^\"']*[\"'][^>]*>",
        re.I,
    )
    number = re.compile(
        r"(<(?:span|div)\b(?=[^>]*\bclass=[\"'][^\"']*\bstat-number\b)[^>]*>\s*)"
        r"\d[\d,]*"
        r"(\s*</(?:span|div)\s*>)",
        re.I,
    )
    for opening in openings.finditer(source):
        end = div_end(source, opening)
        block = source[opening.start():end]
        icon = re.search(
            r"<img\b(?=[^>]*\bsrc=[\"'][^\"']*/"
            + re.escape(icon_name)
            + r"(?:[?#][^\"']*)?[\"'])[^>]*>",
            block,
            re.I,
        )
        if not icon:
            continue
        updated, count = number.subn(
            lambda match: match.group(1) + str(value) + match.group(2),
            block,
            count=1,
        )
        if count != 1:
            raise ValueError(f"Hero statistic for {icon_name} has no numeric value.")
        return source[:opening.start()] + updated + source[end:]
    if required:
        raise ValueError(f"Could not find hero statistic for {icon_name}.")
    return source


def update_home_trust_stat(source: str, icon_name: str, value: int, language: str) -> str:
    openings = re.compile(
        r"<div\b[^>]*class=[\"'][^\"']*\bhome-trust-item\b[^\"']*[\"'][^>]*>",
        re.I,
    )
    for opening in openings.finditer(source):
        end = div_end(source, opening)
        block = source[opening.start():end]
        if not re.search(
            r"<img\b(?=[^>]*\bsrc=[\"'][^\"']*/"
            + re.escape(icon_name)
            + r"(?:[?#][^\"']*)?[\"'])[^>]*>",
            block,
            re.I,
        ):
            continue
        updated, count = re.subn(
            r"(<strong\b[^>]*>)[^<]*(</strong>)",
            lambda match: match.group(1) + f"{value}+" + match.group(2),
            block,
            count=1,
            flags=re.I,
        )
        if count != 1:
            raise ValueError(f"Homepage trust statistic for {icon_name} is malformed.")
        return source[:opening.start()] + updated + source[end:]
    raise ValueError(f"Homepage is missing the {icon_name} trust statistic ({language}).")


def brand_card(brand: dict, language: str) -> str:
    name = clean(brand.get("name"))
    slug = clean(brand.get("slug"))
    logo = clean(brand.get("logo"))
    count = int(brand.get("product_count") or len(brand.get("products") or []))
    if logo:
        media = (
            f'<img src="{html.escape(logo, quote=True)}" '
            f'alt="{html.escape(name, quote=True)}" loading="lazy" decoding="async" '
            'width="400" height="400">'
        )
    else:
        # Do not invent a logo for a brand that has not supplied one.
        media = (
            '<span class="brand-logo-fallback" '
            f'aria-label="{html.escape(name, quote=True)}" '
            'style="font-weight:700;font-size:18px;text-align:center;overflow-wrap:anywhere">'
            f'{html.escape(name)}</span>'
        )
    return (
        f'<article class="brand-card"><a href="/{language}/brands/{html.escape(slug, quote=True)}" '
        f'data-name="{html.escape(name, quote=True)}">'
        f'<div class="brand-image">{media}</div>'
        f'<div class="brand-content"><h3 class="brand-name">{html.escape(name)}</h3>'
        f'<div class="brand-count"><span class="count-number">{count}</span> '
        f'{COUNT_LABELS[language]}</div></div></a></article>'
    )


def vehicle_card(vehicle: dict, language: str) -> str:
    name = clean(vehicle.get("model") or vehicle.get("name"))
    slug = clean(vehicle.get("slug"))
    image = clean(vehicle.get("image"))
    count = int(vehicle.get("product_count") or len(vehicle.get("products") or []))
    if image:
        media = (
            f'<img src="{html.escape(image, quote=True)}" '
            f'alt="{html.escape(name, quote=True)}" loading="lazy" decoding="async" '
            'width="400" height="300">'
        )
    else:
        media = (
            '<span class="vehicle-image-fallback" '
            f'aria-label="{html.escape(name, quote=True)}">'
            f'{html.escape(name)}</span>'
        )
    return (
        f'<article class="vehicle-card"><a href="/{language}/vehicles/{html.escape(slug, quote=True)}" '
        f'data-breadcrumb="{html.escape(name, quote=True)}">'
        f'<div class="vehicle-image">{media}</div>'
        f'<div class="vehicle-content"><h3 class="vehicle-title">{html.escape(name)}</h3>'
        f'<div class="vehicle-count">{count} {COUNT_LABELS[language]}</div>'
        '</div></a></article>'
    )


def update_home_brand_cards(source: str, brands_by_slug: dict[str, dict], language: str) -> str:
    pattern = re.compile(
        r"<article\b(?=[^>]*\bclass=[\"'][^\"']*\bbrand-card\b[^\"']*[\"'])[^>]*>.*?</article>",
        re.I | re.S,
    )

    def update(match: re.Match) -> str:
        card = match.group(0)
        href = re.search(
            r"\bhref=[\"']/" + re.escape(language) + r"/brands/([^\"'/?#]+)",
            card,
            re.I,
        )
        if not href:
            return card
        brand = brands_by_slug.get(href.group(1))
        if not brand:
            return card
        count = int(brand.get("product_count") or len(brand.get("products") or []))
        updated, replacements = re.subn(
            r"(<span\b[^>]*class=[\"'][^\"']*\bcount-number\b[^\"']*[\"'][^>]*>)[\s\S]*?(</span>)",
            lambda item: item.group(1) + str(count) + item.group(2),
            card,
            count=1,
            flags=re.I,
        )
        return updated if replacements == 1 else card

    return pattern.sub(update, source)


def update_featured_vehicle_cards(source: str, vehicles_by_id: dict[str, dict], language: str) -> str:
    pattern = re.compile(
        r"<a\b(?=[^>]*\bclass=[\"'][^\"']*\bpopular-vehicle-card\b[^\"']*[\"'])[^>]*>.*?</a>",
        re.I | re.S,
    )

    def update(match: re.Match) -> str:
        card = match.group(0)
        vehicle_id = re.search(r"\bdata-vehicle-id=[\"']([^\"']+)", card, re.I)
        if not vehicle_id:
            return card
        vehicle = vehicles_by_id.get(vehicle_id.group(1))
        if not vehicle:
            return card
        count = int(vehicle.get("product_count") or len(vehicle.get("products") or []))
        updated, replacements = re.subn(
            r"(<div\b[^>]*class=[\"'][^\"']*\bpopular-vehicle-count\b[^\"']*[\"'][^>]*>)[\s\S]*?(</div>)",
            lambda item: item.group(1) + f"{count} {COUNT_LABELS[language]}" + item.group(2),
            card,
            count=1,
            flags=re.I,
        )
        return updated if replacements == 1 else card

    return pattern.sub(update, source)


def update_last_updated(source: str, display_date: str, page_name: str) -> str:
    pattern = re.compile(
        r"(<div\b(?=[^>]*\bclass=[\"'][^\"']*\bcatalogue-last-updated\b[^\"']*[\"'])[^>]*>"
        r"[\s\S]*?<strong\b[^>]*>)[\s\S]*?(</strong>)",
        re.I,
    )
    updated, count = pattern.subn(
        lambda match: match.group(1) + display_date + match.group(2),
        source,
        count=1,
    )
    if count != 1:
        raise ValueError(f"{page_name}: missing catalogue last-updated marker.")
    return updated


def write_if_changed(path: Path, source: str) -> bool:
    old = path.read_text(encoding="utf-8")
    if old == source:
        return False
    path.write_text(source, encoding="utf-8", newline="\n")
    return True


def main() -> None:
    catalogue = read_json(DATA / "catalogue-index.json")
    brands = read_json(DATA / "brands.json")
    categories = read_json(DATA / "categories.json")
    vehicles = read_json(DATA / "vehicles.json")

    products = [
        item for item in catalogue
        if isinstance(item, dict) and clean(item.get("id")) and item.get("active") is not False
    ]
    active_brands = active_records(brands)
    active_categories = active_records(categories)
    active_vehicles = active_records(vehicles)
    active_product_count = len(products)
    brand_count = len(active_brands)
    category_count = len(active_categories)
    vehicle_count = len(active_vehicles)
    subcategory_count = len({
        clean(item.get("subcategory_id"))
        for item in products
        if clean(item.get("subcategory_id"))
    })
    if not all((active_product_count, brand_count, category_count, vehicle_count)):
        raise ValueError("Refusing to synchronize empty catalogue or entity counts.")

    brands_by_slug = {clean(item.get("slug")): item for item in active_brands}
    vehicles_by_id = {clean(item.get("id")): item for item in active_vehicles}
    display_date = datetime.now(timezone.utc).strftime("%d %B %Y")
    changed_files = 0

    for language in LANGUAGES:
        brand_path = ROOT / language / "brands.html"
        brand_html = brand_path.read_text(encoding="utf-8")
        cards = "".join(brand_card(item, language) for item in active_brands)
        brand_html = replace_div_contents(brand_html, "brand-grid", cards)
        brand_html = replace_numeric_id(brand_html, "visibleBrands", brand_count)
        brand_html = replace_numeric_id(brand_html, "totalBrands", brand_count)
        brand_html = update_hero_stat(brand_html, "brands.svg", brand_count)
        brand_html = update_hero_stat(brand_html, "products.svg", active_product_count)
        brand_html = update_hero_stat(brand_html, "category.svg", category_count, required=False)
        brand_html = update_last_updated(brand_html, display_date, f"{language}/brands.html")
        changed_files += int(write_if_changed(brand_path, brand_html))

        vehicle_path = ROOT / language / "vehicles.html"
        vehicle_html = vehicle_path.read_text(encoding="utf-8")
        vehicle_cards = "".join(vehicle_card(item, language) for item in active_vehicles)
        vehicle_html = replace_div_contents(vehicle_html, "vehicle-grid", vehicle_cards)
        vehicle_html = replace_numeric_id(vehicle_html, "visibleVehicles", vehicle_count)
        vehicle_html = update_hero_stat(vehicle_html, "vehicle.svg", vehicle_count)
        vehicle_html = update_hero_stat(vehicle_html, "products.svg", active_product_count)
        vehicle_html = update_hero_stat(vehicle_html, "brands.svg", brand_count)
        vehicle_html = update_featured_vehicle_cards(vehicle_html, vehicles_by_id, language)
        vehicle_html = update_last_updated(vehicle_html, display_date, f"{language}/vehicles.html")
        changed_files += int(write_if_changed(vehicle_path, vehicle_html))

        products_path = ROOT / language / "products.html"
        products_html = products_path.read_text(encoding="utf-8")
        products_html = replace_numeric_id(products_html, "totalProducts", active_product_count)
        products_html = replace_numeric_id(products_html, "totalResults", active_product_count)
        products_html = update_hero_stat(products_html, "products.svg", active_product_count)
        products_html = update_hero_stat(products_html, "brands.svg", brand_count)
        products_html = update_hero_stat(products_html, "category.svg", category_count)
        products_html = update_hero_stat(products_html, "vehicle.svg", vehicle_count)
        products_html = update_last_updated(products_html, display_date, f"{language}/products.html")
        changed_files += int(write_if_changed(products_path, products_html))

        categories_path = ROOT / language / "categories.html"
        categories_html = categories_path.read_text(encoding="utf-8")
        categories_html = update_hero_stat(categories_html, "category.svg", category_count)
        categories_html = update_hero_stat(categories_html, "subcategories.svg", subcategory_count)
        categories_html = update_hero_stat(categories_html, "products.svg", active_product_count)
        categories_html = update_last_updated(categories_html, display_date, f"{language}/categories.html")
        changed_files += int(write_if_changed(categories_path, categories_html))

        home_path = ROOT / language / "index.html"
        home_html = home_path.read_text(encoding="utf-8")
        home_html = update_home_trust_stat(home_html, "products.svg", active_product_count, language)
        home_html = update_home_trust_stat(home_html, "brands.svg", brand_count, language)
        home_html = update_home_brand_cards(home_html, brands_by_slug, language)
        home_html = update_featured_vehicle_cards(home_html, vehicles_by_id, language)
        changed_files += int(write_if_changed(home_path, home_html))

    print(
        "Static entity directories synchronized: "
        f"{active_product_count} active products, {brand_count} active brands, "
        f"{category_count} categories, {subcategory_count} active subcategories, "
        f"{vehicle_count} vehicle models; {changed_files} localized files updated."
    )


if __name__ == "__main__":
    main()
