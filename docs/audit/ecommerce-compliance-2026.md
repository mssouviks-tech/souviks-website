# Souviks — India e-commerce compliance register

**Assessment date:** 2 November 2026  
**Business model assessed:** Souviks directly sells its own/controlled automotive spare-parts inventory through a static e-commerce website to both B2B and B2C customers. It is not currently a marketplace. This description must be re-confirmed if independent third-party sellers are ever onboarded.

## Business facts confirmed by the owner — 3 November 2026

- **GST registration:** The uploaded GST REG-06 certificate records legal name CHANDRANI SADHU, trade name Souviks, constitution Proprietorship, GSTIN 19BZMPS2461K1ZO, Regular registration and principal place of business 6, Souviks, Beside NH-2, Andal, Bardhaman, West Bengal, 713321. Certificate issue date: 07/07/2018; Annexure A records zero additional places. Check for later amendments and verify current active status on the GST Portal before production invoicing.
- **Imported stock:** The owner confirms that Souviks does not currently stock imported products. Treat this as an owner declaration, not yet a documentary SKU-by-SKU verification. Check supplier invoices and actual package labels before closing the imported-goods disclosure gate. Do not infer country of origin from brand nationality.
- **Customer mix:** Souviks sells to both B2B and B2C customers. Product/package applicability must therefore be reviewed against the actual supply, packaging and buyer category; a B2B sale is not automatically exempt from Legal Metrology requirements.
- **Seller model:** Direct inventory seller; no independent third-party marketplace sellers are currently onboarded.

This register is an implementation tracker, not a legal opinion, licence, certificate or declaration that Souviks is fully compliant. It distinguishes website changes that can be made in code from operational registrations, supplier evidence and professional determinations that require the business.

## 1. Main legal framework

| Framework | Relevance to Souviks | Current assessment |
|---|---|---|
| Consumer Protection Act, 2019 and Consumer Protection (E-Commerce) Rules, 2020 (as amended) | Applies to goods/services sold digitally, including inventory e-commerce models. Requires seller identity, customer care/grievance details, complaint handling, truthful product information and consumer remedies. | Policy wording and contact disclosures updated; operational and upcoming 2026 duties remain open below. |
| Consumer Protection (E-Commerce) (Amendment) Rules, 2026, G.S.R. 789(E) | Comes into force on **1 January 2027**. Adds complaint-copy, importer/origin, NCH convergence, search integrity, sponsored-listing, prior-price, invoice seller-name and annual dark-pattern-audit requirements. | Pre-effective implementation is not complete. Do not mark compliant until the listed gates close. |
| Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025 | Phased commencement. Rules 3 and 5–16, 22 and 23, and the Act's main data-fiduciary obligations, are scheduled 18 months after Gazette publication (13 May 2027). Rule 4, which concerns registration of Consent Managers, is scheduled after one year (13 November 2026); it is not a general requirement for every e-commerce seller to appoint a Consent Manager. | Privacy notice exists, but collection-point notices, consent/withdrawal workflows, rights handling and incident-response evidence need a separate readiness review before applicable provisions take effect. |
| Legal Metrology Act, 2009 and Legal Metrology (Packaged Commodities) Rules, 2011 | Package declarations apply to pre-packaged commodities within scope. Online declaration duties and exemptions depend on the product, package and legal definition applicable to the seller. | Supplier/label declarations are not available as a verified, complete catalogue data set. Do not infer country of origin or importer from brand names. Obtain legal advice on online-display applicability to this proprietorship. |
| CGST Act and CGST Rules (including Rule 46 where a registered taxable supplier issues a tax invoice) | Requires a compliant tax invoice where Souviks is registered and the transaction requires one. | GST REG-06 certificate supplied: legal name, trade name, GSTIN and principal address recorded. Current status/later amendments, HSN/tax mapping and production invoice generation still require verification. |
| Rights of Persons with Disabilities Act and accessibility guidance | Accessibility should be designed and tested; WCAG 2.2 AA is used here as a target for evaluation, not represented as a universal certificate requirement for this private site. | A50 manual and automated accessibility testing remains open. |

## 2. Consumer e-commerce requirements

### Seller identity and contact details

