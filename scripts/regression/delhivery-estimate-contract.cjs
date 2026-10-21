#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const fn = read("supabase/functions/delhivery-estimate/index.ts");
const client = read("assets/js/product/delivery-estimate.js");
const cartClient = read("assets/js/cart/delivery-estimate.js");
const catalogueBuilder = read("scripts/catalogue/build.py");
const css = read("assets/css/delhivery-estimator.css");
const sync = read("scripts/catalogue/sync_delhivery_module.py");
const config = read("supabase/config.toml");
const docs = read("docs/delhivery-estimate-setup.md");
const versions = read("scripts/js/refresh_versions.py");

assert.match(fn, /DELHIVERY_ORIGIN_PIN/);
assert.match(fn, /DEFAULT_ORIGIN_PIN = "713321"/);
assert.match(fn, /DELHIVERY_B2C_API_TOKEN/);
assert.match(fn, /DELHIVERY_API_TOKEN/);
assert.match(fn, /DELHIVERY_B2B_BEARER_TOKEN/);
assert.match(fn, /https:\/\/track\.delhivery\.com\/c\/api\/pin-codes\/json/);
assert.match(fn, /api\/kinko\/v1\/invoice\/charges\/\.json/);
assert.match(fn, /https:\/\/ltl-clients-api\.delhivery\.com\/tat\/estimate/);
assert.match(fn, /claim\(await digest\("delhivery-global\|" \+ key\), 20, 60\)/);
assert.match(fn, /claim\(await digest\("delhivery-ip\|" \+ ip \+ "\|" \+ key\), 8, 600\)/);
assert.match(fn, /origin_pin/);
assert.match(fn, /destination_pin/);
assert.match(fn, /chargeable_weight_g/);
assert.match(fn, /const paymentMode = "COD"/);
assert.match(fn, /const billingMode = "E"/);
assert.match(fn, /amount === null \|\| amount <= 0/);
assert.match(fn, /typeof candidate === "number" \|\| \(typeof candidate === "string"/);
assert.match(fn, /Access-Control-Allow-Origin/);
assert.match(fn, /signal: AbortSignal\.timeout/);
assert.doesNotMatch(fn, /(?:DELHIVERY_B2C_API_TOKEN|DELHIVERY_B2B_BEARER_TOKEN)\s*=\s*["'][A-Za-z0-9]/);

assert.match(client, /functions\.invoke\("delhivery-estimate"/);
assert.match(client, /destination_pin/);
assert.match(client, /chargeable_weight_g/);
assert.match(client, /placeholder/);
assert.match(client, /COD shipping charges/);
assert.doesNotMatch(client, /name="chargeable_weight_g"/);
assert.doesNotMatch(client, /name="payment_mode"/);
assert.doesNotMatch(client, /name="billing_mode"/);
assert.match(client, /Approximate estimate only/);
assert.match(client, /error\?\.context.*json/s);
assert.match(client, /result\.innerHTML/);
assert.match(cartClient, /checkout-pincode/);
assert.match(cartClient, /souviks_purchase_cart_v1/);
assert.match(cartClient, /approx_weight_g/);
assert.match(cartClient, /chargeable_weight_g/);
assert.match(catalogueBuilder, /def approximate_weight_grams\(p\)/);
assert.match(catalogueBuilder, /"approx_weight_g": approximate_weight_grams\(p\)/);
assert.match(catalogueBuilder, /"mrp", "selling_price", "approx_weight_g"/);
assert.match(css, /@media \(max-width: 520px\)/);
assert.match(sync, /id="product-detail"/);
assert.match(sync, /assets\/js\/product\/delivery-estimate\.js/);
assert.match(sync, /assets\/css\/delhivery-estimator\.css/);
assert.match(config, /\[functions\.delhivery-estimate\]/);
assert.match(config, /verify_jwt = false/);
assert.match(docs, /DELHIVERY_B2C_API_TOKEN/);
assert.match(docs, /₹45,000 free-shipping policy/);
assert.match(versions, /assets\/css/);

console.log("Delhivery estimator contract OK: PIN-only automatic estimates, catalogue-derived weights, COD default, server-side credentials, rate limits, and responsive product/cart UI.");
