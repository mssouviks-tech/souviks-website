# GSC Canonical Selection Review — 24 November 2026

## Source and scope

Source: `souviks.co.in-Coverage-Drilldown-2026-11-23 (3).zip`, the Google Search Console Page indexing drilldown for **“Duplicate, Google chose different canonical than user”**, exported on 23 November 2026.

The export contains 351 unique affected URLs. Its `Last crawled` values describe Google's crawl history at export time; they do not identify the Google-selected canonical. That comparison requires URL Inspection data.

## Export profile

| Dimension | Count |
|---|---:|
| Total unique URLs | 351 |
| `www.souviks.co.in` host | 326 |
| Apex `souviks.co.in` host | 25 |
| English-prefixed routes | 36 |
| Bengali-prefixed routes | 142 |
| Hindi-prefixed routes | 150 |
| Unlocalized/root entity routes | 23 |
| Product URLs | 324 |
| Brand URLs | 16 |
| Vehicle URLs | 8 |
| Other routes | 3 |
| URLs ending in `.html` | 268 |
| Clean extensionless URLs | 83 |

Crawl age:
- July 2026: 19
- August 2026: 253
- September 2026: 24
- October 2026: 19
- November 2026: 36

A total of 296/351 URLs (84.3%) were last crawled before 1 October 2026. The export therefore contains a substantial historical component, and its counts should not be treated as a current snapshot of Google's canonical decisions.

## Code-level reconciliation

### Legacy .html routes

The current Pages redirect rules permanently redirect language-prefixed entity `.html` routes to their clean language-prefixed destinations. Root-level `.html` entity routes are also mapped to clean English routes. These patterns cover the legacy URL form represented by 268 export rows.

### Apex-host root entity paths

The export contains 25 apex-host URLs. Three are already language-prefixed routes handled by the existing host middleware. The remaining 22 are root-level entity/detail routes, for example:

- `https://souviks.co.in/products/7pk-1422-epdm-7pk-1422-v-belt.html`
- `https://souviks.co.in/products/p321510-spring-pin-32-x-151`
- `https://souviks.co.in/brands/anupam.html`
- `https://souviks.co.in/vehicles/tata-lpt`

Before this change, the apex-host middleware changed only the hostname for these root-level detail paths. The subsequent Pages redirect then localized the path (for example, `/products/:slug` to `/en/products/:slug`), creating a two-hop redirect chain.

The middleware now folds root-level `products`, `brands`, `categories` and `vehicles` detail paths—both clean and `.html` forms—into the same apex-to-www 301. This removes the avoidable second redirect for those 22 legacy-host URLs. Production smoke coverage checks representative product, brand and vehicle routes.

## Localized clean URLs: content review required

The export also contains clean, language-prefixed URLs, especially Bengali and Hindi product pages. These are not legacy `.html` aliases and should not be redirected to English by default.

Source inspection of representative current product pages found:
- The page shell and some metadata are localized.
- Product names, H1 headings, category/brand terminology and delivery-estimator prompts often remain in English.
- Technical product descriptions can remain English; in sampled cases the Bengali and Hindi pages shared the same English product-description text.

This is a plausible duplicate-content signal, but it does **not** prove which canonical Google selected for any individual URL. Canonical and hreflang tags alone cannot establish Google's decision.

The 24 November hreflang contract checks route-wide alternate uniqueness, target existence and destination self-canonicalization. It does not validate translation quality or force language pages to canonicalize to English.

## Required next evidence

Use fresh URL Inspection results on a representative sample of the remaining clean Bengali/Hindi URLs and compare:
- Google-selected canonical
- User-declared canonical
- Indexing verdict and coverage state
- Last crawl date and page fetch state

Prioritize URLs crawled in November, then sample older August/September rows. Only after that comparison should page content be localized, consolidated, noindexed or canonicalized. Do not bulk-change canonical tags from this export alone.

## Current decision

- Redirect-chain defect: code fix implemented with production smoke coverage.
- `.html` legacy aliases: current 301 rules are present; monitor recrawl and indexing convergence.
- Clean localized URLs: keep language-specific self-canonicals; content duplication remains an inspection-backed review item.
- No claim is made that all 351 URLs are now indexed or that Google's canonical selections have converged.
