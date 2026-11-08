#!/usr/bin/env python3
"""Build a deterministic non-final HSN verification queue from catalogue-index.json."""
from __future__ import annotations

import csv
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "data" / "catalogue-index.json"
OUTPUT = Path(os.environ.get(
    "HSN_WORKLIST_OUTPUT",
    str(ROOT / "docs" / "audit" / "hsn-verification-worklist.csv"),
))
SOURCE_REFERENCES = {
    "SVKS000250": "https://www.souviks.co.in/en/categories/cooling-system",
    "SVKS000359": "https://www.boschaftermarket.com/xrm/media/images/country_specific/in/services_and_support_1/downloads_10/pdf_5/cv_filter_catalogue.pdf",
    "SVKS000373": "https://www.souviks.co.in/en/categories/fasteners-hardware",
    "SVKS000276": "https://www.souviks.co.in/en/products/f0987915-pivot-pin-relay-drop-arm",
    "SVKS000761": "https://www.souviks.co.in/en/products/f0987915-pivot-pin-relay-drop-arm",
    "SVKS000412": "https://www.amitautomotive.in/images/pix-belt.pdf",
    "SVKS000413": "https://www.amitautomotive.in/images/pix-belt.pdf",
    "SVKS000414": "https://www.amitautomotive.in/images/pix-belt.pdf",
    "SVKS000670": "https://www.souviks.co.in/en/categories/electricals",
    "SVKS000845": "https://www.souviks.co.in/en/categories/electricals",
    "SVKS000846": "https://www.souviks.co.in/en/categories/electricals",
    "SVKS000832": "https://www.souviks.co.in/en/vehicles/tata-ace",
    "SVKS000862": "https://www.souviks.co.in/en/categories/electricals",
    "SVKS000863": "https://www.souviks.co.in/en/categories/electricals",
    "SVKS000978": "https://oswalstorage1.blob.core.windows.net/univomrimg21/JaipurGreaterPDF/PDF/NitTender/jmc07dcgarrage_Tender_13881.pdf",
    "SVKS001133": "https://www.seair.co.in/ashok-leyland-spare-parts-export-data/country-south-africa/indian-port-banglore-air-cargo/april.aspx",
    "SVKS000286": "https://www.souviks.co.in/en/categories/engine-components",
    "SVKS000570": "https://unomindakart.com//brochure/uno-minda-lsc-24v87-lift-axle-solenoid-for-ashok-leyland-universal-24v",
}
for number in range(852, 862):
    SOURCE_REFERENCES[f"SVKS{number:06d}"] = "https://www.souviks.co.in/en/categories/electricals"

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


def evidence_for(product: dict) -> str:
    code = str(product.get("hsn_code") or "")
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
    return product.get("hsn_review_note") or "OEM/supplier technical sheet, physical material/construction details and exact product function are required before final classification."


def clean_cell(value) -> str:
    """Normalize whitespace without changing application/source wording."""
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.rstrip(" \t") for line in text.split("\n")).strip(" \t\n")


def flat(value) -> str:
    if isinstance(value, list):
        return " | ".join(clean_cell(item) for item in value if clean_cell(item))
    return clean_cell(value)


def main() -> None:
    products = json.loads(SOURCE.read_text(encoding="utf-8"))
    unresolved = [
        product for product in products
        if product.get("hsn_classification_status") != "classified"
    ]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        for product in unresolved:
            product_id = str(product.get("id") or "")
            row = {
                "catalogue_id": product_id,
                "active": str(bool(product.get("active", False))).lower(),
                "product_name": product.get("product_name") or product.get("name") or "",
                "brand": product.get("brand_name") or product.get("brand") or "",
                "part_number": product.get("part_number") or "",
                "manufacturer_part_number": product.get("manufacturer_part_number") or "",
                "manufacturer_part_numbers": flat(product.get("manufacturer_part_numbers")),
                "oem_numbers": flat(product.get("oem_numbers")),
                "cross_references": flat(product.get("cross_references")),
                "applications": flat(product.get("applications")),
                "vehicles": flat(product.get("vehicles")),
                "product_description": product.get("description") or "",
                "candidate_hsn_code": product.get("hsn_code") or "",
                "candidate_hsn_description": product.get("hsn_description") or "",
                "candidate_confidence": product.get("hsn_confidence") or "",
                "classification_status": product.get("hsn_classification_status") or "",
                "classification_basis": product.get("hsn_basis") or "",
                "open_review_note": product.get("hsn_review_note") or "",
                "evidence_to_close": evidence_for(product),
                "candidate_source_reference": SOURCE_REFERENCES.get(product_id, ""),
                "final_hsn_code": "",
                "final_hsn_description": "",
                "reviewed_by": "",
                "reviewed_on": "",
                "review_evidence_reference": "",
                "gst_rate_percent": "",
                "gst_rate_effective_from": "",
                "gst_rate_source_reference": "",
                "invoice_ready": "FALSE",
            }
            writer.writerow({
                key: clean_cell(value) if isinstance(value, str) else value
                for key, value in row.items()
            })
    print(f"Wrote {len(unresolved)} non-final SKU rows to {OUTPUT}")


if __name__ == "__main__":
    main()
