#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const manifest=read("assets/data/gst-rate-candidate-overrides-2026-11-08.json");
const policy=read("assets/data/gst-rate-final-policy-2026-11-08.json");
const catalogue=read("assets/data/catalogue-index.json");
const products=read("assets/data/products.json");
if(manifest.schema_version!==2||manifest.record_count!==catalogue.length||manifest.records.length!==catalogue.length) throw new Error("GST candidate manifest must cover the entire catalogue");
if(policy.schema_version!==1||policy.default_rate_percent!==18||policy.effective_from!=="2025-09-22") throw new Error("Invalid final GST policy");
const byId=new Map(catalogue.map(p=>[String(p.id),p]));
const projected=new Map(products.map(p=>[String(p.id),p]));
if(byId.size!==1159||products.length!==1157) throw new Error("Unexpected catalogue/projection coverage");
const exceptions=new Map(policy.tractor_exceptions.map(x=>[String(x.id),x]));
const resolutions=new Map(policy.resolved_general_rate_products.map(x=>[String(x.id),x]));
if(exceptions.size!==2||!exceptions.has("SVKS000429")||!exceptions.has("SVKS001121")) throw new Error("Unexpected 5% tractor exception coverage");
const seen=new Set(),statusCounts={candidate_for_accountant_review:0,material_and_hsn_review:0,vehicle_use_exception_check:0};
let defaultRateCount=0,exceptionRateCount=0;
for(const row of manifest.records){
 const id=String(row.id||""),p=byId.get(id),c=p?.gst_rate_candidate;
 if(!id||seen.has(id)||!p||!c) throw new Error("Missing/duplicate/unknown GST SKU "+id);
 seen.add(id);
 if(row.hsn_code&&p.hsn_code!==row.hsn_code) throw new Error("GST overlay altered HSN mapping "+id);
 const exception=exceptions.get(id),expectedRate=exception?5:18;
 const half=expectedRate/2;
 if(p.gst_rate_percent!==expectedRate) throw new Error("Final gst_rate_percent mismatch for "+id);
 if(p.gst_rate_effective_from!==policy.effective_from||!p.gst_rate_source_reference||!p.gst_rate_basis) throw new Error("Missing final GST rate traceability "+id);
 if(c.total_rate_percent!==expectedRate||c.cgst_rate_percent!==half||c.sgst_rate_percent!==half||c.igst_rate_percent!==expectedRate) throw new Error("GST candidate/final rate parity mismatch "+id);
 if(c.effective_from!==policy.effective_from||c.invoice_ready!==false||c.accountant_approval_required!==true) throw new Error("GST invoice safety fields changed "+id);
 if(!c.review_note||!Array.isArray(c.source_references)||c.source_references.length<2) throw new Error("Missing GST evidence "+id);
 if(!Object.hasOwn(statusCounts,c.status)) throw new Error("Unexpected candidate review status "+id);
 statusCounts[c.status]++;
 if(exception){
  exceptionRateCount++;
  if(p.hsn_code!==exception.hsn_code||String(p.name||p.product_name)!==exception.product_name) throw new Error("Tractor exception identity/HSN mismatch "+id);
  if(!p.vehicles?.some(v=>/tractor/i.test(v))) throw new Error("Tractor exception lacks tractor fitment "+id);
 } else defaultRateCount++;
 if(p.active){
  const q=projected.get(id);
  if(!q||q.gst_rate_percent!==expectedRate||q.gst_rate_effective_from!==p.gst_rate_effective_from||q.gst_rate_source_reference!==p.gst_rate_source_reference||q.gst_rate_basis!==p.gst_rate_basis||JSON.stringify(q.gst_rate_candidate)!==JSON.stringify(c)) throw new Error("Public product projection mismatch "+id);
 }
}
if(seen.size!==catalogue.length||defaultRateCount!==1157||exceptionRateCount!==2) throw new Error("Incomplete/incorrect GST rate coverage");
for(const id of ["SVKS000060","SVKS000108","SVKS000110","SVKS000111"]){
 const p=byId.get(id);
 if(!p||p.gst_rate_percent!==18||p.gst_rate_candidate.status!=="candidate_for_accountant_review") throw new Error("Tata Ace/Intra brake part incorrectly treated as tractor exception "+id);
}
for(const id of ["SVKS000258","SVKS000268"]){
 const p=byId.get(id);
 if(!p||p.gst_rate_percent!==18) throw new Error("Starter overrunning-clutch product incorrectly treated as tractor transmission clutch "+id);
}
for(const product of catalogue) if(!seen.has(String(product.id))) throw new Error("Missing GST product rate "+product.id);
console.log("GST final-rate contract passed",{catalogue_records:catalogue.length,active_products:products.length,default_rate_percent:18,default_rate_count:defaultRateCount,tractor_exception_rate_percent:5,tractor_exception_count:exceptionRateCount,review_status_counts:statusCounts,invoice_ready:false});
