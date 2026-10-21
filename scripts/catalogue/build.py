#!/usr/bin/env python3
"""Deterministic Souviks static catalogue build.

This script updates generated catalogue projections and static product markup.
It never commits or pushes. CI owns version-control operations.
"""

from __future__ import annotations

import pathlib
import runpy
import sys
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOGUE_SCRIPTS = str(ROOT / "scripts" / "catalogue")
if CATALOGUE_SCRIPTS not in sys.path:
    sys.path.insert(0, CATALOGUE_SCRIPTS)

from product_seo import (
    build_factual_product_description,
    build_product_meta_description,
    build_product_schema_description,
    is_weak_product_description,
    schema_availability_url,
)

BASE = "https://www.souviks.co.in"
# URL normalization keeps generated catalogue routes canonical.
# Product title lengths are capped in visible characters; HTML entities are
# decoded by the SEO validation check before it measures the title length.
# Generated-output commits rebase before push to avoid concurrent catalogue races.
# CI retries catalogue publication against the latest main revision.
# Final pointer 22-25 parity normalization.
# Retrigger validation with the corrected audit command.

def replace_product_name_markup(source: str, old_name: str, new_name: str) -> str:
    """Replace a product name safely in HTML and JSON-LD contexts.

    Text/attribute markup must HTML-escape quotes, while JSON-LD strings must
    be updated as data and serialized back to valid JSON. A raw global replace
    breaks JSON-LD whenever product names contain inch marks or quotation marks.
    """
    import html
    import json
    import re

    if not old_name or old_name == new_name:
        return source

    jsonld_pattern = re.compile(
        r'(<script\b(?=[^>]*\btype=["\']application/ld\+json["\'])[^>]*>)(.*?)(</script\s*>)',
        flags=re.I | re.S,
    )
    chunks = []
    cursor = 0
    for match in jsonld_pattern.finditer(source):
        chunks.append(source[cursor:match.start()].replace(
            old_name, html.escape(new_name, quote=True)
        ))
        raw_json = match.group(2)
        try:
            parsed = json.loads(raw_json.strip())
        except json.JSONDecodeError:
            # Leave an already-invalid script untouched so the blocking audit
            # reports the actual source rather than masking it with string edits.
            replacement_json = raw_json
        else:
            def update_value(value):
                if isinstance(value, str):
                    return value.replace(old_name, new_name)
                if isinstance(value, list):
                    return [update_value(item) for item in value]
                if isinstance(value, dict):
                    return {key: update_value(item) for key, item in value.items()}
                return value

            replacement_json = json.dumps(
                update_value(parsed), ensure_ascii=False, separators=(",", ":")
            )
        chunks.append(match.group(1) + replacement_json + match.group(3))
        cursor = match.end()
    chunks.append(source[cursor:].replace(
        old_name, html.escape(new_name, quote=True)
    ))
    return "".join(chunks)


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

            # Description-only overrides are deliberately supported so approved
            # SEO copy can be applied without overwriting prices, taxonomy,
            # applications, vehicle mappings, image references, or product state.
            override_fields = set(sheet_row) - {"id"}
            if override_fields == {"description"}:
                if current is None:
                    raise SystemExit(
                        f"Description override references unknown catalogue product: {pid}"
                    )
                description = text(sheet_row.get("description"))
                if not description:
                    raise SystemExit(
                        f"Description override is empty for catalogue product: {pid}"
                    )
                current["description"] = description
                continue

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
        if current and not is_weak_product_description(current):
            return current
        return build_factual_product_description(product)


    for product in catalogue:
        description = ensure_product_description(product)
        if description and description != text(product.get("description")):
            product["description"] = description

    # The public PDP gallery is limited to four native-resolution views per
    # product. Do not resize or rewrite image files; trim catalogue references
    # and keep primary-image metadata aligned with the first retained view.
    for product in catalogue:
        gallery = product.get("gallery")
        if not isinstance(gallery, list) or len(gallery) <= 4:
            continue

        names = []
        for entry in gallery:
            if isinstance(entry, dict):
                filename = text(entry.get("filename") or entry.get("file") or entry.get("name"))
            else:
                filename = text(entry)
            if filename and filename not in names:
                names.append(filename)
            if len(names) == 4:
                break

        if not names:
            product["gallery"] = []
            product["gallery_dimensions"] = {}
            continue

        product["gallery"] = names
        dimensions = product.get("gallery_dimensions")
        if isinstance(dimensions, dict):
            product["gallery_dimensions"] = {
                key: value for key, value in dimensions.items()
                if text(key) in set(names)
            }
        else:
            product["gallery_dimensions"] = {}

        folder = text(product.get("image_folder") or product.get("id"))
        product["image"] = names[0]
        product["primary_image"] = names[0]
        if folder:
            product["image_url"] = f"/assets/images/products/{folder}/{names[0]}"

    # Reconcile image references against the actual product folders before deriving
    # any projections or HTML. This restores metadata-only gaps without resizing or
    # rewriting source files, and quarantines products whose folders contain no
    # usable photo instead of publishing a placeholder as if it were a product image.
    import hashlib

    image_root = ROOT / "assets" / "images" / "products"
    supported_image_extensions = {".webp", ".jpg", ".jpeg", ".png", ".gif"}

    def valid_product_image(path):
        try:
            if not path.is_file() or path.stat().st_size < 16:
                return False
            with path.open("rb") as stream:
                header = stream.read(12)
        except OSError:
            return False

        suffix = path.suffix.casefold()
        if suffix == ".webp":
            return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP"
        if suffix == ".png":
            return header[:8] == b"\x89PNG\r\n\x1a\n"
        if suffix in {".jpg", ".jpeg"}:
            return header[:3] == b"\xff\xd8\xff"
        if suffix == ".gif":
            return header[:6] in {b"GIF87a", b"GIF89a"}
        return False

    def image_sort_key(path):
        match = re.match(r"^(\d+)", path.stem)
        extension_rank = {".webp": 0, ".jpg": 1, ".jpeg": 2, ".png": 3, ".gif": 4}
        if match:
            return (0, int(match.group(1)), extension_rank.get(path.suffix.casefold(), 9), path.name.casefold())
        return (1, path.name.casefold(), 0, path.name.casefold())

    images_reconciled = 0
    images_quarantined = []
    images_reactivated = []

    for product in catalogue:
        pid = text(product.get("id"))
        if not pid:
            continue
        folder = text(product.get("image_folder") or pid)
        if not folder or pathlib.Path(folder).name != folder:
            folder = pid
        folder_path = image_root / folder

        files_by_name = {}
        if folder_path.is_dir():
            for candidate in folder_path.iterdir():
                if (
                    candidate.is_file()
                    and candidate.suffix.casefold() in supported_image_extensions
                    and candidate.name.casefold() not in {"placeholder.webp", "placeholder.jpg", "placeholder.png"}
                    and valid_product_image(candidate)
                ):
                    files_by_name[candidate.name] = candidate

        current_gallery = product.get("gallery")
        preferred_names = []
        if isinstance(current_gallery, list):
            for entry in current_gallery:
                if isinstance(entry, dict):
                    raw_name = text(entry.get("filename") or entry.get("file") or entry.get("name"))
                else:
                    raw_name = text(entry)
                if raw_name:
                    preferred_names.append(pathlib.Path(raw_name).name)

        # If the persisted gallery references a file that no longer exists, its
        # order is stale (for example, duplicate-content images were compacted).
        # Fall back to the current folder's sorted, valid files instead of keeping
        # gaps such as 1.webp, 2.webp, 4.webp in the generated gallery.
        if any(name not in files_by_name for name in preferred_names):
            preferred_names = []

        for field in ("image", "primary_image"):
            raw_name = text(product.get(field))
            if raw_name:
                preferred_names.append(pathlib.Path(raw_name).name)

        if len(files_by_name) > 1:
            ordered_files = sorted(files_by_name.values(), key=image_sort_key)
        else:
            ordered_files = list(files_by_name.values())

        ordered_names = []
        for name in preferred_names + [path.name for path in ordered_files]:
            if name in files_by_name and name not in ordered_names:
                ordered_names.append(name)

        selected_names = []
        fingerprints = set()
        for name in ordered_names:
            path = files_by_name[name]
            try:
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
            except OSError:
                continue
            if digest in fingerprints:
                continue
            fingerprints.add(digest)
            selected_names.append(name)
            if len(selected_names) == 4:
                break

        was_active = product.get("active") is not False
        old_values = (
            product.get("image_folder"),
            product.get("gallery"),
            product.get("image"),
            product.get("primary_image"),
            product.get("image_url"),
            product.get("active"),
        )

        if selected_names:
            product["image_folder"] = folder
            product["gallery"] = selected_names
            dimensions = product.get("gallery_dimensions")
            if isinstance(dimensions, dict):
                keep_keys = set(selected_names) | {pathlib.Path(name).stem for name in selected_names}
                product["gallery_dimensions"] = {
                    key: value for key, value in dimensions.items() if key in keep_keys
                }
            else:
                product["gallery_dimensions"] = {}
            product["image"] = selected_names[0]
            product["primary_image"] = selected_names[0]
            product["image_url"] = f"/assets/images/products/{folder}/{selected_names[0]}"

            if product.get("image_review_status") == "inactive-no-usable-image":
                product["active"] = True
                product.pop("image_review_status", None)
                product.pop("inactive_reason", None)
                images_reactivated.append(pid)

            new_values = (
                product.get("image_folder"),
                product.get("gallery"),
                product.get("image"),
                product.get("primary_image"),
                product.get("image_url"),
                product.get("active"),
            )
            if new_values != old_values:
                images_reconciled += 1
        else:
            # Only auto-reactivate products previously quarantined by this rule.
            # Products manually marked inactive for unrelated reasons stay inactive.
            if was_active or product.get("image_review_status") == "inactive-no-usable-image":
                if was_active:
                    images_quarantined.append(pid)
                product["active"] = False
                product["featured"] = False
                product["image_review_status"] = "inactive-no-usable-image"
                product["inactive_reason"] = "No valid local product photo is available; awaiting source imagery."
                product["gallery"] = []
                product["gallery_dimensions"] = {}
                product["image"] = ""
                product["primary_image"] = ""
                product["image_url"] = ""

    if images_reconciled:
        print(f"[catalogue images] restored or normalized image metadata for {images_reconciled} products.")
    if images_reactivated:
        print("[catalogue images] reactivated products with newly available photos: " + ", ".join(sorted(images_reactivated)))
    if images_quarantined:
        print(f"[catalogue images] deactivated {len(images_quarantined)} products without a valid local photo.")
        print("[catalogue images] quarantined product IDs: " + ", ".join(sorted(images_quarantined)))

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

    # The public product projection contains active catalogue products only.
    # Inactive master records remain in catalogue-index.json for traceability,
    # but must not stay in the public browse/search projection.
    active_product_ids = {text(p.get("id")) for p in active}
    filtered_products = [p for p in products if text(p.get("id")) in active_product_ids]
    if len(filtered_products) != len(products):
        changed.add(str(PRODUCTS_PATH))
    products = filtered_products
    product_by_id = {text(p.get("id")): p for p in products if text(p.get("id"))}

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

    def materialize_missing_product_pages(lang, product_dir):
        """Re-create PDPs for products that became active after receiving valid images."""
        current_slugs = {path.stem for path in product_dir.glob("*.html")}
        missing_products = [
            product for product in active
            if text(product.get("slug")) and text(product.get("slug")) not in current_slugs
        ]
        if not missing_products:
            return 0

        template_path = None
        template_html = ""
        template_data = None
        data_pattern = re.compile(
            r'window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});',
            flags=re.S,
        )
        for candidate in sorted(product_dir.glob("*.html")):
            candidate_html = candidate.read_text(encoding="utf-8", errors="ignore")
            match = data_pattern.search(candidate_html)
            if not match:
                continue
            try:
                candidate_data = json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
            # Clone only a valid PDP mapped to a currently active product.
            if text(candidate_data.get("id")) in by_id:
                template_path = candidate
                template_html = candidate_html
                template_data = candidate_data
                break

        if template_path is None or template_data is None:
            raise SystemExit(
                f"Cannot generate {lang} PDPs: no valid active product page is available as a template"
            )

        old_id = text(template_data.get("id"))
        old_slug = text(template_data.get("slug") or template_path.stem)
        old_name = text(template_data.get("product_name") or template_data.get("name"))
        created = 0

        def money(value):
            try:
                amount = float(value)
            except (TypeError, ValueError):
                return "On request"
            if not (amount > 0):
                return "On request"
            if abs(amount - round(amount)) < 0.00001:
                return f"₹{int(round(amount)):,}"
            return f"₹{amount:,.2f}".rstrip("0").rstrip(".")

        def replace_row_value(page, labels, value):
            label_pattern = "|".join(re.escape(label) for label in labels)
            pattern = (
                r'(<div\b[^>]*class=["\'][^"\']*\bpdp-row\b[^"\']*["\'][^>]*>'
                r'\s*<strong>\s*(?:' + label_pattern + r')\s*</strong>\s*<span>)(.*?)(</span>)'
            )
            return re.sub(
                pattern,
                lambda match: match.group(1) + html_module.escape(str(value), quote=False) + match.group(3),
                page,
                count=1,
                flags=re.I | re.S,
            )

        for product in missing_products:
            slug = text(product.get("slug"))
            product_id = text(product.get("id"))
            name = text(product.get("product_name") or product.get("name"))
            brand = text(product.get("brand_name") or product.get("brand"))
            category = text(product.get("category_name") or product.get("category"))
            subcategory = text(product.get("subcategory_name") or product.get("subcategory"))
            part = part_number(product)
            description = text(product.get("description"))
            applications = arr(product.get("applications"))
            vehicles = arr(product.get("vehicles"))

            # Start with a known-good localized PDP shell, then replace its
            # embedded record with canonical catalogue fields before normalizers run.
            page = template_html
            if old_name:
                page = replace_product_name_markup(page, old_name, name)
            if old_slug:
                page = page.replace(old_slug, slug)
            if old_id and product_id:
                page = page.replace(old_id, product_id)

            seeded = dict(template_data)
            seeded.update(product_from_catalogue(product))
            seeded["seo"] = dict(template_data.get("seo") or {})
            seeded["seo"]["canonical"] = f"{BASE}/{lang}/products/{slug}"
            seeded["seo"]["title"] = f"{brand} - {part} - {name} | Souviks" if brand and part else f"{brand or name} | Souviks"
            seeded["seo"]["description"] = build_product_meta_description(product, language=lang)
            seeded["seo"]["keywords"] = [value for value in (name, part, "commercial vehicle spare parts", "truck spare parts") if value]
            seeded["schema"] = {}
            seeded["created_at"] = text(product.get("created_at") or template_data.get("created_at"))
            seeded["updated_at"] = text(product.get("updated_at") or product.get("catalogue_updated_at"))
            seeded["manufacturer_part_number"] = text(product.get("manufacturer_part_number"))
            seeded["manufacturer_part_numbers"] = list(product.get("manufacturer_part_numbers") or ([seeded["manufacturer_part_number"]] if seeded["manufacturer_part_number"] else []))

            # Bring visible PDP identity fields across with the embedded data.
            page = replace_row_value(page, ("Part Number", "भाग संख्या", "पार्ट नंबर", "পার্ট নম্বর", "পার্ট নং"), part or "Available on request")
            page = replace_row_value(page, ("Brand", "ब्रांड", "ব্র্যান্ড"), brand or "—")
            page = replace_row_value(page, ("Category", "श्रेणी", "विभाग", "বিভাগ", "ক্যাটাগরি"), category or "—")
            page = replace_row_value(page, ("Sub Category", "Subcategory", "उपश्रेणी", "उप-विभाग", "উপ-বিভাগ", "উপবিভাগ"), subcategory or "—")
            page = replace_row_value(page, ("Applications", "अनुप्रयोग", "एप्लिकेशन", "অ্যাপ্লিকেশন"), ", ".join(applications) if applications else "Confirm by part number")
            page = replace_row_value(page, ("Compatible Vehicles", "संगत वाहन", "उपयुक्त वाहन", "সামঞ্জস্যপূর্ণ গাড়ি", "উপযুক্ত গাড়ি"), ", ".join(vehicles) if vehicles else "Confirm vehicle application")

            # Replace the visible price values in MRP-then-selling-price order.
            price_re = re.compile(
                r'(<span\b[^>]*class=["\'][^"\']*\bpdp-price-value\b[^"\']*["\'][^>]*>)(.*?)(</span>)',
                flags=re.I | re.S,
            )
            price_values = iter((money(product.get("mrp")), money(product.get("selling_price"))))
            page = price_re.sub(
                lambda match: match.group(1) + next(price_values, "On request") + match.group(3),
                page,
                count=2,
            )
            try:
                mrp_value = float(product.get("mrp"))
                selling_value = float(product.get("selling_price"))
            except (TypeError, ValueError):
                mrp_value = selling_value = 0.0
            if mrp_value and selling_value and selling_value < mrp_value:
                discount = round((mrp_value - selling_value) / mrp_value * 100)
                page = re.sub(
                    r'(<span\b[^>]*class=["\'][^"\']*\bpdp-price-discount\b[^"\']*["\'][^>]*>).*?(</span>)',
                    lambda match: match.group(1) + f"{discount}% OFF" + match.group(2),
                    page,
                    count=1,
                    flags=re.I | re.S,
                )
            else:
                page = re.sub(
                    r'<span\b[^>]*class=["\'][^"\']*\bpdp-price-discount\b[^"\']*["\'][^>]*>.*?</span>',
                    "",
                    page,
                    count=1,
                    flags=re.I | re.S,
                )

            # Align the static description and application list so the page is
            # meaningful even before JavaScript enhancement has run.
            page = re.sub(
                r'(<div\s+class=["\']pdp-description-card["\']>\s*<h3>\s*Description\s*</h3>\s*<p>).*?(</p>)',
                lambda match: match.group(1) + html_module.escape(description, quote=False) + match.group(2),
                page,
                count=1,
                flags=re.I | re.S,
            )
            application_items = "".join(
                f"<li>{html_module.escape(item, quote=False)}</li>" for item in applications
            ) or "<li>Confirm by part number</li>"
            page = re.sub(
                r'(<div\s+class=["\']pdp-description-card["\']>\s*<h3>\s*(?:Applications|अनुप्रयोग|অ্যাপ্লিকেশন)\s*</h3>\s*<ul>).*?(</ul>)',
                lambda match: match.group(1) + application_items + match.group(2),
                page,
                count=1,
                flags=re.I | re.S,
            )

            vehicle_cards = "".join(
                '<div class="pdp-vehicle-card"><div class="pdp-vehicle-image">'
                f'<img src="/assets/images/placeholder.webp" alt="{html_module.escape(vehicle, quote=True)}" width="1200" height="1200">'
                '</div><div class="pdp-vehicle-content">'
                f'<h4>{html_module.escape(vehicle, quote=False)}</h4></div></div>'
                for vehicle in vehicles
            ) or '<p class="pdp-empty-state">Confirm vehicle application before ordering.</p>'
            page = re.sub(
                r'(<div\s+class=["\']pdp-vehicle-grid["\']\s*>).*?(</div>\s*</section>)',
                lambda match: match.group(1) + vehicle_cards + match.group(2),
                page,
                count=1,
                flags=re.I | re.S,
            )

            # Regenerated PDPs may inherit the shell's former product brand logo.
            # Always bind the brand badge to the target catalogue record, not the
            # template page that happened to be selected as a shell.
            brand_id = text(product.get("brand_id")).casefold()
            brands_path = ROOT / "assets/data/brands.json"
            brands_by_id = {
                text(item.get("id")).casefold(): item
                for item in json.loads(brands_path.read_text(encoding="utf-8"))
                if isinstance(item, dict) and text(item.get("id"))
            }
            brand_record = brands_by_id.get(brand_id, {})
            brand_logo = text(brand_record.get("logo"))
            if brand_logo:
                def sync_brand_badge(badge_match):
                    opening, inner, closing = badge_match.group(1), badge_match.group(2), badge_match.group(3)
                    if not re.search(r"<img\b", inner, flags=re.I):
                        inner = (
                            f'<img src="{html_module.escape(brand_logo, quote=True)}" '
                            f'alt="{html_module.escape(brand, quote=True)}" loading="lazy" '
                            'decoding="async" width="56" height="56">'
                        )
                    else:
                        inner = re.sub(
                            r'\bsrc\s*=\s*(["\'])[^"\']*\1',
                            lambda _: f'src="{html_module.escape(brand_logo, quote=True)}"',
                            inner,
                            count=1,
                            flags=re.I,
                        )
                        if re.search(r'\balt\s*=', inner, flags=re.I):
                            inner = re.sub(
                                r'\balt\s*=\s*(["\'])[^"\']*\1',
                                lambda _: f'alt="{html_module.escape(brand, quote=True)}"',
                                inner,
                                count=1,
                                flags=re.I,
                            )
                        else:
                            inner = re.sub(
                                r"<img\b",
                                lambda m: m.group(0) + f' alt="{html_module.escape(brand, quote=True)}"',
                                inner,
                                count=1,
                                flags=re.I,
                            )
                    return opening + inner + closing

                page, _ = re.subn(
                    r'(<div\b[^>]*class=["\'][^"\']*\bpdp-brand-badge\b[^"\']*["\'][^>]*>)(.*?)(</div>)',
                    sync_brand_badge,
                    page,
                    count=1,
                    flags=re.I | re.S,
                )

            # Remove unrelated vehicle placeholder photos from regenerated PDPs.
            # Keep the vehicle names and fitment information, but don't present a
            # generic placeholder as if it were vehicle-specific imagery.
            vehicle_grid = (
                '<div class="pdp-vehicle-grid">'
                + ''.join(
                    '<div class="pdp-vehicle-card"><div class="pdp-vehicle-content">'
                    f'<h4>{html_module.escape(vehicle, quote=False)}</h4>'
                    '</div></div>'
                    for vehicle in vehicles
                )
                + '</div>'
            ) if vehicles else '<p class="pdp-empty-state">Confirm vehicle application before ordering.</p>'
            page = re.sub(
                r'<div\s+class=["\']pdp-vehicle-grid["\']\s*>.*?</div>\s*</section>',
                lambda _: vehicle_grid + '</section>',
                page,
                count=1,
                flags=re.I | re.S,
            )

            # Keep the primary image and alt text tied to this product.
            primary_image = text(seeded.get("image_url"))
            page = re.sub(
                r'(<img\b[^>]*\bid=["\']pdpMainImage["\'][^>]*\bsrc=["\'])[^"\']*(["\'])',
                lambda match: match.group(1) + primary_image + match.group(2),
                page,
                count=1,
                flags=re.I,
            )
            page = re.sub(
                r'(<img\b[^>]*\bid=["\']pdpMainImage["\'][^>]*\balt=["\'])[^"\']*(["\'])',
                lambda match: match.group(1) + html_module.escape(name, quote=True) + match.group(2),
                page,
                count=1,
                flags=re.I,
            )

            data_match = data_pattern.search(page)
            if not data_match:
                raise SystemExit(f"Generated PDP template has no embedded data: {template_path}")
            page = page[:data_match.start(1)] + json.dumps(seeded, ensure_ascii=False, indent=2) + page[data_match.end(1):]

            target_path = product_dir / f"{slug}.html"
            if target_path.exists():
                raise SystemExit(f"Refusing to overwrite an existing PDP while generating: {target_path}")
            target_path.write_text(page, encoding="utf-8")
            created += 1

        if created:
            print(f"Generated {created} missing {lang} product pages from the canonical catalogue.")
        return created

    for lang in ("en", "hi", "bn"):
        product_dir = ROOT / lang / "products"
        materialize_missing_product_pages(lang, product_dir)
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
    
            # Keep full factual copy in the page and Product JSON-LD, while
            # using a separate, concise description for search-result snippets.
            content_description = build_product_schema_description(product)
            description = build_product_meta_description(product, language=lang)
            seo_description = content_description
    
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
    
            html = html[:match.start()] + "window.SOUVIKS_PRODUCT_PAGE_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";" + html[match.end():]
            if old_name and old_name != name:
                html = replace_product_name_markup(html, old_name, name)

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
            # Replace the entire tag so legacy trailing fragments from malformed quoted titles are removed.
            html = re.sub(
                r'<meta\b(?=[^>]*\bproperty=["\']og:title["\'])[^>]*>',
                lambda _: f'<meta\n        property="og:title"\n        content="{title_attr}">',
                html,
                count=1,
                flags=re.I,
            )
            html = re.sub(
                r'<meta\b(?=[^>]*\bname=["\']twitter:title["\'])[^>]*>',
                lambda _: f'<meta\n        name="twitter:title"\n        content="{title_attr}">',
                html,
                count=1,
                flags=re.I,
            )
            html = re.sub(
                r'<meta\b(?=[^>]*\bname=["\']description["\'])[^>]*>',
                lambda _: f'<meta\n        name="description"\n        content="{description_attr}">',
                html, count=1, flags=re.I
            )
            html = re.sub(
                r'<meta\b(?=[^>]*\bproperty=["\']og:description["\'])[^>]*>',
                lambda _: f'<meta\n        property="og:description"\n        content="{description_attr}">',
                html, count=1, flags=re.I
            )
            html = re.sub(
                r'<meta\b(?=[^>]*\bname=["\']twitter:description["\'])[^>]*>',
                lambda _: f'<meta\n        name="twitter:description"\n        content="{description_attr}">',
                html, count=1, flags=re.I
            )
            html = re.sub(r'(<link\s+rel=["\']canonical["\']\s+href=["\'])[^"\']*(["\'])', lambda m: m.group(1) + canonical + m.group(2), html, count=1, flags=re.I)
            html = re.sub(r'(<meta\s+property=["\']og:url["\']\s+content=["\'])[^"\']*(["\'])', lambda m: m.group(1) + canonical + m.group(2), html, count=1, flags=re.I)
            html = re.sub(r'(<meta\s+name=["\']twitter:url["\']\s+content=["\'])[^"\']*(["\'])', lambda m: m.group(1) + canonical + m.group(2), html, count=1, flags=re.I)
            html = re.sub(
                r'(?m)(currentPage:[ \t]*\r?\n[ \t]*)[^\r\n]*',
                lambda m: m.group(1) + json.dumps(name) + ",",
                html,
                count=1,
            )
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
    
            category_name = text(product.get("category_name") or product.get("category"))
            if category_name:
                html = re.sub(
                    r'(<div class=["\']pdp-row["\']>\s*<strong>\s*(?:Category|श्रेणी|विभाग|বিভাগ|ক্যাটাগরি)\s*</strong>\s*<span>)[^<]*(</span>)',
                    lambda m: m.group(1) + html_module.escape(category_name, quote=False) + m.group(2),
                    html, count=1, flags=re.I
                )

            sub_name = text(product.get("subcategory_name") or product.get("subcategory"))
            if sub_name:
                html = re.sub(
                    r'(<div class=["\']pdp-row["\']>\s*<strong>\s*(?:Sub Category|Subcategory|उपश्रेणी|उप-विभाग|উপ-বিভাগ|উপবিভাগ)\s*</strong>\s*<span>)[^<]*(</span>)',
                    lambda m: m.group(1) + html_module.escape(sub_name, quote=False) + m.group(2),
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
        # Update product totals by the semantic product icon, not the visible
        # label. Homepage labels are localized, so matching "Products" only
        # updated English and left Hindi/Bengali counters stale.
        if name in {"en/index.html", "hi/index.html", "bn/index.html"}:
            html = re.sub(
                r'(<div\b[^>]*class=["\'][^"\']*\bhome-trust-item\b[^"\']*["\'][^>]*>.*?<img\b(?=[^>]*\bsrc=["\'][^"\']*/assets/icons/products\.svg["\'])[^>]*>.*?<strong>\s*)\d[\d,]*\+(\s*</strong>)',
                lambda m: m.group(1) + f"{count}+" + m.group(2),
                html,
                count=1,
                flags=re.I | re.S,
            )
        elif name in {"en/about.html", "hi/about.html", "bn/about.html"}:
            html = re.sub(
                r'(<div\b[^>]*class=["\'][^"\']*\bhero-stat\b[^"\']*["\'][^>]*>.*?<img\b(?=[^>]*\bsrc=["\'][^"\']*/assets/icons/products\.svg["\'])[^>]*>.*?<div\b[^>]*class=["\'][^"\']*\bstat-number\b[^"\']*["\'][^>]*>\s*)\d[\d,]*(\s*</div>)',
                lambda m: m.group(1) + str(count) + m.group(2),
                html,
                count=1,
                flags=re.I | re.S,
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
    brand_records = json.loads((root / "assets/data/brands.json").read_text(encoding="utf-8"))
    brands_by_id = {
        str(item.get("id") or "").strip().casefold(): item
        for item in brand_records
        if isinstance(item, dict) and str(item.get("id") or "").strip()
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
                # Product pages are sometimes cloned from an unrelated active
                # PDP shell. Rebind the brand badge to this product's canonical
                # brand record so a Toyo page cannot retain a JAI logo.
                brand_id = str(product.get("brand_id") or "").strip().casefold()
                brand_record = brands_by_id.get(brand_id, {})
                brand_logo = str(brand_record.get("logo") or "").strip()
                brand_name = str(product.get("brand_name") or product.get("brand") or "").strip()
                if brand_logo and brand_name:
                    def sync_brand_badge(badge_match):
                        opening, inner, closing = badge_match.group(1), badge_match.group(2), badge_match.group(3)
                        if not re.search(r"<img\b", inner, flags=re.I):
                            inner = (
                                f'<img src="{html_module.escape(brand_logo, quote=True)}" '
                                f'alt="{html_module.escape(brand_name, quote=True)}" '
                                'loading="lazy" decoding="async" width="56" height="56">'
                            )
                        else:
                            inner = re.sub(
                                r'\bsrc\s*=\s*(["\'])[^"\']*\1',
                                lambda _: f'src="{html_module.escape(brand_logo, quote=True)}"',
                                inner,
                                count=1,
                                flags=re.I,
                            )
                            if re.search(r'\balt\s*=', inner, flags=re.I):
                                inner = re.sub(
                                    r'\balt\s*=\s*(["\'])[^"\']*\1',
                                    lambda _: f'alt="{html_module.escape(brand_name, quote=True)}"',
                                    inner,
                                    count=1,
                                    flags=re.I,
                                )
                            else:
                                inner = re.sub(
                                    r"<img\b",
                                    lambda m: m.group(0) + f' alt="{html_module.escape(brand_name, quote=True)}"',
                                    inner,
                                    count=1,
                                    flags=re.I,
                                )
                        return opening + inner + closing

                    text, badge_count = re.subn(
                        r'(<div\b[^>]*class=["\'][^"\']*\bpdp-brand-badge\b[^"\']*["\'][^>]*>)(.*?)(</div>)',
                        sync_brand_badge,
                        text,
                        count=1,
                        flags=re.I | re.S,
                    )
                    # The visible breadcrumb must follow the target product's brand,
                    # not the brand from the static PDP shell being repaired.
                    brand_slug = str(brand_record.get("slug") or brand_id).strip()
                    brand_url = f"{BASE}/{lang}/brands/{brand_slug}" if brand_slug else ""
                    if brand_url:
                        text, _ = re.subn(
                            r'(<li\b[^>]*class=["\'][^"\']*\bbreadcrumb-item\b[^"\']*["\'][^>]*>\s*'
                            r'<a\b[^>]*href=["\'])[^"\']*/brands/[^"\']*(["\'][^>]*>).*?(</a>\s*</li>)',
                            lambda match: (
                                match.group(1)
                                + html_module.escape(brand_url, quote=True)
                                + match.group(2)
                                + html_module.escape(brand_name, quote=False)
                                + match.group(3)
                            ),
                            text,
                            count=1,
                            flags=re.I | re.S,
                        )

                    # Some valid PDP templates intentionally have no badge.
                    # Update it when present; absence alone must not abort a build.

                # The vehicle list is catalogue context, not a product photo gallery.
                # Avoid showing a generic placeholder image as if it depicts a
                # specific vehicle; keep each mapped vehicle name visible.
                vehicle_names = [
                    str(vehicle).strip()
                    for vehicle in (product.get("vehicles") or [])
                    if str(vehicle).strip()
                ]
                vehicle_cards = (
                    '<div class="pdp-vehicle-grid">'
                    + ''.join(
                        '<div class="pdp-vehicle-card"><div class="pdp-vehicle-content">'
                        f'<h4>{html_module.escape(vehicle, quote=False)}</h4>'
                        '</div></div>'
                        for vehicle in vehicle_names
                    )
                    + '</div>'
                ) if vehicle_names else '<p class="pdp-empty-state">Confirm vehicle application before ordering.</p>'
                text = re.sub(
                    r'(<div\s+class=["\']pdp-vehicle-grid["\']\s*>).*?(</div>\s*</section>)',
                    lambda m: m.group(1) + vehicle_cards + m.group(2),
                    text,
                    count=1,
                    flags=re.I | re.S,
                )

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
                r'(<div\b[^>]*class=["\'][^"\']*\bpdp-thumbnails\b[^"\']*["\'][^>]*>)(.*?)(</div>)',
                text,
                flags=re.I | re.S,
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
                replacement = thumb_match.group(1) + "".join(thumbs) + thumb_match.group(3)
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
                r'\bdata-saved-product-id\s*=\s*(["\'])(.*?)\1|\bdata-id\s*=\s*(["\'])(.*?)\3',
                card,
                flags=re.I,
            )
            product_id = ""
            if id_match:
                product_id = str(id_match.group(2) or id_match.group(4) or "").strip()
            product = products.get(product_id) if product_id else None

            # Product-card markup is generated catalogue output. Never publish a stale
            # card whose product is inactive/unknown, or one that cannot map to a slug.
            if not product:
                return ""
            slug = str(product.get("slug") or "").strip()
            if not slug:
                return ""

            relative_parts = path.relative_to(root).parts
            language = relative_parts[0] if relative_parts and relative_parts[0] in {"en", "hi", "bn"} else "en"
            canonical_product_url = f"/{language}/products/{slug}"

            def refresh_product_link(anchor_match):
                anchor = anchor_match.group(0)
                href_match = re.search(
                    r'\bhref\s*=\s*(["\'])(.*?)\1',
                    anchor,
                    flags=re.I,
                )
                if not href_match or not re.match(
                    r"^/(?:en|hi|bn)/products(?:/|$)",
                    href_match.group(2),
                    flags=re.I,
                ):
                    return anchor
                start_href, end_href = href_match.span(2)
                return (
                    anchor[:start_href]
                    + canonical_product_url
                    + anchor[end_href:]
                )

            card = re.sub(r"<a\b[^>]*>", refresh_product_link, card, flags=re.I)

            gallery = product.get("gallery")
            if isinstance(gallery, list) and gallery:
                gallery = [str(name).strip() for name in gallery if str(name).strip()]
            else:
                gallery = []

            if gallery:
                src = image_url(product, gallery[0])
                image_state = "catalogue"
            else:
                src = str(product.get("image_url") or "/assets/images/placeholder.webp").strip()
                image_state = "missing"

            if not src:
                src = "/assets/images/placeholder.webp"
                image_state = "missing"

            def update_image(image_match):
                attrs = image_match.group(0)
                attrs = re.sub(r'\sloading\s*=\s*(["\']).*?\1', "", attrs, flags=re.I)
                attrs = re.sub(r'\sfetchpriority\s*=\s*(["\']).*?\1', "", attrs, flags=re.I)
                attrs = re.sub(r'\sdata-image-state\s*=\s*(["\']).*?\1', "", attrs, flags=re.I)
                attrs = re.sub(r'\ssrc\s*=\s*(["\']).*?\1', "", attrs, flags=re.I)

                if is_products_listing and card_index <= 4:
                    loading_attrs = 'loading="eager" fetchpriority="high"'
                else:
                    loading_attrs = 'loading="lazy"'

                state_attr = html_module.escape(image_state, quote=True)
                src_attr = html_module.escape(src, quote=True)
                return attrs.replace(
                    "<img ",
                    f'<img {loading_attrs} data-image-state="{state_attr}" src="{src_attr}" ',
                    1,
                )

            return re.sub(
                r'<img\b(?=[^>]*\bclass\s*=\s*["\'][^"\']*\bproduct-image-file\b[^"\']*["\'])[^>]*>',
                update_image,
                card,
                count=1,
                flags=re.I | re.S,
            )

        text = re.sub(
            r'<article\b(?=[^>]*\bclass\s*=\s*["\'][^"\']*\bproduct-card\b[^"\']*["\'])[^>]*>.*?</article>',
            refresh_card,
            text,
            flags=re.I | re.S,
        )
    
        if text != original:
            path.write_text(text, encoding="utf-8")
            if str(path) not in changed:
                changed.append(str(path))
    
    if not changed:
        print("Static product image markup is already synchronized.")
    else:
        print(f"Synchronized static product images in {len(changed)} HTML files.")


def sync_static_product_taxonomy_and_recommendations():
    """Reconcile PDP taxonomy breadcrumbs and recommendation cards from catalogue masters."""
    import html as html_module
    import json
    import re

    from product_card import product_card_html

    catalogue = json.loads((ROOT / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
    categories = json.loads((ROOT / "assets/data/categories.json").read_text(encoding="utf-8"))
    active_products = [
        item for item in catalogue
        if isinstance(item, dict) and item.get("active") is not False and item.get("id")
    ]
    products_by_id = {str(item.get("id")): item for item in active_products}
    categories_by_id = {
        str(item.get("id") or "").strip(): item
        for item in categories
        if isinstance(item, dict) and item.get("active") is not False and item.get("id")
    }

    def clean(value):
        return str(value or "").strip()

    def arrayish(value):
        if isinstance(value, list):
            return [clean(item) for item in value if clean(item)]
        return [item.strip() for item in re.split(r"[,;]", clean(value)) if item.strip()]

    def tokens(value):
        normalized = re.sub(
            r"[^a-z0-9\u0900-\u097f\u0980-\u09ff]+",
            " ",
            clean(value).casefold(),
        )
        return {token for token in normalized.split() if len(token) >= 3}

    def overlap(left_values, right_values):
        left = set()
        right = set()
        for value in (left_values if isinstance(left_values, list) else [left_values]):
            left.update(tokens(value))
        for value in (right_values if isinstance(right_values, list) else [right_values]):
            right.update(tokens(value))
        return len(left & right)

    def has_usable_media(item):
        if not item or re.search(r"placeholder|coming soon|image unavailable", clean(item.get("product_name")), re.I):
            return False
        folder = clean(item.get("image_folder"))
        gallery = [
            clean(value) for value in item.get("gallery", [])
            if clean(value)
        ] if isinstance(item.get("gallery"), list) else []
        primary = clean(item.get("primary_image"))
        image_url = clean(item.get("image_url"))
        if folder and (gallery or primary):
            return True
        return bool(image_url and "/assets/images/placeholder.webp" not in image_url)

    def recommendation_score(product, candidate):
        product_vehicles = [value.casefold() for value in arrayish(product.get("vehicles"))]
        candidate_vehicles = [value.casefold() for value in arrayish(candidate.get("vehicles"))]
        shared_vehicles = len(set(product_vehicles) & set(candidate_vehicles))
        shared_applications = overlap(product.get("applications"), candidate.get("applications"))
        name_overlap = overlap(
            [product.get("product_name"), product.get("subcategory_name")],
            [candidate.get("product_name"), candidate.get("subcategory_name")],
        )
        score = shared_vehicles * 40
        score += min(shared_applications, 3) * 15
        score += name_overlap * 4
        if candidate.get("subcategory_id") == product.get("subcategory_id"):
            score += 30
        if candidate.get("category_id") == product.get("category_id"):
            score += 10
        if candidate.get("brand_id") == product.get("brand_id"):
            score += 8
        if candidate.get("featured") is True:
            score += 2
        return score, shared_vehicles, shared_applications

    def recommendations(product):
        current_vehicle_set = set(arrayish(product.get("vehicles")))
        frequent_scored = []
        for index, candidate in enumerate(active_products):
            if candidate.get("id") == product.get("id") or not has_usable_media(candidate):
                continue
            candidate_vehicles = arrayish(candidate.get("vehicles"))
            if not any(vehicle in current_vehicle_set for vehicle in candidate_vehicles):
                continue
            score, shared_vehicles, shared_applications = recommendation_score(product, candidate)
            frequent_scored.append((
                candidate, index, score, shared_vehicles, shared_applications
            ))
        frequent_scored.sort(key=lambda row: (
            -row[2], -row[3], -row[4],
            clean(row[0].get("product_name")).casefold(), row[1]
        ))
        frequent = [row[0] for row in frequent_scored[:6]]
        frequent_ids = {clean(item.get("id")) for item in frequent}

        related_scored = []
        for index, candidate in enumerate(active_products):
            if (
                candidate.get("id") == product.get("id")
                or clean(candidate.get("id")) in frequent_ids
                or candidate.get("category_id") != product.get("category_id")
                or not has_usable_media(candidate)
            ):
                continue
            score, _, _ = recommendation_score(product, candidate)
            same_subcategory_first = 0 if candidate.get("subcategory_id") == product.get("subcategory_id") else 1
            related_scored.append((
                candidate, index, score, same_subcategory_first
            ))
        related_scored.sort(key=lambda row: (
            -row[2], row[3], clean(row[0].get("product_name")).casefold(), row[1]
        ))
        return frequent, [row[0] for row in related_scored[:6]]

    def replace_div_contents(source, class_token, replacement):
        opening = re.search(
            r'<div\b(?=[^>]*\bclass=["\'][^"\']*\b'
            + re.escape(class_token)
            + r'\b[^"\']*["\'])[^>]*>',
            source,
            flags=re.I | re.S,
        )
        if not opening:
            return source
        depth = 1
        tag_pattern = re.compile(r"</?div\b[^>]*>", flags=re.I | re.S)
        for tag in tag_pattern.finditer(source, opening.end()):
            if tag.group(0).lstrip().startswith("</"):
                depth -= 1
            else:
                depth += 1
            if depth == 0:
                return source[:opening.end()] + replacement + source[tag.start():]
        return source

    def sync_visible_taxonomy(page_html, lang, category, subcategory):
        category_name = clean(category.get("name"))
        category_slug = clean(category.get("slug") or category.get("id"))
        category_url = f"{BASE}/{lang}/categories/{category_slug}"
        category_row = re.compile(
            r'(<div\b[^>]*class=["\'][^"\']*\bpdp-row\b[^"\']*["\'][^>]*>\s*'
            r'<strong>\s*(?:Category|श्रेणी|বিভাগ)\s*</strong>\s*<span>)(.*?)(</span>\s*</div>)',
            flags=re.I | re.S,
        )
        page_html, _ = category_row.subn(
            lambda match: match.group(1) + html_module.escape(category_name) + match.group(3),
            page_html,
            count=1,
        )

        if subcategory:
            subcategory_name = clean(subcategory.get("name"))
            subcategory_row = re.compile(
                r'(<div\b[^>]*class=["\'][^"\']*\bpdp-row\b[^"\']*["\'][^>]*>\s*'
                r'<strong>\s*(?:Sub\s*Category|उपश्रेणी|उप श्रेणी|উপবিভাগ|উপশ্রেণি)\s*</strong>\s*<span>)(.*?)(</span>\s*</div>)',
                flags=re.I | re.S,
            )
            page_html, _ = subcategory_row.subn(
                lambda match: match.group(1) + html_module.escape(subcategory_name) + match.group(3),
                page_html,
                count=1,
            )

        category_crumb = (
            '<li class="breadcrumb-item"><a href="'
            + html_module.escape(category_url, quote=True)
            + '">'
            + html_module.escape(category_name)
            + '</a></li>'
        )
        crumb_pattern = re.compile(
            r'(<li\b[^>]*class=["\'][^"\']*\bbreadcrumb-item\b[^"\']*["\'][^>]*>)\s*'
            r'<a\b(?=[^>]*href=["\'][^"\']*/categories/)[^>]*>.*?</a>\s*(</li>)',
            flags=re.I | re.S,
        )
        page_html, crumb_count = crumb_pattern.subn(
            lambda match: match.group(1) + category_crumb[len('<li class="breadcrumb-item">'):-5] + match.group(2),
            page_html,
            count=1,
        )
        if not crumb_count:
            brand_crumb = re.search(
                r'<li\b[^>]*class=["\'][^"\']*\bbreadcrumb-item\b[^"\']*["\'][^>]*>\s*'
                r'<a\b(?=[^>]*href=["\'][^"\']*/brands/)[^>]*>.*?</a>\s*</li>',
                page_html,
                flags=re.I | re.S,
            )
            if brand_crumb:
                page_html = page_html[:brand_crumb.start()] + category_crumb + page_html[brand_crumb.start():]
        return page_html, category_url, category_name

    changed_files = []
    for lang in ("en", "hi", "bn"):
        directory = ROOT / lang / "products"
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.html")):
            page_html = path.read_text(encoding="utf-8")
            original = page_html
            data_match = re.search(
                r'window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});',
                page_html,
                flags=re.S,
            )
            if not data_match:
                continue
            try:
                embedded = json.loads(data_match.group(1))
            except json.JSONDecodeError:
                continue
            product = products_by_id.get(clean(embedded.get("id")))
            if not product:
                continue

            category_id = clean(product.get("category_id"))
            category = categories_by_id.get(category_id)
            if not category:
                continue
            subcategory_id = clean(product.get("subcategory_id"))
            subcategory = next(
                (
                    item for item in category.get("subcategories", [])
                    if isinstance(item, dict) and clean(item.get("id")) == subcategory_id
                ),
                None,
            )
            category_name = clean(category.get("name"))
            subcategory_name = clean(subcategory.get("name")) if subcategory else clean(product.get("subcategory_name"))

            refreshed = dict(embedded)
            refreshed["category_id"] = category_id
            refreshed["category_name"] = category_name
            refreshed["category"] = category_name
            if subcategory:
                refreshed["subcategory_id"] = subcategory_id
                refreshed["subcategory_name"] = subcategory_name
                refreshed["subcategory"] = subcategory_name
            new_data = json.dumps(refreshed, ensure_ascii=False, separators=(",", ":"))
            page_html = page_html[:data_match.start(1)] + new_data + page_html[data_match.end(1):]

            page_html, category_url, category_name = sync_visible_taxonomy(
                page_html, lang, category, subcategory
            )

            # Rebuild every BreadcrumbList from the authoritative category assignment.
            breadcrumb_replacements = []
            block_pattern = re.compile(
                r'(<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>)(.*?)(</script>)',
                flags=re.I | re.S,
            )
            for match in block_pattern.finditer(page_html):
                try:
                    schema = json.loads(match.group(2).strip())
                except json.JSONDecodeError:
                    continue
                graph = schema.get("@graph") if isinstance(schema, dict) else None
                nodes = graph if isinstance(graph, list) else [schema]
                schema_changed = False
                for node in nodes:
                    if not isinstance(node, dict) or node.get("@type") != "BreadcrumbList":
                        continue
                    items = node.get("itemListElement")
                    if not isinstance(items, list):
                        continue
                    category_items = [
                        item for item in items
                        if isinstance(item, dict) and "/categories/" in clean(item.get("item"))
                    ]
                    if category_items:
                        first = category_items[0]
                        if first.get("name") != category_name or first.get("item") != category_url:
                            first["name"] = category_name
                            first["item"] = category_url
                            schema_changed = True
                        if len(category_items) > 1:
                            items[:] = [item for item in items if item not in category_items[1:]]
                            schema_changed = True
                    else:
                        insert_at = next(
                            (
                                index + 1 for index, item in enumerate(items)
                                if isinstance(item, dict)
                                and clean(item.get("name")).casefold() in {"products", "उत्पाद", "পণ্যসমূহ"}
                            ),
                            1 if items else 0,
                        )
                        items.insert(insert_at, {
                            "@type": "ListItem",
                            "position": insert_at + 1,
                            "name": category_name,
                            "item": category_url,
                        })
                        schema_changed = True
                    for index, item in enumerate(items, start=1):
                        if isinstance(item, dict) and item.get("position") != index:
                            item["position"] = index
                            schema_changed = True
                if schema_changed:
                    breadcrumb_replacements.append((
                        match.start(),
                        match.end(),
                        match.group(1) + "\n" + json.dumps(schema, ensure_ascii=False, indent=2) + "\n" + match.group(3),
                    ))
            for start, end, replacement in reversed(breadcrumb_replacements):
                page_html = page_html[:start] + replacement + page_html[end:]

            frequent, related = recommendations(product)
            frequent_html = "".join(product_card_html(item, lang) for item in frequent)
            related_html = "".join(product_card_html(item, lang) for item in related)
            page_html = replace_div_contents(page_html, "pdp-frequent-slider", frequent_html)
            page_html = replace_div_contents(page_html, "pdp-related-slider-main", related_html)

            if page_html != original:
                path.write_text(page_html, encoding="utf-8")
                changed_files.append(str(path.relative_to(ROOT)))

    if not changed_files:
        print("Product PDP taxonomy and recommendation markup are already synchronized.")
    else:
        print(
            "Synchronized taxonomy breadcrumbs and catalogue-based recommendations in "
            f"{len(changed_files)} product pages across en/hi/bn."
        )


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

    brand_records = json.loads((root / "assets/data/brands.json").read_text(encoding="utf-8"))
    brands_by_id = {
        str(item.get("id") or "").strip().casefold(): item
        for item in brand_records
        if isinstance(item, dict) and str(item.get("id") or "").strip()
    }

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

            # Keep Product structured data aligned with the full factual page copy.
            schema_description = build_product_schema_description(product)

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
                    offer = {
                        "@type": "Offer",
                        "url": url,
                        "priceCurrency": "INR",
                        "price": numeric_price,
                        "seller": {
                            "@type": "Organization",
                            "name": "Souviks",
                        },
                    }
                    explicit_availability = schema_availability_url(product)
                    if explicit_availability:
                        offer["availability"] = explicit_availability
                    product_schema["offers"] = offer
    
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

                    # Refresh identifiers on legacy Product nodes too. The old
                    # repair path updated other schema fields but left stale or
                    # blank MPNs untouched.
                    mpn = str(
                        product.get("manufacturer_part_number")
                        or product.get("part_number")
                        or product.get("partNumber")
                        or ""
                    ).strip()
                    if mpn:
                        node["mpn"] = re.sub(r"\s+", " ", mpn)
                    else:
                        node.pop("mpn", None)

                    identifiers = []
                    for value in (
                        product.get("part_number"),
                        product.get("manufacturer_part_number"),
                        *(product.get("manufacturer_part_numbers") or []),
                    ):
                        value = re.sub(r"\s+", " ", str(value or "").strip())
                        if value and value not in identifiers:
                            identifiers.append(value)
                    if identifiers:
                        node["identifier"] = [
                            {"propertyID": "part_number", "value": value}
                            for value in identifiers
                        ]
                    else:
                        node.pop("identifier", None)

                    offers = node.get("offers") if isinstance(node.get("offers"), dict) else {}
                    offers["@type"] = "Offer"
                    offers["url"] = url
                    offers["priceCurrency"] = "INR"
                    explicit_availability = schema_availability_url(product)
                    if explicit_availability:
                        offers["availability"] = explicit_availability
                    else:
                        # Never retain a stock claim that is not supported by
                        # the current product catalogue record.
                        offers.pop("availability", None)
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
                    if isinstance(items, list) and items and isinstance(items[0], dict):
                        home_url = f"{BASE}/" if lang == "en" else f"{BASE}/{lang}/"
                        if items[0].get("item") != home_url:
                            items[0]["item"] = home_url
                            updated = True
                    if isinstance(items, list) and items and isinstance(items[-1], dict):
                        if items[-1].get("item") != url:
                            items[-1]["item"] = url
                            updated = True

                    # A generated PDP must breadcrumb to its canonical brand,
                    # not the brand belonging to a copied template page.
                    brand_id = text(product.get("brand_id")).casefold()
                    brand_record = brands_by_id.get(brand_id, {})
                    brand_name = text(product.get("brand_name") or product.get("brand"))
                    brand_slug = text(brand_record.get("slug") or brand_id)
                    brand_url = f"{BASE}/{lang}/brands/{brand_slug}" if brand_slug else ""
                    if isinstance(items, list) and brand_name and brand_url:
                        for crumb in items:
                            if not isinstance(crumb, dict):
                                continue
                            crumb_url = text(crumb.get("item"))
                            if "/brands/" not in crumb_url:
                                continue
                            if crumb.get("name") != brand_name:
                                crumb["name"] = brand_name
                                updated = True
                            if crumb_url != brand_url:
                                crumb["item"] = brand_url
                                updated = True
                if updated:
                    breadcrumb_repaired.append(
                        (
                            match.start(),
                            match.end(),
                            '<script type="application/ld+json">\n'
                            + json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
                            + '\n</script>'
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
                            "item": f"{BASE}/" if lang == "en" else f"{BASE}/{lang}/",
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

                # Product offers use a nested seller Organization rather than
                # a publisher field. Add the same canonical logo there too.
                offers = node.get("offers")
                offer_nodes = offers if isinstance(offers, list) else [offers]
                for offer in offer_nodes:
                    if not isinstance(offer, dict):
                        continue
                    seller = offer.get("seller")
                    if isinstance(seller, dict) and seller.get("@type") == "Organization":
                        targets.append(seller)

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


def sync_product_listing_meta_descriptions() -> None:
    """Use distinct, useful localized descriptions on the three catalogue landing pages."""
    import html as html_module
    import re
    descriptions = {
        "en": (
            "Shop commercial vehicle spare parts at Souviks: clutch, brake, bearing, "
            "filter and lubricant components for Tata, Ashok Leyland and Eicher vehicles across India."
        ),
        "hi": (
            "Souviks पर टाटा, अशोक लेलैंड और आइशर वाहनों के लिए क्लच, ब्रेक, बेयरिंग, "
            "फ़िल्टर और लुब्रिकेंट के स्पेयर पार्ट्स खोजें। पूरे भारत में आपूर्ति।"
        ),
        "bn": (
            "Souviks-এ টাটা, অশোক লেল্যান্ড ও আইশার গাড়ির জন্য ক্লাচ, ব্রেক, বিয়ারিং, "
            "ফিল্টার ও লুব্রিকেন্টের স্পেয়ার পার্টস খুঁজুন। সারা ভারতে সরবরাহ।"
        ),
    }
    changed = 0
    for language, description in descriptions.items():
        path = ROOT / language / "products.html"
        if not path.is_file():
            continue
        html = path.read_text(encoding="utf-8")
        original = html
        value = html_module.escape(description, quote=True)
        replacements = (
            (r"<meta\b(?=[^>]*\bname=['\"]description['\"])[^>]*>",
             f'<meta name="description" content="{value}">'),
            (r"<meta\b(?=[^>]*\bproperty=['\"]og:description['\"])[^>]*>",
             f'<meta property="og:description" content="{value}">'),
            (r"<meta\b(?=[^>]*\bname=['\"]twitter:description['\"])[^>]*>",
             f'<meta name="twitter:description" content="{value}">'),
        )
        for index, (pattern, replacement) in enumerate(replacements):
            html, count = re.subn(pattern, lambda _: replacement, html, count=1, flags=re.I)
            if count == 0 and index == 0:
                html = re.sub(r"</head>", f"    {replacement}\n</head>", html, count=1, flags=re.I)
        if html != original:
            path.write_text(html, encoding="utf-8")
            changed += 1
    print(f"Localized product-listing meta descriptions synchronized in {changed} HTML files.")
def sync_active_catalogue_counts() -> None:
    """Keep server-rendered catalogue totals aligned with the active master records."""
    import json
    import re

    catalogue_path = ROOT / "assets" / "data" / "catalogue-index.json"
    catalogue = json.loads(catalogue_path.read_text(encoding="utf-8"))
    if not isinstance(catalogue, list):
        raise ValueError("catalogue-index.json must contain an array")

    active_count = sum(
        1 for product in catalogue
        if isinstance(product, dict)
        and product.get("id")
        and product.get("active") is not False
    )
    if active_count <= 0:
        raise ValueError("Refusing to write empty active catalogue counts")

    # The count shown in a hero statistic is identified semantically by the
    # Products icon, not by replacing every matching number (which could alter
    # product IDs such as SVKS001045 or unrelated category/vehicle statistics).
    hero_open = re.compile(
        r'<div\b[^>]*class=["\'][^"\']*\bhero-stat["\'][^>]*>',
        flags=re.I,
    )
    stat_number = re.compile(
        r'(<(?:div|span)\b(?=[^>]*\bclass=["\'][^"\']*\bstat-number\b)[^>]*>\s*)'
        r'\d+(\s*</(?:div|span)\s*>)',
        flags=re.I,
    )

    product_pages = (
        "en/products.html",
        "hi/products.html",
        "bn/products.html",
    )
    collection_pages = (
        "en/brands.html", "hi/brands.html", "bn/brands.html",
        "en/categories.html", "hi/categories.html", "bn/categories.html",
        "en/vehicles.html", "hi/vehicles.html", "bn/vehicles.html",
    )
    page_counts = {}

    for relative in (*product_pages, *collection_pages):
        path = ROOT / relative
        if not path.is_file():
            raise FileNotFoundError(f"Expected generated catalogue page is missing: {relative}")

        html = path.read_text(encoding="utf-8")
        original = html

        # Update only count slots whose HTML id explicitly defines the count.
        updated_ids = {}
        for element_id in ("totalProducts", "totalResults"):
            pattern = re.compile(
                r'(<(?P<tag>[a-z][\w:-]*)\b(?=[^>]*\bid=["\']'
                + re.escape(element_id)
                + r'["\'])[^>]*>\s*)'
                r'\d+'
                r'(\s*</(?P=tag)\s*>)',
                flags=re.I,
            )
            html, replacements = pattern.subn(
                lambda match: f"{match.group(1)}{active_count}{match.group(3)}",
                html,
                count=1,
            )
            updated_ids[element_id] = replacements

        if relative in product_pages:
            if updated_ids != {"totalProducts": 1, "totalResults": 1}:
                raise ValueError(
                    f"{relative}: expected exactly one totalProducts and totalResults count slot; "
                    f"found {updated_ids}"
                )

            # Match the Products icon and its stat-number within the same hero-stat
        # element. Never scan through the remainder of the document: that could
        # accidentally make a later statistic (such as Vehicles) look like Products.
        product_stat = re.compile(
            r'(<div\b[^>]*class=["\'][^"\']*\bhero-stat["\'][^>]*>\s*'
            r'<img\b(?=[^>]*\bsrc=["\'][^"\']*/products\.svg(?:[?#][^"\']*)?["\'])[^>]*>\s*'
            r'<div\b[^>]*>\s*<(?:div|span)\b(?=[^>]*\bclass=["\'][^"\']*\bstat-number\b)[^>]*>\s*)'
            r'\d+'
            r'(\s*</(?:div|span)\s*>)',
            flags=re.I | re.S,
        )
        html, product_stat_updates = product_stat.subn(
            lambda match: f"{match.group(1)}{active_count}{match.group(2)}",
            html,
            count=1,
        )
        if product_stat_updates != 1:
            raise ValueError(f"{relative}: could not find the Products hero-stat count to synchronize")

        if html != original:
            path.write_text(html, encoding="utf-8")
        page_counts[relative] = active_count

    print(
        f"Synchronized active catalogue count ({active_count}) across "
        f"{len(page_counts)} generated catalogue pages."
    )



def sync_catalogue_summary_counts() -> None:
    """Reconcile public summary counts from the active catalogue and entity directories."""
    import json
    import re

    data_dir = ROOT / "assets" / "data"
    catalogue = json.loads((data_dir / "catalogue-index.json").read_text(encoding="utf-8"))
    brands_path = data_dir / "brands.json"
    categories_path = data_dir / "categories.json"
    brands = json.loads(brands_path.read_text(encoding="utf-8"))
    categories = json.loads(categories_path.read_text(encoding="utf-8"))

    active_products = [
        p for p in catalogue
        if isinstance(p, dict) and p.get("id") and p.get("active") is not False
    ]
    product_count = len(active_products)
    active_brands = [
        b for b in brands
        if isinstance(b, dict) and b.get("active") is not False and str(b.get("slug") or "").strip()
    ]
    brand_count = len(active_brands)
    if product_count <= 0 or brand_count <= 0:
        raise ValueError("Refusing to publish empty product or brand summary counts")

    counts_by_category = {}
    for product in active_products:
        category_id = str(product.get("category_id") or "").strip()
        if category_id:
            counts_by_category[category_id] = counts_by_category.get(category_id, 0) + 1

    count_before_parts = re.compile(
        r"(?<![\w])\d[\d,]*\+?(?=\s+(?:active\s+)?"
        r"(?:commercial-vehicle\s+)?(?:spare\s+)?(?:parts|products)\b)",
        flags=re.I,
    )
    changed_files = 0

    for lang in ("en", "hi", "bn"):
        home = ROOT / lang / "index.html"
        if not home.is_file():
            continue
        html = home.read_text(encoding="utf-8")
        original = html
        for icon_name, count in (("products.svg", product_count), ("brands.svg", brand_count)):
            pattern = re.compile(
                r'(<div\b[^>]*class="[^"]*\bhome-trust-item\b[^"]*"[^>]*>'
                r'(?:(?!</div>).)*?<img\b(?=[^>]*src="[^"]*/'
                + re.escape(icon_name)
                + r'(?:[?#][^"]*)?")[^>]*>(?:(?!</div>).)*?<strong>)[^<]*(</strong>)',
                flags=re.I | re.S,
            )
            html, replacements = pattern.subn(
                lambda m: m.group(1) + f"{count}+" + m.group(2), html, count=1
            )
            if replacements != 1:
                raise ValueError(f"{home.relative_to(ROOT)}: could not uniquely locate {icon_name} summary")
        if html != original:
            home.write_text(html, encoding="utf-8")
            changed_files += 1

    for lang in ("en", "hi", "bn"):
        about = ROOT / lang / "about.html"
        if not about.is_file():
            continue
        html = about.read_text(encoding="utf-8")
        original = html
        html = count_before_parts.sub(lambda _: str(product_count), html)
        html = re.sub(
            r"(?<![\w])\d[\d,]*\+?(?=\s+brands?\b)",
            str(brand_count),
            html,
            flags=re.I,
        )
        if html != original:
            about.write_text(html, encoding="utf-8")
            changed_files += 1

    categories_changed = False
    for category in categories:
        if not isinstance(category, dict):
            continue
        category_id = str(category.get("id") or "").strip()
        if not category_id:
            continue
        category_count = counts_by_category.get(category_id, 0)
        for field in ("description", "short_description"):
            value = category.get(field)
            if isinstance(value, str):
                updated = count_before_parts.sub(lambda _: str(category_count), value)
                if updated != value:
                    category[field] = updated
                    categories_changed = True

        slug = str(category.get("slug") or category_id).strip()
        for lang in ("en", "hi", "bn"):
            page = ROOT / lang / "categories" / f"{slug}.html"
            if not page.is_file():
                continue
            html = page.read_text(encoding="utf-8")
            original = html
            html = count_before_parts.sub(lambda _: str(category_count), html)
            if html != original:
                page.write_text(html, encoding="utf-8")
                changed_files += 1

    if categories_changed:
        categories_path.write_text(
            json.dumps(categories, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        changed_files += 1

    print(
        f"Catalogue summary counts synchronized: {product_count} active products, "
        f"{brand_count} active brands, {len(counts_by_category)} categories with active products; "
        f"{changed_files} files updated."
    )

def main() -> None:
    sync_product_listing_meta_descriptions()
    reconcile_catalogue_projections()
    sync_active_catalogue_counts()
    sync_catalogue_summary_counts()
    sync_static_product_images()
    sync_static_product_taxonomy_and_recommendations()
    normalize_blank_part_numbers()
    sync_product_seo_and_schema()
    normalize_internal_redirect_links()
    sync_organization_schema()
    runpy.run_path(str(ROOT / "scripts/catalogue/normalize_page_config.py"), run_name="__main__")
    runpy.run_path(str(ROOT / "scripts/catalogue/sync_rfq_module.py"), run_name="__main__")
    runpy.run_path(str(ROOT / "scripts/catalogue/validate.py"), run_name="__main__")


if __name__ == "__main__":
    main()

# Rebuild catalogue projections when new product images land on main.
