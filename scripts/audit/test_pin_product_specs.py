#!/usr/bin/env python3
"""Validate inferred dimensions and theoretical weights for catalogue pin products."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "assets" / "data"
FAMILY_RE = re.compile(r"(?:lever pin|spring pin|bell crank pin|shackle pin)", re.I)
DIMENSION_RE = re.compile(r"(\d{2})\s*(?:x|×)\s*(\d{2,3})", re.I)
LANGUAGES = ("en", "hi", "bn")
DENSITY_G_PER_MM3 = 0.00785


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


catalogue = load_json(DATA / "catalogue-index.json")
projection = load_json(DATA / "products.json")
projection_by_id = {str(p.get("id")): p for p in projection if p.get("id")}
target_rows = [
    p for p in catalogue
    if p.get("active") is not False
    and FAMILY_RE.search(str(p.get("product_name") or p.get("name") or ""))
    and DIMENSION_RE.search(str(p.get("product_name") or p.get("name") or ""))
]
if not target_rows:
    raise SystemExit("No dimensioned lever/spring/bell-crank/shackle pin products were found.")


def product_jsonld(html: str):
    scripts = re.findall(
        r'<script\b(?=[^>]*\btype=["\']application/ld\+json["\'])[^>]*>(.*?)</script\s*>',
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
    match = DIMENSION_RE.search(name)
    diameter, length = int(match.group(1)), int(match.group(2))
    if product.get("dimensions_mm") != [diameter, length]:
        raise SystemExit(f"{pid}: dimensions mismatch")
    net = math.pi * diameter * diameter * length / 4 * DENSITY_G_PER_MM3
    expected_net = round(net, 1)
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
    for field in ("dimensions_mm", "calculated_weight_g", "approx_weight_g", "weight_estimation_status"):
        if public.get(field) != product.get(field):
            raise SystemExit(f"{pid}: public projection field {field} differs from canonical catalogue")
    slug = str(product.get("slug") or "")
    if not slug:
        raise SystemExit(f"{pid}: missing slug")
    for language in LANGUAGES:
        page = ROOT / language / "products" / f"{slug}.html"
        if not page.is_file():
            raise SystemExit(f"{pid}: missing {language} static page")
        schema = product_jsonld(page.read_text(encoding="utf-8", errors="ignore"))
        if not schema or not isinstance(schema.get("weight"), dict):
            raise SystemExit(f"{pid}: missing structured weight on {language} page")
        props = schema.get("additionalProperty") or []
        prop_names = {x.get("name") for x in props if isinstance(x, dict)}
        if not {"Diameter", "Overall length", "Weight estimation status"}.issubset(prop_names):
            raise SystemExit(f"{pid}: missing structured dimensions/status on {language} page")

print(f"Pin dimension and weight estimates validated across canonical data, public projection, and {len(LANGUAGES)} languages: {len(target_rows)} products.")
