# Cashfree checkout setup

Souviks checkout uses a **two-stage payment flow for home delivery**. The first Cashfree payment collects the goods amount only. After Souviks packs the order and confirms chargeable weight/dimensions, staff sends a separate freight quotation and payment link. The final GST invoice is generated only after all required payments are verified.

**Checkout remains disabled until Cashfree credentials and the applicable tax/shipping policy are configured and tested.** No Cashfree secrets belong in GitHub, browser JavaScript, HTML or Cloudflare public variables.

## 1. Apply the database migrations

Apply the migrations in order:

1. `20261021200000_cashfree_checkout.sql` — order/payment storage, access tokens and rate limiting.
2. `20261023130000_checkout_fulfillment_method.sql` — delivery versus store pickup.
3. `20261111100000_gst_invoice_generation.sql` — private invoice ledger, financial-year sequence and private PDF storage.
4. `20261111190000_two_stage_delivery_freight.sql` — goods/freight payment timestamps, the additional order states and private `freight_quotes` ledger.

Payment, invoice and freight writes are made only by the Edge Functions with the project's server-side secret key. The tables are not granted to browser roles.

## 2. Set Edge Function secrets

In Supabase Dashboard → Edge Functions → Secrets, set these values. Use **Sandbox** credentials first.

| Secret | Rule |
| --- | --- |
| `CASHFREE_CLIENT_ID` | Cashfree Sandbox Client ID; used only when `CASHFREE_MODE=sandbox` |
| `CASHFREE_CLIENT_SECRET` | Cashfree Sandbox Client Secret |
| `CASHFREE_PRODUCTION_CLIENT_ID` | Cashfree Production Client ID; used only when `CASHFREE_MODE=production` |
| `CASHFREE_PRODUCTION_CLIENT_SECRET` | Cashfree Production Client Secret |
| `CASHFREE_MODE` | Keep `sandbox` during testing; change to `production` only for an approved live launch |
| `CASHFREE_CHECKOUT_ENABLED` | Keep false until all required configuration and tests pass |
| `CASHFREE_ENABLE_LIVE_CHECKOUT` | Leave false until live checkout is explicitly approved |
| `CASHFREE_SITE_URL` | `https://www.souviks.co.in` |
| `CASHFREE_CATALOGUE_URL` | Leave unset to use the canonical GitHub raw catalogue, or use the exact approved Souviks catalogue URL |
| `CASHFREE_PRICES_INCLUDE_GST` | `true` — online catalogue selling prices include applicable GST |
| `DELHIVERY_B2C_API_TOKEN` | Required for PIN serviceability |
| `DELHIVERY_ORIGIN_PIN` | Optional six-digit dispatch PIN; defaults to `713321` |

The GST invoice Edge Function also requires its existing seller-identity, electronic-issuance and reverse-charge configuration. Before delivery invoices can issue, the accountant-approved freight tax configuration must be present: `GST_FREIGHT_APPROVAL_STATUS=approved`, `GST_FREIGHT_PRICE_INCLUDES_GST=true`, the approved `GST_FREIGHT_SAC`, `GST_FREIGHT_RATE_PERCENT`, `GST_FREIGHT_UQC` and `GST_FREIGHT_APPROVAL_SOURCE`. Do not infer freight tax treatment from the approved product HSN/GST rates.

Customers choose **Home delivery** or **Store pickup** on the Cart page. Home delivery requires an Indian six-digit PIN for serviceability and ETA discovery; no courier amount is collected at this stage. Store pickup skips courier charges.

## 3. Deploy the Edge Functions

Deploy the updated code and shared dependency together:

- `cashfree-create-order` — validates the cart, creates an order for the goods subtotal only, and creates the first payment session.
- `cashfree-verify-order` — verifies the goods payment using Cashfree API reconciliation and the one-time checkout token.
- `cashfree-webhook` — verifies Cashfree signatures and routes goods payments versus freight payments to the correct reconciliation path.
- `account-orders` — exposes authenticated order and freight-quotation status.
- `gst-invoice` — generates the final private GST PDF; delivery orders are blocked until freight payment is verified.
- `freight-quote` — staff-authorized quotation creation, customer quote/payment access, separate Cashfree freight payment and verification.
- `_shared/cashfree.ts` — shared payment and invoice reconciliation logic used by the functions above.