- [x] Terms and Privacy pages identify **Chandrani Sadhu, proprietor trading as Souviks**; the trade name, business address, website, customer-care email and telephone/WhatsApp details are stated.
- [ ] Confirm that the legal seller identity and contact details are readily visible from all major shopping and checkout journeys, not only after opening the policy pages.
- [ ] Confirm the published address is the current principal business address and identify any other operating branches, if any.
- [x] Souviks is described as a direct inventory seller, not a marketplace. Reassess if independent sellers are ever onboarded.

A proprietorship does not have to convert to a company merely to operate an e-commerce website. The Companies Act nodal-officer provision in Rule 4(1)(a) is conditional where the e-commerce entity is a company; do not treat it as a general incorporation requirement.

### Grievances

- [x] Grievance Officer, role, email, phone and postal address are published in Terms and Refund pages.
- [x] Policy now states acknowledgment within 48 hours and redressal within one month; the policy also promises a copy of the complaint as recorded by the Grievance Officer.
- [ ] Configure and evidence an actual intake register/ticket process that time-stamps receipt, records the complaint, sends the complainant a copy, assigns an owner and tracks the one-month deadline. **Design prepared:** `docs/audit/grievance-operations-design.md`; production schema, intake endpoint, private attachments and staff dashboard are not yet deployed.
- [ ] Test a real consumer complaint path end-to-end and retain evidence of the acknowledgment, complaint copy and closure.

### National Consumer Helpline (NCH)

- [ ] Register/participate in the National Consumer Helpline convergence process before 1 January 2027, as required by the 2026 amendment. This is a business/portal action; it cannot be completed by editing the website. **Readiness checklist prepared:** `docs/audit/nch-convergence-readiness.md`; portal submission and signed official letters are still outstanding.
- [ ] Confirm the registered legal name, service-head and SPOC details; download and sign the two current NCH templates; submit and retain acceptance evidence.
- [ ] Publish any NCH identifier/contact pathway once registration is accepted and the Department provides the required details.

### Product and imported-goods disclosures

- [x] Create `docs/audit/product-declaration-worklist.csv` from all 1,159 catalogue records (1,157 active; 2 inactive), with SKU identity and taxonomy prefilled and unverified declarations left blank.
- [ ] Reconcile the owner's confirmation that no imported products are currently stocked against supplier invoices and package labels across the active catalogue. If any imported SKU is identified, collect the **actual importer name/details** and the full **country of origin** from supplier invoices, packaging or manufacturer records before it is offered online.
- [ ] For pre-packaged commodities within Legal Metrology scope, collect and verify the declarations on the actual retail package (including manufacturer/packer/importer details, generic commodity name, net quantity, MRP inclusive of taxes and other declarations applicable to that package).
- [ ] Determine package exemptions and online-display obligations SKU-by-SKU with Indian legal counsel. Do not assume every automotive part is a pre-packaged retail commodity; industrial/institutional sales and package-size exemptions may affect the analysis.
- [ ] Add approved declarations to the structured product source and render only verified values on the relevant product pages. Never derive origin from a brand's country, brand name or a part-number prefix.

### Search, sponsored listings and price reductions

**Price-history implementation added to PR #172 (3 November 2026):**

- [x] Add a capture script that records the live catalogue only after its SHA-256 matches the checked-out main catalogue and the production deployment wait check passes.
- [x] Add a GitHub Actions workflow to capture prices after each successful static-catalogue build and once daily at 00:31 Asia/Kolkata.
- [x] Store timestamped snapshots with the source commit, source URL, catalogue SHA-256, SKU, part number, active status, selling price and MRP.
- [x] Add tests for incomplete windows, observation gaps, inactive/missing products and prior-price comparisons.
- [x] Derive the lowest observed selling price only when the preceding 30-day window is fully observed (maximum 26-hour observation gap) and the product is active and priced in every observation. Otherwise, withhold the comparison.
- [ ] Merge and enable the capture workflow on main; verify the first production snapshot and its matching catalogue hash.
- [ ] Accumulate 30 complete days of production observations before publishing any prior-price comparison. With an initial capture on 3 November 2026, the earliest possible eligibility is approximately 3–4 December 2026, subject to uninterrupted coverage and the first successful live capture.
- [ ] Reconcile a sample of captured prices against the live storefront and source catalogue before treating the automated history as compliance evidence.

