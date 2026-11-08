#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const manifest=read("assets/data/gst-rate-candidate-overrides-2026-11-08.json");
const catalogue=read("assets/data/catalogue-index.json");
const products=read("assets/data/products.json");
if(manifest.schema_version!==2||manifest.record_count!==catalogue.length||manifest.records.length!==catalogue.length) throw new Error("GST manifest must cover entire catalogue");
const byId=new Map(catalogue.map(p=>[String(p.id),p]));
const projected=new Map(products.map(p=>[String(p.id),p]));
if(byId.size!==1159||products.length!==1157) throw new Error("Unexpected catalogue/projection coverage");
const seen=new Set(),counts={candidate_for_accountant_review:0,material_and_hsn_review:0,vehicle_use_exception_check:0};
for(const row of manifest.records){
 const id=String(row.id||""),c=row.gst_rate_candidate,p=byId.get(id);
 if(!id||seen.has(id)||!p) throw new Error("Missing/duplicate/unknown GST SKU "+id);
 seen.add(id);
 if(row.hsn_code&&p.hsn_code!==row.hsn_code) throw new Error("GST overlay altered HSN mapping "+id);
 if(!c||![5,18].includes(c.total_rate_percent)) throw new Error("Invalid candidate rate "+id);
 const split=c.total_rate_percent===18?9:2.5;
 if(c.cgst_rate_percent!==split||c.sgst_rate_percent!==split||c.igst_rate_percent!==c.total_rate_percent) throw new Error("Invalid GST split "+id);
 if(c.effective_from!=="2025-09-22"||c.invoice_ready!==false||c.accountant_approval_required!==true) throw new Error("Candidate must remain non-final "+id);
 if(!c.review_note||!Array.isArray(c.source_references)||c.source_references.length<2) throw new Error("Missing GST source evidence "+id);
 if(!Object.hasOwn(counts,c.status)) throw new Error("Unexpected review status "+id);
 counts[c.status]++;
 if(String(p.gst_rate_percent||"").trim()) throw new Error("Final GST rate was assigned "+id);
 if(p.active){const q=projected.get(id);if(!q||JSON.stringify(q.gst_rate_candidate)!==JSON.stringify(c))throw new Error("Public projection mismatch "+id);}
}
if(seen.size!==catalogue.length) throw new Error("Incomplete GST coverage");
console.log("GST candidate contract passed",{catalogue_records:catalogue.length,active_products:products.length,candidate_records:manifest.record_count,default_rate_percent:18,review_status_counts:counts,final_invoice_rate_fields:"untouched",invoice_ready:false});
