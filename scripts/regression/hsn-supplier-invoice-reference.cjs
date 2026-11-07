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
const manual=JSON.parse(read("assets/data/hsn-supplier-invoice-manual-resolutions.json"));
const byId=new Map(catalogue.map(p=>[p.id,p]));
const projections=new Map(products.map(p=>[p.id,p]));
const matched=catalogue.filter(p=>p.hsn_supplier_invoice_match_status==="matched");
const conflicts=catalogue.filter(p=>p.hsn_supplier_invoice_match_status==="conflict");
if(catalogue.length!==1159||products.length!==1157)throw new Error("Unexpected catalogue/projection coverage");
if(matched.length!==851||conflicts.length!==16)throw new Error("Unexpected SKU totals");
if(matches.length!==912||review.length!==122||matches.length+review.length!==1034)throw new Error("Supplier source rows not fully accounted for");
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
const expectedManual=[
 ["SVKS000243","__export__.product_template_100_50575a30"],
 ["SVKS000244","__export__.product_template_101_eb05c8c5"],
 ["SVKS000345","__export__.product_template_5066_e37080aa"],
 ["SVKS000840","__export__.product_template_6774_d034ad4c"],
 ["SVKS000386","__export__.product_template_6760_c23083f8"],
 ["SVKS000404","__export__.product_template_6266_00471767"],
 ["SVKS001086","__export__.product_template_7609_cdb920bf"],
 ["SVKS001103","__export__.product_template_7626_4655580d"],
 ["SVKS001091","__export__.product_template_7614_c9ae6068"],
 ["SVKS001093","__export__.product_template_7616_e70bd6b0"],
 ["SVKS000499","__export__.product_template_6290_e5504680"],
];
const manualKeys=new Set(manual.records.map(r=>`${r.id}|${r.supplier_odoo_external_id}`));
for(const [id,externalId] of expectedManual){if(!manualKeys.has(`${id}|${externalId}`))throw new Error("Missing verified manual supplier identity "+id);}
if(manual.records.length!==88)throw new Error("Unexpected manual resolution ledger size");
console.log("Supplier invoice HSN reconciliation passed",{matched_skus:matched.length,conflict_skus:conflicts.length,matched_source_rows:matches.length,review_rows:review.length,manual_resolutions:manual.records.length});
