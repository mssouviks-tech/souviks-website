import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {
  CheckoutError,
  allowedOrigin,
  constantTimeEqual,
  getSupabaseServiceKey,
  getSupabaseUrl,
  jsonResponse,
  optionalUserId,
  sha256Hex,
  supabaseRest,
} from "../_shared/cashfree.ts";

const SELLER_STATE_CODE = "19";
const INDIA_STATES: Record<string, string> = {
  "01":"Jammu and Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh",
  "05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh",
  "10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur",
  "15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal",
  "20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh","24":"Gujarat",
  "26":"Dadra and Nagar Haveli and Daman and Diu","27":"Maharashtra","29":"Karnataka",
  "30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry",
  "35":"Andaman and Nicobar Islands","36":"Telangana","37":"Andhra Pradesh","38":"Ladakh",
};

type InvoiceLine = {
  description: string; part_number: string; hsn_code: string; quantity: number;
  gross_paise: number; taxable_paise: number; tax_paise: number; rate: number; unit_code: string;
  cgst_paise: number; sgst_paise: number; igst_paise: number;
};

function clean(value: unknown, max = 500): string {
  return String(value ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}
function rupees(paise: number): string { return (paise / 100).toFixed(2); }
function ascii(value: unknown, max = 120): string {
  return clean(value, max).normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}
function indiaFinancialYear(date: Date): string {
  const local = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const year = local.getFullYear();
  const start = local.getMonth() >= 3 ? year : year - 1;
  return String(start) + "-" + String(start + 1).slice(-2);
}
function localDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
function sha256(bytes: Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", bytes).then(digest =>
    Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("")
  );
}
function addTax(grossPaise: number, rate: number, intraState: boolean): Omit<InvoiceLine, "description"|"part_number"|"hsn_code"|"quantity"> {
  const basisPoints = Math.round(rate * 100);
  const taxablePaise = Math.round(grossPaise * 10000 / (10000 + basisPoints));
  const taxPaise = grossPaise - taxablePaise;
  if (intraState) {
    const cgstPaise = Math.round(taxPaise / 2);
    return { gross_paise: grossPaise, taxable_paise: taxablePaise, tax_paise: taxPaise, rate,
      cgst_paise: cgstPaise, sgst_paise: taxPaise - cgstPaise, igst_paise: 0 };
  }
  return { gross_paise: grossPaise, taxable_paise: taxablePaise, tax_paise: taxPaise, rate,
    cgst_paise: 0, sgst_paise: 0, igst_paise: taxPaise };
}
function assertSeller(): Record<string,string> {
  if (Deno.env.get("GST_INVOICE_ISSUANCE_ENABLED") !== "true") throw new CheckoutError("invoice_issuance_disabled", 409);
  if (Deno.env.get("GST_INVOICE_SELLER_IDENTITY_VERIFIED") !== "true") throw new CheckoutError("seller_identity_not_verified", 409);
  if (Deno.env.get("GST_INVOICE_ELECTRONIC_ISSUANCE_APPROVED") !== "true") {
    throw new CheckoutError("electronic_invoice_format_not_approved", 409);
  }
  if (Deno.env.get("GST_INVOICE_REVERSE_CHARGE_APPROVED") !== "true") {
    throw new CheckoutError("reverse_charge_treatment_not_approved", 409);
  }
  if (Deno.env.get("GST_INVOICE_UQC_APPROVED") !== "true" ||
      !["NOS","SET","KGS","LTR","MTR","OTH"].includes((Deno.env.get("GST_INVOICE_DEFAULT_UQC") || "").trim().toUpperCase())) {
    throw new CheckoutError("invoice_unit_code_not_approved", 409);
  }
  const seller = {
    legal_name: clean(Deno.env.get("GST_INVOICE_SELLER_LEGAL_NAME"), 160),
    trade_name: clean(Deno.env.get("GST_INVOICE_SELLER_TRADE_NAME"), 100),
    gstin: clean(Deno.env.get("GST_INVOICE_SELLER_GSTIN"), 15).toUpperCase(),
    address: clean(Deno.env.get("GST_INVOICE_SELLER_ADDRESS"), 300),
    state_code: clean(Deno.env.get("GST_INVOICE_SELLER_STATE_CODE"), 2),
  };
  if (!seller.legal_name || !seller.trade_name || !seller.address ||
      !/^[0-9A-Z]{15}$/.test(seller.gstin) || seller.gstin.slice(0,2) !== SELLER_STATE_CODE ||
      seller.state_code !== SELLER_STATE_CODE) {
    throw new CheckoutError("seller_invoice_configuration_incomplete", 409);
  }
  return seller;
}
function assertFreightConfig(): { sac: string; rate: number; source: string } {
  if (Deno.env.get("GST_FREIGHT_APPROVAL_STATUS") !== "approved" ||
      Deno.env.get("GST_FREIGHT_PRICE_INCLUDES_GST") !== "true") {
    throw new CheckoutError("freight_tax_treatment_not_approved", 409);
  }
  const sac = clean(Deno.env.get("GST_FREIGHT_SAC"), 8);
  const rate = Number(Deno.env.get("GST_FREIGHT_RATE_PERCENT"));
  const source = clean(Deno.env.get("GST_FREIGHT_APPROVAL_SOURCE"), 500);
  if (!/^\d{6,8}$/.test(sac) || ![0,5,12,18,28].includes(rate) || !source) {
    throw new CheckoutError("freight_tax_configuration_incomplete", 409);
  }
  return { sac, rate, source };
}
function validateBuyerState(order: any): { code: string; name: string } {
  const code = clean(order.billing_state_code, 2);
  if (!INDIA_STATES[code]) throw new CheckoutError("buyer_place_of_supply_missing", 409);
  if (!order.billing_address_line1 || !order.billing_city || !/^\d{6}$/.test(String(order.billing_postal_code || ""))) {
    throw new CheckoutError("buyer_billing_address_incomplete", 409);
  }
  const buyerGstin = clean(order.gst_number, 15).toUpperCase();
  if (buyerGstin && (!/^[0-9A-Z]{15}$/.test(buyerGstin) || buyerGstin.slice(0,2) !== code)) {
    throw new CheckoutError("buyer_gstin_state_mismatch", 409);
  }
  return { code, name: INDIA_STATES[code] };
}
function buildLines(items: any[], intraState: boolean): InvoiceLine[] {
  if (!Array.isArray(items) || !items.length) throw new CheckoutError("invoice_items_missing", 409);
  return items.map((item) => {
    const hsn = clean(item.hsn_code, 8);
    const candidateApproved = item.gst_rate_candidate_approved === true;
    const candidateStatus = clean(item.gst_rate_candidate_status, 64);
    const rate = Number(item.gst_rate_percent);
    const effectiveDate = Date.parse(String(item.gst_rate_effective_from || "") + "T00:00:00Z");
    const splitMatches = Number(item.gst_cgst_rate_percent) === rate / 2 &&
      Number(item.gst_sgst_rate_percent) === rate / 2 &&
      Number(item.gst_igst_rate_percent) === rate;
    if (!Number.isFinite(effectiveDate) || effectiveDate > Date.now() || !splitMatches ||
        !/^\d{8}$/.test(hsn) || item.hsn_classification_status !== "classified" ||
        item.hsn_confidence !== "high" || !candidateApproved ||
        !["candidate_for_accountant_review","approved"].includes(candidateStatus) ||
        ![5,18].includes(rate) || item.gst_rate_effective_from == null ||
        !clean(item.gst_rate_source_reference) || !clean(item.gst_rate_basis)) {
      throw new CheckoutError("hsn_or_gst_candidate_not_final", 409);
    }
    const gross = Math.round(Number(item.line_total) * 100);
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(gross) || gross < 1 || !Number.isInteger(quantity) || quantity < 1) {
      throw new CheckoutError("invoice_line_amount_invalid", 409);
    }
    return {
      description: ascii(item.product_name, 180),
      part_number: ascii(item.part_number, 80),
      hsn_code: hsn,
      quantity,
      ...addTax(gross, rate, intraState),
      unit_code: (Deno.env.get("GST_INVOICE_DEFAULT_UQC") || "NOS").trim().toUpperCase(),
    };
  });
}
function financialSnapshot(order: any, items: any[], seller: Record<string,string>, date: Date): any {
  if (order.payment_status !== "paid" || order.currency !== "INR" || order.tax_included !== true) {
    throw new CheckoutError("order_not_invoice_eligible", 409);
  }
  const buyer = validateBuyerState(order);
  const supplyCode = order.fulfillment_method === "delivery"
    ? clean(order.shipping_state_code, 2)
    : buyer.code;
  if (!INDIA_STATES[supplyCode]) throw new CheckoutError("place_of_supply_not_verified", 409);
  const supplyName = INDIA_STATES[supplyCode];
  const intraState = supplyCode === seller.state_code;
  const lines = buildLines(items, intraState);
  const grossItems = lines.reduce((n,l)=>n+l.gross_paise,0);
  const taxable = lines.reduce((n,l)=>n+l.taxable_paise,0);
  let freight: InvoiceLine | null = null;
  const freightPaise = Math.round(Number(order.shipping_amount || 0) * 100);
  if (freightPaise > 0) {
    const config = assertFreightConfig();
    const freightLine = addTax(freightPaise, config.rate, intraState);
    freight = {
      description: "Courier and delivery charges", part_number: "", hsn_code: config.sac,
      quantity: 1, ...freightLine, unit_code: "",
    };
  }
  const allLines = freight ? [...lines, freight] : lines;
  const invoiceGross = allLines.reduce((n,l)=>n+l.gross_paise,0);
  const orderTotal = Math.round(Number(order.total_amount) * 100);
  if (invoiceGross !== orderTotal || grossItems !== Math.round(Number(order.subtotal) * 100)) {
    throw new CheckoutError("invoice_order_total_mismatch", 409);
  }
  return {
    version: 1, invoice_date: date.toISOString(), invoice_date_label: localDateLabel(date),
    financial_year: indiaFinancialYear(date), order_number: order.order_number,
    payment_reference: order.cf_payment_id || null, paid_at: order.paid_at || null,
    seller, buyer: {
      name: ascii(order.company || order.customer_name, 160),
      contact_name: ascii(order.customer_name, 160),
      gstin: clean(order.gst_number,15).toUpperCase() || null,
      address_line1: ascii(order.billing_address_line1,180),
      address_line2: ascii(order.billing_address_line2,180),
      city: ascii(order.billing_city,100), state: buyer.name, state_code: buyer.code,
      postal_code: clean(order.billing_postal_code,6), country: "India",
      recipient_type: order.gst_number ? "B2B" : "B2C",
    },
    place_of_supply: supplyName, place_of_supply_state_code: supplyCode,
    delivery_address: order.fulfillment_method === "delivery" ? {
      address_line1: ascii(order.shipping_address_line1,180),
      address_line2: ascii(order.shipping_address_line2,180),
      city: ascii(order.shipping_city,100),
      state: supplyName,
      state_code: supplyCode,
      postal_code: clean(order.shipping_postal_code,6),
    } : null,
    supply_type: intraState ? "intra_state" : "inter_state",
    lines: allLines, items_gross_paise: grossItems,
    taxable_paise: allLines.reduce((n,l)=>n+l.taxable_paise,0),
    cgst_paise: allLines.reduce((n,l)=>n+l.cgst_paise,0),
    sgst_paise: allLines.reduce((n,l)=>n+l.sgst_paise,0),
    igst_paise: allLines.reduce((n,l)=>n+l.igst_paise,0),
    tax_paise: allLines.reduce((n,l)=>n+l.tax_paise,0),
    freight_gross_paise: freight?.gross_paise || 0,
    invoice_total_paise: invoiceGross,
    prices_include_gst: true,
  };
}
function drawText(page: any, font: any, text: unknown, x: number, y: number, size = 9, max = 110): void {
  page.drawText(ascii(text, max) || "-", { x, y, size, font, color: rgb(0.08,0.12,0.19), maxWidth: 520 });
}
async function renderPdf(invoiceNumber: string, snapshot: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const rows: any[] = snapshot.lines || [];
  const pageCount = Math.max(1, Math.ceil(rows.length / 14));
  for (let index=0; index<pageCount; index++) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawText("SOUVIKS", {x:44,y:792,size:23,font:bold,color:rgb(0.04,0.13,0.26)});
    page.drawText("TAX INVOICE", {x:390,y:795,size:15,font:bold,color:rgb(0.91,0.36,0.09)});
    drawText(page,bold,snapshot.seller.legal_name + " (Proprietor - " + snapshot.seller.trade_name + ")",44,765,10,100);
    drawText(page,font,snapshot.seller.address,44,750,8,110);
    drawText(page,font,"GSTIN: "+snapshot.seller.gstin+" | State code: "+snapshot.seller.state_code,44,735,8,100);
    drawText(page,bold,"Invoice number: "+invoiceNumber,350,765,9,70);
    drawText(page,font,"Invoice date: "+snapshot.invoice_date_label,350,750,9,70);
    drawText(page,font,"Financial year: "+snapshot.financial_year,350,735,9,70);
    page.drawLine({start:{x:44,y:720},end:{x:551,y:720},thickness:1,color:rgb(0.1,0.16,0.24)});
    drawText(page,bold,"BILL TO",44,700,9);
    drawText(page,bold,snapshot.buyer.name,44,684,10,70);
    drawText(page,font,snapshot.buyer.contact_name,44,670,8,70);
    drawText(page,font,snapshot.buyer.address_line1,44,656,8,70);
    drawText(page,font,snapshot.buyer.address_line2,44,644,8,70);
    drawText(page,font,[snapshot.buyer.city,snapshot.buyer.state,snapshot.buyer.postal_code].filter(Boolean).join(", "),44,632,8,90);
    drawText(page,font,"GSTIN: "+(snapshot.buyer.gstin || "Unregistered recipient"),44,618,8,75);
    if (snapshot.delivery_address) {
      drawText(page,bold,"Ship to:",44,604,7,12);
      drawText(page,font,[snapshot.delivery_address.address_line1,snapshot.delivery_address.address_line2,snapshot.delivery_address.city,snapshot.delivery_address.state,snapshot.delivery_address.postal_code].filter(Boolean).join(", "),80,604,7,78);
    }
    drawText(page,bold,"Place of supply: "+snapshot.place_of_supply+" ("+snapshot.place_of_supply_state_code+")",320,684,8,80);
    drawText(page,font,"Supply: "+snapshot.supply_type.replace("_"," "),320,670,8);
    drawText(page,font,"Reverse charge: No",320,656,8);
    const top = 594;
    page.drawRectangle({x:44,y:top-18,width:507,height:18,color:rgb(0.04,0.13,0.26)});
    const headers=[["Description",49],["HSN/SAC",260],["Qty",322],["Taxable",354],["Rate",418],["Tax",462],["Total",510]];
    for(const [label,x] of headers)page.drawText(label,{x,y:top-12,size:7,font:bold,color:rgb(1,1,1)});
    const pageRows=rows.slice(index*14,(index+1)*14);
    let y=top-36;
    for(let i=0;i<pageRows.length;i++,y-=23){
      const row=pageRows[i];
      drawText(page,font,row.description,49,y,7,38);
      drawText(page,font,row.hsn_code,260,y,7,9);
      drawText(page,font,String(row.quantity)+(row.unit_code ? " "+row.unit_code : ""),322,y,7,12);
      drawText(page,font,rupees(row.taxable_paise),354,y,7,10);
      drawText(page,font,String(row.rate)+"%",418,y,7,7);
      drawText(page,font,rupees(row.tax_paise),462,y,7,10);
      drawText(page,font,rupees(row.gross_paise),510,y,7,10);
      page.drawLine({start:{x:44,y:y-7},end:{x:551,y:y-7},thickness:0.35,color:rgb(0.84,0.86,0.89)});
    }
    if(index===pageCount-1){
      const startY=Math.max(105,y-18);
      drawText(page,bold,"Taxable value",350,startY,9);
      drawText(page,font,"INR "+rupees(snapshot.taxable_paise),470,startY,9,15);
      drawText(page,bold,"CGST",350,startY-17,8);
      drawText(page,font,"INR "+rupees(snapshot.cgst_paise),470,startY-17,8,15);
      drawText(page,bold,"SGST",350,startY-33,8);
      drawText(page,font,"INR "+rupees(snapshot.sgst_paise),470,startY-33,8,15);
      drawText(page,bold,"IGST",350,startY-49,8);
      drawText(page,font,"INR "+rupees(snapshot.igst_paise),470,startY-49,8,15);
      page.drawLine({start:{x:345,y:startY-58},end:{x:551,y:startY-58},thickness:1,color:rgb(0.1,0.16,0.24)});
      drawText(page,bold,"INVOICE TOTAL",350,startY-75,10);
      drawText(page,bold,"INR "+rupees(snapshot.invoice_total_paise),470,startY-75,10,15);
      drawText(page,font,"Prices shown include GST. Tax is extracted from the approved GST-inclusive selling price.",44,74,7,110);
      drawText(page,font,"Payment reference: "+(snapshot.payment_reference || "Not supplied"),44,60,7,100);
      drawText(page,font,"Issued electronically by Souviks.",44,46,7,110);
    }
    drawText(page,font,"Souviks | "+invoiceNumber+" | Page "+(index+1)+" of "+pageCount,44,24,7,100);
  }
  return await pdf.save({ useObjectStreams: false });
}
async function storageRequest(path: string, method: string, body?: Uint8Array | Record<string,unknown>): Promise<any> {
  const base=getSupabaseUrl(), key=getSupabaseServiceKey();
  const headers:Record<string,string>={ apikey:key, Accept:"application/json" };
  if(!key.startsWith("sb_secret_"))headers.Authorization="Bearer "+key;
  if(body instanceof Uint8Array){headers["Content-Type"]="application/pdf";headers["x-upsert"]="true";}
  else if(body!==undefined)headers["Content-Type"]="application/json";
  const response=await fetch(base+"/storage/v1/"+path,{method,headers,body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body)});
  const raw=await response.text();
  let parsed:any=null;try{parsed=raw?JSON.parse(raw):null;}catch{parsed=null;}
  if(!response.ok)throw new CheckoutError("invoice_storage_unavailable",503);
  return parsed;
}
function requireInternal(req: Request): boolean {
  const auth=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  return !!auth && constantTimeEqual(auth,getSupabaseServiceKey());
}
async function issueInvoice(gatewayOrderId: string): Promise<Record<string,unknown>> {
  const seller=assertSeller();
  const orders=await supabaseRest("orders","GET",{
    select:"id,order_number,gateway_order_id,customer_name,customer_email,company,gst_number,billing_address_line1,billing_address_line2,billing_city,billing_state,billing_state_code,billing_postal_code,billing_country,fulfillment_method,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_state_code,shipping_postal_code,currency,subtotal,shipping_amount,total_amount,tax_included,payment_status,cf_payment_id,paid_at",
    gateway_order_id:"eq."+gatewayOrderId,limit:"1"
  });
  const order=Array.isArray(orders)?orders[0]:null;
  if(!order)throw new CheckoutError("order_not_found",404);
  const items=await supabaseRest("order_items","GET",{
    select:"product_id,part_number,product_name,quantity,line_total,hsn_code,hsn_description,hsn_classification_status,hsn_confidence,gst_rate_percent,gst_cgst_rate_percent,gst_sgst_rate_percent,gst_igst_rate_percent,gst_rate_effective_from,gst_rate_source_reference,gst_rate_basis,gst_rate_candidate_approved,gst_rate_candidate_status",
    order_id:"eq."+order.id,order:"created_at.asc",limit:"100"
  });
  const date=new Date();
  const snapshot=financialSnapshot(order,items,seller,date);
  const reservationRows=await supabaseRest("rpc/reserve_gst_invoice","POST",{},{
    p_order_id:order.id,p_financial_year:snapshot.financial_year,p_snapshot:snapshot
  });
  const reservation=Array.isArray(reservationRows)?reservationRows[0]:reservationRows;
  if(!reservation?.invoice_id||!reservation?.invoice_number||!reservation?.snapshot)throw new CheckoutError("invoice_number_reservation_failed",503);
  if(reservation.invoice_status==="issued"){
    return {ok:true,invoice_number:reservation.invoice_number,invoice_status:"issued",already_issued:true};
  }
  const immutableSnapshot=reservation.snapshot;
  const pdf=await renderPdf(String(reservation.invoice_number),immutableSnapshot);
  const path=String(immutableSnapshot.financial_year)+"/"+String(order.id)+"/"+String(reservation.invoice_number).replace(/[^A-Za-z0-9-]/g,"_")+".pdf";
  await storageRequest("object/gst-invoices/"+path,"POST",pdf);
  const digest=await sha256(pdf);
  await supabaseRest("gst_invoices","PATCH",{id:"eq."+reservation.invoice_id},{
    invoice_status:"issued",storage_path:path,pdf_sha256:digest,issued_at:new Date().toISOString(),updated_at:new Date().toISOString()
  },"return=minimal");
  return {ok:true,invoice_number:reservation.invoice_number,invoice_status:"issued"};
}
async function downloadInvoice(req: Request, orderId: string, checkoutToken: string): Promise<Record<string,unknown>> {
  const userId=await optionalUserId(req);
  const orders=await supabaseRest("orders","GET",{
    select:"id,user_id,payment_status,gateway_order_id",
    gateway_order_id:"eq."+orderId,limit:"1"
  });
  const order=Array.isArray(orders)?orders[0]:null;
  if(!order||order.payment_status!=="paid")throw new CheckoutError("invoice_order_access_denied",403);
  let allowed=!!userId && order.user_id===userId;
  if(!allowed && /^[a-f0-9]{64}$/.test(checkoutToken)){
    const hash=await sha256Hex(checkoutToken);
    const tokens=await supabaseRest("checkout_access_tokens","GET",{
      select:"id",gateway_order_id:"eq."+orderId,token_hash:"eq."+hash,
      expires_at:"gt."+new Date().toISOString(),limit:"1"
    });
    allowed=Array.isArray(tokens)&&tokens.length>0;
  }
  if(!allowed)throw new CheckoutError("invoice_order_access_denied",403);
  const invoices=await supabaseRest("gst_invoices","GET",{
    select:"invoice_number,invoice_status,storage_path",
    order_id:"eq."+order.id,invoice_status:"eq.issued",limit:"1"
  });
  const invoice=Array.isArray(invoices)?invoices[0]:null;
  if(!invoice?.storage_path)throw new CheckoutError("invoice_not_available",409);
  const signed=await storageRequest("object/sign/gst-invoices/"+invoice.storage_path,"POST",{expiresIn:300,download:"Souviks_Tax_Invoice_"+invoice.invoice_number.replace(/[^A-Za-z0-9-]/g,"_")+".pdf"});
  let signedUrl=String(signed?.signedURL||signed?.signedUrl||"");
  if(!signedUrl)throw new CheckoutError("invoice_download_unavailable",503);
  if(signedUrl.startsWith("/"))signedUrl=getSupabaseUrl()+"/storage/v1"+signedUrl;
  return {ok:true,invoice_number:invoice.invoice_number,signed_url:signedUrl,expires_in:300};
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS"){
    if(!allowedOrigin(origin,(Deno.env.get("CASHFREE_MODE")||"sandbox").trim().toLowerCase()==="production"?"production":"sandbox"))return new Response("Origin not allowed",{status:403});
    return jsonResponse(req,{ok:true});
  }
  if(req.method!=="POST")return jsonResponse(req,{ok:false,code:"method_not_allowed"},405);
  let input:any={};try{input=await req.json();}catch{return jsonResponse(req,{ok:false,code:"invalid_json"},400);}
  try{
    const action=String(input?.action||"");
    const orderId=clean(input?.order_id,60);
    if(!/^[A-Z0-9_-]{3,45}$/.test(orderId))throw new CheckoutError("order_id_invalid",400);
    if(action==="issue"){
      if(!requireInternal(req))throw new CheckoutError("internal_authorization_required",401);
      const result=await issueInvoice(orderId);
      return jsonResponse(req,result);
    }
    if(action==="download"){
      const result=await downloadInvoice(req,orderId,clean(input?.checkout_token,64));
      return jsonResponse(req,result);
    }
    throw new CheckoutError("action_invalid",400);
  }catch(error){
    if(error instanceof CheckoutError)return jsonResponse(req,{ok:false,code:error.code,message:"Invoice could not be prepared or downloaded. Contact Souviks if the issue persists."},error.status);
    console.error("[GST invoice] Invoice operation failed");
    return jsonResponse(req,{ok:false,code:"invoice_operation_unavailable",message:"Invoice operation is temporarily unavailable."},503);
  }
});
