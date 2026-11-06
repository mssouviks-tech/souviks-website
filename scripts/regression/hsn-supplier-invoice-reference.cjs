#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function parseCsv(input){
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<input.length;i++){const c=input[i],n=input[i+1];
  if(quoted){if(c==='"'&&n==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
  else if(c==='"')quoted=true;else if(c===','){row.push(field);field="";}
  else if(c==='\n'){row.push(field);rows.push(row);row=[];field="";}
  else if(c!=='\r')field+=c;
 }
 if(field.length||row.length){row.push(field);rows.push(row);}
 const headers=rows.shift();
 return rows.filter(r=>r.length&&r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
}
const catalogue=JSON.parse(read("assets/data/catalogue-index.json"));
const products=JSON.parse(read("assets/data/products.json"));
const matches=parseCsv(read("docs/audit/hsn-supplier-invoice-matches-2026-11-06.csv"));
const review=parseCsv(read("docs/audit/hsn-supplier-invoice-review-queue-2026-11-06.csv"));
const byId=new Map(catalogue.map(p=>[p.id,p]));
const projections=new Map(products.map(p=>[p.id,p]));
const matched=catalogue.filter(p=>p.hsn_supplier_invoice_match_status==="matched");
const conflicts=catalogue.filter(p=>p.hsn_supplier_invoice_match_status==="conflict");
if(catalogue.length!==1159||products.length!==1157)throw new Error("Unexpected catalogue/projection coverage");
if(matched.length!==842||conflicts.length!==15)throw new Error("Unexpected SKU totals");
if(matches.length!==901||review.length!==133||matches.length+review.length!==1034)throw new Error("Supplier source rows not fully accounted for");
for(const p of [...matched,...conflicts]){
 if(p.hsn_supplier_invoice_source_file!=="hsn.xlsx")throw new Error("Missing source file "+p.id);
 if(p.active){
  const q=projections.get(p.id);if(!q)throw new Error("Missing product projection "+p.id);
  for(const k of ["hsn_supplier_invoice_code","hsn_supplier_invoice_codes","hsn_supplier_invoice_match_status","hsn_supplier_invoice_match_methods","hsn_supplier_invoice_source_names","hsn_supplier_invoice_external_ids","hsn_supplier_invoice_source_file","hsn_supplier_invoice_match_date","hsn_supplier_invoice_candidate_alignment"]){
   if(JSON.stringify(p[k])!==JSON.stringify(q[k]))throw new Error("Projection field mismatch "+p.id+" "+k);
  }
 }
 if(p.hsn_supplier_invoice_match_status==="matched"&&(!/^\d{6,8}$/.test(p.hsn_supplier_invoice_code)||p.hsn_supplier_invoice_codes.length!==1))throw new Error("Bad matched source code "+p.id);
 if(p.hsn_supplier_invoice_match_status==="conflict"&&(p.hsn_supplier_invoice_code!==""||p.hsn_supplier_invoice_codes.length<2))throw new Error("Conflict was assigned a single code "+p.id);
}
for(const row of matches){if(!byId.has(row.catalogue_id)||!row.supplier_odoo_external_id||!row.supplier_invoice_hsn_code)throw new Error("Invalid match row "+row.catalogue_id);}
for(const row of review){if(!row.review_status||!row.supplier_product_name)throw new Error("Invalid review row");}
console.log("Supplier invoice HSN reconciliation passed",{matched_skus:matched.length,conflict_skus:conflicts.length,matched_source_rows:matches.length,review_rows:review.length});
