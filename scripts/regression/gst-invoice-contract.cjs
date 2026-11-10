#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const migration = read("supabase/migrations/20261110150000_gst_invoice_generator.sql");
const invoice = read("supabase/functions/gst-invoice/index.ts");
const checkout = read("supabase/functions/cashfree-create-order/index.ts");
const shared = read("supabase/functions/_shared/cashfree.ts");
const account = read("supabase/functions/account-orders/index.ts");
const accountUi = read("assets/js/account/auth-orders.js");
const cartUi = read("assets/js/cart/cart.js");
const pageGenerator = read("scripts/catalogue/sync_checkout_pages.py");
const config = read("supabase/config.toml");

for (const column of [
  "billing_address_line1","billing_city","billing_state_code","billing_postal_code","shipping_state_code",
  "gst_rate_percent","gst_cgst_rate_percent","gst_sgst_rate_percent","gst_igst_rate_percent",
  "gst_rate_effective_from","gst_rate_source_reference","gst_rate_basis","gst_rate_candidate_approved",
]) assert.ok(migration.includes("add column if not exists " + column), "Missing invoice snapshot column: " + column);

assert.match(migration, /create table if not exists public\.gst_invoice_sequences/);
assert.match(migration, /create table if not exists public\.gst_invoices/);
assert.match(migration, /alter table public\.gst_invoice_sequences enable row level security/);
assert.match(migration, /alter table public\.gst_invoices enable row level security/);
assert.match(migration, /revoke all on table public\.gst_invoices from public, anon, authenticated/);
assert.match(migration, /revoke all on table public\.gst_invoice_sequences from public, anon, authenticated/);
assert.match(migration, /revoke all on function public\.reserve_gst_invoice\(uuid, text, jsonb\) from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.reserve_gst_invoice\(uuid, text, jsonb\) to service_role/);
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = pg_catalog, public/i);
assert.match(migration, /char_length\(invoice_number\) <= 16/);
assert.match(migration, /'SVK\/' \|\| right\(p_financial_year, 5\) \|\| '\/'/);
assert.match(migration, /insert into storage\.buckets[\s\S]*'gst-invoices',[\s\S]*false/);

assert.match(invoice, /npm:pdf-lib@1\.17\.1/);
assert.match(invoice, /GST_INVOICE_ISSUANCE_ENABLED/);
assert.match(invoice, /GST_INVOICE_SELLER_IDENTITY_VERIFIED/);
assert.match(invoice, /GST_INVOICE_ELECTRONIC_ISSUANCE_APPROVED/);
assert.match(invoice, /GST_INVOICE_REVERSE_CHARGE_APPROVED/);
assert.match(invoice, /GST_INVOICE_UQC_APPROVED/);
assert.match(invoice, /GST_INVOICE_DEFAULT_UQC/);
assert.match(invoice, /GST_INVOICE_SELLER_GSTIN/);
assert.match(invoice, /GST_FREIGHT_APPROVAL_STATUS/);
assert.match(invoice, /GST_FREIGHT_SAC/);
assert.match(invoice, /GST_FREIGHT_RATE_PERCENT/);
assert.match(invoice, /GST_FREIGHT_PRICE_INCLUDES_GST/);
assert.match(invoice, /reserve_gst_invoice/);
assert.match(invoice, /financialYear|indiaFinancialYear/);
assert.match(invoice, /timeZone: "Asia\/Kolkata"/);
assert.match(invoice, /hsn_classification_status !== "classified"/);
assert.match(invoice, /hsn_confidence !== "high"/);
assert.match(invoice, /gst_rate_candidate_approved/);
assert.match(invoice, /gst_rate_effective_from/);
assert.match(invoice, /candidate_for_accountant_review/);
assert.match(invoice, /tax_included !== true/);
assert.match(invoice, /order\.payment_status !== "paid"/);
assert.match(invoice, /shipping_state_code/);
assert.match(invoice, /place_of_supply_state_code/);
assert.match(invoice, /getSupabaseServiceKey/);
assert.match(invoice, /constantTimeEqual\(auth,getSupabaseServiceKey\(\)\)/);
assert.match(invoice, /optionalUserId\(req\)/);
assert.match(invoice, /token_hash:"eq\."\+hash/);
assert.match(invoice, /expires_at:"gt\."/);
assert.match(invoice, /invoice_status:"issued"/);
assert.match(invoice, /expiresIn:300/);
assert.match(invoice, /\/storage\/v1\//);
assert.match(invoice, /invoice_number.*already_issued/);
assert.doesNotMatch(invoice, /Computer-generated electronic tax invoice\. No separate DSC applied/);

assert.match(checkout, /billing_address/);
assert.match(checkout, /billing_state_code/);
assert.match(checkout, /valid_billing_address_required/);
assert.match(checkout, /gstNumber\.slice\(0, 2\) !== billingStateCode/);
assert.match(checkout, /gst_rate_candidate_approved: gstCandidateApproved/);
assert.match(checkout, /hsnInvoiceReady/);
assert.match(checkout, /shipping_state_code:/);
assert.match(checkout, /freight_tax_treatment_not_approved/);
assert.match(checkout, /invoice_release_controls_incomplete/);

assert.match(shared, /attemptGstInvoiceIssue/);
assert.match(shared, /functions\/v1\/gst-invoice/);
assert.match(shared, /await attemptGstInvoiceIssue\(gatewayOrderId\)/);
assert.match(account, /gst_invoices/);
assert.match(account, /invoice_status/);
assert.match(accountUi, /functions\.invoke\("gst-invoice"/);
assert.match(accountUi, /order\.invoice_status === "issued"/);
assert.match(cartUi, /checkout-billing-address1/);
assert.match(cartUi, /checkout-billing-state/);
assert.match(cartUi, /payment-status-invoice/);
assert.doesNotMatch(cartUi, /sessionStorage\.removeItem\(TOKEN_KEY_PREFIX \+ orderId\)/, "Guest checkout capability must remain available for the invoice download window.");
assert.match(pageGenerator, /checkout-billing-state/);
assert.match(pageGenerator, /invoice_download/);
assert.match(config, /\[functions\.gst-invoice\]\s*verify_jwt\s*=\s*false/);

console.log("GST invoice contract passed: private PDF generation, server-only numbering, immutable tax snapshots, place-of-supply control, HSN/GST gates, and owner/capability-based downloads.");
