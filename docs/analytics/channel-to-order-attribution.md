# Channel-to-order attribution

## Purpose and baseline

This is a forward-looking measurement change, not a retroactive source reconstruction. The connected GSC Wizard reporting subscription was inactive when this work began, so historical Search Console and GA4 channel figures were not available through that connector. Existing RFQ records are backfilled with \`unknown\` source unless a source was already verifiably captured; no historic channel is guessed.

## Funnel and event definitions

| Funnel stage | Measurement |
| --- | --- |
| Website visit | GA4 page view; acquisition tags and referrer host are retained in a first/last-touch record. |
| Product/RFQ interaction | GA4 \`rfq_click\` records a click intent; \`add_to_rfq\` fires only after an item is successfully added/updated in the RFQ basket. |
| Received enquiry | \`generate_lead\` with \`lead_type\` = \`contact\`, \`request_part\`, \`rfq\`, or \`rfq_guest\`. Submitted form leads are stored in \`public.sales_leads\` after successful submission. Authenticated RFQs are stored in \`public.rfqs\` and linked to the sales lead by \`rfq_id\`. |
| Quotation sent | Update the RFQ status to \`quoted\`. The database trigger maps that status to a sales-lead quotation stage and records \`quote_sent_at\`. |
| Order won | An authorised staff member updates the sales-lead row to \`won\`, sets \`order_won_at\`, and fills the actual order reference and value. \`accepted\` means quote accepted; it is not counted as a won order. |

Phone, WhatsApp and email CTA clicks are intent signals (\`phone_click\`, \`whatsapp_click\`, \`email_click\`), **not proof that a call/message/enquiry was received**. For every actual inbound phone or WhatsApp enquiry, staff should create a row in \`public.sales_leads\` (Supabase Table Editor) using \`lead_type=phone\` or \`lead_type=whatsapp\`. Ask “How did you first find Souviks?” where practical; record the stated/known source and use \`unknown\` rather than guessing. The website cannot determine the origin of a direct phone call if the caller does not share it.

## Attribution model

- UTM parameters (\`utm_source\`, \`utm_medium\`, \`utm_campaign\`, \`utm_term\`, \`utm_content\`) are captured on entry. Search-engine referrers without UTMs are classified as organic search; social referrers are classified as social; other outside domains as referral.
- A Google click ID without UTM medium is treated as paid search; campaigns should still be tagged consistently for reporting.
- The site stores acquisition fields in local storage for up to 90 days and current-session touch data in session storage for a 30-minute session. First touch means the first identifiable source; a direct visit does not overwrite a prior non-direct source. The last-touch record updates when a new identifiable source arrives.
- Stored referrer data is the host only, and landing/conversion locations are paths without query strings. Customer names, email addresses and phone numbers are not added to GA4 event parameters by this tracking layer.
- UTMs are not secure evidence of who referred a person; campaign/source values can be typed or copied by anyone. Treat them as attribution clues, not fraud-proof proof.

## Naming conventions for campaigns

Use lowercase, stable values across every link for the same campaign. Examples:

- Instagram organic post: \`?utm_source=instagram&utm_medium=social&utm_campaign=diwali_2026\`
- Email newsletter: \`?utm_source=customer_newsletter&utm_medium=email&utm_campaign=october_parts_2026\`
- Paid search: \`?utm_source=google&utm_medium=cpc&utm_campaign=tata_spares_india\`
- Partner / dealer link: \`?utm_source=dealer_name&utm_medium=referral&utm_campaign=parts_enquiry\`

Never put a person's name, phone number, email address, RFQ contents or other personal/customer information inside UTM parameters.

## Reviewing the funnel

The database view \`internal_analytics.lead_channel_funnel\` groups enquiries by first-touch and last-touch channel/source/medium/campaign and reports received enquiries, quotations sent, quotes accepted, won orders, lost leads and won order value (INR). \`internal_analytics.lead_channel_daily\` reports daily counts by first/last channel. These views are intended for the database owner/service role through Supabase SQL; the schema is not exposed as a public browser API.

Run this from the Supabase SQL Editor for a rolling 90-day view:

\`\`\`sql
SELECT *
FROM internal_analytics.lead_channel_funnel
ORDER BY orders_won DESC, quotations_sent DESC, enquiries_received DESC;
\`\`\`

To see daily movement:

\`\`\`sql
SELECT *
FROM internal_analytics.lead_channel_daily
WHERE enquiry_date >= current_date - 90
ORDER BY enquiry_date, first_touch_channel, last_touch_channel;
\`\`\`

## Manual phone/WhatsApp order lifecycle

1. When an actual call/message arrives, create one row in \`public.sales_leads\` with a unique reference such as \`PHONE-20261019-001\` or \`WA-20261019-001\`, the known source/channel, \`status='received'\`, and \`lead_type='phone'\` or \`lead_type='whatsapp'\`.
2. When a quotation is actually sent, change \`status\` to \`quoted\` and set \`quote_sent_at\`.
3. If the buyer accepts but has not ordered yet, use \`accepted\`.
4. Only when the order is confirmed, use \`won\`, set \`order_won_at\`, and record the real \`order_reference\` and \`order_value\`. Mark non-converted leads \`lost\` or \`unqualified\` as applicable.
5. For calls/WhatsApp, record the source only from evidence or the customer's answer. Keep \`unknown\` if it cannot be established.

## GA4 setup still required

The site sends event parameters for first/last touch. In GA4 Admin, register the relevant event-scoped custom dimensions (at minimum \`lead_type\`, \`current_source_channel\`, \`first_touch_channel\`, \`first_touch_source\`, \`last_touch_channel\`, \`last_touch_source\`, \`current_campaign\`, \`first_touch_campaign\`, and \`last_touch_campaign\`) and mark \`generate_lead\` as a key event. Custom dimensions generally apply prospectively; they do not recreate historic source data. Verify events in DebugView/Realtime with a controlled test enquiry before relying on the report.

## Known limitations

- Historical RFQ source is \`unknown\` unless it was previously recorded.
- A click-to-call/WhatsApp event counts clicks, not received calls/messages.
- Manual phone and WhatsApp rows depend on consistent staff intake and status updates.
- The sales funnel does not automatically connect orders from a separate invoicing/ERP workflow. Until a reliable order integration exists, staff must record the confirmed order and value.
