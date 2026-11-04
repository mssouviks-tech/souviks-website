import { PDFDocument, StandardFonts, rgb, degrees } from "npm:pdf-lib@1.17.1";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
  supabaseRest,
} from "./cashfree.ts";

export class InvoiceError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 409) {
    super(code);
    this.name = "InvoiceError";
    this.code = code;
    this.status = status;
  }
}

const SELLER = {
  legalName: "CHANDRANI SADHU",
  tradeName: "Souviks",
  gstin: "19BZMPS2461K1ZO",
  address1: "6, Souviks, Beside NH-2",
  address2: "Andal, Bardhaman, West Bengal - 713321",
  stateName: "West Bengal",
  stateCode: "19",
  email: "info@souviks.co.in",
  phone: "+91 94343 31896",
  bank: "Punjab National Bank",
  ifsc: "PUNB0048510",
  accountName: "Souviks",
  accountNumber: "04854015003137",
};

const STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01", "jammu & kashmir": "01", "j&k": "01",
  "himachal pradesh": "02", "punjab": "03", "chandigarh": "04",
  "uttarakhand": "05", "uttaranchal": "05", "haryana": "06", "delhi": "07",
  "nct of delhi": "07", "rajasthan": "08", "uttar pradesh": "09", "bihar": "10",
  "sikkim": "11", "arunachal pradesh": "12", "nagaland": "13", "manipur": "14",
  "mizoram": "15", "tripura": "16", "meghalaya": "17", "assam": "18",
  "west bengal": "19", "wb": "19", "jharkhand": "20", "odisha": "21", "orissa": "21",
  "chhattisgarh": "22", "madhya pradesh": "23", "gujarat": "24",
  "dadra and nagar haveli": "26", "daman and diu": "26",
  "dadra & nagar haveli and daman & diu": "26", "maharashtra": "27",
  "andhra pradesh (old)": "28", "karnataka": "29", "goa": "30",
  "lakshadweep": "31", "kerala": "32", "tamil nadu": "33", "puducherry": "34",
  "pondicherry": "34", "andaman and nicobar islands": "35", "telangana": "36",
  "andhra pradesh": "37", "ladakh": "38",
};

function clean(value: unknown, max = 240): string {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function dateInKolkata(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return values.year + "-" + values.month + "-" + values.day;
}

function financialYear(date: string): string {
  const pieces = date.split("-");
  const year = Number(pieces[0]);
  const month = Number(pieces[1]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new InvoiceError("invoice_date_invalid", 400);
  }
  const start = month >= 4 ? year : year - 1;
  return String(start) + "-" + String(start + 1).slice(-2);
}

function stateCode(value: unknown): string | null {
  const text = clean(value, 100).toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
  if (/^\d{2}$/.test(text)) return text;
  return STATE_CODES[text] || null;
}

function toPaise(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000000) {
    throw new InvoiceError("invoice_amount_invalid", 409);
  }
  return Math.round(amount * 100);
}

function money(valueInPaise: number): string {
  return (valueInPaise / 100).toFixed(2);
}

function moneyNumber(valueInPaise: number): number {
  return Number(money(valueInPaise));
}

type TaxProfile = {
  profile_key: string;
  hsn_sac_code: string;
  item_description: string | null;
  unit_code: string;
  gst_rate_percent: string | number;
  amount_includes_gst: boolean;
  reverse_charge_applicable: boolean;
  cess_applicable: boolean;
  approval_status: string;
  source_reference: string | null;
  approved_by: string | null;
  approved_at: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
};

function validProfile(profile: TaxProfile | undefined, key: string, date: string): profile is TaxProfile {
  if (!profile || profile.profile_key !== key || profile.is_active !== true) return false;
  if (profile.approval_status !== "approved" || !profile.source_reference || !profile.approved_by || !profile.approved_at) return false;
  if (!/^\d{4,8}$/.test(String(profile.hsn_sac_code || ""))) return false;
  if (!/^[A-Z0-9]{2,8}$/.test(String(profile.unit_code || ""))) return false;
  if (profile.amount_includes_gst !== true) return false;
  if (typeof profile.reverse_charge_applicable !== "boolean" || typeof profile.cess_applicable !== "boolean") return false;
  if (String(profile.valid_from || "") > date) return false;
  if (profile.valid_to && String(profile.valid_to) < date) return false;
  const rate = Number(profile.gst_rate_percent);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100;
}

