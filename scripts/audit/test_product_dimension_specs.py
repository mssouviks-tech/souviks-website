#!/usr/bin/env python3
"""Validate imported product dimensions, packed weights and delivery schema parity."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "assets" / "data"
MANIFEST_PATH = DATA / "product-dimension-specifications.json"
CATALOGUE_PATH = DATA / "catalogue-index.json"
PRODUCTS_PATH = DATA / "products.json"
LANGUAGES = ("en", "hi", "bn")


def fail(message: str) -> None:
    raise SystemExit(f"PRODUCT DIMENSION VALIDATION ERROR: {message}")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Cannot read {path.relative_to(ROOT)}: {exc}")


def by_id(records):
    return {
        str(product.get("id")): product
        for product in records
        if isinstance(product, dict) and product.get("id")
    }


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
records = manifest.get("products") if isinstance(manifest, dict) else None
if not isinstance(records, list) or not records:
    fail("Dimension manifest must contain a non-empty products array")

catalogue = load_json(CATALOGUE_PATH)
products = load_json(PRODUCTS_PATH)
catalogue_by_id = by_id(catalogue)
products_by_id = by_id(products)

seen = set()
for record in records:
    pid = str(record.get("id") or "").strip()
    part = str(record.get("part_number") or "").strip()
    specs = record.get("dimension_specs_mm")
    if not pid or pid in seen:
        fail(f"Missing or duplicate dimension-manifest product id: {pid!r}")
    seen.add(pid)
    if not isinstance(specs, list) or not specs:
        fail(f"{pid} has no typed dimensions")

    master = catalogue_by_id.get(pid)
    if not master:
        fail(f"{pid} is missing from canonical catalogue")
    actual_part = str(master.get("part_number") or master.get("partNumber") or "").strip()
    if actual_part != part:
        fail(f"{pid} canonical part-number identity mismatch: {actual_part!r} != {part!r}")

    master_specs = master.get("dimension_specs_mm")
    if not isinstance(master_specs, list):
        fail(f"{pid} canonical record has no dimension_specs_mm array")
    for spec in specs:
        if not isinstance(spec, dict):
            fail(f"{pid} contains a malformed dimension record")
        name = str(spec.get("name") or "").strip()
        value = spec.get("value_mm")
        source = str(spec.get("source") or "").strip()
        if (
            not name
            or not source
            or not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not math.isfinite(value)
            or value <= 0
        ):
            fail(f"{pid} contains an invalid dimension or missing provenance")
        if not any(
            item.get("name") == name
            and item.get("value_mm") == value
            and item.get("source") == source
            for item in master_specs
            if isinstance(item, dict)
        ):
            fail(f"{pid} canonical dimension missing or changed: {name}={value} mm")

    public = products_by_id.get(pid)
    if master.get("active") is False:
        if public:
            fail(f"Inactive product {pid} unexpectedly appears in public projection")
        continue
    if not public:
        fail(f"Active product {pid} is missing from public product projection")
    public_specs = public.get("dimension_specs_mm")
    if not isinstance(public_specs, list):
        fail(f"{pid} public projection has no dimension_specs_mm array")
    for spec in specs:
        if not any(
            item.get("name") == spec["name"]
            and item.get("value_mm") == spec["value_mm"]
            and item.get("source") == spec["source"]
            for item in public_specs
            if isinstance(item, dict)
        ):
            fail(f"{pid} public dimension missing or changed: {spec['name']}")

# Validate that any recorded parcel dimensions are external packed L × W × H,
# not product/engineering measurements.
for product in catalogue:
    package_dims = product.get("shipping_package_dimensions_mm")
    if package_dims is None:
        continue
    if (
        not isinstance(package_dims, list)
        or len(package_dims) != 3
        or any(
            not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not math.isfinite(value)
            or value <= 0
            or value > 5000
            for value in package_dims
        )
    ):
        fail(f"{product.get('id')} has invalid shipping_package_dimensions_mm")

# Every active item with a packed checkout weight must expose both the net
# product weight and its separately labelled packed freight weight in JSON-LD.
weighted_active = [
    product for product in catalogue
    if product.get("active") is not False
    and isinstance(product.get("approx_weight_g"), (int, float))
    and not isinstance(product.get("approx_weight_g"), bool)
    and product.get("approx_weight_g") > 0
]
for product in weighted_active:
    pid = str(product["id"])
    slug = str(product.get("slug") or "").strip()
    if not slug:
        fail(f"{pid} has a packed weight but no product slug")

    calculated_g = product.get("calculated_weight_g")
    manufacturer_kg = product.get("manufacturer_weight_kg")
    if (
        isinstance(calculated_g, (int, float))
        and not isinstance(calculated_g, bool)
        and calculated_g > 0
    ):
        expected_net_kg = round(float(calculated_g) / 1000, 3)
    elif (
        product.get("manufacturer_weight_status") == "verified"
        and isinstance(manufacturer_kg, (int, float))
        and not isinstance(manufacturer_kg, bool)
        and manufacturer_kg > 0.001
    ):
        expected_net_kg = round(float(manufacturer_kg), 3)
    else:
        fail(f"{pid} has packed checkout weight but no source-backed net weight")

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
        if abs(float(schema_weight.get("value", 0)) - expected_net_kg) > 0.001:
            fail(f"{pid}: Product.weight is not the net product weight on {language} page")

        additional = schema.get("additionalProperty") or []
        packed = [
            item for item in additional
            if isinstance(item, dict)
            and item.get("name") == "Approximate packed shipping weight"
        ]
        if not packed or packed[-1].get("value") != product["approx_weight_g"] or packed[-1].get("unitText") != "g":
            fail(f"{pid}: packed shipping weight missing/mismatched on {language} page")

        data = embedded_product_data(html)
        if not data or data.get("approx_weight_g") != product["approx_weight_g"]:
            fail(f"{pid}: embedded page data does not match packed checkout weight")
        if data.get("dimension_specs_mm") != product.get("dimension_specs_mm", []):
            fail(f"{pid}: embedded page data does not match product dimensions")

print(
    "Product dimensions and shipping weights validated: "
    f"{len(records)} dimension-manifest records, "
    f"{len(weighted_active)} active products with packed weights, "
    f"and {len(LANGUAGES)} language page projections."
)
