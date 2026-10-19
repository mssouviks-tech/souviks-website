# Souviks channel attribution and sales-funnel operations

## Staff dashboard

Open /en/admin/channel-attribution.html while signed into a Souviks account. The page is noindex and is intentionally not linked in customer navigation. The browser only calls staff RPCs; it does not read or update sales_leads directly.

### Assigning staff access

A Supabase administrator must assign access using trusted Auth app metadata to each approved staff account. Use one of these claim shapes:

    { "role": "admin" }

or

    { "roles": ["sales"] }

Accepted role values are admin, sales, or owner. Do not put this claim in user_metadata: users can edit that field themselves. After changing app metadata, have the user sign out and sign back in (or refresh their token) before testing access.

The migration deliberately does not assign any staff account. Assign only named, approved people using the Supabase Auth administration controls.

## Recording offline enquiries

Record an enquiry when the actual conversation occurred by telephone, WhatsApp, email, walk-in, or another offline channel. Select the correct channel and enter the customer contact details and requirement. This records a sales_leads row in received status. A click on a tel: or wa.me link is still only a click, not proof an enquiry was received.

Where campaign links are used, include UTM parameters, for example:

    ?utm_source=whatsapp&utm_medium=message&utm_campaign=diwali-2026

A website visit stores sanitized first- and last-touch source data in first-party local storage for up to 90 days and sends the attribution with a confirmed website enquiry. Do not put names, phone numbers, email addresses, or other personal data in UTM values.

## Updating quote and order outcomes

Use Manage on a lead:
- Set Quotation sent after a quotation has actually been issued, and enter its reference if available.
- Set Quotation accepted only after acceptance is confirmed.
- Set Order won only when an order reference and value are known. Won value is recorded in INR.
- Set Lost or Unqualified where appropriate and explain why in the internal note.

The staff RPC refuses unauthorised calls even if the HTML URL is known. It also refuses to revert a recorded won order through the dashboard. Correct a mistaken won outcome only through an audited administrator-controlled database procedure.

## Funnel definitions

- Enquiries received: rows recorded in sales_leads.
- Quotations sent: leads whose current status is quoted, accepted, or won.
- Orders won: leads whose current status is won.
- Won order value: sum of recorded order_value for won leads.
- Enquiry-to-order rate: won leads divided by all recorded leads in the selected period.

The channel funnel aggregates first-touch channel, source, medium, campaign and last-touch channel. Counts are based on manually recorded CRM outcomes, not inferred from Google Analytics click events.

## Migration-history reconciliation

The connected Supabase project already records migration versions 20261019140604 and 20261019141427, while those SQL files were absent from repository main. The files added at those exact versions in this PR reconstruct the schema/functions/views from the live schema and function definitions and use idempotent DDL where feasible. Since the connected project already marks those versions applied, this PR does not execute or record them against production. Review the reconstructed files before using them to bootstrap a fresh database; migration-version history does not verify byte-for-byte equivalence with the SQL originally applied.

The new staff workflow is 20261019160000_sales_lead_staff_workflow.sql. It has been committed to the repository only; it has not been applied to the connected Supabase project by this task.

## Search Console note

The Google Search Console reporting connector currently refuses requests because its subscription is inactive. Therefore this dashboard reports operational enquiries/quotations/orders only; it does not claim to include verified organic-search clicks, impressions, CTR, or ranking data. Reactivate the connector and verify the souviks.co.in property before recording a Search Console baseline.