function calculateTax(grossPaise: number, rate: number, intraState: boolean) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new InvoiceError("invoice_tax_profile_invalid", 409);
  const taxable = rate === 0 ? grossPaise : Math.round((grossPaise * 100) / (100 + rate));
  const tax = grossPaise - taxable;
  const cgst = intraState ? Math.floor(tax / 2) : 0;
  const sgst = intraState ? tax - cgst : 0;
  const igst = intraState ? 0 : tax;
  return { taxable, cgst, sgst, igst, tax, gross: grossPaise };
}

async function loadPaidOrder(gatewayOrderId: string): Promise<any> {
  const rows = await supabaseRest("orders", "GET", {
    select: "id,order_number,gateway_order_id,user_id,customer_name,customer_email,customer_phone,company,gst_number,billing_same_as_shipping,billing_address_line1,billing_address_line2,billing_city,billing_state,billing_postal_code,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country,fulfillment_method,currency,subtotal,shipping_amount,total_amount,tax_included,payment_status,cf_payment_id,paid_at,created_at",
    gateway_order_id: "eq." + gatewayOrderId,
    limit: "1",
  });
  const order = Array.isArray(rows) ? rows[0] : null;
  if (!order) throw new InvoiceError("invoice_order_not_found", 404);
  if (String(order.payment_status || "").toLowerCase() !== "paid" || !order.paid_at) {
    throw new InvoiceError("invoice_payment_not_confirmed", 409);
  }
  if (order.tax_included !== true || String(order.currency || "INR") !== "INR") {
    throw new InvoiceError("invoice_order_tax_basis_unconfirmed", 409);
  }
  return order;
}

function recipientAddress(order: any) {
  const hasBillingAddress = Boolean(
    clean(order.billing_address_line1, 180) ||
    clean(order.billing_city, 100) ||
    clean(order.billing_state, 100) ||
    clean(order.billing_postal_code, 6)
  );
  const useBilling = order.billing_same_as_shipping === false || hasBillingAddress;
  const line1 = useBilling ? order.billing_address_line1 : order.shipping_address_line1;
  const line2 = useBilling ? order.billing_address_line2 : order.shipping_address_line2;
  const city = useBilling ? order.billing_city : order.shipping_city;
  const state = useBilling ? order.billing_state : order.shipping_state;
  const postalCode = useBilling ? order.billing_postal_code : order.shipping_postal_code;
  return {
    lines: [
      clean(line1, 180),
      clean(line2, 120),
      clean(city, 100),
      clean(state, 100),
      clean(postalCode, 6),
    ].filter(Boolean),
    state_name: clean(state, 100),
    state_code: stateCode(state),
    postal_code: clean(postalCode, 6),
  };
}

