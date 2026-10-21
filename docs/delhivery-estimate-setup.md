# Delhivery delivery estimator setup

This feature lets a customer check Delhivery PIN-code serviceability, approximate courier charges, and (when the separate B2B TAT credential is configured) estimated delivery days.

## Required Supabase Edge Function secrets

Configure these in **Supabase Dashboard → Edge Functions → Secrets** for project `kjxrfmujzdxatpgegqcs`:

| Secret | Required | Description |
| --- | --- | --- |
| `DELHIVERY_ORIGIN_PIN` | Recommended | Souviks dispatch PIN code. Current value: `713321`. |
| `DELHIVERY_B2C_API_TOKEN` | Yes | Production Delhivery One / B2C API token for PIN serviceability and estimated shipping charges. |
| `DELHIVERY_B2B_BEARER_TOKEN` | Optional | Bearer token for the B2B Expected TAT API at `ltl-clients-api.delhivery.com`. If unavailable, charges and serviceability can still be returned, but delivery days will say unavailable. |

Never place Delhivery tokens in site JavaScript, HTML, a committed environment file, or a public GitHub Actions variable. Use the production token and production account once Delhivery has approved live API access. Do not rotate an existing live token merely to test this feature.

## Deployment

Deploy the `delhivery-estimate` Supabase Edge Function after merging this branch. The repository's Supabase config sets `verify_jwt = false` for this one public estimator endpoint, so the handler restricts browser origins, validates all user inputs, uses a server-side rate limiter and never returns credentials. The limiter reuses the existing `cashfree_checkout_rate_limit` database RPC; ensure the Cashfree checkout migration containing this RPC is applied to this Supabase project.

## API behaviour

- PIN serviceability and shipping charge estimates use the Delhivery B2C production API and a `Token` authorization header.
- Estimated shipping charges use Delhivery's documented invoice/charges API with an Express or Surface mode, chargeable weight in grams, Pre-paid or COD, and `Delivered` status.
- Delivery time is queried from the Delhivery B2B Expected TAT API with a separate `Bearer` token. API response shapes may vary by account; test the live response before relying on date formatting.
- Delhivery documents its shipping-charge response as approximate. Actual billable charges can differ. The UI explicitly disclaims guaranteed prices and dates.
- Staging charge data may return zero amounts. Verify freight estimates using the approved production API token.
- The checker defaults to 1,000 g only as a rough starting point because the catalogue does not currently guarantee packed chargeable weights. Ask customers to use the known chargeable shipment weight for a more useful estimate; billable/volumetric weight and final package dimensions can change the amount.
- The Souviks ₹45,000 free-shipping policy remains a separate commercial decision. Do not automatically use this estimate as the final order shipping amount.

## Validation

Run:
```sh
python3 scripts/catalogue/sync_delhivery_module.py
node scripts/regression/delhivery-estimate-contract.cjs
```

Then test the serviceability API, charges API and B2B TAT API independently with Souviks' own token before considering the estimator production-ready.
