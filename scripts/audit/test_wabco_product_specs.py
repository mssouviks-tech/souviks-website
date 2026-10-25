#!/usr/bin/env python3
"""Validate official WABCO product specifications and safe packed weights."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets" / "data" / "wabco-product-specifications.json"
CATALOGUE_PATH = ROOT / "assets" / "data" / "catalogue-index.json"
PRODUCTS_PATH = ROOT / "assets" / "data" / "products.json"
SEARCH_PATH = ROOT / "assets" / "data" / "search.json"
LANGUAGES = ("en", "hi", "bn")


def fail(message: str) -> None:
    raise SystemExit(f"WABCO SPECIFICATION VALIDATION ERROR: {message}")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Cannot read {path.relative_to(ROOT)}: {exc}")


manifest = load_json(MANIFEST_PATH)
records = manifest.get("products") if isinstance(manifest, dict) else None
if not isinstance(records, list) or len(records) != 29:
    fail("Expected specifications for all 29 WABCO inventory entries")

catalogue = load_json(CATALOGUE_PATH)
products = load_json(PRODUCTS_PATH)
search = load_json(SEARCH_PATH)

def by_id(records):
    return {
        str(p.get("id")): p
        for p in records
        if isinstance(p, dict) and p.get("id")
    }

catalogue_by_id = by_id(catalogue)
products_by_id = by_id(products)
search_items = search if isinstance(search, list) else search.get("items", search.get("results", []))
search_by_id = by_id(search_items if isinstance(search_items, list) else [])

seen = set()
verified_count = 0
for spec in records:
    pid = str(spec.get("id") or "").strip()
    part = str(spec.get("part_number") or "").strip()
    status = str(spec.get("weight_status") or "").strip()
    kg = spec.get("manufacturer_weight_kg")
    packed_g = spec.get("approx_weight_g")
    dims = spec.get("manufacturer_dimensions_mm")
    dim_specs = spec.get("manufacturer_dimension_specs")
    source = str(spec.get("source_url") or "").strip()

    if not pid or not part or pid in seen:
        fail(f"Missing or duplicate inventory identity: {pid!r}")
    seen.add(pid)
    if not source.startswith("https://www.wabco-customercentre.com/"):
        fail(f"Missing official WABCO source URL for {pid}")
    if status not in {"verified", "unusable_zero", "unusable_0.001kg", "not_located"}:
        fail(f"Unsupported manufacturer weight status for {pid}: {status!r}")
    if kg is not None and (not isinstance(kg, (int, float)) or isinstance(kg, bool) or kg < 0):
        fail(f"Invalid manufacturer weight for {pid}: {kg!r}")
    if not isinstance(dim_specs, list) or any(not isinstance(v, str) for v in dim_specs):
        fail(f"Dimensional specifications must be a list of strings for {pid}")
    if dims is not None and (
        not isinstance(dims, list)
        or len(dims) != 3
        or any(not isinstance(v, (int, float)) or isinstance(v, bool) or v <= 0 for v in dims)
    ):
        fail(f"Overall dimensions must be a positive L × W × H triple for {pid}")

    master = catalogue_by_id.get(pid)
    public = products_by_id.get(pid)
    search_record = search_by_id.get(pid)
    if not master or str(master.get("part_number") or master.get("partNumber") or "") != part:
        fail(f"Canonical part-number identity mismatch for {pid} / {part}")
    if str(master.get("brand_name") or master.get("brand") or "").casefold() != "wabco":
        fail(f"Canonical brand mismatch for {pid}")

    expected_fields = {
        "manufacturer_weight_kg": kg,
        "manufacturer_weight_status": status,
        "manufacturer_dimensions_mm": dims,
        "manufacturer_dimension_specs": dim_specs,
        "manufacturer_spec_source": source,
        "manufacturer_spec_notes": str(spec.get("notes") or ""),
    }
    for field, value in expected_fields.items():
        if master.get(field) != value:
            fail(f"Canonical {field} mismatch for {pid}")
        if not public or public.get(field) != value:
            fail(f"Public product projection {field} mismatch for {pid}")
        if not search_record or search_record.get(field) != value:
            fail(f"Search projection {field} mismatch for {pid}")

    if status == "verified":
        verified_count += 1
        if kg is None or kg <= 0.001:
            fail(f"Verified manufacturer weight is not valid for {pid}")
        allowance = spec.get("packaging_allowance_percent")
        step = spec.get("round_up_to_g")
        if allowance != 5 or step != 50:
            fail(f"Unexpected packaging/rounding method for {pid}")
        expected_packed = math.ceil((kg * 1000 * (1 + allowance / 100)) / step) * step
        if packed_g != expected_packed:
            fail(f"Manifest packed weight mismatch for {pid}: {packed_g!r} != {expected_packed!r}")
        if master.get("approx_weight_g") != packed_g or public.get("approx_weight_g") != packed_g:
            fail(f"Checkout weight did not propagate for {pid}")
        if search_record.get("approx_weight_g") != packed_g:
            fail(f"Search index checkout weight mismatch for {pid}")
    else:
        if packed_g is not None:
            fail(f"Unverified manufacturer weight must not receive a packed estimate: {pid}")
        # This inventory set has no separately verified manual weight overrides.
        if master.get("approx_weight_g") not in (None, ""):
            fail(f"Unsafe or unverified weight is being used for checkout for {pid}")

    slug = str(master.get("slug") or "").strip()
    if not slug:
        fail(f"Missing product slug for {pid}")
    embedded_re = re.compile(r"window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});", re.S)
    for language in LANGUAGES:
        page = ROOT / language / "products" / f"{slug}.html"
        if not page.is_file():
            fail(f"Missing {language} static product page for {pid}: {slug}")
        html = page.read_text(encoding="utf-8", errors="ignore")
        match = embedded_re.search(html)
        if not match:
            fail(f"No embedded product data in {page.relative_to(ROOT)}")
        try:
            page_data = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            fail(f"Invalid embedded product JSON in {page.relative_to(ROOT)}: {exc}")
        for field, value in expected_fields.items():
            if page_data.get(field) != value:
                fail(f"{language} embedded {field} mismatch for {pid}")
        if status == "verified" and page_data.get("approx_weight_g") != packed_g:
            fail(f"{language} embedded checkout weight mismatch for {pid}")

if verified_count != 13:
    fail(f"Expected 13 usable manufacturer weights, found {verified_count}")
if catalogue_by_id["SVKS001021"].get("manufacturer_dimensions_mm") != [184.2, 112, 155]:
    fail("Official overall dimensions for part 4730170250 were not propagated")

print(
    "WABCO specifications validated: "
    f"{len(records)} inventory entries, {verified_count} usable manufacturer weights, "
    "official dimensional fields propagated to canonical data, projections, search, and all 3 languages."
)
