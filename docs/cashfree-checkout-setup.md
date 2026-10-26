# Cashfree checkout setup

This change adds a domestic India checkout path alongside the existing RFQ flow. **Checkout remains disabled until the Cashfree Sandbox credentials and the tax/shipping policy are configured and tested.** No Cashfree secrets belong in GitHub, browser JavaScript, HTML or Cloudflare public variables.

## 1. Apply the database migration

Apply `supabase/migrations/20261021200000_cashfree_checkout.sql` to the Souviks Supabase project before deploying the functions. The tables have RLS enabled and are not granted to browser roles. The Edge Functions use the project's server-side secret key.

## 2. Set Edge Function secrets

In Supabase Dashboard → Edge Functions → Secrets, set these values. Use **Sandbox** credentials first.

| Secret | Sandbox value / rule |
| --- | --- |
| `CASHFREE_CLIENT_ID` | Cashfree Sandbox Client ID; used only when `CASHFREE_MODE=sandbox` |
| `CASHFREE_CLIENT_SECRET` | Cashfree Sandbox Client Secret; used for Sandbox API authentication and webhook signature verification |
| `CASHFREE_PRODUCTION_CLIENT_ID` | Cashfree Production Client ID; used only when `CASHFREE_MODE=production` |
| `CASHFREE_PRODUCTION_CLIENT_SECRET` | Cashfree Production Client Secret; used for Production API authentication and webhook signature verification |
| `CASHFREE_MODE` | Keep `sandbox` during testing; change to `production` only for an approved live launch |
| `CASHFREE_CHECKOUT_ENABLED` | `true` only when the necessary config below is present; otherwise unset or `false` |
| `CASHFREE_ENABLE_LIVE_CHECKOUT` | Leave unset or `false` until live checkout has been explicitly approved |
| `CASHFREE_SITE_URL` | `https://www.souviks.co.in` |
| `CASHFREE_CATALOGUE_URL` | Leave unset to use the repository's canonical public catalogue, or use `https://raw.githubusercontent.com/mssouviks-tech/souviks-website/main/assets/data/catalogue-index.json` |
| `CASHFREE_PRICES_INCLUDE_GST` | `true` — Souviks has confirmed online catalogue selling prices include GST |
| `DELHIVERY_B2C_API_TOKEN` | Required server-side Delhivery API token for PIN serviceability and prepaid shipping quotes |
| `DELHIVERY_ORIGIN_PIN` | Optional six-digit origin PIN for the dispatch location; defaults to `713321` and must be confirmed for the actual dispatch warehouse |
 
Customers choose **Home delivery** or **Store pickup** on the Cart checkout page. Home delivery requires an Indian six-digit PIN and uses server-side Delhivery serviceability and prepaid freight calculations for every delivery order, based on the destination PIN and trusted catalogue weights. Store pickup skips courier serviceability and freight calculation, requires no delivery address, and has no courier charge. The selected method is saved on the order. There is **no free-shipping threshold**: carrier freight is charged on every shipped order, regardless of order subtotal. Delhivery quotes are estimates and actual carrier charges can vary; if weights or a quote are missing or unavailable, delivery checkout must stop rather than silently use a fixed fallback. Keep `CASHFREE_CHECKOUT_ENABLED` false until Sandbox credentials, Delhivery credentials, tax/shipping behavior and checkout tests have been verified.

The edge function reads the canonical catalogue from the public GitHub raw endpoint by default, rather than depending on the Cloudflare-hosted website being accessible to server-to-server requests. It revalidates selected product IDs, active status and price server-side at order creation. An optional catalogue URL is restricted to this repository's raw GitHub catalogue or the exact Souviks catalogue path; if neither source is reachable, checkout fails closed rather than trusting browser prices.

## 3. Deploy functions

Deploy these three functions after the migration:

- `cashfree-create-order` — validates the cart, calculates the final amount, writes an order, and asks Cashfree for a payment session.
- `cashfree-verify-order` — verifies return status using the one-time checkout token stored in the customer's session and queries Cashfree's API directly.
- `cashfree-webhook` — verifies Cashfree's HMAC signature and reconciles payment state against Cashfree's API. Do not mark orders paid based only on the redirect query string.

The committed `supabase/config.toml` disables the gateway's legacy JWT check on these guest/webhook endpoints. The functions still check website origin, enforce a server-side rate limit for order creation, validate guest order tokens, and verify the webhook signature.

## 4. Configure the Sandbox webhook

After deploying the webhook function, register this endpoint in the Cashfree **Sandbox** dashboard:

`https://kjxrfmujzdxatpgegqcs.supabase.co/functions/v1/cashfree-webhook`

Subscribe to the payment success, payment failure and user-dropped events available for your account. Use the Sandbox client's secret for signature verification. Repeat webhook setup separately when a live account is approved.

## 5. Test before live launch

Check all of the following in Sandbox:

1. Add a priced item, change quantity and remove an item; confirm the RFQ basket still works separately.
2. Try a missing/inactive item and a price/amount mismatch; the server must reject the checkout.
3. Complete a successful test payment and verify the order changes to `paid / confirmed` only after Cashfree API reconciliation.
4. Simulate failure, user drop, timeout and refresh; the page must not claim success.
5. Deliver a duplicate webhook and confirm the order is not duplicated or fulfilled twice.
6. Test cart and payment status pages in English, Hindi and Bengali on mobile and desktop.
7. Verify that every home-delivery cart—including high-value carts—receives a Delhivery quote, and checkout stops if any item weight or the freight quote is unavailable. Confirm pickup has no courier charge, plus GST and invoice treatment.
8. Confirm settlement, refund, cancellation, notification and fulfilment procedures with the business before production.

For Production webhook preflight, first store the Production pair as `CASHFREE_PRODUCTION_CLIENT_ID` and `CASHFREE_PRODUCTION_CLIENT_SECRET` in Supabase Edge Function Secrets without overwriting the Sandbox pair. After successful Sandbox regression, set `CASHFREE_MODE=production` while keeping `CASHFREE_ENABLE_LIVE_CHECKOUT=false`. Verify the Production webhook registration and signature behavior and confirm tax and freight calculations. Only after explicit launch approval should you set `CASHFREE_ENABLE_LIVE_CHECKOUT=true` and `CASHFREE_CHECKOUT_ENABLED=true`. Do not switch environments while Sandbox orders still require reconciliation.

## Important current scope

The first phase supports domestic Indian shipping and INR. International orders, GST invoice generation, stock reservation, shipping labels, automated customer emails, refunds from the dashboard, and customer order history require separate implementation or integration. The existing RFQ remains available for unpriced products, quote-only parts, and bulk orders.
