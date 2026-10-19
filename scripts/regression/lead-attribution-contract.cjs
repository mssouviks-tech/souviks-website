#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");
const attribution = read("assets/js/attribution.js");
const refactor = read("scripts/js/refactor.py");
const contact = read("assets/js/bundles/contact.js");
const requestPart = read("assets/js/bundles/request-part.js");
const accountSubmit = read("assets/js/account/rfq-submit.js");
const standaloneSubmit = read("assets/js/request-quote/standalone-rfq-submission.js");

for (const marker of [
  "window.SouviksAttribution",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "msclkid",
  "fbclid",
  "ttclid",
  "localStorage",
  "first_touch_channel",
  "last_touch_channel",
  "landing_page",
  "conversion_page",
  "record_website_lead",
]) {
  assert.ok(attribution.includes(marker), "attribution module must implement behavior: " + marker);
}

assert.ok(attribution.includes('STORAGE_KEY="souviks:attribution:v1"'));
assert.ok(attribution.includes("new URL(window.location.href)"));
assert.ok(attribution.includes("window.SouviksErrors?.log"));
assert.ok(attribution.includes('"organic_search"'));
assert.ok(attribution.includes('"referral"'));
assert.ok(attribution.includes('"direct"'));
assert.ok(attribution.includes('"record_website_lead"'));

for (const [label, source, leadType] of [
  ["contact", contact, "contact"],
  ["request part", requestPart, "request_part"],
  ["guest RFQ", standaloneSubmit, "rfq_guest"],
]) {
  assert.ok(
    source.includes('recordLead?.(payload.lead_id, "' + leadType + '")') ||
    source.includes('recordLead?.(reference, "' + leadType + '")'),
    label + " must persist a sales lead using its correct type"
  );
}

for (const [label, source] of [
  ["account RFQ", accountSubmit],
  ["standalone authenticated RFQ", standaloneSubmit],
]) {
  assert.match(source, /\.rpc\(\s*["']submit_rfq_attributed["']/s, label + " must use the attribution-aware atomic RPC");
  assert.match(source, /p_attribution:\s*window\.SouviksAttribution\?\.getPayload\?\.\(\)\s*\|\|\s*\{\}/s, label + " must send first-/last-touch metadata");
  assert.doesNotMatch(source, /\.from\(["']sales_leads["']\)\s*\.insert/s, label + " must not bypass the database RPC with direct lead table inserts");
}

assert.ok(refactor.includes("assets/js/attribution.js"), "build pipeline must add the attribution script");
assert.ok(read("index.html").includes("/assets/js/attribution.js?v="), "root homepage must persist acquisition attribution");
assert.ok(read("en/index.html").includes("/assets/js/attribution.js?v="), "localized homepage must persist acquisition attribution");
console.log("[Lead attribution contract] PASS — persistent UTM/click/referrer capture, safe attribution RPC recording, and authenticated RFQ attribution.");
