#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "../..");
const paths = {
  accountBasket: "assets/js/account/rfq.js",
  quoteBasket: "assets/js/request-quote/rfq.js",
  accountSubmit: "assets/js/account/rfq-submit.js",
  standaloneSubmit: "assets/js/request-quote/standalone-rfq-submission.js",
};
const source = Object.fromEntries(
  Object.entries(paths).map(([key, relative]) => [
    key,
    fs.readFileSync(path.join(ROOT, relative), "utf8"),
  ])
);

function loadValidators(moduleSource, label) {
  const start = moduleSource.indexOf("RFQ.SUBMISSION_LIMITS = Object.freeze({");
  const end = moduleSource.indexOf(
    "\n\n/*\n----------------------------------------------------------\nGET CURRENT USER",
    start
  );
  assert.ok(start >= 0 && end > start, `${label}: validator source block must exist`);

  const sandbox = {
    RFQ: {},
    window: { souviks: { currentLanguage: "en" } },
    document: { documentElement: { lang: "en" } },
  };
  vm.runInNewContext(moduleSource.slice(start, end), sandbox, {
    filename: label,
    timeout: 1000,
  });
  return sandbox.RFQ;
}

function invalid(fn, message) {
  let error;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, message);
}

function item(id = "SVKS000001", qty = 1, overrides = {}) {
  return {
    id,
    partNumber: "PN-001",
    name: "Test product",
    brand: "Test brand",
    qty,
    ...overrides,
  };
}

for (const label of ["accountBasket", "quoteBasket"]) {
  const RFQ = loadValidators(source[label], label);
  assert.equal(RFQ.SUBMISSION_LIMITS.maxItems, 50);
  assert.equal(RFQ.SUBMISSION_LIMITS.maxQuantity, 9999);

  assert.equal(RFQ.validateSubmissionItems([item("one", 1)])[0].quantity, 1);
  assert.equal(RFQ.validateSubmissionItems([item("max", 9999)])[0].quantity, 9999);
  assert.equal(RFQ.validateSubmissionItems(Array.from({ length: 50 }, (_, i) => item(`p-${i}`))).length, 50);

  invalid(() => RFQ.validateSubmissionItems([]), `${label}: empty basket rejected`);
  invalid(
    () => RFQ.validateSubmissionItems(Array.from({ length: 51 }, (_, i) => item(`p-${i}`))),
    `${label}: 51 items rejected`
  );
  invalid(() => RFQ.validateSubmissionItems([item("qty-zero", 0)]), `${label}: zero quantity rejected`);
  invalid(() => RFQ.validateSubmissionItems([item("qty-high", 10000)]), `${label}: quantity over 9999 rejected`);
  invalid(() => RFQ.validateSubmissionItems([item("qty-frac", 1.5)]), `${label}: fractional quantity rejected`);
  invalid(() => RFQ.validateSubmissionItems([item("qty-exp", "1e2")]), `${label}: exponent quantity rejected`);
  invalid(() => RFQ.validateSubmissionItems([item("duplicate", 1), item(" duplicate ", 2)]), `${label}: duplicate identifiers rejected`);
  invalid(() => RFQ.validateSubmissionItems([item("long-id", 1, { id: "i".repeat(129) })]), `${label}: long ID rejected`);
  invalid(() => RFQ.validateSubmissionItems([item("long-part", 1, { partNumber: "p".repeat(129) })]), `${label}: long part number rejected`);
  invalid(() => RFQ.validateSubmissionItems([item("long-name", 1, { name: "n".repeat(301) })]), `${label}: long product name rejected`);
  invalid(() => RFQ.validateSubmissionItems([item("long-brand", 1, { brand: "b".repeat(161) })]), `${label}: long brand rejected`);

  const goodCustomer = RFQ.validateSubmissionCustomer({
    name: "a".repeat(120),
    phone: "1".repeat(40),
    company: "c".repeat(160),
    gst: "g".repeat(15),
    message: "m".repeat(2000),
    email: "a".repeat(241) + "@test.invalid",
    location: "l".repeat(200),
  });
  assert.equal(goodCustomer.name.length, 120);
  assert.equal(goodCustomer.gst, "G".repeat(15));
  invalid(() => RFQ.validateSubmissionCustomer({ name: "", phone: "123" }), `${label}: missing customer name rejected`);
  invalid(() => RFQ.validateSubmissionCustomer({ name: "Test", phone: "" }), `${label}: missing customer phone rejected`);
  invalid(() => RFQ.validateSubmissionCustomer({ name: "n".repeat(121), phone: "123" }), `${label}: overlong customer name rejected`);
  invalid(() => RFQ.validateSubmissionCustomer({ name: "Test", phone: "1".repeat(41) }), `${label}: overlong phone rejected`);
  invalid(() => RFQ.validateSubmissionCustomer({ name: "Test", phone: "123", company: "c".repeat(161) }), `${label}: overlong company rejected`);
  invalid(() => RFQ.validateSubmissionCustomer({ name: "Test", phone: "123", gst: "g".repeat(16) }), `${label}: overlong GST rejected`);
  invalid(() => RFQ.validateSubmissionCustomer({ name: "Test", phone: "123", message: "m".repeat(2001) }), `${label}: overlong message rejected`);
}

