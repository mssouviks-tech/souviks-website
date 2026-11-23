# Souviks Performance Baseline

Updated: 2026-11-23

## Current production performance readout — 23 Nov 2026

- Repository: mssouviks-tech/souviks-website
- Latest completed production monitor inspected: [Production Performance Monitor #227](https://github.com/mssouviks-tech/souviks-website/actions/runs/45122140667) — success, 23 Nov 2026.
- Measured deployed revision: fdc621976a2a74f21e7ddc72d003ddeedbb807ea (fdc6219). The workflow waited for the matching deployment before testing.
- Static catalogue and price-history publishing continued on main after this measured revision. These timings are a dated baseline, not a claim that every later commit was re-measured.
- The measurements below were read from the workflow artifacts, not inferred from its green status.

### Mobile Lighthouse — monitor #227

Medians of three simulated-mobile Lighthouse runs per route. Performance is a score out of 100; transfer is reported network transfer.

| Route | Performance | LCP | FCP | TBT | CLS | Speed Index | Transfer |
|---|---:|---:|---:|---:|---:|---:|---:|
| Homepage | 87 | 3.31 s | 1.31 s | 271 ms | 0.0017 | 1.48 s | 1.59 MB |
| Products listing | 81 | 2.94 s | 1.28 s | 296 ms | 0.0006 | 1.28 s | 1.42 MB |
| Product detail | 81 | 3.97 s | 3.22 s | 84 ms | 0.0011 | 3.22 s | 1.12 MB |

Run-to-run variance remains material. The worst Lighthouse LCP run was 9.07 s on the homepage, 4.79 s on the listing and 4.28 s on the PDP; the other runs were materially faster. Do not use the median alone to claim every Lighthouse run is stable.

Compared with the 20 Nov monitor (#213), the homepage median LCP improved from 3.75 s to 3.31 s. The listing median was broadly unchanged (2.92 s to 2.94 s), while the PDP median increased from 3.20 s to 3.97 s. The score change and outliers should be interpreted alongside browser-observed measurements below; they do not, by themselves, prove a sustained regression.

### Production browser-observed LCP — monitor #227

Three production Chromium runs per route under CDP simulated 3G and 4× CPU throttling. These are browser PerformanceObserver LCP entries, not Lighthouse's simulated-mobile LCP.

| Route | Three LCP readings | Median | Maximum | Gate |
|---|---|---:|---:|---|
| Homepage | 1.91 s, 1.88 s, 1.86 s | 1.88 s | 1.91 s | Pass |
| Products listing | 1.70 s, 1.68 s, 1.66 s | 1.68 s | 1.70 s | Pass |
| Product detail | 1.54 s, 1.53 s, 1.58 s | 1.54 s | 1.58 s | Pass |

All nine runs returned HTTP 200, identified the expected final LCP image and remained below the strict 4.0-second budget. This is strong evidence that browser-observed LCP is healthy even though Lighthouse is more variable.

Run artifacts: [Lighthouse results and browser LCP diagnostics — monitor #227](https://github.com/mssouviks-tech/souviks-website/actions/runs/45122140667).

## SEO and performance checklist — status as at 23 Nov 2026

| Workstream | Status | Implementation / evidence | Remaining action |
|---|---|---|---|
| First-party JavaScript and route loading | Implemented | PRs [#243](https://github.com/mssouviks-tech/souviks-website/pull/243), [#244](https://github.com/mssouviks-tech/souviks-website/pull/244), [#247](https://github.com/mssouviks-tech/souviks-website/pull/247), [#257](https://github.com/mssouviks-tech/souviks-website/pull/257) | Retain architecture and regression checks; do not defer/split bundles without route-level evidence. |
| Supabase SDK on anonymous public routes | Implemented | Diagnostic [#250](https://github.com/mssouviks-tech/souviks-website/pull/250), saved-products session guard [#251](https://github.com/mssouviks-tech/souviks-website/pull/251), public PDP review reads without SDK [#262](https://github.com/mssouviks-tech/souviks-website/pull/262) | Re-test anonymous homepage, listing and PDP network requests after auth/runtime changes. Preserve authenticated review submission, account, RFQ and checkout flows. |
| Analytics privacy and ecommerce events | Instrumentation implemented; live property validation pending | Search privacy [#259](https://github.com/mssouviks-tech/souviks-website/pull/259); GST-safe ecommerce funnel [#264](https://github.com/mssouviks-tech/souviks-website/pull/264) | Verify event receipt in GA4 Realtime / DebugView and purchase attribution when property access is approved. Do not remove or further delay Google Tag based only on unused-JS estimates. |
| Shared UI imagery and responsive mobile hero | Implemented | Shared brand/about imagery [#252](https://github.com/mssouviks-tech/souviks-website/pull/252); mobile homepage hero crop [#260](https://github.com/mssouviks-tech/souviks-website/pull/260) | Keep measuring mobile Lighthouse and browser LCP. Product master imagery remains excluded from optimization. |
| Route-specific CSS delivery | Audited; no broad loading change justified | Monitor #227 intermittently estimated about 190 ms of homepage render-blocking savings; the estimate was not present in every run. The shared base stylesheet also showed about 11 KB of potentially unused CSS in sampled reports. PDP CSS did not show a consistent comparable render-blocking opportunity. | Do not make stylesheets asynchronous or inline the entire base stylesheet. Consider narrowly scoped unused-rule removal only if a route-specific test and repeatable performance gain justify it. Recheck FOUC, CLS and desktop/mobile rendering. |
| Production edge cache headers | Automated live-edge audit implemented | PR [#261](https://github.com/mssouviks-tech/souviks-website/pull/261) adds a production response-header check for representative HTML, static assets and data URLs. | Use the workflow's actual response report as evidence; repository _headers configuration alone is not proof of edge behaviour. |
| Catalogue image naming / static price-history assertion | Corrected | Gallery normalization [#253](https://github.com/mssouviks-tech/souviks-website/pull/253); clean pricing regression correction [#258](https://github.com/mssouviks-tech/souviks-website/pull/258) | Keep static catalogue and price-history validation gates enabled. |

## CSS delivery investigation — 23 Nov 2026

The current templates load the shared base stylesheet and their route bundle as regular stylesheets. Google Fonts are already loaded using a non-blocking media-switch pattern with a noscript fallback. The latest Lighthouse artifacts show a possible but intermittent homepage render-blocking saving (about 190 ms) and unused rules in the shared base CSS (about 11 KB in the sampled reports). The PDP did not show a consistent render-blocking saving.

The production browser-observed LCP medians are currently 1.54–1.88 seconds, with maxima of 1.58–1.91 seconds. A broad async-CSS or critical-CSS rewrite would add FOUC, font/layout timing and regression risk for a modest and inconsistent potential gain. The current decision is to hold CSS loading behaviour. If future measurements justify work, isolate unused shared rules by route, preserve cascade order, and rerun the full homepage/listing/PDP mobile and desktop matrix.

## Historical mobile Lighthouse baseline — 20 Nov 2026

Medians of three simulated-mobile Lighthouse runs per route from production monitor #213.

| Route | Performance | LCP | FCP | TBT | CLS | Speed Index | Transfer |
|---|---:|---:|---:|---:|---:|---:|---:|
| Homepage | 84 | 3.75 s | 2.78 s | 39 ms | 0.0017 | 2.78 s | 1.79 MB |
| Products listing | 93 | 2.92 s | 1.29 s | 49.5 ms | 0.0006 | 1.29 s | 1.52 MB |
| Product detail | 93 | 3.20 s | 1.29 s | 37.5 ms | 0.0011 | 1.29 s | 1.23 MB |

Run-to-run variance in monitor #213 was material: homepage Lighthouse LCP readings were 10.11 s, 3.75 s and 3.17 s; listing readings were 2.92 s, 4.64 s and 2.85 s.

### Production browser-observed LCP — 20 Nov 2026

Three production browser runs per route under CDP simulated 3G and 4× CPU throttling.

| Route | Three LCP readings | Median | Maximum | Gate |
|---|---|---:|---:|---|
| Homepage | 2.05 s, 2.04 s, 1.94 s | 2.04 s | 2.05 s | Pass |
| Products listing | 1.67 s, 1.65 s, 1.64 s | 1.65 s | 1.67 s | Pass |
| Product detail | 1.46 s, 1.49 s, 1.47 s | 1.47 s | 1.49 s | Pass |

Sources:
- 20 Nov production monitor #213: https://github.com/mssouviks-tech/souviks-website/actions/runs/44678938692
- 19 Nov production monitor #212: https://github.com/mssouviks-tech/souviks-website/actions/runs/44516604194

## Historical mobile Lighthouse baseline — 14 Oct 2026

The initial baseline was one mobile run on the pages.dev alias. The first post-deployment measurement used three mobile runs per route on the canonical production domain; values below are medians. Because host and run count changed, these are directional comparisons rather than a controlled A/B test.

| Route | Baseline score | First post-deploy score | Baseline LCP | First post-deploy LCP | Baseline TBT | First post-deploy TBT | Baseline transfer | First post-deploy transfer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Homepage | 54 | 74 | 21.60 s | 6.44 s | 832 ms | 89 ms | 4.93 MB | 1.53 MB |
| Products listing | 48 | 56 | 19.19 s | 23.93 s | 1,645 ms | 432 ms | 4.42 MB | 4.40 MB |
| Product detail | 87 | 63 | 3.93 s | 8.63 s | 54 ms | 214 ms | 0.96 MB | 0.91 MB |

Sources:
- Initial baseline: https://github.com/mssouviks-tech/souviks-website/actions/runs/38552100890
- First post-deploy run: https://github.com/mssouviks-tech/souviks-website/actions/runs/38559199355

## Product image integrity constraint

Keep product catalogue imagery at native source resolution. Do not resize, recompress, replace or regenerate master product images to improve Lighthouse's generic responsive-image savings estimate. Approved optimization is limited to shared UI imagery or delivery behaviour that leaves product catalogue source assets untouched.

## Historical source-byte snapshot — 14 Oct 2026

These are source-file sizes recorded from the repository on 14 Oct 2026, not compressed network-transfer sizes. They are a historical snapshot and are not a current post-Phase-1 measurement.

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

- Google Analytics is queued after page load and scheduled during browser idle time. Commerce and GST-safe purchase events are instrumented; real GA4 property receipt still requires access for validation.
- Supabase is loaded on demand. Anonymous public review reads use a lightweight read-only PostgREST request rather than downloading the SDK.
- First-party JavaScript is split by route, and Phase 1 source modules are preserved in readable form while runtime bundles remain minified.
- Product-page JavaScript defers full catalogue sorting/facet work until the listing hero has produced its LCP entry or the visitor interacts with a control.
- Product gallery images are lazy-loaded except the primary PDP image.
- Homepage and product-listing hero images use responsive mobile assets and explicit mobile preload hints.
- Shared hero/category/support/logo assets have optimized variants; product catalogue images remain untouched and at native source resolution.
- CSS base styles and route bundles are loaded as separate stylesheets; route CSS is not placed behind a CSS @import waterfall. CSS and shared-image URLs are versioned to avoid stale CDN cache entries.
- A production edge audit checks actual response headers for representative routes and assets; use its CI output, not only repository declarations.
- The bare-root language bootstrap has a timeout fallback so a language-detection failure cannot leave the loader permanently blocking navigation.

## Measurement rules

- Keep Lighthouse simulated-mobile metrics separate from production CDP browser-observed LCP.
- Use three runs per route and record median plus maximum; investigate material outliers rather than hiding them in the median.
- Measure the homepage, products listing and a representative PDP after any shared runtime, hero, CSS or image delivery change.
- Preserve product catalogue source images at native resolution.
- Do not split/defer large route bundles or make CSS asynchronous blindly. Measure route-specific execution and retain regression coverage for account, catalogue and checkout flows.
