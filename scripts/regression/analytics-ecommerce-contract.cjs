#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const pathModule = require("node:path");
const vm = require("node:vm");

const ROOT = pathModule.resolve(__dirname, "../..");
const attributionPath = pathModule.join(ROOT, "assets/js/attribution.js");
const attribution = fs.readFileSync(attributionPath, "utf8");
const helperStart = attribution.indexOf("const approvedEcommerceRate=");
const helperEnd = attribution.indexOf("\nwindow.SouviksAttribution=", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "GST-aware ecommerce payload helper must exist");

const emitted = [];
const windowStub = {
  souviksAnalytics: {
    trackEvent(name, params) {
      emitted.push({ name, params });
    }
  }
};
const clean = (value, max = 120) => String(value ?? "")
  .replace(/https?:\/\/\S+/gi, "")
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/[<>]/g, "")
  .trim()
  .slice(0, max);

vm.runInNewContext(attribution.slice(helperStart, helperEnd), {
  window: windowStub,
  clean,
  Number,
  String,
  Array,
  Math,
  Object
}, { filename: "ga4-ecommerce-helper.js", timeout: 1000 });

const ecommerce = windowStub.SouviksEcommerceAnalytics;
assert.ok(ecommerce, "shared ecommerce analytics API must be exported");

const approved18 = {
  id: "SVKS000001",
  product_name: "Brake Valve",
  brand_name: "BharatBenz",
  category_name: "Brake Components",
  subcategory_name: "Valves",
  selling_price: 118,
  gst_rate_percent: 18,
  gst_rate_candidate_approved: true
};
const approved5 = {
  id: "SVKS000002",
  product_name: "Tractor Clutch Component",
  brand_name: "Souviks",
  selling_price: 105,
  gst_rate_percent: 5,
  gst_rate_candidate: {
    invoice_ready: true,
    accountant_approval_required: false,
    accountant_approval_status: "approved"
  }
};

const basket = ecommerce.buildPayload([
  { product: approved18, quantity: 2 },
  { product: approved5, quantity: 1 }
], { includeValue: true, includeTax: true });

assert.equal(basket.financialsComplete, true);
assert.equal(basket.grossValue, 341);
assert.equal(basket.netValue, 300);
assert.equal(basket.taxValue, 41);
assert.equal(basket.params.currency, "INR");
assert.equal(basket.params.value, 300, "GA4 value must exclude GST");
assert.equal(basket.params.tax, 41, "GST must be reported separately");
assert.equal(basket.params.items.length, 2);
assert.equal(basket.params.items[0].item_id, "SVKS000001");
assert.equal(basket.params.items[0].quantity, 2);
assert.equal(basket.params.items[0].price, 100);
assert.equal(basket.params.items[1].price, 100);

const pending = ecommerce.buildPayload([{
  product: {
    id: "SVKS000003",
    product_name: "Pending GST Product",
    selling_price: 118,
    gst_rate_percent: 18,
    gst_rate_candidate: {
      invoice_ready: false,
      accountant_approval_required: true,
      accountant_approval_status: "pending"
    }
  },
  quantity: 1
}], { includeValue: true, includeTax: true });
assert.equal(pending.financialsComplete, false);
assert.equal(Object.hasOwn(pending.params, "value"), false,
  "unapproved GST metadata must not create a financial value");
assert.equal(Object.hasOwn(pending.params.items[0], "price"), false,
  "unapproved GST metadata must not invent a tax-exclusive item price");

const listEvent = ecommerce.buildPayload([
  { product: approved18, quantity: 1, index: 0 }
], {
  includeValue: false,
  listId: "product_catalogue",
  listName: "Product catalogue"
});
assert.equal(Object.hasOwn(listEvent.params, "value"), false);
assert.equal(listEvent.params.items[0].item_list_id, "product_catalogue");
assert.equal(listEvent.params.items[0].item_list_name, "Product catalogue");
assert.equal(listEvent.params.items[0].index, 0);

ecommerce.track("add_to_cart", [{ product: approved18, quantity: 1 }], { includeValue: true });
assert.equal(emitted.length, 1);
assert.equal(emitted[0].name, "add_to_cart");
assert.equal(emitted[0].params.value, 100);

const cart = fs.readFileSync(path.join(ROOT, "assets/js/source/cart/cart.js"), "utf8");
const productModule = fs.readFileSync(path.join(ROOT, "assets/js/product/products.js"), "utf8");
const listingModule = fs.readFileSync(path.join(ROOT, "assets/js/products/products-page.js"), "utf8");
const catalogueBuilder = fs.readFileSync(path.join(ROOT, "scripts/catalogue/build.py"), "utf8");

for (const eventName of [
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "add_shipping_info",
  "purchase"
]) {
  assert.ok(cart.includes('"' + eventName + '"'),
    "cart module must instrument " + eventName);
}
assert.match(productModule, /"view_item"/, "PDP must emit view_item");
assert.match(listingModule, /"view_item_list"/, "catalogue must emit view_item_list");
assert.match(cart, /"select_item"/, "catalogue selection must emit select_item");
assert.match(cart, /data\.payment_status === "paid"[\s\S]*?trackVerifiedPurchase/,
  "purchase must be emitted only after server-verified paid status");
assert.match(catalogueBuilder, /data\["gst_rate_percent"\] = product\.get\("gst_rate_percent"\)/);
assert.match(catalogueBuilder, /data\["gst_rate_candidate_approved"\]/,
  "PDP projection must expose the server-approved GST flag");
assert.match(cart, /GA4_PURCHASE_SENT_PREFIX/,
  "purchase event must be guarded against duplicate returns");
assert.ok(!cart.includes('window.souviksAnalytics?.trackEvent?.("purchase", {'),
  "purchase must not report a legacy GST-inclusive gross payload");

console.log("[GA4 ecommerce contract] PASS — item payloads, GST-exclusive value, separate tax, approval guard, product/list/cart funnel and verified purchase are covered.");
