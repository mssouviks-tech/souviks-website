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


def assert_no_trailing_whitespace(path: Path) -> None:
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    offenders = [
        index for index, line in enumerate(lines, start=1)
        if line.endswith((" ", "\t"))
    ]
    assert not offenders, (
        f"{path}: trailing whitespace on CSV lines {offenders[:20]}"
    )


assert_no_trailing_whitespace(WORKLIST_PATH)

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
    assert_no_trailing_whitespace(generated)
    with generated.open(encoding="utf-8-sig", newline="") as handle:
        generated_rows = list(csv.DictReader(handle))

    if generated_rows != rows:
        mismatch = []
        for row_number, (committed_row, generated_row) in enumerate(
            zip(rows, generated_rows), start=2
        ):
            for field in committed_row.keys():
                if committed_row.get(field) != generated_row.get(field):
                    mismatch.append(
                        f"CSV line {row_number} SKU {committed_row.get('catalogue_id')}: "
                        f"{field} differs (committed={committed_row.get(field)!r}; "
                        f"generated={generated_row.get(field)!r})"
                    )
                    if len(mismatch) >= 5:
                        break
            if len(mismatch) >= 5:
                break
        if len(rows) != len(generated_rows):
            mismatch.append(
                f"row count differs (committed={len(rows)}; generated={len(generated_rows)})"
            )
        raise AssertionError(
            "Committed HSN worklist differs from deterministic generator output: "
            + " | ".join(mismatch or ["unknown CSV difference"])
        )

print(
    f"HSN review worklist contract passed: {len(rows)} non-final SKUs; "
    "no unverified GST rate/final HSN was populated; CSV regeneration matches."
)
