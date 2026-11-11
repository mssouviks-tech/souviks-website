#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const zlib = require("node:zlib");
const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync("assets/data/hsn-stock-reference-crosswalk-2026-11-10.json.gz")).toString("utf8"));
const catalogue = JSON.parse(fs.readFileSync("assets/data/catalogue-index.json", "utf8"));
const products = JSON.parse(fs.readFileSync("assets/data/products.json", "utf8"));
const byId = new Map(catalogue.map((p) => [String(p.id), p]));
const publicById = new Map(products.map((p) => [String(p.id), p]));
const activeIds = new Set(catalogue.filter((p) => p.active !== false).map((p) => String(p.id)));
assert.equal(publicById.size, products.length, "duplicate product IDs in public projection");
assert.deepEqual(
  [...publicById.keys()].sort(),
  [...activeIds].sort(),
  "public product projection must contain exactly active catalogue products"
);
assert.equal(manifest.schema_version, 1);
assert.equal(manifest.source_record_count, 1034);
assert.equal(manifest.unique_website_product_count, 796);
assert.equal(manifest.conflict_website_product_count, 22);
assert.equal(manifest.unmapped_source_record_count, 162);
assert.equal(manifest.records.length, 796);
assert.equal(manifest.conflicts.length, 22);
const mappedIds = new Set();
let uniqueSourceRows = 0;
for (const record of manifest.records) {
  assert.ok(Array.isArray(record) && record.length === 3);
  const [id, code, sourceCount] = record;
  assert.ok(!mappedIds.has(id), `duplicate unique source SKU ${id}`);
  assert.ok(/^SVKS\d{6}$/.test(id), `invalid website SKU ${id}`);
  assert.ok(/^\d{6,8}$/.test(code), `invalid HSN code ${code}`);
  assert.ok(Number.isInteger(sourceCount) && sourceCount >= 1);
  mappedIds.add(id);
  uniqueSourceRows += sourceCount;
  const product = byId.get(id);
  const projected = publicById.get(id);
  assert.ok(product, `missing mapped catalogue SKU ${id}`);
  if (product.active !== false) {
    assert.ok(projected, `missing active public projection for mapped SKU ${id}`);
    for (const field of ["hsn_stock_reference_code","hsn_stock_reference_status","hsn_stock_reference_alignment","hsn_stock_reference_record_count","hsn_stock_reference_date"]) {
      assert.equal(projected[field], product[field], `projection mismatch ${id} ${field}`);
    }
    assert.deepEqual(projected.hsn_stock_reference_codes, product.hsn_stock_reference_codes);
    assert.deepEqual(projected.hsn_stock_reference_source_files, product.hsn_stock_reference_source_files);
  } else {
    assert.equal(projected, undefined, `inactive mapped SKU must not be publicly projected ${id}`);
  }
  assert.equal(product.hsn_stock_reference_code, code);
  assert.equal(product.hsn_stock_reference_record_count, sourceCount);
  assert.equal(product.hsn_stock_reference_status, "unique_consistent");
  assert.ok(["agrees", "differs", "not_compared"].includes(product.hsn_stock_reference_alignment));
  assert.ok(product.hsn_code, `catalogue HSN candidate unexpectedly blank ${id}`);
  assert.ok(product.gst_rate_percent === 5 || product.gst_rate_percent === 18, `missing GST candidate ${id}`);
  assert.equal(product.gst_rate_candidate?.invoice_ready, true, `existing GST candidate should retain accountant approval ${id}`);
  assert.equal(product.gst_rate_candidate?.accountant_approval_required, false, `existing GST candidate should not require repeat accountant approval ${id}`);
}
assert.equal(uniqueSourceRows, 828);
let conflictSourceRows = 0;
for (const record of manifest.conflicts) {
  assert.ok(Array.isArray(record) && record.length === 3);
  const [id, codes, sourceCount] = record;
  assert.ok(!mappedIds.has(id), `overlapping unique/conflict SKU ${id}`);
  assert.ok(/^SVKS\d{6}$/.test(id));
  assert.ok(Array.isArray(codes) && codes.length >= 2);
  assert.ok(codes.every((code) => /^\d{6,8}$/.test(code)));
  assert.ok(Number.isInteger(sourceCount) && sourceCount >= 2);
  mappedIds.add(id);
  conflictSourceRows += sourceCount;
  const product = byId.get(id);
  const projected = publicById.get(id);
  assert.ok(product, `missing conflict catalogue SKU ${id}`);
  if (product.active !== false) {
    assert.ok(projected, `missing active public projection for conflict SKU ${id}`);
    assert.equal(projected.hsn_stock_reference_code, "");
    assert.deepEqual(projected.hsn_stock_reference_codes, product.hsn_stock_reference_codes);
  } else {
    assert.equal(projected, undefined, `inactive conflict SKU must not be publicly projected ${id}`);
  }
  assert.equal(product.hsn_stock_reference_code, "");
  assert.deepEqual(product.hsn_stock_reference_codes, [...codes].sort());
  assert.equal(product.hsn_stock_reference_status, "conflict");
  assert.equal(product.hsn_stock_reference_alignment, "conflicting_source_codes");
  assert.equal(product.gst_rate_candidate?.invoice_ready, true, `existing GST candidate should retain accountant approval ${id}`);
  assert.equal(product.gst_rate_candidate?.accountant_approval_required, false, `existing GST candidate should not require repeat accountant approval ${id}`);
}
assert.equal(conflictSourceRows, 44);
assert.equal(uniqueSourceRows + conflictSourceRows + manifest.unmapped_source_record_count, manifest.source_record_count);
assert.equal(catalogue.filter((p) => p.hsn_stock_reference_status === "unique_consistent").length, 796);
assert.equal(catalogue.filter((p) => p.hsn_stock_reference_status === "conflict").length, 22);
assert.equal(catalogue.filter((p) => p.hsn_stock_reference_status === "not_in_source").length, 357);
for (const productId of Array.from({ length: 16 }, (_, index) => `SVKS${String(1161 + index).padStart(6, "0")}`)) {
  const product = byId.get(productId);
  assert.ok(product, `missing new catalogue SKU ${productId}`);
  assert.equal(product.hsn_stock_reference_code, "");
  assert.deepEqual(product.hsn_stock_reference_codes, []);
  assert.equal(product.hsn_stock_reference_status, "not_in_source");
  assert.equal(product.hsn_stock_reference_alignment, "not_in_source");
  assert.equal(product.hsn_stock_reference_record_count, 0);
  assert.ok(
    ["provisional", "review_required"].includes(product.hsn_classification_status),
    `new SKU must retain its separate HSN classification status ${productId}`
  );
  assert.equal(product.gst_rate_candidate?.invoice_ready, true, `new SKU GST rate must be approved ${productId}`);
  assert.equal(product.gst_rate_candidate?.accountant_approval_required, false, `new SKU must not remain pending accountant GST approval ${productId}`);
  assert.equal(product.gst_rate_candidate?.accountant_approval_status, "approved", `new SKU accountant GST approval status mismatch ${productId}`);
}
console.log("Odoo stock HSN crosswalk passed", {
  catalogue_records: catalogue.length, public_products: products.length,
  unique_website_hsn_references: 796, conflicting_website_skus: 22,
  not_in_source_website_products: 357, mapped_stock_source_rows: uniqueSourceRows,
  conflict_stock_source_rows: conflictSourceRows, unmapped_stock_source_rows: 162,
  stock_reference_mapped_or_conflict_skus: mappedIds.size,
  newly_added_skus_gst_approved: 16
});
