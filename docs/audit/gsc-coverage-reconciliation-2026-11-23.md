# Google Search Console Coverage Reconciliation — 23 November 2026

## Source exports

The review used the Google Search Console Page indexing drilldowns exported on 23 November 2026.

| Issue | Example URLs in export |
|---|---:|
| Not found (404) | 602 |
| Redirect error | 5 |
| Duplicate: Google chose a different canonical | 351 |
| Excluded by noindex | 166 |
| Alternate page with proper canonical | 65 |
| Blocked by unauthorized request (401) | 2 |
| Discovered — currently not indexed | 306 |
| Crawled — currently not indexed | 213 |
| Page with redirect | 1,000 (GSC export cap) |

The 404 export contains 602 unique URL rows. 508 rows are product URLs (path contains /products/), representing 328 distinct product slugs after removing a terminal .html suffix. 110 URLs in the full 404 export end in .html.

## Changes in this PR

### 1. Verified product slug migrations

Twenty old product slugs were matched to active catalogue products by checking the generated product page identity, active catalogue ID, current slug, brand and manufacturer part number.

The manifest is stored at:

- assets/data/legacy-product-redirects.json

The corresponding direct permanent redirects are in _redirects. Each migration has eight concrete 301 variants:

- unlocalized path, with and without .html, to the English product page;
- en, bn and hi paths, each with and without .html, to the matching language product page.

| Old slug | Current slug | Product ID | Brand | Manufacturer reference |
|---|---|---|---|---|
| 0181n-tata-1210d-front-leaf-spring-svks000612 | 0181n-tata-1210d-front-leaf-spring | SVKS000596 | JAI | 0181N |
| 1931-tata-1516-1616-2213-front-leaf-spring-svks000618 | 1931-tata-1516-1616-2213-front-leaf-spring | SVKS000602 | JAI | 1931 |
| 2332s-ace-magic-spl-rear-leaf-spring-svks000605 | 2332s-ace-magic-spl-rear-leaf-spring | SVKS000589 | JAI | 2332S |
| 2582-tata-2515-lpt-3723-lpt-3118-tc-rear-leaf-spring-svks000613 | 2582-tata-2515-lpt-3723-lpt-3118-tc-rear-leaf-spring | SVKS000597 | JAI | 2582 |
| 2731-tata-2515-ex-4018-front-parabolic-leaf-spring-svks000614 | 2731-tata-2515-ex-4018-front-parabolic-leaf-spring | SVKS000598 | JAI | 2731 |
| 2951-tata-magic-front-parabolic-leaf-spring-svks000603 | 2951-tata-magic-front-parabolic-leaf-spring | SVKS000587 | JAI | 2951 |
| 539532x-taper-roller-bearing-svks000443 | 539532x-taper-roller-bearing | SVKS000440 | SKF | 539/532X |
| 6891-tata-lpt-3718-front-parabolic-leaf-spring-svks000616 | 6891-tata-lpt-3718-front-parabolic-leaf-spring | SVKS000600 | JAI | 6891 |
| 6901-tata-lpt-3718-front-parabolic-leaf-spring-type-2-svks000617 | 6901-tata-lpt-3718-front-parabolic-leaf-spring-type-2 | SVKS000601 | JAI | 6901 |
| kf3392-tie-rod-end-tata-lpt-3118-rh | kfl-kf3392-tie-rod-end-tata-lpt-3118-rh | SVKS000745 | KFL | KF3392 |
| s114004-000m00-combination-switch | unominda-s114004-000m00-combination-switch | SVKS001012 | UnoMinda | S114004-000M00 |
| tvs-girling-29966940d-dot-4-1-4-ltr | 29966940d-dot-4-1-4-ltr | SVKS000806 | TVS Girling | 29966940D |
| tvs-girling-4006094160-drain-valve-with-o-rings-set-of-15-nos | 4006094160-drain-valve-with-o-rings-set-of-15-nos | SVKS000810 | WABCO | 4006094160 |
| tvs-girling-a02309020-0200-tata-m20-x-2-5-x-78-knurled-bolt-and-nut | a02309020-0200-tata-m20-x-2-5-x-78-knurled-bolt-and-nut | SVKS000811 | TVS Girling | A02309020-0200 |
| tvs-girling-a15979020-0200-m22-x-2-5-x-115-bolt-w-m85900-nut | a15979020-0200-m22-x-2-5-x-115-bolt-w-m85900-nut | SVKS000812 | TVS Girling | A15979020-0200 |
| tvs-girling-a22479020-0200-m22-x-2-5-x-125-hub-bolt-w-nut-knurlbolt | a22479020-0200-m22-x-2-5-x-125-hub-bolt-w-nut-knurlbolt | SVKS000813 | TVS Girling | A22479020-0200 |
| tvs-girling-b00941020-0200-10-x-1-5-x-30-bolt-and-nut-assy-oaf | b00941020-0200-10-x-1-5-x-30-bolt-and-nut-assy-oaf | SVKS000814 | TVS Girling | B00941020-0200 |
| tvs-girling-b14305020-0200-14-x-1-5-x-50-bolt-and-nut-old-a-f-with-nut | b14305020-0200-14-x-1-5-x-50-bolt-and-nut-old-a-f-with-nut | SVKS000815 | TVS Girling | B14305020-0200 |
| tvs-girling-sias-6214dt-for-trailer-balloon-ca-20ft-2-duo-for-tr | sias-6214dt-for-trailer-balloon-ca-20ft-2-duo-for-tr | SVKS000817 | TVS Girling | SIAS6214DT |
| 7032-ace-dicor-mega-rear-parabolic-leaf-spring | 7032-ace-dicor-mega-rear-aux-a | SVKS000615 | JAI | 7032 |

