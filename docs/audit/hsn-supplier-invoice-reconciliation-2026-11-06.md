# Supplier-invoice HSN reconciliation — 6 November 2026

## Source and treatment

The supplied `hsn.xlsx` contains 1,487 product records: **1,034 populated supplier invoice HSN values and 453 blanks**. The populated values are treated as supplier-shared invoice references. The source code string is preserved exactly as supplied; six-digit codes are not padded and blank codes are not inferred.

Matching to the Souviks catalogue uses exact product names, supplier brand plus whole part/reference tokens, part-reference/title disambiguation, and high-confidence brand-plus-title matching. Manual review validates exact catalogue part numbers, product titles, package sizes, dimensions and left/right variants. The supplier Odoo external ID is retained for traceability.

## Reconciliation results

| Measure | Count |
|---|---:|
| Populated supplier invoice HSN source rows | 1034 |
| Distinct supplier product names | 1010 |
| Source rows linked to a catalogue SKU | 897 |
| Catalogue SKUs with one consistent supplier code | 840 |
| Catalogue SKUs with conflicting supplier codes | 14 |
| Supplier rows requiring manual review | 137 |
| Brand/title review rows | 34 |
| Ambiguous part-reference rows | 5 |
| Supplier-name/code conflict rows | 4 |
| Ambiguous exact-name rows | 1 |
| No reliable catalogue match rows | 95 |
| Active SKUs with one consistent supplier reference | 840 |
| Active SKUs with conflicting supplier references | 14 |

The 1,034 populated source rows are fully accounted for between the linked-source register (897) and the outstanding review queue (137). The 14 conflict SKUs have no single selected supplier code.

## Manual identity review

The manual identity ledger now contains 73 additional supplier-source resolutions across three tranches:
- The first tranche added 40 source rows: 38 previously unlinked catalogue SKUs, one same-code supporting source record for an already-linked SKU, and one KF5098 source row that created a supplier-code conflict.
- The second tranche added 26 source rows. It linked 16 new consistent SKUs across Bosch diesel filter kits, ASK brake-lining variants, Mahle KS55, Texspin TX-5592 RHS and TXL grease pack sizes, Varroc left/right headlamps, and the WABCO drain valve. It also added one same-code GS SBAM394 source record, moved KFL KF5099 (SVKS000743) into conflict, and added three additional conflict SKUs: Fleetguard FF5544 (SVKS000290), Fleetguard FS1967100 (SVKS000284), and Philips 24569ESCI (SVKS000405).
- The third tranche added five Texspin source rows. TX-1888180 WH maps to SVKS000486 by the full Texspin part number, while its two invoice rows carry different codes and remain a conflict. TX-27WH (O-1511) maps to SVKS000487 by the full reference and application. TX-45128SC maps to existing SKU SVKS000489 by exact part number, but its new invoice code differs from the already linked supplier row, so it becomes a conflict. TX-539/532X maps to SVKS000522 by exact Texspin part number; the catalogue item is described as a wheel twin kit containing two bearings, while the invoice line calls it taper roller bearings, so the title variance is explicitly documented.
- A fourth tranche added two cross-brand exact part-number matches: MEI SMS3007 to Meritor SKU SVKS000764 (distinguished from its LH variant), and Leyparts FA0067900 to the exact brake-lining part-number SKU SVKS000282. These brand-label differences are retained explicitly as source provenance.

The current 14 conflicts include the eight conflicts present after the first manual tranche, the KF5099, FF5544, FS1967100 and Philips conflicts added in the second tranche, and the TX-1888180 WH and TX-45128SC conflicts added in the third tranche. All source rows and distinct supplier codes are retained; no winning supplier HSN has been selected.

The remaining 139 review rows were checked against available catalogue identity evidence. They remain unlinked where the supplier reference is absent, the actual catalogue part number differs, brand/title alone cannot prove identity, or duplicate SKUs/variants prevent a reliable one-to-one assignment. Examples include the Bosch F-002-919-4AR-8F8 row whose apparent URL candidate has a different actual catalogue part number, and several brake-lining, bearing, spring-pin and mounting variants where a nearby description is not a safe substitute for a match.

## Catalogue fields

Supplier invoice evidence is stored separately from existing catalogue HSN classification:
- `hsn_supplier_invoice_code`: one code where supplier rows agree;
- `hsn_supplier_invoice_codes`: all distinct codes associated with the SKU;
- `hsn_supplier_invoice_match_status`: `matched` or `conflict`;
- `hsn_supplier_invoice_match_methods`: the identity matching route(s);
- `hsn_supplier_invoice_source_names` and `hsn_supplier_invoice_external_ids`: source traceability;
- `hsn_supplier_invoice_source_file` and `hsn_supplier_invoice_match_date`;
- `hsn_supplier_invoice_candidate_alignment`: `agrees`, `differs`, `not_compared`, or `conflicting_supplier_codes`.

The 14 conflict SKUs have no single selected supplier code. Existing `hsn_code`, `hsn_description`, `hsn_confidence`, `hsn_classification_status`, `hsn_basis`, `hsn_review_note` and `hsn_reference_date` values remain unchanged. The canonical catalogue builder carries supplier metadata into the active static product projection.

## Audit files

- `hsn-supplier-invoice-matches-2026-11-06.csv` lists all source rows linked to a SKU, including supplier-code conflicts.
- `hsn-supplier-invoice-review-queue-2026-11-06.csv` lists every remaining supplier row with candidate catalogue records and match scores where available.
- `assets/data/hsn-supplier-invoice-manual-resolutions.json` records the 73 identity-verified manual matches and supplier-code conflicts applied by the canonical builder.

## Tax and invoice boundary

A supplier invoice code is supporting evidence for how that supplier invoiced a product. It does not prove the legally correct classification for the exact article sold by Souviks. No GST rate, cess, invoice-ready status or final classification promotion is inferred. Customer-facing HSN display remains subject to the existing classified/high-confidence rule. GST invoice generation remains separately gated.
