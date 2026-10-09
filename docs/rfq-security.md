# RFQ security boundary

## Current implementation

Authenticated RFQ creation now uses the Supabase function `public.submit_rfq(...)` instead of direct browser INSERTs into `rfqs` and `rfq_items`.

The function:

- requires `auth.uid()`;
- derives the stored customer email from the authenticated JWT;
- validates required customer fields;
- accepts at most 50 products;
- accepts quantities from 1 through 9,999;
- rejects duplicate product identifiers inside one submission;
- writes the RFQ parent and all RFQ items in one PostgreSQL transaction.

RLS is enabled for the account/RFQ tables. Browser users retain owner-only access to their profile and RFQ basket. Browser INSERT access to `rfqs` and `rfq_items` is intentionally removed; the transactional function is the customer-facing creation path.

## Required production action

The SQL migration in `supabase/migrations/20261008_rfq_rls.sql` must be applied to the live Supabase project.

The repository cannot prove the live database state because no Supabase project connection is available in the repository tooling. Do not mark the security item fully closed until the migration has been applied and runtime tests have passed.

## Runtime verification matrix

Use two authenticated test accounts, A and B.

| Test | Expected |
| --- | --- |
| A reads A profile | Allowed |
| A reads B profile | Denied / empty by RLS |
| A updates A profile | Allowed |
| A updates B profile | Denied |
| A reads A RFQ basket | Allowed |
| A reads B RFQ basket | Denied / empty |
| A changes A RFQ basket | Allowed |
| A deletes A RFQ basket | Allowed |
| A inserts directly into `rfqs` | Denied |
| A inserts directly into `rfq_items` | Denied |
| A calls `submit_rfq` | Allowed |
| A calls `submit_rfq` with B ownership fields | Server derives A identity |
| Anonymous calls `submit_rfq` | Denied |
| Submission with 51 items | Denied |
| Submission with quantity 0 | Denied |
| Submission with quantity 10,000 | Denied |
| Submission with duplicate product IDs | Denied |
| Item insert failure during submission | Entire transaction rolls back |

After these pass, the remaining RFQ risk is primarily operational abuse control (rate limiting/bot protection around the form/email notification path), not row ownership.
