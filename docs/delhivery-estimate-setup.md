# Delhivery delivery estimator and post-packing freight workflow

The checkout separates **delivery availability/ETA** from **freight pricing**. The customer can confirm that the PIN is serviceable and see an estimated delivery date before paying for the goods. Freight is calculated only after Souviks packs and weighs the order.

## Customer flow

- **Product detail page:** the PIN checker queries delivery serviceability and expected transit time. A successful check shows a compact “Delivery by {date}” row and a Change PIN action. The estimate uses a carrier date/TAT where available, with a conservative 10-working-day fallback. It does not calculate or quote freight.
- **Cart / first checkout:** selecting Home delivery requires an Indian six-digit destination PIN. The cart can reuse a recent, matching serviceability/date result and refresh it when the PIN changes or the estimate is older than 24 hours. The delivery summary explicitly says charges are calculated after packing. The initial Cashfree payment is for the goods only; delivery freight is zero at this stage. Catalogue weights are not required to create this first payment.
- **After product payment:** the order enters `freight_pending`. Souviks packs the order and confirms actual chargeable weight and parcel dimensions. Staff checks the relevant courier tariff/quote and enters the final delivery amount in **My Account → Channel Attribution & Sales Funnel → Delivery quotations**.
- **Freight quotation:** the staff tool stores the package weight/dimensions, courier, service level, estimate and final freight amount. It creates a 72-hour quote and separate Cashfree payment link, with pre-filled WhatsApp and email messages. Staff reviews and sends those messages from the relevant app; they are not automatically sent by the site.
- **Final invoice:** the final GST invoice is not issued at the goods-payment stage for delivery orders. It is generated only after the separate freight payment is verified, and before dispatch. Freight tax treatment must also pass the configured accountant-approval checks.
- **Store pickup:** skips courier checks and freight payment. After the product payment is verified, the normal invoice flow can proceed.

Every delivered order incurs the applicable freight charge; there is no free-shipping threshold. The customer is not charged a provisional or guessed freight amount at the first checkout.

## Product weight field

Store per-item approximate packed weight as `approx_weight_g` in each product record in the canonical `assets/data/catalogue-index.json`. **The unit is grams per single item.** Example: `"approx_weight_g": 850` means one item is approximately 850 grams. The catalogue builder also recognizes `weight_g`, `shipping_weight_g`, and `approx_weight_grams` as aliases. `approx_weight_g` is preferred.

These catalogue weights can help staff estimate packing requirements, but they are **not** used to determine the customer’s initial payment or final freight quote. Use the actual packed/chargeable weight and parcel dimensions when preparing the final quotation. Do not enter kilograms into a grams field.

## Required Supabase Edge Function secrets

Configure these in **Supabase Dashboard → Edge Functions → Secrets** for project `kjxrfmujzdxatpgegqcs`:

| Secret | Required | Description |
| --- | --- | --- |
| `DELHIVERY_ORIGIN_PIN` | Recommended | Souviks dispatch PIN code: `713321`. The function has this safe default. |
| `DELHIVERY_B2C_API_TOKEN` or `DELHIVERY_API_TOKEN` | Yes | Production Delhivery B2C token for PIN serviceability. |
| `DELHIVERY_UMS_USERNAME` (preferred), `DELHIVERY_UMS_ID`, `DELHIVERY_UMS_USER_ID`, or `DELHIVERY_UMS_USER` | Recommended for delivery time | Delhivery One / UMS login ID. The function requests and caches a short-lived B2B bearer token when paired with the password. |
| `DELHIVERY_UMS_PASSWORD` | Recommended for delivery time | Password for the UMS account. Store only as a Supabase Edge Function secret. |
| `DELHIVERY_B2B_BEARER_TOKEN` or `DELHIVERY_UMS_BEARER_TOKEN` | Optional alternative for delivery time | Manually supplied UMS bearer token. It may expire; username/password is preferred for automatic refresh. |

Never place Delhivery tokens in site JavaScript, HTML, a committed environment file, or public GitHub Actions variables. Secret values cannot be read back here, so verify the exact names in Supabase Dashboard.

## API behaviour

- Product and cart PIN checks call the `delhivery-estimate` function with `estimate_type: delivery_time`. The endpoint checks serviceability and the B2B Expected TAT endpoint. Packed weight is not required for this date lookup.
- The cart client no longer calls `estimate_type: shipping_charge` and does not change the checkout freight line or total based on a provisional carrier amount.
- `cashfree-create-order` charges only the trusted catalogue goods subtotal for both delivery and pickup. For delivery, it writes `shipping_amount = 0` and marks that a freight quotation is required after payment.
- The new `freight-quote` Edge Function accepts the final packed-weight and freight values entered by an authorized staff member. It creates a separate Cashfree order; it does not trust browser-provided freight or catalogue-weight estimates.
- After verified freight payment, the order's final total is updated to goods plus freight and the GST invoice generator is invoked. The invoice still fails closed unless the configured freight SAC/rate/inclusive-price approval is present.

## Validation

Run:
```sh
python3 scripts/catalogue/sync_delhivery_module.py
node scripts/regression/delhivery-estimate-contract.cjs
node scripts/regression/gst-invoice-generator-contract.cjs
```

For release, also run the product-only Cashfree payment, staff freight quotation, separate freight payment, webhook reconciliation, guest-token access, invoice generation and store-pickup sandbox tests. Do not deploy the new flow until the freight migration and Edge Functions are deployed together.
