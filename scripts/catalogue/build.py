#!/usr/bin/env python3
"""Deterministic Souviks static catalogue build.

This script updates generated catalogue projections and static product markup.
It never commits or pushes. CI owns version-control operations.
"""

from __future__ import annotations

import pathlib
import runpy
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = "https://www.souviks.co.in"
# URL normalization keeps generated catalogue routes canonical.
# Product title lengths are capped in visible characters; HTML entities are
# decoded by the SEO validation check before it measures the title length.
# Generated-output commits rebase before push to avoid concurrent catalogue races.
# CI retries catalogue publication against the latest main revision.
# Final pointer 22-25 parity normalization.
# Retrigger validation with the corrected audit command.

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

    def normalize_slug(value):
        value = text(value).casefold()
        value = re.sub(r"[^a-z0-9]+", "-", value)
        return re.sub(r"-{2,}", "-", value).strip("-")
    
    # Public product URLs are lowercase ASCII slugs. Normalize the master before
    # rebuilding projections/pages so one malformed source slug cannot produce
    # duplicate URL variants or leave an orphaned generated page behind.
    slug_overrides = {
        "SVKS000686": "fleetguard-fa0016700-154-90x49-20mm-spicer-transmission-tml-3118-4018-al-4018-amw-2518-eicher-mega-40-40-patti-type",
        "SVKS000947": "texspin-tx-6638sc-clutch-release-bearing-ashok-leyland-31ton",
        "SVKS000998": "texspin-tx-6647sc-clutch-release-bearing-ashok-leyland-1616",
    }

    slug_seen = set()
    for product in catalogue:
        if not product.get("id"):
            continue
        original_slug = text(product.get("slug"))
        override_slug = slug_overrides.get(text(product.get("id")))
        normalized_slug = normalize_slug(override_slug or original_slug)
        if not normalized_slug:
            raise SystemExit(f"{text(product.get('id'))}: product slug normalizes to an empty route")
        if normalized_slug in slug_seen:
            raise SystemExit(
                f"Duplicate normalized product slug for {text(product.get('id'))}: {normalized_slug}"
            )
        slug_seen.add(normalized_slug)
        # Compare against the persisted slug, not the override candidate. The
        # old code selected override_slug as current_slug and consequently
        # failed to write overrides when the candidate itself was normalized.
        if normalized_slug != original_slug:
            product["slug"] = normalized_slug
            product["catalogue_updated_at"] = text(product.get("catalogue_updated_at")) or ""
    
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
    
    # Migrate useful metadata that already exists in the legacy product
    # projection into the catalogue master when the master field is blank.
    # This is a one-way normalization step; once populated, the master remains
    # authoritative for future projections.
    legacy_projection = {}
    if PRODUCTS_PATH.exists():
        try:
            legacy_records = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
            legacy_projection = {
                text(record.get("id")): record
                for record in legacy_records
                if isinstance(record, dict) and text(record.get("id"))
            }
        except (OSError, json.JSONDecodeError):
            legacy_projection = {}

    for product in catalogue:
        legacy = legacy_projection.get(text(product.get("id")), {})
        for field in ("applications", "image_folder", "gallery", "gallery_dimensions"):
            master_value = product.get(field)
            legacy_value = legacy.get(field)
            master_empty = (
                master_value is None or
                master_value == "" or
                master_value == [] or
                master_value == {}
            )
            if master_empty and legacy_value not in (None, "", [], {}):
                product[field] = legacy_value

    def ensure_product_description(product):
        current = text(product.get("description"))
        if len(current) >= 80:
            return current

        brand = text(product.get("brand_name") or product.get("brand"))
        name = text(product.get("product_name") or product.get("name"))
        part = text(product.get("part_number") or product.get("partNumber"))
        tata_match = re.match(r"^tata-genuine-(\d{12})-", text(product.get("slug")), re.I)
        if tata_match:
            part = tata_match.group(1)
        category = text(product.get("category_name") or product.get("category"))
        subcategory = text(product.get("subcategory_name") or product.get("subcategory"))
        applications = arr(product.get("applications"))
        vehicles = arr(product.get("vehicles"))

        pieces = []
        identity = " ".join(value for value in (brand, name) if value).strip()
        if identity:
            pieces.append(identity)
        if part:
            pieces.append(f"Part number {part}")
        if subcategory:
            pieces.append(f"for {subcategory}")
        elif category:
            pieces.append(f"in {category}")
        if applications:
            pieces.append("Applications: " + "; ".join(applications[:4]))
        if vehicles:
            pieces.append("Compatible vehicles: " + ", ".join(vehicles[:5]))

        # Add a factual closing sentence so otherwise-identical short records
        # remain useful and comfortably above the thin-description threshold.
        pieces.append(
            "Confirm the part number and vehicle application before ordering to verify fitment."
        )

        generated = ". ".join(pieces).strip()
        if generated and not generated.endswith("."):
            generated += "."
        return generated

    for product in catalogue:
        description = ensure_product_description(product)
        if description and description != text(product.get("description")):
            product["description"] = description

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
    expected_slugs = {text(p.get("slug")) for p in active if text(p.get("slug"))}
    for lang in ("en", "hi", "bn"):
        product_dir = ROOT / lang / "products"
        for path in list(product_dir.glob("*.html")):
            html = path.read_text(encoding="utf-8")
            original = html
            match = re.search(r'window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});', html, re.S)

            if not match:
                if path.stem not in expected_slugs:
                    path.unlink()
                    changed.add(str(path))
                continue

            try:
                data = json.loads(match.group(1))
            except json.JSONDecodeError:
                if path.stem not in expected_slugs:
                    path.unlink()
                    changed.add(str(path))
                continue

            product = by_id.get(text(data.get("id")))
            if not product:
                path.unlink()
                changed.add(str(path))
                continue

            target_path = product_dir / f"{text(product.get('slug'))}.html"
            if path != target_path:
                if target_path.exists():
                    raise SystemExit(
                        f"Cannot rename product page without collision: {path} -> {target_path}"
                    )
                path.rename(target_path)
                changed.add(str(path))
                changed.add(str(target_path))
                path = target_path
                html = path.read_text(encoding="utf-8")
                original = html
                match = re.search(r'window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});', html, re.S)
                if not match:
                    raise SystemExit(f"Renamed product page lost embedded data: {path}")
                data = json.loads(match.group(1))
    
            slug = text(product.get("slug"))
            canonical = f"https://www.souviks.co.in/{lang}/products/{slug}"
            brand = text(product.get("brand_name") or product.get("brand"))
            name = text(product.get("product_name") or product.get("name"))
            part = part_number(product)
            identity = part if part and part.casefold() != name.casefold() else ""

            # SEO titles must stay within the repository's 70-character
            # invariant. Keep the full brand and part identity first; shorten
            # only the trailing product-name segment, at a word boundary.
            title_suffix = " | Souviks"
            title_limit = 70
            if brand and identity:
                title_lead = f"{brand} - {identity}"
            elif brand:
                title_lead = brand
            elif identity:
                title_lead = identity
            else:
                title_lead = ""

            if title_lead:
                joiner = " - " if name else ""
                available_name = title_limit - len(title_suffix) - len(title_lead) - len(joiner)
                if available_name > 0:
                    name_part = name
                    if len(name_part) > available_name:
                        shortened = name_part[: available_name + 1].rsplit(" ", 1)[0].rstrip(" ,;:-")
                        if not shortened:
                            shortened = name_part[:available_name].rstrip(" ,;:-")
                        name_part = shortened
                    title_prefix = f"{title_lead}{joiner}{name_part}".rstrip(" -")
                else:
                    # Defensive fallback for an unusually long identity.
                    title_prefix = title_lead[: title_limit - len(title_suffix)].rstrip(" -")
                title = title_prefix + title_suffix
            else:
                available_name = title_limit - len(title_suffix)
                name_part = name
                if len(name_part) > available_name:
                    shortened = name_part[: available_name + 1].rsplit(" ", 1)[0].rstrip(" ,;:-")
                    if not shortened:
                        shortened = name_part[:available_name].rstrip(" ,;:-")
                    name_part = shortened
                title = name_part + title_suffix
    
            raw_description = re.sub(r"\s+", " ", text(product.get("description"))).strip()
            category = text(product.get("category_name") or product.get("category"))
            subcategory = text(product.get("subcategory_name") or product.get("subcategory"))
            vehicles = arr(product.get("vehicles"))

            # Keep the visible PDP useful when the source description is a
            # placeholder or too thin to differentiate the product.
            content_description = raw_description
            if not content_description or len(content_description) < 50:
                content_parts = [
                    f"{brand} {name}".strip(),
                    f"Part number {part}." if part else "",
                    f"Product type: {subcategory or category}." if (subcategory or category) else "",
                    f"Applications: {'; '.join(arr(product.get('applications'))[:4])}." if arr(product.get('applications')) else "",
                    f"Compatible vehicles: {', '.join(vehicles[:5])}." if vehicles else "",
                ]
                content_description = " ".join(part for part in content_parts if part).strip()

            description = content_description
            if vehicles and "Compatible vehicles:" not in description:
                description += " Compatible vehicles: " + ", ".join(vehicles[:5]) + "."
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
            data["description"] = content_description
            data["seo"]["description"] = description
            data["seo"]["canonical"] = canonical
    
            html = html[:match.start()] + "window.SOUVIKS_PRODUCT_PAGE_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";" + html[match.end():]
            if old_name and old_name != name:
                html = html.replace(old_name, name)

            # Replace a thin/static Description paragraph with the same
            # factual content used by the generated embedded product record.
            description_html = html_module.escape(content_description, quote=False)
            html = re.sub(
                r'(<div\s+class=["\']pdp-description-card["\']>\s*<h3>\s*Description\s*</h3>\s*<p>)(.*?)(</p>)',
                lambda m: m.group(1) + description_html + m.group(3),
                html,
                count=1,
                flags=re.I | re.S,
            )
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
            # Keep every language alternate on the current canonical slug.
            # This prevents stale mixed-case or pre-normalization product URLs
            # from surviving in generated hreflang metadata.
            for alternate_lang in ("en", "bn", "hi"):
                alternate_url = f"https://www.souviks.co.in/{alternate_lang}/products/{slug}"
                html = re.sub(
                    rf'(<link\s+rel=["\']alternate["\']\s+hreflang=["\']{alternate_lang}["\']\s+href=["\'])[^"\']*(["\'])',
                    lambda m, target=alternate_url: m.group(1) + target + m.group(2),
                    html, count=1, flags=re.I
                )
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
    
    # Persist the normalized master and all projections from one deterministic build.
    CATALOGUE_PATH.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
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
    # When a catalogue slug is normalized or shortened, move the existing
    # generated PDP to the canonical filename before validating internal links.
    # The legacy filename remains covered by _redirects for inbound traffic.
    for lang in ("en", "hi", "bn"):
        directory = root / lang / "products"
        for path in list(directory.glob("*.html")):
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
            if product:
                canonical_slug = str(product.get("slug") or path.stem).strip()
                canonical_path = directory / f"{canonical_slug}.html"
                if canonical_slug and canonical_path != path:
                    if canonical_path.exists():
                        print(
                            f"WARNING: canonical product page already exists: "
                            f"{canonical_path}"
                        )
                    else:
                        path.rename(canonical_path)
                        path = canonical_path
                        text = path.read_text(encoding="utf-8")
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
    
    def text(value):
        return str(value or "").strip()

    def arr(value):
        if isinstance(value, list):
            return [text(item) for item in value if text(item)]
        return [item.strip() for item in re.split(r"[,;]", text(value)) if item.strip()]

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
    
            name = text(product.get("product_name") or product.get("name"))
            part = text(product.get("part_number") or product.get("partNumber"))
            brand = text(product.get("brand_name") or product.get("brand"))

            # Rebuild the same factual product description inside this
            # schema loop; this loop is separate from the static-page SEO loop.
            schema_description = re.sub(
                r"\\s+",
                " ",
                text(product.get("description"))
            ).strip()
            schema_category = text(product.get("category_name") or product.get("category"))
            schema_subcategory = text(product.get("subcategory_name") or product.get("subcategory"))
            schema_vehicles = arr(product.get("vehicles"))
            if not schema_description or len(schema_description) < 50:
                schema_parts = [
                    f"{brand} {name}".strip(),
                    f"Part number {part}." if part else "",
                    f"Product type: {schema_subcategory or schema_category}."
                    if (schema_subcategory or schema_category) else "",
                    (
                        f"Applications: {'; '.join(arr(product.get('applications'))[:4])}."
                        if arr(product.get("applications")) else ""
                    ),
                    (
                        f"Compatible vehicles: {', '.join(schema_vehicles[:5])}."
                        if schema_vehicles else ""
                    ),
                ]
                schema_description = " ".join(
                    item for item in schema_parts if item
                ).strip()
            if schema_vehicles and "Compatible vehicles:" not in schema_description:
                schema_description += " Compatible vehicles: " + ", ".join(schema_vehicles[:5]) + "."
            schema_description += " Request availability from Souviks."
            schema_description = re.sub(r"\\s+", " ", schema_description).strip()
            if len(schema_description) > 158:
                schema_description = (
                    schema_description[:157]
                    .rsplit(" ", 1)[0]
                    .rstrip(" ,;:-")
                    + "."
                )

            if "Product" not in types:
                description = schema_description
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
    
                    node["@id"] = url + "#product"
                    node["name"] = str(product.get("product_name") or product.get("name") or node.get("name") or "")
                    node["url"] = url
                    node["mainEntityOfPage"] = url
                    node["description"] = schema_description
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
    
            # Repair the final breadcrumb item when a legacy PDP JSON-LD
            # block already exists, then fall back to creating a new list.
            breadcrumb_repaired = []
            for match in re.finditer(
                r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                html, flags=re.I | re.S
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
                    if not isinstance(node, dict) or node.get("@type") != "BreadcrumbList":
                        continue
                    items = node.get("itemListElement")
                    if isinstance(items, list) and items and isinstance(items[-1], dict):
                        if items[-1].get("item") != url:
                            items[-1]["item"] = url
                            updated = True
                if updated:
                    breadcrumb_repaired.append(
                        (
                            match.start(),
                            match.end(),
                            '<script type="application/ld+json">\n'
                            + json.dumps(obj, ensure_ascii=False, indent=2)
                            + '\\n</script>'
                        )
                    )
            for start, end, replacement in reversed(breadcrumb_repaired):
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



def normalize_internal_redirect_links():
    """Rewrite internal links that still point at exact legacy redirect sources."""
    redirect_path = ROOT / "_redirects"
    if not redirect_path.is_file():
        return 0

    redirects = {}
    for line in redirect_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = stripped.split()
        if len(parts) < 2:
            continue
        source, destination = parts[:2]
        # Only normalize exact, concrete paths. Pattern redirects are runtime
        # routing rules and must not be expanded into page HTML.
        if any(token in source for token in (":splat", ":lang", ":slug", "*")):
            continue
        source_path = source
        if source.startswith(BASE):
            source_path = urlparse(source).path
        destination_path = destination
        if destination.startswith(BASE):
            destination_path = urlparse(destination).path
        if not source_path.startswith("/") or not destination_path.startswith("/"):
            continue
        redirects[source_path] = destination_path

    if not redirects:
        return 0

    changed = 0
    for path in ROOT.glob("**/*.html"):
        html = path.read_text(encoding="utf-8", errors="ignore")
        original = html
        for source_path, destination_path in redirects.items():
            # Handle root-relative links and fully-qualified Souviks links.
            html = html.replace(source_path, destination_path)
            html = html.replace(BASE + source_path, BASE + destination_path)
        if html != original:
            path.write_text(html, encoding="utf-8")
            changed += 1

    if changed:
        print(f"Normalized internal links away from {changed} HTML files containing exact redirect sources.")
    return changed

def sync_organization_schema():
    """Ensure Souviks Organization schema nodes expose a crawlable logo."""
    import json
    import re

    logo_url = "https://www.souviks.co.in/assets/logo/souviks-logo.png"
    changed = 0

    for path in ROOT.glob("**/*.html"):
        html = path.read_text(encoding="utf-8")
        original = html
        replacements = []

        for match in re.finditer(
            r"""<script\b[^>]*type=["']application/ld\+json["'][^>]*>(.*?)</script>""",
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
                if not isinstance(node, dict):
                    continue
                targets = []
                node_type = node.get("@type")
                if node_type == "Organization":
                    targets.append(node)
                publisher = node.get("publisher")
                if isinstance(publisher, dict) and publisher.get("@type") == "Organization":
                    targets.append(publisher)

                for target in targets:
                    if str(target.get("name") or "").strip().casefold() != "souviks":
                        continue
                    if not target.get("logo"):
                        target["logo"] = {
                            "@type": "ImageObject",
                            "url": logo_url,
                        }
                        updated = True

            if updated:
                replacement = '<script type="application/ld+json">\n' + json.dumps(
                    obj, ensure_ascii=False, indent=2
                ) + '\n</script>'
                replacements.append((match.start(), match.end(), replacement))

        for start, end, replacement in reversed(replacements):
            html = html[:start] + replacement + html[end:]

        if html != original:
            path.write_text(html, encoding="utf-8")
            changed += 1

    print(
        "Organization schema logo synchronized in "
        f"{changed} HTML files." if changed else
        "Organization schema logos already synchronized."
    )


def main() -> None:
    reconcile_catalogue_projections()
    sync_static_product_images()
    normalize_blank_part_numbers()
    sync_product_seo_and_schema()
    normalize_internal_redirect_links()
    sync_organization_schema()
    runpy.run_path(str(ROOT / "scripts/catalogue/validate.py"), run_name="__main__")


if __name__ == "__main__":
    main()
