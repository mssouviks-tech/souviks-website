#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const manifest=read("assets/data/gst-rate-candidate-overrides-2026-11-08.json");
const catalogue=read("assets/data/catalogue-index.json");
const products=read("assets/data/products.json");
if(manifest.schema_version!==1||manifest.record_count!==84||manifest.records.length!==84) {
 throw new Error("Unexpected GST rate candidate manifest version or coverage");
}
const byId=new Map(catalogue.map(p=>[String(p.id),p]));
const projected=new Map(products.map(p=>[String(p.id),p]));
if(byId.size!==1159||manifest.records.length!==84) throw new Error("GST candidate catalogue coverage mismatch");
const seen=new Set();
const counts={candidate_for_accountant_review:0,material_and_hsn_review:0,vehicle_use_exception_check:0};
for(const row of manifest.records) {
 const id=String(row.id||"");
 if(!id||seen.has(id)) throw new Error("Missing or duplicate GST candidate SKU "+id);
 seen.add(id);
 const product=byId.get(id);
 const c=row.gst_rate_candidate;
 if(!product) throw new Error("GST candidate SKU not found in catalogue "+id);
 if(product.hsn_code!==row.hsn_code||product.hsn_classification_status!=="classified"||product.hsn_confidence!=="high") {
  throw new Error("GST candidate is not tied to an unchanged classified/high HSN record "+id);
 }
 if(!c||c.total_rate_percent!==18||c.cgst_rate_percent!==9||c.sgst_rate_percent!==9||c.igst_rate_percent!==18) {
  throw new Error("Unexpected GST candidate rate "+id);
 }
 if(c.effective_from!=="2025-09-22"||c.invoice_ready!==false||c.accountant_approval_required!==true) {
  throw new Error("GST candidate was marked final/ready or has wrong effective date "+id);
 }
 if(!c.review_note||!Array.isArray(c.source_references)||c.source_references.length<2) {
  throw new Error("Missing GST source/review evidence "+id);
 }
 if(!Object.hasOwn(counts,c.status)) throw new Error("Unexpected GST candidate review status "+id);
 counts[c.status]++;
 if(Object.hasOwn(product,"gst_rate_percent")&&String(product.gst_rate_percent||"").trim()) {
  throw new Error("Final GST rate was unexpectedly assigned "+id);
 }
 if(product.active) {
  const projection=projected.get(id);
  if(!projection||JSON.stringify(projection.gst_rate_candidate)!==JSON.stringify(c)) {
   throw new Error("Active product GST candidate projection mismatch "+id);
  }
 }
}
if(counts.candidate_for_accountant_review!==75||counts.material_and_hsn_review!==5||counts.vehicle_use_exception_check!==4) {
 throw new Error("Unexpected GST candidate review totals "+JSON.stringify(counts));
}
for(const product of catalogue) {
 if(!seen.has(String(product.id))&&product.gst_rate_candidate) {
  throw new Error("GST candidate was assigned outside the classified/high tranche "+product.id);
 }
}
console.log("GST rate candidate contract passed",{
 catalogue_records:catalogue.length,
 active_products:products.length,
 candidate_records:manifest.record_count,
 candidate_rate_percent:18,
 review_status_counts:counts,
 final_invoice_rate_fields:"untouched",
 invoice_ready:false
});
