# GST invoice generator — implementation and release controls

**Implementation branch:** `commerce/gst-invoice-generator-2026-11-10`  
**Status:** Code and migration prepared for review; not yet merged, applied, deployed or enabled.  
**Date:** 10 November 2026

## Implemented workflow

- Checkout captures the buyer's billing address, city, GST state code and PIN. Delivery-state code is separately derived and stored where goods are shipped.
- Cashfree order creation snapshots trusted catalogue HSN, classification status/confidence, GST rate/splits, effective date, accountant-approval state, source reference and rate basis. Browser-supplied tax or HSN values are never used.
- When issuance is enabled, checkout is blocked unless all lines have an eight-digit classified/high-confidence HSN and an accountant-approved GST candidate. The 5 material/HSN and 4 vehicle-use exception review candidates remain blocked by their candidate status.
- A verified Cashfree PAID result triggers the invoice Edge Function. The invoice is generated once per order and is idempotent on retries.
- Invoice numbering is serialized in Postgres by financial year. Format: `SVK/26-27/000001` (16 characters maximum). Sequence and invoice snapshot are reserved atomically.
- GST-inclusive line prices are decomposed server-side into taxable value, CGST/SGST or IGST. The invoice total must reconcile exactly to the paid order total.
- Place of supply is taken from the delivery destination state for delivery orders and billing state for store pickup. Billing GSTIN state is checked against the billing state.
- PDFs are stored in the private `gst-invoices` bucket. The account order history uses the authenticated account owner; the guest payment-return page uses the short-lived checkout access capability. Download links expire after five minutes.
- A paid order is not demoted or marked unpaid if invoice generation fails. Invoice generation failures are logged and retried on a later verified payment reconciliation.

## Release gates — do not enable before these are completed

The function is deliberately disabled unless the following Supabase Edge Function secrets/configuration are set and verified.

Seller identity:
- `GST_INVOICE_SELLER_IDENTITY_VERIFIED=true`
- `GST_INVOICE_SELLER_LEGAL_NAME`
- `GST_INVOICE_SELLER_TRADE_NAME`
- `GST_INVOICE_SELLER_GSTIN`
- `GST_INVOICE_SELLER_ADDRESS`
- `GST_INVOICE_SELLER_STATE_CODE=19`

Electronic invoice format:
- `GST_INVOICE_ELECTRONIC_ISSUANCE_APPROVED=true` only after the accountant confirms the intended electronic PDF issuance process under the applicable Rule 46 proviso. The implementation does not apply a cryptographic DSC and does not assert that a typed/scanned signature is a DSC.
- `GST_INVOICE_REVERSE_CHARGE_APPROVED=true` only after the accountant confirms that these checkout goods and any configured freight treatment are not subject to reverse charge.
- `GST_INVOICE_UQC_APPROVED=true` and `GST_INVOICE_DEFAULT_UQC=NOS` (or another accountant-approved unit code) only after the accountant confirms the unit/quantity code to print for catalogue item quantities.

Feature switch:
- `GST_INVOICE_ISSUANCE_ENABLED=true` only after the gates and tests below are complete.

Freight:
- For home-delivery invoices with a positive courier charge, set `GST_FREIGHT_APPROVAL_STATUS=approved`, `GST_FREIGHT_APPROVAL_SOURCE`, `GST_FREIGHT_SAC`, `GST_FREIGHT_RATE_PERCENT` and `GST_FREIGHT_PRICE_INCLUDES_GST=true` only after the accountant confirms the courier charge's SAC, rate, inclusive/exclusive basis and treatment. If not approved, invoice issuance is blocked; enabling the switch also blocks new positive-freight checkouts until this is configured. Store-pickup invoices have no freight line.

## Still not included

- IRP e-invoice/IRN/QR reporting. This is intentionally separate from this generator; the owner reports turnover below ₹5 crore, but aggregate turnover under the PAN and all preceding financial years must still be verified before concluding that the mandate does not apply.
- Automated email delivery for guest invoices. Guest downloads are available on the immediate payment-return page; signed-in customers can retrieve invoices from My Account.
- Credit-note generation and linkage for refunds, cancellations after invoice issue, partial refunds and returns. Until that workflow is built and approved, post-invoice refunds require manual accountant handling.
- Live GST Portal status checks and supplier GSTIN validation. The seller-identity feature gate must remain off until current registration status and current principal-place details are checked.
- Automated amount-in-words, e-way bills, reverse-charge cases, cess, export/SEZ supplies, debit/credit notes, and other exceptional GST treatments. These are not silently guessed.

## Deployment order

1. Merge the implementation PR after the catalogue build, static catalogue validation, regression contracts and Edge Function TypeScript checks pass.
2. Apply migration `20261110150000_gst_invoice_generator.sql` to the Souviks Supabase project.
3. Deploy `gst-invoice` and the updated `cashfree-create-order`, `cashfree-verify-order`, `cashfree-webhook`, and `account-orders` functions from the reviewed repository revision.
4. Verify the registered seller details, electronic PDF process, freight treatment, HSN eligibility, financial-year sequence and sample intra-/inter-State calculations with the accountant.
5. Keep `GST_INVOICE_ISSUANCE_ENABLED` false until those checks and a non-customer test invoice pass. Then enable it deliberately and run a controlled paid order using approved, high-confidence HSN products.

The implementation must not be described as active or production-ready until migration, Edge Function deployment, configuration, accountant sign-off and one end-to-end verification are complete.
