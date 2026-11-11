# GST invoice implementation readiness — Souviks

**Status:** Design and accountant verification pending  
**Assessment date:** 3 November 2026  
**Business facts:** GST registration confirmed by owner; Souviks sells to both B2B and B2C customers; online catalogue selling prices are stated to include applicable GST; freight is separately charged.

This is an implementation specification, not a tax opinion. The uploaded GST REG-06 certificate has now supplied the registered GST identity and address below. Current active status still requires a live GST Portal check; product tax rates, place-of-supply rules and invoice values must not be guessed.

## Current implementation gap

The Cashfree setup document identifies GST invoice generation as outside the first checkout implementation scope. A Cashfree payment confirmation or order receipt is not a substitute for the required GST tax invoice where one must be issued.

## Accountant evidence required before coding tax calculations

| Evidence | Required decision / validation |
|---|---|
| GST registration certificate | Exact GSTIN, legal name, trade name, registration status, principal place of business and state code |
| Tax invoice identity | Confirm seller name and address to print; ensure the proprietor/trade-name relationship is correct |
| Product HSN master | Verify HSN/SAC at SKU level. Do not apply one generic HSN (including 8708990) to every automotive item without confirmation |
| Product tax rates | Confirm rate and effective date for every applicable HSN; include any rate changes over time |
| Price basis | Confirm catalogue prices are GST-inclusive and establish the correct tax-exclusive taxable-value calculation for each rate |
| Place of supply | Confirm customer location and whether the supply is intra-state or inter-state; configure CGST/SGST or IGST accordingly |
| Freight | Confirm the GST treatment and rate for separately charged courier freight, including whether it follows the underlying supply |
| B2B recipient fields | Confirm when recipient GSTIN, registered legal name, billing address and state must be collected and printed |
| B2C recipient fields | Confirm the required consumer invoice/receipt fields and any address/recipient particulars for each transaction class |
| Credit notes / refunds | Confirm when credit notes are needed and how GST adjustments are recorded for cancellations, returns and refunds |
| Invoice numbering | Approve a consecutive, non-duplicate invoice sequence for each financial year and a durable issue-date/audit trail |

## Required invoice data model

At minimum, the implementation should retain:

- unique invoice ID and consecutive invoice number;
- invoice issue date and linked order/payment reference;
- seller legal name, trade name where approved, full address and GSTIN;
- recipient type (registered business or consumer), name, billing address and recipient GSTIN where applicable;
- place of supply and state code;
- line-item product ID, description, quantity, unit, HSN, unit price, discount, taxable value, tax rate, CGST/SGST/IGST amounts and line total;
- shipping/freight line and its approved tax treatment;
- invoice taxable subtotal, tax totals, rounding and final payable total;
- credit-note/refund references where applicable; and
- generation timestamp, template version and immutable PDF/document hash.

The invoice should clearly display the seller name **Chandrani Sadhu, proprietor trading as Souviks** in the prominence and font-size treatment required by the 2026 e-commerce amendment. That seller identity must be reconciled against the GST certificate before the production template is released.

## Build and verification sequence

1. Obtain the GST certificate and accountant-approved SKU-to-HSN/tax-rate mapping.
2. Define B2B and B2C checkout data requirements without collecting unnecessary personal data.
3. Implement server-side tax calculation only; never trust browser-supplied tax rates or tax amounts.
4. Generate invoices from the verified paid/fulfilled order state using a consecutive financial-year sequence.
5. Generate and reconcile credit notes and refunds with the original invoice.
6. Test intra-state and inter-state orders, B2B GSTIN validation, B2C orders, mixed-HSN carts, freight taxation, rounding, failed payments, duplicate webhooks, cancellations and partial/full refunds.
7. Have the accountant sign off the invoice samples and production tax calculations before enabling invoice delivery.

## Primary reference

CBIC GST Invoice Rules: https://cbic-gst.gov.in/gst-invoice-rules.html

Rule 46 particulars must be checked against the actual registration and transaction. The accountant must confirm which particulars apply to Souviks' invoice cases before the template is treated as final.


## Registered seller details confirmed from GST REG-06 certificate — 4 November 2026

The uploaded three-page GST registration certificate states the following:

