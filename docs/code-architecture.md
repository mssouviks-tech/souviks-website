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

The runtime navigation logic belongs to `site-core.js`; `scripts/catalogue/navigation.py` is the single source for navigation markup, and `scripts/catalogue/sync_navigation.py` renders it into each static page. The resulting HTML is intentionally present in every page so links remain crawlable and the site remains usable without runtime rendering. CI verifies the generated markup and rejects whitespace-only output changes.

### Authentication/session

Supabase client creation and the single auth-state subscription belong to `assets/js/site-core.js`. Account modules use the shared session state, and the RFQ module listens to the dispatched `souviks:auth-state` event instead of subscribing directly to Supabase. The architecture validator blocks duplicate client creation or auth-state listeners.

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

The JavaScript architecture checks enforce shared-core boundaries, page-module order, module naming, and auth ownership. ESLint, Node syntax checks, Prettier formatting checks, and `git diff --check` are blocking CI gates. The code-quality report remains non-blocking for informational debt metrics.


## Release boundary

The catalogue release gate builds and validates the candidate tree before the main-branch publisher commits generated projections. The JavaScript refactor workflow is read-only; `build-static-catalogue.yml` is the sole generated-catalogue publisher.

The transition is deployment-safe: account pages are migrated alongside their modules in the PR, while the existing `product.js` and `products.js` compatibility implementations remain intact in the merge commit. The publisher then validates and commits the generated product-page module references and compatibility stubs together, avoiding an intermediate deployment where legacy pages would reference empty bundles.

## Required repository setting

The `main` branch currently has no branch protection/ruleset. CI workflows pass on pull requests, but GitHub does not enforce those checks against direct pushes until repository rules require the `Catalogue PR Release Gate / validate` and `Refactor Static JavaScript / refactor` checks and restrict bypasses. This is an administrator setting outside the repository files; do not treat the CI workflow alone as enforcement.