async function buildSnapshot(order: any, invoiceDate: string): Promise<Record<string, any>> {
  const orderItems = await supabaseRest("order_items", "GET", {
    select: "product_id,part_number,product_name,brand,quantity,unit_price,line_total",
    order_id: "eq." + order.id,
    order: "created_at.asc",
    limit: "1000",
  });
  if (!Array.isArray(orderItems) || orderItems.length < 1) throw new InvoiceError("invoice_order_items_missing", 409);

  const productKeys = orderItems.map((item) => String(item.product_id || ""));
  const hasFreight = toPaise(order.shipping_amount) > 0;
  const keys = Array.from(new Set(productKeys.concat(hasFreight ? ["FREIGHT"] : [])));
  if (keys.some((key) => !/^(SVKS\d{6,10}|FREIGHT)$/.test(key))) {
    throw new InvoiceError("invoice_product_reference_invalid", 409);
  }

  const profilesRaw = await supabaseRest("gst_tax_profiles", "GET", {
    select: "profile_key,hsn_sac_code,item_description,unit_code,gst_rate_percent,amount_includes_gst,reverse_charge_applicable,cess_applicable,approval_status,source_reference,approved_by,approved_at,valid_from,valid_to,is_active",
    profile_key: "in.(" + keys.join(",") + ")",
    is_active: "eq.true",
    order: "valid_from.desc",
    limit: "1000",
  });
  const profiles = new Map<string, TaxProfile>();
  for (const profile of (Array.isArray(profilesRaw) ? profilesRaw : []) as TaxProfile[]) {
    const key = String(profile.profile_key || "");
    if (!profiles.has(key) && validProfile(profile, key, invoiceDate)) profiles.set(key, profile);
  }
  if (keys.some((key) => !profiles.has(key))) throw new InvoiceError("invoice_tax_profile_missing", 409);
  const approvedProfiles = keys.map((key) => profiles.get(key)!);
  if (approvedProfiles.some((profile) => profile.reverse_charge_applicable)) {
    throw new InvoiceError("invoice_reverse_charge_not_supported", 409);
  }
  if (approvedProfiles.some((profile) => profile.cess_applicable)) {
    throw new InvoiceError("invoice_cess_not_supported", 409);
  }

  const fulfillmentMethod = String(order.fulfillment_method || "delivery");
  const address = recipientAddress(order);
  // For goods moved to the customer, place of supply follows the delivery
  // destination. For store pickup, the goods are made available at Souviks.
  const posState = fulfillmentMethod === "pickup" ? SELLER.stateName : clean(order.shipping_state, 100);
  const posCode = stateCode(posState);
  if (!posCode) throw new InvoiceError("invoice_place_of_supply_state_unrecognised", 409);
  const intraState = posCode === SELLER.stateCode;

  const gstin = clean(order.gst_number, 15).toUpperCase();
  const isB2B = Boolean(gstin);
  if (isB2B && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)) {
    throw new InvoiceError("invoice_recipient_gstin_invalid", 409);
  }
  const recipientName = clean(order.company || order.customer_name, 160);
  if (isB2B && (!recipientName || !address.lines.length)) {
    throw new InvoiceError("invoice_b2b_recipient_details_missing", 409);
  }
  if (!isB2B && toPaise(order.total_amount) >= 5000000 && (!recipientName || !address.lines.length)) {
    throw new InvoiceError("invoice_recipient_address_required", 409);
  }

  const lines: Record<string, any>[] = [];
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let grossTotal = 0;

  for (const item of orderItems) {
    const key = String(item.product_id || "");
    const profile = profiles.get(key)!;
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      throw new InvoiceError("invoice_order_quantity_invalid", 409);
    }
    const lineGross = toPaise(item.line_total);
    const unitGross = toPaise(item.unit_price);
    if (lineGross !== unitGross * quantity) throw new InvoiceError("invoice_order_line_mismatch", 409);
    const tax = calculateTax(lineGross, Number(profile.gst_rate_percent), intraState);
    lines.push({
      line_type: "product",
      product_id: key,
      description: clean(profile.item_description || item.product_name, 300),
      part_number: clean(item.part_number, 128),
      brand: clean(item.brand, 120),
      hsn_sac_code: profile.hsn_sac_code,
      quantity,
      unit_code: profile.unit_code,
      unit_rate_inr: money(unitGross),
      taxable_value_inr: money(tax.taxable),
      gst_rate_percent: Number(profile.gst_rate_percent),
      cgst_inr: money(tax.cgst),
      sgst_inr: money(tax.sgst),
      igst_inr: money(tax.igst),
      tax_amount_inr: money(tax.tax),
      line_total_inr: money(lineGross),
    });
    taxableTotal += tax.taxable;
    cgstTotal += tax.cgst;
    sgstTotal += tax.sgst;
    igstTotal += tax.igst;
    grossTotal += lineGross;
  }

  const freightPaise = toPaise(order.shipping_amount);
  if (freightPaise > 0) {
    const profile = profiles.get("FREIGHT")!;
    const tax = calculateTax(freightPaise, Number(profile.gst_rate_percent), intraState);
    lines.push({
      line_type: "freight",
      product_id: null,
      description: clean(profile.item_description || "Freight / delivery charges", 300),
      part_number: null,
      brand: null,
      hsn_sac_code: profile.hsn_sac_code,
      quantity: 1,
      unit_code: profile.unit_code,
      unit_rate_inr: money(freightPaise),
      taxable_value_inr: money(tax.taxable),
      gst_rate_percent: Number(profile.gst_rate_percent),
      cgst_inr: money(tax.cgst),
      sgst_inr: money(tax.sgst),
      igst_inr: money(tax.igst),
      tax_amount_inr: money(tax.tax),
      line_total_inr: money(freightPaise),
    });
    taxableTotal += tax.taxable;
    cgstTotal += tax.cgst;
    sgstTotal += tax.sgst;
    igstTotal += tax.igst;
    grossTotal += freightPaise;
  }

  if (grossTotal !== toPaise(order.total_amount)) throw new InvoiceError("invoice_order_total_mismatch", 409);
  const taxTotal = cgstTotal + sgstTotal + igstTotal;
  return {
    schema: "souviks-gst-invoice-draft/v1",
    order_id: order.id,
    order_number: clean(order.order_number, 60),
    gateway_order_id: clean(order.gateway_order_id, 60),
    invoice_date: invoiceDate,
    seller: {
      legal_name: SELLER.legalName,
      trade_name: SELLER.tradeName,
      constitution: "Proprietorship",
      gstin: SELLER.gstin,
      address: [SELLER.address1, SELLER.address2],
      state_code: SELLER.stateCode,
      state_name: SELLER.stateName,
      email: SELLER.email,
      phone: SELLER.phone,
    },
    recipient: {
      type: isB2B ? "B2B" : "B2C",
      name: recipientName,
      company: clean(order.company, 160),
      gstin: isB2B ? gstin : null,
      address: address.lines,
      state_name: address.state_name || posState,
      state_code: address.state_code || posCode,
      postal_code: address.postal_code,
      country: "India",
    },
    place_of_supply: { state_name: posState, state_code: posCode, intra_state: intraState },
    delivery_address: fulfillmentMethod === "delivery" ? [
      clean(order.shipping_address_line1, 180),
      clean(order.shipping_address_line2, 120),
      clean(order.shipping_city, 100),
      clean(order.shipping_state, 100),
      clean(order.shipping_postal_code, 6),
    ].filter(Boolean) : [],
    reverse_charge: "No",
    fulfillment_method: fulfillmentMethod,
    payment: {
      status: "PAID",
      paid_at: order.paid_at,
      gateway: "Cashfree",
      provider_reference: clean(order.cf_payment_id, 80),
      order_reference: clean(order.order_number, 60),
    },
    lines,
    totals: {
      taxable_total: moneyNumber(taxableTotal),
      cgst_total: moneyNumber(cgstTotal),
      sgst_total: moneyNumber(sgstTotal),
      igst_total: moneyNumber(igstTotal),
      tax_total: moneyNumber(taxTotal),
      invoice_total: moneyNumber(grossTotal),
      freight_total: moneyNumber(freightPaise),
      round_off: "0.00",
    },
    currency: "INR",
    signature_status: "PENDING",
    signature_note: "DRAFT - AUTHORISED SIGNATURE REQUIRED",
    bank: {
      name: SELLER.bank,
      ifsc: SELLER.ifsc,
      account_name: SELLER.accountName,
      account_number: SELLER.accountNumber,
    },
  };
}

