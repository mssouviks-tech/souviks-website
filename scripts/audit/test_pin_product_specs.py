#!/usr/bin/env python3
"""Validate complete and partial pin dimensions, including kingpin two-pin sets."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "assets" / "data"
FAMILY_RE = re.compile(
    r"(?:lever pin|spring pin|bell crank pin|shackle pin|front pin|king\\s*pin\\s*shaft)",
    re.I,
)
DIMENSION_RE = re.compile(r"(\\d{2})\\s*(?:x|×)\\s*(\\d{2,3})", re.I)
LANGUAGES = ("en", "hi", "bn")
DENSITY_G_PER_MM3 = 0.00785

# These kingpin shafts are sold as two-pin sets. Their overall lengths are
# cross-referenced from equivalent Tata axle/oversize listings published by
# Rajindra Mechanical Works; they are not Texspin engineering-drawing values.
KINGPIN_DIMENSION_EXPECTATIONS = {
    "SVKS000550": [38.25, 205],
    "SVKS000836": [38.35, 205],
    "SVKS000837": [38.45, 205],
    "SVKS000838": [38.65, 205],
    "SVKS000839": [38.75, 205],
    "SVKS001136": [35.10, 204],
    "SVKS001137": [35.20, 204],
    "SVKS001138": [35.30, 204],
}
PARTIAL_DIMENSION_EXPECTATIONS = {
    "SVKS000254": [("Hole diameter", 50, "product_name")],
    "SVKS000300": [
        ("Specified pin size (1)", 42, "product_name"),
        ("Specified pin size (2)", 35, "product_name"),
    ],
    "SVKS000723": [("Specified hanger size", 14, "product_name")],
    "SVKS000737": [("Pin diameter", 30, "product_name")],
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


catalogue = load_json(DATA / "catalogue-index.json")
projection = load_json(DATA / "products.json")
projection_by_id = {str(p.get("id")): p for p in projection if p.get("id")}
target_rows = [
    p for p in catalogue
    if p.get("active") is not False
    and (
        (
            FAMILY_RE.search(str(p.get("product_name") or p.get("name") or ""))
            and DIMENSION_RE.search(str(p.get("product_name") or p.get("name") or ""))
        )
        or str(p.get("id")) in KINGPIN_DIMENSION_EXPECTATIONS
    )
]


def product_jsonld(html: str):
    scripts = re.findall(
        r"""<script\\b(?=[^>]*\\btype=["']application/ld\\+json["'])[^>]*>(.*?)</script\\s*>""",
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


for product in target_rows:
    pid = str(product["id"])
    name = str(product.get("product_name") or product.get("name") or "")
    if pid in KINGPIN_DIMENSION_EXPECTATIONS:
        diameter, length = KINGPIN_DIMENSION_EXPECTATIONS[pid]
        quantity = 2
        if product.get("dimensions_source") != "external_cross_reference_supplier_specification_not_manufacturer_verified":
            raise SystemExit(f"{pid}: missing external cross-reference provenance")
        if product.get("weight_calculation_quantity") != quantity:
            raise SystemExit(f"{pid}: a kingpin set must calculate two pins")
    else:
        match = DIMENSION_RE.search(name)
        if not match:
            raise SystemExit(f"{pid}: the named dimension pair is no longer present")
        diameter, length = int(match.group(1)), int(match.group(2))
        quantity = int(product.get("weight_calculation_quantity") or 1)

    if product.get("dimensions_mm") != [diameter, length]:
        raise SystemExit(f"{pid}: dimensions mismatch")
    theoretical_net = (
        math.pi * diameter * diameter * length / 4
        * DENSITY_G_PER_MM3 * quantity
    )
    expected_net = round(theoretical_net, 1)
    if product.get("calculated_weight_g") != expected_net:
        raise SystemExit(f"{pid}: calculated_weight_g mismatch")
    expected_packed = math.ceil((expected_net * 1.05) / 50) * 50
    if product.get("approx_weight_g") != expected_packed:
        raise SystemExit(f"{pid}: approx_weight_g mismatch")
    if product.get("weight_estimation_status") != "estimated":
        raise SystemExit(f"{pid}: missing estimated status")
    if not product.get("weight_estimation_method") or not product.get("dimensions_source"):
        raise SystemExit(f"{pid}: missing estimation provenance")

    public = projection_by_id.get(pid)
    if not public:
        raise SystemExit(f"{pid}: missing from public product projection")
    for field in (
        "dimensions_mm",
        "calculated_weight_g",
        "approx_weight_g",
        "weight_estimation_status",
        "weight_calculation_quantity",
    ):
        if public.get(field) != product.get(field):
            raise SystemExit(f"{pid}: public projection field {field} differs from canonical data")

    slug = str(product.get("slug") or "")
    if not slug:
        raise SystemExit(f"{pid}: missing slug")
    for language in LANGUAGES:
        page = ROOT / language / "products" / f"{slug}.html"
        if not page.is_file():
            raise SystemExit(f"{pid}: missing {language} static page")
        html = page.read_text(encoding="utf-8", errors="ignore")
        schema = product_jsonld(html)
        if not schema or not isinstance(schema.get("weight"), dict):
            raise SystemExit(f"{pid}: missing structured weight on {language} page")
        properties = schema.get("additionalProperty") or []
        property_names = {
            item.get("name") for item in properties if isinstance(item, dict)
        }
        required = {"Diameter", "Overall length", "Weight estimation status"}
        if not required.issubset(property_names):
            raise SystemExit(f"{pid}: missing structured dimensions/status on {language} page")
        data_match = re.search(
            r"""window\\.SOUVIKS_PRODUCT_PAGE_DATA\\s*=\\s*(\\{.*?\\});""",
            html,
            re.S,
        )
        if not data_match:
            raise SystemExit(f"{pid}: missing embedded product data on {language} page")
        embedded = json.loads(data_match.group(1))
        if embedded.get("dimensions_mm") != product.get("dimensions_mm"):
            raise SystemExit(f"{pid}: embedded dimensions differ on {language} page")


for pid, expected_specs in PARTIAL_DIMENSION_EXPECTATIONS.items():
    product = next((p for p in catalogue if str(p.get("id")) == pid), None)
    if not product:
        raise SystemExit(f"{pid}: missing partial-dimension product")
    expected = [
        {"name": name, "value_mm": value, "source": source}
        for name, value, source in expected_specs
    ]
    if product.get("dimension_specs_mm") != expected:
        raise SystemExit(f"{pid}: typed partial dimension specs mismatch")
    if (
        product.get("dimensions_mm")
        or product.get("calculated_weight_g")
        or product.get("approx_weight_g")
    ):
        raise SystemExit(f"{pid}: do not infer a length or weight from partial measurements")

    public = projection_by_id.get(pid)
    if not public or public.get("dimension_specs_mm") != expected:
        raise SystemExit(f"{pid}: partial specs missing from public projection")
    if public.get("calculated_weight_g") or public.get("approx_weight_g"):
        raise SystemExit(f"{pid}: partial measurements must not create a public weight")

    slug = str(product.get("slug") or "")
    if not slug:
        raise SystemExit(f"{pid}: missing slug")
    for language in LANGUAGES:
        page = ROOT / language / "products" / f"{slug}.html"
        if not page.is_file():
            raise SystemExit(f"{pid}: missing {language} static page")
        html = page.read_text(encoding="utf-8", errors="ignore")
        data_match = re.search(
            r"""window\\.SOUVIKS_PRODUCT_PAGE_DATA\\s*=\\s*(\\{.*?\\});""",
            html,
            re.S,
        )
        if not data_match:
            raise SystemExit(f"{pid}: missing embedded product data on {language} page")
        embedded = json.loads(data_match.group(1))
        if embedded.get("dimension_specs_mm") != expected:
            raise SystemExit(f"{pid}: partial specs missing from {language} page data")
        schema = product_jsonld(html)
        properties = schema.get("additionalProperty") or [] if schema else []
        actual = {
            (item.get("name"), item.get("value"))
            for item in properties if isinstance(item, dict)
        }
        if not all((spec["name"], spec["value_mm"]) in actual for spec in expected):
            raise SystemExit(f"{pid}: partial dimensions missing from {language} Product JSON-LD")

print(
    "Pin specification audit passed: "
    f"{len(target_rows)} full-dimension/weight estimates across canonical data, "
    f"public projection and {len(LANGUAGES)} languages; "
    f"{len(PARTIAL_DIMENSION_EXPECTATIONS)} partial-dimension products retained without inferred weights."
)
