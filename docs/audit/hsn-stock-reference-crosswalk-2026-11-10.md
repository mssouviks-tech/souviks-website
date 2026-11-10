# Odoo stock HSN reference crosswalk — 10 November 2026

## Source and scope

This crosswalk links the three Odoo stock HSN reference CSV files to the 9 November 2026 stock-to-website reconciliation workbook:

- `hsn-reference-part-1.csv`
- `hsn-reference-part-2.csv`
- `hsn-reference-part-3.csv`

The source files contain Odoo product-template IDs, stock product descriptions and HSN codes. They contain **no GST-rate column**. GST percentages are not inferred from these CSV files.

## Reconciled coverage

| Result | Count |
|---|---:|
| Source Odoo HSN rows | 1,034 |
| Website SKUs with one consistent source HSN | 796 |
| Source rows represented by those unique website SKUs | 828 |
| Website SKUs with conflicting source HSNs | 22 |
| Source rows contributing to those conflicts | 44 |
| Stock source rows without a unique website mapping | 162 |
| — ambiguous website candidates | 64 |
| — no reliable website match | 98 |

Only the 796 unique website mappings receive `hsn_stock_reference_code`. The 22 conflicting website SKUs receive the list of source codes, not an arbitrarily selected code. The 162 unmatched or ambiguous stock rows remain outside the website product crosswalk.

## Data handling

The canonical catalogue and public product projection receive separate source-reference fields: single code, conflicting codes, match status, alignment to current candidate, source-row count, source file names and reconciliation date.

**This crosswalk never overwrites** `hsn_code`, `hsn_description`, confidence, classification status, supplier-invoice evidence or DPIIT mappings. Different codes remain visible as comparison evidence for technical review.

## GST and invoice controls

PR #223 already assigns GST rate candidates across 1,159 catalogue records: 1,158 at 18% and one at 5%. The 5% exception is `SVKS000429`, Pressure Plate 330 Dia Sonalika 4 Lever, treated as a tractor clutch assembly component under HSN 8708 93 00. A tractor application alone is not sufficient for a 5% rate; the physical goods must match the exact notified description.

Ministry of Finance / PIB rate table: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163671&lang=2&reg=3

The subsequent amendment effective 1 November 2026 reviewed for this release changes other schedule entries, not these vehicle-part descriptions: https://egazette.servantsofknowledge.in/details/in.gazette.central.e.2026-10-27.277454/

The Odoo HSN source CSVs do not themselves contain GST rates. Existing rate candidates and tax splits remain unchanged. Provisional and review-required HSN classifications remain open. Accountant approval remains required, `invoice_ready` remains `false`, and tax invoice generation is not enabled.

## Regression

The new stock-reference regression validates source counts, source-row totals, projection parity, conflict handling, GST candidate presence and closed invoice-readiness gates. The HSN verification worklist includes the separate stock-reference evidence.
