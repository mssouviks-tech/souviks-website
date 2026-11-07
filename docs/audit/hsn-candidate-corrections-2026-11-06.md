# HSN candidate corrections and evidence audit — 6 November 2026

## Result

This audit compared product identity, part-number references, descriptions and technical sources against existing candidate tariff headings. Candidate corrections update the **candidate heading** only; status is promoted only where manufacturer evidence explicitly supports the exact part.

- Catalogue records: 1159
- Classified / high-confidence: 84
- Provisional / medium-confidence: 629
- Review required / low-confidence: 446
- Still not invoice-ready: 1075

The non-final SKU queue is `docs/audit/hsn-verification-worklist.csv`. Blank sign-off fields are intentional. No GST rate is prefilled for unresolved SKUs. The manufacturer-backed HSN promotion for SVKS000570 does not itself approve a GST rate.

## Candidate changes made

| SKU | Product / reference | Previous candidate | New candidate | Result and remaining qualifier |
|---|---|---:|---:|---|
| SVKS000250 | Coolant Pipe Socket 12mm Coupler | 38200000 | 39174000 | Review required: candidate is plastic pipe fitting; verify body material. If metal, use appropriate metal-fitting heading. |
| SVKS000359 | Leyparts X4000700 coolant filter | 38200000 | 84212900 | Provisional: Bosch commercial-vehicle filter catalogue maps exact OE reference X4000700 to a coolant filter. Verify complete filter apparatus vs replacement element (84219900). |
| SVKS000373 | Gear Lever Knob | 39235090 | 87084000 | Review required: not a plastic closure; verify dedicated gearbox-control use and material. |
| SVKS000276, SVKS000761 | Leyparts F0987915 Pivot Pin Relay Drop Arm | 85364100 | 87089400 | Review required: mechanical steering pivot, not an electrical relay; verify standalone pin vs linkage assembly. |
| SVKS000412 | PIX AUAVX13-1325 | 84099900 | 40103290 | Review required: plain AVX13 V-belt candidate. Verify non-V-ribbed profile, circumference and rubber-compound threshold; below 25% rubber compound uses 40103210. |
| SVKS000413 | PIX AUXV13-1400 | 84099900 | 40103290 | Same belt verification required; do not treat size marking alone as a material certificate. |
| SVKS000414 | PIX AVX13-1450 LA | 84099900 | 40103290 | Same belt verification required; verify measured circumference and compound. |
| SVKS000286 | Fenner 4PK-986SPV V Belt Mahindra Bolero | 40103290 | 40103190 | Review required: 4PK denotes a multi-rib/Poly-V belt, so 40103290 (non-V-ribbed) is the wrong tariff family. Verify actual outside circumference and rubber-compound content; 986 mm is not automatically the statutory outside-circumference measurement. |
| SVKS000670, SVKS000845, SVKS000846 | LED vehicle lighting products | 85119000 | 85122020 | Review required: product is lighting, not starter/ignition equipment; verify exact lamp type and use. |
| SVKS000832 | Tata Genuine Parts 886782000014 Set Wipers for TATA Ace | 85119000 | 85124000 | Classified / high: complete vehicle wiper set; tariff item 85124000 expressly covers vehicle windscreen wipers. |
| SVKS000852–SVKS000861 | Varroc headlamp assemblies / unit | 85119000 | 85122010 | Classified / high: product names identify motor-vehicle headlamps. Fitment variants remain a separate application check. |
| SVKS000862, SVKS000863 | LED DRL / parking-light products | 85119000 | 85122020 | Review required: vehicle-lighting candidate; confirm exact function/assembly with supplier sheet. |
| SVKS000570 | UnoMinda LSC 24V87 Lift Axle Solenoid | 85119000 | 85365090 | Classified / high: Uno Minda's exact product brochure lists part LSC-24V87 with HSN 85365090 and identifies TATA/LEYLAND 24V compatibility. GST rate remains unassigned pending the exact notified entry. |
| SVKS000978 | Tata 285126700171 Cover Top Assy BS6 | 84099900 | 87084000 | Review required: parts lists place exact part among gearbox top-cover/selector components; verify current OEM drawing. |
| SVKS001133 | Leyparts F1837914 Seating Block-C | 84099900 | 87089900 | Review required: historical trade record for exact part used 87089900; corroborative only. Verify current OEM function and whether a more specific gearbox subheading applies. |

