# A45–A50 audit evidence and closure gates

This checklist separates deterministic repository checks from evidence that must come from business operations or a real browser/session. The automated contract is run by `.github/workflows/a45-a50-contract.yml`.

## A45 — Price labels and pricing claims

- [x] Validate that selling price does not exceed MRP where both values exist.
- [x] Validate stored discount percentages against the MRP/selling-price arithmetic.
- [x] Keep catalogue product/brand counts tied to the JSON projections and brand IDs, rather than distinct display-name spellings.
- [ ] Reconcile the complete active catalogue against current manufacturer/distributor price lists. The currently available workbook evidence covers only a curated 20-part Texspin set; it is not a complete price source for all products.
- [ ] Confirm all records without a fixed price show the intended current-price/quotation label in every generated product view.

## A46 — Shipping, cancellation, return and refund wording

- [x] Policy pages retain the 1 September 2026 effective date in English, Hindi and Bengali.
- [x] Published Terms contain the ₹45,000 free-shipping threshold, the estimated 5–10 working-day delivery window, and the no-cancellation-after-dispatch rule.
- [ ] Business owner to confirm whether the free-shipping threshold is strictly above ₹45,000 or inclusive of exactly ₹45,000.
- [ ] Confirm the one-hour delivery-damage report window, general seven-day return/exchange request window, lubricant exclusion and inspection/approval process against actual operations.
- [ ] Have the policy reviewed by an appropriately qualified Indian legal professional. Automated consistency is not legal advice.

## A48 — Enquiry conversion and delivery

- [x] Contact and Request a Part client code has form validation, honeypot handling, double-submit suppression, status feedback and a success/failure path.
- [x] Success dialogs in those flows trap keyboard focus, support Escape and restore focus to the prior element.
- [ ] Run one explicitly labelled test enquiry for Contact, one for Request a Part and one RFQ submission using a controlled test product.
- [ ] Verify each message arrives in the intended business mailbox/CRM destination and record timestamp, reference ID and recipient-side evidence.
- [ ] Do not mark delivery complete from browser success feedback alone; EmailJS acceptance does not independently prove inbox placement.

## A49 — Trust and stock claims

- [x] Replaced “thousands of related products” with “more than 1,000 product listings” in About copy across English, Hindi and Bengali.
- [x] Reworded “Extensive Inventory / Large stock” to “Broad Catalogue / Catalogue listings” so the copy does not imply every listed product is physically on hand.
- [x] Brand count is based on 61 brand IDs in the brand directory; display-name variants such as “Tata AutoComp” and “Tata Autocomp” must not be counted as separate brands.
- [ ] Reconcile current stock-on-hand against inventory/ERP records before making product-specific stock claims.
- [ ] Keep OEM/genuine status tied to explicit catalogue/manufacturer evidence; shared fitment alone is not proof of OEM identity.

## A50 — Accessibility

- [x] Added visible keyboard focus indicators to catalogue search inputs and search suggestions in the brand and vehicle catalogue bundles.
- [x] Added keyboard focus trapping and Escape handling to Contact and Request a Part success dialogs.
- [ ] Run axe-core or an equivalent WCAG 2.2 AA scan on desktop and mobile across Home, Products, Product detail, Brands, Contact, Request a Part, Request a Quote and account dialogs.
- [ ] Manually verify keyboard order, skip link, focus visibility, modal focus containment/return, error identification, form labels, contrast, zoom/reflow and screen-reader announcements.
- [ ] Record and fix all high/critical findings before marking the accessibility audit complete.

## Evidence rules

Repository checks establish consistency, not real-world truth. A45 source-price reconciliation, A46 operating/legal confirmation, A48 destination delivery, A49 physical stock and A50 assistive-technology behaviour remain open until the corresponding evidence above is attached to the audit record.
