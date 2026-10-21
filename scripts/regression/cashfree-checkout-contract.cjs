#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

const shared = read("supabase/functions/_shared/cashfree.ts");
const createOrder = read("supabase/functions/cashfree-create-order/index.ts");
const verifyOrder = read("supabase/functions/cashfree-verify-order/index.ts");
const webhook = read("supabase/functions/cashfree-webhook/index.ts");
const migration = read("supabase/migrations/20261021200000_cashfree_checkout.sql");
const cart = read("assets/js/cart/cart.js");
const staticCard = read("scripts/catalogue/product_card.py");
const runtimeCard = read("assets/js/components/product-card.js");
const pageGenerator = read("scripts/catalogue/sync_checkout_pages.py");
const moduleSync = read("scripts/catalogue/sync_checkout_module.py");
const nav = read("scripts/catalogue/navigation.py");
const versions = read("scripts/js/refresh_versions.py");
const validator = read("scripts/js/validate.py");

assert.match(shared, /CASHFREE_API_VERSION\s*=\s*"2026-01-01"/);
assert.match(shared, /CASHFREE_CHECKOUT_ENABLED/);
assert.match(shared, /CASHFREE_ENABLE_LIVE_CHECKOUT/);
assert.match(shared, /CASHFREE_PRICES_INCLUDE_GST/);
assert.match(shared, /CASHFREE_FREE_SHIPPING_THRESHOLD_INR/);
assert.match(shared, /CASHFREE_SHIPPING_UNDER_THRESHOLD_INR/);
assert.match(shared, /raw\.githubusercontent\.com\/mssouviks-tech\/souviks-website\/main\/assets\/data\/catalogue-index\.json/);
assert.match(shared, /verifyCashfreeWebhookSignature/);
assert.match(shared, /x-client-secret/);
assert.match(shared, /cashfree_checkout_rate_limit/);
assert.match(shared, /order_amount/);
assert.match(shared, /cashfree_order_status.*"PAID"/s);
assert.match(shared, /order_status: order\.order_status === "awaiting_payment" \? "processing"/);

assert.match(createOrder, /fetchCatalogue\(config\)/);
assert.match(createOrder, /Number\(product\.selling_price\)/);
assert.doesNotMatch(createOrder, /Number\(input\.(?:price|unit_price|total_amount|subtotal)\)/);
assert.match(createOrder, /terms_accepted !== true/);
assert.match(createOrder, /country !== "IN"/);
assert.match(createOrder, /checkout_access_tokens/);
assert.match(createOrder, /payment_session_id/);
assert.match(verifyOrder, /token_hash: "eq\." \+ tokenHash/);
assert.match(verifyOrder, /reconcileCashfreeOrder\(orderId\)/);
assert.match(webhook, /x-webhook-signature/);
assert.match(webhook, /x-webhook-timestamp/);
assert.match(webhook, /verifyCashfreeWebhookSignature\(/);
assert.match(webhook, /await reconcileCashfreeOrder\(gatewayOrderId\)/);
assert.match(webhook, /successEvent && result\.payment_status !== "paid"/);

for (const table of [
  "orders", "order_items", "checkout_access_tokens",
  "cashfree_payment_events", "cashfree_checkout_rate_limits",
]) {
  assert.match(migration, new RegExp("create table if not exists public\\." + table + "\\b"));
  assert.match(migration, new RegExp("alter table public\\." + table + " enable row level security"));
  assert.match(migration, new RegExp("revoke all on table public\\." + table + " from public, anon, authenticated"));
}
assert.match(migration, /security invoker/i);
assert.match(migration, /grant execute on function public\.cashfree_checkout_rate_limit.*to service_role/s);

assert.match(cart, /souviks_purchase_cart_v1/);
assert.match(cart, /cashfree-create-order/);
assert.match(cart, /cashfree-verify-order/);
assert.match(cart, /payment_status === "paid"/);
assert.match(cart, /add-to-purchase-cart/);
assert.match(cart, /checkout_token/);
assert.doesNotMatch(cart, /CASHFREE_CLIENT_SECRET|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i);

assert.match(staticCard, /add-to-purchase-cart/);
assert.match(staticCard, /add-to-cart/);
assert.match(runtimeCard, /add-to-purchase-cart/);
assert.match(runtimeCard, /class="btn btn-primary add-to-cart"/);
assert.match(pageGenerator, /ROOT \/ lang \/ "cart\.html"/);
assert.match(pageGenerator, /ROOT \/ lang \/ "payment-status\.html"/);
assert.match(pageGenerator, /window\.souviks =/);
assert.match(pageGenerator, /currentLanguage: "__LANG__"/);
assert.match(pageGenerator, /href="\/__LANG__\/terms"/);
assert.match(pageGenerator, /href="\/__LANG__\/refund"/);
assert.match(pageGenerator, /return 0/);
assert.match(moduleSync, /return 0/);
assert.match(nav, /"cart", "Shopping Cart", "cart"/);
assert.match(nav, /"cart", "কার্ট", "cart"/);
assert.match(nav, /"cart", "कार्ट", "cart"/);
assert.match(versions, /components\|cart/);
assert.match(validator, /components\|cart/);

console.log("Cashfree checkout contract OK: server-side prices, disabled-by-default policy, order storage, guest-token verification, signed webhook, and RFQ coexistence.");
