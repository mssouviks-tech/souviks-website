#!/usr/bin/env python3
"""Apply the verified Leykart HCV/haulage/tipper catalogue expansion."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "assets" / "data"
PATCH_PATH = DATA / "leykart-catalogue-import-2026-11-27.json.gz"
CATALOGUE_PATH = DATA / "catalogue-index.json"
GST_MANIFEST_PATH = DATA / "gst-rate-candidate-overrides-2026-11-08.json"
GST_POLICY_PATH = DATA / "gst-rate-final-policy-2026-11-08.json"
BRANDS_PATH = DATA / "brands.json"

EXPECTED_PATCH_SHA256 = "3379edcd0c2bb4e302c800843ddd889eccf05869beb1ee4a74148f80499a1ee6"
APPROVAL_DATE = "2026-11-27"
EFFECTIVE_FROM = "2025-09-22"
EXPECTED_ADDITIONS = 1496
EXPECTED_UPDATES = 3

UPDATE_FIELDS = (
    "part_number", "partNumber", "mrp", "selling_price", "discount_percent",
    "discountPercent", "product_name", "name", "description", "applications",
    "vehicles", "hsn_code", "hsn_description", "hsn_confidence",
    "hsn_classification_status", "hsn_basis", "hsn_review_note",
    "hsn_reference_date", "catalogue_updated_at", "updated_at",
    "category_id", "category_name", "category", "subcategory_id",
    "subcategory_name", "subcategory", "brand_id", "brand_name", "brand",
    "leykart_source_hsn_code", "leykart_hsn_reconciliation_status",
    "leykart_source_name", "leykart_source_brand", "leykart_source_url",
    "leykart_source_last_verified", "leykart_source_price_field",
    "leykart_source_price_value", "leykart_source_price_interpretation",
)


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, data: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temporary.replace(path)


def load_patch() -> dict[str, Any]:
    if not PATCH_PATH.is_file():
        raise FileNotFoundError(PATCH_PATH)
    digest = hashlib.sha256(PATCH_PATH.read_bytes()).hexdigest()
    if digest != EXPECTED_PATCH_SHA256:
        raise ValueError(f"Leykart import archive checksum mismatch: {digest}")
    with gzip.open(PATCH_PATH, "rt", encoding="utf-8") as handle:
        patch = json.load(handle)
    if (
        patch.get("schema_version") != 1
        or patch.get("source_date") != "2026-11-26"
        or patch.get("applied_on") != APPROVAL_DATE
        or len(patch.get("records", [])) != EXPECTED_ADDITIONS
        or len(patch.get("updates", [])) != EXPECTED_UPDATES
    ):
        raise ValueError("Leykart import archive has an unsupported schema or coverage")
    return patch


def approved_gst_candidate(sources: list[str]) -> dict[str, Any]:
    return {
        "total_rate_percent": 18,
        "cgst_rate_percent": 9,
        "sgst_rate_percent": 9,
        "igst_rate_percent": 18,
        "status": "candidate_for_accountant_review",
        "effective_from": EFFECTIVE_FROM,
        "cgst_notification": "Notification No. 9/2025-Central Tax (Rate), G.S.R. 641(E), 17 September 2025",
        "igst_notification": "Notification No. 9/2025-Integrated Tax (Rate), 17 September 2025",
        "source_references": list(sources),
        "last_checked_on": APPROVAL_DATE,
        "review_note": (
            "18% GST rate marked ready under Souviks' user-confirmed GST instruction "
            "dated 27 November 2026: 9% CGST + 9% SGST for intra-State supply, or "
            "18% IGST for inter-State supply. The source applications identify "
            "commercial-vehicle haulage, tipper or HCV use; no tractor-specific "
            "reduced-rate exception is indicated for these imported SKUs."
        ),
        "accountant_approval_required": False,
        "invoice_ready": True,
        "accountant_approval_status": "approved",
    }


def verify_and_enrich_new_product(product: dict[str, Any], gst_sources: list[str]) -> None:
    product_id = str(product.get("id") or "")
    code = str(product.get("hsn_code") or "")
    if not product_id or len(code) != 8 or not code.isdigit():
        raise ValueError(f"{product_id or 'Unknown SKU'}: verified eight-digit HSN is missing")
    for field in ("mrp", "selling_price"):
        try:
            price = float(product.get(field))
        except (TypeError, ValueError):
            raise ValueError(f"{product_id}: missing {field}") from None
        if price <= 0:
            raise ValueError(f"{product_id}: {field} must be positive")

    # The user confirmed the HSN code itself. Do not invent an official tariff
    # description: the public page will show the verified code without a guess.
    product["hsn_description"] = ""
    product["hsn_confidence"] = "high"
    product["hsn_classification_status"] = "classified"
    product["hsn_basis"] = (
        "Eight-digit Leykart HSN code verified by Souviks on 27 November 2026. "
        "No separate tariff wording has been inferred."
    )
    product["hsn_review_note"] = ""
    product["hsn_reference_date"] = APPROVAL_DATE
    product["hsn_research_source"] = "Souviks-confirmed Leykart HSN code verification"
    product["hsn_research_date"] = APPROVAL_DATE

    candidate = approved_gst_candidate(gst_sources)
    product["gst_rate_candidate"] = candidate
    product["gst_rate_percent"] = 18
    product["gst_cgst_rate_percent"] = 9
    product["gst_sgst_rate_percent"] = 9
    product["gst_igst_rate_percent"] = 18
    product["gst_rate_effective_from"] = EFFECTIVE_FROM
    product["gst_rate_source_reference"] = gst_sources[0]
    product["gst_rate_basis"] = (
        "18% default GST rate confirmed ready by Souviks on 27 November 2026; "
        "9% CGST + 9% SGST intra-State or 18% IGST inter-State."
    )
    product["catalogue_updated_at"] = APPROVAL_DATE
    product["updated_at"] = APPROVAL_DATE


def approval_record(count: int, ids: list[str], previous: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "approved",
        "approved_on": APPROVAL_DATE,
        "approval_source": (
            "User-confirmed GST-ready instruction for all 1,496 newly imported Leykart "
            "products, recorded on 2026-11-27. The 18% default rate is applied with "
            "9% CGST + 9% SGST intra-State or 18% IGST inter-State."
        ),
        "scope": (
            f"GST rate candidate approval for all {count:,} catalogue products at "
            "their assigned rates; the 1,496 Leykart additions use the 18% default."
        ),
        "catalogue_product_count": count,
        "newly_approved_product_ids": ids,
        "limitation": (
            "This approval marks gst_rate_candidate.invoice_ready. HSN code verification "
            "for the Leykart additions was separately confirmed by Souviks; tariff "
            "descriptions were not inferred. This record does not itself issue tax invoices."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Validate without writing files")
    args = parser.parse_args()

    if not PATCH_PATH.is_file():
        print("No staged Leykart catalogue import; catalogue is unchanged.")
        return

    patch = load_patch()
    catalogue = read_json(CATALOGUE_PATH)
    manifest = read_json(GST_MANIFEST_PATH)
    policy = read_json(GST_POLICY_PATH)
    brands = read_json(BRANDS_PATH)

    if not isinstance(catalogue, list) or not isinstance(manifest.get("records"), list):
        raise ValueError("Catalogue or GST manifest has an unsupported structure")
    if manifest.get("schema_version") != 2 or policy.get("schema_version") != 1:
        raise ValueError("Unsupported GST manifest or policy schema")

    by_id = {str(item.get("id")): item for item in catalogue if item.get("id")}
    if len(by_id) != len(catalogue):
        raise ValueError("Canonical catalogue contains duplicate or missing product IDs")

    updates = patch["updates"]
    for row in updates:
        product_id = str(row.get("id") or "")
        current = by_id.get(product_id)
        if current is None:
            raise ValueError(f"Leykart exact-match update refers to missing SKU {product_id}")
        for field in UPDATE_FIELDS:
            value = row.get(field)
            # Do not erase previously established fitment, part references or names
            # with empty values from the Leykart listing.
            if value not in (None, "", []):
                current[field] = value

    new_ids: list[str] = []
    inserted = 0
    for source_row in patch["records"]:
        product = json.loads(json.dumps(source_row, ensure_ascii=False))
        product_id = str(product.get("id") or "")
        if not product_id:
            raise ValueError("Leykart addition without a Souviks product ID")
        existing = by_id.get(product_id)
        if existing is not None:
            if str(existing.get("part_number") or "") != str(product.get("part_number") or ""):
                raise ValueError(f"SKU collision with different part number: {product_id}")
            # Idempotent reruns preserve the catalogue record but refresh only the
            # Leykart-owned commercial and HSN/GST fields below.
            existing.update({key: value for key, value in product.items() if key in UPDATE_FIELDS})
            verify_and_enrich_new_product(existing, policy.get("default_source_references") or [])
            new_ids.append(product_id)
            continue
        verify_and_enrich_new_product(product, policy.get("default_source_references") or [])
        catalogue.append(product)
        by_id[product_id] = product
        new_ids.append(product_id)
        inserted += 1

    if len(set(new_ids)) != EXPECTED_ADDITIONS:
        raise ValueError(f"Expected {EXPECTED_ADDITIONS} unique Leykart additions, got {len(set(new_ids))}")
    new_ids = sorted(set(new_ids), key=lambda value: int(value.replace("SVKS", "")))
    catalogue.sort(key=lambda item: int(str(item.get("id", "SVKS000000")).replace("SVKS", "")))

    # Persist an explicit GST candidate record for every new SKU. Existing
    # approval entries remain unchanged, and the old pending queue is retained
    # only for IDs that are still outside the expanded approved scope.
    gst_records = manifest["records"]
    gst_by_id = {str(item.get("id")): item for item in gst_records if item.get("id")}
    if len(gst_by_id) != len(gst_records):
        raise ValueError("GST manifest contains duplicate or missing IDs")
    approved_sources = policy.get("default_source_references") or []
    if len(approved_sources) < 2:
        raise ValueError("Final GST default-rate references are missing")
    for product_id in new_ids:
        product = by_id[product_id]
        gst_by_id[product_id] = {
            "id": product_id,
            "hsn_code": product["hsn_code"],
            "gst_rate_candidate": json.loads(json.dumps(product["gst_rate_candidate"])),
        }
    manifest["records"] = sorted(gst_by_id.values(), key=lambda item: int(str(item["id"]).replace("SVKS", "")))
    manifest["record_count"] = len(manifest["records"])
    approved_id_set = set(gst_by_id)
    manifest["pending_records"] = [
        item for item in manifest.get("pending_records", [])
        if str(item.get("id")) not in approved_id_set
    ]
    manifest["status_counts"] = dict(Counter(
        str(item.get("gst_rate_candidate", {}).get("status", ""))
        for item in manifest["records"]
    ))
    manifest["current_as_of"] = APPROVAL_DATE
    manifest["source_research"] = (
        str(manifest.get("source_research", "")).rstrip(".")
        + "; expanded with Souviks-confirmed Leykart catalogue GST readiness on 2026-11-27."
    )
    manifest["note"] = (
        f"All {len(catalogue):,} catalogue products have approved, invoice-ready GST rate "
        "candidates. The default is 18% total and the one evidence-backed tractor clutch "
        "assembly exception remains 5%. The 27 November 2026 confirmation adds 1,496 "
        "Leykart HCV/haulage/tipper SKUs at 18%. HSN code verification is separate from "
        "the GST rate record; this approval does not itself issue tax invoices."
    )
    previous_manifest_approval = manifest.get("accountant_approval") or {}
    manifest_history = manifest.setdefault("accountant_approval_history", [])
    if previous_manifest_approval.get("approved_on") != APPROVAL_DATE:
        if previous_manifest_approval and not any(
            item.get("approved_on") == previous_manifest_approval.get("approved_on")
            for item in manifest_history
        ):
            manifest_history.append(previous_manifest_approval)
    manifest["accountant_approval"] = approval_record(len(catalogue), new_ids, previous_manifest_approval)

    previous_policy_approval = policy.get("accountant_approval") or {}
    policy_history = policy.setdefault("accountant_approval_history", [])
    if previous_policy_approval.get("approved_on") != APPROVAL_DATE:
        if previous_policy_approval and not any(
            item.get("approved_on") == previous_policy_approval.get("approved_on")
            for item in policy_history
        ):
            policy_history.append(previous_policy_approval)
    policy["accountant_approval"] = approval_record(len(catalogue), new_ids, previous_policy_approval)
    policy["note"] = (
        f"All {len(catalogue):,} catalogue records have invoice-ready GST rate candidates. "
        "The default is 18% total and the one specified tractor clutch-assembly exception "
        "remains 5%. The user-confirmed 27 November 2026 Leykart update extends readiness "
        "to 1,496 new HCV/haulage/tipper SKUs. HSN code verification remains a separate "
        "catalogue control. This approval does not itself issue tax invoices."
    )

    # Valueparts occurs on five verified import rows but is not yet represented in
    # the brand directory. Add a minimal entity record; enrich_entities.py derives
    # counts, categories, product links and localized brand pages from the catalogue.
    if not any(str(brand.get("id")) == "valueparts" for brand in brands):
        brands.append({
            "id": "valueparts",
            "slug": "valueparts",
            "name": "Valueparts",
            "short_name": "Valueparts",
            "logo": "",
            "logo_dimensions": [],
            "banner": "",
            "website": "",
            "country": "",
            "description": "",
            "short_description": "",
            "product_count": 0,
            "categories": [],
            "subcategories": [],
            "vehicles": [],
            "featured_products": [],
            "products": [],
            "featured": False,
            "active": True,
            "seo": {
                "title": "Valueparts Commercial Vehicle Parts | Souviks",
                "description": "Browse Valueparts commercial-vehicle replacement parts at Souviks. Check part references and product details before ordering.",
                "keywords": ["Valueparts", "commercial vehicle spare parts", "truck spare parts"],
                "canonical": "https://www.souviks.co.in/en/brands/valueparts",
            },
            "schema": {},
            "created_at": "2026-11-27T00:00:00",
            "updated_at": "2026-11-27T00:00:00",
        })

    print(json.dumps({
        "source_rows": patch["source_rows"],
        "existing_sku_updates": len(updates),
        "new_skus_expected": EXPECTED_ADDITIONS,
        "new_skus_added_this_run": inserted,
        "new_skus_present_after_run": len(new_ids),
        "catalogue_records": len(catalogue),
        "active_catalogue_records": sum(item.get("active") is not False for item in catalogue),
        "gst_invoice_ready_records": len(manifest["records"]),
        "pending_gst_records": len(manifest["pending_records"]),
        "new_hsn_status": "classified / high confidence (user-confirmed)",
        "new_gst_status": "approved / invoice-ready at 18%",
        "valueparts_brand_added": any(str(brand.get("id")) == "valueparts" for brand in brands),
        "check_only": args.check,
    }, indent=2))

    if args.check:
        return
    write_json(CATALOGUE_PATH, catalogue)
    write_json(GST_MANIFEST_PATH, manifest)
    write_json(GST_POLICY_PATH, policy)
    write_json(BRANDS_PATH, brands)
    # Consume the staged payload after a successful write. This makes the import
    # one-shot and prevents later catalogue builds from replaying stale source data.
    PATCH_PATH.unlink()


if __name__ == "__main__":
    main()