# GST rate crosswalk and invoice release controls — 6 November 2026

## Release decision

**Do not enable automated tax invoices yet.** The HSN catalogue is more accurate, but 1076 SKU records remain provisional or review-required. HSN alone does not determine the GST amount: the goods description, special schedule wording, vehicle use, composition, place of supply, freight treatment and effective date can change the outcome.

This is a heading-level crosswalk for accountant review, not an executable SKU rate table. The unresolved SKU worklist deliberately leaves the GST rate blank.

## Heading-level guide

| Candidate family | Broad treatment to verify | Important qualifier |
|---|---|---|
| 8512 — vehicle lighting/signalling and wipers | 18% (9% CGST + 9% SGST, or 18% IGST) | CBIC Schedule III covers heading 8512. Lamp articles of heading 8539 are separate. |
| 8421 — filters | 18% | Confirm filter medium and complete filter apparatus vs replacement element. |
| 4010 — vulcanised-rubber transmission belts | 18% | Correct 8-digit subheading depends on profile, circumference and rubber compound. |
| 4016 — other vulcanised-rubber articles | 18% | Product material and exact article may move it to another heading. |
| 7318 / 7320 — fasteners and springs | 18% | Verify base metal and exact article. |
| 6813 — brake/clutch friction material | 18% | Mounted/unmounted and asbestos status determine classification. |
| 8481 / 8482 / 8483 / 8484 — valves, bearings, gears/couplings, gaskets | 18% | Section XVII exclusions mean many vehicle goods remain under their own Chapter 84 headings. |
| 3819 / 3820 — hydraulic brake fluids / anti-freeze preparations | 18% | Verify formulation and that the product is the named preparation. |
| 2710 / 3403 — petroleum oils / lubricating preparations | Generally 18% for the identified headings | Petroleum-oil percentage, BIS conformity and formulation decide 2710 vs 3403. |
| 3102 — urea | Description-dependent | Fertilizer use and other urea/aqueous uses are treated differently; do not apply a generic rate to AdBlue/DEF without matching the notified description. |
| 8708 — motor-vehicle parts | General heading treatment is 18% | **Specified tractor parts are a 5% exception.** Confirm vehicle type and the exact notified part description before using 5%. |
| 8409 / 8413 / 8414 / 8511 / 8536 / 8539 and other remaining headings | No SKU rate prefilled in this tranche | Each family requires its own current notification check and exact product-description match. |

## Sources checked

1. CBIC GST Goods and Services Rates — heading 8512 is in Schedule III: https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html
2. PIB / Ministry of Finance — general heading 8708 revised from 28% to 18%; specified tractor parts revised from 18% to 5%: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163671&lang=2&reg=3
3. PIB FAQ confirms Notification 9/2025-Central Tax (Rate), dated 17 September 2025, as the base rate schedule: https://www.pib.gov.in/newsite/archiveContent.aspx?lang=2&reg=48&relid=276214
4. Indian tariff items for V-belts show the compound threshold: https://indiacode.ecourtsindia.com/customs-tariff/40103210/ and https://indiacode.ecourtsindia.com/customs-tariff/40103290/

A customs tariff page's basic customs duty is **not** the GST rate. Recheck Notification 9/2025 and all amendments effective on the invoice date before release.

## Server-side invoice gate

The invoice service must fail closed unless all conditions hold for every taxable line:
- HSN status is `classified` and confidence is `high`, or a signed accountant exception is recorded against that SKU and invoice date.
- Final HSN and GST rate have an evidence reference, approver, effective-from date and review date.
- Tax rate is selected from a server-side, effective-dated rate master, never from browser input or a universal hard-coded percentage.
- For 8708, check vehicle class and exact goods description against the tractor-specific exception list before selecting 18% or 5%.
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

- Supplier/OEM evidence for 1076 non-final HSN rows.
- Accountant approval of GST rate and effective date per SKU.
- Current GST Portal status check and seller identity reconciliation.
- Production invoice generation, storage, numbering, delivery and credit-note/refund workflow; the fillable PDF layout remains a non-calculating template.
