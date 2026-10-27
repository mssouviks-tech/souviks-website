# Delhivery delivery estimator

The customer experience separates delivery-time discovery from checkout freight calculation. Online-checkout freight is estimated using the pre-paid tariff (not the COD tariff):

- **Product detail page:** the PIN checker sits directly below the product details beside the image gallery. After a successful check it collapses to a single compact row: “Delivery by {date}” and a green “Change PIN” link. The PIN input, heading and helper text are hidden until the customer chooses to change the PIN. The pickup date is the next working day after the check (Saturday/Sunday are skipped). A carrier ETA is used when supplied, clamped so it cannot precede that pickup date; otherwise a usable TAT is anchored to the pickup date, with a conservative 10-working-day fallback when no carrier date/TAT is provided.
- **Checkout:** a successful PIN/date check is saved in browser storage and carried to the Cart page, including the pickup date used as the estimate anchor. When the customer selects **Delivery**, the PIN is prefilled, the same estimated date is shown, and the delivery charge is estimated automatically from that PIN and the combined catalogue weights of the cart items. If the PIN changes or the saved estimate is older than 24 hours, delivery-time lookup is refreshed. The shipping summary and provisional total show the estimated freight; the server independently recalculates the amount due before payment. The options are labelled **Delivery** and **Store pickup**. Store pickup skips courier estimates and charges.

- **International date checks:** Delhivery offers international export and an account-based international rate calculator, but this integration's documented delivery-time API currently accepts an Indian destination PIN code. The public guidance describes the international calculator as using destination country, package weight and dimensions; it does not provide a verifiable public country-based ETA endpoint for this integration. Do not show a supposed live international date until Delhivery confirms Cross Border is enabled for the Souviks account and provides the supported international API endpoint/authentication and response schema.

## Product weight field

Store per-item approximate packed weight as `approx_weight_g` in each product record in the canonical `assets/data/catalogue-index.json`. **The unit is grams per single item.** Example: `"approx_weight_g": 850` means one item is approximately 850 grams. When you add weights to the stock sheet, map its new `Approx Weight (g)` column to `approx_weight_g` in the generated stock-sheet override; the catalogue builder now imports that field, carries it into generated product pages and the public product projection, and preserves existing weight data when the sheet value is blank.

The builder also recognizes `weight_g`, `shipping_weight_g`, and `approx_weight_grams` as aliases. `approx_weight_g` is the preferred field. Do not enter kilograms into a grams field. Freight calculation starts using live Delhivery rates only after every cart item has a valid weight.

### Until the stock sheet is updated

No default or guessed product weight is used. When one or more items lack a weight, online checkout is blocked and the customer is asked to request a quote rather than being charged an invented flat fee. Once all weights are available, checkout uses the live Delhivery prepaid + Express charge for the combined cart weight. Every shipped order incurs shipping charges, regardless of order value; there is no free-shipping threshold.

If weights are present but Delhivery cannot calculate a quote, checkout fails safely and asks the customer to retry or request a quote. It never silently falls back to a different fee when a live weighted quote was attempted.

## Required Supabase Edge Function secrets

Configure these in **Supabase Dashboard → Edge Functions → Secrets** for project `kjxrfmujzdxatpgegqcs`:

| Secret | Required | Description |
| --- | --- | --- |
| `DELHIVERY_ORIGIN_PIN` | Recommended | Souviks dispatch PIN code: `713321`. The function has this safe default. |
| `DELHIVERY_B2C_API_TOKEN` or `DELHIVERY_API_TOKEN` | Yes | Production Delhivery B2C token for PIN serviceability and freight estimates. |
| `DELHIVERY_UMS_USERNAME` (preferred), `DELHIVERY_UMS_ID`, `DELHIVERY_UMS_USER_ID`, or `DELHIVERY_UMS_USER` | Recommended for delivery time | Delhivery One / UMS login ID. Use one of these names for the same value; `DELHIVERY_UMS_USERNAME` is preferred. When paired with the password, the function requests and caches a short-lived B2B bearer token and refreshes it when the JWT is nearing expiry. |
| `DELHIVERY_UMS_PASSWORD` | Recommended for delivery time | Password for the UMS account. Store only as a Supabase Edge Function secret; never put it in browser code or Git. |
| `DELHIVERY_B2B_BEARER_TOKEN` or `DELHIVERY_UMS_BEARER_TOKEN` | Optional alternative for delivery time | Manually supplied UMS bearer token. This is separate from the B2C API token and may expire; username/password is preferred for automatic refresh. |

Never place Delhivery tokens in site JavaScript, HTML, a committed environment file, or public GitHub Actions variables. Secret values cannot be read back here, so verify the exact names in Supabase Dashboard.

## API behaviour

- Product page calls the `delhivery-estimate` function with `estimate_type: delivery_time`; the endpoint queries PIN serviceability and the B2B Expected TAT endpoint. Packed weight is not required to estimate transit time.
- Checkout reuses a recent, matching product-page date and calls `estimate_type: shipping_charge` with the combined cart weight. A changed PIN or expired estimate triggers a fresh delivery-time lookup. Customers do not choose a service or payment type; the shipping quote uses **Pre-paid + Express**.
- The checkout shipping summary displays the estimate and a provisional total. The secure server-side order review recalculates freight independently before payment.
- `cashfree-create-order` fetches trusted catalogue data again, aggregates weights server-side, and requests its own Pre-paid + Express freight quote. It does not trust any client-provided freight amount when creating the Cashfree order.
- Shipping fees are estimated in grams against the destination PIN and Souviks origin PIN `713321`. Delhivery describes these charges as approximate; package dimensions, chargeable/volumetric weight and final carrier billing can change them.
- Every shipped order incurs shipping charges. There is no free-shipping threshold; the carrier charge is based on the cart weight and destination.

## Validation

Run:
```sh
python3 scripts/catalogue/sync_delhivery_module.py
node scripts/regression/delhivery-estimate-contract.cjs
```

This change reuses the existing `delhivery-estimate` and `cashfree-create-order` functions; no server-side code is changed here. Confirm the currently deployed function versions and fixed Delhivery credentials are active in Supabase, then test a product PIN lookup and a weighted cart against live serviceability and freight data.
