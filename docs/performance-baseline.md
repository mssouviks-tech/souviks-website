# Souviks Performance Baseline

Updated: 2026-11-20

## Current production release

- Repository: `mssouviks-tech/souviks-website`
- Validated main revision: `d3bad97d606a78681a837c324d409961f710a451`
- Phase 1 JavaScript optimization: PRs [#243](https://github.com/mssouviks-tech/souviks-website/pull/243), [#244](https://github.com/mssouviks-tech/souviks-website/pull/244) and [#247](https://github.com/mssouviks-tech/souviks-website/pull/247) are merged.
- Static catalogue build: [run #352](https://github.com/mssouviks-tech/souviks-website/actions/runs/44677878679) — success.
- Production performance monitor: [run #213](https://github.com/mssouviks-tech/souviks-website/actions/runs/44678938692) — success. The workflow confirmed the deployed Cloudflare Pages revision matched the validated main revision.

## Measured mobile Lighthouse — 20 Nov 2026

These values are medians of three simulated-mobile Lighthouse runs for each route in production monitor #213. Score is shown as a percentage. Transfer is the median reported total network transfer.

| Route | Performance score | LCP | FCP | TBT | CLS | Speed Index | Transfer |
|---|---:|---:|---:|---:|---:|---:|---:|
| Homepage | 84 | 3.75 s | 2.78 s | 39 ms | 0.0017 | 2.78 s | 1.79 MB |
| Products listing | 93 | 2.92 s | 1.29 s | 49.5 ms | 0.0006 | 1.29 s | 1.52 MB |
| Product detail | 93 | 3.20 s | 1.29 s | 37.5 ms | 0.0011 | 1.29 s | 1.23 MB |

The median is materially better than the earlier 19 Nov monitor (#212): homepage score 68 to 84 and LCP 9.95 s to 3.75 s; listing score 77 to 93 and LCP 4.53 s to 2.92 s; product detail score 79 to 93 and LCP 4.29 s to 3.20 s.

Run-to-run variance remains relevant. In monitor #213 the three homepage Lighthouse LCP readings were 10.11 s, 3.75 s and 3.17 s; the listing readings were 2.92 s, 4.64 s and 2.85 s. Do not interpret a median alone as proof that every Lighthouse run is stable.

## Production browser-observed LCP gate — 20 Nov 2026

The same monitor performed three production browser runs per route under CDP simulated 3G and 4× CPU throttling. All nine observations passed the repository's strict 4.0-second maximum.

| Route | Three LCP readings | Median | Maximum | Gate |
|---|---|---:|---:|---|
| Homepage | 2.05 s, 2.04 s, 1.94 s | 2.04 s | 2.05 s | Pass |
| Products listing | 1.67 s, 1.65 s, 1.64 s | 1.65 s | 1.67 s | Pass |
| Product detail | 1.46 s, 1.49 s, 1.47 s | 1.47 s | 1.49 s | Pass |

The browser-observed LCP gate is a separate measurement from Lighthouse's simulated-mobile LCP. Both are useful; they must not be mixed into a single metric or treated as interchangeable.

## Historical mobile Lighthouse baseline — 14 Oct 2026

The initial baseline was one mobile run on the `pages.dev` alias. The first post-deployment measurement used three mobile runs per route on the canonical production domain; the table records the median of those three runs. Because the host and run count changed, these are directional comparisons rather than a controlled A/B test.

| Route | Baseline score | First post-deploy score | Baseline LCP | First post-deploy LCP | Baseline TBT | First post-deploy TBT | Baseline transfer | First post-deploy transfer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Homepage | 54 | 74 | 21.60 s | 6.44 s | 832 ms | 89 ms | 4.93 MB | 1.53 MB |
| Products listing | 48 | 56 | 19.19 s | 23.93 s | 1,645 ms | 432 ms | 4.42 MB | 4.40 MB |
| Product detail | 87 | 63 | 3.93 s | 8.63 s | 54 ms | 214 ms | 0.96 MB | 0.91 MB |

Sources:
- Initial baseline: https://github.com/mssouviks-tech/souviks-website/actions/runs/38552100890
- First post-deploy run: https://github.com/mssouviks-tech/souviks-website/actions/runs/38559199355
- 19 Nov production monitor: https://github.com/mssouviks-tech/souviks-website/actions/runs/44516604194
- 20 Nov production monitor: https://github.com/mssouviks-tech/souviks-website/actions/runs/44678938692

## Remaining evidence-backed opportunities

The 20 Nov Lighthouse reports show that the core LCP and interaction budgets are now substantially healthier. The remaining work should target confirmed network costs without destabilising authentication, analytics, checkout or catalogue delivery.

1. **Trace the Supabase SDK request on public routes.** Lighthouse still observes approximately 48 KB from `@supabase/supabase-js` on the homepage and public catalogue pages, with roughly 39–40 KB classified as unused in those page loads. PR #244 introduced lazy loading, so inspect the actual caller/import path and ensure public pages do not initialise the SDK before a feature needs it. Preserve sign-in, account, cart, checkout, delivery and review behaviour with regression coverage.

2. **Audit Google Analytics loading and event coverage.** Lighthouse reports about 183 KB transferred from the Google tag script, with roughly 77 KB classified as unused. The current implementation schedules analytics after page load/idle. Do not remove, block or materially delay measurement until key commerce events and conversion attribution are verified end-to-end.

3. **Optimise shared UI imagery only.** Lighthouse's homepage image-delivery estimate is approximately 566–603 KiB, but much of that estimate is generated by product catalogue photographs displayed in smaller cards. Candidate shared UI assets include the store-interior JPEG, brand/category artwork and the 1024px Souviks logo used at small rendered dimensions. Audit actual rendered dimensions and all references before creating appropriately sized/versioned UI derivatives.

4. **Review route CSS delivery after JS/network work.** Lighthouse continues to list `site-base.css` plus route CSS as render-blocking resources. TBT and browser LCP are currently low, so use the LCP phase data and browser traces to justify any critical-CSS or stylesheet-loading change; do not add broad inline CSS without a measurable benefit.

5. **Verify edge delivery characteristics.** Confirm Cache-Control, Brotli or other content encoding, and cache-hit behaviour against the production domain from an actual browser/network session. Repository `_headers` declarations alone do not prove Cloudflare edge behaviour.

## Product image integrity constraint

Keep product catalogue imagery at its native source resolution. Do not resize, recompress, replace or regenerate the master product images to improve Lighthouse's generic responsive-image savings estimate. Any approved optimisation must be limited to shared UI imagery or delivery behaviour that leaves product catalogue source assets untouched.

## Historical source-byte snapshot — 14 Oct 2026

The following were source-file sizes recorded from the repository on 14 Oct 2026, not compressed network-transfer sizes. They are a historical snapshot and are not a current post-Phase-1 measurement.

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

- Google Analytics is queued after page load and scheduled during browser idle time.
- Supabase and shared site JavaScript are deferred; the public-route SDK request remains a measured follow-up, not a reason to bypass account/checkout flows.
- First-party JavaScript is split by route, and Phase 1 source modules are preserved in readable form while the runtime bundles remain minified.
- Product-page JavaScript defers full catalogue sorting/facet work until the listing hero has produced its LCP entry or the visitor interacts with a control.
- Product gallery images are lazy-loaded except the primary PDP image.
- The homepage and product-listing hero images use responsive mobile assets and explicit mobile preload hints.
- Shared hero/category/support/logo assets have WebP variants; product catalogue images remain untouched and at native source resolution.
- CSS bundle base styles are loaded explicitly in parallel rather than through a CSS `@import` waterfall; CSS and WebP URLs are versioned to avoid stale CDN cache entries.
- Static assets receive long-lived browser/CDN cache headers through `_headers`; catalogue JSON is deliberately revalidated.
- The bare-root language bootstrap has a timeout fallback so a language-detection failure cannot leave the loader permanently blocking navigation.

## Measurement rules

- Keep Lighthouse simulated-mobile metrics separate from production CDP browser-observed LCP.
- Use three runs per route and record median plus maximum; investigate material outliers rather than hiding them in the median.
- Measure the homepage, products listing and a representative PDP after any shared runtime, hero, CSS or image delivery change.
- Preserve product catalogue source images at native resolution.
- Do not split/defer large route bundles blindly. Measure route-specific execution and retain regression coverage for all account, catalogue and checkout flows.
