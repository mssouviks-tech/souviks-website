#!/usr/bin/env python3
"""Create localized static brand pages for active brands whose routes are missing."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from enrich_entities import (  # noqa: E402
    brand_page_title,
    build_entity_link_indexes,
    clean,
    context_section,
    deduplicate_entity_product_galleries,
    ensure_main_landmark,
    entity_meta_description,
    entity_product_galleries,
    esc,
    replace_static_product_grid,
    update_meta,
    update_page_title,
)

LANGUAGES = ("en", "hi", "bn")
SITE = "https://www.souviks.co.in"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def replace_static_div(page: str, element_id: str, inner_html: str) -> str:
    opening = re.search(
        r'<div\b(?=[^>]*\bid=["\']' + re.escape(element_id) +
        r'["\'])(?=[^>]*\bdata-static-rendered=["\']true["\'])[^>]*>',
        page,
        flags=re.I,
    )
    if not opening:
        raise ValueError(f"Missing static-rendered #{element_id} container.")

    depth = 1
    tags = re.compile(r"</?div\b[^>]*>", flags=re.I)
    for tag in tags.finditer(page, opening.end()):
        if re.match(r"</div\b", tag.group(0), flags=re.I):
            depth -= 1
            if depth == 0:
                return page[:opening.end()] + "\n" + inner_html + "\n" + page[tag.start():]
        elif not re.search(r"/\s*>$", tag.group(0)):
            depth += 1
    raise ValueError(f"Unclosed static-rendered #{element_id} container.")


def find_brand_shell(directory: Path, target: Path) -> tuple[str, Path]:
    for candidate in sorted(directory.glob("*.html")):
        if candidate == target:
            continue
        page = candidate.read_text(encoding="utf-8")
        if (
            re.search(r"<body\b[^>]*\bpage-brand\b", page, flags=re.I)
            and 'id="brand-detail"' in page
            and 'id="product-grid"' in page
        ):
            return page, candidate
    raise FileNotFoundError(f"No reusable brand page shell in {directory}")


def update_brand_routes(page: str, slug: str, language: str) -> str:
    current_url = f"{SITE}/{language}/brands/{slug}"
    language_urls = {
        "en": f"{SITE}/en/brands/{slug}",
        "hi": f"{SITE}/hi/brands/{slug}",
        "bn": f"{SITE}/bn/brands/{slug}",
        "x-default": f"{SITE}/en/brands/{slug}",
    }

    def update_link(match: re.Match) -> str:
        tag = match.group(0)
        rel = re.search(r'\brel=["\']([^"\']+)["\']', tag, flags=re.I)
        if not rel:
            return tag
        value = rel.group(1).casefold()
        target = current_url if value == "canonical" else None
        if value == "alternate":
            code = re.search(r'\bhreflang=["\']([^"\']+)["\']', tag, flags=re.I)
            target = language_urls.get(code.group(1).lower()) if code else None
        if not target:
            return tag
        updated, count = re.subn(
            r'(\bhref\s*=\s*)(["\'])[^"\']*\2',
            lambda item: item.group(1) + item.group(2) + target + item.group(2),
            tag,
            count=1,
            flags=re.I,
        )
        if count != 1:
            raise ValueError(f"Could not update brand route link for {current_url}")
        return updated

    page = re.sub(r"<link\b[^>]*>", update_link, page, flags=re.I)

    def update_social(match: re.Match) -> str:
        tag = match.group(0)
        is_url = (
            re.search(r'\bproperty=["\']og:url["\']', tag, flags=re.I)
            or re.search(r'\bname=["\']twitter:url["\']', tag, flags=re.I)
        )
        if not is_url:
            return tag
        return re.sub(
            r'(\bcontent\s*=\s*)(["\'])[^"\']*\2',
            lambda item: item.group(1) + item.group(2) + current_url + item.group(2),
            tag,
            count=1,
            flags=re.I,
        )

    page = re.sub(r"<meta\b[^>]*>", update_social, page, flags=re.I)
    page, count = re.subn(
        r'(\bcurrentPageUrl\s*:\s*)(["\'])[^"\']*\2',
        lambda item: item.group(1) + item.group(2) + f"/{language}/brands/{slug}" + item.group(2),
        page,
        count=1,
        flags=re.I,
    )
    if count != 1:
        raise ValueError(f"{language}/brands/{slug}.html has no currentPageUrl setting.")
    return page


def update_brand_breadcrumb(page: str, name: str) -> str:
    pattern = re.compile(
        r'(<li\b(?=[^>]*\bclass=["\'][^"\']*\bactive\b[^"\']*["\'])'
        r'(?=[^>]*\baria-current=["\']page["\'])[^>]*>)[\s\S]*?(</li>)',
        flags=re.I,
    )
    page, count = pattern.subn(
        lambda match: match.group(1) + esc(name) + match.group(2),
        page,
        count=1,
    )
    if count != 1:
        raise ValueError(f"Brand page has no active breadcrumb for {name}.")
    return page


def update_brand_identity(page: str, brand: dict, products: list[dict], language: str) -> str:
    name = clean(brand.get("name"))
    slug = clean(brand.get("slug"))
    page_url = f"{SITE}/{language}/brands/{slug}"
    page = update_brand_routes(page, slug, language)
    page = update_brand_breadcrumb(page, name)

    logo = clean(brand.get("logo"))
    if logo:
        width = height = 400
        dimensions = brand.get("logo_dimensions")
        if isinstance(dimensions, (list, tuple)) and len(dimensions) >= 2:
            try:
                candidate_width, candidate_height = int(dimensions[0]), int(dimensions[1])
                if candidate_width > 0 and candidate_height > 0:
                    width, height = candidate_width, candidate_height
            except (TypeError, ValueError):
                pass
        media = (
            f'<div class="brand-logo"><img src="{esc(logo)}" alt="{esc(name)}" '
            f'loading="lazy" decoding="async" width="{width}" height="{height}"></div>'
        )
    else:
        media = (
            f'<div class="brand-logo brand-logo--placeholder" role="img" '
            f'aria-label="{esc(name)}"><span>{esc(name)}</span></div>'
        )

    detail = (
        '<div class="brand-detail">' + media
        + '<div class="brand-info"><h1>' + esc(name) + '</h1><p>'
        + esc(brand.get("description")) + '</p></div></div>'
    )
    page = replace_static_div(page, "brand-detail", detail)

    schema_updated = False

    def update_schema(data):
        nonlocal schema_updated
        if isinstance(data, list):
            for item in data:
                update_schema(item)
            return
        if not isinstance(data, dict):
            return
        schema_type = data.get("@type")
        types = schema_type if isinstance(schema_type, list) else [schema_type]
        if "CollectionPage" in types:
            schema_updated = True
            about = {
                "@type": "Brand",
                "@id": page_url + "#brand",
                "name": name,
                "url": page_url,
            }
            if logo:
                about["logo"] = {
                    "@type": "ImageObject",
                    "url": SITE + logo if logo.startswith("/") else logo,
                }
            entries = []
            for product in products:
                product_slug = clean(product.get("slug"))
                product_name = clean(product.get("product_name") or product.get("name"))
                if not product_slug or not product_name:
                    continue
                product_url = f"{SITE}/{language}/products/{product_slug}"
                entries.append({
                    "@type": "ListItem",
                    "position": len(entries) + 1,
                    "name": product_name,
                    "url": product_url,
                    "item": product_url,
                })
            data["@id"] = page_url + "#collection"
            data["name"] = f"{name} Parts | Souviks"
            data["url"] = page_url
            data["mainEntityOfPage"] = page_url
            data["about"] = about
            data["mainEntity"] = {
                "@type": "ItemList",
                "itemListOrder": "https://schema.org/ItemListOrderAscending",
                "numberOfItems": len(entries),
                "itemListElement": entries,
            }
        for child in list(data.values()):
            if isinstance(child, (dict, list)):
                update_schema(child)

    jsonld = re.compile(
        r'<script\b([^>]*\btype=["\']application/ld\+json["\'][^>]*)>([\s\S]*?)</script>',
        flags=re.I,
    )

    def update_jsonld(match: re.Match) -> str:
        try:
            data = json.loads(match.group(2))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON-LD on {language}/brands/{slug}.html: {exc}") from exc
        update_schema(data)
        return "<script" + match.group(1) + ">" + json.dumps(data, ensure_ascii=False, indent=2) + "</script>"

    page, count = jsonld.subn(update_jsonld, page)
    if count == 0 or not schema_updated:
        raise ValueError(f"{language}/brands/{slug}.html has no CollectionPage JSON-LD.")
    return page


def create_missing_brand_pages() -> int:
    data_dir = ROOT / "assets" / "data"
    catalogue = read_json(data_dir / "catalogue-index.json")
    brands = read_json(data_dir / "brands.json")
    categories = read_json(data_dir / "categories.json")
    vehicles = read_json(data_dir / "vehicles.json")
    indexes = build_entity_link_indexes(brands, categories, vehicles, catalogue)

    created = 0
    for brand in brands:
        if not isinstance(brand, dict) or brand.get("active") is False:
            continue
        slug = clean(brand.get("slug"))
        brand_id = clean(brand.get("id"))
        if not slug or not brand_id:
            continue
        products = [
            product for product in catalogue
            if isinstance(product, dict)
            and product.get("active") is not False
            and clean(product.get("brand_id")) == brand_id
        ]

        for language in LANGUAGES:
            target = ROOT / language / "brands" / f"{slug}.html"
            if target.is_file():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            page, shell_path = find_brand_shell(target.parent, target)
            page = update_page_title(page, brand_page_title(brand.get("name"), language))
            page = update_meta(page, entity_meta_description("brand", brand, products, language))
            page = update_brand_identity(page, brand, products, language)
            page = replace_static_product_grid(
                page,
                entity_product_galleries("brand", brand, products, language),
            )

            marker = "<!-- ENTITY_CONTEXT_BRAND -->"
            page = re.sub(
                r'<section class=["\']entity-context section-spacing["'][^>]*>[\s\S]*?</section>',
                "",
                page,
                flags=re.I,
            )
            page = page.replace(marker, "")
            context = context_section("brand", brand, products, language, indexes)
            anchor = re.search(r'<!--\s*=+\s*BRAND PRODUCTS\s*=+\s*-->', page, flags=re.I)
            block = marker + "\n" + context + "\n"
            if anchor:
                page = page[:anchor.start()] + block + page[anchor.start():]
            else:
                page = page.replace("</body>", block + "</body>", 1)
            page = deduplicate_entity_product_galleries(page)
            page = ensure_main_landmark(page)
            target.write_text(page, encoding="utf-8")
            created += 1
            print(f"Created {target.relative_to(ROOT)} using shell {shell_path.name}")

    print(f"Missing localized brand pages created: {created}")
    return created


if __name__ == "__main__":
    create_missing_brand_pages()
