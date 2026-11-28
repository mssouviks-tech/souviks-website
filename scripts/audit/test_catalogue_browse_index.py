#!/usr/bin/env python3
"""Validate the lean browse projection against the full catalogue master."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "assets" / "data" / "catalogue-index.json"
BROWSE = ROOT / "assets" / "data" / "catalogue-browse.json"

REQUIRED = {
    "id", "slug", "product_name", "part_number",
    "brand_id", "brand_name", "category_id", "category_name",
    "mrp", "selling_price", "active", "featured",
}
FORBIDDEN = {
    "hsn_code", "hsn_dpiit_mapping", "gst_rate_percent",
    "gst_cgst_rate_percent", "gst_sgst_rate_percent", "gst_igst_rate_percent",
    "dimensions_mm", "dimension_specs_mm", "manufacturer_dimensions_mm",
    "manufacturer_dimension_specs", "approx_weight_g", "calculated_weight_g",
    "weight_estimation_notes", "price_history_all_time",
}


def main() -> None:
    master = json.loads(MASTER.read_text(encoding="utf-8"))
    browse = json.loads(BROWSE.read_text(encoding="utf-8"))
    assert isinstance(master, list), "Catalogue master must be an array"
    assert isinstance(browse, list), "Browse projection must be an array"

    active = {
        str(item["id"]): item
        for item in master
        if isinstance(item, dict) and item.get("id") and item.get("active") is not False
    }
    browse_by_id = {str(item.get("id")): item for item in browse if isinstance(item, dict)}
    assert len(browse_by_id) == len(browse), "Browse projection contains duplicate or invalid IDs"
    assert set(browse_by_id) == set(active), "Browse projection must contain every active product exactly once"

    for product_id, item in browse_by_id.items():
        missing = REQUIRED - set(item)
        assert not missing, f"{product_id}: missing required browse fields {sorted(missing)}"
        leaked = FORBIDDEN & set(item)
        assert not leaked, f"{product_id}: heavy master-only fields leaked into browse projection {sorted(leaked)}"

        source = active[product_id]
        for field in (
            "slug", "mrp", "selling_price", "prior_price_30d",
            "brand_id", "category_id", "subcategory_id", "vehicles",
            "applications", "manufacturer_part_number",
            "alternate_part_numbers", "oem_numbers", "cross_references",
            "card_image_url",
        ):
            if field in source and source[field] is not None:
                assert item.get(field) == source[field], f"{product_id}: {field} differs from canonical master"

        assert item["product_name"] == str(source.get("product_name") or source.get("name") or "").strip()
        assert item["part_number"] == str(source.get("part_number") or source.get("partNumber") or "").strip()
        assert item["active"] is True

    master_bytes = MASTER.stat().st_size
    browse_bytes = BROWSE.stat().st_size
    assert browse_bytes < master_bytes, (
        f"Browse projection is not smaller than the full master ({browse_bytes} >= {master_bytes})"
    )
    print(
        f"Browse projection contract passed: {len(browse):,} active products, "
        f"{browse_bytes:,}/{master_bytes:,} bytes ({100 * browse_bytes / master_bytes:.1f}% of master)."
    )


if __name__ == "__main__":
    main()
