# Souviks consumer-grievance operations design

**Status:** Design specification only; no production complaint database or intake workflow has been deployed.  
**Business context:** Direct seller; B2B and B2C customers.  
**Policy commitments currently published:** acknowledge within 48 hours, provide the complainant a copy of the complaint as recorded by the Grievance Officer, and redress within one month.

## Why a separate system is required

Do not store complaint contents or complaint attachments in:
- the public GitHub repository;
- the existing sales-lead/RFQ tables, which serve lead conversion and sales reporting;
- a public Google Sheet or CSV; or
- an unrestricted customer-facing Supabase table.

Complaint records contain direct identifiers and potentially sensitive order, payment, vehicle, personal and dispute information. The system must be restricted to specifically authorised grievance/customer-care staff, with access logging and a retention schedule.

## Proposed record lifecycle

1. **Receipt:** accept a complaint through a clearly labelled grievance/contact route or a documented offline channel. Generate a unique reference and preserve the complete text and attachments as actually received.
2. **Time-stamp:** store the original receipt time in UTC and display it in Asia/Kolkata. The one-month due date must be computed as a calendar month, not a fixed 30-day interval.
3. **Copy to complainant:** preserve the exact recorded complaint text and issue a dated copy to the complainant. Store copy-delivery status, timestamp and a delivery reference. Editing the original complaint later must not silently alter the copy previously issued.
4. **Acknowledgment:** send within 48 hours of receipt. Record the channel, delivery attempt, timestamp and result. A queued email is not proof of delivery; distinguish queued, sent, delivered, bounced and manual-delivery-confirmed.
5. **Assignment:** assign a named Grievance Officer/authorised handler, set escalation reminders before the one-month deadline and prevent unassigned complaints from remaining unnoticed.
6. **Investigation:** append internal notes and events; preserve the original complaint. Keep internal notes separate from customer-visible correspondence.
7. **Resolution:** record outcome, resolution date, customer notification, refund/replacement/order reference if relevant and supporting evidence. Preserve the audit trail.
8. **Escalation:** overdue and near-due complaints must appear in a restricted dashboard and be escalated to the proprietor/authorised manager.
9. **Retention / closure:** retain the complaint and evidence only for the applicable legal, accounting, dispute and operational retention period. Apply legal holds where required; then securely delete/anonymise.

## Required fields

### Complaint record
- internal UUID and customer-safe complaint reference;
- receipt timestamp, time zone and source channel;
- customer name and contact details;
- order / RFQ reference where relevant;
- original complaint text and original attachment references;
- language, issue category and urgency;
- assigned handler / Grievance Officer;
- acknowledgment due timestamp (receipt + 48 hours) and one-month redress due date;
- copy-of-complaint issue timestamp, delivery channel and proof/reference;
- acknowledgment timestamp, delivery channel and result;
- status, resolution summary, resolution timestamp and customer notification;
- created/updated timestamps and record-retention / legal-hold flags.

### Append-only event history
Record each status transition, assignment, view/export where practicable, complaint-copy issue, acknowledgment attempt, attachment operation, customer message, escalation and resolution with actor, timestamp and before/after values. Corrections should be appended as amendments rather than overwriting the original complaint.

## Security architecture

- Store complaint data in a dedicated non-public schema (proposed: internal_compliance), separate from the sales-lead system.
- Enable RLS and revoke direct table access from PUBLIC, anon and ordinary authenticated clients.
- Expose narrowly scoped staff RPCs or server-side functions only after verifying the authenticated user's approved app_metadata role through the existing staff-role gate or a dedicated grievance permission check. Sales access alone may be too broad; final role mapping needs owner approval.
- The public intake should be a server-side Edge Function with strict field validation, size limits, origin checks, spam/rate-limit controls and attachment validation. Do not expose a service-role key to browser code.
- Use private object storage for attachments; no public buckets or predictable public file URLs.
- Do not log complaint text, email addresses, phone numbers, payment data or uploaded file contents in application logs.
- Test unauthorised anonymous access, ordinary customer account access, cross-customer access, staff access, rate limits, duplicate submissions and audit-event immutability.

## Operating controls

- The named Grievance Officer must monitor the queue every business day and have a backup.
- Use reminders at intake, before the 48-hour acknowledgment deadline, before the one-month redress deadline and when overdue.
- Keep a monitored mailbox and phone channel as fallback; enter an offline complaint into the restricted register with its original receipt time.
- Test the process with a synthetic complaint before launch. Never use a real customer's details in CI fixtures or repository files.
- Compare the live process to the published Terms/Refund/Privacy wording before release. If the business cannot meet the published deadline, obtain legal advice before changing the policy.

## Release gate

This is not complete until the production intake endpoint, restricted database schema, private attachment handling, staff interface, message-delivery evidence, audit log, calendar-month SLA and end-to-end test are deployed and reviewed. A written procedure alone does not satisfy this implementation gate.
