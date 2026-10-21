# Delhivery delivery estimator setup

Customers enter only a delivery PIN code. The estimator automatically checks COD serviceability, approximate courier charges and delivery time from the stored approximate item weights. On product pages it estimates the selected product/quantity; in the cart it totals the approximate weights of all cart lines.

## Product weight field

Store approximate packed weight as `approx_weight_g` on each item in the canonical `assets/data/catalogue-index.json` records. **The unit is grams per single item.** Example: `"approx_weight_g": 850` means one item is approximately 850 grams. The catalogue builder preserves this field into generated product-page data and the product projection.

A few aliases are recognized (`weight_g`, `shipping_weight_g`, `approx_weight_grams`), but `approx_weight_g` is the canonical field. Do not put kilograms into a grams field. A missing or invalid weight deliberately prevents the estimator from returning a misleading quote. Billable/volumetric weight and final packaging may change courier charges.

## Required Supabase Edge Function secrets

Configure these in **Supabase Dashboard → Edge Functions → Secrets** for project `kjxrfmujzdxatpgegqcs`:

| Secret | Required | Description |
| --- | --- | --- |
| `DELHIVERY_ORIGIN_PIN` | Recommended | Souviks dispatch PIN code: `713321`. The function also has this as a safe default. |
| `DELHIVERY_B2C_API_TOKEN` | Yes | Production Delhivery B2C token for PIN serviceability and freight estimates. |
| `DELHIVERY_B2B_BEARER_TOKEN` | Recommended for delivery time | Bearer token for the B2B Expected TAT API at `ltl-clients-api.delhivery.com`. The function also tries `DELHIVERY_UMS_BEARER_TOKEN`, then the primary Delhivery token as a fallback; if the account uses separate B2B credentials, add the B2B Bearer token here. |

Never place Delhivery tokens in site JavaScript, HTML, a committed environment file, or a public GitHub Actions variable. Secret values cannot be read back here, so verify the exact secret names in Supabase Dashboard.

## API behaviour

- Customer-entered options are limited to the delivery PIN. The server fixes the quote to **COD + Express**.
- PIN serviceability and shipping charges use the Delhivery B2C production API with a `Token` authorization header.
- Estimated charges use Delhivery's invoice/charges API with chargeable weight in grams, COD, Express, and delivered status.
- Delivery time uses the B2B Expected TAT API with a separate `Bearer` token. Confirm access and the live response shape on Souviks' Delhivery account before treating it as production-ready.
- Delhivery describes charges as approximate. Final billable charges and dates may differ.
- The current Souviks ₹45,000 free-shipping policy remains separate. A Delhivery estimate must not be treated as the final checkout charge unless the business explicitly chooses to do so.
- The estimator uses the existing Supabase `cashfree_checkout_rate_limit` RPC for site-wide and per-IP throttling; the Cashfree checkout migration providing this RPC must already be applied.

## Validation

Run:
```sh
python3 scripts/catalogue/sync_delhivery_module.py
node scripts/regression/delhivery-estimate-contract.cjs
```

After merging, deploy the `delhivery-estimate` Edge Function and test PIN serviceability, COD freight charges, and B2B TAT separately with the production credentials. Do not mark the feature live until all three have been verified where available.
