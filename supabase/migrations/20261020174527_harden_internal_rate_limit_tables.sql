-- Protect internal lead rate-limiting tables from direct API access.
-- The public lead-submission RPC runs as the postgres owner (SECURITY DEFINER),
-- and may continue managing rate-limit rows; no client-facing RLS policies are needed.

ALTER TABLE internal_analytics.public_lead_rate_limit_salt
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE internal_analytics.public_lead_rate_limits
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  internal_analytics.public_lead_rate_limit_salt,
  internal_analytics.public_lead_rate_limits
FROM PUBLIC, anon, authenticated;