The committed `supabase/config.toml` disables the gateway's legacy JWT check on guest/webhook endpoints. The handlers still validate allowed origins, staff/user authorization or quote tokens, checkout rate limits and signed Cashfree webhooks.

## 4. Configure the Sandbox webhook

After deploying the webhook function, register this endpoint in the Cashfree **Sandbox** dashboard:

`https://kjxrfmujzdxatpgegqcs.supabase.co/functions/v1/cashfree-webhook`

Subscribe to payment success, payment failure and user-dropped events available for the account. Use the Sandbox Client Secret for signature verification. Repeat webhook setup separately when a live account is approved.

## 5. Two-stage customer and staff workflow

1. Customer reviews the cart and pays the goods subtotal through Cashfree. The order records `shipping_amount = 0`; the review states that delivery fees will be calculated after packing.
2. Cashfree API/webhook reconciliation verifies the goods payment. A delivery order moves to `freight_pending`; store pickup moves to normal processing and can proceed to its invoice.
3. Staff packs the delivery order and records actual chargeable weight, parcel dimensions, courier, service level, ETA and the final freight amount in **My Account → Channel Attribution & Sales Funnel → Delivery quotations**.
4. The system creates a delivery quotation valid for 72 hours, a separate Cashfree payment link, and pre-filled WhatsApp and email message drafts. Staff must review and send those messages; the site does not automatically send them.
5. Customer pays the separate freight amount. Cashfree webhook and API reconciliation verify the freight transaction independently of the goods payment.
6. Once both payment stages are verified, the order total is updated to goods plus freight and the final GST invoice is generated and made available for secure download. Dispatch should happen only after the invoice/release checks pass.

Guest quote links use a hashed, expiring access token. Signed-in customers can use their authenticated account. The first-stage product payment and later freight payment have separate Cashfree order IDs; do not reconcile freight against the goods amount or vice versa.

## 6. Test before live launch

Check all of the following in Sandbox:

1. Product-only checkout for a delivery order; confirm no freight is included in the Cashfree amount even when catalogue weights are missing.
2. Store pickup; confirm it has no freight step and follows the invoice flow after its single payment.
3. A verified goods payment moves a delivery order to `freight_pending` and does not issue a GST invoice.
4. Staff can create a quote only with a valid staff role; verify packed chargeable weight, dimensions, carrier and amount are saved.
5. Customer can open the quote link, pay through Cashfree and see the freight status reconciled independently.
6. Duplicate/delayed goods and freight webhooks do not double-charge, demote paid states or compare against the wrong payment amount.
7. Invoice generation remains blocked before freight payment and succeeds only after both payments and the freight tax approval guard pass.
8. Guest token and authenticated-user access controls; expired quotes and payment links; payment retry after session expiry; and blocked quote revision while a live payment session exists.
9. Test payment status and account-order pages in English, Hindi and Bengali on mobile and desktop.

For Production preflight, store the Production credential pair without overwriting the Sandbox pair. After successful Sandbox regression, set `CASHFREE_MODE=production` while keeping `CASHFREE_ENABLE_LIVE_CHECKOUT=false`. Verify the Production webhook and tax/freight configuration. Only after explicit launch approval should you enable `CASHFREE_ENABLE_LIVE_CHECKOUT=true` and `CASHFREE_CHECKOUT_ENABLED=true`. Do not switch environments while Sandbox orders require reconciliation.

## Important current scope

The first phase supports domestic Indian orders and INR. International fulfilment, automated email/WhatsApp delivery, credit/debit notes, refund-linked invoice adjustments, stock reservation and shipping-label purchase require separate implementation or integration. The existing RFQ remains available for unpriced products, quote-only parts and bulk enquiries.
