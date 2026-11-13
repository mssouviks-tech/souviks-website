#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const manifest=read("assets/data/hsn-candidate-overrides-2026-11-06.json");
const catalogue=read("assets/data/catalogue-index.json");
const products=read("assets/data/products.json");
const expectedFields=[
 "hsn_code","hsn_description","hsn_confidence","hsn_classification_status",
 "hsn_basis","hsn_review_note","hsn_reference_date","hsn_research_source","hsn_research_date"
];
if(manifest.schema_version!==1||manifest.record_count!==28||manifest.records.length!==28) {
 throw new Error("Unexpected product-level HSN override manifest version or coverage");
}
const source=manifest.source_research_pr;
const researchDate=manifest.research_date;
const overrides=new Map();
for(const row of manifest.records) {
 if(!row.id||overrides.has(String(row.id))) throw new Error("Missing/duplicate HSN override ID "+row.id);
 overrides.set(String(row.id),row);
}
const byId=new Map(catalogue.map(p=>[String(p.id),p]));
const projected=new Map(products.map(p=>[String(p.id),p]));
if(byId.size!==catalogue.length||byId.size<manifest.catalogue_reviewed_record_count||overrides.size!==manifest.record_count) {
 throw new Error("HSN correction manifest/canonical catalogue coverage mismatch");
}
const statusCounts={classified:0,provisional:0,review_required:0};
for(const [id,row] of overrides) {
 const product=byId.get(id);
 if(!product) throw new Error("HSN override points to unknown SKU "+id);
 if(!/^\d{8}$/.test(String(row.hsn_code||""))) throw new Error("Invalid candidate code "+id);
 if(!["high","medium","low"].includes(row.hsn_confidence)) throw new Error("Invalid HSN confidence "+id);
 if(!Object.hasOwn(statusCounts,row.hsn_classification_status)) throw new Error("Invalid HSN status "+id);
 if(!row.hsn_description||!row.hsn_basis) throw new Error("Missing HSN description/basis "+id);
 if(row.hsn_classification_status==="review_required"&&!row.hsn_review_note) throw new Error("Missing review note "+id);
 statusCounts[row.hsn_classification_status]++;
 for(const field of ["hsn_code","hsn_description","hsn_confidence","hsn_classification_status","hsn_basis","hsn_review_note","hsn_reference_date"]) {
  if(String(product[field]??"")!==String(row[field]??"")) throw new Error("Canonical HSN override mismatch "+id+" "+field);
 }
 if(product.hsn_research_source!==source||product.hsn_research_date!==researchDate) {
  throw new Error("Missing HSN research provenance "+id);
 }
 if(Object.hasOwn(row,"hsn_supplier_invoice_code")||Object.hasOwn(row,"hsn_dpiit_mapping")||Object.hasOwn(row,"gst_rate_percent")) {
  throw new Error("HSN candidate overlay contains unrelated supplier/DPIIT/GST fields "+id);
 }
 if(product.active) {
  const p=projected.get(id);
  if(!p) throw new Error("Active product absent from public projection "+id);
  for(const field of expectedFields) {
   if(JSON.stringify(p[field]??null)!==JSON.stringify(product[field]??null)) {
    throw new Error("Public HSN projection mismatch "+id+" "+field);
   }
  }
 }
}
if(statusCounts.classified+statusCounts.provisional+statusCounts.review_required!==28) {
 throw new Error("HSN correction manifest includes an unexpected status count");
}
const resultingCounts={classified:0,provisional:0,review_required:0};
for(const product of catalogue) {
 if(Object.hasOwn(resultingCounts,product.hsn_classification_status)) resultingCounts[product.hsn_classification_status]++;
}
if(catalogue.length===manifest.catalogue_reviewed_record_count) {
 for(const [status,count] of Object.entries(resultingCounts)) {
  if(count!==manifest.resulting_catalogue_status_counts[status]) throw new Error("Resulting catalogue HSN total mismatch "+status);
 }
}
if(catalogue.some(p=>!p.hsn_dpiit_mapping||p.hsn_dpiit_mapping.catalogue_hsn?.code!==p.hsn_code)) {
 throw new Error("DPIIT mapping is missing or misaligned with the current catalogue HSN candidate");
}
console.log("Product-level HSN schema contract passed",{
 catalogue_records:catalogue.length,
 active_projection_records:products.length,
 status_counts:statusCounts,
 hsn_dpiit_mapping:"present",
 supplier_invoice_evidence:"separate"
});