### 2. Legacy root paths and .html entity paths

The 404 export includes legacy unlocalized routes such as /brands, /brands.html, /products.html, /vehicles.html, /request-part and /thank-you.html. Direct 301 mappings now send these to their language-prefixed public routes.

Four generic root-level entity rules were also added ahead of same-slug non-language rules:

- /products/:slug.html → /en/products/:slug
- /brands/:slug.html → /en/brands/:slug
- /categories/:slug.html → /en/categories/:slug
- /vehicles/:slug.html → /en/vehicles/:slug

The GSC export also contains the literal malformed path /${LANG}/brands.html; it now redirects directly to /en/brands.

### 3. Single-hop host and path normalization

The redirect-error export contains these five exact URLs:

- https://wwe.souviks.co.in/en/refund.html
- https://wwe.souviks.co.in/en/forgot-password.html
- https://wwe.souviks.co.in/en/
- https://wwe.souviks.co.in/
- https://souviks.co.in/en/brands.html

The last URL could previously require a hostname redirect followed by an .html redirect. functions/_middleware.js now normalizes known legacy page paths during the same host redirect. A production smoke check asserts that the apex /en/brands.html URL returns one 301 to the canonical www route.

The four wwe.souviks.co.in examples still require the hostname to be correctly configured as a Cloudflare Pages custom domain / DNS alias. The host is already listed in LEGACY_HOSTS; repository code cannot create or verify the Cloudflare DNS binding.

### 4. The two 401 URLs

- /products/12-x-12-mm-union now has an explicit direct 301 to the active English product page.
- /products/76-1512-a-dx-combination-switch-leyland-nm remains unmapped. No active product destination was verified, so no guessed part substitution is made.

## Intentionally not changed

- The 351 Google-selected canonical differences need URL Inspection evidence before any canonical or hreflang change. Multilingual product pages are not globally canonicalized to English.
- The 166 noindex and 65 alternate-canonical examples are exclusions that may be intentional; they are not automatically converted to indexable routes.
- The 306 discovered-not-indexed and 213 crawled-not-indexed URLs require a separate content/discovery review.
- Unmatched or ambiguous 404 product slugs are not redirected to similar-looking parts. Examples include the old 2002111-ace-brake-drum slug (the active product record does not share the same manufacturer reference), 279018030107, 886335000006 and ai-481-combination-switch-eicher.

## Automated safeguards

- scripts/audit/test_legacy_product_redirects.py validates each manifest product ID and current slug against the active catalogue, checks all eight direct URL variants, and rejects concrete redirect chains.
- scripts/audit/critical_build.py now includes the manifest, destination-route, root-route and no-chain contracts in the blocking build audit.
- The Catalogue PR Release Gate and the main catalogue publisher run the new regression test.
- scripts/audit/production_smoke.py tests the 20 unlocalized product migrations, representative localized / .html migrations, root legacy routes and the apex host/path normalization case.

This change does not claim that the 404 issue is fully resolved: it corrects verified routes and preserves ambiguous URLs for manual reconciliation.
