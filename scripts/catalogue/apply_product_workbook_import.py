#!/usr/bin/env python3
"""Apply the 11 November 2026 product workbook import to the canonical catalogue."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOGUE = ROOT / "assets" / "data" / "catalogue-index.json"
IMPORT_DIR = ROOT / "assets" / "data" / "product-workbook-import-2026-11-11"


def normal(value: object) -> str:
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def unique_values(values: list[object]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        key = normal(text)
        if text and key and key not in seen:
            seen.add(key)
            result.append(text)
    return result


def split_mpn(value: object) -> list[str]:
    return [part.strip() for part in re.split(r"[,;]", str(value or "")) if part.strip()]


def split_vehicles(value: object) -> list[str]:
    values = [part.strip() for part in str(value or "").split(",") if part.strip()]
    return [
        value
        for value in values
        if value.upper() not in {"UNIVERSAL", "—", "-", "N/A"}
    ]


def split_applications(value: object) -> list[str]:
    return [part.strip() for part in str(value or "").split(";") if part.strip()]


def read_import_rows() -> tuple[list[dict], list[Path]]:
    parts = sorted(IMPORT_DIR.glob("part-*.jsonl"))
    rows: list[dict] = []
    for part in parts:
        with part.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if line.strip():
                    try:
                        rows.append(json.loads(line))
                    except json.JSONDecodeError as exc:
                        raise ValueError(
                            f"Invalid JSON in {part.name}:{line_number}: {exc}"
                        ) from exc
    return rows, parts


def make_new_product(row: dict, products: list[dict]) -> dict:
    product_id = str(row["id"])
    image_dir = ROOT / "assets" / "images" / "products" / str(
        row.get("image_folder") or product_id
    )
    gallery = sorted(
        path.name
        for path in image_dir.glob("*.webp")
        if path.is_file()
    )
    if len(gallery) < 4:
        raise ValueError(
            f"{product_id}: expected four existing WebP views in {image_dir}, "
            f"found {len(gallery)}"
        )

    driveline = str(row.get("subcategory_id") or "") == "cross-joint"
    if driveline:
        template = next(
            (
                product
                for product in products
                if product.get("subcategory_id") == "cross-joint"
                and product.get("hsn_code") == "84836090"
                and product.get("hsn_classification_status") == "review_required"
            ),
            None,
        )
    else:
        template = next(
            (
                product
                for product in products
                if product.get("brand_id") == "jmp"
                and product.get("hsn_code") == "87088000"
                and product.get("subcategory_id")
                in {"hanger", "bracket", "shackle-plate"}
            ),
            None,
        )
    if template is None:
        raise ValueError(f"{product_id}: no comparable HSN/GST template found")

    hsn_mapping = json.loads(
        json.dumps(template.get("hsn_dpiit_mapping") or {})
    )
    # Do not copy supplier-invoice mappings from another SKU.
    hsn_mapping["supplier_invoice_hsn"] = []

    gst_candidate = json.loads(
        json.dumps(template.get("gst_rate_candidate") or {})
    )
    # The source template's HSN-specific schedule note is not applicable here.
    gst_candidate.pop("schedule_basis", None)
    gst_candidate["invoice_ready"] = False
    gst_candidate["accountant_approval_required"] = False
    gst_candidate["accountant_approval_status"] = "approved"
    gst_candidate["review_note"] = (
        "The catalogue-wide 18% default rate is accountant-approved; product "
        "HSN remains provisional or review-required. GST invoice generation "
        "stays blocked until HSN classification is final."
    )

    mrp = row.get("mrp")
    selling_price = row.get("selling_price")
    mrp = round(float(mrp), 2) if mrp not in (None, "") else None
    selling_price = (
        round(float(selling_price), 2)
        if selling_price not in (None, "")
        else None
    )
    discount = (
        round((mrp - selling_price) / mrp * 100, 2)
        if mrp and mrp > 0 and selling_price is not None
        else None
    )
    mpns = split_mpn(row.get("manufacturer_part_number"))
    part_number = str(row.get("part_number") or "").strip()
    product_name = str(row.get("product_name") or "").strip()
    brand_name = str(row.get("brand_name") or "").strip()
    primary_image = gallery[0]

    return {
        "id": product_id,
        "slug": str(row.get("slug") or "").strip(),
        "part_number": part_number,
        "manufacturer_part_number": mpns[0] if mpns else "",
        "manufacturer_part_numbers": mpns,
        "alternate_part_numbers": [],
        "oem_numbers": [],
        "cross_references": [],
        "mrp": mrp,
        "selling_price": selling_price,
        "product_name": product_name,
        "name": product_name,
        "partNumber": part_number,
        "brand_id": str(row.get("brand_id") or "").strip(),
        "brand_name": brand_name,
        "brand": brand_name,
        "category_id": str(row.get("category_id") or "").strip(),
        "category_name": str(row.get("category_name") or "").strip(),
        "category": str(row.get("category_name") or "").strip(),
        "subcategory_id": str(row.get("subcategory_id") or "").strip(),
        "subcategory_name": str(row.get("subcategory_name") or "").strip(),
        "subcategory": str(row.get("subcategory_name") or "").strip(),
        "image": primary_image,
        "primary_image": primary_image,
        "image_folder": str(row.get("image_folder") or product_id).strip(),
        "gallery": gallery[:4],
        "vehicles": split_vehicles(row.get("vehicles")),
        "applications": split_applications(row.get("applications")),
        "description": str(row.get("description") or "").strip(),
        "featured": bool(row.get("featured")),
        "active": bool(row.get("active")),
        "discount_percent": discount,
        "discountPercent": discount,
        "hsn_code": template.get("hsn_code"),
        "hsn_description": template.get("hsn_description"),
        # The inherited code is a research lead only. This SKU has not been
        # individually classified against its precise tariff description.
        "hsn_confidence": "low",
        "hsn_classification_status": "review_required",
        "hsn_basis": (
            "Comparable-SKU HSN carried forward as a provisional research lead; "
            "this newly imported SKU has not been individually classified against "
            "the exact tariff description."
        ),
        "hsn_review_note": (
            "Review required: verify this SKU's exact material, function, vehicle "
            "application and current tariff description before using this HSN for "
            "GST invoicing."
        ),
        "hsn_reference_date": "",
        "hsn_research_source": "",
        "hsn_research_date": "",
        "hsn_dpiit_mapping": hsn_mapping,
        "gst_rate_candidate": gst_candidate,
        "gst_rate_percent": template.get("gst_rate_percent"),
        "gst_cgst_rate_percent": template.get("gst_cgst_rate_percent"),
        "gst_sgst_rate_percent": template.get("gst_sgst_rate_percent"),
        "gst_igst_rate_percent": template.get("gst_igst_rate_percent"),
        "gst_rate_effective_from": template.get("gst_rate_effective_from"),
        "gst_rate_source_reference": template.get(
            "gst_rate_source_reference"
        ),
        "gst_rate_basis": template.get("gst_rate_basis"),
        "catalogue_updated_at": "2026-11-11",
    }


def apply_import(rows: list[dict], products: list[dict]) -> dict:
    by_id = {str(product.get("id")): product for product in products}
    if len(by_id) != len(products):
        raise ValueError("Canonical catalogue already contains duplicate IDs")

    source_ids = [str(row.get("id") or "") for row in rows]
    if not all(source_ids) or len(set(source_ids)) != len(source_ids):
        raise ValueError("Import rows contain blank or duplicate product IDs")

    stats = {
        "existing": 0,
        "added": 0,
        "price_updates": 0,
        "category_updates": 0,
        "description_updates": 0,
        "application_updates": 0,
        "vehicle_updates": 0,
        "manufacturer_references_added": 0,
        "alternate_part_numbers_added": 0,
        "reactivated": 0,
    }

    for row in rows:
        product_id = str(row["id"])
        product = by_id.get(product_id)
        if product is None:
            product = make_new_product(row, products)
            by_id[product_id] = product
            products.append(product)
            stats["added"] += 1
            continue

        stats["existing"] += 1
        if str(product.get("brand_id") or "").lower() != str(
            row.get("brand_id") or ""
        ).lower():
            raise ValueError(
                f"{product_id}: brand mismatch between workbook and catalogue"
            )

        incoming_part = str(row.get("part_number") or "").strip()
        current_part = str(product.get("part_number") or "").strip()
        if incoming_part:
            if not current_part:
                product["part_number"] = incoming_part
                product["partNumber"] = incoming_part
            elif normal(incoming_part) != normal(current_part):
                alternates = product.get("alternate_part_numbers") or []
                product["alternate_part_numbers"] = unique_values(
                    [*alternates, incoming_part]
                )
                stats["alternate_part_numbers_added"] += 1

        incoming_mpns = split_mpn(row.get("manufacturer_part_number"))
        if incoming_mpns:
            existing_mpns = product.get("manufacturer_part_numbers") or []
            product["manufacturer_part_numbers"] = unique_values(
                [*existing_mpns, *incoming_mpns]
            )
            if not product.get("manufacturer_part_number"):
                product["manufacturer_part_number"] = incoming_mpns[0]
            stats["manufacturer_references_added"] += 1

        for field in ("mrp", "selling_price"):
            value = row.get(field)
            if value not in (None, ""):
                value = round(float(value), 2)
                if product.get(field) != value:
                    product[field] = value
                    stats["price_updates"] += 1

        product_name = str(row.get("product_name") or "").strip()
        if product_name:
            product["product_name"] = product_name
            product["name"] = product_name
        if product.get("product_name"):
            product["name"] = product["product_name"]

        for field in ("brand_id",):
            if row.get(field):
                product[field] = str(row[field]).strip()
        if row.get("brand_name"):
            product["brand_name"] = str(row["brand_name"]).strip()
            product["brand"] = product["brand_name"]

        if row.get("category_id"):
            category_id = str(row["category_id"]).strip()
            if product.get("category_id") != category_id:
                stats["category_updates"] += 1
            product["category_id"] = category_id
        if row.get("category_name"):
            product["category_name"] = str(row["category_name"]).strip()
            product["category"] = product["category_name"]

        if row.get("subcategory_id"):
            subcategory_id = str(row["subcategory_id"]).strip()
            if product.get("subcategory_id") != subcategory_id:
                stats["category_updates"] += 1
            product["subcategory_id"] = subcategory_id
        if row.get("subcategory_name"):
            product["subcategory_name"] = str(row["subcategory_name"]).strip()
            product["subcategory"] = product["subcategory_name"]

        source_description = str(row.get("description") or "").strip()
        current_description = str(product.get("description") or "").strip()
        generic_description = source_description.lower() in {
            "hardware component",
            "product component",
            "spare part",
        }
        if (
            source_description
            and not generic_description
            and len(source_description) > len(current_description)
        ):
            product["description"] = source_description
            stats["description_updates"] += 1

        source_vehicles = split_vehicles(row.get("vehicles"))
        if source_vehicles:
            current_vehicles = [
                value
                for value in (product.get("vehicles") or [])
                if normal(value) != "UNIVERSAL"
            ]
            updated_vehicles = unique_values(
                [*current_vehicles, *source_vehicles]
            )
            if updated_vehicles != product.get("vehicles"):
                product["vehicles"] = updated_vehicles
                stats["vehicle_updates"] += 1

        source_applications = split_applications(row.get("applications"))
        if source_applications:
            current_applications = product.get("applications") or []
            combined_current = normal(" ".join(current_applications))
            additions = [
                value
                for value in source_applications
                if normal(value)
                not in {
                    "BRAKEAIRLINEGENERALWORKSHOPUSE",
                    "HARDWARECOMPONENT",
                    "UNIVERSAL",
                }
                and normal(value) not in combined_current
            ]
            updated_applications = unique_values(
                [*current_applications, *additions]
            )
            if updated_applications != current_applications:
                product["applications"] = updated_applications
                stats["application_updates"] += 1

        if isinstance(row.get("featured"), bool):
            product["featured"] = row["featured"]
        if isinstance(row.get("active"), bool):
            if row["active"] and product.get("active") is False:
                stats["reactivated"] += 1
            product["active"] = row["active"]

        mrp = product.get("mrp")
        selling_price = product.get("selling_price")
        if mrp not in (None, 0, "") and selling_price not in (None, ""):
            discount = round((float(mrp) - float(selling_price)) / float(mrp) * 100, 2)
            product["discount_percent"] = discount
            product["discountPercent"] = discount

    ids = [str(product.get("id") or "") for product in products]
    slugs = [str(product.get("slug") or "") for product in products]
    if len(ids) != len(set(ids)):
        raise ValueError("Import would create duplicate product IDs")
    if len(slugs) != len(set(slugs)):
        raise ValueError("Import would create duplicate public product slugs")

    return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate the import without writing the catalogue or consuming files.",
    )
    args = parser.parse_args()

    rows, parts = read_import_rows()
    if not parts:
        print("No pending product workbook import; catalogue is unchanged.")
        return

    if not CATALOGUE.is_file():
        raise FileNotFoundError(CATALOGUE)

    with CATALOGUE.open("r", encoding="utf-8") as handle:
        products = json.load(handle)

    before = len(products)
    stats = apply_import(rows, products)
    print(
        json.dumps(
            {
                "import_rows": len(rows),
                "catalogue_before": before,
                "catalogue_after": len(products),
                "check_only": args.check,
                **stats,
            },
            indent=2,
        )
    )

    if args.check:
        return

    temporary = CATALOGUE.with_suffix(".json.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(products, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temporary.replace(CATALOGUE)

    for part in parts:
        part.unlink()
    try:
        IMPORT_DIR.rmdir()
    except OSError:
        pass


if __name__ == "__main__":
    main()
