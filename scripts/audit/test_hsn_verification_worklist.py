#!/usr/bin/env python3
"""Fail-closed contract for the HSN review queue."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
catalogue = json.loads((ROOT / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
with (ROOT / "docs/audit/hsn-verification-worklist.csv").open(encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
expected = {p["id"] for p in catalogue if p.get("hsn_classification_status") != "classified"}
actual = {row["catalogue_id"] for row in rows}
assert len(rows) == len(expected), f"row count {len(rows)} != unresolved catalogue count {len(expected)}"
assert actual == expected, f"worklist mismatch: missing={sorted(expected-actual)[:10]}, extra={sorted(actual-expected)[:10]}"
assert len(actual) == len(rows), "duplicate catalogue IDs in HSN worklist"
for row in rows:
    assert row["invoice_ready"] == "FALSE", row["catalogue_id"]
    assert not row["gst_rate_percent"], row["catalogue_id"]
    assert not row["final_hsn_code"], row["catalogue_id"]
    assert row["candidate_hsn_code"], row["catalogue_id"]
    assert row["evidence_to_close"], row["catalogue_id"]
for product in catalogue:
    assert product.get("hsn_code"), product.get("id")
    assert product.get("hsn_classification_status") in {"classified", "provisional", "review_required"}, product.get("id")
print(f"HSN review worklist contract passed: {len(rows)} non-final SKUs; no unverified GST rate or final HSN was populated.")