function pdfText(value: unknown, max = 220): string {
  return clean(value, max).normalize("NFKD").replace(/[^\x20-\x7E]/g, " ");
}

function inr(value: unknown): string {
  const amount = Number(value);
  return "INR " + (Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function wrap(text: string, font: any, size: number, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const output: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
    else {
      output.push(line);
      line = word;
    }
  }
  if (line) output.push(line);
  return output.length ? output : [""];
}

function fmtDate(value: string): string {
  const parts = value.split("-");
  return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : value;
}

function drawHeader(page: any, fonts: any, label: string) {
  const width = 595.28;
  const height = 841.89;
  const red = rgb(0.82, 0.08, 0.10);
  const dark = rgb(0.12, 0.15, 0.19);
  page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: rgb(0.98, 0.93, 0.93) });
  page.drawText("Souviks", { x: 26, y: height - 38, size: 20, font: fonts.bold, color: red });
  page.drawText(SELLER.legalName + " | Proprietor", { x: 26, y: height - 54, size: 7.3, font: fonts.bold, color: dark });
  page.drawText(SELLER.address1, { x: 26, y: height - 67, size: 7.3, font: fonts.regular, color: dark });
  page.drawText(SELLER.address2, { x: 26, y: height - 79, size: 7.3, font: fonts.regular, color: dark });
  page.drawText("State Code: 19 | GSTIN: " + SELLER.gstin, { x: 26, y: height - 92, size: 7.1, font: fonts.bold, color: dark });
  page.drawCircle({ x: 298, y: height - 42, size: 19, borderColor: dark, borderWidth: 1.7, color: rgb(1, 1, 1) });
  page.drawText("S", { x: 291, y: height - 50, size: 23, font: fonts.bold, color: dark });
  page.drawText("Souviks", { x: 282, y: height - 66, size: 7, font: fonts.bold, color: dark });
  page.drawText("Your vehicle deserves the best. We", { x: 232, y: height - 81, size: 7.1, font: fonts.bold, color: red });
  page.drawText("promise it.", { x: 265, y: height - 92, size: 7.1, font: fonts.bold, color: red });
  page.drawText("INVOICE CUSTOMER COPY", { x: 420, y: height - 35, size: 7.1, font: fonts.bold, color: dark });
  page.drawText(label, { x: 420, y: height - 48, size: 7, font: fonts.regular, color: dark });
}

