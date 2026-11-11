import {
  allowedOrigin,
  cashfreeConfig,
  cashfreeRequest,
  CheckoutError,
  getSupabaseUrl,
  jsonResponse,
  sha256Hex,
  supabaseRest,
  reconcileCashfreeFreightOrder,
} from "../_shared/cashfree.ts";

function clean(value: unknown, max = 500): string {
  return String(value ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}
function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function money(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    throw new CheckoutError("freight_amount_invalid", 400);
  }
  return Math.round(amount * 100) / 100;
}
function amountText(value: unknown): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value) || 0);
}
function publishableKey(): string {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (direct) return direct;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}") as Record<string,string>;
    return keys.default || Object.values(keys).find(Boolean) || "";
  } catch { return ""; }
}
async function verifiedUser(req: Request): Promise<any | null> {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const key = publishableKey();
  if (!match || !key) return null;
  try {
    const response = await fetch(getSupabaseUrl() + "/auth/v1/user", {
      headers: { apikey: key, Authorization: "Bearer " + match[1].trim() },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}
function isStaff(user: any): boolean {
  const app = user?.app_metadata && typeof user.app_metadata === "object" ? user.app_metadata : {};
  const allowed = new Set(["admin", "sales", "owner"]);
  const roles = Array.isArray(app.roles) ? app.roles
    : app.roles && typeof app.roles === "object" ? Object.keys(app.roles) : [];
  return allowed.has(String(app.role || "").toLowerCase()) ||
    roles.some((role: unknown) => allowed.has(String(role || "").toLowerCase()));
}
function siteUrl(): string {
  const value = (Deno.env.get("CASHFREE_SITE_URL") || "https://www.souviks.co.in").trim().replace(/\/+$/, "");
  return /^https:\/\//i.test(value) ? value : "https://www.souviks.co.in";
}
async function loadQuote(id: string): Promise<any> {
  const rows = await supabaseRest("freight_quotes", "GET", {
    select: "id,order_id,quote_number,status,amount,currency,chargeable_weight_g,package_length_cm,package_width_cm,package_height_cm,carrier,service_level,delivery_estimate,quote_notes,quoted_at,valid_until,payment_token_hash,payment_token_expires_at,payment_gateway_order_id,payment_session_id,payment_session_expires_at,cf_payment_id,paid_at",
    id: "eq." + id,
    limit: "1",
  });
  const quote = Array.isArray(rows) ? rows[0] : null;
  if (!quote) throw new CheckoutError("freight_quote_not_found", 404);
  return quote;
}
async function loadOrder(id: string): Promise<any> {
  const rows = await supabaseRest("orders", "GET", {
    select: "id,order_number,gateway_order_id,user_id,customer_name,customer_email,customer_phone,subtotal,shipping_amount,total_amount,currency,payment_status,order_status,fulfillment_method,shipping_postal_code",
    id: "eq." + id,
    limit: "1",
  });
  const order = Array.isArray(rows) ? rows[0] : null;
  if (!order) throw new CheckoutError("order_not_found", 404);
  return order;
}
async function assertQuoteAccess(req: Request, quote: any, input: any): Promise<any> {
  const order = await loadOrder(String(quote.order_id));
  const user = await verifiedUser(req);
  const userOwns = Boolean(user?.id && order.user_id && user.id === order.user_id);
  const token = clean(input?.token, 64);
  const tokenValid = /^[a-f0-9]{64}$/.test(token) &&
    quote.payment_token_hash === await sha256Hex(token) &&
    Date.parse(String(quote.payment_token_expires_at || "")) > Date.now();
  if (!userOwns && !tokenValid) throw new CheckoutError("freight_quote_access_denied", 403);
  return { order, user, token: tokenValid ? token : "" };
}
function publicQuote(quote: any, order: any): Record<string, unknown> {
  return {
    ok: true,
    quote_id: quote.id,
    quote_number: quote.quote_number,
    quote_status: quote.status,
    order_number: order.order_number,
    gateway_order_id: order.gateway_order_id,
    amount: Number(quote.amount) || 0,
    currency: quote.currency || "INR",
    chargeable_weight_g: quote.chargeable_weight_g,
    carrier: quote.carrier,
    service_level: quote.service_level,
    delivery_estimate: quote.delivery_estimate,
    quote_notes: quote.quote_notes,
    quoted_at: quote.quoted_at,
    valid_until: quote.valid_until,
    paid_at: quote.paid_at,
  };
}
async function listDeliveryOrders(): Promise<any[]> {
  const orders = await supabaseRest("orders", "GET", {
    select: "id,order_number,gateway_order_id,customer_name,customer_email,customer_phone,subtotal,shipping_postal_code,shipping_city,shipping_state,payment_status,order_status,paid_at,created_at",
    fulfillment_method: "eq.delivery",
    payment_status: "eq.paid",
    order_status: "in.(freight_pending,freight_quoted)",
    order: "paid_at.asc",
    limit: "100",
  });
  if (!Array.isArray(orders) || !orders.length) return [];
  const ids = orders.map(order => String(order.id));
  const quotes = await supabaseRest("freight_quotes", "GET", {
    select: "id,order_id,quote_number,status,amount,chargeable_weight_g,carrier,service_level,delivery_estimate,quoted_at,valid_until",
    order_id: "in.(" + ids.join(",") + ")",
    limit: "100",
  });
  const byOrder = new Map<string, any>();
  for (const quote of Array.isArray(quotes) ? quotes : []) byOrder.set(String(quote.order_id), quote);
  return orders.map(order => ({
    order_id: order.id,
    order_number: order.order_number,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    postal_code: order.shipping_postal_code,
    city: order.shipping_city,
    state: order.shipping_state,
    subtotal: Number(order.subtotal) || 0,
    paid_at: order.paid_at,
    order_status: order.order_status,
    quote: byOrder.get(String(order.id)) || null,
  }));
}
async function createQuote(req: Request, input: any, user: any): Promise<Record<string, unknown>> {
  if (!isStaff(user)) throw new CheckoutError("staff_access_required", 403);
  const orderId = clean(input?.order_id, 60);
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new CheckoutError("order_id_invalid", 400);
  const order = await loadOrder(orderId);
  if (order.payment_status !== "paid" || order.fulfillment_method !== "delivery" ||
      !["freight_pending", "freight_quoted"].includes(String(order.order_status))) {
    throw new CheckoutError("freight_quote_order_not_eligible", 409);
  }
  const existingInvoices = await supabaseRest("gst_invoices", "GET", {
    select: "id,invoice_status", order_id: "eq." + orderId, limit: "1",
  });
  if (Array.isArray(existingInvoices) && existingInvoices.some((row: any) => row.invoice_status === "issued")) {
    throw new CheckoutError("invoice_already_issued", 409);
  }
  const amount = money(input?.amount);
  const weight = Number(input?.chargeable_weight_g);
  if (!Number.isInteger(weight) || weight < 1 || weight > 200000) {
    throw new CheckoutError("freight_weight_invalid", 400);
  }
  const dimensions = ["length_cm", "width_cm", "height_cm"].map(key => {
    const raw = input?.[key];
    if (raw === null || raw === undefined || raw === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value > 500) throw new CheckoutError("freight_dimension_invalid", 400);
    return Math.round(value * 100) / 100;
  });
  const carrier = clean(input?.carrier, 80);
  if (!carrier) throw new CheckoutError("freight_carrier_required", 400);
  const token = randomToken();
  const now = new Date();
  const validUntil = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  const quoteNumber = "SFR-" + now.toISOString().slice(2,10).replace(/-/g,"") + "-" +
    crypto.randomUUID().replace(/-/g,"").slice(0,6).toUpperCase();
  const body = {
    order_id: orderId,
    quote_number: quoteNumber,
    status: "quoted",
    amount,
    currency: "INR",
    chargeable_weight_g: weight,
    package_length_cm: dimensions[0],
    package_width_cm: dimensions[1],
    package_height_cm: dimensions[2],
    carrier,
    service_level: clean(input?.service_level, 80) || null,
    delivery_estimate: clean(input?.delivery_estimate, 120) || null,
    quote_notes: clean(input?.quote_notes, 1000) || null,
    quoted_by: user.id,
    quoted_at: now.toISOString(),
    valid_until: validUntil,
    payment_token_hash: await sha256Hex(token),
    payment_token_expires_at: validUntil,
    payment_gateway_order_id: null,
    payment_session_id: null,
    payment_session_expires_at: null,
    cashfree_order_status: null,
    cf_payment_id: null,
    paid_at: null,
    updated_at: now.toISOString(),
  };
  const saved = await supabaseRest("freight_quotes", "POST", { on_conflict: "order_id" }, body,
    "resolution=merge-duplicates,return=representation");
  const quote = Array.isArray(saved) ? saved[0] : null;
  if (!quote?.id) throw new CheckoutError("freight_quote_save_failed", 503);
  await supabaseRest("orders", "PATCH", { id: "eq." + orderId }, {
    order_status: "freight_quoted", updated_at: now.toISOString(),
  }, "return=minimal");
  const paymentUrl = siteUrl() + "/en/payment-status?freight_quote_id=" +
    encodeURIComponent(String(quote.id)) + "&token=" + token;
  const message = [
    "Souviks delivery quotation for order " + order.order_number,
    "Quotation: " + quoteNumber,
    "Packed chargeable weight: " + weight + " g",
    "Courier: " + carrier + (body.service_level ? " (" + body.service_level + ")" : ""),
    "Delivery charges: " + amountText(amount),
    "Please pay using this secure link: " + paymentUrl,
    "This quotation is valid until " + new Date(validUntil).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + ".",
    "The final GST tax invoice will be issued after the delivery payment is confirmed and before dispatch.",
  ].join("\n");
  const phone = String(order.customer_phone || "").replace(/\D/g, "");
  const whatsappUrl = phone ? "https://wa.me/91" + phone.slice(-10) + "?text=" + encodeURIComponent(message) : null;
  const emailUrl = order.customer_email
    ? "mailto:" + encodeURIComponent(String(order.customer_email)) +
      "?subject=" + encodeURIComponent("Souviks delivery quotation " + quoteNumber) +
      "&body=" + encodeURIComponent(message)
    : null;
  return {
    ok: true,
    quote_id: quote.id,
    quote_number: quoteNumber,
    amount,
    valid_until: validUntil,
    payment_url: paymentUrl,
    whatsapp_url: whatsappUrl,
    email_url: emailUrl,
    message,
  };
}
async function createFreightPayment(req: Request, input: any): Promise<Record<string, unknown>> {
  const quoteId = clean(input?.quote_id, 60);
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) throw new CheckoutError("freight_quote_id_invalid", 400);
  let quote = await loadQuote(quoteId);
  const access = await assertQuoteAccess(req, quote, input);
  const order = access.order;
  if (quote.status === "paid") return { ok: true, quote_status: "paid", already_paid: true };
  if (!["quoted", "payment_pending"].includes(String(quote.status))) {
    throw new CheckoutError("freight_quote_not_payable", 409);
  }
  if (Date.parse(String(quote.valid_until || "")) <= Date.now()) {
    await supabaseRest("freight_quotes", "PATCH", { id: "eq." + quoteId }, {
      status: "expired", updated_at: new Date().toISOString(),
    }, "return=minimal");
    throw new CheckoutError("freight_quote_expired", 409);
  }
  if (quote.status === "payment_pending" && quote.payment_session_id &&
      Date.parse(String(quote.payment_session_expires_at || "")) > Date.now()) {
    return {
      ok: true,
      quote_id: quote.id,
      payment_session_id: quote.payment_session_id,
      mode: cashfreeConfig().mode,
      amount: Number(quote.amount),
      currency: "INR",
    };
  }
  const config = cashfreeConfig();
  const gatewayOrderId = "SVKF" + Date.now().toString(36).toUpperCase() +
    crypto.randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase();
  const sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const customerId = "CUST_" + (await sha256Hex(String(order.customer_phone || "") + "|" + config.clientSecret)).slice(0, 20);
  const paymentUrl = siteUrl() + "/en/payment-status?freight_quote_id=" +
    encodeURIComponent(String(quote.id)) +
    (access.token ? "&token=" + access.token : "");
  const cashfreeOrder = await cashfreeRequest(config, "/orders", "POST", {
    order_id: gatewayOrderId,
    order_amount: Number(quote.amount),
    order_currency: "INR",
    customer_details: {
      customer_id: customerId,
      customer_name: clean(order.customer_name, 100),
      customer_email: clean(order.customer_email, 254) || undefined,
      customer_phone: String(order.customer_phone || "").replace(/\D/g, "").slice(-10),
    },
    order_meta: { return_url: paymentUrl + "&freight_payment=1" },
    order_note: "Souviks delivery quotation " + quote.quote_number + " for order " + order.order_number,
    order_expiry_time: sessionExpiresAt,
  }, crypto.randomUUID());
  const sessionId = String(cashfreeOrder?.payment_session_id || "");
  if (!sessionId || String(cashfreeOrder?.order_id || gatewayOrderId) !== gatewayOrderId) {
    throw new CheckoutError("freight_payment_session_failed", 502);
  }
  await supabaseRest("freight_quotes", "PATCH", { id: "eq." + quote.id }, {
    status: "payment_pending",
    payment_gateway_order_id: gatewayOrderId,
    payment_session_id: sessionId,
    payment_session_expires_at: sessionExpiresAt,
    cashfree_order_status: String(cashfreeOrder?.order_status || "ACTIVE"),
    updated_at: new Date().toISOString(),
  }, "return=minimal");
  return {
    ok: true,
    quote_id: quote.id,
    payment_session_id: sessionId,
    mode: config.mode,
    amount: Number(quote.amount),
    currency: "INR",
    order_number: order.order_number,
  };
}
async function handle(req: Request, input: any): Promise<Record<string, unknown>> {
  const action = clean(input?.action, 32);
  if (action === "list_orders" || action === "create_quote") {
    const user = await verifiedUser(req);
    if (!isStaff(user)) throw new CheckoutError("staff_access_required", 403);
    if (action === "list_orders") return { ok: true, orders: await listDeliveryOrders() };
    return await createQuote(req, input, user);
  }
  if (action === "get_quote" || action === "create_payment" || action === "verify_payment") {
    const quoteId = clean(input?.quote_id, 60);
    if (!/^[0-9a-f-]{36}$/i.test(quoteId)) throw new CheckoutError("freight_quote_id_invalid", 400);
    const quote = await loadQuote(quoteId);
    const access = await assertQuoteAccess(req, quote, input);
    if (action === "get_quote") return publicQuote(quote, access.order);
    if (action === "create_payment") return await createFreightPayment(req, input);
    if (!quote.payment_gateway_order_id) throw new CheckoutError("freight_payment_not_started", 409);
    const result = await reconcileCashfreeFreightOrder(String(quote.payment_gateway_order_id));
    const latest = await loadQuote(quoteId);
    return { ok: true, ...result, ...publicQuote(latest, access.order) };
  }
  throw new CheckoutError("freight_action_invalid", 400);
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const mode = (Deno.env.get("CASHFREE_MODE") || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox";
  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin, mode)) return new Response("Origin not allowed", { status: 403 });
    return jsonResponse(req, { ok: true });
  }
  if (req.method !== "POST") return jsonResponse(req, { ok: false, code: "method_not_allowed" }, 405);
  if (!allowedOrigin(origin, mode)) return jsonResponse(req, { ok: false, code: "origin_not_allowed" }, 403);
  try {
    const input = await req.json();
    return jsonResponse(req, await handle(req, input || {}));
  } catch (error) {
    if (error instanceof CheckoutError) {
      return jsonResponse(req, {
        ok: false,
        code: error.code,
        message: "We could not process this delivery quotation. Please contact Souviks if the issue persists.",
      }, error.status);
    }
    console.error("[Freight quote] Request failed");
    return jsonResponse(req, { ok: false, code: "freight_quote_unavailable" }, 503);
  }
});
