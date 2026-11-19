# Readable JavaScript sources

The files in this directory are the editable source-of-truth for the Phase 1 browser modules.

| Readable source | Generated runtime |
|---|---|
| `source/account/rfq.js` | `account/rfq.js` |
| `source/cart/cart.js` | `cart/cart.js` |
| `source/bundles/index.js` | `bundles/index.js` |
| `source/supabase-loader.js` | `supabase-loader.js` |

Run `npm run build:js` after editing these sources. The generated runtime files retain their existing public URLs and content-hash cache-busting; the readable sources are not overwritten. The catalogue refactor regenerates `source/bundles/index.js` from the existing page-bundle transformation before the minification step.

Only generated runtime paths may be referenced by page HTML. Files under `assets/js/source/` are build inputs and must never be loaded directly by a browser page.
