#!/usr/bin/env python3
"""Build a non-final, SKU-level HSN verification queue from catalogue-index.json."""
from __future__ import annotations
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "data" / "catalogue-index.json"
OUTPUT = ROOT / "docs" / "audit" / "hsn-verification-worklist.csv"
FIELDS = [
    "catalogue_id", "active", "product_name", "brand", "part_number",
    "manufacturer_part_number", "manufacturer_part_numbers", "oem_numbers",
    "cross_references", "applications", "vehicles", "product_description",
    "candidate_hsn_code", "candidate_hsn_description", "candidate_confidence",
    "classification_status", "classification_basis", "open_review_note",
    "evidence_to_close", "candidate_source_reference", "final_hsn_code",
    "final_hsn_description", "reviewed_by", "reviewed_on",
    "review_evidence_reference", "gst_rate_percent", "gst_rate_effective_from",
    "gst_rate_source_reference", "invoice_ready",
]

def evidence_for(p: dict) -> str:
    code = str(p.get("hsn_code") or "")
    if code.startswith("4010"):
        return "Manufacturer sheet plus physical measurement: V-ribbed vs plain V/synchronous profile; outside circumference; rubber-compound mass percentage (<25% vs >=25%)."
    if code.startswith("8421"):
        return "OEM/supplier filter drawing or datasheet: filter medium, complete filter apparatus vs replacement element/part, and exact OE cross-reference."
    if code.startswith("8482"):
        return "Bearing drawing/datasheet: rolling-element type, radial/thrust design, bore diameter and standalone bearing vs assembly."
    if code.startswith("8483"):
        return "OEM drawing and bill of materials: actual coupling/gear/pulley/shaft function and whether separately presented or included in a vehicle assembly."
    if code.startswith("8708"):
        return "OEM illustrated parts catalogue/drawing and fitment: dedicated vehicle function, model/variant, complete assembly vs separately presented material/fastener/bearing."
    if code.startswith("8512"):
        return "Supplier datasheet/part catalogue: headlamp/tail lamp/DRL/indicator/work-lamp/wiper function, mounting position, voltage and assembly scope."
    if code.startswith("8511"):
        return "Electrical supplier datasheet: ignition/starter/alternator system function; distinguish part from lighting, signalling, wiper, switch or relay apparatus."
    if code.startswith("8536"):
        return "Electrical datasheet: circuit function, rated voltage and whether the item is an electrical switch/relay vs a mechanical or pneumatic relay/linkage."
    if code.startswith(("3917", "7307", "7412")):
        return "Material declaration and fitting drawing: plastic vs iron/steel vs copper alloy; fitting shape and use."
    if code.startswith(("7318", "7320")):
        return "Material certificate and dimensional drawing: base metal, thread/type and whether the supplied SKU is the named fastener/spring/leaf assembly."
    if code.startswith("4016"):
        return "Material declaration and product drawing: vulcanised-rubber composition, construction and whether a standalone rubber article or part of a complete assembly."
    if code.startswith("6813"):
        return "Supplier specification: asbestos-free status, mounted vs unmounted friction material, backing plate and kit contents."
    if code.startswith(("2710", "3403", "3102", "3819", "3820")):
        return "Manufacturer SDS/TDS: full formulation, petroleum-oil percentage, BIS conformity and product's intended preparation/use."
    if code.startswith("8409"):
        return "OEM engine application/drawing: compression-ignition vs spark-ignition engine, exact engine part identity and complete/part supply."
    return p.get("hsn_review_note") or "OEM/supplier technical sheet, physical material/construction details and exact product function are required before final classification."

def flat(value) -> str:
    if isinstance(value, list):
        return " | ".join(str(x) for x in value)
    return "" if value is None else str(value)

def main() -> None:
    products = json.loads(SOURCE.read_text(encoding="utf-8"))
    unresolved = [p for p in products if p.get("hsn_classification_status") != "classified"]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for p in unresolved:
            writer.writerow({
                "catalogue_id": p.get("id", ""),
                "active": str(bool(p.get("active", False))).lower(),
                "product_name": p.get("product_name") or p.get("name") or "",
                "brand": p.get("brand_name") or p.get("brand") or "",
                "part_number": p.get("part_number") or "",
                "manufacturer_part_number": p.get("manufacturer_part_number") or "",
                "manufacturer_part_numbers": flat(p.get("manufacturer_part_numbers")),
                "oem_numbers": flat(p.get("oem_numbers")),
                "cross_references": flat(p.get("cross_references")),
                "applications": flat(p.get("applications")),
                "vehicles": flat(p.get("vehicles")),
                "product_description": p.get("description") or "",
                "candidate_hsn_code": p.get("hsn_code") or "",
                "candidate_hsn_description": p.get("hsn_description") or "",
                "candidate_confidence": p.get("hsn_confidence") or "",
                "classification_status": p.get("hsn_classification_status") or "",
                "classification_basis": p.get("hsn_basis") or "",
                "open_review_note": p.get("hsn_review_note") or "",
                "evidence_to_close": evidence_for(p),
                "candidate_source_reference": "",
                "final_hsn_code": "",
                "final_hsn_description": "",
                "reviewed_by": "",
                "reviewed_on": "",
                "review_evidence_reference": "",
                "gst_rate_percent": "",
                "gst_rate_effective_from": "",
                "gst_rate_source_reference": "",
                "invoice_ready": "FALSE",
            })
    print(f"Wrote {len(unresolved)} non-final SKU rows to {OUTPUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
