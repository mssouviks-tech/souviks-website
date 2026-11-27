#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const numericSku = id => Number(String(id).replace(/^SVKS/, ""));
const sortSku = (a, b) => numericSku(a) - numericSku(b);

const catalogue = read("assets/data/catalogue-index.json");
const products = read("assets/data/products.json");
const brands = read("assets/data/brands.json");
const categories = read("assets/data/categories.json");
const gstManifest = read("assets/data/gst-rate-candidate-overrides-2026-11-08.json");
const gstPolicy = read("assets/data/gst-rate-final-policy-2026-11-08.json");
const byId = new Map(catalogue.map(product => [String(product.id), product]));
const projected = new Map(products.map(product => [String(product.id), product]));

const SOURCE_NEW_COUNT = 1496;
const EXPECTED_IMAGE_BACKED_COUNT = 818;
const FIRST_ID = 1177;
const LAST_ID = 2672;
const productImageRoot = path.join(root, "assets/images/products");
const thumbnailRoot = path.join(root, "assets/images/product-thumbnails");
const imageBackedIds = fs.readdirSync(productImageRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^SVKS\d{6}$/.test(entry.name))
  .map(entry => entry.name)
  .filter(id => numericSku(id) >= FIRST_ID && numericSku(id) <= LAST_ID)
  .filter(id => fs.existsSync(path.join(productImageRoot, id, "1.webp")))
  .sort(sortSku);
const imageBackedSet = new Set(imageBackedIds);
const allSourceIds = Array.from({ length: SOURCE_NEW_COUNT }, (_, index) =>
  "SVKS" + String(FIRST_ID + index).padStart(6, "0")
);
const noImageIds = allSourceIds.filter(id => !imageBackedSet.has(id));

if (imageBackedIds.length !== EXPECTED_IMAGE_BACKED_COUNT || noImageIds.length !== 678) {
  throw new Error("Repository image coverage changed: expected 818 image-backed SKUs and 678 without images");
}
if (catalogue.length !== 1993 || byId.size !== catalogue.length) {
  throw new Error("Expected 1,993 unique canonical catalogue records");
}
if (products.length !== 1992 || projected.size !== products.length) {
  throw new Error("Expected 1,992 unique active product projections");
}
if (gstManifest.record_count !== catalogue.length || gstManifest.records.length !== catalogue.length ||
    (gstManifest.pending_records || []).length !== 0) {
  throw new Error("GST manifest must cover all catalogue records with no pending SKUs");
}
for (const approval of [gstManifest.accountant_approval, gstPolicy.accountant_approval]) {
  if (approval?.status !== "approved" || approval?.approved_on !== "2026-11-27" ||
      approval?.catalogue_product_count !== 1993) {
    throw new Error("GST readiness record does not cover all 1,993 catalogue products");
  }
}

const newProducts = catalogue
  .filter(product => numericSku(product.id) >= FIRST_ID && numericSku(product.id) <= LAST_ID)
  .sort((a, b) => sortSku(a.id, b.id));
if (newProducts.length !== EXPECTED_IMAGE_BACKED_COUNT ||
    JSON.stringify(newProducts.map(product => product.id)) !== JSON.stringify(imageBackedIds)) {
  throw new Error("Only the repository's image-backed Leykart SKUs may remain in the catalogue");
}

const categoriesById = new Map(categories.map(category => [String(category.id), category]));
for (const product of newProducts) {
  const id = product.id;
  const category = categoriesById.get(String(product.category_id || ""));
  if (!category) throw new Error("Missing or invalid category assignment for " + id);
  const subcategory = (category.subcategories || []).find(item =>
    String(item.id) === String(product.subcategory_id || "")
  );
  if (!subcategory) throw new Error("Missing or invalid subcategory assignment for " + id);
  if (product.category_name !== category.name || product.category !== category.name ||
      product.subcategory_name !== subcategory.name || product.subcategory !== subcategory.name) {
    throw new Error("Product taxonomy labels do not match the category master: " + id);
  }
  if (typeof product.description !== "string" || product.description.trim().length < 50) {
    throw new Error("Leykart product description is missing or too short: " + id);
  }
}
const displayName = product => String(product.product_name || product.name || "");
// Check full wiring-harness assemblies, not every product name that mentions
// a harness as an accessory or part of a pigtail/sensor description.
const wiringHarnessProducts = newProducts.filter(product =>
  /wiring harness|abs harness/i.test(displayName(product))
);
if (wiringHarnessProducts.some(product =>
  product.category_id !== "electricals" || product.subcategory_id !== "wire-harness"
)) {
  throw new Error("Wiring harness assemblies must map to Electricals / Wiring Harness");
}
// A brake switch supplied with a wire harness remains a brake switch; the
// accessory wording must not change the product's primary subsystem.
const brakeSwitchHarnessProducts = newProducts.filter(product =>
  /brake switch.*wire harness/i.test(displayName(product))
);
if (brakeSwitchHarnessProducts.some(product =>
  product.category_id !== "brakes" || product.subcategory_id !== "brake-switch"
)) {
  throw new Error("Brake switches supplied with a wire harness must remain Brakes / Brake Switch");
}
const absControlUnits = newProducts.filter(product =>
  /control unit/i.test(displayName(product)) && /abs|brake/i.test(displayName(product))
);
if (absControlUnits.some(product =>
  product.category_id !== "electricals" || product.subcategory_id !== "electronic-control-unit"
)) {
  throw new Error("ABS brake control units must map to Electricals / Electronic Control Unit");
}
const frontHubs = newProducts.filter(product =>
  /front hub|hub front axle/i.test(displayName(product))
);
if (frontHubs.some(product =>
  product.category_id !== "bearings" || product.subcategory_id !== "hub-units-wheel-bearings"
)) {
  throw new Error("Front wheel hubs must map to Bearings / Hub Units & Wheel Bearings");
}

