#!/usr/bin/env python3
"""Create a reproducible catalogue-wide vehicle-application coverage audit.

This report deliberately distinguishes source-cited notes from verified
chassis fitment. Natural-language application notes require human review;
the script only measures coverage and mapping integrity.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
URL_RE = re.compile(r"https?://", re.I)
SOURCE_RE = re.compile(r"\b(?:source|sources|manufacturer|supplier|catalogue|catalog)\b", re.I)
EVIDENCE_RE = re.compile(
    r"\b(?:vehicle fitment evidence|application evidence|manufacturer application|"
    r"supplier application|exact (?:oe )?part|exact part number|exact reference|"
    r"vehicle application|listed for|lists? the exact|catalogue match|"
    r"cross.?reference|fitment reconciliation|application reconciliation)\b",
    re.I,
)
QUALIFICATION_RE = re.compile(
    r"\b(?:unverified|unconfirmed|not verified|not established|does not support|"
    r"does not establish|not substantiated|conflict|conflicting|discrepancy|"
    r"pending|verify|confirm|confirmation|reconcile|reconciliation|"
    r"do not infer|not independently|not a blanket|only at make level|"
    r"not model.?specific|not chassis.?specific|physical pack|physical marking)\b",
    re.I,
)
GENERIC_APPLICATION_RE = re.compile(
    r"\b(?:system|assembly|protection|replacement|service|drive|component|"
    r"equipment|accessory|overhaul|lubrication|transmission|brake|filtering)\b",
    re.I,
)


def as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        values = value
    elif value in (None, ""):
        values = []
    else:
        values = [value]
    return [str(item).strip() for item in values if str(item).strip()]


def product_name(product: dict[str, Any]) -> str:
    return str(
        product.get("product_name")
        or product.get("name")
        or product.get("title")
        or product.get("slug")
        or ""
    ).strip()


def brand_name(product: dict[str, Any]) -> str:
    return str(product.get("brand_name") or product.get("brand") or "").strip()


def part_number(product: dict[str, Any]) -> str:
    return str(
        product.get("part_number")
        or product.get("partNumber")
        or product.get("default_code")
        or ""
    ).strip()


def note_features(notes: list[str]) -> dict[str, bool]:
    joined = "\n".join(notes)
    return {
        "has_source_reference": bool(URL_RE.search(joined) or re.search(r"\bsource\s*:", joined, re.I)),
        "has_fitment_evidence_wording": bool(EVIDENCE_RE.search(joined)),
        "has_qualification_or_conflict_wording": bool(QUALIFICATION_RE.search(joined)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out-dir",
        default="artifacts/vehicle-application-audit",
        help="Directory for JSON, CSV and Markdown audit outputs",
    )
    args = parser.parse_args()
    out_dir = (ROOT / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    catalogue_path = ROOT / "assets/data/catalogue-index.json"
    vehicles_path = ROOT / "assets/data/vehicles.json"
    catalogue = json.loads(catalogue_path.read_text(encoding="utf-8"))
    vehicles = json.loads(vehicles_path.read_text(encoding="utf-8"))
    if not isinstance(catalogue, list) or not isinstance(vehicles, list):
        raise SystemExit("Catalogue and vehicles master files must both contain JSON arrays")

    all_products = [p for p in catalogue if isinstance(p, dict) and str(p.get("id") or "").strip()]
    active_products = [p for p in all_products if p.get("active") is not False]
    inactive_products = [p for p in all_products if p.get("active") is False]
    active_vehicles = [v for v in vehicles if isinstance(v, dict) and v.get("active") is not False]
    vehicle_by_id = {
        str(v.get("id") or "").strip(): v
        for v in active_vehicles
        if str(v.get("id") or "").strip()
    }
    product_by_id = {str(p["id"]).strip(): p for p in all_products}

    application_note_count = 0
    products_with_any_application = 0
    products_with_source_cited_note = 0
    products_with_fitment_evidence_wording = 0
    products_with_qualification = 0
    products_with_no_application_notes = 0
    products_with_no_vehicle_mapping = 0
    products_with_vehicle_mapping = 0
    products_with_unresolved_vehicle_ids = 0
    mapped_pairs: set[tuple[str, str]] = set()
    unresolved_pairs: list[dict[str, str]] = []
    worklist_rows: list[dict[str, str]] = []
    brand_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()
    confidence_buckets: Counter[str] = Counter()

    for p in active_products:
        pid = str(p["id"]).strip()
        apps = as_list(p.get("applications"))
        vehicle_ids = as_list(p.get("vehicles"))
        application_note_count += len(apps)
        if apps:
            products_with_any_application += 1
        else:
            products_with_no_application_notes += 1

        features = note_features(apps)
        products_with_source_cited_note += int(features["has_source_reference"])
        products_with_fitment_evidence_wording += int(features["has_fitment_evidence_wording"])
        products_with_qualification += int(features["has_qualification_or_conflict_wording"])

        valid_vehicle_ids = []
        missing_vehicle_ids = []
        for vid in vehicle_ids:
            if vid in vehicle_by_id:
                valid_vehicle_ids.append(vid)
                mapped_pairs.add((pid, vid))
            else:
                missing_vehicle_ids.append(vid)
                unresolved_pairs.append({"product_id": pid, "vehicle_id": vid})
        if vehicle_ids:
            products_with_vehicle_mapping += 1
        else:
            products_with_no_vehicle_mapping += 1
        if missing_vehicle_ids:
            products_with_unresolved_vehicle_ids += 1

        if features["has_source_reference"] and features["has_fitment_evidence_wording"]:
            bucket = "source-cited evidence note (requires content review)"
        elif features["has_qualification_or_conflict_wording"]:
            bucket = "qualification/conflict note (requires resolution or retained limitation)"
        elif apps:
            bucket = "application notes present; no source/evidence marker detected"
        else:
            bucket = "no application notes recorded"
        confidence_buckets[bucket] += 1

        brand = brand_name(p) or "(brand not recorded)"
        category = str(p.get("category_name") or p.get("category") or p.get("category_id") or "(category not recorded)").strip()
        brand_counts[brand] += 1
        category_counts[category] += 1
        note_text = " | ".join(apps)
        note_urls = sorted(set(re.findall(r"https?://[^\s)]+", note_text)))
        worklist_rows.append({
            "product_id": pid,
            "product_name": product_name(p),
            "brand": brand,
            "part_number": part_number(p),
            "category": category,
            "active": "true",
            "vehicle_ids": ";".join(vehicle_ids),
            "vehicle_names": ";".join(
                str(vehicle_by_id[v].get("model") or vehicle_by_id[v].get("name") or v)
                for v in valid_vehicle_ids
            ),
            "application_note_count": str(len(apps)),
            "has_source_reference": str(features["has_source_reference"]).lower(),
            "has_fitment_evidence_wording": str(features["has_fitment_evidence_wording"]).lower(),
            "has_qualification_or_conflict_wording": str(features["has_qualification_or_conflict_wording"]).lower(),
            "audit_bucket": bucket,
            "missing_vehicle_ids": ";".join(missing_vehicle_ids),
            "application_notes": note_text,
            "source_urls": ";".join(note_urls),
        })

    # Check both sides of the product <-> vehicle relation. The public vehicle
    # pages carry product lists, while the master product records carry vehicle IDs.
    inverse_pairs: set[tuple[str, str]] = set()
    inverse_unknown_products: list[dict[str, str]] = []
    inactive_vehicle_refs: list[dict[str, str]] = []
    for vehicle in active_vehicles:
        vid = str(vehicle.get("id") or "").strip()
        for pid in as_list(vehicle.get("products")):
            product = product_by_id.get(pid)
            if product is None:
                inverse_unknown_products.append({"vehicle_id": vid, "product_id": pid})
                continue
            if product.get("active") is False:
                inactive_vehicle_refs.append({"vehicle_id": vid, "product_id": pid})
                continue
            inverse_pairs.add((pid, vid))

    missing_inverse_pairs = sorted(mapped_pairs - inverse_pairs)
    product_only_pairs = sorted(inverse_pairs - mapped_pairs)

    active_vehicle_names = [
        str(v.get("model") or v.get("name") or v.get("id") or "").strip()
        for v in active_vehicles
    ]
    report = {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_files": {
            "catalogue": "assets/data/catalogue-index.json",
            "vehicles": "assets/data/vehicles.json",
        },
        "methodology": {
            "scope": "Mechanical coverage and cross-entity integrity audit of active catalogue records.",
            "important_limit": "Source/evidence markers are heuristic text signals. They do not certify fitment or replace supplier/OE/chassis verification.",
            "application_notes": "Counts every non-empty value in the product applications array as one note.",
            "vehicle_mapping": "Compares product.vehicles IDs with vehicles.json products lists.",
        },
        "counts": {
            "catalogue_records_total": len(all_products),
            "catalogue_records_active": len(active_products),
            "catalogue_records_inactive": len(inactive_products),
            "active_vehicle_records": len(active_vehicles),
            "application_notes_total": application_note_count,
            "active_products_with_application_notes": products_with_any_application,
            "active_products_without_application_notes": products_with_no_application_notes,
            "active_products_with_source_cited_note": products_with_source_cited_note,
            "active_products_with_fitment_evidence_wording": products_with_fitment_evidence_wording,
            "active_products_with_qualification_or_conflict_wording": products_with_qualification,
            "active_products_with_vehicle_mapping": products_with_vehicle_mapping,
            "active_products_without_vehicle_mapping": products_with_no_vehicle_mapping,
            "active_products_with_unresolved_vehicle_ids": products_with_unresolved_vehicle_ids,
            "product_vehicle_mapping_pairs": len(mapped_pairs),
            "vehicle_product_inverse_pairs": len(inverse_pairs),
            "missing_vehicle_inverse_pairs": len(missing_inverse_pairs),
            "vehicle_only_product_pairs": len(product_only_pairs),
            "vehicle_pages_with_active_products": sum(bool(as_list(v.get("products"))) for v in active_vehicles),
            "vehicle_pages_total": len(active_vehicles),
        },
        "heuristic_buckets": dict(confidence_buckets),
        "vehicle_names": active_vehicle_names,
        "integrity": {
            "product_vehicle_ids_not_in_active_vehicles_master": unresolved_pairs,
            "product_vehicle_pairs_missing_from_vehicles_products": [
                {"product_id": pid, "vehicle_id": vid} for pid, vid in missing_inverse_pairs
            ],
            "vehicles_products_pairs_missing_from_product_vehicles": [
                {"product_id": pid, "vehicle_id": vid} for pid, vid in product_only_pairs
            ],
            "vehicles_products_referencing_unknown_products": inverse_unknown_products,
            "vehicles_products_referencing_inactive_products": inactive_vehicle_refs,
        },
        "brand_counts": dict(brand_counts.most_common()),
        "category_counts": dict(category_counts.most_common()),
    }

    (out_dir / "vehicle-application-coverage.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    fields = list(worklist_rows[0].keys()) if worklist_rows else []
    with (out_dir / "vehicle-application-sku-worklist.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(worklist_rows)

    summary = report["counts"]
    lines = [
        "# Vehicle application coverage audit",
        "",
        f"Generated: {report['generated_at_utc']}",
        "",
        "## Catalogue coverage",
        "",
        f"- Catalogue records: **{summary['catalogue_records_total']}** ({summary['catalogue_records_active']} active; {summary['catalogue_records_inactive']} inactive).",
        f"- Active vehicle records: **{summary['active_vehicle_records']}**.",
        f"- Active products with application notes: **{summary['active_products_with_application_notes']}**.",
        f"- Active products without application notes: **{summary['active_products_without_application_notes']}**.",
        f"- Active products with at least one source-cited note: **{summary['active_products_with_source_cited_note']}**.",
        f"- Active products with fitment-evidence wording: **{summary['active_products_with_fitment_evidence_wording']}**.",
        f"- Active products with qualification/conflict wording: **{summary['active_products_with_qualification_or_conflict_wording']}**.",
        f"- Active products mapped to one or more vehicles: **{summary['active_products_with_vehicle_mapping']}**.",
        f"- Active products with no vehicle mapping: **{summary['active_products_without_vehicle_mapping']}**.",
        "",
        "## Vehicle mapping integrity",
        "",
        f"- Product-to-vehicle pairs: **{summary['product_vehicle_mapping_pairs']}**.",
        f"- Vehicle-page inverse pairs: **{summary['vehicle_product_inverse_pairs']}**.",
        f"- Product-to-vehicle pairs missing from vehicle pages: **{summary['missing_vehicle_inverse_pairs']}**.",
        f"- Vehicle-page pairs missing from product records: **{summary['vehicle_only_product_pairs']}**.",
        f"- Product records containing unknown vehicle IDs: **{summary['active_products_with_unresolved_vehicle_ids']}**.",
        f"- Vehicle pages with active products: **{summary['vehicle_pages_with_active_products']} / {summary['vehicle_pages_total']}**.",
        "",
        "## Important interpretation",
        "",
        "The source/evidence figures are heuristic coverage indicators only. A URL or an evidence phrase does not prove a SKU fits every listed model. Qualified/conflict notes must be reviewed and retained where evidence does not justify broader claims. The CSV is the SKU-level worklist for the next research pass.",
        "",
        "## Heuristic buckets",
        "",
    ]
    for key, value in confidence_buckets.most_common():
        lines.append(f"- {key}: **{value}**")
    (out_dir / "vehicle-application-coverage.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("VEHICLE APPLICATION AUDIT")
    for key, value in summary.items():
        print(f"{key}: {value}")
    print("HEURISTIC BUCKETS")
    for key, value in confidence_buckets.most_common():
        print(f"{key}: {value}")
    print(f"Report directory: {out_dir.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