| Field | Certificate value |
|---|---|
| Form | GST REG-06 (Rule 10(1)) |
| Legal name | **CHANDRANI SADHU** |
| Trade name | **Souviks** |
| Constitution | **Proprietorship** |
| GSTIN | **19BZMPS2461K1ZO** |
| Principal place of business | **6, Souviks, Beside NH-2, Andal, Bardhaman, West Bengal, 713321** |
| State code | **19** |
| Date of liability | 15/04/2016 |
| Period of validity | From 09/07/2017; To: NA |
| Type of registration | Regular |
| Certificate issue date | 07/07/2018 |
| Additional places of business | 0 (Annexure A) |
| Proprietor | CHANDRANI SADHU (Annexure B; status: Owner) |

**Important address reconciliation:** The sample letterhead shows `CN-119(2), Souviks building, Andal, West Bengal - 713321`. That is not the principal-place address stated in the uploaded GST certificate. Annexure A to the uploaded certificate records zero additional places of business. The invoice template therefore uses the principal-place address exactly as recorded in GST REG-06, not the different address from the sample letterhead. Do not use the letterhead address as a registered additional place unless a later GST amendment certificate supports it.

The 2018 certificate is evidence of the details printed on that certificate; it does not by itself establish that the registration is currently active or that no amendment/suspension/cancellation has occurred since issue. Check the GST Portal before first production use and obtain a current certificate if the registration details have changed.

## Bank details transcribed from the sample letterhead — not independently verified

| Field | Printed value |
|---|---|
| Bank | Punjab National Bank |
| IFSC | PUNB0048510 |
| Account name | Souviks |
| Account number | 04854015003137 |

The bank details above are transcribed from the supplied sample letterhead, not the GST certificate. Confirm the account name, number and IFSC against a bank-issued document before printing them on customer invoices or accepting transfers.

**Before the first production invoice:** verify current GST registration status on the GST Portal, obtain a current GST certificate if amended, confirm the bank details, and have the accountant approve the legal supplier-name presentation and tax invoice template. The template pre-populates the legal supplier name as `CHANDRANI SADHU (Proprietor - Souviks)`, but the field remains editable.

## Invoice layout created from the supplied example

A one-page A4 fillable PDF has been prepared using the supplied letterhead PDF as its background and the supplied invoice image as the layout reference. The sample-report placeholder text has been masked. The template includes:

- recipient/B2B-B2C type, billing and delivery details, invoice number/date/due date, place of supply and state code;
- five editable item rows with description/part number, HSN/SAC, quantity, unit rate, taxable value, GST rate, tax amount and line total;
- taxable subtotal, separate CGST/SGST/IGST totals, round-off and invoice total;
- amount in words, payment terms/mode, remarks/delivery details and authorised-signatory name; and
- the bank details already printed in the supplied letterhead footer.

The example transaction's third-party buyer, furniture items, USD amounts, 15% tax rate and dates have not been carried into the template. No GST rate is pre-filled. Freight must be added as a separate line item with the correct SAC/HSN and accountant-approved tax treatment where applicable.

**Limitations:** PDF fields are fillable, but totals and GST are not calculated automatically. The template is a layout prototype, not a deployed invoice-generation feature. Invoice numbering, server-side tax computation, PDF generation, storage, credit notes and delivery through the order workflow remain to be implemented and accountant-tested.


## Automated invoice generator implementation (11 November 2026)

The gst-invoice Supabase Edge Function generates a GST-inclusive A4 PDF from immutable order/item snapshots, reserves consecutive FY numbering in a database transaction, stores the PDF in a private gst-invoices bucket, calculates a SHA-256 digest and exposes a short-lived signed download URL after ownership/capability checks.

Invoice number format: SVK/26-27/000001 (16 characters maximum). No DSC is embedded. Issuance requires explicit server-side controls for registered seller identity and accountant approval of electronic PDF issuance. Freight is separately blocked until its SAC, rate and GST-inclusive treatment are explicitly approved. No historical order is backfilled with current catalogue HSN/GST values.

The invoice feature flag remains off until the registered GST certificate details and electronic invoice format are reconfirmed, and freight treatment is confirmed for courier orders. The first production issuance test must be a low-value, paid, verified order and the resulting PDF must be checked by the accountant before general enablement.
