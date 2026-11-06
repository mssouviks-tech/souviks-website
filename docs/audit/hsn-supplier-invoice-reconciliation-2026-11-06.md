# Supplier-invoice HSN reconciliation — 6 November 2026

## Source and treatment

The supplied `hsn.xlsx` contains 1,487 product records: **1,034 populated supplier invoice HSN values and 453 blanks**. The populated values are treated as supplier-shared invoice references. The source code string is preserved exactly as supplied; six-digit codes are not padded and blank codes are not inferred.

Matching to the Souviks catalogue uses exact product names, supplier brand plus whole part/reference tokens, part-reference/title disambiguation, and high-confidence brand-plus-title matching. Part identifiers are compared on token boundaries rather than as arbitrary substrings. The supplier Odoo external ID is retained for traceability.

## Reconciliation results

| Measure | Count |
|---|---:|
| Populated supplier invoice HSN source rows | 1034 |
| Distinct supplier product names | 1010 |
| Source rows linked to a catalogue SKU | 864 |
| Catalogue SKUs with one consistent supplier code | 822 |
| Catalogue SKUs with conflicting supplier codes | 8 |
| Supplier rows requiring manual review | 170 |
| Brand/title review rows | 42 |
| Ambiguous part-reference rows | 17 |
| Supplier-name/code conflict rows | 10 |
| Ambiguous exact-name rows | 1 |
| No reliable catalogue match rows | 100 |
| Active SKUs with one consistent supplier reference | 822 |
| Active SKUs with conflicting supplier references | 8 |

Match methods:
- `exact_product_name`: 45 source rows
- `brand_and_exact_part_reference`: 612 source rows
- `exact_brand_and_product_title`: 157 source rows
- `part_reference_and_title`: 8 source rows
- `high_confidence_brand_and_title`: 2 source rows

Among the original 785 SKUs with one consistent supplier code, 231 agree with the current catalogue HSN candidate and 554 differ. The additional manual matches are not included in that comparison unless a prior candidate comparison already existed. Supplier invoice evidence remains supporting data, not a legal determination of classification.

## Manual reconciliation tranche — 6 November 2026

A second review of the supplier queue confirmed 40 additional source rows against exact catalogue part numbers or exact product/title/size/side variants. The rows cover GS centre bolts, KFL components, MEI and Meritor brake components, RKI K10, TVS Girling parts, WABCO compressor/repair kits, Varroc left/right headlamps, a Leyparts pivot pin, a Mahle separator and Texspin clutch bearings.

Of these rows, 38 identify catalogue SKUs that were not previously linked to supplier invoice evidence. One adds a second source record with the same code to SVKS000739. The KF5098 record identity-matches SVKS000742 but carries a different supplier invoice code from the code already recorded for that SKU; both values are preserved and the SKU is now marked as a conflict. As a result, the uniquely matched SKU count is 822 and the conflict count is 8.

The matching evidence and rule for each row are recorded in `assets/data/hsn-supplier-invoice-manual-resolutions.json`. The remaining review queue comprises 42 brand/title reviews, 17 ambiguous part-reference rows, 100 rows without a reliable catalogue match, 10 supplier-name/code conflicts and one ambiguous exact-name match.

## Catalogue fields

The supplier invoice evidence is stored separately from the existing HSN candidate:
- `hsn_supplier_invoice_code`: one code where supplier rows agree;
- `hsn_supplier_invoice_codes`: all distinct codes associated with the SKU;
- `hsn_supplier_invoice_match_status`: `matched` or `conflict`;
- `hsn_supplier_invoice_match_methods`: the identity matching route(s);
- `hsn_supplier_invoice_source_names` and `hsn_supplier_invoice_external_ids`: source traceability;
- `hsn_supplier_invoice_source_file` and `hsn_supplier_invoice_match_date`;
- `hsn_supplier_invoice_candidate_alignment`: `agrees`, `differs`, `not_compared`, or `conflicting_supplier_codes`.

The 8 conflict SKUs have no single selected supplier code. Existing `hsn_code`, `hsn_description`, `hsn_confidence`, `hsn_classification_status`, `hsn_basis`, `hsn_review_note` and `hsn_reference_date` values remain unchanged. The catalogue builder carries supplier metadata into the active static product projection.

## Audit files

- `hsn-supplier-invoice-matches-2026-11-06.csv` lists all source rows linked to a SKU, including supplier-code conflicts.
- `hsn-supplier-invoice-review-queue-2026-11-06.csv` lists every remaining supplier row with candidate catalogue records and match scores where available.
- `assets/data/hsn-supplier-invoice-manual-resolutions.json` records the 40 identity-verified manual matches applied by the canonical builder.

## Tax and invoice boundary

A supplier invoice code is useful supporting evidence for how that supplier invoiced a product. It does not prove the legally correct classification for the exact article sold by Souviks. No GST rate, cess, invoice-ready status, or final classification promotion is inferred. Customer-facing HSN display remains subject to the existing classified/high-confidence rule. GST invoice generation remains separately gated.
