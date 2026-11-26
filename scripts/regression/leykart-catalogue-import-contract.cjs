#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

const catalogue = read("assets/data/catalogue-index.json");
const products = read("assets/data/products.json");
const brands = read("assets/data/brands.json");
const gstManifest = read("assets/data/gst-rate-candidate-overrides-2026-11-08.json");
const gstPolicy = read("assets/data/gst-rate-final-policy-2026-11-08.json");
const byId = new Map(catalogue.map(product => [String(product.id), product]));
const projected = new Map(products.map(product => [String(product.id), product]));

const NEW_COUNT = 1496;
const FIRST_ID = 1177;
const lastId = FIRST_ID + NEW_COUNT - 1;
if (catalogue.length !== 2671 || byId.size !== catalogue.length) {
  throw new Error("Expected 2,671 unique canonical catalogue records");
}
if (products.length !== 2670 || projected.size !== products.length) {
  throw new Error("Expected 2,670 unique active product projections");
}
if (gstManifest.record_count !== catalogue.length || gstManifest.records.length !== catalogue.length ||
    (gstManifest.pending_records || []).length !== 0) {
  throw new Error("GST manifest must cover the expanded catalogue with no pending SKUs");
}
for (const approval of [gstManifest.accountant_approval, gstPolicy.accountant_approval]) {
  if (approval?.status !== "approved" || approval?.approved_on !== "2026-11-27" ||
      approval?.catalogue_product_count !== 2671) {
    throw new Error("GST readiness record does not cover all 2,671 catalogue products");
  }
}

const newProducts = [];
for (let number = FIRST_ID; number <= lastId; number++) {
  const id = "SVKS" + String(number).padStart(6, "0");
  const product = byId.get(id);
  if (!product || product.active === false) throw new Error("Missing active Leykart SKU " + id);
  newProducts.push(product);
  if (!/^\d{8}$/.test(String(product.hsn_code || "")) ||
      product.hsn_classification_status !== "classified" || product.hsn_confidence !== "high") {
    throw new Error("Leykart HSN must be user-verified and high-confidence: " + id);
  }
  if (product.hsn_description) throw new Error("Do not infer an official HSN tariff description: " + id);
  const gst = product.gst_rate_candidate || {};
  if (product.gst_rate_percent !== 18 || product.gst_cgst_rate_percent !== 9 ||
      product.gst_sgst_rate_percent !== 9 || product.gst_igst_rate_percent !== 18 ||
      gst.total_rate_percent !== 18 || gst.cgst_rate_percent !== 9 ||
      gst.sgst_rate_percent !== 9 || gst.igst_rate_percent !== 18 ||
      gst.invoice_ready !== true || gst.accountant_approval_required !== false ||
      gst.accountant_approval_status !== "approved") {
    throw new Error("Leykart GST readiness/rate mismatch: " + id);
  }
  if (!product.hsn_dpiit_mapping || product.hsn_dpiit_mapping.catalogue_hsn?.code !== product.hsn_code) {
    throw new Error("Leykart HSN public mapping is missing or stale: " + id);
  }
  const publicProduct = projected.get(id);
  if (!publicProduct) throw new Error("Active Leykart SKU missing from products.json: " + id);
  for (const field of ["hsn_code", "hsn_confidence", "hsn_classification_status", "gst_rate_percent", "gst_rate_candidate"]) {
    if (JSON.stringify(publicProduct[field] ?? null) !== JSON.stringify(product[field] ?? null)) {
      throw new Error("Public projection drift for Leykart SKU " + id + ": " + field);
    }
  }
}

const valueparts = newProducts.filter(product => product.brand_id === "valueparts");
if (valueparts.length !== 5 || !brands.some(brand => brand.id === "valueparts" && brand.active !== false)) {
  throw new Error("Valueparts must be represented as an active brand with all five new SKUs");
}
for (const [id, expected] of Object.entries({
  SVKS000299: { mrp: 903, selling_price: 857.85, discount_percent: 5, hsn_code: "84212300", leykart_hsn_reconciliation_status: "agrees" },
  SVKS000759: { mrp: 701, selling_price: 644.92, discount_percent: 8, hsn_code: "73209020", leykart_hsn_reconciliation_status: "conflict_existing_hsn_preserved" },
  SVKS000760: { mrp: 880, selling_price: 809.6, discount_percent: 8, hsn_code: "73209020", leykart_hsn_reconciliation_status: "conflict_existing_hsn_preserved" },
})) {
  const product = byId.get(id);
  if (!product) throw new Error("Missing exact matched Leykart record " + id);
  for (const [field, value] of Object.entries(expected)) {
    if (product[field] !== value) throw new Error("Matched SKU update mismatch " + id + " " + field);
  }
}

console.log("Leykart catalogue import contract passed", {
  catalogue_records: catalogue.length,
  active_product_projection: products.length,
  new_leykart_skus: newProducts.length,
  user_verified_hsn: newProducts.length,
  gst_invoice_ready: newProducts.length,
  valueparts_skus: valueparts.length,
  exact_existing_matches_updated: 3,
});