The automation records only public price and product data. MRP is retained as descriptive catalogue information but is never used to calculate the 30-day prior price. The 26-hour maximum observation gap is a conservative control; any missing period or product availability gap causes the prior-price field to be cleared rather than estimated.

- [ ] Review search and catalogue ordering to ensure results are not manipulated in a way that misleads users or undermines relevance to their query.
- [ ] If a paid or sponsored placement is introduced, label it clearly and prominently at the placement itself. Do not represent an ordinary ranking as sponsored or vice versa.
- [ ] This PR removes percentage-off labels derived only from MRP and selling price from generated and hydrated catalogue/product views, and removes the strikethrough styling that made MRP look like a historical transaction price. It also carries an optional `prior_price_30d` field into the product projection and renders the 30-day prior price only when that verified value exceeds the current selling price. **MRP is not automatically the “prior price”** under the 2026 amendment. The remaining implementation is to maintain auditable daily price history, populate `prior_price_30d` from the lowest price offered in the preceding 30 days, and test the evidence trail before making any price-reduction announcement.
- [ ] Do not backfill the 30-day prior price from MRP, old catalogue price, a supplier list or a manually chosen anchor unless it is demonstrably the lowest offered price during the required 30-day period.

### Invoices and dark-pattern controls

- [ ] Confirm invoice output clearly displays **Chandrani Sadhu, proprietor trading as Souviks** as seller, with seller name at least the same font size as the e-commerce entity name, as required by the 2026 amendment.
- [ ] Complete a documented review against the CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023 across product discovery, cart, checkout, payment, account and returns. **Audit tools prepared:** `docs/audit/dark-pattern-self-audit-readme.md` and `docs/audit/templates/dark-pattern-self-audit.csv` (13 patterns; all start as `NOT_ASSESSED`; no result or certificate is pre-filled).
- [ ] Conduct the required yearly self-audit and publish a certificate prominently only after the audit is genuinely completed, findings are fixed or disclosed as permitted, and the certificate is approved by the responsible business owner. Do not publish a placeholder or an unverified “compliant” badge.

## 3. Personal-data readiness (DPDP)

- [x] Current Privacy Policy describes categories of data, purposes, major service providers, analytics/attribution, retention concepts, security and contact channels.
- [ ] Before the relevant DPDP provisions take effect, provide a clear, standalone notice at each personal-data collection point, with itemised personal-data categories and specific purposes. **Implementation design prepared:** `docs/audit/dpdp-readiness-design.md`; current consent/withdrawal and rights workflows are not yet implemented.
- [ ] Separate necessary account/order processing from optional analytics or marketing choices where consent is the lawful basis; do not treat a generic Terms checkbox as blanket consent for all processing.
- [ ] Provide a withdrawal path that is as easy to use as the consent path; verify that withdrawal stops the relevant optional processing.
- [ ] Provide an accessible process for data access, correction, erasure where lawful, grievance handling and escalation/Board complaint, with identity verification and response tracking.
- [ ] Document retention periods by data type, deletion jobs, access controls, processor agreements, breach escalation and the record of processing systems.
- [ ] Recheck the Gazette commencement schedule before implementation sign-off. Rule 4 concerns Consent Manager registration and is scheduled for 13 November 2026; the main Rule 3 / Rules 5–16 group and corresponding Act data-fiduciary duties are scheduled for 13 May 2027.

## 4. Tax and invoices

