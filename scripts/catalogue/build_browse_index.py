#!/usr/bin/env python3
"""Build the compact public product projection used by the browse/listing page.

The canonical catalogue-index.json remains the complete product master. This
projection contains only fields needed for cards, facets, sorting and listing
search, keeping HSN/GST, freight, dimensions and manufacturer specification
metadata out of the listing's initial data request.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MASTER_PATH = ROOT / "assets" / "data" / "catalogue-index.json"
OUTPUT_PATH = ROOT / "assets" / "data" / "catalogue-browse.json"

BROWSE_FIELDS = (
    "id",
    "slug",
    "product_name",
    "name",
    "part_number",
    "partNumber",
    "brand_id",
    "brand_name",
    "brand",
    "category_id",
    "category_name",
    "category",
    "subcategory_id",
    "subcategory_name",
    "subcategory",
    "mrp",
    "selling_price",
    "prior_price_30d",
    "discount_percent",
    "discountPercent",
    "image_url",
    "image",
    "primary_image",
    "image_folder",
    "card_image_url",
    "vehicles",
    "applications",
    "manufacturer_part_number",
    "manufacturer_part_numbers",
    "alternate_part_numbers",
    "oem_numbers",
    "cross_references",
    "description",
    "keywords",
    "featured",
)


def clean(value: Any) -> str:
    return str(value or "").strip()


def first_gallery_image(product: dict[str, Any]) -> str:
    gallery = product.get("gallery")
    if not isinstance(gallery, list):
        return ""
    for entry in gallery:
        if isinstance(entry, dict):
            filename = clean(entry.get("filename") or entry.get("file") or entry.get("name"))
        else:
            filename = clean(entry)
        if filename:
            return filename
    return ""


def project_product(product: dict[str, Any]) -> dict[str, Any]:
    """Return the allow-listed listing payload and preserve listing behaviour."""
    projected = {
        field: product[field]
        for field in BROWSE_FIELDS
        if field in product and product[field] is not None
    }

    # Keep the aliases consumed by the shared card/search components coherent.
    projected["product_name"] = clean(product.get("product_name") or product.get("name"))
    projected["name"] = clean(product.get("name") or product.get("product_name"))
    part_number = clean(product.get("part_number") or product.get("partNumber"))
    projected["part_number"] = part_number
    projected["partNumber"] = part_number
    projected["brand_name"] = clean(product.get("brand_name") or product.get("brand"))
    projected["brand"] = clean(product.get("brand") or product.get("brand_name"))
    projected["category_name"] = clean(product.get("category_name") or product.get("category"))
    projected["category"] = clean(product.get("category") or product.get("category_name"))
    projected["subcategory_name"] = clean(product.get("subcategory_name") or product.get("subcategory"))
    projected["subcategory"] = clean(product.get("subcategory") or product.get("subcategory_name"))

    primary_image = clean(product.get("primary_image")) or first_gallery_image(product) or clean(product.get("image"))
    if primary_image:
        projected["primary_image"] = primary_image
        projected.setdefault("image", clean(product.get("image")) or primary_image)

    projected["image_folder"] = clean(product.get("image_folder") or product.get("id"))
    projected["active"] = True
    projected["featured"] = bool(product.get("featured"))
    return projected


def build() -> tuple[int, int, int]:
    if not MASTER_PATH.is_file():
        raise FileNotFoundError(f"Missing canonical product master: {MASTER_PATH}")
    catalogue = json.loads(MASTER_PATH.read_text(encoding="utf-8"))
    if not isinstance(catalogue, list):
        raise ValueError("catalogue-index.json must contain an array")

    active_products = [
        product
        for product in catalogue
        if isinstance(product, dict)
        and clean(product.get("id"))
        and product.get("active") is not False
    ]
    projected = [project_product(product) for product in active_products]

    ids = [item["id"] for item in projected]
    if len(ids) != len(set(ids)):
        raise ValueError("Active catalogue contains duplicate product IDs")
    if not projected:
        raise ValueError("Refusing to publish an empty catalogue browse projection")
    if any(not item.get("slug") or not item.get("product_name") for item in projected):
        raise ValueError("Every active browse record must have a product slug and name")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(projected, ensure_ascii=False, separators=(",", ":")) + "\n"
    OUTPUT_PATH.write_text(payload, encoding="utf-8")
    return len(projected), len(payload.encode("utf-8")), len(MASTER_PATH.read_bytes())


if __name__ == "__main__":
    count, browse_bytes, master_bytes = build()
    reduction = 100.0 * (1 - browse_bytes / master_bytes) if master_bytes else 0.0
    print(
        f"Built {count:,} active browse records: "
        f"{browse_bytes:,} bytes vs {master_bytes:,} bytes for the full master "
        f"({reduction:.1f}% smaller)."
    )