function drawFooter(page: any, fonts: any, pageNumber: number, pageCount: number) {
  const dark = rgb(0.25, 0.28, 0.32);
  page.drawLine({ start: { x: 26, y: 55 }, end: { x: 569, y: 55 }, thickness: 0.5, color: rgb(0.78, 0.78, 0.78) });
  page.drawText("Bank: " + SELLER.bank + " | IFSC: " + SELLER.ifsc, { x: 175, y: 40, size: 6.8, font: fonts.regular, color: dark });
  page.drawText("Account: " + SELLER.accountName + " | " + SELLER.accountNumber, { x: 186, y: 27, size: 6.8, font: fonts.regular, color: dark });
  page.drawText("Page " + pageNumber + " / " + pageCount, { x: 270, y: 12, size: 6.8, font: fonts.regular, color: dark });
}

function drawWatermark(page: any, fonts: any) {
  page.drawText("DRAFT - AUTHORISED SIGNATURE PENDING", {
    x: 75, y: 385, size: 20, font: fonts.bold, color: rgb(0.88, 0.84, 0.84),
    rotate: degrees(27), opacity: 0.45,
  });
}

function drawTop(page: any, fonts: any, snapshot: any, invoiceNumber: string) {
  const red = rgb(0.82, 0.08, 0.10);
  const dark = rgb(0.12, 0.15, 0.19);
  const pale = rgb(0.88, 0.89, 0.91);
  page.drawText("DRAFT TAX INVOICE", { x: 26, y: 720, size: 15, font: fonts.bold, color: red });
  page.drawText("Invoice No: " + invoiceNumber, { x: 26, y: 704, size: 8, font: fonts.bold, color: dark });
  page.drawText("Invoice Date: " + fmtDate(snapshot.invoice_date), { x: 26, y: 690, size: 8, font: fonts.regular, color: dark });
  page.drawText("Payment Status: PAID", { x: 26, y: 676, size: 8, font: fonts.bold, color: dark });
  page.drawText("Order Ref: " + pdfText(snapshot.order_number, 42), { x: 26, y: 662, size: 8, font: fonts.regular, color: dark });
  page.drawText("Place of Supply: " + pdfText(snapshot.place_of_supply.state_name, 40) + " (" + snapshot.place_of_supply.state_code + ")", { x: 26, y: 648, size: 7.6, font: fonts.regular, color: dark });
  page.drawText("Reverse Charge: " + pdfText(snapshot.reverse_charge || "No", 10), { x: 26, y: 635, size: 7.3, font: fonts.regular, color: dark });
  page.drawRectangle({ x: 350, y: 634, width: 219, height: 92, borderColor: pale, borderWidth: 0.8, color: rgb(1, 1, 1) });
  page.drawText("BILL TO", { x: 360, y: 711, size: 8, font: fonts.bold, color: red });
  const recipient = snapshot.recipient || {};
  const lines = [recipient.name, recipient.gstin ? "GSTIN: " + recipient.gstin : "Unregistered customer"]
    .concat(Array.isArray(recipient.address) ? recipient.address : [])
    .concat([[recipient.state_name, recipient.postal_code].filter(Boolean).join(" - ")])
    .filter(Boolean);
  let y = 697;
  for (const line of lines.slice(0, 6)) {
    page.drawText(pdfText(line, 100), { x: 360, y, size: 7.1, font: fonts.regular, color: dark, maxWidth: 198 });
    y -= 11;
  }
  page.drawLine({ start: { x: 26, y: 626 }, end: { x: 569, y: 626 }, thickness: 0.8, color: pale });
  const deliveryAddress = Array.isArray(snapshot.delivery_address) ? snapshot.delivery_address.filter(Boolean) : [];
  const billAddress = Array.isArray(recipient.address) ? recipient.address.filter(Boolean) : [];
  const isSeparateDelivery = deliveryAddress.length > 0 && deliveryAddress.join("|") !== billAddress.join("|");
  if (isSeparateDelivery) {
    const shipText = "SHIP TO: " + deliveryAddress.map((value: unknown) => pdfText(value, 100)).join(", ");
    const shipLines = wrap(shipText, fonts.regular, 7, 540).slice(0, 3);
    let shipY = 610;
    for (const shipLine of shipLines) {
      page.drawText(shipLine, { x: 28, y: shipY, size: 7, font: fonts.regular, color: dark, maxWidth: 540 });
      shipY -= 10;
    }
    return shipY - 2;
  }
  return 612;
}

