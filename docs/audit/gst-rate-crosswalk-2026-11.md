# GST rate crosswalk and invoice release controls — 6 November 2026

## Release decision

**Do not enable automated tax invoices yet.** The HSN catalogue is more accurate, but 1,075 SKU records remain provisional or review-required. HSN alone does not determine the GST amount: the notified goods description, special schedule wording, vehicle use, composition, place of supply, freight treatment and effective date can change the result.

This is a heading-level crosswalk for accountant review, not an executable SKU rate table. The unresolved SKU worklist deliberately leaves GST rate fields blank.

## Current rate framework and effective dates

The goods-rate changes recommended by the 56th GST Council meeting were implemented through Notification No. 9/2025-Central Tax (Rate), dated 17 September 2025, with the principal changes effective 22 September 2025. The Ministry of Finance says this notification superseded Notification No. 1/2017-Central Tax (Rate). The notification text, not an old cached rate table, is the controlling schedule.

- Ministry of Finance / PIB FAQ identifying Notification 9/2025 as the operative replacement: https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2168426&lang=2&reg=3
- Ministry of Finance / PIB summary of auto-component rates and effective date: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163671&lang=2&reg=3

Relevant subsequent amendment checks:
- Notification No. 01/2026-Central Tax (Rate), 30 April 2026, effective 1 May 2026, changes specified beverage tariff-item references in Notification 9/2025; it does not amend the vehicle-parts, filters, belts or lighting entries. Text: https://gst.karnataka.gov.in/Documents/NOTIFICATIONS/CTR014426.pdf
- Notification No. 02/2026-Central Tax (Rate), 27 October 2026, effective 1 November 2026, changes the fertiliser entry and adds retreaded tractor tyres to Schedule I; it also revises used/retreaded tyre wording in Schedule II. It does not amend the 8708 vehicle-parts entries. Gazette text: https://egazette.servantsofknowledge.in/details/in.gazette.central.e.2026-10-27.277454/

## Heading-level guide — not a SKU rate approval

| Candidate family | Broad rate indication to verify | Important qualifier |
|---|---|---|
| 8512 — vehicle lighting/signalling and wipers | 18% (9% CGST + 9% SGST, or 18% IGST) | CBIC Schedule III expressly includes heading 8512 at 18%. Articles of heading 8539 are excluded from the 8512 entry and need their own line-level check. |
| 8421 — filters | 18% | CBIC Schedule III lists heading 8421 at 18%. Confirm the product is filtering machinery/apparatus or its part. |
| 4010 — vulcanised-rubber transmission belts | 18% | CBIC Schedule III lists heading 4010 at 18%. Correct eight-digit HSN depends on belt profile, outside circumference and rubber-compound percentage. |
| 4016 — other vulcanised-rubber articles | 18% indication | Exact article and material must match heading 4016; don't assume an automotive rubber part belongs here. |
| 7318 / 7320 — fasteners and springs | 18% | CBIC Schedule III lists these headings at 18%. Confirm base metal and exact article. |
| 6813 — brake/clutch friction material | 18% indication | Mounted/unmounted and asbestos status determine classification; match notified description. |
| 8481 / 8482 / 8483 / 8484 — valves, bearings, gears/couplings and gaskets | 18% indication | Confirm precise tariff item and product description. Section XVII exclusions often place vehicle items in their own Chapter 84 heading. |
| 3819 / 3820 — hydraulic brake fluids / anti-freeze preparations | 18% indication | Confirm the formulation and exact tariff description; coolant filter equipment is not antifreeze fluid. |
| 2710 / 3403 — petroleum oils / lubricating preparations | Product-specific schedule match required | Petroleum-oil percentage, BIS conformity and formulation determine classification; do not infer from the marketing name alone. |
| 3102 — urea | Description/use-specific | Fertilizer goods and other urea/aqueous preparations are not interchangeable classifications. Check the exact notified description. |
| 8708 — motor-vehicle parts | **18% general auto-component rate** | The Ministry of Finance's published change table lists heading 8708 parts/accessories generally at 18%; it separately lists specified tractor components at 5%. Exact product description and tractor-use conditions must match the listed exceptions. |
| 8409 / 8413 / 8414 / 8511 / 8536 / 8539 and remaining headings | No SKU rate populated in this tranche | Each needs a match to the current operative notification and the exact goods description. For SVKS000570, Uno Minda publishes HSN 85365090; that is a classification reference, not a GST-rate approval. The applicable rate must be matched to the exact entry and goods description in Notification 9/2025. |

