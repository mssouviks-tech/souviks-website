#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const fn = read("supabase/functions/delhivery-estimate/index.ts");
const client = read("assets/js/product/delivery-estimate.js");
const css = read("assets/css/delhivery-estimator.css");
const sync = read("scripts/catalogue/sync_delhivery_module.py");
const config = read("supabase/config.toml");
const docs = read("docs/delhivery-estimate-setup.md");
const versions = read("scripts/js/refresh_versions.py");

assert.match(fn, /DELHIVERY_ORIGIN_PIN/);
assert.match(fn, /DEFAULT_ORIGIN_PIN = "713321"/);
assert.match(fn, /DELHIVERY_B2C_API_TOKEN/);
assert.match(fn, /DELHIVERY_B2B_BEARER_TOKEN/);
assert.match(fn, /https:\/\/track\.delhivery\.com\/c\/api\/pin-codes\/json/);
assert.match(fn, /api\/kinko\/v1\/invoice\/charges\/\.json/);
assert.match(fn, /https:\/\/ltl-clients-api\.delhivery\.com\/tat\/estimate/);
assert.match(fn, /claim\(await digest\("delhivery-global\|" \+ key\), 20, 60\)/);
assert.match(fn, /claim\(await digest\("delhivery-ip\|" \+ ip \+ "\|" \+ key\), 8, 600\)/);
assert.match(fn, /origin_pin/);
assert.match(fn, /destination_pin/);
assert.match(fn, /chargeable_weight_g/);
assert.match(fn, /amount === null \|\| amount <= 0/);
assert.match(fn, /typeof candidate === "number" \|\| \(typeof candidate === "string"/);
assert.match(fn, /Access-Control-Allow-Origin/);
assert.match(fn, /signal: AbortSignal\.timeout/);
assert.doesNotMatch(fn, /(?:DELHIVERY_B2C_API_TOKEN|DELHIVERY_B2B_BEARER_TOKEN)\s*=\s*["'][A-Za-z0-9]/);

assert.match(client, /functions\.invoke\("delhivery-estimate"/);
assert.match(client, /destination_pin/);
assert.match(client, /chargeable_weight_g/);
assert.match(client, /Pre-paid/);
assert.match(client, /Approximate courier estimate only/);
assert.match(client, /error\?\.context.*json/s);
assert.match(client, /result\.innerHTML/);
assert.match(css, /@media \(max-width: 520px\)/);
assert.match(sync, /id="product-detail"/);
assert.match(sync, /assets\/js\/product\/delivery-estimate\.js/);
assert.match(sync, /assets\/css\/delhivery-estimator\.css/);
assert.match(config, /\[functions\.delhivery-estimate\]/);
assert.match(config, /verify_jwt = false/);
assert.match(docs, /DELHIVERY_B2C_API_TOKEN/);
assert.match(docs, /₹45,000 free-shipping policy/);
assert.match(versions, /assets\/css/);

console.log("Delhivery estimator contract OK: server-side credentials, origin PIN, API routes, input bounds, rate limit, responsive UI, and estimated-price disclaimers.");
