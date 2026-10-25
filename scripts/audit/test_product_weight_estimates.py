#!/usr/bin/env python3
"""Validate calculated product weights across canonical and generated catalogue records."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets" / "data" / "approximate-product-weights.json"
CATALOGUE_PATH = ROOT / "assets" / "data" / "catalogue-index.json"
PRODUCTS_PATH = ROOT / "assets" / "data" / "products.json"
LANGUAGES = ("en", "hi", "bn")


def fail(message: str) -> None:
    raise SystemExit(f"PRODUCT WEIGHT VALIDATION ERROR: {message}")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Cannot read {path.relative_to(ROOT)}: {exc}")


manifest = load_json(MANIFEST_PATH)
estimates = manifest.get("products") if isinstance(manifest, dict) else None
if not isinstance(estimates, list) or not estimates:
    fail("Weight manifest must contain a non-empty products array")

catalogue = load_json(CATALOGUE_PATH)
products = load_json(PRODUCTS_PATH)
catalogue_by_id = {str(p.get("id")): p for p in catalogue if isinstance(p, dict) and p.get("id")}
products_by_id = {str(p.get("id")): p for p in products if isinstance(p, dict) and p.get("id")}
seen = set()

for estimate in estimates:
    pid = str(estimate.get("id") or "").strip()
    part_number = str(estimate.get("part_number") or "").strip()
    grams = estimate.get("approx_weight_g")
    if not pid or not part_number:
        fail("Every estimate must have an id and part_number")
    if pid in seen:
        fail(f"Duplicate estimate for {pid}")
    seen.add(pid)
    if estimate.get("nut_count") != 2:
        fail(f"{pid} does not specify exactly two nuts")
    if not isinstance(grams, (int, float)) or isinstance(grams, bool) or not (0 < grams <= 200000):
        fail(f"{pid} has invalid approx_weight_g: {grams!r}")

    master = catalogue_by_id.get(pid)
    projection = products_by_id.get(pid)
    if not master or str(master.get("part_number") or master.get("partNumber") or "") != part_number:
        fail(f"Canonical catalogue identity does not match {pid} / {part_number}")
    if master.get("approx_weight_g") != grams:
        fail(f"Canonical catalogue weight mismatch for {pid}: {master.get('approx_weight_g')!r} != {grams!r}")
    if not projection or projection.get("approx_weight_g") != grams:
        fail(f"Public product projection weight mismatch for {pid}")

    slug = str(master.get("slug") or "").strip()
    if not slug:
        fail(f"Missing product slug for {pid}")
    data_pattern = re.compile(r"window\\.SOUVIKS_PRODUCT_PAGE_DATA\\s*=\\s*(\\{.*?\\});", re.S)
    for language in LANGUAGES:
        page = ROOT / language / "products" / f"{slug}.html"
        if not page.is_file():
            fail(f"Missing {language} product page for {pid}: {slug}")
        html = page.read_text(encoding="utf-8", errors="ignore")
        match = data_pattern.search(html)
        if not match:
            fail(f"{page.relative_to(ROOT)} has no embedded product data")
        try:
            page_data = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            fail(f"Invalid embedded JSON in {page.relative_to(ROOT)}: {exc}")
        if page_data.get("approx_weight_g") != grams:
            fail(f"{language} static page weight mismatch for {pid}")

print(f"Product weight estimates validated across canonical data, public projection and {len(LANGUAGES)} languages: {len(estimates)} products.")
