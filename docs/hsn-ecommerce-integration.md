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

The GST invoice generator is being implemented on branch `commerce/gst-invoice-generator-2026-11-10`. It adds server-calculated GST-inclusive price extraction, invoice-number reservations, immutable order snapshots, private PDF storage and authenticated/checkout-capability downloads. It must still fail closed for provisional or review-required HSN candidates; candidate GST approval is not a final HSN classification. The implementation is not production-active until the migration and Edge Functions are deployed and seller identity, electronic-issuance process, freight and accountant release gates are confirmed. See `docs/audit/gst-invoice-implementation-2026-11.md`.

## Validation

The `hsn-ecommerce-contract.cjs` regression contract checks the catalogue projection, confidence-gated product-page display, server-side checkout snapshot, authenticated order-history data, and schema migration.
