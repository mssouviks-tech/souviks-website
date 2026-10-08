# Souviks SEO Content Strategy

Updated: 2026-10-08

## 1. Search-intent to landing-page map

| Buyer intent | Primary landing page | Required content | Indexing policy |
|---|---|---|---|
| Exact OEM / part number | Product PDP | Part number, OEM references, brand, application, compatible vehicles, current commercial data | Index |
| Partial part number / product name | Product catalogue + relevant PDPs | Search-friendly product naming and descriptive metadata | Catalogue indexable; search-result states are not separate pages |
| Brand + spare parts | Brand page | Brand description, product groups, applications, representative products | Index |
| Category + spare parts | Category page | Category explanation, subcategories, use cases, representative products | Index |
| Vehicle + spare parts | Vehicle page | Vehicle description, mapped products, relevant categories and applications | Index |
| Vehicle + category | Dedicated application page only when demand is proven | Useful buyer-focused explanation, not a database filter wrapper | Create selectively |
| Brand + category | Brand/category landing only when materially useful | Buyer intent explanation + representative products | Create selectively |

## 2. Internal-link graph

The preferred crawl path is:

`Vehicle -> Category -> Brand -> Product`

Reverse discovery paths should also exist where the relationship is real:

`Product -> Vehicle`
`Product -> Category`
`Product -> Brand`
`Product -> Related Product`

Product pages already have category/brand breadcrumbs and product-to-product recommendation sections. The product-to-vehicle link is now added in the shared PDP renderer.

## 3. Product content standard

A product page should expose, when known:

- Product name
- Exact part number
- Manufacturer / alternate / OEM references
- Brand
- Category and subcategory
- Applications
- Compatible vehicles
- A genuinely useful description
- Current MRP / selling price where commercially valid
- Request/availability action

Do not invent dimensions, certifications, OEM equivalence, vehicle compatibility, stock status, warranty claims, or technical specifications.

## 4. Thin-content rule

Descriptions shorter than 50 characters are treated as thin source content. The static builder now supplements these descriptions using only existing catalogue facts such as brand, product name, part number, category/subcategory, applications and compatible vehicles.

This is a fallback, not a replacement for supplier/manufacturer-quality descriptions. High-value products should eventually receive manually reviewed descriptions.

## 5. High-value content opportunities

Prioritize content upgrades in this order:

1. Products with identifiable OEM/MPN search demand and weak descriptions.
2. Products mapped to multiple high-value commercial vehicle applications.
3. Vehicle/category combinations with meaningful catalogue depth.
4. Brand/category combinations with multiple active products.
5. High-impression pages with low CTR or poor average position after Search Console data is connected.

Do not create large numbers of near-identical landing pages from every possible filter combination. A landing page should exist only when it provides unique buyer value.

## 6. Buying guides and glossary

Create buying guides only for recurring customer questions around major Souviks categories such as clutch components, brake components, filters, bearings and lubricants.

Prioritize topics using Search Console query data, internal-search data and keyword research rather than intuition alone.

Glossary pages should explain terminology that is demonstrably used by customers, manufacturers or searchers. Each glossary entry should link to relevant categories and products.

## 7. Measurement

Track:

- Google organic impressions, clicks, CTR and average position by URL
- Product / brand / category / vehicle landing-page performance
- Internal search queries and zero-result searches
- RFQ clicks and completed RFQs
- Request-a-Part clicks and submissions
- WhatsApp CTA clicks

Search Console account data is required before ranking/content priorities can be considered evidence-based.
