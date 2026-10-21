import {
  cashfreeConfig,
  checkoutPolicy,
  CheckoutError,
  cashfreeRequest,
  enforceCheckoutRateLimit,
  fetchCatalogue,
  jsonResponse,
  optionalUserId,
  sha256Hex,
  supabaseRest,
  allowedOrigin,
} from "../_shared/cashfree.ts";

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

function money(paise: number): number {
  return Math.round(paise) / 100;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function errorPayload(error: unknown): { code: string; status: number } {
  if (error instanceof CheckoutError) return { code: error.code, status: error.status };
  console.error("[Cashfree create-order] Unexpected checkout error");
  return { code: "checkout_temporarily_unavailable", status: 503 };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    const configMode = (Deno.env.get("CASHFREE_MODE") || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox";
    if (!allowedOrigin(origin, configMode)) return new Response("Origin not allowed", { status: 403 });
    return jsonResponse(req, { ok: true });
  }
  if (req.method !== "POST") return jsonResponse(req, { code: "method_not_allowed" }, 405);

  const mode = (Deno.env.get("CASHFREE_MODE") || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox";
  if (!allowedOrigin(origin, mode)) return jsonResponse(req, { code: "origin_not_allowed" }, 403);

  let createdOrderId = "";
  try {
    const config = cashfreeConfig();
    const policy = checkoutPolicy();
    const input = await req.json();
    await enforceCheckoutRateLimit(req, config);

    if (input?.terms_accepted !== true) throw new CheckoutError("terms_acceptance_required", 400);
    const lang = ["en", "hi", "bn"].includes(String(input?.language || "")) ? String(input.language) : "en";
    const customer = input?.customer && typeof input.customer === "object" ? input.customer : {};
    const address = input?.shipping_address && typeof input.shipping_address === "object" ? input.shipping_address : {};

    const customerName = clean(customer.name, 100);
    const customerEmail = clean(customer.email, 254).toLowerCase();
    const rawPhone = clean(customer.phone, 30).replace(/[^0-9]/g, "");
    const customerPhone = rawPhone.length === 12 && rawPhone.startsWith("91") ? rawPhone.slice(2) : rawPhone;
    const company = clean(customer.company, 160);
    const gstNumber = clean(customer.gst_number, 15).toUpperCase();
    const address1 = clean(address.line1, 180);
    const address2 = clean(address.line2, 120);
    const city = clean(address.city, 100);
    const state = clean(address.state, 100);
    const postalCode = clean(address.postal_code, 6);
    const country = clean(address.country || "IN", 2).toUpperCase();

    if (customerName.length < 2) throw new CheckoutError("customer_name_required", 400);
    if (!/^\d{10}$/.test(customerPhone)) throw new CheckoutError("valid_indian_phone_required", 400);
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new CheckoutError("valid_email_required", 400);
    if (!address1 || !city || !state || !/^\d{6}$/.test(postalCode) || country !== "IN") {
      throw new CheckoutError("valid_indian_shipping_address_required", 400);
    }
    if (gstNumber && !/^[0-9A-Z]{15}$/.test(gstNumber)) throw new CheckoutError("valid_gst_number_required", 400);

    const itemsInput = input?.items;
    if (!Array.isArray(itemsInput) || itemsInput.length < 1) throw new CheckoutError("cart_empty", 400);
    if (itemsInput.length > 50) throw new CheckoutError("cart_too_large", 400);

    const requested = new Map<string, number>();
    for (const item of itemsInput) {
      const productId = clean(item?.product_id, 128);
      const quantity = Number(item?.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
        throw new CheckoutError("invalid_cart_item", 400);
      }
      if (requested.has(productId)) throw new CheckoutError("duplicate_cart_item", 400);
      requested.set(productId, quantity);
    }

    const catalogue = await fetchCatalogue(config);
    const byId = new Map<string, any>();
    for (const product of catalogue) {
      const id = clean(product?.id, 128);
      if (id) byId.set(id, product);
    }

    const lineItems: Array<Record<string, unknown>> = [];
    let subtotalPaise = 0;
    for (const [productId, quantity] of requested.entries()) {
      const product = byId.get(productId);
      if (!product || product.active === false) throw new CheckoutError("cart_product_unavailable", 409);
      const price = Number(product.selling_price);
      const mrp = Number(product.mrp);
      if (!Number.isFinite(price) || price <= 0 || price > 100000000) {
        throw new CheckoutError("cart_product_requires_quote", 409);
      }
      if (Number.isFinite(mrp) && mrp > 0 && price > mrp) {
        throw new CheckoutError("catalogue_price_invalid", 409);
      }
      const unitPaise = Math.round(price * 100);
      const linePaise = unitPaise * quantity;
      if (!Number.isSafeInteger(linePaise) || linePaise <= 0 || linePaise > 100000000000) {
        throw new CheckoutError("cart_amount_invalid", 400);
      }
      subtotalPaise += linePaise;
      if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise > 100000000000) {
        throw new CheckoutError("cart_amount_too_large", 400);
      }
      lineItems.push({
        product_id: productId,
        part_number: clean(product.part_number || product.partNumber, 128) || null,
        product_name: clean(product.product_name || product.name, 300),
        brand: clean(product.brand_name || product.brand, 160) || null,
        quantity,
        unit_price: money(unitPaise),
        line_total: money(linePaise),
      });
    }

    if (subtotalPaise < 100) throw new CheckoutError("minimum_order_amount_not_met", 400);
    const subtotal = money(subtotalPaise);
    const shipping = subtotal >= policy.threshold ? 0 : policy.shippingBelowThreshold;
    const shippingPaise = Math.round(shipping * 100);
    const totalPaise = subtotalPaise + shippingPaise;
    if (!Number.isSafeInteger(totalPaise) || totalPaise < 100 || totalPaise > 100000000000) {
      throw new CheckoutError("order_total_invalid", 400);
    }
    const shippingAmount = money(shippingPaise);
    const totalAmount = money(totalPaise);
    const gatewayOrderId = "SVKS" + Date.now().toString(36).toUpperCase() + crypto.randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase();
    const orderNumber = "SOUVO-" + Date.now().toString(36).toUpperCase() + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const accessToken = randomToken();
    const accessTokenHash = await sha256Hex(accessToken);
    const userId = await optionalUserId(req);
    const now = new Date().toISOString();

    const inserted = await supabaseRest("orders", "POST", {}, {
      order_number: orderNumber,
      gateway_order_id: gatewayOrderId,
      user_id: userId,
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_phone: customerPhone,
      company: company || null,
      gst_number: gstNumber || null,
      shipping_address_line1: address1,
      shipping_address_line2: address2 || null,
      shipping_city: city,
      shipping_state: state,
      shipping_postal_code: postalCode,
      shipping_country: "IN",
      currency: "INR",
      subtotal: subtotal,
      shipping_amount: shippingAmount,
      total_amount: totalAmount,
      tax_included: policy.pricesIncludeGst,
      terms_accepted_at: now,
      payment_status: "pending",
      order_status: "awaiting_payment",
      cashfree_order_status: "CREATING",
      created_at: now,
      updated_at: now,
    }, "return=representation");
    const order = Array.isArray(inserted) ? inserted[0] : null;
    if (!order?.id) throw new CheckoutError("order_storage_unavailable", 503);
    createdOrderId = gatewayOrderId;

    await supabaseRest("order_items", "POST", {}, lineItems.map((item) => ({ ...item, order_id: order.id })), "return=minimal");
    await supabaseRest("checkout_access_tokens", "POST", {}, {
      order_id: order.id,
      gateway_order_id: gatewayOrderId,
      token_hash: accessTokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, "return=minimal");

    const customerId = "CUST_" + (await sha256Hex(customerPhone + "|" + config.clientSecret)).slice(0, 20);
    const cashfreeOrder = await cashfreeRequest(config, "/orders", "POST", {
      order_id: gatewayOrderId,
      order_amount: totalAmount,
      order_currency: "INR",
      customer_details: {
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: config.siteUrl + "/" + lang + "/payment-status?order_id={order_id}",
      },
      order_note: "Souviks website order " + orderNumber,
      order_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }, crypto.randomUUID());

    const sessionId = String(cashfreeOrder?.payment_session_id || "");
    if (!sessionId || String(cashfreeOrder?.order_id || gatewayOrderId) !== gatewayOrderId) {
      throw new CheckoutError("payment_session_creation_failed", 502);
    }

    await supabaseRest("orders", "PATCH", { gateway_order_id: "eq." + gatewayOrderId }, {
      cashfree_order_status: String(cashfreeOrder?.order_status || "ACTIVE"),
      cashfree_payment_session_created_at: now,
      updated_at: new Date().toISOString(),
    }, "return=minimal");

    return jsonResponse(req, {
      ok: true,
      order_id: gatewayOrderId,
      order_number: orderNumber,
      payment_session_id: sessionId,
      checkout_token: accessToken,
      mode: config.mode,
      subtotal,
      shipping: shippingAmount,
      total: totalAmount,
      currency: "INR",
    });
  } catch (error) {
    const result = errorPayload(error);
    if (createdOrderId) {
      try {
        await supabaseRest("orders", "PATCH", { gateway_order_id: "eq." + createdOrderId, payment_status: "eq.pending" }, {
          payment_status: "failed",
          cashfree_order_status: "CREATION_FAILED",
          updated_at: new Date().toISOString(),
        }, "return=minimal");
      } catch {
        // Keep the original checkout error; the audit trail may be reconciled later.
      }
    }
    const messages: Record<string, string> = {
      checkout_not_enabled: "Online checkout is being configured. Please request a quote for now.",
      payment_provider_not_configured: "Online checkout is not configured yet. Please request a quote.",
      live_checkout_not_approved: "Live payments have not been enabled yet.",
      tax_policy_not_confirmed: "Checkout is temporarily unavailable while tax treatment is confirmed.",
      shipping_policy_not_configured: "Checkout is temporarily unavailable while shipping charges are confirmed.",
      checkout_rate_limited: "Too many checkout attempts. Please wait a few minutes and retry.",
      catalogue_unavailable: "Current product pricing could not be verified. Please request a quote.",
      cart_product_requires_quote: "One or more items require a quotation instead of online checkout.",
      cart_product_unavailable: "One or more items are no longer available for purchase.",
      payment_provider_request_failed: "The payment session could not be created. Please try again.",
      order_storage_unavailable: "Checkout is temporarily unavailable. Please try again.",
    };
    return jsonResponse(req, {
      ok: false,
      code: result.code,
      message: messages[result.code] || "We could not prepare this checkout. Please review the details and try again.",
    }, result.status);
  }
});
