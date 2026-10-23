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
const failureMigration = read("supabase/migrations/20261022100000_cashfree_payment_failure_reason.sql");
const fulfillmentMigration = read("supabase/migrations/20261023130000_checkout_fulfillment_method.sql");
const cart = read("assets/js/cart/cart.js");
const staticCard = read("scripts/catalogue/product_card.py");
const runtimeCard = read("assets/js/components/product-card.js");
const pageGenerator = read("scripts/catalogue/sync_checkout_pages.py");
const productActions = read("scripts/catalogue/sync_product_actions.py");
const moduleSync = read("scripts/catalogue/sync_checkout_module.py");
const nav = read("scripts/catalogue/navigation.py");
const versions = read("scripts/js/refresh_versions.py");
const validator = read("scripts/js/validate.py");
const siteCore = read("assets/js/site-core.js");
const securityPolicies = ["_headers", "functions/_middleware.js", "functions/robots.txt.js"].map(read);

assert.match(shared, /CASHFREE_API_VERSION\s*=\s*"2026-01-01"/);
assert.ok(siteCore.includes('toggle&&menu&&toggle.addEventListener("click"'), "Language switcher binding must be guarded when the control is absent.");
for (const policy of securityPolicies) {
  assert.ok(policy.includes("script-src") && policy.includes("https://sdk.cashfree.com"), "CSP must allow the Cashfree SDK script.");
  assert.ok(policy.includes("connect-src") && policy.includes("https://api.cashfree.com"), "CSP must allow Cashfree API connections.");
  assert.ok(policy.includes("connect-src") && policy.includes("https://sdk.cashfree.com"), "CSP must allow Cashfree SDK source-map connections.");
  assert.ok(policy.includes("form-action") && policy.includes("https://sandbox.cashfree.com"), "CSP must allow the Cashfree Sandbox hosted-checkout form submission.");
  assert.ok(policy.includes("form-action") && policy.includes("https://payments.cashfree.com"), "CSP must allow the Cashfree hosted checkout form submission.");
  assert.ok(policy.includes("frame-src") && policy.includes("https://payments-test.cashfree.com"), "CSP must allow Cashfree payment frames.");
}

