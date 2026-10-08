# Souviks Performance Baseline

Updated: 2026-10-08

## Measured from source

These are source-byte sizes from the current repository, not compressed network-transfer sizes:

| Asset | Bytes |
|---|---:|
| assets/js/site-core.js | 58,488 |
| assets/js/bundles/index.js | 31,913 |
| assets/js/bundles/products.js | 171,122 |
| assets/js/bundles/product.js | 113,768 |
| assets/js/bundles/account.js | 284,915 |
| assets/css/site-base.css | 89,124 |
| assets/css/bundles/index.css | 31,713 |
| assets/css/bundles/products.css | 25,139 |
| assets/css/bundles/product.css | 43,011 |
| assets/css/bundles/account.css | 74,544 |

## Current delivery safeguards

- Google Analytics is loaded asynchronously.
- Supabase and shared site JavaScript are deferred.
- Product-page JavaScript deliberately does not make catalogue JSON, related-product loading or vehicle lookup a prerequisite for first interaction.
- Product gallery images are lazy-loaded except the primary PDP image.
- Primary PDP images and the homepage hero are preloaded selectively.
- Static assets receive long-lived browser/CDN cache headers through `_headers`.
- Catalogue JSON is deliberately revalidated rather than held stale for days.
- The bare-root language bootstrap has a timeout fallback so a language-detection failure cannot leave the loader permanently blocking navigation.

## Largest source bundles

`account.js` and `products.js` are the largest page-specific JavaScript bundles. `site-base.css` and `account.css` are the largest CSS bundles.

Do not split or defer these blindly. Measure route-specific execution cost first because the site is static and page-specific bundles are already separated by route.

## Not yet measured

Lighthouse/PageSpeed scores, LCP, CLS, INP, TBT and Speed Index remain open because the available live-browser runner currently has insufficient execution credits and direct PageSpeed report fetching is unavailable in this environment.

Actual Cloudflare response headers and Brotli delivery should likewise be verified from a real browser/network session; repository `_headers` configuration alone is not proof of edge behavior.

## Next performance tests

1. Run PageSpeed Insights mobile and desktop for `/en/`.
2. Run the same tests for `/en/products`, a representative PDP and one entity page.
3. Record LCP, CLS, INP, TBT, transfer size and render-blocking resources.
4. Compare mobile image transfer dimensions against the actual rendered image box before changing image strategy.