function drawTableHeader(page: any, fonts: any, top: number): number {
  const columns = [
    [28, "DESCRIPTION / PART NO."], [178, "HSN/SAC"], [228, "QTY"],
    [268, "GROSS UNIT"], [335, "TAXABLE"], [412, "GST"], [474, "AMOUNT"],
  ];
  page.drawRectangle({ x: 26, y: top - 22, width: 543, height: 22, borderColor: rgb(0.75, 0.78, 0.82), borderWidth: 0.5, color: rgb(0.96, 0.97, 0.98) });
  for (const column of columns) {
    page.drawText(column[1], { x: column[0] + 2, y: top - 14, size: 6, font: fonts.bold, color: rgb(0.2, 0.23, 0.27) });
  }
  return top - 22;
}

function drawRow(page: any, fonts: any, line: any, top: number, index: number): number {
  const height = 38;
  const bottom = top - height;
  const border = rgb(0.8, 0.82, 0.85);
  page.drawRectangle({ x: 26, y: bottom, width: 543, height, borderColor: border, borderWidth: 0.4, color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.99, 0.99, 0.99) });
  page.drawText(pdfText(line.description, 120), { x: 30, y: top - 12, size: 7.1, font: fonts.bold, color: rgb(0.14, 0.16, 0.2), maxWidth: 144 });
  if (line.part_number) page.drawText("Part: " + pdfText(line.part_number, 70), { x: 30, y: top - 25, size: 6.2, font: fonts.regular, color: rgb(0.36, 0.39, 0.43), maxWidth: 144 });
  const cells = [
    [180, pdfText(line.hsn_sac_code, 10), 46],
    [230, String(line.quantity) + " " + pdfText(line.unit_code, 8), 36],
    [270, inr(line.unit_rate_inr), 62],
    [337, inr(line.taxable_value_inr), 72],
    [414, String(Number(line.gst_rate_percent).toFixed(2)).replace(/\.00$/, "") + "%", 56],
    [476, inr(line.line_total_inr), 88],
  ];
  for (const cell of cells) page.drawText(cell[1], { x: cell[0], y: top - 20, size: 6.1, font: fonts.regular, color: rgb(0.14, 0.16, 0.2), maxWidth: cell[2] });
  return bottom;
}

