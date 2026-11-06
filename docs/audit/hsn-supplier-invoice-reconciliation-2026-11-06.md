# Supplier-invoice HSN reconciliation — 6 November 2026

## Source and treatment

The supplied `hsn.xlsx` contains 1,487 product records: **1,034 populated supplier invoice HSN values and 453 blanks**. The populated values are treated as supplier-shared invoice references. The source code string is preserved exactly as supplied; six-digit codes are not padded and blank codes are not inferred.

Matching to the Souviks catalogue uses exact product names, supplier brand plus whole part/reference tokens, part-reference/title disambiguation, and high-confidence brand-plus-title matching. Part identifiers are compared on token boundaries rather than as arbitrary substrings. The supplier Odoo external ID is retained for traceability.

## Reconciliation results

| Measure | Count |
|---|---:|
| Populated supplier invoice HSN source rows | 1034 |
| Distinct supplier product names | 1010 |
| Source rows linked to a catalogue SKU | 824 |
| Catalogue SKUs with one consistent supplier code | 785 |
| Catalogue SKUs with conflicting supplier codes | 7 |
| Supplier rows requiring manual review | 210 |
| Of which: plausible/ambiguous catalogue matches | 95 |
| Of which: no reliable catalogue match found | 115 |
| Active SKUs with one consistent supplier reference | 785 |
| Active SKUs with conflicting supplier references | 7 |

Match methods:
- `exact_product_name`: 45 source rows
- `brand_and_exact_part_reference`: 612 source rows
- `exact_brand_and_product_title`: 157 source rows
- `part_reference_and_title`: 8 source rows
- `high_confidence_brand_and_title`: 2 source rows

Among the 785 SKUs with one consistent supplier code, 231 agree with the current catalogue HSN candidate and 554 differ. This is recorded as a comparison, not a decision that the supplier or catalogue candidate is legally definitive.

## Catalogue fields

The supplier invoice evidence is stored separately from the existing HSN candidate:
- `hsn_supplier_invoice_code`: one code where supplier rows agree;
- `hsn_supplier_invoice_codes`: all distinct codes associated with the SKU;
- `hsn_supplier_invoice_match_status`: `matched` or `conflict`;
- `hsn_supplier_invoice_match_methods`: the identity matching route(s);
- `hsn_supplier_invoice_source_names` and `hsn_supplier_invoice_external_ids`: source traceability;
- `hsn_supplier_invoice_source_file` and `hsn_supplier_invoice_match_date`;
- `hsn_supplier_invoice_candidate_alignment`: `agrees`, `differs`, or `conflicting_supplier_codes`.

The 7 conflict SKUs have no single selected supplier code. Existing `hsn_code`, `hsn_description`, `hsn_confidence`, `hsn_classification_status`, `hsn_basis`, `hsn_review_note` and `hsn_reference_date` values remain unchanged. The catalogue builder carries supplier metadata into the active static product projection.

## Audit files

- `hsn-supplier-invoice-matches-2026-11-06.csv` lists all source rows linked to a SKU, including supplier-code conflicts.
- `hsn-supplier-invoice-review-queue-2026-11-06.csv` lists every remaining supplier row with candidate catalogue records and match scores where available.

## Tax and invoice boundary

A supplier invoice code is useful supporting evidence for how that supplier invoiced a product. It does not prove the legally correct classification for the exact article sold by Souviks. No GST rate, cess, invoice-ready status, or final classification promotion is inferred. Customer-facing HSN display remains subject to the existing classified/high-confidence rule. GST invoice generation remains separately gated.
