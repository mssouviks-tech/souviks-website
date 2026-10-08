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

## Naming convention

JavaScript and CSS modules use lowercase kebab-case:

- `product.js`
- `products.js`
- `request-quote.js`
- `site-core.js`

Numeric utility pages such as `404.js` are permitted.

## Current intentional exceptions

`assets/js/bundles/account.js` remains self-contained because its dependency order and account-page lifecycle differ from the normal page-bundle model. This is now tracked as refactor debt rather than treated as an undocumented special case.

## Refactor targets

### Shared navigation

The runtime navigation logic already belongs to `site-core.js`. The remaining duplication is the navigation HTML present in every language/page file. The target architecture is a single build-time navigation partial rendered into each page, while keeping the resulting HTML crawlable and language-specific.

### Authentication/session

The normal site runtime should own Supabase client/session state. Account-page code should consume that shared session layer rather than initialize its own client. This removes the remaining duplicated authentication boundary.

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

The JavaScript architecture checks enforce shared-core boundaries, script ordering and module naming. The code-quality report remains non-blocking until the large bundles are migrated incrementally.
