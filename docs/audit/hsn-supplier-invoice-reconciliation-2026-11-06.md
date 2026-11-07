# Supplier-invoice HSN reconciliation — 7 November 2026 (follow-up to the 6 November source audit)

## Source and treatment

The supplied `hsn.xlsx` contains 1,487 product records: **1,034 populated supplier invoice HSN values and 453 blanks**. The populated values are treated as supplier-shared invoice references. The source code string is preserved exactly as supplied; six-digit codes are not padded and blank codes are not inferred.

Matching to the Souviks catalogue uses exact product names, supplier brand plus whole part/reference tokens, part-reference/title disambiguation, and high-confidence brand-plus-title matching. Manual review validates exact catalogue part numbers, product titles, package sizes, dimensions and left/right variants. The supplier Odoo external ID is retained for traceability.

## Reconciliation results

| Measure | Count |
|---|---:|
| Populated supplier invoice HSN source rows | 1034 |
| Distinct supplier product names | 1010 |
| Source rows linked to a catalogue SKU | 913 |
| Catalogue SKUs with one consistent supplier code | 850 |
| Catalogue SKUs with conflicting supplier codes | 17 |
| Supplier rows requiring manual review | 121 |
| Brand/title review rows | 27 |
| Ambiguous part-reference rows | 1 |
| Supplier-name/code conflict rows | 4 |
| Ambiguous exact-name rows | 1 |
| No reliable catalogue match rows | 89 |
| Active SKUs with one consistent supplier reference | 850 |
| Active SKUs with conflicting supplier references | 17 |

The 1,034 populated source rows are fully accounted for between the linked-source register (913) and the outstanding review queue (121). The 17 conflict SKUs have no single selected supplier code.

## Manual identity review

The manual identity ledger now contains 89 supplier-source resolutions across ten tranches:
- The first tranche added 40 source rows: 38 previously unlinked catalogue SKUs, one same-code supporting source record for an already-linked SKU, and one KF5098 source row that created a supplier-code conflict.
- The second tranche added 26 source rows. It linked 16 new consistent SKUs across Bosch diesel filter kits, ASK brake-lining variants, Mahle KS55, Texspin TX-5592 RHS and TXL grease pack sizes, Varroc left/right headlamps, and the WABCO drain valve. It also added one same-code GS SBAM394 source record, moved KFL KF5099 (SVKS000743) into conflict, and added three additional conflict SKUs: Fleetguard FF5544 (SVKS000290), Fleetguard FS1967100 (SVKS000284), and Philips 24569ESCI (SVKS000405).
- The third tranche added five Texspin source rows. TX-1888180 WH maps to SVKS000486 by the full Texspin part number, while its two invoice rows carry different codes and remain a conflict. TX-27WH (O-1511) maps to SVKS000487 by the full reference and application. TX-45128SC maps to existing SKU SVKS000489 by exact part number, but its new invoice code differs from the already linked supplier row, so it becomes a conflict. TX-539/532X maps to SVKS000522 by exact Texspin part number; the catalogue item is described as a wheel twin kit containing two bearings, while the invoice line calls it taper roller bearings, so the title variance is explicitly documented.
- A fourth tranche added two cross-brand exact part-number matches: MEI SMS3007 to Meritor SKU SVKS000764 (distinguished from its LH variant), and Leyparts FA0067900 to the exact brake-lining part-number SKU SVKS000282. These brand-label differences are retained explicitly as source provenance.
- A fifth tranche added two TVS Girling 29068117 invoice rows to exact catalogue part-number SKU SVKS000482. Their invoice HSN values are 87083000 and 87089300, so SVKS000482 is now a conflict and neither code is selected.
- A sixth tranche added two further cross-brand exact part-number matches: Nirmal B 1145 to BIR SKU SVKS000228 and Nirmal B 1151 to BIR SKU SVKS000229. Both catalogue part numbers and product descriptions match; supplier brand labels remain in provenance.
- A seventh tranche resolved four additional source rows where the automatic candidate ranking had missed or failed to disambiguate exact catalogue identity: CB AU003BK to Motherson SKU SVKS000243 and CB AU003RD to SVKS000244 by exact concatenated part reference; KFL KF5122 to active SKU SVKS000345 after excluding duplicate inactive SKU SVKS000841; and Texspin TXL 3 - 1SG + 1 KG to the exact 1 kg pack SKU SVKS000840. The RD cable page title currently says black despite the RD suffix; that catalogue title/color inconsistency is documented and not silently corrected.
- An eighth tranche links NG part 103 to NeoLite catalogue SKU SVKS000386 by the exact supplier part number and exact Tata 4 Chamber 24V tail-lamp description. The supplier brand label NG and catalogue brand NeoLite are both retained in provenance.
- A ninth tranche added six source rows after checking exact catalogue identifiers: Palak PLK 199F to SVKS000404 by the exact normalised part number and 50 mm Bell Crank Set title/dimension (the Palak supplier label and Harish catalogue brand remain separately recorded); RKI K15/K16/K17/K21 to their four active catalogue SKUs by exact RKI part number; and Texspin TX 6698SC to SVKS000499 by exact part number, title and application. The Texspin source row carries 84821090 while the previously linked invoice row for the same part carries 84828000, so the SKU becomes a supplier-code conflict and neither value is selected. Existing catalogue HSN candidates remain unchanged.

