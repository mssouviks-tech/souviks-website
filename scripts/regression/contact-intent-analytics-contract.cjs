#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");
const attribution = read("assets/js/attribution.js");
const dashboard = read("assets/js/account/analytics-lead-dashboard.js");
const page = read("en/admin/channel-attribution.html");
const migration = read("supabase/migrations/20261020170000_contact_intent_touchpoints.sql");
const englishPrivacy = read("en/privacy-policy.html");
const hindiPrivacy = read("hi/privacy-policy.html");
const bengaliPrivacy = read("bn/privacy-policy.html");

assert.ok(attribution.includes('const VISITOR_KEY="souviks:visitor-id:v1"'), "contact attribution must use a bounded anonymous browser ID");
assert.ok(attribution.includes("visitor_id:getVisitorId()"), "lead attribution must carry the anonymous visitor ID");
assert.ok(attribution.includes('p_contact_type:contactType'), "contact intent RPC must classify email vs phone");
assert.ok(attribution.includes('href.startsWith("mailto:")? "email"') || attribution.includes('href.startsWith("mailto:")?"email"'), "mailto links must be tracked");
assert.ok(attribution.includes('href.startsWith("tel:")? "phone"') || attribution.includes('href.startsWith("tel:")?"phone"'), "telephone links must be tracked");
assert.ok(attribution.includes('supabaseClient.rpc("record_contact_intent"'), "touchpoints must be persisted through the database RPC");
assert.doesNotMatch(attribution, /p_destination|p_target_email|p_target_phone/, "contact destinations must not be sent to analytics");

for (const name of ["staff_contact_intent_summary", "staff_list_contact_intents"]) {
  assert.ok(dashboard.includes(name), "dashboard must read " + name);
}
for (const id of ["contact-intent-metrics", "contact-intent-body"]) {
  assert.ok(page.includes('id="' + id + '"'), "staff dashboard is missing " + id);
}
assert.match(page, /contact intent only, not a confirmed call or a sent email/i);
assert.match(dashboard, /No enquiry linked/);

const table = migration.slice(
  migration.indexOf("CREATE TABLE IF NOT EXISTS internal_analytics.contact_intent_events"),
  migration.indexOf("ALTER TABLE internal_analytics.contact_intent_events ENABLE ROW LEVEL SECURITY")
);
assert.ok(table.includes("visitor_id uuid NOT NULL"), "event table must use the anonymous visitor ID");
assert.ok(table.includes("contact_type text NOT NULL CHECK (contact_type IN ('email', 'phone'))"));
assert.doesNotMatch(table, /destination|target_email|target_phone|customer_email|customer_phone/i, "event rows must not store contact destinations or customer contact data");
assert.match(migration, /ALTER TABLE internal_analytics\.contact_intent_events ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL ON TABLE internal_analytics\.contact_intent_events FROM PUBLIC, anon, authenticated/);
assert.match(migration, /IF NOT internal_analytics\.is_sales_staff\(\)/, "dashboard RPCs must enforce trusted staff authorization");
assert.match(migration, /AFTER INSERT OR UPDATE OF contact_intent_visitor_id/, "touchpoints must link to website or RFQ leads when the same visitor converts");
assert.match(migration, /clicked_at < v_now - interval '365 days'/, "old contact-intent records should be opportunistically cleaned up");
assert.match(englishPrivacy, /contact-intent analytics/i);
assert.match(hindiPrivacy, /संपर्क-इरादा विश्लेषण/);
assert.match(bengaliPrivacy, /যোগাযোগের অভিপ্রায় বিশ্লেষণ/);

console.log("[Contact intent analytics contract] PASS — anonymous visitor ID, email/phone click capture, staff-only reporting, lead linkage, and privacy disclosure.");
