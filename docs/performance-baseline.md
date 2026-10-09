# Souviks Performance Baseline

Updated: 2026-10-08

## Measured from current main

These are source-byte sizes from the current `main` revision on 2026-10-08, not compressed network-transfer sizes:

| Asset | Bytes |
|---|---:|
| assets/js/site-core.js | 65,901 |
| assets/js/bundles/index.js | 31,941 |
| assets/js/bundles/products.js | 175,235 |
| assets/js/bundles/product.js | 116,583 |
| assets/js/bundles/account.js | 286,432 |
| assets/css/site-base.css | 93,640 |
| assets/css/bundles/index.css | 34,101 |
| assets/css/bundles/products.css | 26,140 |
| assets/css/bundles/product.css | 44,012 |
| assets/css/bundles/account.css | 75,545 |

## Current delivery safeguards

- Google Analytics is loaded asynchronously.
- Supabase and shared site JavaScript are deferred.
- Product-page JavaScript deliberately does not make catalogue JSON, related-product loading or vehicle lookup a prerequisite for first interaction.
- Product gallery images are lazy-loaded except the primary PDP image.
- Primary PDP images and the homepage hero are preloaded selectively.
- Static assets receive long-lived browser/CDN cache headers through `_headers`.
- Catalogue JSON is deliberately revalidated rather than held stale for days.
- The bare-root language bootstrap has a timeout fallback so a language-detection failure cannot leave the loader permanently blocking navigation.
- `scripts/audit/performance_guard.py` blocks source-size regressions above 12% of the current-main baseline and rejects obvious runtime script-loading regressions such as non-deferred page bundles.

## Largest source bundles

`account.js` and `products.js` are the largest page-specific JavaScript bundles. `site-base.css` and `account.css` are the largest CSS bundles.

Do not split or defer these blindly. Measure route-specific execution cost first because the site is static and page-specific bundles are already separated by route.

## Not yet measured

Lighthouse/PageSpeed scores, LCP, CLS, INP, TBT and Speed Index remain external performance measurements rather than source-only checks. The repository now prevents material source-byte and script-loading regressions, but those user-perceived metrics still require a live browser/network measurement.

Brotli delivery and other CDN negotiation details also require a live browser/network session. The production edge smoke workflow verifies observable security headers, redirects, robots, sitemap XML and 404 behavior after changes reach `main`.

## Next performance tests

1. Run PageSpeed Insights mobile and desktop for `/en/`.
2. Run the same tests for `/en/products`, a representative PDP and one entity page.
3. Record LCP, CLS, INP, TBT, transfer size and render-blocking resources.
4. Compare mobile image transfer dimensions against the actual rendered image box before changing image strategy.
