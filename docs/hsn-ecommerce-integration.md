# HSN data in ecommerce

## Product catalogue and product pages

The canonical `assets/data/catalogue-index.json` remains the source of the product HSN candidate and its review metadata. The static catalogue build carries the fields into the product projection and embedded product-page data.

Customer-facing product detail pages display an HSN line only when both conditions are true:

- `hsn_classification_status = classified`
- `hsn_confidence = high`

The candidate HSN is therefore not presented as confirmed for provisional or review-required records. Their review status and notes remain in the catalogue source for technical follow-up.

## Checkout and order history

The browser submits only product IDs and quantities. The Cashfree order-creation Edge Function fetches the current trusted catalogue and constructs the order lines on the server. It snapshots the following fields on each `order_items` row:

- `hsn_code`
- `hsn_description`
- `hsn_classification_status`
- `hsn_confidence`

This avoids trusting a browser-supplied HSN and preserves the classification used when the order was placed, even if the product catalogue is updated later.

The authenticated `account-orders` function returns those saved fields with the order lines. The customer order-history view displays the code only for a high-confidence classified record. Earlier orders created before the schema migration retain null HSN snapshots; their historical classifications are not backfilled from a later catalogue state.

## GST invoice boundary

HSN and GST rate are separate data. This integration does not determine GST percentages, taxable values, CGST/SGST/IGST splits, cess, or place-of-supply treatment. It does not generate or issue tax invoices.

The Souviks invoice template expects verified HSN/SAC and GST rates at line-item level. On 10 November 2026, the user reported accountant approval of all 1,159 GST rate candidates; each gst_rate_candidate invoice_ready flag is true and accountant_approval_required is false. This approves the GST candidate only. Do not use provisional or review-required HSN candidates as final invoice classifications unless a SKU-specific HSN exception is recorded. The end-to-end tax-invoice generator is not implemented by this flag change and must fail closed where either the HSN or transaction/tax treatment is unverified.


## GST invoice generator

The checkout migration now snapshots the accountant-approved GST rate, effective date, rate split and source reference on each order line, separately from the HSN classification. It also snapshots billing and delivery state codes and the product unit-of-measure field. New invoices are generated only for Cashfree-verified paid orders.

The `gst-invoice` Edge Function creates an immutable invoice record, reserves a financial-year serial, renders a PDF and stores it in the private `gst-invoices` Storage bucket. Download requires either the authenticated order owner or the checkout capability token. The PDF is issued without a separate DSC; production electronic issuance remains gated on explicit seller-identity, accountant-format and freight-tax configuration.

Invoice creation fails closed unless every line has:
- a high-confidence, `classified` HSN;
- the explicit accountant-approved GST candidate flag and an effective rate/split/source snapshot; and
- a verified unit of measure.

It also requires a complete buyer billing address, a verified place-of-supply state and, for paid delivery orders with freight, a configured accountant-approved freight SAC/rate/UQC. Existing orders created before the migration have no complete GST snapshots and are not backfilled from today's catalogue.

## Validation

The `hsn-ecommerce-contract.cjs` regression contract checks the catalogue projection, confidence-gated product-page display, server-side checkout snapshot, authenticated order-history data, and schema migration.
