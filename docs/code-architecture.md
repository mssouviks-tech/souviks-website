# Souviks frontend code architecture

## Current ownership

| Responsibility | Current source of truth | Status |
| --- | --- | --- |
| Catalogue product data | `assets/data/catalogue-index.json` | Canonical |
| Product projection/search | `scripts/catalogue/build.py` | Generated deterministically |
| Product entity pages | `scripts/catalogue/enrich_entities.py` | Generated deterministically |
| Product gallery/static card rendering | `scripts/catalogue/enrich_entities.py` | Build-time |
| Product filtering/runtime cards | `assets/js/bundles/products.js` | Runtime |
| Product detail runtime | `assets/js/bundles/product.js` | Runtime |
| Shared site navigation/session utilities | `assets/js/site-core.js` | Shared runtime |
| Product schema/BreadcrumbList | `scripts/catalogue/build.py` | Build-time |
| Structured-data validation | `scripts/audit/structured_data.py` | CI |
| Critical production contract | `scripts/audit/critical_build.py` | Blocking CI |
| Entity sitemap generation | `scripts/catalogue/sync_entity_sitemaps.py` | Build-time |
| JavaScript architecture validation | `scripts/js/validate.py` | CI |
| Browser regression matrix | `scripts/regression/final-matrix.cjs` | Blocking PR/main CI |
| Production edge smoke test | `scripts/audit/production_smoke.py` | Main/manual CI |

## Naming convention

JavaScript and CSS modules use lowercase kebab-case:

- `product.js`
- `products.js`
- `request-quote.js`
- `site-core.js`

Numeric utility pages such as `404.js` are permitted.

## Current intentional exceptions

There is no longer an account-bundle exception. `account.js` consumes the shared `site-core.js` runtime, while retaining only account-specific modules and page lifecycle code.

## Refactor targets

### Shared navigation

The runtime navigation logic belongs to `site-core.js`. The remaining duplication is the navigation HTML present in every language/page file. The target architecture is a single build-time navigation partial rendered into each page, while keeping the resulting HTML crawlable and language-specific.

### Authentication/session

The normal site runtime owns Supabase client/session state. Account-page code consumes that shared session layer rather than initialize a second client. RFQ basket ownership and authenticated submission remain enforced by Supabase RLS/RPC on the database side.

### Product cards

Runtime catalogue cards belong to `products.js`. Build-time entity cards belong to `enrich_entities.py`. The next refactor should introduce a shared card contract/template so the two implementations cannot drift in fields, URLs, pricing or accessibility attributes.

### Schema and breadcrumbs

Schema and breadcrumb generation belong to `scripts/catalogue/build.py`. Generated HTML should not contain hand-maintained schema logic. Validation remains independent in `scripts/audit/structured_data.py`.

### Utilities / services / controllers

Large bundles remain the main maintainability debt. Refactors should separate data access, formatting utilities, UI components and page controllers without changing public URL or DOM contracts.

## CI rules

The blocking build contract checks:

- catalogue/entity identity and projection parity
- price integrity
- product image availability and file parity
- generated route and canonical parity
- full multilingual entity-page parity
- redirect target consistency
- robots/sitemap consistency
- generated internal links
- basic generated HTML structural integrity
- RFQ security boundary and database migration shape
- final multilingual/static regression

The JavaScript architecture checks enforce shared-core boundaries, script ordering and module naming. The browser regression workflow now runs against pull requests as well as main, so route, form, catalogue and mobile interaction regressions are caught before merge.

The production edge smoke workflow verifies the deployed public HTTP contract on main/manual runs, including security headers, redirects, robots, sitemap XML and 404 behavior. Cloudflare dashboard WAF/bot settings and live authenticated Supabase RLS behavior remain external controls and are not represented as closed by source-only checks.
