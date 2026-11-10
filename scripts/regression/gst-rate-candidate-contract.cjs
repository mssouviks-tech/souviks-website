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
if(manifest.accountant_approval?.status!=="approved"||manifest.accountant_approval?.approved_on!=="2026-11-10"||policy.accountant_approval?.status!=="approved") throw new Error("Missing accountant approval record");
const byId=new Map(catalogue.map(p=>[String(p.id),p]));
const projected=new Map(products.map(p=>[String(p.id),p]));
if(byId.size!==1159||products.length!==1157) throw new Error("Unexpected catalogue/projection coverage");
const exceptions=new Map(policy.tractor_exceptions.map(x=>[String(x.id),x]));
const general=new Map(policy.resolved_general_rate_products.map(x=>[String(x.id),x]));
const tractorGeneral=new Map(policy.tractor_general_rate_review.map(x=>[String(x.id),x]));
if(exceptions.size!==1||!exceptions.has("SVKS000429")) throw new Error("Unexpected 5% exception coverage");
if(!tractorGeneral.has("SVKS001121")) throw new Error("Steering repair-kit 18% boundary review missing");
const seen=new Set(),statusCounts={candidate_for_accountant_review:0,material_and_hsn_review:0,vehicle_use_exception_check:0};
let standard18=0,exception5=0;
for(const row of manifest.records){
 const id=String(row.id||""),p=byId.get(id),c=p?.gst_rate_candidate;
 if(!id||seen.has(id)||!p||!c) throw new Error("Missing/duplicate/unknown GST SKU "+id);
 seen.add(id);
 if(row.hsn_code&&p.hsn_code!==row.hsn_code) throw new Error("GST overlay altered HSN mapping "+id);
 const exception=exceptions.get(id),rate=exception?5:18,half=rate/2;
 if(p.gst_rate_percent!==rate||p.gst_cgst_rate_percent!==half||p.gst_sgst_rate_percent!==half||p.gst_igst_rate_percent!==rate) throw new Error("Top-level GST rate/split mismatch "+id);
 if(p.gst_rate_effective_from!==policy.effective_from||!p.gst_rate_source_reference||!p.gst_rate_basis) throw new Error("Missing GST rate traceability "+id);
 if(c.total_rate_percent!==rate||c.cgst_rate_percent!==half||c.sgst_rate_percent!==half||c.igst_rate_percent!==rate) throw new Error("GST candidate/final rate parity mismatch "+id);
 if(c.effective_from!==policy.effective_from||c.invoice_ready!==true||c.accountant_approval_required!==false||c.accountant_approval_status!=="approved") throw new Error("GST accountant approval/invoice-readiness mismatch "+id);
 if(!c.review_note||!Array.isArray(c.source_references)||c.source_references.length<2) throw new Error("Missing GST evidence "+id);
 if(!Object.hasOwn(statusCounts,c.status)) throw new Error("Unexpected GST candidate status "+id);
 statusCounts[c.status]++;
 if(exception){
  exception5++;
  if(p.hsn_code!==exception.hsn_code||String(p.name||p.product_name)!==exception.product_name||!p.vehicles?.some(v=>/tractor/i.test(v))) throw new Error("5% tractor product evidence mismatch "+id);
 } else standard18++;
 if(p.active){
  const q=projected.get(id);
  if(!q||q.gst_rate_percent!==rate||q.gst_cgst_rate_percent!==half||q.gst_sgst_rate_percent!==half||q.gst_igst_rate_percent!==rate||q.gst_rate_effective_from!==p.gst_rate_effective_from||q.gst_rate_source_reference!==p.gst_rate_source_reference||q.gst_rate_basis!==p.gst_rate_basis||JSON.stringify(q.gst_rate_candidate)!==JSON.stringify(c)) throw new Error("Public product projection mismatch "+id);
 }
}
if(seen.size!==catalogue.length||standard18!==1158||exception5!==1) throw new Error("Incomplete/incorrect GST rate distribution");
for(const id of ["SVKS000060","SVKS000108","SVKS000110","SVKS000111"]){const p=byId.get(id);if(!p||p.gst_rate_percent!==18||p.gst_rate_candidate.status!=="candidate_for_accountant_review")throw new Error("Tata Ace/Intra brake product not resolved to 18% "+id);}
for(const id of ["SVKS000258","SVKS000268"]){const p=byId.get(id);if(!p||p.gst_rate_percent!==18)throw new Error("Starter-drive component incorrectly treated as tractor clutch assembly "+id);}
const steering=byId.get("SVKS001121");
if(steering.gst_rate_percent!==18||!steering.gst_rate_candidate.review_note.includes("steering"))throw new Error("Steering repair kit must stay at 18% pending precise exception match");
const pressure=byId.get("SVKS000429");
if(pressure.gst_rate_percent!==5||pressure.gst_cgst_rate_percent!==2.5||pressure.gst_sgst_rate_percent!==2.5||pressure.gst_igst_rate_percent!==5)throw new Error("Tractor pressure plate 5% rate mismatch");
console.log("GST rate and accountant-approval contract passed",{catalogue_records:catalogue.length,active_products:products.length,rate_18_count:standard18,rate_5_count:exception5,invoice_ready:true,accountant_approval_required:false,status_counts:statusCounts});