assert.match(shared, /CASHFREE_CHECKOUT_ENABLED/);
assert.match(shared, /CASHFREE_ENABLE_LIVE_CHECKOUT/);
assert.match(shared, /CASHFREE_PRICES_INCLUDE_GST/);
assert.doesNotMatch(shared, /CASHFREE_FREE_SHIPPING_THRESHOLD_INR/);
assert.ok(shared.includes('Deno.env.get("CASHFREE_PRODUCTION_CLIENT_ID")'), "Production mode must use its own Client ID.");
assert.ok(shared.includes('Deno.env.get("CASHFREE_PRODUCTION_CLIENT_SECRET")'), "Production mode must use its own Client Secret.");
assert.ok(shared.includes('Deno.env.get("CASHFREE_CLIENT_ID")'), "Sandbox mode must continue using the Sandbox Client ID.");
assert.ok(shared.includes('Deno.env.get("CASHFREE_CLIENT_SECRET")'), "Sandbox mode must continue using the Sandbox Client Secret.");
assert.match(shared, /export function assertLiveCheckoutApproved/);
assert.match(shared, /raw\.githubusercontent\.com\/mssouviks-tech\/souviks-website\/main\/assets\/data\/catalogue-index\.json/);
assert.match(shared, /verifyCashfreeWebhookSignature/);
assert.match(shared, /x-client-secret/);
assert.match(shared, /cashfree_checkout_rate_limit/);
assert.match(shared, /Prefer Supabase's current secret-key dictionary/);
assert.match(shared, /if \(!key\.startsWith\("sb_secret_"\)\) headers\["Authorization"\]/);
assert.match(shared, /order_amount/);
assert.match(shared, /cashfree_order_status.*"PAID"/s);
assert.match(shared, /order_status: order\.order_status === "awaiting_payment" \? "processing"/);

assert.match(createOrder, /fetchCatalogue\(config\)/);
assert.match(createOrder, /Number\(product\.selling_price\)/);
assert.doesNotMatch(createOrder, /Number\(input\.(?:price|unit_price|total_amount|subtotal)\)/);
assert.match(createOrder, /terms_accepted !== true/);
assert.match(createOrder, /input\?\.fulfillment_method/);
assert.match(createOrder, /fulfillmentMethod === "pickup"/);
assert.match(createOrder, /fulfillment_method: fulfillmentMethod/);
assert.match(createOrder, /shipping_address_line1: fulfillmentMethod === "delivery" \? address1 : null/);
assert.match(fulfillmentMigration, /add column if not exists fulfillment_method text not null default 'delivery'/);
assert.match(fulfillmentMigration, /shipping_postal_code drop not null/);
assert.match(createOrder, /country !== "IN"/);
assert.ok(createOrder.includes("assertLiveCheckoutApproved(config)"), "Only new order creation must enforce the live-checkout gate.");
assert.match(createOrder, /if \(fulfillmentMethod === "pickup"\)/);
assert.match(createOrder, /else if \(hasCompleteWeights\)/);
assert.doesNotMatch(createOrder, /policy\.threshold|CASHFREE_FREE_SHIPPING_THRESHOLD_INR/);
assert.match(createOrder, /calculateDelhiveryPrepaidCharge\(postalCode, estimatedWeightGrams\)/);
assert.match(createOrder, /delhivery_shipping_weights_missing/);
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
assert.match(cart, /name="fulfillment_method"/);
assert.match(cart, /pickupShipping/);
assert.match(pageGenerator, /checkout-fulfillment-pickup/);
assert.match(pageGenerator, /checkout-delivery-fields/);
assert.match(cart, /cashfree-create-order/);
assert.match(cart, /cashfree-verify-order/);
assert.match(cart, /payment_status === "paid"/);
assert.match(cart, /add-to-purchase-cart/);
assert.match(cart, /checkout_token/);
assert.doesNotMatch(cart, /CASHFREE_CLIENT_SECRET|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i);

assert.match(staticCard, /product-card-purchase-controls/);
assert.match(staticCard, /data-product-quantity/);
assert.match(staticCard, /data-product-qty-increase/);
assert.match(staticCard, /add-to-purchase-cart/);
assert.match(staticCard, /product-request-part-link/);
assert.match(staticCard, /selling is not None/);
assert.doesNotMatch(staticCard, /add-to-cart/);
assert.match(runtimeCard, /product-card-purchase-controls/);
assert.match(runtimeCard, /data-product-quantity/);
assert.match(runtimeCard, /data-product-qty-increase/);
assert.match(runtimeCard, /add-to-purchase-cart/);
assert.match(runtimeCard, /product-request-part-link/);
assert.doesNotMatch(runtimeCard, /add-to-cart/);
assert.doesNotMatch(runtimeCard, /Add To RFQ/);
assert.match(productActions, /pdp-add-to-purchase-cart/);
assert.match(productActions, /pdp-request-part-link/);
assert.match(productActions, /selling_price/);
assert.match(cart, /data-product-qty-increase/);
assert.match(cart, /closest\("\.product-card"\)\?\.querySelector\("\[data-product-quantity\]"\)/);
// Legacy static PDPs may still contain the old RFQ controls. The compatibility
// normalizer removes both, replaces the action with Cart/Request a Part, and
// fails closed if only the orphaned remove control remains.
assert.match(cart, /legacyRfqButton\?\.remove\(\)/);
assert.match(cart, /legacyRemoveButton\?\.remove\(\)/);
assert.match(cart, /if \(!legacyRfqButton\)/);
assert.match(cart, /quantityControls\?\.remove\(\)/);

assert.match(pageGenerator, /ROOT \/ lang \/ "cart\.html"/);
assert.match(pageGenerator, /ROOT \/ lang \/ "payment-status\.html"/);
assert.match(pageGenerator, /window\.souviks =/);
assert.match(pageGenerator, /currentLanguage: "__LANG__"/);
assert.match(pageGenerator, /href="\/__LANG__\/terms"/);
assert.match(pageGenerator, /href="\/__LANG__\/refund"/);
assert.match(pageGenerator, /return 0/);
assert.match(moduleSync, /return 0/);
assert.ok(nav.includes('"header_cart": "Cart"'), "English checkout Cart label is missing.");
assert.ok(nav.includes('"header_cart": "কার্ট"'), "Bengali checkout Cart label is missing.");
assert.ok(nav.includes('"header_cart": "कार्ट"'), "Hindi checkout Cart label is missing.");
assert.ok(nav.includes('href="/{lang}/cart"'), "Site-wide header does not link to the checkout Cart.");
assert.doesNotMatch(nav, /\("request-part", "Request a Part", "request-part"\)/, "Request a Part must not occupy the primary menu.");

assert.ok(shared.includes("allTerminalFailures"), "Terminal failed payment attempts must update the payment status.");
assert.ok(shared.includes("payment_failure_reason: failureReason"), "The provider decline reason must be saved with the order.");
assert.ok(shared.includes("payment_failure_code: failureCode"), "The provider decline code must be saved with the order.");
assert.ok(cart.includes("data.payment_failure_reason"), "The payment status page must show a provider failure reason.");
assert.match(failureMigration, /add column if not exists payment_failure_code/);
assert.match(failureMigration, /add column if not exists payment_failure_reason/);
console.log("Cashfree checkout contract OK: server-side prices, order storage, secure verification, checkout-cart actions, and direct Request a Part for unpriced products.");