## Findings deliberately not auto-corrected

These remain flagged rather than guessed:
- SVKS000585 Automotive Bulb: lamp technology is missing. Heading 8539 is relevant, but the 8-digit item depends on halogen, LED or other filament technology.
- SVKS001147 Knorr-Bremse B25TM1263332 Solenoid Coil: the supplier parts list identifies it as a coil for a lift-axle control valve. Keep the candidate at 84819090 pending confirmation whether the supplied coil is a valve part or an independent electromagnetic actuator.
- SVKS000976 and SVKS000977 Window Regulator Assemblies: current 85119000 starting-equipment candidate is not supported by the product names; obtain Tata OEM drawings and confirm body mechanism vs separate electric motor scope before choosing a replacement code.
- SVKS000253 and SVKS000576 Fuel/DEF tank caps: material and locking mechanism are not recorded; do not assume a plastic-closure heading.
- Brake linings and pads retain their own review gates: verify whether the supplied friction material is asbestos-free and unmounted (heading 6813 candidate) or mounted/assembled with the brake (heading 8708 candidate).

## Source references

1. Uno Minda manufacturer brochure for exact LSC-24V87 part: https://unomindakart.com//brochure/uno-minda-lsc-24v87-lift-axle-solenoid-for-ashok-leyland-universal-24v (manufacturer-published product HSN 85365090).
2. IndiaCode tariff subheading 401031, defining V-ribbed V-belts of outside circumference >60 cm and <=180 cm: https://indiacode.ecourtsindia.com/customs-tariff/401031/
3. IndiaCode tariff item 40103110, below-25% rubber-compound threshold: https://indiacode.ecourtsindia.com/customs-tariff/40103110/
4. IndiaCode tariff item 40103190, other V-ribbed belts in that circumference band: https://indiacode.ecourtsindia.com/customs-tariff/40103190/
5. PIX belt application cross-reference: https://www.amitautomotive.in/images/pix-belt.pdf (supplier/distributor catalogue; corroborative, not a material-composition certificate).
6. Bosch commercial-vehicle filter catalogue, exact OE reference X4000700: https://www.boschaftermarket.com/xrm/media/images/country_specific/in/services_and_support_1/downloads_10/pdf_5/cv_filter_catalogue.pdf
7. Tata part 285126700171 top-cover family listing: https://oswalstorage1.blob.core.windows.net/univomrimg21/JaipurGreaterPDF/PDF/NitTender/jmc07dcgarrage_Tender_13881.pdf
8. Leyparts part reference F0987915 (Pivot Pin): https://modernmotors.in/leyparts-parts-list/
9. Souviks F0987915 product detail identifying steering relay/drop-arm pivot use: https://www.souviks.co.in/en/products/f0987915-pivot-pin-relay-drop-arm
10. Historical export record for Leyparts F1837914 using 87089900: https://www.seair.co.in/ashok-leyland-spare-parts-export-data/country-south-africa/indian-port-banglore-air-cargo/april.aspx
11. Tata Genuine Parts 886782000014 wiper set listing: https://www.souviks.co.in/en/vehicles/tata-ace
12. Souviks Engine Components product catalogue showing Fenner part 4PK-986SPV: https://www.souviks.co.in/en/categories/engine-components

## Control

No review-required or provisional item is exposed as a confirmed HSN on the product page or made invoice-ready by this change. Promotion requires a named reviewer, date, supplier/OEM evidence reference and approved final tariff-item code.