const waterPumps = catalogue.filter(product =>
  /water\s+pump/i.test(displayName(product)) &&
  !/water\s+pump\s+bearings?/i.test(displayName(product))
);
const coolingSystem = categoriesById.get("cooling-system");
const waterPumpSubcategory = (coolingSystem?.subcategories || []).find(item =>
  item.id === "water-pump" && item.name === "Water Pump"
);
if (!waterPumpSubcategory || waterPumps.length === 0 || waterPumps.some(product =>
  product.category_id !== "cooling-system" ||
  product.category_name !== "Cooling System" ||
  product.category !== "Cooling System" ||
  product.subcategory_id !== "water-pump" ||
  product.subcategory_name !== "Water Pump" ||
  product.subcategory !== "Water Pump"
)) {
  throw new Error("Water pumps must map to Cooling System / Water Pump");
}
const canonicalKflWaterPump = byId.get("SVKS000748");
if (!canonicalKflWaterPump || canonicalKflWaterPump.category_id !== "cooling-system" ||
    canonicalKflWaterPump.subcategory_id !== "water-pump") {
  throw new Error("KFL KF427 Water Pump must map to Cooling System / Water Pump");
}
for (const id of noImageIds) {
  if (byId.has(id)) throw new Error("Image-less Leykart SKU was retained: " + id);
}

for (const product of newProducts) {
  const id = product.id;
  if (product.active !== true) throw new Error("Image-backed Leykart SKU must be active: " + id);
  const galleryDir = path.join(productImageRoot, id);
  const gallery = fs.readdirSync(galleryDir)
    .filter(name => /^\d+\.webp$/i.test(name))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  if (!gallery.length || !gallery.includes("1.webp")) {
    throw new Error("Missing full-resolution primary image for " + id);
  }
  if (!fs.existsSync(path.join(thumbnailRoot, id, "1.webp"))) {
    throw new Error("Missing product-card thumbnail for " + id);
  }
  if (product.image !== "1.webp" || product.primary_image !== "1.webp" ||
      product.image_folder !== id ||
      product.image_url !== `/assets/images/products/${id}/1.webp` ||
      product.card_image_url !== `/assets/images/product-thumbnails/${id}/1.webp` ||
      JSON.stringify(product.gallery) !== JSON.stringify(gallery)) {
    throw new Error("Catalogue image metadata does not match committed gallery files: " + id);
  }
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
  for (const field of [
    "image", "primary_image", "image_folder", "image_url", "card_image_url", "gallery",
    "hsn_code", "hsn_confidence", "hsn_classification_status", "gst_rate_percent", "gst_rate_candidate"
  ]) {
    if (JSON.stringify(publicProduct[field] ?? null) !== JSON.stringify(product[field] ?? null)) {
      throw new Error("Public projection drift for Leykart SKU " + id + ": " + field);
    }
  }
}

const valueparts = newProducts.filter(product => product.brand_id === "valueparts");
if (valueparts.length !== 5 || !brands.some(brand => brand.id === "valueparts" && brand.active !== false)) {
  throw new Error("Valueparts must be represented as an active brand with all five image-backed SKUs");
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
console.log("Image-backed Leykart catalogue import contract passed", {
  catalogue_records: catalogue.length,
  active_product_projection: products.length,
  source_new_skus: SOURCE_NEW_COUNT,
  retained_image_backed_skus: newProducts.length,
  removed_image_less_skus: noImageIds.length,
  user_verified_hsn: newProducts.length,
  gst_invoice_ready: newProducts.length,
  valueparts_skus: valueparts.length,
  water_pump_products: waterPumps.length,
  exact_existing_matches_updated: 3,
});
