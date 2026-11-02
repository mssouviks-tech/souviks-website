#!/usr/bin/env python3
"""Validate catalogue-wide labelled component and fitment dimensions."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets" / "data" / "product-dimension-specifications.json"
CATALOGUE_PATH = ROOT / "assets" / "data" / "catalogue-index.json"
PRODUCTS_PATH = ROOT / "assets" / "data" / "products.json"
SEARCH_PATH = ROOT / "assets" / "data" / "search.json"
LANGUAGES = ("en", "hi", "bn")


def fail(message: str) -> None:
    raise SystemExit(f"CATALOGUE DIMENSION SPECIFICATION ERROR: {message}")


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


def product_nodes(value):
    """Yield Product JSON-LD nodes, including nodes inside @graph."""
    if isinstance(value, list):
        for item in value:
            yield from product_nodes(item)
    elif isinstance(value, dict):
        kind = value.get("@type")
        if kind == "Product" or (isinstance(kind, list) and "Product" in kind):
            yield value
        for key, child in value.items():
            if key == "@graph" or isinstance(child, (dict, list)):
                yield from product_nodes(child)


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
        node = next(product_nodes(payload), None)
        if node:
            return node
    return None


manifest = load_json(MANIFEST_PATH)
records = manifest.get("products") if isinstance(manifest, dict) else None
if not isinstance(records, list) or not records:
    fail("Dimension manifest must contain a non-empty products array")

catalogue = load_json(CATALOGUE_PATH)
products = load_json(PRODUCTS_PATH)
search = load_json(SEARCH_PATH)
search_items = search if isinstance(search, list) else search.get("items", search.get("results", []))
if not isinstance(search_items, list):
    fail("Search projection is not a product list")

catalogue_by_id = by_id(catalogue)
products_by_id = by_id(products)
search_by_id = by_id(search_items)
seen = set()
specification_count = 0
language_pages_checked = 0

for record in records:
    pid = str(record.get("id") or "").strip()
    part_number = str(record.get("part_number") or "").strip()
    product_name = str(record.get("product_name") or "").strip()
    specs = record.get("specs")
    if not pid or not product_name:
        fail("Every dimension record must include id and product_name")
    if pid in seen:
        fail(f"Duplicate product dimension record: {pid}")
    seen.add(pid)
    if not isinstance(specs, list) or not specs:
        fail(f"{pid} has no named component dimensions")

    master = catalogue_by_id.get(pid)
    public = products_by_id.get(pid)
    search_record = search_by_id.get(pid)
    if not master:
        fail(f"Missing canonical product: {pid}")
    if str(master.get("part_number") or master.get("partNumber") or "").strip() != part_number:
        fail(f"Canonical part-number mismatch for {pid}")
    if str(master.get("product_name") or master.get("name") or "").strip() != product_name:
        fail(f"Canonical product-name mismatch for {pid}")
    if master.get("dimensions_mm"):
        fail(f"{pid}: non-pin component specs must not be placed in the pin dimensions_mm field")

    for projection_name, projection in (
        ("canonical catalogue", master),
        ("public product", public),
        ("search", search_record),
    ):
        if not projection:
            fail(f"{pid}: missing from {projection_name} projection")
        projected_specs = projection.get("dimension_specs_mm") or []
        if "manufacturer_weight_kg" in record:
            expected_weight_fields = {
                "manufacturer_weight_kg": record.get("manufacturer_weight_kg"),
                "manufacturer_weight_status": "verified",
                "manufacturer_spec_source": record.get("manufacturer_weight_source_url"),
                "calculated_weight_g": int(round(record.get("manufacturer_weight_kg") * 1000)),
                "approx_weight_g": record.get("manufacturer_weight_approx_packed_g"),
                "weight_estimation_status": "manufacturer_verified",
            }
            import math
            expected_packed = math.ceil((record.get("manufacturer_weight_kg") * 1000 * 1.05) / 50) * 50
            if record.get("manufacturer_weight_approx_packed_g") != expected_packed:
                fail(f"{pid}: manufacturer packed-weight estimate is incorrect")
            for field, expected_value in expected_weight_fields.items():
                if projection.get(field) != expected_value:
                    fail(f"{pid}: {projection_name} {field} differs from manufacturer data")
        for spec in specs:
            if not any(
                isinstance(candidate, dict)
                and candidate.get("name") == spec.get("name")
                and candidate.get("value_mm") == spec.get("value_mm")
                and candidate.get("source") == spec.get("source")
                for candidate in projected_specs
            ):
                fail(f"{pid}: {projection_name} is missing dimension {spec.get('name')}")

    if "declared_net_content_g" in record:
        content_mass = record.get("declared_net_content_g")
        if (
            not isinstance(content_mass, (int, float))
            or isinstance(content_mass, bool)
            or content_mass <= 0
        ):
            fail(f"{pid} has invalid declared net-content mass")
        if record.get("declared_net_content_status") != "catalogue_declared_content":
            fail(f"{pid} has invalid declared net-content status")
        if not record.get("declared_net_content_source") or not record.get("declared_net_content_notes"):
            fail(f"{pid} is missing declared net-content provenance")
        for projection_name, projection in (
            ("canonical catalogue", master),
            ("public product", public),
            ("search", search_record),
        ):
            if projection.get("declared_net_content_g") != content_mass:
                fail(f"{pid}: {projection_name} is missing declared net-content mass")
            if projection.get("approx_weight_g") is not None:
                fail(f"{pid}: content-only mass must not become packed shipping weight")
    canonical_specs = master.get("dimension_specs_mm") or []
    names = set()
    for spec in specs:
        name = str(spec.get("name") or "").strip()
        value = spec.get("value_mm")
        source = str(spec.get("source") or "").strip()
        if (
            not name
            or name in names
            or not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not (0 < value < float("inf"))
            or not source
        ):
            fail(f"{pid}: malformed or duplicate dimension spec: {spec!r}")
        names.add(name)
        if not any(
            isinstance(candidate, dict)
            and candidate.get("name") == name
            and candidate.get("value_mm") == value
            and candidate.get("source") == source
            for candidate in canonical_specs
        ):
            fail(f"{pid}: canonical catalogue is missing dimension {name}")
        specification_count += 1

    slug = str(master.get("slug") or "").strip()
    if not slug:
        fail(f"{pid}: missing product slug")
    embedded_pattern = re.compile(
        r"window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});",
        re.S,
    )
    for language in LANGUAGES:
        page = ROOT / language / "products" / f"{slug}.html"
        if not page.is_file():
            fail(f"Missing {language} page for {pid}: {slug}")
        html = page.read_text(encoding="utf-8", errors="ignore")
        match = embedded_pattern.search(html)
        if not match:
            fail(f"{language} page has no embedded product data for {pid}")
        try:
            page_data = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            fail(f"Invalid embedded JSON for {pid} on {language}: {exc}")
        if "manufacturer_weight_kg" in record:
            if page_data.get("manufacturer_weight_kg") != record.get("manufacturer_weight_kg"):
                fail(f"{language} product page missing verified net weight for {pid}")
            if page_data.get("approx_weight_g") != record.get("manufacturer_weight_approx_packed_g"):
                fail(f"{language} product page missing packed weight for {pid}")
        page_specs = page_data.get("dimension_specs_mm") or []
        for spec in specs:
            if not any(
                isinstance(candidate, dict)
                and candidate.get("name") == spec["name"]
                and candidate.get("value_mm") == spec["value_mm"]
                and candidate.get("source") == spec["source"]
                for candidate in page_specs
            ):
                fail(f"{language} embedded data missing {pid} dimension {spec['name']}")

        schema = product_jsonld(html)
        if not schema:
            fail(f"{language} page has no Product JSON-LD for {pid}")
        properties = schema.get("additionalProperty") or []
        for spec in specs:
            if not any(
                isinstance(candidate, dict)
                and candidate.get("name") == spec["name"]
                and candidate.get("value") == spec["value_mm"]
                and candidate.get("unitText") == "mm"
                for candidate in properties
            ):
                fail(f"{language} Product JSON-LD missing {pid} dimension {spec['name']}")
        language_pages_checked += 1

print(
    "Catalogue dimension specifications validated: "
    f"{len(records)} products, {specification_count} named measurements, "
    f"canonical/product/search projections and {language_pages_checked} localized product pages."
)
