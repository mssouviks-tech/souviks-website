# Souviks DPDP readiness — implementation design

**Status:** Design and gap assessment; consent/rights workflows are not yet implemented.  
**Business context:** Direct online seller handling B2B and B2C contacts, accounts, RFQs, orders, payments, delivery and support.

## Commencement schedule

The official commencement notification for the Digital Personal Data Protection Act, 2023 is G.S.R. 843(E), 13 November 2025. The DPDP Rules, 2025 are G.S.R. 846(E), also dated 13 November 2025.

- The Rules currently scheduled for the 18-month stage—including Rule 3 notice requirements and Rules 5–16—take effect 13 May 2027, calculated from the Gazette publication date.
- Rule 4 (registration and obligations of Consent Managers) takes effect after one year, 13 November 2026. This is not a general direction that every e-commerce seller must register or appoint a Consent Manager. Souviks should not register as one unless it actually operates as a Consent Manager and satisfies the applicable role requirements.
- Recheck the Gazette and any corrigenda before implementation sign-off.

Official notifications:
- Act commencement: https://egazette.gov.in/WriteReadData/2025/267647.pdf
- DPDP Rules: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf

## Existing data processing identified in the current privacy notice

The current policy describes:
- contact and account details, including name, phone, email, company and GSTIN where supplied;
- vehicle/part enquiries, RFQs, orders, invoices, delivery and returns;
- Supabase authentication and profile services;
- Google Sign-In;
- Google Analytics 4;
- first-party attribution and contact-intent clicks, including a pseudonymous browser identifier designed to expire after 90 days;
- Cashfree payment status/references;
- Delhivery and other carrier delivery details;
- Cloudflare, email relay and operational support providers.

This list needs verification against current production network requests, database tables, Edge Functions, service-provider contracts and actual retention settings. A privacy policy statement is not proof of actual processing controls.

## Required implementation plan

### 1. Build a data inventory and purpose register
For each collection point and field, record: data category, specific purpose, whether required or optional, source, recipient/processor, retention period, access role, lawful basis to be confirmed by counsel, deletion/retention exception and system of record.

Include signup, Google Sign-In, profile, RFQ, contact, checkout, Cashfree, shipping, analytics/attribution, customer support and grievance workflows.

### 2. Add collection-point notices
Before the relevant Rule 3 commencement, provide a standalone, clear notice at each personal-data collection point. The notice should:
- identify the specific data collected;
- explain each specific purpose;
- identify how the individual can withdraw consent where consent is the basis;
- explain how to exercise rights and raise a grievance; and
- link to the complete notice.

Avoid relying on a single generic Terms checkbox for every purpose.

### 3. Separate optional purposes
Necessary account, enquiry, order, payment, tax and delivery processing must be distinguished from optional analytics, attribution and marketing. Do not condition an ordinary product purchase on acceptance of unrelated marketing or optional analytics.

Record consent purpose, notice version, choice, timestamp and collection context. The exact lawful basis and whether a specific processing activity requires consent must be confirmed by Indian privacy counsel.

### 4. Implement withdrawal
A user must be able to withdraw optional consent using a path no harder than the path used to provide it. Withdrawal should:
- record the withdrawal event and timestamp;
- stop the relevant optional processing and future event collection;
- clear or disable relevant optional browser storage/cookies where technically possible;
- propagate the change to processors where required; and
- explain any data that must be retained under another legal obligation.

### 5. Implement rights and privacy grievance handling
Provide a monitored contact route and restricted case register for access, correction, erasure where lawful, consent withdrawal, grievance and escalation requests. Verify identity proportionately, track deadlines, record the response and explain lawful retention exceptions.

### 6. Define retention and deletion
Create a record-class retention schedule (accounts, RFQs, orders, tax invoices, delivery, logs, analytics, marketing, grievance and security). Implement scheduled deletion/anonymisation for records whose purpose has ended and no legal retention basis remains. Preserve legal holds and required statutory records.

### 7. Secure processors and operations
Document provider roles, data locations, access controls, data-sharing purposes, incident escalation, security safeguards, breach-response ownership, backup retention and processor arrangements. Keep service keys server-side; apply least privilege and access logging to personal-data tables.

## Required tests

- Required order processing works when optional analytics/marketing consent is declined.
- Consent is not preselected.
- Consent notice version and timestamp are retained.
- Withdrawal stops future optional events and clears relevant state.
- User rights request can be logged, identity-checked, assigned, answered and closed.
- Deletion does not erase records that must be retained for tax/legal purposes.
- Unauthenticated users cannot access another person's profile, order or grievance.
- Application logs and analytics do not accidentally collect payment credentials or complaint text.

## Release gate

Do not mark DPDP readiness complete until the inventory is reconciled to the live system, notices are reviewed by qualified Indian counsel, consent and withdrawal tests pass, rights requests are operational, retention jobs are verified, processors are documented and breach handling is tested.
