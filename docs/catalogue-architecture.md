# Souviks Catalogue Build Architecture

## Source of truth

`assets/data/catalogue-index.json` is the canonical product catalogue used by the website runtime.

Each active catalogue record is keyed by a stable `id` and a unique public `slug`.

## Generated projections

The catalogue master is projected into:

- `assets/data/products.json` — machine-readable product projection.
- `assets/data/search.json` — product search projection.
- `en/products/*.html` — English static product pages.
- `bn/products/*.html` — Bengali static product pages.
- `hi/products/*.html` — Hindi static product pages.
- `sitemaps/products.xml` — product URL projection.
- Static product-card and SEO/schema markup embedded in generated HTML.

Derived files must not become independent sources of catalogue truth.

## Build command

From any working directory:

```bash
python3 scripts/catalogue/build.py
```

The builder resolves the repository root from its own file location, so it does not depend on the caller's current directory.

The builder is deterministic and has no Git side effects. It only reconciles generated files. Validation runs at the end of the build.

## CI model

`.github/workflows/build-static-catalogue.yml` is a thin CI wrapper around the build script.

Its responsibilities are limited to:

1. Checking out `main`.
2. Running `scripts/catalogue/build.py`.
3. Committing generated changes.
4. Pushing the generated commit.

The workflow is path-scoped, serialized with a concurrency group, and ignores commits authored by `github-actions[bot]` to prevent recursive rebuilds.

`.github/workflows/validate-static-catalogue.yml` is validation-only. It runs after the build workflow completes successfully and performs the repository/page/SEO/sitemap integrity checks without modifying the repository.

## Temporary workbook overrides

An exact workbook-to-catalogue reconciliation may use:

`assets/data/catalogue_overrides.json`

The build consumes the override as input and removes it after applying the changes.

## Validation contract

`scripts/catalogue/validate.py` is the architecture guard. It verifies:

1. Master IDs and slugs are unique.
2. Active master records exist in the product and search projections.
3. Projection slugs match the master slugs.
4. Duplicate dynamic product-routing files are absent.
5. Every active product has exactly one static page per language.
6. Embedded product-page identity matches the page filename and catalogue.
7. The product sitemap matches the active product URL set.

Image completeness, visual quality, CSS, JavaScript behavior, structured-data quality, and SEO content remain separate audit pointers.

## Important boundary

The static HTML files are generated artifacts. Manual edits to an individual product page are not durable unless the corresponding source/projection is updated or the build script produces the change.
