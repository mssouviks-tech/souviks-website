#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");
const staffSql = read("supabase/migrations/20261019154356_sales_lead_staff_workflow.sql");
const funnelSql = read("supabase/migrations/20261019140604_channel_attribution_funnel.sql");
const rpcSql = read("supabase/migrations/20261019141427_channel_attribution_function_fix.sql");
const dashboard = read("assets/js/account/analytics-lead-dashboard.js");
const page = read("en/admin/channel-attribution.html");
const refactor = read("scripts/js/refactor.py");

assert.match(staffSql, /internal_analytics\.is_sales_staff/);
assert.match(staffSql, /auth\.jwt\(\)\s*->\s*'app_metadata'/);
assert.doesNotMatch(staffSql, /auth\.jwt\(\)\s*->\s*'user_metadata'/);
assert.match(staffSql, /'admin',\s*'sales',\s*'owner'/);
for (const name of [
  "public.record_website_lead_details",
  "public.staff_list_sales_leads",
  "public.staff_channel_funnel_report",
  "public.staff_create_manual_lead",
  "public.staff_update_sales_lead",
]) {
  assert.ok(staffSql.includes(name), "migration must define " + name);
}
assert.match(staffSql, /REVOKE ALL ON FUNCTION public\.staff_list_sales_leads[\s\S]*?FROM PUBLIC, anon/i);
assert.match(staffSql, /REVOKE ALL ON FUNCTION public\.staff_channel_funnel_report[\s\S]*?FROM PUBLIC, anon/i);
assert.match(staffSql, /GRANT EXECUTE ON FUNCTION public\.staff_list_sales_leads[\s\S]*?TO authenticated/i);
assert.match(staffSql, /GRANT EXECUTE ON FUNCTION public\.staff_update_sales_lead[\s\S]*?TO authenticated/i);
assert.match(staffSql, /Won orders cannot be reverted/);
assert.match(staffSql, /Won orders require an order reference and order value/);
assert.match(staffSql, /order_value[\s\S]*?p_order_value/);
assert.match(staffSql, /count\(\*\) FILTER \(WHERE l\.quote_sent_at IS NOT NULL\)/, "sent quotations must use milestone timestamps");
assert.match(staffSql, /count\(\*\) FILTER \(WHERE l\.accepted_at IS NOT NULL\)/, "accepted quotations must use milestone timestamps");
assert.match(staffSql, /CREATE OR REPLACE VIEW internal_analytics\.lead_channel_funnel[\s\S]*?quote_sent_at IS NOT NULL/, "private funnel view must use milestone history");
assert.match(staffSql, /customer_email text/);
assert.match(staffSql, /outcome_updated_by/);
assert.match(staffSql, /source_channel/);
assert.match(staffSql, /'phone', 'whatsapp', 'email', 'manual'/);
assert.match(staffSql, /SET search_path TO 'pg_catalog'/i);

assert.match(funnelSql, /internal_analytics\.lead_channel_funnel/);
assert.match(funnelSql, /internal_analytics\.lead_channel_daily/);
assert.match(funnelSql, /sales_leads_source_channel_check/);
assert.match(rpcSql, /SECURITY DEFINER/i);
assert.match(rpcSql, /REVOKE ALL ON FUNCTION public\.submit_rfq_attributed[\s\S]*?FROM PUBLIC, anon/i);
assert.match(rpcSql, /GRANT EXECUTE ON FUNCTION public\.submit_rfq_attributed[\s\S]*?TO authenticated/i);

assert.match(dashboard, /staff_channel_funnel_report/);
assert.match(dashboard, /staff_list_sales_leads/);
assert.match(dashboard, /staff_create_manual_lead/);
assert.match(dashboard, /staff_update_sales_lead/);
assert.doesNotMatch(dashboard, /\.from\(["']sales_leads["']\)/);
assert.doesNotMatch(dashboard, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
assert.match(page, /noindex,nofollow,noarchive/);
assert.match(page, /Record phone \/ WhatsApp enquiry/);
assert.match(refactor, /assets\/js\/attribution\.js/);
console.log("[Sales funnel security contract] PASS — staff authorization, private reads/writes, offline lead capture, and order outcomes.");
