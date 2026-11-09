#!/usr/bin/env python3
"""Verify application notes are visible on every public product detail page."""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))
from application_display import public_applications  # noqa: E402

# Internal evidence remains in the canonical catalogue but must never be part
# of customer-facing application projections. Ordinary application names and
# component-system descriptions must remain available.
assert public_applications([
    "Front Suspension System",
    "Supplier / product-code conflict: verify source and full code before ordering.",
    "Exact-code source reconciliation (JAI Spring Price List): Source: https://example.invalid",
    "Fitment qualification (catalogue-only audit): not independently verified.",
    "Commercial-vehicle hydraulic brake systems requiring DOT 4 brake fluid.",
]) == [
    "Front Suspension System",
    "Commercial-vehicle hydraulic brake systems requiring DOT 4 brake fluid.",
]
assert public_applications(["Trailer Suspension System"]) == ["Trailer Suspension System"]
assert public_applications(["https://example.invalid/source"]) == []
CATALOGUE_PATH = ROOT / "assets" / "data" / "catalogue-index.json"
LABELS = r"(?:Applications|अनुप्रयोग|एप्लिकेशन|उपयोग|অ্যাপ्लिकেশন|প্রয়োগ|ব্যবহার)"
FALLBACKS = {
    "en": "Confirm by part number",
    "hi": "पार्ट नंबर से पुष्टि करें",
    "bn": "পার্ট নম্বর দিয়ে নিশ্চিত করুন",
}

catalogue = json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))
active_products = [
    product for product in catalogue
    if isinstance(product, dict)
    and product.get("active") is not False
    and str(product.get("id") or "").strip()
]

missing_pages: list[str] = []
stale_embedded: list[str] = []
missing_summary: list[str] = []
missing_public_lists: list[str] = []

for product in active_products:
    product_id = str(product["id"]).strip()
    slug = str(product.get("slug") or "").strip()
    if not slug:
        missing_pages.append(f"{product_id}: missing slug")
        continue

    applications = public_applications(product.get("applications"))
    expected_summary = ", ".join(applications[:2]) if applications else None
    expected_items = applications or []

    for language in ("en", "hi", "bn"):
        path = ROOT / language / "products" / f"{slug}.html"
        label = f"{language}/products/{slug}.html"
        if not path.is_file():
            missing_pages.append(label)
            continue

        page = path.read_text(encoding="utf-8")
        embedded_match = re.search(
            r"window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});",
            page,
            flags=re.S,
        )
        if not embedded_match:
            stale_embedded.append(f"{label}: embedded product data missing")
        else:
            try:
                embedded = json.loads(embedded_match.group(1))
            except json.JSONDecodeError:
                stale_embedded.append(f"{label}: embedded product data is invalid")
            else:
                embedded_apps = embedded.get("applications")
                if embedded_apps != applications:
                    stale_embedded.append(f"{label}: embedded applications differ from catalogue")

        summary_match = re.search(
            r"<div\b[^>]*class=[\"'][^\"']*\bpdp-row\b[^\"']*[\"'][^>]*>\s*"
            r"<strong>\s*" + LABELS + r"\s*</strong>\s*<span>(.*?)</span>\s*</div>",
            page,
            flags=re.I | re.S,
        )
        if not summary_match:
            missing_summary.append(label)
        elif expected_summary is not None:
            summary_value = html.unescape(summary_match.group(1)).strip()
            if summary_value != expected_summary:
                missing_summary.append(f"{label}: summary does not show first two application entries")
        elif html.unescape(summary_match.group(1)).strip() != FALLBACKS[language]:
            missing_summary.append(f"{label}: empty application fallback is missing")

        list_match = re.search(
            r"<div\s+class=[\"']pdp-description-card[\"']>\s*<h3>\s*"
            + LABELS
            + r"\s*</h3>\s*<ul>(.*?)</ul>",
            page,
            flags=re.I | re.S,
        )
        if not list_match:
            missing_public_lists.append(label)
            continue

        rendered_items = [
            html.unescape(item).strip()
            for item in re.findall(r"<li>(.*?)</li>", list_match.group(1), flags=re.S)
        ]
        expected_rendered = expected_items or [FALLBACKS[language]]
        if rendered_items != expected_rendered:
            missing_public_lists.append(
                f"{label}: rendered {len(rendered_items)} item(s), expected {len(expected_rendered)}"
            )

assert not missing_pages, "Missing public product pages: " + "; ".join(missing_pages[:20])
assert not stale_embedded, "Product-page application data is stale: " + "; ".join(stale_embedded[:20])
assert not missing_summary, "Public application summary is missing/stale: " + "; ".join(missing_summary[:20])
assert not missing_public_lists, "Public Applications lists are missing/stale: " + "; ".join(missing_public_lists[:20])

print(
    f"Public application display passed: {len(active_products)} active products "
    f"checked across en/hi/bn ({len(active_products) * 3} public PDPs)."
)