### 8708 source-conflict warning

The CBIC public HTML "GST Goods and Services Rates" page served at review time still displays an old Schedule IV 28% entry for heading 8708, and shows specified tractor rows at 18%. This conflicts with the later Ministry of Finance / PIB rate-change table for Notification 9/2025, which reports general motor-vehicle parts under 8708 at 18% and enumerated tractor parts at 5%. Do not build a production tax engine from the public HTML row alone. Resolve the operative 9/2025 notification annexure and the applicable tractor description with the accountant before activating any 8708 SKU rate.

References for the conflict and operative rate change:
- CBIC current public HTML page, legacy 8708 row: https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html
- PIB / Ministry of Finance table: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163671&lang=2&reg=3
- The Ministry's 57th Council amendment, effective 1 November 2026, lists the affected fertilizer and tyre entries; it does not amend the vehicle-parts table: https://egazette.servantsofknowledge.in/details/in.gazette.central.e.2026-10-27.277454/

A customs-tariff page's basic customs duty is **not** the GST rate. Do not map basic customs duty percentages to GST. The supplier-published HSN for a product also does not, by itself, select the GST rate: use the notified description, effective date and all applicable conditions.

## Server-side invoice gate

The invoice service must fail closed unless all conditions hold for every taxable line:
- HSN status is `classified` and confidence is `high`, or a signed accountant exception is recorded against that SKU and invoice date.
- Final HSN and GST rate have an evidence reference, approver, effective-from date and review date.
- Tax rate is selected from a server-side, effective-dated rate master, never from browser input or a universal hard-coded percentage.
- For 8708, check vehicle type and exact goods description against the enumerated tractor exception list before selecting 18% or 5%. Other exceptions must be represented as explicit notification rows, not broad category rules.
- Catalogue prices are GST-inclusive; derive taxable value using the approved rate and discount/rounding policy. Do not add GST a second time to inclusive prices.
- Freight is a separate charge with the approved tax treatment; do not assign it a blanket zero rate.
- Intra-state vs inter-state supply is determined server-side from verified place-of-supply and dispatch/customer facts.
- Paid-order state, invoice numbering, idempotency, PDF storage/hash, credit notes and refunds are auditable.

## Rule 46 and seller identity controls

Rule 46 particulars must be checked against current rules and the specific transaction. The implementation must support supplier/recipient details, unique consecutive invoice number and issue date, HSN/SAC, description, quantity/unit, taxable value, tax rate and amount, place of supply/state code and other applicable fields. Source: https://cbic-gst.gov.in/gst-invoice-rules.html

The supplied GST REG-06 certificate is dated 7 July 2018. It shows the details on that certificate but does not prove current active registration status or later amendments. Before production invoice release:
1. Verify current GST registration status and identity/address on the GST Portal.
2. Reconcile the registered principal-place address; the separate letterhead address is not established as an additional place by the certificate reviewed.
3. Obtain an accountant-approved SKU HSN/GST rate master and effective dates, including freight and tractor exceptions.
4. Obtain written approval of invoice numbering, tax-inclusive price extraction, B2B/B2C fields, place of supply, credit notes and refunds.
5. Test representative mixed-rate carts and have the accountant sign sample invoices before sending to customers.

## Work remaining

- Supplier/OEM evidence for 1,075 non-final HSN rows.
- Accountant approval of GST rate and effective date per SKU.
- Current GST Portal status check and seller identity reconciliation.
- Production invoice generation, storage, numbering, delivery and credit-note/refund workflow; the fillable PDF layout remains a non-calculating template.
