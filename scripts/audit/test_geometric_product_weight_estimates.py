#!/usr/bin/env python3
"""Validate geometric item-weight estimates and their catalogue/page projections."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets" / "data" / "geometric-product-weight-estimates.json"
CATALOGUE_PATH = ROOT / "assets" / "data" / "catalogue-index.json"
PRODUCTS_PATH = ROOT / "assets" / "data" / "products.json"
LANGUAGES = ("en", "hi", "bn")
ALLOWED_PROFILES = {"carton_cut_wrap", "plastic_wrap_no_carton"}
ALLOWED_CONFIDENCE = {"low", "low_to_medium", "medium", "high"}


def fail(message: str) -> None:
    raise SystemExit(f"GEOMETRIC PRODUCT WEIGHT VALIDATION ERROR: {message}")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Cannot read {path.relative_to(ROOT)}: {exc}")


def product_jsonld(html: str):
    scripts = re.findall(
        r"""<script\b(?=[^>]*\btype=["']application/ld\+json["'])[^>]*>(.*?)</script\s*>""",
        html,
        flags=re.I | re.S,
    )
    for script in scripts:
        try:
            payload = json.loads(script.strip())
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and payload.get("@type") == "Product":
            return payload
    return None


def embedded_product_data(html: str):
    match = re.search(
        r"""window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});""",
        html,
        flags=re.S,
    )
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


manifest = load_json(MANIFEST_PATH)
estimates = manifest.get("products") if isinstance(manifest, dict) else None
if not isinstance(estimates, list) or not estimates:
    fail("Geometric weight manifest must contain a non-empty products array")
if manifest.get("density_kg_m3") != 7850:
    fail("The geometric estimate density must remain explicitly declared as 7,850 kg/m³")
packaging = manifest.get("packaging") or {}
if packaging.get("allowance_percent") != 5 or packaging.get("round_up_to_g") != 1:
    fail("Expected 5% per-unit protective allowance and 1 g rounding")

catalogue = load_json(CATALOGUE_PATH)
products = load_json(PRODUCTS_PATH)
catalogue_by_id = {
    str(product.get("id")): product
    for product in catalogue
    if isinstance(product, dict) and product.get("id")
}
products_by_id = {
    str(product.get("id")): product
    for product in products
    if isinstance(product, dict) and product.get("id")
}

seen = set()
for estimate in estimates:
    pid = str(estimate.get("id") or "").strip()
    part_number = str(estimate.get("part_number") or "").strip()
    net_weight = estimate.get("net_weight_g")
    calculated_weight = estimate.get("calculated_weight_g")
    packed_weight = estimate.get("approx_weight_g")
    allowance = estimate.get("packaging_allowance_percent")
    round_up = estimate.get("round_up_to_g")
    profile = str(estimate.get("packing_profile") or "").strip()
    model = str(estimate.get("model") or "").strip()
    confidence = str(estimate.get("confidence") or "").strip()

    if not pid or pid in seen:
        fail(f"Missing or duplicate product id: {pid!r}")
    seen.add(pid)
    if (
        not isinstance(net_weight, (int, float))
        or isinstance(net_weight, bool)
        or not math.isfinite(net_weight)
        or net_weight <= 0
        or calculated_weight != net_weight
    ):
        fail(f"{pid} has invalid or inconsistent calculated net weight")
    if (
        not isinstance(packed_weight, (int, float))
        or isinstance(packed_weight, bool)
        or not math.isfinite(packed_weight)
        or packed_weight <= 0
        or allowance != 5
        or round_up != 1
        or packed_weight != math.ceil(net_weight * 1.05)
    ):
        fail(f"{pid} has invalid per-unit packed weight or packaging calculation")
    if profile not in ALLOWED_PROFILES or not model or confidence not in ALLOWED_CONFIDENCE:
        fail(f"{pid} has invalid model, confidence or packing profile")
    if not str(estimate.get("notes") or "").strip() or not str(estimate.get("source") or "").strip():
        fail(f"{pid} is missing model notes or source provenance")
    if estimate.get("shipping_package_dimensions_mm") is not None:
        fail(f"{pid} must not infer external carton dimensions from product geometry")

    master = catalogue_by_id.get(pid)
    if not master:
        fail(f"{pid} is missing from canonical catalogue")
    actual_part = str(master.get("part_number") or master.get("partNumber") or "").strip()
    if actual_part and part_number and actual_part != part_number:
        fail(f"{pid} canonical part-number mismatch: {actual_part!r} != {part_number!r}")
    expected_master = {
        "calculated_weight_g": round(float(net_weight), 1),
        "approx_weight_g": int(packed_weight),
        "weight_estimation_status": "estimated",
        "weight_estimation_method": model,
        "weight_estimation_confidence": confidence,
        "shipping_packing_profile": profile,
        "shipping_packaging_allowance_percent": allowance,
    }
    for field, expected in expected_master.items():
        if master.get(field) != expected:
            fail(f"{pid} canonical {field} mismatch: {master.get(field)!r} != {expected!r}")

    projection = products_by_id.get(pid)
    if not projection:
        fail(f"{pid} is missing from public product projection")
    for field, expected in expected_master.items():
        if projection.get(field) != expected:
            fail(f"{pid} public {field} mismatch: {projection.get(field)!r} != {expected!r}")

    slug = str(master.get("slug") or "").strip()
    if not slug:
        fail(f"{pid} has no product slug")
    for language in LANGUAGES:
        page = ROOT / language / "products" / f"{slug}.html"
        if not page.is_file():
            fail(f"{pid}: missing {language} product page")
        html = page.read_text(encoding="utf-8", errors="ignore")
        schema = product_jsonld(html)
        if not schema:
            fail(f"{pid}: missing Product JSON-LD on {language} page")
        schema_weight = schema.get("weight")
        if not isinstance(schema_weight, dict):
            fail(f"{pid}: Product.weight missing on {language} page")
        expected_net_kg = round(float(net_weight) / 1000, 3)
        if abs(float(schema_weight.get("value", 0)) - expected_net_kg) > 0.001:
            fail(f"{pid}: Product.weight does not match estimated net item mass on {language} page")
        additional = schema.get("additionalProperty") or []
        packed_properties = [
            item for item in additional
            if isinstance(item, dict) and item.get("name") == "Approximate packed shipping weight"
        ]
        if (
            not packed_properties
            or packed_properties[-1].get("value") != packed_weight
            or packed_properties[-1].get("unitText") != "g"
        ):
            fail(f"{pid}: packed shipping weight missing/mismatched in {language} Product JSON-LD")

        data = embedded_product_data(html)
        if not data:
            fail(f"{pid}: embedded product data missing on {language} page")
        for field, expected in expected_master.items():
            if data.get(field) != expected:
                fail(f"{pid}: embedded {language} product data {field} mismatch")

# The packing profile is metadata for the future parcel-packing stage. It is
# deliberately separate from measured external parcel dimensions.
leaf_profile_ids = {
    str(product.get("id"))
    for product in catalogue
    if str(product.get("subcategory_name") or product.get("subcategory") or "").casefold() == "leaf spring"
}
for estimate in estimates:
    if estimate.get("packing_profile") == "plastic_wrap_no_carton" and estimate.get("id") not in leaf_profile_ids:
        fail(f"{estimate.get('id')}: no-carton profile is reserved for leaf springs")

print(
    "Geometric weight estimates validated across canonical data, public projection, "
    f"and {len(LANGUAGES)} product-page languages: {len(estimates)} modelled products."
)