function drawTotals(page: any, fonts: any, snapshot: any, yStart: number): number {
  const totals = snapshot.totals;
  const x = 360;
  const right = 569;
  let y = yStart;
  const drawLine = (label: string, value: unknown, strong = false) => {
    const font = strong ? fonts.bold : fonts.regular;
    const size = strong ? 8 : 7;
    page.drawText(label, { x: x + 8, y, size, font, color: rgb(0.18, 0.2, 0.24) });
    const text = inr(value);
    page.drawText(text, { x: right - font.widthOfTextAtSize(text, size) - 8, y, size, font, color: rgb(0.18, 0.2, 0.24) });
    y -= strong ? 18 : 14;
  };
  const rows = [
    ["Taxable Amount", totals.taxable_total],
    ...(Number(totals.cgst_total) > 0 ? [["CGST", totals.cgst_total]] : []),
    ...(Number(totals.sgst_total) > 0 ? [["SGST", totals.sgst_total]] : []),
    ...(Number(totals.igst_total) > 0 ? [["IGST", totals.igst_total]] : []),
    ["Total Tax", totals.tax_total],
  ];
  const height = rows.length * 14 + 34;
  page.drawRectangle({ x, y: y - height + 10, width: 209, height, borderColor: rgb(0.78, 0.8, 0.83), borderWidth: 0.6, color: rgb(1, 1, 1) });
  y -= 8;
  for (const row of rows) drawLine(row[0] as string, row[1]);
  page.drawRectangle({ x, y: y - 7, width: 209, height: 23, color: rgb(0.78, 0.12, 0.14) });
  page.drawText("TOTAL", { x: x + 8, y: y + 1, size: 8.4, font: fonts.bold, color: rgb(1, 1, 1) });
  const total = inr(totals.invoice_total);
  page.drawText(total, { x: right - fonts.bold.widthOfTextAtSize(total, 8.4) - 8, y: y + 1, size: 8.4, font: fonts.bold, color: rgb(1, 1, 1) });
  return y - 34;
}

export async function renderInvoicePdf(invoiceNumber: string, snapshot: Record<string, any>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Draft Tax Invoice " + invoiceNumber + " | Souviks");
  pdf.setAuthor("Souviks - CHANDRANI SADHU");
  pdf.setSubject("Draft GST invoice - authorised signature pending");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };
  const lines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  if (!lines.length) throw new InvoiceError("invoice_lines_missing", 409);

  let page = pdf.addPage([595.28, 841.89]);
  drawHeader(page, fonts, "DRAFT");
  const tableTop = drawTop(page, fonts, snapshot, invoiceNumber);
  let y = drawTableHeader(page, fonts, tableTop);
  let index = 0;
  for (const line of lines) {
    if (y < 150) {
      drawWatermark(page, fonts);
      page = pdf.addPage([595.28, 841.89]);
      drawHeader(page, fonts, "DRAFT");
      page.drawText("DRAFT TAX INVOICE - CONTINUED", { x: 26, y: 720, size: 11, font: bold, color: rgb(0.82, 0.08, 0.1) });
      y = drawTableHeader(page, fonts, 690);
    }
    y = drawRow(page, fonts, line, y, index);
    index += 1;
  }
  if (y < 230) {
    drawWatermark(page, fonts);
    page = pdf.addPage([595.28, 841.89]);
    drawHeader(page, fonts, "DRAFT");
    page.drawText("DRAFT TAX INVOICE - SUMMARY", { x: 26, y: 720, size: 11, font: bold, color: rgb(0.82, 0.08, 0.1) });
    y = 690;
  }
  y = drawTotals(page, fonts, snapshot, Math.max(y - 12, 250));
  const signY = Math.max(y - 22, 105);
  page.drawText("For " + SELLER.legalName + " (Proprietor of Souviks)", { x: 330, y: signY, size: 7.2, font: bold, color: rgb(0.16, 0.18, 0.22) });
  page.drawLine({ start: { x: 390, y: signY - 30 }, end: { x: 555, y: signY - 30 }, thickness: 0.6, color: rgb(0.45, 0.47, 0.5) });
  page.drawText("Authorised Signatory - signature pending", { x: 390, y: signY - 42, size: 6, font: regular, color: rgb(0.38, 0.4, 0.44) });

  const pages = pdf.getPages();
  pages.forEach((current, pageIndex) => {
    drawWatermark(current, fonts);
    drawFooter(current, fonts, pageIndex + 1, pages.length);
  });
  return await pdf.save();
}