- [x] Owner confirms that Souviks is GST-registered.
- [x] Transcribe the GSTIN, legal name, trade name, constitution and principal place of business from the uploaded GST REG-06 certificate.
- [ ] Check the GST Portal for current active status and confirm no later certificate amendment. The uploaded certificate was issued 07/07/2018 and records zero additional places of business.
- [ ] Have the accountant check the product-wise HSN/tax rates, price-inclusive-GST calculation, freight tax treatment, place-of-supply split, credit notes and invoice particulars. **Implementation checklist prepared:** `docs/audit/gst-invoice-readiness.md`.
- [x] Prepare a one-page fillable A4 GST invoice layout using the supplied Souviks letterhead and sale-invoice image as references. The PDF is a visual/form prototype only; it does not calculate tax or issue invoices.
- [x] Align the invoice header to the GST certificate: CHANDRANI SADHU (legal name), Souviks (trade name), GSTIN 19BZMPS2461K1ZO, State Code 19 and principal place of business 6, Souviks, Beside NH-2, Andal, Bardhaman, West Bengal, 713321.
- [ ] Verify current GST status and check for later amendments on the GST Portal. The CN-119(2) address on the sample letterhead differs from the address in GST REG-06; do not represent it as an additional place without amended registration evidence.
- [ ] Verify the bank account and IFSC independently before production use.
- [ ] Implement server-generated B2B and B2C invoice/credit-note output after accountant sign-off; GST invoice generation is not part of the current first-phase Cashfree implementation.
- [ ] Where a GST tax invoice is required, verify the invoice contains all applicable Rule 46 particulars, such as supplier name/address/GSTIN, consecutive invoice number/date, recipient details where required, HSN/description, quantity/unit, taxable value, tax rates and tax amounts.
- [x] Terms state that online catalogue prices include applicable GST and that freight is separate. Confirm that live checkout and invoices calculate/describe tax consistently.

## 5. Consumer-facing policy and checkout controls

- [x] Terms, Privacy, Refund and Shipping & Delivery pages rewritten in English, Hindi and Bengali, with consistent routes and links.
- [x] No-free-shipping rule, store pickup, 5–10 working-day estimate, freight basis, payment-provider boundary and post-dispatch standard cancellation wording disclosed.
- [x] Statutory consumer rights are expressly preserved; one-hour and seven-day reporting windows are not stated as an absolute bar to statutory remedies.
- [x] Checkout requires an affirmative customer action: the terms checkbox is `required` and has no pre-selected `checked` attribute in the checkout-page generator. This is purchase/terms acceptance only, not a substitute for separate optional-data consent under DPDP.
- [ ] Confirm no unilateral cancellation fee is charged or introduced unless the applicable rule's equivalent-cost condition is satisfied.
- [ ] Confirm there are no unilateral cancellation fees or hidden/bundled shipping charges; the full total must be available before payment.
- [ ] Confirm customer-facing invoice, order confirmation and refund workflows match the policy in production.

## 6. Sign-off gates before declaring compliance

1. Legal counsel: applicability of Legal Metrology e-commerce display rules to this proprietorship and product mix; review all policy wording and upcoming amendment implementation.
2. Business owner: verify principal/branch details, complaint handling capability, actual return windows, lubricant and electrical-product handling, imported SKU list and NCH registration.
3. Accountant: GST registration, HSN/tax treatment, invoice and credit-note requirements.
4. Developer: 30-day price-history controls, origin/importer structured fields, invoice seller-name visibility, privacy notice/consent workflows, search/sponsored disclosure and audit evidence.
5. Independent/manual reviewer: annual dark-pattern review and WCAG accessibility checks.

## 7. Primary legal references

- Consumer Protection (E-Commerce) Rules, 2020 and amendments: https://consumeraffairs.gov.in/
- Consumer Protection (E-Commerce) (Amendment) Rules, 2026, G.S.R. 789(E), Gazette ID CG-DL-E-10092026-276125: https://egazette.gov.in/WriteReadData/2026/276125.pdf
- Department of Consumer Affairs summary and 1 January 2027 commencement: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759&lang=1&reg=48
- Digital Personal Data Protection Act commencement notification: https://egazette.gov.in/WriteReadData/2025/267647.pdf
- Digital Personal Data Protection Rules, 2025: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
- Legal Metrology (Packaged Commodities) Rules, 2011: https://thc.nic.in/Central%20Governmental%20Rules/Legal%20Metrology%20%28Packaged%20Commodities%29%20Rules%2C%202011.pdf
- CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023: https://consumeraffairs.gov.in/

**Current conclusion:** Souviks has an improved policy disclosure baseline and has added a price-history capture foundation plus NCH, GST and SKU-declaration readiness documents/worklists to PR #172. The price-history workflow is not active until merge and a first successful production capture; a full 30-day evidence window is not yet available. NCH onboarding, SKU-level supplier/package evidence, GSTIN and invoice verification, actual invoice generation, grievance operations, dark-pattern self-audit/certificate, DPDP readiness and professional review remain open. Souviks must not yet advertise itself as “fully legally compliant”.
