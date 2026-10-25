#!/usr/bin/env python3
"""Validate WABCO manufacturer specs and safe freight-weight propagation."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets" / "data" / "wabco-product-specs.json"
CATALOGUE_PATH = ROOT / "assets" / "data" / "catalogue-index.json"
PRODUCTS_PATH = ROOT / "assets" / "data" / "products.json"
LANGUAGES = ("en", "hi", "bn")
ALLOWED_STATUSES = {
    "official_plausible",
    "official_placeholder_suspected",
    "official_missing_or_zero",
    "official_spec_not_found",
    "official_weight_unconfirmed",
    "official_drawing_variant_review",
}
UNTRUSTED_WEIGHT_STATUSES = {
    "official_placeholder_suspected",
    "official_missing_or_zero",
    "official_spec_not_found",
    "official_weight_unconfirmed",
}


def fail(message: str) -> None:
    raise SystemExit(f"WABCO SPEC VALIDATION ERROR: {message}")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Cannot read {path.relative_to(ROOT)}: {exc}")


manifest = load_json(MANIFEST_PATH)
records = manifest.get("products") if isinstance(manifest, dict) else None
if not isinstance(records, list) or len(records) != 29:
    fail(f"Expected exactly 29 WABCO inventory records, got {len(records) if isinstance(records, list) else 'invalid'}")

catalogue = load_json(CATALOGUE_PATH)
products = load_json(PRODUCTS_PATH)
catalogue_by_id = {str(p.get("id")): p for p in catalogue if isinstance(p, dict) and p.get("id")}
products_by_id = {str(p.get("id")): p for p in products if isinstance(p, dict) and p.get("id")}
catalogue_wabco = {
    str(p.get("id")): p
    for p in catalogue
    if isinstance(p, dict)
    and p.get("id")
    and "wabco" in str(p.get("brand_name") or p.get("brand") or "").casefold()
}
seen = set()
data_pattern = re.compile(r"window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});", re.S)

for spec in records:
    pid = str(spec.get("id") or "").strip()
    part_number = str(spec.get("part_number") or "").strip()
    if not pid or not part_number:
        fail("Each record requires id and part_number")
    if pid in seen:
        fail(f"Duplicate product record {pid}")
    seen.add(pid)
    if pid not in catalogue_wabco:
        fail(f"{pid} is not a current WABCO product in the master catalogue")
    master = catalogue_by_id[pid]
    actual_part = str(master.get("part_number") or master.get("partNumber") or "")
    if actual_part != part_number:
        fail(f"Part-number mismatch for {pid}: {actual_part!r} != {part_number!r}")

    status = spec.get("weight_status")
    if status not in ALLOWED_STATUSES:
        fail(f"Invalid weight status on {pid}: {status!r}")
    if status in {"official_plausible", "official_drawing_variant_review"}:
        mass = spec.get("manufacturer_weight_g")
        if not isinstance(mass, (int, float)) or isinstance(mass, bool) or mass <= 0:
            fail(f"Expected a positive published weight on {pid}")
    packed = spec.get("approx_weight_g")
    if status in UNTRUSTED_WEIGHT_STATUSES and packed is not None:
        fail(f"Unverified/potential-placeholder weight used for freight on {pid}")
    if packed is not None:
        mass = spec.get("manufacturer_weight_g")
        if not isinstance(packed, (int, float)) or isinstance(packed, bool) or packed <= 0:
            fail(f"Invalid packed weight for {pid}")
        if not isinstance(mass, (int, float)) or mass <= 0:
            fail(f"Packed weight has no positive manufacturer source mass for {pid}")
        expected = int(math.ceil((mass * 1.05) / 50) * 50)
        if packed != expected:
            fail(f"Packed weight calculation mismatch for {pid}: {packed} != {expected}")

    source_url = spec.get("source_url")
    if source_url is not None and (
        not isinstance(source_url, str)
        or urlparse(source_url).scheme != "https"
        or urlparse(source_url).netloc != "www.wabco-customercentre.com"
    ):
        fail(f"Non-official WABCO source URL for {pid}: {source_url!r}")
    dimensions = spec.get("manufacturer_dimensions_mm")
    if dimensions is not None and (
        not isinstance(dimensions, list)
        or len(dimensions) != 3
        or any(not isinstance(v, (int, float)) or isinstance(v, bool) or v <= 0 for v in dimensions)
    ):
        fail(f"Invalid overall dimensions for {pid}")
    features = spec.get("manufacturer_dimension_features")
    if not isinstance(features, list) or any(not isinstance(v, str) or not v.strip() for v in features):
        fail(f"Invalid dimensional features for {pid}")

    expected_fields = {
        "manufacturer_weight_g": spec.get("manufacturer_weight_g"),
        "manufacturer_weight_status": status,
        "manufacturer_dimensions_mm": dimensions,
        "manufacturer_dimension_features": features,
        "manufacturer_specs_source_url": source_url,
        "manufacturer_specs_checked_at": manifest.get("checked_at"),
        "manufacturer_specs_notes": spec.get("notes"),
    }
    for field, expected_value in expected_fields.items():
        if master.get(field) != expected_value:
            fail(f"Canonical catalogue mismatch on {pid}.{field}: {master.get(field)!r} != {expected_value!r}")
    if master.get("approx_weight_g") != packed:
        fail(f"Canonical packed-weight mismatch for {pid}")
    projection = products_by_id.get(pid)
    if not projection:
        fail(f"Missing public product projection for {pid}")
    for field, expected_value in expected_fields.items():
        if projection.get(field) != expected_value:
            fail(f"Public product projection mismatch on {pid}.{field}")
    if projection.get("approx_weight_g") != packed:
        fail(f"Public product packed-weight mismatch for {pid}")

    slug = str(master.get("slug") or "").strip()
    if not slug:
        fail(f"Missing slug for {pid}")
    for language in LANGUAGES:
        page_path = ROOT / language / "products" / f"{slug}.html"
        if not page_path.is_file():
            fail(f"Missing {language} PDP for {pid}: {slug}")
        page = page_path.read_text(encoding="utf-8", errors="ignore")
        match = data_pattern.search(page)
        if not match:
            fail(f"No embedded product data in {page_path.relative_to(ROOT)}")
        try:
            page_data = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            fail(f"Invalid embedded data in {page_path.relative_to(ROOT)}: {exc}")
        for field, expected_value in expected_fields.items():
            if page_data.get(field) != expected_value:
                fail(f"{language} product page mismatch on {pid}.{field}")
        if page_data.get("approx_weight_g") != packed:
            fail(f"{language} product page packed-weight mismatch for {pid}")

if seen != set(catalogue_wabco):
    missing = sorted(set(catalogue_wabco) - seen)
    unexpected = sorted(seen - set(catalogue_wabco))
    fail(f"Inventory coverage mismatch; missing={missing}, unexpected={unexpected}")

print(
    "WABCO specifications validated across canonical data, public projection "
    f"and {len(LANGUAGES)} language PDPs: {len(records)} products."
)
