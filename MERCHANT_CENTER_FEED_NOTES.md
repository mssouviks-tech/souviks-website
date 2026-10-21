# Souviks Google Merchant Center feed draft

Source: `assets/data/products.json` from the website catalogue on `main` at the time of export (21 October 2026).

## Files
- `merchant-center-feed-draft.csv`: 1,039 priced products, with required Google feed columns plus India's `maximum_retail_price` and optional `product_type`.
- `merchant-center-review-needed.csv`: all 1,122 active catalogue records and item-level review notes.

## Do not upload this draft as-is
1. `availability` is intentionally blank because the source catalogue does not contain live stock status. Fill it with an accurate Google value (`in_stock`, `out_of_stock`, `preorder`, or `backorder`) only after verifying the website's actual availability.
2. 83 records have no selling price and are not included in the feed CSV. Review the second file.
3. The source has no dedicated GTIN property. GTINs are left blank; OEM/reference numbers are not assumed to be GTINs.
4. Products without a part number/MPN are flagged for manufacturer identifier review. Do not invent an MPN or set `identifier_exists=no` unless you confirm no manufacturer-assigned identifier exists.
5. 101 canonical URLs were missing in the source and are constructed from the catalogue slug. Validate these before use.
6. The feed truncates descriptions to 200 characters and titles to 150 characters, preserves displayed selling price as `price`, and uses MRP as India's `maximum_retail_price` where available.
7. For India, configure shipping costs in Merchant Center account shipping settings (or supply a valid `shipping` attribute) before listings can be eligible.

## Website eligibility risk
As checked during export, a sample product page says availability is subject to confirmation and presents a Request Quote flow rather than standard online checkout. Google requires accurate landing-page availability and expects customers to be able to complete purchases online for standard Shopping listings. Resolve this eligibility concern before relying on the feed for Shopping listings.

No production files were changed by this draft export. This branch is separate from `main`.