const accountCreateRFQ = source.accountSubmit.match(
  /async createRFQ\([\s\S]*?\n    \},\n\n/
)?.[0] || "";
const customerValidation = accountCreateRFQ.match(
  /RFQ\.validateSubmissionCustomer\(\{([\s\S]*?)\}\)/
)?.[1] || "";
assert.match(customerValidation, /\bemail:\s*user\.email\b/, "account path must apply the email length limit to the authenticated email");

for (const label of ["accountSubmit", "standaloneSubmit"]) {
  const code = source[label];
  assert.match(code, /\.rpc\(\s*["']submit_rfq["']/s, `${label}: must call submit_rfq RPC`);
  assert.doesNotMatch(code, /\.from\(\s*["']rfqs["']\s*\)\s*\.insert/s, `${label}: direct RFQ parent inserts forbidden`);
  assert.doesNotMatch(code, /\.from\(\s*["']rfq_items["']\s*\)\s*\.insert/s, `${label}: direct RFQ item inserts forbidden`);
  assert.match(code, /(?:window\.)?RFQ\.validateSubmissionItems/, `${label}: item validation must run before submit`);
}
assert.match(source.standaloneSubmit, /window\.RFQ\.validateSubmissionCustomer/, "standalone path must validate customer fields");
assert.match(source.quoteBasket, /messages:\s*rfqMessages/, "quote basket must expose its localized submission messages");
assert.match(source.standaloneSubmit, /window\.RFQ\.messages\.(?:unavailable|failed|success|notificationFailed)/, "standalone submission must use the explicitly exported message namespace");
assert.doesNotMatch(source.standaloneSubmit, /\brfqMessage\b/, "standalone submission must not depend on a free rfqMessage binding");
assert.doesNotMatch(source.standaloneSubmit, /(^|[^.\\w$])\\bRFQ\\.[A-Za-z_$]/m, "standalone submission must not use an unqualified RFQ property reference");

const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261010111730_rfq_submission_hardening.sql"), "utf8");
assert.match(sql, /SECURITY DEFINER/i);
assert.match(sql, /SET search_path TO 'pg_catalog'/i);
assert.match(sql, /v_user_id := auth\.uid\(\)/i);
assert.match(sql, /jsonb_array_length\(p_items\) > 50/i);
assert.match(sql, /v_quantity < 1 OR v_quantity > 9999/i);
assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\.rfqs FROM anon/i);
assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\s+ON TABLE public\.rfqs FROM authenticated/i);
assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\s+ON TABLE public\.rfq_items FROM authenticated/i);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.submit_rfq\([^;]+\)\s+FROM PUBLIC, anon/i);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.submit_rfq\([^;]+\)\s+TO authenticated/i);

const versionPaths = [
  "assets/js/account/rfq.js",
  "assets/js/request-quote/rfq.js",
  "assets/js/account/rfq-submit.js",
  "assets/js/request-quote/standalone-rfq-submission.js",
];
const versions = versionPaths.map(relative => {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  return `${relative}?v=${digest}`;
});
console.log("[RFQ security contract] cache versions: " + versions.join(" | "));
console.log("[RFQ security contract] PASS — client limits, atomic RPC usage, owner source, and write grants verified.");
