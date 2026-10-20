#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(
  path.join(ROOT, "assets/js/account/analytics-lead-dashboard.js"),
  "utf8"
);

const page = fs.readFileSync(
  path.join(ROOT, "en/admin/channel-attribution.html"),
  "utf8"
);
const languageBootstrap = page.indexOf('window.souviks = window.souviks && typeof window.souviks === "object"');
const sharedCore = page.indexOf('<script defer src="/assets/js/site-core.js?');
assert.ok(
  languageBootstrap >= 0 && sharedCore > languageBootstrap,
  "the standalone staff dashboard must initialize window.souviks before site-core reads its current language"
);
assert.match(page.slice(languageBootstrap, sharedCore), /document\.documentElement\.lang\s*\|\|\s*"en"/);

assert.match(dashboard, /async function withTimeout\(operation, timeoutMs, message\)/);
assert.match(dashboard, /await withTimeout\([\s\S]*?supabaseClient\.auth\.getSession\(\)[\s\S]*?12000/);
assert.match(dashboard, /Session check timed out/, "stalled session checks need an explicit timeout message");
assert.match(
  dashboard,
  /async function initialize\(\) \{[\s\S]*?try \{[\s\S]*?await withTimeout\([\s\S]*?\} catch \(error\) \{[\s\S]*?displayError\(error\)[\s\S]*?addRetryButton\(\);[\s\S]*?\} finally \{/,
  "all dashboard startup errors must be caught and reported instead of becoming unhandled rejections"
);
assert.match(dashboard, /function addRetryButton\(\)/);
assert.match(dashboard, /data-dashboard-retry/);
assert.match(dashboard, /function bindDashboardHandlers\(\)/);
assert.match(dashboard, /if \(handlersBound\) return;/, "retry must not bind duplicate handlers");

console.log("[Dashboard session startup contract] PASS — bounded auth session check, caught failures, retry control, and idempotent handler binding.");
