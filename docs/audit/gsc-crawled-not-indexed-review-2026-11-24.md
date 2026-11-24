# GSC “Crawled — currently not indexed” review — 24 November 2026

## Source

Google Search Console Page indexing drilldown exported on 23 November 2026:
`souviks.co.in-Coverage-Drilldown-2026-11-23 (8).zip`.

The export has 213 URL rows. This is a historical GSC snapshot, not a live URL Inspection result.

## URL profile

| Dimension | Count |
|---|---:|
| Total URLs | 213 |
| Product routes | 173 |
| Vehicle routes | 18 |
| Category routes | 11 |
| Brand routes | 10 |
| Request-a-Part query URL | 1 |
| `www.souviks.co.in` host | 180 |
| Apex `souviks.co.in` host | 33 |
| English-prefixed | 56 |
| Hindi-prefixed | 101 |
| Bengali-prefixed | 16 |
| Root/unlocalized | 40 |
| Clean URL paths | 186 |
| `.html` paths | 27 |

After removing locale prefixes and `.html` suffixes from the 173 product rows, 161 distinct product slugs remain. Twelve rows are duplicate URL variants of an already represented product route.

The crawl dates are spread from July through November 2026. The largest single date bucket is 39 URLs last crawled on 4 November. Unlike the 306 “Discovered — currently not indexed” export, these 213 URLs have actual recorded crawl dates.

## Code and sitemap checks

The current repository has:
- 3,522 product sitemap URLs: 1,174 each for English, Bengali and Hindi.
- 183 brand sitemap URLs: 61 per language.
- 39 category sitemap URLs: 13 per language.
- 78 vehicle sitemap URLs: 26 per language.
- 36 static-page sitemap URLs.

The generated sitemap files are language-prefixed and use clean extensionless canonical URLs. Product, brand, category and vehicle pages have language-specific route generation. The existing critical catalogue audit validates sitemap membership against the active catalogue, checks that sitemap URLs resolve to generated HTML, and rejects sitemap URLs carrying a noindex directive.

A representative source review of 18 URLs from this GSC export found that the current files exist in `main`, use self-referential language-specific canonical tags, and include the expected Product/BreadcrumbList or CollectionPage/BreadcrumbList JSON-LD types for the sampled page types. This is a sample, not a 213-URL exhaustive HTML audit.

The single Request-a-Part query URL is not an index target. The corresponding language-specific Request-a-Part document declares `noindex,follow` and a clean canonical without the query string.

## Legacy URL variants

The export includes 33 apex-host URLs, 40 root/unlocalized paths and 27 `.html` paths. These dimensions overlap.

- Root-level entity and product aliases redirect to language-prefixed canonical routes.
- Language-prefixed entity `.html` aliases redirect to clean extensionless routes.
- PR #268, merged on 24 November, folds apex-host root entity normalization into the same 301. Its post-merge Production Deployment Smoke passed. The full PR Catalogue Release Gate was still running at the time this review was prepared.

These old URL rows may remain in GSC until Google recrawls them. Their presence in the 23 November export does not prove the current redirect behavior is still broken.

## Interpretation and next action

The 213-row group is not one technical defect. It contains:
1. Legacy host/path and `.html` variants that now have direct redirect rules.
2. One noindex Request-a-Part query URL that is correctly excluded from indexing.
3. Clean localized product and entity URLs that are already represented in the current sitemaps and have current generated pages.

For the clean localized pages, the next useful diagnostic is direct internal-link coverage. The existing audit checks that internal links point to existing files, but it does not quantify whether each sitemap URL receives a direct internal anchor link from another indexable page. This PR adds that measurement to the existing SEO review report, including per-URL zero-link and low-link lists.

Do not blanket-remove these URLs from sitemaps, canonicalize localized pages to English, or request indexing for all 213. After internal-link coverage is measured, prioritize clean pages with no direct internal links and then use fresh URL Inspection results to distinguish quality/content selection from crawl and canonical issues.

Google URL Inspection results were not available in this review; no Google-selected canonical has been inferred.
