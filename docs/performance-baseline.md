# Souviks Performance Baseline

Updated: 2026-10-14

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

- Google Analytics is queued immediately but its network script is scheduled after page load and browser idle time.
- Supabase and shared site JavaScript are deferred.
- Product-page JavaScript deliberately does not make catalogue JSON, related-product loading or vehicle lookup a prerequisite for first interaction.
- Product gallery images are lazy-loaded except the primary PDP image.
- Primary PDP images, the homepage hero and the product-listing hero are preloaded selectively.
- Shared hero/category/support/logo assets have WebP variants; product catalogue images remain untouched and at native source resolution.
- CSS bundle base styles are loaded explicitly in parallel rather than through a CSS `@import` waterfall; CSS and WebP URLs are versioned to avoid stale CDN cache entries.
- Static assets receive long-lived browser/CDN cache headers through `_headers`.
- Catalogue JSON is deliberately revalidated rather than held stale for days.
- The bare-root language bootstrap has a timeout fallback so a language-detection failure cannot leave the loader permanently blocking navigation.

## Largest source bundles

`account.js` and `products.js` are the largest page-specific JavaScript bundles. `site-base.css` and `account.css` are the largest CSS bundles.

Do not split or defer these blindly. Measure route-specific execution cost first because the site is static and page-specific bundles are already separated by route.

## Measured mobile Lighthouse — 14 Oct 2026

The initial baseline was one mobile run on the `pages.dev` alias. The first post-deployment measurement used three mobile runs per route on the canonical production domain; the table below records the median of those three runs. Because the host and run count changed, these are directional comparisons rather than a perfectly controlled A/B test.

| Route | Baseline score | First post-deploy score | Baseline LCP | First post-deploy LCP | Baseline TBT | First post-deploy TBT | Baseline transfer | First post-deploy transfer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Homepage | 54 | 74 | 21.60 s | 6.44 s | 832 ms | 89 ms | 4.93 MB | 1.53 MB |
| Products listing | 48 | 56 | 19.19 s | 23.93 s | 1,645 ms | 432 ms | 4.42 MB | 4.40 MB |
| Product detail | 87 | 63 | 3.93 s | 8.63 s | 54 ms | 214 ms | 0.96 MB | 0.91 MB |

Sources:
- Baseline run: https://github.com/mssouviks-tech/souviks-website/actions/runs/38552100890
- First post-deploy run: https://github.com/mssouviks-tech/souviks-website/actions/runs/38559199355

The first pass substantially reduced homepage image transfer and TBT. The products listing still used the old `product-hero.png` despite the source CSS pointing to WebP, indicating stale CSS/CDN caching and a missing early preload. The product detail LCP also has a large render-delay component despite a small primary image loading quickly. A41 therefore remains open until the cache-busting, CSS-discovery and analytics scheduling follow-up is deployed and measured.

Actual Cloudflare response headers and Brotli delivery should be verified from a real browser/network session; repository `_headers` configuration alone is not proof of edge behavior.

## Next performance tests

1. Repeat three mobile Lighthouse runs on the canonical production domain after the cache-busting/CSS/preload changes.
2. Confirm the products listing no longer requests `product-hero.png` and that the WebP preload is reused.
3. Re-check LCP phase breakdown, TBT, total transfer and render-blocking resources for the homepage, products listing and representative PDP.
4. Keep product catalogue imagery at native source resolution; optimise only how shared UI imagery is delivered.
