# Supplier-invoice HSN reconciliation — 6 November 2026

## Source and treatment

The supplied `hsn.xlsx` contains 1,487 product records: **1,034 populated supplier invoice HSN values and 453 blanks**. The populated values are treated as supplier-shared invoice references. The source code string is preserved exactly as supplied; six-digit codes are not padded and blank codes are not inferred.

Matching to the Souviks catalogue uses exact product names, supplier brand plus whole part/reference tokens, part-reference/title disambiguation, and high-confidence brand-plus-title matching. Manual review then validates exact catalogue part numbers, product titles, package sizes, dimensions and left/right variants. The supplier Odoo external ID is retained for traceability.

## Reconciliation results

| Measure | Count |
|---|---:|
| Populated supplier invoice HSN source rows | 1034 |
| Distinct supplier product names | 1010 |
| Source rows linked to a catalogue SKU | 890 |
| Catalogue SKUs with one consistent supplier code | 837 |
| Catalogue SKUs with conflicting supplier codes | 12 |
| Supplier rows requiring manual review | 144 |
| Brand/title review rows | 34 |
| Ambiguous part-reference rows | 8 |
| Supplier-name/code conflict rows | 4 |
| Ambiguous exact-name rows | 1 |
| No reliable catalogue match rows | 97 |
| Active SKUs with one consistent supplier reference | 837 |
| Active SKUs with conflicting supplier references | 12 |

The 1,034 populated source rows are now fully accounted for between the linked-source register (890) and the outstanding review queue (144). The 12 conflict SKUs have no single selected supplier code.

## Match methods

The first-pass automated alignment is retained as the initial matching record. The manual identity ledger now contains 66 additional supplier-source resolutions across the two manual tranches. These entries use exact part numbers, exact title/variant/package details, dimensions, and source traceability rather than score-only fuzzy matches.

## Manual reconciliation tranches — 6 November 2026

The first manual tranche added 40 source rows: 38 previously unlinked catalogue SKUs, one same-code supporting source row for an already-linked SKU, and one KF5098 source row that created a new supplier-code conflict.

The second manual tranche adds 26 further source rows:
- 16 new consistent catalogue SKU matches across Bosch diesel filter kits, ASK brake-lining variants, Mahle KS55, Texspin TX-5592 RHS and TXL grease pack sizes, Varroc left/right headlamps, and the WABCO drain valve.
- One additional GS SBAM394 source record confirms the same code already recorded for SVKS000318.
- One KFL KF5099 source record matches SVKS000743 by exact part number but has a different supplier invoice code, so that SKU is now a conflict.
- Three additional supplier-code conflict SKUs are recorded without choosing a winning code: Fleetguard FF5544 (SVKS000290), Fleetguard FS1967100 (SVKS000284), and Philips 24569ESCI (SVKS000405). Both supplier rows and both codes are retained for each.

The remaining 144 review rows were checked against the available catalogue identity evidence. They remain unlinked where the supplier reference is not in the catalogue, the actual catalogue part number differs, the source brand/title is not enough to prove identity, or duplicate SKUs/variants prevent a reliable one-to-one assignment. Examples include the Bosch F-002-919-4AR-8F8 row whose apparent URL candidate has a different actual catalogue part number, and several brake-lining, bearing, spring-pin and mounting variants where a nearby description is not a safe substitute for a match.

## Catalogue fields

The supplier invoice evidence is stored separately from the existing HSN candidate:
- `hsn_supplier_invoice_code`: one code where supplier rows agree;
- `hsn_supplier_invoice_codes`: all distinct codes associated with the SKU;
- `hsn_supplier_invoice_match_status`: `matched` or `conflict`;
- `hsn_supplier_invoice_match_methods`: the identity matching route(s);
- `hsn_supplier_invoice_source_names` and `hsn_supplier_invoice_external_ids`: source traceability;
- `hsn_supplier_invoice_source_file` and `hsn_supplier_invoice_match_date`;
- `hsn_supplier_invoice_candidate_alignment`: `agrees`, `differs`, `not_compared`, or `conflicting_supplier_codes`.

The 12 conflict SKUs have no single selected supplier code. Existing `hsn_code`, `hsn_description`, `hsn_confidence`, `hsn_classification_status`, `hsn_basis`, `hsn_review_note` and `hsn_reference_date` values remain unchanged. The catalogue builder carries supplier metadata into the active static product projection.

## Audit files

- `hsn-supplier-invoice-matches-2026-11-06.csv` lists all source rows linked to a SKU, including supplier-code conflicts.
- `hsn-supplier-invoice-review-queue-2026-11-06.csv` lists every remaining supplier row with candidate catalogue records and match scores where available.
- `assets/data/hsn-supplier-invoice-manual-resolutions.json` records the 66 identity-verified manual matches and supplier-code conflicts applied by the canonical builder.

## Tax and invoice boundary

A supplier invoice code is useful supporting evidence for how that supplier invoiced a product. It does not prove the legally correct classification for the exact article sold by Souviks. No GST rate, cess, invoice-ready status, or final classification promotion is inferred. Customer-facing HSN display remains subject to the existing classified/high-confidence rule. GST invoice generation remains separately gated.