async function uploadPdf(path: string, bytes: Uint8Array): Promise<void> {
  const base = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  const headers: Record<string, string> = {
    "apikey": key,
    "Content-Type": "application/pdf",
    "x-upsert": "true",
  };
  if (!key.startsWith("sb_secret_")) headers["Authorization"] = "Bearer " + key;
  const pathValue = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(base + "/storage/v1/object/sales-invoices-private/" + pathValue, {
    method: "POST",
    headers,
    body: bytes,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    console.error("[Sales invoice] Storage upload failed", response.status);
    throw new InvoiceError("invoice_storage_unavailable", 503);
  }
}

async function makeSignedUrl(path: string): Promise<string> {
  const base = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  const headers: Record<string, string> = { "apikey": key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_secret_")) headers["Authorization"] = "Bearer " + key;
  const pathValue = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(base + "/storage/v1/object/sign/sales-invoices-private/" + pathValue, {
    method: "POST",
    headers,
    body: JSON.stringify({ expiresIn: 300, download: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new InvoiceError("invoice_download_unavailable", 503);
  const data = await response.json();
  const signed = String(data?.signedURL || data?.signedUrl || "");
  if (!signed) throw new InvoiceError("invoice_download_unavailable", 503);
  return signed.startsWith("http") ? signed : base + (signed.startsWith("/") ? signed : "/" + signed);
}

export async function prepareInvoiceDraft(gatewayOrderId: string): Promise<Record<string, any>> {
  const order = await loadPaidOrder(gatewayOrderId);
  const invoiceDate = dateInKolkata();
  const fy = financialYear(invoiceDate);
  const existingRows = await supabaseRest("sales_invoices", "GET", {
    select: "id,invoice_number,financial_year,invoice_date,status,signature_status,snapshot,pdf_storage_path,pdf_sha256",
    order_id: "eq." + order.id,
    limit: "1",
  });
  let invoice = Array.isArray(existingRows) ? existingRows[0] : null;
  if (!invoice) {
    const snapshot = await buildSnapshot(order, invoiceDate);
    const draft = await supabaseRest("rpc/create_sales_invoice_draft", "POST", {}, {
      p_order_id: order.id,
      p_financial_year: fy,
      p_invoice_date: invoiceDate,
      p_snapshot: snapshot,
    });
    invoice = Array.isArray(draft) ? draft[0] : draft;
    if (!invoice?.invoice_id || !invoice?.invoice_number || !invoice?.snapshot) {
      throw new InvoiceError("invoice_draft_creation_failed", 503);
    }
  }
  let storagePath = String(invoice.pdf_storage_path || "");
  if (!storagePath) {
    const bytes = await renderInvoicePdf(String(invoice.invoice_number), invoice.snapshot);
    const digestBytes = await crypto.subtle.digest("SHA-256", bytes);
    const digest = Array.from(new Uint8Array(digestBytes)).map((value) => value.toString(16).padStart(2, "0")).join("");
    storagePath = String(invoice.financial_year) + "/" + String(invoice.invoice_number) + ".pdf";
    await uploadPdf(storagePath, bytes);
    await supabaseRest("sales_invoices", "PATCH", { id: "eq." + invoice.invoice_id }, {
      pdf_storage_path: storagePath,
      pdf_sha256: digest,
      pdf_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, "return=minimal");
  }
  const url = await makeSignedUrl(storagePath);
  return {
    invoice_id: String(invoice.invoice_id || invoice.id),
    invoice_number: String(invoice.invoice_number),
    status: String(invoice.status || "draft"),
    signature_status: String(invoice.signature_status || "pending"),
    pdf_storage_path: storagePath,
    pdf_url: url,
    snapshot: invoice.snapshot,
  };
}

export async function getInvoiceOrder(gatewayOrderId: string): Promise<any> {
  return await loadPaidOrder(gatewayOrderId);
}
