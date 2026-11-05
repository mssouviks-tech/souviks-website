# Product-level HSN mapping

**Reference tariff date:** 1 October 2026  
**Scope:** All 1,159 records in `assets/data/catalogue-index.json`, including inactive records. This covers 1,157 active products.

## Data fields added

Each catalogue record now carries:

- `hsn_code`: eight-digit Indian tariff-item candidate, stored as a string.
- `hsn_description`: corresponding tariff-item description.
- `hsn_confidence`: `high`, `medium` or `low`.
- `hsn_classification_status`: `classified`, `provisional` or `review_required`.
- `hsn_basis`: product-specific reason for the candidate.
- `hsn_review_note`: missing specification/material/fitment that must be checked.
- `hsn_reference_date`: tariff schedule reference date (`2026-10-01`).

The public product projection in `assets/data/products.json` is also updated by `scripts/catalogue/build.py` to preserve these fields.

## Classification approach

The mapping uses the product name, part number, product description, application and subcategory together. The specific article and its material/function take precedence over the website's browse category.

Examples of the treatment:

- Complete engine oil/fuel filters are considered under 84212300; intake-air filters under 84213100; replacement filter parts under 84219900.
- Tapered roller and radial ball bearings are classified within heading 8482. Where a bearing number suggests a standard bore, the matching bore band is a candidate only until the bearing specification is confirmed.
- Plain shaft bearings/bushes, metal fasteners, rubber seals/bushes and electrical apparatus are considered under their respective material/product headings rather than defaulting to Chapter 87.
- Dedicated vehicle brake, gearbox, axle, suspension, clutch and steering components are classified under the corresponding motor-vehicle-parts subheadings only where the product itself supports that classification.
- Lubricants, coolants, brake fluid and DEF are treated as chemical/mineral-oil products. Formulation, petroleum-oil percentage and BIS conformity can change the exact tariff item.
- For belts, the circumference, profile and rubber-compound percentage can determine the tariff item. For gaskets, material and layer construction matter. For brake friction material, mounted vs unmounted form and asbestos status matter.

Section XVII Note 2 to the Customs Tariff Act excludes specified goods from the expressions “parts” and “parts and accessories”, including joints/washers and other vulcanised-rubber articles (heading 4016), base-metal parts of general use, bearings (8482), valves (8481), and machinery/electrical goods covered by other sections. This is why the mapping does not place all vehicle products under a residual 8708 code.

## Status definitions

- **classified / high:** The catalogue identifies a specific product type and the candidate tariff description aligns directly with it.
- **provisional / medium:** The product type is reasonably clear, but a material, rating, composition or construction detail should be confirmed.
- **review_required / low:** The code is a product-specific candidate, but available catalogue data does not establish a necessary classification fact. The `hsn_review_note` identifies what must be checked.

Current mapping summary:

| Status | Records |
| --- | ---: |
| classified | 72 |
| provisional | 632 |
| review_required | 455 |
| **Total** | **1,159** |

The residual candidate 87089900 is limited to 13 records (including engine-mounting assemblies and accelerator-control cables) and is flagged for review; it is not used as a blanket code for the catalogue.

## Important limitations

This is a working product-level classification, not a binding advance ruling or a substitute for a customs/GST classification opinion. Records marked `review_required` must not be treated as final for invoicing until the physical item, material, composition, size or kit contents have been verified. Provisional records should also be checked against supplier/OEM technical sheets, drawings, packaging and purchase invoices.

This change only adds HSN tariff-item candidates and review metadata. It does **not** set GST rates, cess, tax treatment, place-of-supply rules or invoice tax calculations. GST rate determination is a separate exercise.

## References

1. [Customs Tariff Act, 1975 — First Schedule, Section XVII notes](https://indiacode.ecourtsindia.com/customs-tariff-act-1975/schedule/1/?p=27)
2. [Customs Tariff — Chapter 87: vehicles and parts](https://indiacode.ecourtsindia.com/customs-tariff/chapter/87/)
3. [Customs Tariff — Chapter 40: rubber articles and transmission belts](https://indiacode.ecourtsindia.com/customs-tariff/chapter/40/)
4. [Customs Tariff — Chapter 84: machinery, filters, pumps, valves and bearings](https://indiacode.ecourtsindia.com/customs-tariff/chapter/84/)
5. [Customs Tariff — Chapter 85: electrical machinery and apparatus](https://indiacode.ecourtsindia.com/customs-tariff/chapter/85/)
6. [ICEGATE — Trade Guide on Imports](https://www.icegate.gov.in/Webappl/Trade-Guide-on-Imports)

The tariff reference pages above reproduce the First Schedule as read on 1 October 2026. Confirm the current legal tariff item and applicable GST rate before using a review-required candidate on a tax invoice.
