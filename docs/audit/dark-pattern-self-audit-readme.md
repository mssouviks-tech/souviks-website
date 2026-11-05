# Souviks — dark-pattern self-audit procedure

**Status: Not yet audited.** This is a review instrument, not an audit report or certificate.

The CCPA's Guidelines for Prevention and Regulation of Dark Patterns, 2023 identify 13 dark patterns. The CCPA also issued a 5 June 2025 advisory asking e-commerce platforms to self-audit and resolve dark patterns. PR #172's compliance register separately tracks the 2026 E-Commerce Amendment's annual self-audit/certificate requirement. See official references:
- https://ccpa.doca.gov.in/guidelines
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2134765&lang=2&reg=48
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=1983994&lang=2&reg=3

## Audit scope

Review the actual live production user journeys on desktop and mobile, in English, Hindi and Bengali where applicable:

1. Search results and product listing, including sort, filter, badges and sponsored placement.
2. Product details, price/availability, fitment, quantity and add-to-cart/RFQ controls.
3. Cart, freight estimate, pickup/delivery choice, taxes and checkout total.
4. Cashfree payment review, return redirect, failure and cancellation.
5. Account registration, sign-in, Google sign-in, profile and any optional analytics/marketing choices.
6. Order confirmation, customer support, cancellation, returns and refunds.

Use a new guest browser session and a signed-in customer account. Test both B2B and B2C flows. Record the route, language, viewport/device, browser, date/time, test steps and evidence URL or screenshot for each finding.

## How to complete the CSV

- Keep the default \`NOT_ASSESSED\` status until a real reviewer performs the test.
- Use \`PRESENT\`, \`NOT_PRESENT\`, \`NOT_APPLICABLE\` or \`REMEDIATED_RETEST_PENDING\` as appropriate.
- Every \`NOT_PRESENT\` conclusion needs evidence from the exact journey and the tested site revision.
- A \`NOT_APPLICABLE\` decision needs a factual explanation and reviewer approval; do not assume a pattern is absent just because it is not obvious.
- For each \`PRESENT\` finding, record severity, customer impact, remediation owner and due date. Retest the exact flow after the fix and attach new evidence.
- Inspect totals at the last step before payment. Hidden compulsory fees or a cart/checkout total mismatch must be treated as a critical finding.
- Sponsored/paid placement must be visibly disclosed at the placement. Ordinary relevance-based product ordering must not be labelled as sponsored.

## Sign-off rule

Do not sign an annual declaration, publish a certificate, add a “dark-pattern compliant” badge or mark this audit complete until:
- all 13 patterns have been assessed across the relevant journeys;
- every detected issue has been remediated and retested or explicitly handled by qualified counsel;
- the auditor's evidence pack and the actual production revision are recorded; and
- the responsible proprietor / authorised business owner signs the final report.

This template intentionally contains no pre-filled passing results.
