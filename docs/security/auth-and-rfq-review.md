# Security review: authentication and RFQ submission

**Review date:** 2026-10-15  
**Project:** Souvik's Website (kjxrfmujzdxatpgegqcs)  
**Scope:** audit items A21, A23, A24, A26 and A27.

## A21 — leaked-password protection

The Supabase organization is currently on the **Free** plan. Supabase's current password-security documentation says leaked-password protection is available on Pro and above. The Auth security advisor currently reports it disabled. It cannot be enabled on this plan; do not represent the issue as fixed or upgrade billing without the owner's approval.

After a plan upgrade, enable the control in Supabase Auth settings and test registration and password reset with:
- a known compromised password (must be rejected),
- a strong unique password (must be accepted),
- the normal reset flow and resulting sign-in.

Do not put real credentials in CI logs or commit them to test fixtures.

## A23 — client/server RFQ validation parity

The browser validators and database RPC both enforce the same key limits: required name and phone, maximum 50 distinct items, duplicate-product rejection, quantity 1–9,999, and bounded field lengths. The RPC derives the owner from auth.uid(), uses the JWT email, and writes the parent and item rows in one transaction. Regression coverage lives in scripts/regression/rfq-security-contract.cjs.

The database remains the authoritative boundary. Browser checks are for usability only and are not trusted as security controls.

## A24 — RLS and submit_rfq security-definer review

The current production RPC is intentionally SECURITY DEFINER: the client is denied direct RFQ parent/child writes, while the RPC performs the atomic insert. Its current ACL grants execution to authenticated and service_role, not PUBLIC or anon. The function:
- checks auth.uid() and rejects missing identity;
- uses SET search_path TO 'pg_catalog';
- uses schema-qualified table references;
- takes the customer email from the authenticated JWT, not from a client-supplied email;
- validates payload types, lengths, duplicate identifiers and quantity bounds before completing the transaction.

This is a reviewed exception, not a claim that the advisor warning has disappeared. Replacing it with SECURITY INVOKER without a redesigned write path would conflict with the intended restriction on direct table writes. Keep the RPC's narrow ACL and regression assertions. Re-review if the function starts using dynamic SQL, new schemas, or caller-controlled identity fields.

The advisor's 12 souviks_stage no-policy findings are in a schema where both anon and authenticated lack USAGE; those findings do not expose those tables to these API roles. Continue to audit any changes to schema grants.

## A26 — secret scanning

A Gitleaks workflow is added to scan the complete Git history on pull requests and pushes to main. A passing workflow is evidence for that scanned revision/history, not proof that no credential was ever exposed elsewhere. If a real credential is discovered, revoke/rotate it first; removing it from the current tree alone does not invalidate it.

## A27 — abuse resistance and limits

The new migration adds account-scoped, database-enforced throttling for the authenticated RPC:
- at most 5 RFQ submissions in a rolling 10-minute window;
- at most 30 RFQ submissions in a rolling 24-hour window;
- a transaction-scoped advisory lock prevents simultaneous requests for one account from racing past the counters.

The client maps the stable RFQ_RATE_LIMITED database error to localized, user-facing guidance. This limits authenticated-account abuse; it is not an IP-based limit and does not by itself rate-limit the guest EmailJS path. The guest path still needs separate server-side verification/rate limiting before it can be considered fully protected against automated abuse.

## Verification boundary

Repository CI can validate the source contract and build output. It cannot safely prove real registration/reset delivery without a controlled test account and mailbox. The migration must be applied to the production database after review/merge, and the database advisor should be rerun afterward. The security-definer advisor is expected to remain while this RPC architecture is retained.
