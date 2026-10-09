# Souviks frontend code architecture

## Current ownership

| Responsibility | Current source of truth | Status |
| --- | --- | --- |
| Catalogue product data | `assets/data/catalogue-index.json` | Canonical |
| Product projection/search | `scripts/catalogue/build.py` | Generated deterministically |
| Product entity pages | `scripts/catalogue/enrich_entities.py` | Generated deterministically |
| Product gallery/static card rendering | `scripts/catalogue/product_card.py` | Build-time |
| Product listing runtime | `assets/js/products/` | Ordered page modules |
| Product detail runtime | `assets/js/product/` | Ordered page modules |
| Shared site navigation/session utilities | `assets/js/site-core.js` | Shared runtime |
| Account page runtime | `assets/js/account/` | Ordered page modules; consumes shared cores |
| RFQ page runtime | `assets/js/request-quote/` | Ordered page modules; consumes shared cores |
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

The top-level files under `assets/js/bundles/` remain as compatibility entrypoints for older direct references. They are not authoritative implementations and are kept below the enforced 4 KB stub limit.

## Refactor targets

### Shared navigation

The runtime navigation logic already belongs to `site-core.js`. The remaining duplication is the navigation HTML present in every language/page file. The target architecture is a single build-time navigation partial rendered into each page, while keeping the resulting HTML crawlable and language-specific.

### Authentication/session

The normal site runtime should own Supabase client/session state. Account-page code should consume that shared session layer rather than initialize its own client. This removes the remaining duplicated authentication boundary.

### Product cards

Build-time product-card markup belongs to `scripts/catalogue/product_card.py`; runtime listing/PDP rendering belongs to the ordered modules under `assets/js/products/` and `assets/js/product/`. The data contract is shared through catalogue projections and blocking parity checks.

### Schema and breadcrumbs

Schema and breadcrumb generation belong to `scripts/catalogue/build.py`. Generated HTML should not contain hand-maintained schema logic. Validation remains independent in `scripts/audit/structured_data.py`.

### Utilities / services / controllers

Legacy compatibility bundles are no longer the source of page behaviour. The remaining maintainability debt is concentrated in individual page modules and shared service boundaries. Refactors should separate data access, formatting utilities, UI components and page controllers without changing public URL or DOM contracts.

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

The JavaScript architecture checks enforce shared-core boundaries, script ordering and module naming. The code-quality report remains non-blocking for informational debt metrics; structural JS boundaries and syntax are blocking CI checks.


## Release boundary

The catalogue release gate builds and validates the candidate tree before the main-branch publisher commits generated projections. The JavaScript refactor workflow is read-only; `build-static-catalogue.yml` is the sole generated-catalogue publisher.
