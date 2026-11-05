#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const builder = read("scripts/catalogue/build.py");
const catalogueProjection = builder.slice(
  builder.indexOf("def product_from_catalogue"),
  builder.indexOf("def search_from_catalogue"),
);
const productRuntime = read("assets/js/product/products.js");
const productsRuntime = read("assets/js/products/products.js");
const checkout = read("supabase/functions/cashfree-create-order/index.ts");
const accountOrders = read("supabase/functions/account-orders/index.ts");
const accountUi = read("assets/js/account/auth-orders.js");
const migration = read("supabase/migrations/20261105102932_order_item_hsn_snapshot.sql");

for (const field of [
  "hsn_code",
  "hsn_description",
  "hsn_confidence",
  "hsn_classification_status",
  "hsn_basis",
  "hsn_review_note",
  "hsn_reference_date",
]) {
  assert.ok(catalogueProjection.includes('"'+field+'"'), "Catalogue projection must include "+field);
}
assert.match(
  catalogueProjection,
  /"mrp": p\.get\("mrp"\),\s*"selling_price": p\.get\("selling_price"\),\s*"approx_weight_g": approximate_weight_grams\(p\)/,
  "HSN additions must not break the existing price/weight projection contract",
);
assert.match(builder, /hsn_is_confirmed/);
assert.match(builder, /hsn_classification_status/);
assert.match(builder, /hsn_confidence/);
assert.match(builder, /Could not add the confirmed HSN row/);
for (const [name, source] of [["product runtime", productRuntime], ["products runtime", productsRuntime]]) {
  assert.match(source, /hsn_classification_status/);
  assert.match(source, /hsn_confidence/);
  assert.match(source, /Breadcrumb\.escape\(product\.hsn_code\)/);
  assert.match(source, /HSN Code/);
}
assert.match(checkout, /fetchCatalogue\(config\)/);
assert.match(checkout, /hsn_code: clean\(product\.hsn_code, 8\)/);
assert.match(checkout, /hsn_description: clean\(product\.hsn_description, 300\)/);
assert.match(checkout, /hsn_classification_status: clean\(product\.hsn_classification_status, 32\)/);
assert.match(checkout, /hsn_confidence: clean\(product\.hsn_confidence, 16\)/);
assert.match(accountOrders, /hsn_code,hsn_description,hsn_classification_status,hsn_confidence/);
assert.match(accountOrders, /hsn_code: item\.hsn_code/);
assert.match(accountOrders, /hsn_classification_status: item\.hsn_classification_status/);
assert.match(accountUi, /hsn_classification_status === "classified"/);
assert.match(accountUi, /hsn_confidence === "high"/);
assert.match(accountUi, /hsnCode/);
for (const column of ["hsn_code", "hsn_description", "hsn_classification_status", "hsn_confidence"]) {
  assert.match(migration, new RegExp("add column if not exists "+column));
}
console.log("HSN ecommerce contract OK: catalogue projection, confidence-gated PDP display, server-side checkout snapshots, and authenticated order-history output.");
