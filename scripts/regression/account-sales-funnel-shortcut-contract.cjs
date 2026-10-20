#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");
const account = read("assets/js/account/auth-account.js");

assert.match(account, /function initializeSalesFunnelShortcut\(user\)/);
assert.match(account, /initializeSalesFunnelShortcut\(user\)/, "shortcut must be initialized for the authenticated user");
assert.match(account, /user\.app_metadata/, "visibility must use trusted Supabase app metadata");
assert.doesNotMatch(account, /user_metadata/, "visibility must never trust user-editable metadata");

for (const role of ["admin", "sales", "owner"]) {
  assert.ok(account.includes('"' + role + '"'), "authorized staff role must be supported: " + role);
}

assert.match(account, /\/en\/admin\/channel-attribution/, "shortcut must target the staff dashboard");
assert.match(account, /data-account-sales-funnel/, "shortcut must not be duplicated if initialization repeats");
assert.match(account, /চ্যানেল অ্যাট্রিবিউশন ও সেলস ফানেল/, "Bengali account pages should receive a localized label");
assert.match(account, /चैनल एट्रिब्यूशन और सेल्स फ़नल/, "Hindi account pages should receive a localized label");

console.log("[Account sales funnel shortcut contract] PASS — staff-only navigation, trusted role metadata, dashboard target, and localized labels.");
