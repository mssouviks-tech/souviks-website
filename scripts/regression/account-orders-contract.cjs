#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const endpoint = read("supabase/functions/account-orders/index.ts");
const accountCore = read("assets/js/account/auth-account.js");
const accountOrders = read("assets/js/account/auth-orders.js");
const accountCss = read("assets/css/bundles/account.css");
const config = read("supabase/config.toml");

assert.match(endpoint, /optionalUserId\(req\)/);
assert.match(endpoint, /authentication_required/);
assert.match(endpoint, /user_id:\s*"eq\."\s*\+\s*userId/);
assert.match(endpoint, /order_items/);
assert.match(endpoint, /order_id:\s*"in\.\("/);
assert.match(endpoint, /limit:\s*"20"/);
assert.doesNotMatch(endpoint, /customer_email:\s*"eq\."|customer_phone:\s*"eq\."/);
assert.match(config, /\[functions\.account-orders\]\s*verify_jwt\s*=\s*false/);
assert.match(accountCore, /"orders"/);
assert.match(accountOrders, /functions\.invoke\("account-orders"/);
assert.match(accountOrders, /payment_failure_reason/);
assert.match(accountCss, /\.account-order-card/);
for (const lang of ["en", "hi", "bn"]) {
  const html = read(lang + "/account.html");
  assert.ok(html.includes('data-account-view="orders"'), lang + " account section missing");
  assert.ok(html.includes('id="accountOrdersList"'), lang + " order list missing");
  assert.ok(html.includes("auth-orders.js"), lang + " order module missing");
  assert.ok(html.includes("/" + lang + "/account?view=orders"), lang + " order navigation missing");
}
console.log("Account orders contract OK: authenticated user scoping, order items, localized account views, payment details, and no guest-order exposure.");
