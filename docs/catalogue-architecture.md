# Souviks Catalogue Build Architecture

## Source of truth

`assets/data/catalogue-index.json` is the canonical product catalogue used by the website runtime.

Each active catalogue record is keyed by a stable `id` and a unique public `slug`.

## Derived projections

The catalogue master is projected into:

- `assets/data/products.json` — machine-readable product projection.
- `assets/data/search.json` — product search projection.
- `en/products/*.html` — English static product pages.
- `bn/products/*.html` — Bengali static product pages.
- `hi/products/*.html` — Hindi static product pages.
- `sitemaps/products.xml` — product URL projection.

Derived files must not become independent sources of catalogue truth.

## Build model

The site remains a static deployment. The repository stores generated HTML and JSON so Cloudflare/Netlify can serve the site without server-side product rendering.

Catalogue reconciliation is performed by the GitHub Actions workflow:

`.github/workflows/reconcile-catalogue-projections.yml`

The reconciliation workflow may apply a temporary `assets/data/catalogue_overrides.json` input when an exact workbook-to-catalogue update is required. The override is removed after reconciliation.

## Validation contract

`scripts/catalogue/validate.py` is the architecture guard. It verifies:

1. Master IDs and slugs are unique.
2. Active master records exist in the product and search projections.
3. Projection slugs match the master slugs.
4. Every active product has exactly one static page per language.
5. Embedded product page identity matches the page filename and catalogue.
6. The product sitemap matches the active product URL set.

Image completeness, visual quality, CSS, JavaScript behavior, structured-data quality, and SEO content remain separate audit pointers.

## Important boundary

The static HTML files are generated artifacts. Manual edits to an individual product page are not durable unless the corresponding source/projection is updated or the change is produced by the reconciliation workflow.