A tenth manual tranche adds Fleetguard source part 871012400 (FS-Head for FS19664) to Fleetguard catalogue SKU SVKS000288. The Fleetguard HCV/LCV after-market price list identifies 871012400 as the FS19664 head and gives OE reference 288547700101; the catalogue SKU stores the same Fleetguard reference as 8710124, omitting terminal zeros, and its application note also links the head assembly to FS19664. The newly matched supplier invoice code 84212300 conflicts with the already-linked supplier invoice code 87089900 for the same SKU. Both codes are retained; neither is selected. The existing catalogue HSN candidate 84219900 and its review metadata remain unchanged. Source evidence: [Fleetguard Filters HCV/LCV price list](https://www.scribd.com/document/704429716/fleet-guard-new).

The current 17 conflicts include the eight conflicts present after the first manual tranche, the KF5099, FF5544, FS1967100 and Philips conflicts added in the second tranche, the TX-1888180 WH and TX-45128SC conflicts added in the third tranche, and TVS Girling 29068117 (SVKS000482) added in the fifth tranche, plus Fleetguard 871012400 (SVKS000288) added in the tenth tranche. All source rows and distinct supplier codes are retained; no winning supplier HSN has been selected.

The remaining 121 review rows were checked against available catalogue identity evidence. They remain unlinked where the supplier reference is absent, the actual catalogue part number differs, brand/title alone cannot prove identity, or duplicate SKUs/variants prevent a reliable one-to-one assignment. Examples include the Bosch F-002-919-4AR-8F8 row whose apparent URL candidate has a different actual catalogue part number, and several brake-lining, bearing, spring-pin and mounting variants where a nearby description is not a safe substitute for a match.

The outstanding 121 rows break down as follows:

| Review disposition | Rows |
|---|---:|
| No reliable catalogue match | 88 |
| Brand/title review (variant or exact part reference not confirmed) | 27 |
| Supplier-name/code conflict | 4 |
| Ambiguous part reference | 1 |
| Ambiguous exact-name match | 1 |
| **Total** | **121** |

These rows remain in the review queue rather than being forced onto the closest-looking SKU. In particular, generic belt-size matches, brake-lining families, bearing variants, spring-pin dimensions, and product titles with mismatched part numbers are not treated as exact identity evidence.

## Catalogue fields

Supplier invoice evidence is stored separately from existing catalogue HSN classification:
- `hsn_supplier_invoice_code`: one code where supplier rows agree;
- `hsn_supplier_invoice_codes`: all distinct codes associated with the SKU;
- `hsn_supplier_invoice_match_status`: `matched` or `conflict`;
- `hsn_supplier_invoice_match_methods`: the identity matching route(s);
- `hsn_supplier_invoice_source_names` and `hsn_supplier_invoice_external_ids`: source traceability;
- `hsn_supplier_invoice_source_file` and `hsn_supplier_invoice_match_date`;
- `hsn_supplier_invoice_candidate_alignment`: `agrees`, `differs`, `not_compared`, or `conflicting_supplier_codes`.

The 15 conflict SKUs have no single selected supplier code. Existing `hsn_code`, `hsn_description`, `hsn_confidence`, `hsn_classification_status`, `hsn_basis`, `hsn_review_note` and `hsn_reference_date` values remain unchanged. The canonical catalogue builder carries supplier metadata into the active static product projection.

## Audit files

- `hsn-supplier-invoice-matches-2026-11-06.csv` lists all source rows linked to a SKU, including supplier-code conflicts.
- `hsn-supplier-invoice-review-queue-2026-11-06.csv` lists every remaining supplier row with candidate catalogue records and match scores where available.
- `assets/data/hsn-supplier-invoice-manual-resolutions.json` records the 89 identity-verified manual matches and supplier-code conflicts applied by the canonical builder.

## Generated catalogue projection

On 7 November 2026, the catalogue release workflow regenerated the static product projections in commit [`dec19c4`](https://github.com/mssouviks-tech/souviks-website/commit/dec19c4cdb698188556b775b01ea2cd99f16abb6). The commit updates `assets/data/catalogue-index.json` and `assets/data/products.json` for the NG part 103 match on SKU SVKS000386, carrying the supplier invoice evidence and source traceability into the static catalogue. The existing `hsn_code`, description, confidence and classification status remain unchanged.

## Tax and invoice boundary

A supplier invoice code is supporting evidence for how that supplier invoiced a product. It does not prove the legally correct classification for the exact article sold by Souviks. No GST rate, cess, invoice-ready status or final classification promotion is inferred. Customer-facing HSN display remains subject to the existing classified/high-confidence rule. GST invoice generation remains separately gated.
