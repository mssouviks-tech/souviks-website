#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = p => fs.readFileSync(path.join(root,p),"utf8");

const migration = read("supabase/migrations/20261111000000_gst_invoice_generator.sql");
const invoice = read("supabase/functions/gst-invoice/index.ts");
const create = read("supabase/functions/cashfree-create-order/index.ts");
const shared = read("supabase/functions/_shared/cashfree.ts");
const orders = read("supabase/functions/account-orders/index.ts");
const cart = read("assets/js/cart/cart.js");
const pageBuilder = read("scripts/catalogue/sync_checkout_pages.py");
const accountUi = read("assets/js/account/auth-orders.js");
const config = read("supabase/config.toml");

for (const column of [
  "billing_address_line1","billing_city","billing_state_code","billing_postal_code","shipping_state_code",
]) assert.match(migration,new RegExp("add column if not exists "+column));
for (const column of [
  "gst_rate_percent","gst_cgst_rate_percent","gst_sgst_rate_percent","gst_igst_rate_percent",
  "gst_rate_effective_from","gst_rate_source_reference","gst_rate_basis","gst_rate_candidate_approved",
]) assert.match(migration,new RegExp("add column if not exists "+column));
assert.match(migration,/create table if not exists public\.gst_invoice_sequences/);
assert.match(migration,/create table if not exists public\.gst_invoices/);
assert.match(migration,/order_id uuid not null unique references public\.orders/);
assert.match(migration,/char_length\(invoice_number\) <= 16/);
assert.match(migration,/pg_advisory_xact_lock/);
assert.match(migration,/reserve_gst_invoice/);
assert.match(migration,/revoke all on function public\.reserve_gst_invoice.*from public, anon, authenticated/s);
assert.match(migration,/grant execute on function public\.reserve_gst_invoice.*to service_role/s);
assert.match(migration,/values \('gst-invoices', 'gst-invoices', false/);
assert.match(migration,/alter table public\.gst_invoices enable row level security/);
assert.match(migration,/revoke all on table public\.gst_invoices from public, anon, authenticated/);
assert.match(migration,/'SVK\/' \|\| right\(p_financial_year,5\)/);

assert.match(create,/billing_address_line1: billingAddress1/);
assert.match(create,/shipping_state_code: fulfillmentMethod === "delivery" \? shippingStateCode : null/);
assert.match(create,/fetchCatalogue\(config\)/);
assert.match(create,/gst_rate_candidate_approved: gstCandidateApproved/);
assert.match(create,/gst_rate_percent:/);
assert.match(create,/Number\(product\.selling_price\)/);
assert.match(create,/hsnInvoiceReady/);
assert.match(create,/freight_tax_treatment_not_approved/);
assert.doesNotMatch(create,/Number\(input\.(?:price|unit_price|total_amount|subtotal)\)/);
assert.match(cart,/billing_address: billingAddress/);
assert.match(cart,/checkout-billing-state/);
assert.match(pageBuilder,/BILLING_DETAILS/);
assert.match(pageBuilder,/payment-status-invoice/);
assert.match(cart,/functions\.invoke\("gst-invoice"/);
assert.match(cart,/sessionStorage\.getItem\(TOKEN_KEY_PREFIX \+ orderId\)/);

assert.match(invoice,/PDFDocument\.create/);
assert.match(invoice,/order\.payment_status !== "paid"/);
assert.match(invoice,/item\.hsn_classification_status !== "classified"/);
assert.match(invoice,/item\.hsn_confidence !== "high"/);
assert.match(invoice,/item\.gst_rate_candidate_approved === true/);
assert.match(invoice,/GST_INVOICE_SELLER_IDENTITY_VERIFIED/);
assert.match(invoice,/GST_INVOICE_ELECTRONIC_ISSUANCE_APPROVED/);
assert.match(invoice,/GST_FREIGHT_APPROVAL_STATUS/);
assert.match(invoice,/gst_rate_percent/);
assert.match(invoice,/Math\.round\(grossPaise \* 10000 \/ \(10000 \+ basisPoints\)\)/);
assert.match(invoice,/order\.fulfillment_method === "delivery"/);
assert.match(invoice,/seller\.state_code/);
assert.match(invoice,/object\/sign\/gst-invoices/);
assert.match(invoice,/expiresIn:300/);
assert.match(invoice,/pdf_sha256/);
assert.match(invoice,/constantTimeEqual\(auth,getSupabaseServiceKey\(\)\)/);
assert.match(invoice,/action==="issue"/);
assert.match(invoice,/action==="download"/);
assert.match(invoice,/order\.user_id===userId/);
assert.match(invoice,/checkout_access_tokens/);
assert.match(invoice,/await issueInvoice\(orderId\)/);
assert.match(invoice,/SVK\/|invoice_number/);
assert.doesNotMatch(invoice,/private key|BEGIN PRIVATE KEY/);

assert.match(shared,/export async function attemptGstInvoiceIssue/);
assert.match(shared,/GST_INVOICE_ISSUANCE_ENABLED/);
assert.match(shared,/attemptGstInvoiceIssue\(gatewayOrderId\)/);
assert.match(orders,/attemptGstInvoiceIssue/);
assert.match(orders,/gst_invoices/);
assert.match(orders,/invoice_status:/);
assert.match(accountUi,/functions\.invoke\("gst-invoice"/);
assert.match(accountUi,/T\.invoice/);
assert.match(config,/\[functions\.gst-invoice\]\s*verify_jwt\s*=\s*false/);

for (const lang of ["en","hi","bn"]) {
  const html = read(lang + "/account.html");
  assert.ok(html.includes('id="accountOrdersList"'),lang+" account order list missing");
}
console.log("GST invoice contract OK: immutable paid-order issuance, invoice numbering, GST snapshots, HSN/freight/seller gates, private storage, signed download and customer-scoped access.");
