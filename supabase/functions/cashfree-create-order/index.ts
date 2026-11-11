import {
  cashfreeConfig,
  assertLiveCheckoutApproved,
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

const INDIA_STATE_NAMES: Record<string, string> = {
  "01":"Jammu and Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh",
  "05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh",
  "10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur",
  "15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal",
  "20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh","24":"Gujarat",
  "26":"Dadra and Nagar Haveli and Daman and Diu","27":"Maharashtra","29":"Karnataka",
  "30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry",
  "35":"Andaman and Nicobar Islands","36":"Telangana","37":"Andhra Pradesh","38":"Ladakh",
};

function stateCodeFromName(value: unknown): string {
  const normalized = clean(value, 100).toLowerCase().replace(/[^a-z]/g, "");
  for (const [code, name] of Object.entries(INDIA_STATE_NAMES)) {
    if (name.toLowerCase().replace(/[^a-z]/g, "") === normalized) return code;
  }
  const aliases: Record<string,string> = {
    "orissa":"21","uttaranchal":"05","nctofdelhi":"07","delhi":"07",
    "jammuandkashmir":"01","jandk":"01","pondicherry":"34","wb":"19","westbengal":"19",
  };
  return aliases[normalized] || "";
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
    assertLiveCheckoutApproved(config);
    const input = await req.json();
    await enforceCheckoutRateLimit(req, config);

    if (input?.terms_accepted !== true) throw new CheckoutError("terms_acceptance_required", 400);
    const lang = ["en", "hi", "bn"].includes(String(input?.language || "")) ? String(input.language) : "en";
    const customer = input?.customer && typeof input.customer === "object" ? input.customer : {};
    const address = input?.shipping_address && typeof input.shipping_address === "object" ? input.shipping_address : {};
    const billing = input?.billing_address && typeof input.billing_address === "object" ? input.billing_address : {};
    const fulfillmentMethod = clean(input?.fulfillment_method, 20).toLowerCase() || "delivery";
    if (!["delivery", "pickup"].includes(fulfillmentMethod)) throw new CheckoutError("fulfillment_method_invalid", 400);

    const customerName = clean(customer.name, 100);
    const customerEmail = clean(customer.email, 254).toLowerCase();
    const rawPhone = clean(customer.phone, 30).replace(/[^0-9]/g, "");
    const customerPhone = rawPhone.length === 12 && rawPhone.startsWith("91") ? rawPhone.slice(2) : rawPhone;
    const company = clean(customer.company, 160);
    const gstNumber = clean(customer.gst_number, 15).toUpperCase();
    const billingAddress1 = clean(billing.line1, 180);
    const billingAddress2 = clean(billing.line2, 180);
    const billingCity = clean(billing.city, 100);
    const billingStateCode = clean(billing.state_code, 2);
    const billingPostalCode = clean(billing.postal_code, 6);
    const validBillingStateCodes = new Set(["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","26","27","29","30","31","32","33","34","35","36","37","38"]);
    const address1 = fulfillmentMethod === "delivery" ? clean(address.line1, 180) : "";
    const address2 = fulfillmentMethod === "delivery" ? clean(address.line2, 120) : "";
    const city = fulfillmentMethod === "delivery" ? clean(address.city, 100) : "";
    const state = fulfillmentMethod === "delivery" ? clean(address.state, 100) : "";
    const shippingStateCode = fulfillmentMethod === "delivery" ? stateCodeFromName(state) : billingStateCode;
    const postalCode = fulfillmentMethod === "delivery" ? clean(address.postal_code, 6) : "";
    const country = clean(address.country || "IN", 2).toUpperCase();

    if (customerName.length < 2) throw new CheckoutError("customer_name_required", 400);
    if (!/^\d{10}$/.test(customerPhone)) throw new CheckoutError("valid_indian_phone_required", 400);
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new CheckoutError("valid_email_required", 400);
    if (fulfillmentMethod === "delivery" &&
        (!address1 || !city || !state || !/^\d{6}$/.test(postalCode) || country !== "IN")) {
      throw new CheckoutError("valid_indian_shipping_address_required", 400);
    }
    if (!billingAddress1 || !billingCity || !validBillingStateCodes.has(billingStateCode) || !/^\d{6}$/.test(billingPostalCode)) {
      throw new CheckoutError("valid_billing_address_required", 400);
    }
    if (gstNumber && (!/^[0-9]{2}[0-9A-Z]{13}$/.test(gstNumber) || gstNumber.slice(0, 2) !== billingStateCode)) {
      throw new CheckoutError("valid_gst_number_required", 400);
    }
    if (Deno.env.get("GST_INVOICE_ISSUANCE_ENABLED") === "true" && fulfillmentMethod === "delivery" && !shippingStateCode) {
      throw new CheckoutError("delivery_place_of_supply_state_missing", 409);
    }
    if (Deno.env.get("GST_INVOICE_ISSUANCE_ENABLED") === "true" &&
        Deno.env.get("GST_INVOICE_SELLER_IDENTITY_VERIFIED") !== "true") {
      throw new CheckoutError("seller_identity_not_verified", 409);
    }

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
    // Delivery freight is deliberately quoted only after Souviks has packed and weighed the order.
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
      const gstCandidate = product.gst_rate_candidate && typeof product.gst_rate_candidate === "object" ? product.gst_rate_candidate : {};
      const gstCandidateApproved = gstCandidate.invoice_ready === true &&
        gstCandidate.accountant_approval_required === false && gstCandidate.accountant_approval_status === "approved";
      const gstCandidateStatus = clean(gstCandidate.status, 64);
      const unitOfMeasure = clean(product.unit_of_measure || product.uom || product.measurement_unit, 10);
      const hsnInvoiceReady = /^\d{8}$/.test(clean(product.hsn_code, 8)) &&
        product.hsn_classification_status === "classified" && product.hsn_confidence === "high";
      if (Deno.env.get("GST_INVOICE_ISSUANCE_ENABLED") === "true" && (!gstCandidateApproved || !hsnInvoiceReady)) {
        throw new CheckoutError("hsn_or_gst_candidate_not_final", 409);
      }
      if (Deno.env.get("GST_INVOICE_ISSUANCE_ENABLED") === "true" && !/^[A-Z0-9]{1,10}$/.test(unitOfMeasure)) {
        throw new CheckoutError("invoice_unit_of_measure_missing", 409);
      }
      // Catalogue weight is not used for the initial product-payment checkout.

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
        hsn_code: clean(product.hsn_code, 8) || null,
        hsn_description: clean(product.hsn_description, 300) || null,
        hsn_classification_status: clean(product.hsn_classification_status, 32) || null,
        hsn_confidence: clean(product.hsn_confidence, 16) || null,
        gst_rate_percent: Number.isFinite(Number(product.gst_rate_percent ?? gstCandidate.total_rate_percent)) ? Number(product.gst_rate_percent ?? gstCandidate.total_rate_percent) : null,
        gst_cgst_rate_percent: Number.isFinite(Number(product.gst_cgst_rate_percent ?? gstCandidate.cgst_rate_percent)) ? Number(product.gst_cgst_rate_percent ?? gstCandidate.cgst_rate_percent) : null,
        gst_sgst_rate_percent: Number.isFinite(Number(product.gst_sgst_rate_percent ?? gstCandidate.sgst_rate_percent)) ? Number(product.gst_sgst_rate_percent ?? gstCandidate.sgst_rate_percent) : null,
        gst_igst_rate_percent: Number.isFinite(Number(product.gst_igst_rate_percent ?? gstCandidate.igst_rate_percent)) ? Number(product.gst_igst_rate_percent ?? gstCandidate.igst_rate_percent) : null,
        gst_rate_effective_from: clean(product.gst_rate_effective_from || gstCandidate.effective_from, 10) || null,
        gst_rate_source_reference: clean(product.gst_rate_source_reference || (Array.isArray(gstCandidate.source_references) ? gstCandidate.source_references.join("; ") : ""), 1500) || null,
        gst_rate_basis: clean(product.gst_rate_basis || gstCandidate.basis || gstCandidate.review_note, 1500) || null,
        gst_rate_candidate_approved: gstCandidateApproved,
        gst_rate_candidate_status: gstCandidateStatus || null,
        unit_of_measure: unitOfMeasure || null,
        quantity,
        unit_price: money(unitPaise),
        line_total: money(linePaise),
      });
    }

    if (subtotalPaise < 100) throw new CheckoutError("minimum_order_amount_not_met", 400);
    const subtotal = money(subtotalPaise);
    // Product payment only. Delivery will be quoted separately after packed weight/dimensions are confirmed.
    const shippingPaise = 0;
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
      billing_address_line1: billingAddress1,
      billing_address_line2: billingAddress2 || null,
      billing_city: billingCity,
      billing_state: INDIA_STATE_NAMES[billingStateCode],
      billing_state_code: billingStateCode,
      billing_postal_code: billingPostalCode,
      billing_country: "IN",
      fulfillment_method: fulfillmentMethod,
      shipping_address_line1: fulfillmentMethod === "delivery" ? address1 : null,
      shipping_address_line2: fulfillmentMethod === "delivery" ? (address2 || null) : null,
      shipping_city: fulfillmentMethod === "delivery" ? city : null,
      shipping_state: fulfillmentMethod === "delivery" ? state : null,
      shipping_state_code: fulfillmentMethod === "delivery" ? shippingStateCode : null,
      shipping_postal_code: fulfillmentMethod === "delivery" ? postalCode : null,
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
      order_note: "Souviks website order " + orderNumber + (fulfillmentMethod === "pickup" ? " — store pickup" : ""),
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
      delivery_quote_required: fulfillmentMethod === "delivery",
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
      checkout_rate_limited: "Too many checkout attempts. Please wait a few minutes and retry.",
      valid_billing_address_required: "Enter your billing address, city, state and six-digit PIN code for the tax invoice.",
      delivery_place_of_supply_state_missing: "Select a valid delivery state before paying so the correct GST place of supply can be recorded.",
      seller_identity_not_verified: "Online checkout is temporarily unavailable until the registered seller details are verified for tax invoicing.",
      hsn_or_gst_candidate_not_final: "One or more items still need final HSN or GST verification before a tax invoice can be issued. Please request a quotation.",
      invoice_unit_of_measure_missing: "One or more items still need a verified GST unit of measurement before a tax invoice can be issued.",
      freight_tax_treatment_not_approved: "Delivery tax treatment is awaiting accountant approval. Please request a quotation or choose store pickup.",
      fulfillment_method_invalid: "Choose either home delivery or store pickup to continue.",
      catalogue_unavailable: "Current product pricing could not be verified. Please request a quote.",
      cart_product_requires_quote: "One or more items require a quotation instead of online checkout.",
      cart_product_unavailable: "One or more items are no longer available for purchase.",
      payment_provider_request_failed: "The payment session could not be created. Please try again.",
      order_storage_unavailable: "Checkout is temporarily unavailable. Please try again.",
      delhivery_shipping_not_configured: "Delhivery shipping is not configured. Please request a quote while we finish setup.",
      delhivery_credentials_invalid: "Delhivery could not authenticate the shipping request. Please contact Souviks.",
      delhivery_destination_not_serviceable: "Delhivery prepaid service is unavailable for this PIN code. Please contact Souviks for a delivery quote.",
      delhivery_shipping_quote_unavailable: "Delhivery could not calculate shipping right now. Please retry or request a quote.",
      delhivery_shipping_weight_invalid: "The cart weight is outside Delhivery’s supported range. Please request a shipping quote.",
      delhivery_shipping_weights_missing: "Shipping cannot be calculated until weights are available for every item. Please request a quote or try again once the catalogue is updated.",
    };
    return jsonResponse(req, {
      ok: false,
      code: result.code,
      message: messages[result.code] || "We could not prepare this checkout. Please review the details and try again.",
    }, result.status);
  }
});
