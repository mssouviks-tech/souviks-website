#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const migration = read("supabase/migrations/20261104180000_gst_sales_invoices.sql");
const invoice = read("supabase/functions/_shared/gst-invoice.ts");
const endpoint = read("supabase/functions/sales-invoice/index.ts");
const createOrder = read("supabase/functions/cashfree-create-order/index.ts");
const config = read("supabase/config.toml");
const cart = read("assets/js/cart/cart.js");
const accountOrders = read("assets/js/account/auth-orders.js");
const checkoutGenerator = read("scripts/catalogue/sync_checkout_pages.py");
const accountCss = read("assets/css/bundles/account.css");
const cartCss = read("assets/css/bundles/cart.css");

assert.match(migration, /add column if not exists billing_same_as_shipping/);
assert.match(migration, /add column if not exists billing_address_line1/);
assert.match(migration, /create table if not exists public\.gst_tax_profiles/);
assert.match(migration, /profile_id uuid primary key/);
assert.match(migration, /unique \(profile_key, valid_from\)/);
assert.match(migration, /unit_code text,/);
assert.match(migration, /reverse_charge_applicable boolean/);
assert.match(migration, /cess_applicable boolean/);
assert.match(migration, /approval_status text not null default 'pending'/);
assert.match(migration, /source_reference/);
assert.match(migration, /approved_by/);
assert.match(migration, /approved_at/);
assert.match(migration, /create table if not exists public\.sales_invoice_sequences/);
assert.match(migration, /create table if not exists public\.sales_invoices/);
assert.match(migration, /unique references public\.orders\(id\)/);
assert.match(migration, /invoice_number varchar\(16\) not null unique/);
assert.match(migration, /invoice_number := 'SVKS\/'/);
assert.match(migration, /payment_status <> 'paid'/);
assert.match(migration, /tax_included is distinct from true/);
assert.match(migration, /values \('sales-invoices-private', 'sales-invoices-private', false/);
assert.match(migration, /revoke all on table public\.sales_invoices from public, anon, authenticated/);
assert.match(migration, /grant select, insert, update, delete on table public\.sales_invoices to service_role/);
assert.match(migration, /status = 'issued'/);
assert.match(migration, /signature_status = 'signed'/);
assert.match(migration, /p_signature_reference/);
assert.doesNotMatch(migration, /insert into public\.gst_tax_profiles/i, "No GST rate or HSN/SAC profile may be pre-approved or seeded.");

assert.match(invoice, /payment_status.*paid/);
assert.match(invoice, /tax_included !== true/);
assert.match(invoice, /approval_status !== "approved"/);
assert.match(invoice, /!profile\.source_reference/);
assert.match(invoice, /!profile\.approved_by/);
assert.match(invoice, /!profile\.approved_at/);
assert.match(invoice, /amount_includes_gst !== true/);
assert.match(invoice, /typeof profile\.reverse_charge_applicable !== "boolean"/);
assert.match(invoice, /typeof profile\.cess_applicable !== "boolean"/);
assert.match(invoice, /invoice_reverse_charge_not_supported/);
assert.match(invoice, /invoice_cess_not_supported/);
assert.match(invoice, /order: "valid_from.desc"/);
assert.match(invoice, /profiles\.get\("FREIGHT"\)/);
assert.match(invoice, /invoice_tax_profile_missing/);
assert.match(invoice, /function calculateTax/);
assert.match(invoice, /100 \+ rate/);
assert.match(invoice, /DRAFT TAX INVOICE/);
assert.match(invoice, /DRAFT - AUTHORISED SIGNATURE PENDING/);
assert.match(invoice, /Authorised Signatory - signature pending/);
assert.match(invoice, /sales-invoices-private/);
assert.match(invoice, /expiresIn: 300/);
assert.match(invoice, /sha256/);
assert.doesNotMatch(invoice, /\.mrp\b|\.mrp_inr\b/, "MRP must not be used as an invoice tax rate or amount basis.");

assert.match(endpoint, /getInvoiceOrder\(orderId\)/);
assert.match(endpoint, /optionalUserId\(req\)/);
assert.match(endpoint, /checkout_access_tokens/);
assert.match(endpoint, /token_hash: "eq\." \+ tokenHash/);
assert.match(endpoint, /prepareInvoiceDraft\(orderId\)/);
assert.match(endpoint, /signature_status/);
assert.match(endpoint, /pdf_url/);
assert.match(config, /\[functions\.sales-invoice\]\s*verify_jwt\s*=\s*false/);

assert.match(createOrder, /billing_same_as_shipping: billingSameAsShipping/);
assert.match(createOrder, /billing_address_line1: billingAddress1/);
assert.match(createOrder, /valid_indian_billing_address_required/);

assert.match(cart, /checkout-billing-same/);
assert.match(cart, /billing_same_as_shipping: billingSameAsShipping/);
assert.match(cart, /billing_address: billingAddress/);
assert.match(cart, /functions\.invoke\("sales-invoice"/);
assert.match(cart, /payment-status-invoice/);
assert.match(cart, /sessionStorage\.setItem\(TOKEN_KEY_PREFIX/);
assert.doesNotMatch(cart, /sessionStorage\.removeItem\(TOKEN_KEY_PREFIX \+ orderId\)/,
    "The short-lived guest token must survive verified payment so it can authorise invoice download.");

assert.match(accountOrders, /downloadDraftInvoice/);
assert.match(accountOrders, /functions\.invoke\("sales-invoice"/);
assert.match(accountOrders, /window\.location\.assign\(String\(result\.data\.pdf_url\)\)/);
assert.match(accountCss, /\.account-order-invoice-actions/);
assert.match(cartCss, /\.payment-status-invoice-note/);
assert.match(checkoutGenerator, /checkout-billing-same/);
assert.match(checkoutGenerator, /billing_pickup/);
for (const language of ["en", "hi", "bn"]) {
  const statusPage = read(language + "/payment-status.html");
  const cartPage = read(language + "/cart.html");
  const accountPage = read(language + "/account.html");
  assert.match(statusPage, /id="payment-status-invoice"/, language + " payment-status invoice button missing");
  assert.match(cartPage, /id="checkout-billing-same"/, language + " billing address toggle missing");
  assert.match(accountPage, /auth-orders\.js/, language + " account order invoice action module missing");
}
console.log("GST invoice contract OK: paid-order gating, approved tax profiles, private draft PDFs, order ownership, billing-address separation and multilingual customer downloads.");
