#!/usr/bin/env python3
"""Fail-closed and reproducibility contract for the HSN review queue."""
import csv
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOGUE_PATH = ROOT / "assets/data/catalogue-index.json"
WORKLIST_PATH = ROOT / "docs/audit/hsn-verification-worklist.csv"
BUILDER_PATH = ROOT / "scripts/audit/build_hsn_verification_worklist.py"

catalogue = json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))
with WORKLIST_PATH.open(encoding="utf-8-sig", newline="") as handle:
    rows = list(csv.DictReader(handle))

expected = {
    product["id"] for product in catalogue
    if product.get("hsn_classification_status") != "classified"
}
actual = {row["catalogue_id"] for row in rows}
assert len(rows) == len(expected), (
    f"row count {len(rows)} != unresolved catalogue count {len(expected)}"
)
assert actual == expected, (
    f"worklist mismatch: missing={sorted(expected-actual)[:10]}, "
    f"extra={sorted(actual-expected)[:10]}"
)
assert len(actual) == len(rows), "duplicate catalogue IDs in HSN worklist"

for row in rows:
    assert row["invoice_ready"] == "FALSE", row["catalogue_id"]
    assert not row["gst_rate_percent"], row["catalogue_id"]
    assert not row["final_hsn_code"], row["catalogue_id"]
    assert row["candidate_hsn_code"], row["catalogue_id"]
    assert row["evidence_to_close"], row["catalogue_id"]

for product in catalogue:
    assert product.get("hsn_code"), product.get("id")
    assert product.get("hsn_classification_status") in {
        "classified", "provisional", "review_required"
    }, product.get("id")

# Rebuild into a temporary path and require byte-for-byte equality. This
# prevents the committed CSV and its generator from drifting independently.
with tempfile.TemporaryDirectory(prefix="souviks-hsn-") as temp_dir:
    generated = Path(temp_dir) / "hsn-verification-worklist.csv"
    env = os.environ.copy()
    env["HSN_WORKLIST_OUTPUT"] = str(generated)
    subprocess.run(
        [sys.executable, str(BUILDER_PATH)],
        cwd=ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    assert generated.read_bytes() == WORKLIST_PATH.read_bytes(), (
        "Committed HSN worklist differs from deterministic generator output"
    )

print(
    f"HSN review worklist contract passed: {len(rows)} non-final SKUs; "
    "no unverified GST rate/final HSN was populated; CSV regeneration matches."
)
