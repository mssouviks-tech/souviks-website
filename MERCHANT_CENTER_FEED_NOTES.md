# Souviks Google Merchant Center feed draft

Source: `assets/data/products.json` from the website catalogue on `main`, checked 21 October 2026.

## Files
- `merchant-center-feed-draft.csv`: 1039 active catalogue products with a positive selling price. Availability is set to `in_stock` based on the merchant's confirmation that every product listed on the website is in stock.
- `merchant-center-review-needed.csv`: all 1122 active catalogue records and item-level review notes.

## Before uploading
1. Online checkout must be implemented and tested: visitors must be able to add in-stock items to a cart and complete an order. A request-for-quote-only flow will not meet standard Merchant Center checkout expectations.
2. Product prices are drawn from the catalogue's `selling_price` field; MRP is exported separately as `maximum_retail_price` where known.
3. 83 records have no valid selling price and are excluded from the feed. Review them in the second file.
4. The source catalogue has no dedicated GTIN property. GTIN is left blank; OEM/reference numbers are not assumed to be GTINs.
5. The feed only fills `mpn` from the explicitly named `manufacturer_part_number` field. For other items, confirm whether the stored `part_number` is the actual manufacturer-assigned MPN or whether the item has no manufacturer identifier; review before final upload.
6. `availability` is `in_stock` for all feed rows per the merchant's confirmation. Website product page/cart/checkout must show a matching in-stock status.
7. Titles and descriptions are capped at 150 and 200 characters respectively. Image URLs and product URLs were mapped from the catalogue but still need an automated HTTP/visual validation pass.
8. Delhivery's official B2C developer portal lists both Pincode Serviceability and Calculate Shipping Cost APIs. A safe integration should call Delhivery from a Cloudflare Pages Function/server-side endpoint; do not expose the API token in browser JavaScript. API results are estimates and depend on destination PIN and shipment details such as chargeable weight and parcel dimensions.
9. Product/package weights and dimensions are not present in the product fields inspected, so shipping estimates need reliable product/package data or documented packing presets.
10. Merchant Center shipping settings must agree with the shipping rates displayed and charged in the online checkout.

## Eligibility risk
A sample currently deployed product page uses a Request Quote flow. That flow must be replaced or complemented by a real cart and completed-checkout journey before the feed is relied upon for standard Shopping listings.

This is a draft branch only. It has not been merged into `main`, deployed, or uploaded to Merchant Center.
