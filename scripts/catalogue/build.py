#!/usr/bin/env python3
"""Deterministic Souviks static catalogue build.

This script updates generated catalogue projections and static product markup.
It never commits or pushes. CI owns version-control operations.
"""

from __future__ import annotations

import pathlib
import runpy

ROOT = pathlib.Path(__file__).resolve().parents[2]

def reconcile_catalogue_projections():
    
    import html as html_module
    import json
    import pathlib
    import re
    
    ROOT = pathlib.Path(__file__).resolve().parents[2]
    CATALOGUE_PATH = ROOT / "assets/data/catalogue-index.json"
    PRODUCTS_PATH = ROOT / "assets/data/products.json"
    SEARCH_PATH = ROOT / "assets/data/search.json"
    
    catalogue = json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))
    
    def text(v):
        return str(v or "").strip()
    
    def arr(v):
        if isinstance(v, list):
            return [text(x) for x in v if text(x)]
        return [x.strip() for x in re.split(r"[,;]", text(v)) if x.strip()]
    
    # A temporary sheet override file is used for an exact workbook-to-catalogue
    # reconciliation. It is deleted after the projection commit.
    override_path = ROOT / "assets/data/catalogue_overrides.json"
    if override_path.exists():
        override = json.loads(override_path.read_text(encoding="utf-8"))
        overrides = {text(p.get("id")): p for p in override.get("products", []) if p.get("id")}
        category_updates = {text(p.get("id")): p for p in override.get("category_updates", []) if p.get("id")}
    
        by_id = {text(p.get("id")): p for p in catalogue if p.get("id")}
    
        for pid, sheet_row in overrides.items():
            current = by_id.get(pid)
            if current is None:
                current = {}
                catalogue.append(current)
                by_id[pid] = current
    
            part = text(sheet_row.get("part_number"))
            slug = text(sheet_row.get("slug"))
            current.update({
                "id": pid,
                "slug": slug,
                "part_number": part,
                "manufacturer_part_number": text(sheet_row.get("manufacturer_part_number")),
                "mrp": sheet_row.get("mrp"),
                "selling_price": sheet_row.get("selling_price"),
                "product_name": text(sheet_row.get("product_name")),
                "name": text(sheet_row.get("product_name")),
                "partNumber": part,
                "brand_id": text(sheet_row.get("brand_id")),
                "brand_name": text(sheet_row.get("brand_name")),
                "brand": text(sheet_row.get("brand_name")),
                "category_id": text(sheet_row.get("category_id")),
                "category_name": text(sheet_row.get("category_name")),
                "category": text(sheet_row.get("category_name")),
                "subcategory_id": text(sheet_row.get("subcategory_id")),
                "subcategory_name": text(sheet_row.get("subcategory_name")),
                "subcategory": text(sheet_row.get("subcategory_name")),
                "description": text(sheet_row.get("description")),
                "image_folder": text(sheet_row.get("image_folder") or pid),
                "vehicles": arr(sheet_row.get("vehicles")),
                "applications": arr(sheet_row.get("applications")),
                "featured": bool(sheet_row.get("featured")),
                "active": sheet_row.get("active") is not False,
                "catalogue_updated_at": text(override.get("updated_at")) or text(current.get("catalogue_updated_at")),
            })
            current.setdefault("manufacturer_part_numbers", [])
            current.setdefault("alternate_part_numbers", [])
            current.setdefault("oem_numbers", [])
            current.setdefault("cross_references", [])
            current.setdefault("gallery", [])
            current.setdefault("gallery_dimensions", {})
            current.setdefault("image", "")
            current.setdefault("primary_image", "")
            current.setdefault("image_url", "/assets/images/placeholder.webp")
    
        for pid, fix in category_updates.items():
            current = by_id.get(pid)
            if current is None:
                continue
            current["category_id"] = text(fix.get("category_id"))
            current["category_name"] = text(fix.get("category_name"))
            current["category"] = current["category_name"]
            current["subcategory_id"] = text(fix.get("subcategory_id"))
            current["subcategory_name"] = text(fix.get("subcategory_name"))
            current["subcategory"] = current["subcategory_name"]
            current["catalogue_updated_at"] = text(override.get("updated_at")) or text(current.get("catalogue_updated_at"))
    
        CATALOGUE_PATH.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    
    active = [p for p in catalogue if p.get("active") is not False and p.get("id")]
    count = len(active)
    
    def part_number(p):
        slug = text(p.get("slug"))
        match = re.match(r"^tata-genuine-(\d{12})-", slug, re.I)
        if match:
            return match.group(1)
        return text(p.get("part_number") or p.get("partNumber"))
    
    def product_from_catalogue(p):
        part = part_number(p)
        return {
            "id": text(p.get("id")),
            "slug": text(p.get("slug")),
            "part_number": part,
            "manufacturer_part_number": text(p.get("manufacturer_part_number")),
            "manufacturer_part_numbers": [text(p.get("manufacturer_part_number"))] if text(p.get("manufacturer_part_number")) else [],
            "alternate_part_numbers": list(p.get("alternate_part_numbers") or []),
            "oem_numbers": list(p.get("oem_numbers") or []),
            "cross_references": list(p.get("cross_references") or []),
            "mrp": p.get("mrp"),
            "selling_price": p.get("selling_price"),
            "product_name": text(p.get("product_name") or p.get("name")),
            "name": text(p.get("name") or p.get("product_name")),
            "partNumber": part,
            "brand_id": text(p.get("brand_id")),
            "brand_name": text(p.get("brand_name") or p.get("brand")),
            "brand": text(p.get("brand") or p.get("brand_name")),
            "category_id": text(p.get("category_id")),
            "category_name": text(p.get("category_name") or p.get("category")),
            "category": text(p.get("category") or p.get("category_name")),
            "subcategory_id": text(p.get("subcategory_id")),
            "subcategory_name": text(p.get("subcategory_name") or p.get("subcategory")),
            "subcategory": text(p.get("subcategory") or p.get("subcategory_name")),
            "image": text(p.get("image")),
            "primary_image": text(p.get("primary_image")),
            "image_url": text(p.get("image_url")) or "/assets/images/placeholder.webp",
            "vehicles": arr(p.get("vehicles")),
            "applications": arr(p.get("applications")),
            "featured": bool(p.get("featured")),
            "active": p.get("active") is not False,
            "description": text(p.get("description")),
            "image_folder": text(p.get("image_folder") or p.get("id")),
            "gallery": list(p.get("gallery") or []),
            "gallery_dimensions": dict(p.get("gallery_dimensions") or {}),
            "catalogue_updated_at": text(p.get("catalogue_updated_at")),
            "updated_at": text(p.get("updated_at") or p.get("catalogue_updated_at")),
        }
    
    def search_from_catalogue(p):
        part = part_number(p)
        name = text(p.get("product_name") or p.get("name"))
        brand = text(p.get("brand_name") or p.get("brand"))
        category = text(p.get("category_name") or p.get("category"))
        vehicles = arr(p.get("vehicles"))
        description = text(p.get("description"))
        keywords = [v for v in [name, part, brand, category, text(p.get("subcategory_name") or p.get("subcategory")), description, *vehicles] if v]
        return {
            "id": text(p.get("id")),
            "type": "product",
            "title": name,
            "subtitle": f"Part No. {part}" if part else "Part number on request",
            "keywords": keywords,
            "description": description,
            "applications": arr(p.get("applications")),
            "vehicles": vehicles,
            "part_number": part,
            "manufacturer_part_number": text(p.get("manufacturer_part_number")),
            "manufacturer_part_numbers": [text(p.get("manufacturer_part_number"))] if text(p.get("manufacturer_part_number")) else [],
            "alternate_part_numbers": list(p.get("alternate_part_numbers") or []),
            "oem_numbers": list(p.get("oem_numbers") or []),
            "cross_references": list(p.get("cross_references") or []),
            "slug": text(p.get("slug")),
            "url": f"/en/products/{text(p.get('slug'))}",
            "image": text(p.get("image")),
            "icon": "",
            "category": {"id": text(p.get("category_id")), "name": category},
            "brand": {"id": text(p.get("brand_id")), "name": brand},
            "vehicle_count": len(vehicles),
            "product_count": 0,
            "featured": bool(p.get("featured")),
            "active": p.get("active") is not False,
            "weight": 100,
        }
    
    changed = set()
    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    product_by_id = {text(p.get("id")): p for p in products if p.get("id")}
    
    catalogue_by_id = {
        text(p.get("id")): p
        for p in catalogue
        if p.get("id")
    }
    
    # The catalogue index is the product master. Keep the JSON projection
    # synchronized for every catalogue record, including active-state changes.
    for pid, source in catalogue_by_id.items():
        desired = product_from_catalogue(source)
        current = product_by_id.get(pid)
        if current is None:
            products.append(desired)
            product_by_id[pid] = products[-1]
            changed.add(str(PRODUCTS_PATH))
            continue
    
        projection_fields = (
            "slug", "part_number", "manufacturer_part_number",
            "manufacturer_part_numbers", "alternate_part_numbers",
            "oem_numbers", "cross_references", "mrp", "selling_price",
            "product_name", "name", "partNumber", "brand_id", "brand_name",
            "brand", "category_id", "category_name", "category",
            "subcategory_id", "subcategory_name", "subcategory",
            "image", "primary_image", "image_url", "vehicles",
            "applications", "featured", "active", "description",
            "image_folder", "gallery", "gallery_dimensions",
            "catalogue_updated_at", "updated_at",
        )
        updates = {
            field: desired.get(field)
            for field in projection_fields
            if current.get(field) != desired.get(field)
        }
        if updates:
            current.update(updates)
            changed.add(str(PRODUCTS_PATH))
    
    search = json.loads(SEARCH_PATH.read_text(encoding="utf-8"))

    # Search is a public discovery surface. It must contain only active
    # catalogue products; inactive master records must never remain searchable.
    active_ids = {text(p.get("id")) for p in active}
    search = [
        p for p in search
        if p.get("type") != "product" or text(p.get("id")) in active_ids
    ]
    search_by_id = {
        text(p.get("id")): p
        for p in search
        if p.get("type") == "product" and p.get("id")
    }
    
    search_fields = (
        "title", "subtitle", "keywords", "description", "applications",
        "vehicles", "part_number", "manufacturer_part_number",
        "manufacturer_part_numbers", "alternate_part_numbers",
        "oem_numbers", "cross_references", "slug", "image",
        "vehicle_count", "featured", "active",
    )
    
    for p in active:
        pid = text(p.get("id"))
        if not pid:
            continue
        current = search_by_id.get(pid)
        desired = search_from_catalogue(p)
        if current is None:
            search.append(desired)
            search_by_id[pid] = search[-1]
            changed.add(str(SEARCH_PATH))
            continue
    
        updates = {
            field: desired.get(field)
            for field in search_fields
            if current.get(field) != desired.get(field)
        }
        desired_category = desired.get("category")
        desired_brand = desired.get("brand")
        for field, value in (("category", desired_category), ("brand", desired_brand)):
            if current.get(field) != value:
                updates[field] = value
    
        if updates:
            current.update(updates)
            changed.add(str(SEARCH_PATH))
    
    by_id = {text(p.get("id")): p for p in active}
    for lang in ("en", "hi", "bn"):
        for path in (ROOT / lang / "products").glob("*.html"):
            html = path.read_text(encoding="utf-8")
            original = html
            match = re.search(r'window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});', html, re.S)
            if not match:
                continue
            try:
                data = json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
            product = by_id.get(text(data.get("id")))
            if not product:
                continue
    
            slug = text(product.get("slug"))
            canonical = f"https://www.souviks.co.in/{lang}/products/{slug}"
            brand = text(product.get("brand_name") or product.get("brand"))
            name = text(product.get("product_name") or product.get("name"))
            part = part_number(product)
            identity = part if part and part.casefold() != name.casefold() else ""
            if brand and identity:
                title = f"{brand} - {identity} - {name} | Souviks"
            elif brand:
                title = f"{brand} - {name} | Souviks"
            elif identity:
                title = f"{identity} - {name} | Souviks"
            else:
                title = f"{name} | Souviks"
    
            description = re.sub(r"\s+", " ", text(product.get("description"))).strip()
            category = text(product.get("category_name") or product.get("category"))
            subcategory = text(product.get("subcategory_name") or product.get("subcategory"))
            vehicles = arr(product.get("vehicles"))
    
            if not description or len(description) < 50:
                description = (
                    f"{brand} {name}".strip()
                    + (f" ({part})" if part else "")
                    + f", a {subcategory or category or 'commercial vehicle'} spare part."
                )
    
            if vehicles:
                description += " Compatible with " + ", ".join(vehicles[:5]) + "."
            description += " Request availability from Souviks."
            description = re.sub(r"\s+", " ", description).strip()
            if len(description) > 158:
                description = description[:157].rsplit(" ", 1)[0].rstrip(" ,;:-") + "."
    
            # Use the same generated buyer-facing description in Product
            # structured data so schema cannot retain a thin/raw legacy value.
            seo_description = description
    
            title_text = html_module.escape(title, quote=False)
            title_attr = html_module.escape(title, quote=True)
            description_attr = html_module.escape(description, quote=True)
            old_name = text(data.get("product_name") or data.get("name"))
    
            data["slug"] = slug
            data["brand_id"] = text(product.get("brand_id"))
            data["brand_name"] = brand
            data["brand"] = brand
            data["product_name"] = name
            data["name"] = name
    
            data["subcategory_id"] = text(product.get("subcategory_id"))
            data["subcategory_name"] = text(product.get("subcategory_name") or product.get("subcategory"))
            data["subcategory"] = data["subcategory_name"]
            data["category_id"] = text(product.get("category_id"))
            data["category_name"] = text(product.get("category_name") or product.get("category"))
            data["category"] = data["category_name"]
            data["part_number"] = part
            data["partNumber"] = part
            data["updated_at"] = text(
                product.get("updated_at")
                or product.get("catalogue_updated_at")
                or data.get("catalogue_updated_at")
            )
            data["seo"] = dict(data.get("seo") or {})
            data["seo"]["title"] = title
            data["seo"]["description"] = description
            data["seo"]["canonical"] = canonical
    
            html = html[:match.start()] + "window.SOUVIKS_PRODUCT_PAGE_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";" + html[match.end():]
            if old_name and old_name != name:
                html = html.replace(old_name, name)
            html = re.sub(r'<title>[\s\S]*?</title>', lambda m: f"<title>{title_text}</title>", html, count=1, flags=re.I)
            html = re.sub(r'(<meta\s+property=["\']og:title["\']\s+content=["\'])[^"\']*(["\'])', lambda m: m.group(1) + title_attr + m.group(2), html, count=1, flags=re.I)
            html = re.sub(r'(<meta\s+name=["\']twitter:title["\']\s+content=["\'])[^"\']*(["\'])', lambda m: m.group(1) + title_attr + m.group(2), html, count=1, flags=re.I)
            html = re.sub(
                r'(<meta\s+name=["\']description["\']\s+content=["\'])[^"\']*(["\'])',
                lambda m: m.group(1) + description_attr + m.group(2),
                html, count=1, flags=re.I
            )
            html = re.sub(
                r'(<meta\s+property=["\']og:description["\']\s+content=["\'])[^"\']*(["\'])',
                lambda m: m.group(1) + description_attr + m.group(2),
                html, count=1, flags=re.I
            )
            html = re.sub(
                r'(<meta\s+name=["\']twitter:description["\']\s+content=["\'])[^"\']*(["\'])',
                lambda m: m.group(1) + description_attr + m.group(2),
                html, count=1, flags=re.I
            )
            html = re.sub(r'(<link\s+rel=["\']canonical["\']\s+href=["\'])[^"\']*(["\'])', lambda m: m.group(1) + canonical + m.group(2), html, count=1, flags=re.I)
            html = re.sub(r'(<meta\s+property=["\']og:url["\']\s+content=["\'])[^"\']*(["\'])', lambda m: m.group(1) + canonical + m.group(2), html, count=1, flags=re.I)
            html = re.sub(r'(<meta\s+name=["\']twitter:url["\']\s+content=["\'])[^"\']*(["\'])', lambda m: m.group(1) + canonical + m.group(2), html, count=1, flags=re.I)
            html = re.sub(r'(currentPage:\s*)["\'][^"\']*["\']', lambda m: m.group(1) + json.dumps(name), html, count=1)
            html = re.sub(
                r'(<link\s+rel=["\']alternate["\']\s+hreflang=["\']x-default["\']\s+href=["\'])[^"\']*(["\'])',
                lambda m: m.group(1) + f"https://www.souviks.co.in/en/products/{slug}" + m.group(2),
                html, count=1, flags=re.I
            )
    
            sub_name = text(product.get("subcategory_name") or product.get("subcategory"))
            if sub_name:
                html = re.sub(
                    r'(<div class=["\']pdp-row["\']>\s*<strong>\s*(?:Sub Category|उपश्रेणी|উপ-বিভাগ)\s*</strong>\s*<span>)[^<]*(</span>)',
                    lambda m: m.group(1) + sub_name + m.group(2),
                    html, count=1, flags=re.I
                )
    
            if html != original:
                path.write_text(html, encoding="utf-8")
                changed.add(str(path))
    
    counter_files = [
        "en/index.html","hi/index.html","bn/index.html",
        "en/about.html","hi/about.html","bn/about.html",
        "en/products.html","hi/products.html","bn/products.html",
        "en/brands.html","hi/brands.html","bn/brands.html",
        "en/vehicles.html","hi/vehicles.html","bn/vehicles.html",
        "en/categories.html","hi/categories.html","bn/categories.html"
    ]
    for name in counter_files:
        path = ROOT / name
        if not path.exists():
            continue
        html = path.read_text(encoding="utf-8")
        original = html
        html = re.sub(
            r'(<span><strong>)\d+\+(</strong><small>Products</small></span>)',
            lambda m: m.group(1) + f"{count}+" + m.group(2),
            html,
        )
        if html != original:
            path.write_text(html, encoding="utf-8")
            changed.add(str(path))
    
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for lang in ("en","bn","hi"):
        for p in active:
            slug = text(p.get("slug"))
            lines += ["  <url>", f"    <loc>https://www.souviks.co.in/{lang}/products/{slug}</loc>", "  </url>"]
    lines.append("</urlset>")
    sitemap = "\n".join(lines) + "\n"
    sitemap_path = ROOT / "sitemaps/products.xml"
    if sitemap_path.read_text(encoding="utf-8") != sitemap:
        sitemap_path.write_text(sitemap, encoding="utf-8")
        changed.add(str(sitemap_path))
    
    if not changed:
        print("Catalogue projections already synchronized.")
    else:
        print(f"Prepared {len(changed)} catalogue projection file changes.")
    
    PRODUCTS_PATH.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    SEARCH_PATH.write_text(json.dumps(search, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if override_path.exists():
        override_path.unlink()


def sync_static_product_images():
    
    import html as html_module
    import json
    import pathlib
    import re
    
    root = ROOT
    catalogue = json.loads((root / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
    products = {
        str(item.get("id")): item
        for item in catalogue
        if item.get("active") is not False and item.get("id")
    }
    
    changed = []
    
    def image_url(product, filename):
        folder = str(product.get("image_folder") or product.get("id") or "").strip()
        name = str(filename or "").strip()
        if not folder or not name:
            return ""
        return f"/assets/images/products/{folder}/{name}"
    
    # 1) Reconcile every static PDP with the canonical catalogue gallery.
    for lang in ("en", "hi", "bn"):
        for path in (root / lang / "products").glob("*.html"):
            text = path.read_text(encoding="utf-8")
    
            data_match = re.search(
                r'window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});',
                text,
                re.S,
            )
            if not data_match:
                continue
    
            try:
                embedded = json.loads(data_match.group(1))
            except json.JSONDecodeError:
                continue
    
            product = products.get(str(embedded.get("id")))
            gallery = product.get("gallery") if product else None
            if not product or not isinstance(gallery, list) or not gallery:
                continue
    
            gallery = [str(name).strip() for name in gallery if str(name).strip()]
            if not gallery:
                continue
    
            refreshed = dict(embedded)
            refreshed["image_folder"] = product.get("image_folder") or embedded.get("image_folder") or product.get("id")
            refreshed["image"] = gallery[0]
            refreshed["primary_image"] = gallery[0]
            refreshed["image_url"] = image_url(product, gallery[0])
            refreshed["gallery"] = gallery
            refreshed["gallery_dimensions"] = {
                str(name): product.get("gallery_dimensions", {}).get(str(name))
                for name in gallery
                if isinstance(product.get("gallery_dimensions"), dict)
                and isinstance(product.get("gallery_dimensions", {}).get(str(name)), list)
                and len(product.get("gallery_dimensions", {}).get(str(name))) == 2
            }
    
            new_data = json.dumps(refreshed, ensure_ascii=False, separators=(",", ":"))
            if new_data != data_match.group(1):
                text = text[:data_match.start(1)] + new_data + text[data_match.end(1):]
    
            main_src = image_url(product, gallery[0])
            text, main_count = re.subn(
                r'(<img\b[^>]*\bid="pdpMainImage"[^>]*\bsrc=")[^"]+(")',
                lambda m: m.group(1) + main_src + m.group(2),
                text,
                count=1,
            )
    
            thumb_match = re.search(
                r'(<div\s+class="pdp-thumbnails">).*?(</div><button\s+class="pdp-thumb-next")',
                text,
                re.S,
            )
            if thumb_match:
                product_name = html_module.escape(str(refreshed.get("product_name") or refreshed.get("name") or "Product"), quote=True)
                thumbs = []
                for index, filename in enumerate(gallery, start=1):
                    src = image_url(product, filename)
                    thumbs.append(
                        f'<button class="pdp-thumb" type="button" aria-label="View {product_name} image {index}">'
                        f'<img src="{src}" alt="{product_name} image {index}" loading="lazy" decoding="async" draggable="false"></button>'
                    )
                replacement = thumb_match.group(1) + "".join(thumbs) + thumb_match.group(2)
                text = text[:thumb_match.start()] + replacement + text[thumb_match.end():]
    
            if text != path.read_text(encoding="utf-8"):
                path.write_text(text, encoding="utf-8")
                changed.append(str(path))
    
    # 2) Reconcile product-card thumbnails everywhere the static builder emitted them.
    for path in root.glob("**/*.html"):
        if "/products/" in path.as_posix() and path.parent.name != "products":
            # Entity pages can still contain product cards; do not skip them.
            pass
    
        text = path.read_text(encoding="utf-8")
        original = text
        is_products_listing = path.name == "products.html" and path.parent.name in {"en", "bn", "hi"}
        card_index = 0
    
        def refresh_card(match):
            nonlocal card_index
            card_index += 1
            card = match.group(0)
            id_match = re.search(
                r'data-saved-product-id="([^"]+)"|data-id="([^"]+)"',
                card,
            )
            if not id_match:
                return card
    
            product_id = id_match.group(1) or id_match.group(2)
            product = products.get(str(product_id))
            if not product:
                return card
    
            gallery = product.get("gallery")
            if isinstance(gallery, list) and gallery:
                gallery = [str(name).strip() for name in gallery if str(name).strip()]
            else:
                gallery = []
    
            src = image_url(product, gallery[0]) if gallery else str(product.get("image_url") or "").strip()
            if not src:
                return card
    
            def update_image(match):
                attrs = match.group(0)
                attrs = re.sub(r'\sloading="[^"]*"', "", attrs)
                attrs = re.sub(r'\sfetchpriority="[^"]*"', "", attrs)
                if is_products_listing and card_index <= 4:
                    return attrs.replace("<img ", '<img loading="eager" fetchpriority="high" ', 1)
                return attrs.replace("<img ", '<img loading="lazy" ', 1)

            return re.sub(
                r'<img\b[^>]*class="product-image-file"[^>]*>',
                update_image,
                card,
                count=1,
            )
    
        text = re.sub(
            r'<article\s+class="product-card".*?</article>',
            refresh_card,
            text,
            flags=re.S,
        )
    
        if text != original:
            path.write_text(text, encoding="utf-8")
            if str(path) not in changed:
                changed.append(str(path))
    
    if not changed:
        print("Static product image markup is already synchronized.")
    else:
        print(f"Synchronized static product images in {len(changed)} HTML files.")


def normalize_blank_part_numbers():
    
    import pathlib
    changed = []
    for lang in ("en", "hi", "bn"):
        root = ROOT / lang / "products"
        if not root.exists():
            continue
        for path in root.glob("*.html"):
            text = path.read_text(encoding="utf-8")
            original = text
            text = text.replace("Part Number: .", "Part Number: available on request.")
            text = text.replace(
                "<strong>Part Number</strong><span></span>",
                "<strong>Part Number</strong><span>Available on request</span>"
            )
            if text != original:
                path.write_text(text, encoding="utf-8")
                changed.append(str(path))
    if not changed:
        print("No blank part-number presentation fixes required.")
    else:
        print(f"Normalized {len(changed)} product pages.")


def sync_product_seo_and_schema():
    
    import html as html_module
    import json
    import pathlib
    import re
    
    root = ROOT
    catalogue = {
        str(item.get("id")): item
        for item in json.loads((root / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
        if item.get("active") is not False and item.get("id")
    }
    changed = []
    
    def canonical_url(lang, slug):
        return f"https://www.souviks.co.in/{lang}/products/{slug}"
    
    def image_urls(product):
        folder = str(product.get("image_folder") or product.get("id") or "").strip()
        gallery = product.get("gallery")
        if folder and isinstance(gallery, list) and gallery:
            return [
                f"https://www.souviks.co.in/assets/images/products/{folder}/{str(name).strip()}"
                for name in gallery if str(name).strip()
            ]
        image = str(product.get("image_url") or "").strip()
        return [f"https://www.souviks.co.in{image}"] if image and image.startswith("/") else []
    
    for lang in ("en", "hi", "bn"):
        for path in (root / lang / "products").glob("*.html"):
            html = path.read_text(encoding="utf-8")
            data_match = re.search(
                r'window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});',
                html,
                re.S,
            )
            if not data_match:
                continue
            try:
                embedded = json.loads(data_match.group(1))
            except json.JSONDecodeError:
                continue
    
            product = catalogue.get(str(embedded.get("id")), embedded)
            slug = str(product.get("slug") or embedded.get("slug") or path.stem)
            url = canonical_url(lang, slug)
    
            jsonld_blocks = re.findall(
                r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                html,
                flags=re.I | re.S,
            )
            types = set()
            for block in jsonld_blocks:
                try:
                    obj = json.loads(block.strip())
                except json.JSONDecodeError:
                    continue
                graph = obj.get("@graph") if isinstance(obj, dict) else None
                nodes = graph if isinstance(graph, list) else [obj]
                for node in nodes:
                    node_type = node.get("@type") if isinstance(node, dict) else None
                    if isinstance(node_type, list):
                        types.update(str(v) for v in node_type)
                    elif node_type:
                        types.add(str(node_type))
    
            original = html
    
            # Keep image-related metadata synchronized with the canonical catalogue.
            gallery_urls = image_urls(product)
            primary_image_url = gallery_urls[0] if gallery_urls else ""
            if primary_image_url:
                html = re.sub(
                    r'(<meta\b[^>]*property=["\']og:image["\'][^>]*content=["\'])[^"\']*(["\'])',
                    lambda m: m.group(1) + primary_image_url + m.group(2),
                    html,
                    count=1,
                    flags=re.I,
                )
                image_alt = html_module.escape(
                    str(product.get("product_name") or product.get("name") or "Product image"),
                    quote=True,
                )
                html = re.sub(
                    r'(<meta\b[^>]*property=["\']og:image:alt["\'][^>]*content=["\'])[^"\']*(["\'])',
                    lambda m: m.group(1) + image_alt + m.group(2),
                    html,
                    count=1,
                    flags=re.I,
                )
                html = re.sub(
                    r'(<meta\b[^>]*name=["\']twitter:image["\'][^>]*content=["\'])[^"\']*(["\'])',
                    lambda m: m.group(1) + primary_image_url + m.group(2),
                    html,
                    count=1,
                    flags=re.I,
                )
                html = re.sub(
                    r'(<meta\b[^>]*name=["\']twitter:image:alt["\'][^>]*content=["\'])[^"\']*(["\'])',
                    lambda m: m.group(1) + image_alt + m.group(2),
                    html,
                    count=1,
                    flags=re.I,
                )
                html = re.sub(
                    r'(<link\b[^>]*rel=["\']preload["\'][^>]*as=["\']image["\'][^>]*href=["\'])[^"\']*(["\'])',
                    lambda m: m.group(1) + primary_image_url.replace("https://www.souviks.co.in", "") + m.group(2),
                    html,
                    count=1,
                    flags=re.I,
                )
    
            # Canonical and social URLs must match the generated language-specific PDP URL.
            html = re.sub(
                r'(<link\b[^>]*rel=["\']canonical["\'][^>]*href=["\'])[^"\']*(["\'])',
                lambda m: m.group(1) + url + m.group(2),
                html,
                count=1,
                flags=re.I,
            )
            html = re.sub(
                r'(<meta\b[^>]*property=["\']og:url["\'][^>]*content=["\'])[^"\']*(["\'])',
                lambda m: m.group(1) + url + m.group(2),
                html,
                count=1,
                flags=re.I,
            )
            html = re.sub(
                r'(<meta\b[^>]*name=["\']twitter:url["\'][^>]*content=["\'])[^"\']*(["\'])',
                lambda m: m.group(1) + url + m.group(2),
                html,
                count=1,
                flags=re.I,
            )
    
            name = str(product.get("product_name") or product.get("name") or "")

            if "Product" not in types:
                description = seo_description
                images = image_urls(product)
    
                identifiers = []
                for value in (
                    product.get("part_number"),
                    product.get("manufacturer_part_number"),
                    *(product.get("manufacturer_part_numbers") or []),
                ):
                    value = str(value or "").strip()
                    if value and not any(item["value"] == value for item in identifiers):
                        identifiers.append({"propertyID": "part_number", "value": value})
    
                product_schema = {
                    "@context": "https://schema.org",
                    "@type": "Product",
                    "@id": url + "#product",
                    "name": name,
                    "url": url,
                    "mainEntityOfPage": url,
                    "description": description,
                    "image": images,
                    "sku": str(product.get("id") or ""),
                    "brand": {
                        "@type": "Brand",
                        "name": str(product.get("brand_name") or product.get("brand") or ""),
                    },
                    "category": str(product.get("category_name") or product.get("category") or ""),
                }
    
                mpn = str(product.get("manufacturer_part_number") or "").strip()
                if not mpn:
                    mpn = str(product.get("part_number") or "").strip()
                if mpn:
                    product_schema["mpn"] = mpn
                if identifiers:
                    product_schema["identifier"] = identifiers
    
                selling_price = product.get("selling_price")
                try:
                    numeric_price = float(selling_price)
                except (TypeError, ValueError):
                    numeric_price = None
                if numeric_price is not None and numeric_price > 0:
                    product_schema["offers"] = {
                        "@type": "Offer",
                        "url": url,
                        "priceCurrency": "INR",
                        "price": numeric_price,
                        "seller": {
                            "@type": "Organization",
                            "name": "Souviks",
                        },
                    }
    
                schema_html = (
                    '    <script type="application/ld+json">\n'
                    + json.dumps(product_schema, ensure_ascii=False, indent=2)
                    + '\n    </script>\n\n'
                )
    
                first_ld = re.search(
                    r'\s*<script\b[^>]*type=["\']application/ld\+json["\']',
                    html,
                    flags=re.I,
                )
                if first_ld:
                    html = html[:first_ld.start()] + "\n" + schema_html + html[first_ld.start():]
                else:
                    head_close = re.search(r'</head>', html, flags=re.I)
                    if head_close:
                        html = html[:head_close.start()] + "\n" + schema_html + html[head_close.start():]
    
            # Repair an existing Product node as well as creating a missing one.
            repaired_blocks = []
            for match in re.finditer(
                r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                html,
                flags=re.I | re.S,
            ):
                block = match.group(1)
                try:
                    obj = json.loads(block.strip())
                except json.JSONDecodeError:
                    continue
    
                graph = obj.get("@graph") if isinstance(obj, dict) else None
                nodes = graph if isinstance(graph, list) else [obj]
                updated = False
    
                for node in nodes:
                    if not isinstance(node, dict) or node.get("@type") != "Product":
                        continue
    
                    node["name"] = str(product.get("product_name") or product.get("name") or node.get("name") or "")
                    node["url"] = url
                    node["mainEntityOfPage"] = url
                    node["description"] = seo_description
                    if gallery_urls:
                        node["image"] = gallery_urls
                    node["sku"] = str(product.get("id") or node.get("sku") or "")
    
                    brand_name = str(product.get("brand_name") or product.get("brand") or "").strip()
                    if brand_name:
                        node["brand"] = {"@type": "Brand", "name": brand_name}
    
                    category_name = str(product.get("category_name") or product.get("category") or "").strip()
                    if category_name:
                        node["category"] = category_name
    
                    offers = node.get("offers") if isinstance(node.get("offers"), dict) else {}
                    offers["@type"] = "Offer"
                    offers["url"] = url
                    offers["priceCurrency"] = "INR"
                    try:
                        numeric_price = float(product.get("selling_price"))
                    except (TypeError, ValueError):
                        numeric_price = None
                    if numeric_price is not None and numeric_price > 0:
                        offers["price"] = numeric_price
                        node["offers"] = offers
                    else:
                        node.pop("offers", None)
                    updated = True
    
                if updated:
                    replacement = '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=2) + '\n</script>'
                    repaired_blocks.append((match.start(), match.end(), replacement))
    
            for start, end, replacement in reversed(repaired_blocks):
                html = html[:start] + replacement + html[end:]
    
            # Ensure every product PDP has a valid BreadcrumbList.
            jsonld_blocks_after = re.findall(
                r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                html,
                flags=re.I | re.S,
            )
            has_breadcrumb = False
            for block in jsonld_blocks_after:
                try:
                    obj = json.loads(block.strip())
                except json.JSONDecodeError:
                    continue
                graph = obj.get("@graph") if isinstance(obj, dict) else None
                nodes = graph if isinstance(graph, list) else [obj]
                for node in nodes:
                    if isinstance(node, dict) and node.get("@type") == "BreadcrumbList":
                        has_breadcrumb = True
                        break
                if has_breadcrumb:
                    break
    
            if not has_breadcrumb:
                breadcrumb = {
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Home",
                            "item": f"https://www.souviks.co.in/{lang}/",
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": str(product.get("category_name") or product.get("category") or "Products"),
                            "item": f"https://www.souviks.co.in/{lang}/categories/{str(product.get("category_id") or "").strip()}",
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": name,
                            "item": url,
                        },
                    ],
                }
                breadcrumb_html = (
                    '    <script type="application/ld+json">\n'
                    + json.dumps(breadcrumb, ensure_ascii=False, indent=2)
                    + '\n    </script>\n\n'
                )
                head_close = re.search(r'</head>', html, flags=re.I)
                if head_close:
                    html = html[:head_close.start()] + breadcrumb_html + html[head_close.start():]
    
            if html != original:
                path.write_text(html, encoding="utf-8")
                changed.append(str(path))
    
    if not changed:
        print("Product JSON-LD and BreadcrumbList are already complete.")
    else:
        print(f"Repaired Product JSON-LD in {len(changed)} pages.")


def main() -> None:
    reconcile_catalogue_projections()
    sync_static_product_images()
    normalize_blank_part_numbers()
    sync_product_seo_and_schema()
    runpy.run_path(str(ROOT / "scripts/catalogue/validate.py"), run_name="__main__")


if __name__ == "__main__":
    main()
