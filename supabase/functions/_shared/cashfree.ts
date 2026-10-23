export const CASHFREE_API_VERSION = "2026-01-01";

export class CheckoutError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "CheckoutError";
    this.code = code;
    this.status = status;
  }
}

export type CashfreeRuntimeConfig = {
  clientId: string;
  clientSecret: string;
  mode: "sandbox" | "production";
  apiBase: string;
  siteUrl: string;
};

export type CheckoutPolicy = {
  threshold: number;
  pricesIncludeGst: true;
};

export function cashfreeConfig(): CashfreeRuntimeConfig {
  const modeRaw = (Deno.env.get("CASHFREE_MODE") || "sandbox").trim().toLowerCase();
  if (!["sandbox", "production"].includes(modeRaw)) {
    throw new CheckoutError("payment_provider_not_configured", 503);
  }
  const mode = modeRaw === "production" ? "production" : "sandbox";
  // Keep Sandbox credentials separate from Production credentials. Selecting
  // production must never silently fall back to the Sandbox key pair.
  const clientId = mode === "production"
    ? Deno.env.get("CASHFREE_PRODUCTION_CLIENT_ID")?.trim() || ""
    : Deno.env.get("CASHFREE_CLIENT_ID")?.trim() || "";
  const clientSecret = mode === "production"
    ? Deno.env.get("CASHFREE_PRODUCTION_CLIENT_SECRET")?.trim() || ""
    : Deno.env.get("CASHFREE_CLIENT_SECRET")?.trim() || "";
  if (!clientId || !clientSecret) {
    throw new CheckoutError("payment_provider_not_configured", 503);
  }
  let siteUrl = (Deno.env.get("CASHFREE_SITE_URL") || "https://www.souviks.co.in").trim();
  siteUrl = siteUrl.replace(/\/+$/, "");
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== "https:" || !["www.souviks.co.in", "souviks.co.in"].includes(parsed.hostname)) {
      throw new Error("invalid");
    }
  } catch {
    throw new CheckoutError("checkout_site_url_invalid", 503);
  }
  return {
    clientId,
    clientSecret,
    mode,
    apiBase: mode === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg",
    siteUrl,
  };
}

// Only order creation should require explicit live-checkout approval. The
// verify-order and webhook functions still need the selected environment's
// credentials to reconcile existing orders and validate signed events.
export function assertLiveCheckoutApproved(config: CashfreeRuntimeConfig): void {
  if (config.mode === "production" && Deno.env.get("CASHFREE_ENABLE_LIVE_CHECKOUT") !== "true") {
    throw new CheckoutError("live_checkout_not_approved", 503);
  }
}

export function checkoutPolicy(): CheckoutPolicy {
  if (Deno.env.get("CASHFREE_CHECKOUT_ENABLED") !== "true") {
    throw new CheckoutError("checkout_not_enabled", 503);
  }
  if (Deno.env.get("CASHFREE_PRICES_INCLUDE_GST") !== "true") {
    throw new CheckoutError("tax_policy_not_confirmed", 503);
  }
  const thresholdRaw = Deno.env.get("CASHFREE_FREE_SHIPPING_THRESHOLD_INR");
  if (thresholdRaw == null || thresholdRaw.trim() === "") {
    throw new CheckoutError("shipping_policy_not_configured", 503);
  }
  const threshold = Number(thresholdRaw);
  if (!Number.isFinite(threshold) || threshold < 0 ||
      threshold > 100000000) {
    throw new CheckoutError("shipping_policy_invalid", 503);
  }
  return { threshold, pricesIncludeGst: true };
}

export function allowedOrigin(origin: string | null, mode: "sandbox" | "production"): boolean {
  if (!origin) return false;
  if (["https://www.souviks.co.in", "https://souviks.co.in"].includes(origin)) return true;
  return mode === "sandbox" && ["http://localhost:4173", "http://localhost:5173", "http://127.0.0.1:4173", "http://127.0.0.1:5173"].includes(origin);
}

export function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ["https://www.souviks.co.in", "https://souviks.co.in", "http://localhost:4173", "http://localhost:5173", "http://127.0.0.1:4173", "http://127.0.0.1:5173"].includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function jsonResponse(req: Request, payload: Record<string, unknown>, status = 200): Response {
  const headers = new Headers(corsHeaders(req.headers.get("origin")));
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(payload), { status, headers });
}

export function getSupabaseServiceKey(): string {
  // Prefer Supabase's current secret-key dictionary. Legacy service_role JWTs
  // remain supported as a fallback while the project finishes key migration.
  const keysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keysRaw) {
    try {
      const keys = JSON.parse(keysRaw) as Record<string, string>;
      if (typeof keys.default === "string" && keys.default.startsWith("sb_secret_")) return keys.default;
      const firstSecret = Object.values(keys).find((value) => typeof value === "string" && value.startsWith("sb_secret_"));
      if (firstSecret) return firstSecret;
    } catch {
      // A malformed key map is treated as a missing secret; try the legacy key below.
    }
  }
  const directSecret = Deno.env.get("SUPABASE_SECRET_KEY");
  if (directSecret) return directSecret;
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new CheckoutError("backend_not_configured", 503);
}

export function getSupabaseUrl(): string {
  const value = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/+$/, "");
  if (!value || !/^https:\/\//i.test(value)) throw new CheckoutError("backend_not_configured", 503);
  return value;
}

export async function supabaseRest(
  path: string,
  method = "GET",
  query: Record<string, string> = {},
  body?: unknown,
  prefer?: string,
): Promise<any> {
  const base = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  const url = new URL(base + "/rest/v1/" + path.replace(/^\/+/, ""));
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const headers: Record<string, string> = {
    "apikey": key,
    "Accept": "application/json",
  };
  // New sb_secret_* keys are API keys, not JWTs: send them on apikey only.
  // Legacy service_role values are JWTs and still need Authorization: Bearer.
  if (!key.startsWith("sb_secret_")) headers["Authorization"] = "Bearer " + key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers["Prefer"] = prefer;
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    console.error("[Cashfree] Supabase request failed", method, path, response.status);
    throw new CheckoutError("order_storage_unavailable", 503);
  }
  return parsed;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function cashfreeRequest(
  config: CashfreeRuntimeConfig,
  path: string,
  method = "GET",
  body?: unknown,
  idempotencyKey?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    "x-client-id": config.clientId,
    "x-client-secret": config.clientSecret,
    "x-api-version": CASHFREE_API_VERSION,
    "Accept": "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
  const response = await fetch(config.apiBase + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    console.error("[Cashfree] Provider request failed", method, path, response.status);
    throw new CheckoutError("payment_provider_request_failed", 502);
  }
  return parsed;
}

export async function fetchCatalogue(_config: CashfreeRuntimeConfig): Promise<any[]> {
  // Prefer the repository's published catalogue so checkout is not dependent
  // on Cloudflare bot challenges or static-site cache propagation.
  const catalogueUrl = (Deno.env.get("CASHFREE_CATALOGUE_URL") ||
    "https://raw.githubusercontent.com/mssouviks-tech/souviks-website/main/assets/data/catalogue-index.json").trim();
  let url: URL;
  try {
    url = new URL(catalogueUrl);
  } catch {
    throw new CheckoutError("catalogue_unavailable", 503);
  }
  const isSiteCatalogue =
    ["www.souviks.co.in", "souviks.co.in"].includes(url.hostname) &&
    url.pathname === "/assets/data/catalogue-index.json";
  const isRepositoryCatalogue =
    url.hostname === "raw.githubusercontent.com" &&
    url.pathname === "/mssouviks-tech/souviks-website/main/assets/data/catalogue-index.json";
  if (url.protocol !== "https:" || (!isSiteCatalogue && !isRepositoryCatalogue)) {
    throw new CheckoutError("catalogue_unavailable", 503);
  }
  let response: Response;
  try {
    response = await fetch(url, { headers: { "Accept": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch {
    throw new CheckoutError("catalogue_unavailable", 503);
  }
  if (!response.ok) {
    console.error("[Cashfree] Canonical catalogue fetch failed", response.status);
    throw new CheckoutError("catalogue_unavailable", 503);
  }
  let value: any;
  try {
    value = await response.json();
  } catch {
    throw new CheckoutError("catalogue_unavailable", 503);
  }
  if (!Array.isArray(value)) throw new CheckoutError("catalogue_unavailable", 503);
  return value.filter((item) => item && typeof item === "object" && item.active !== false);
}

export async function optionalUserId(req: Request): Promise<string | null> {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token || token.startsWith("sb_publishable_") || token === Deno.env.get("SUPABASE_ANON_KEY")) return null;

  const base = getSupabaseUrl();
  const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") ||
    (() => {
      try {
        const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}") as Record<string, string>;
        return keys.default || Object.values(keys).find((item) => typeof item === "string") || "";
      } catch {
        return "";
      }
    })();
  if (!anon) return null;
  try {
    const response = await fetch(base + "/auth/v1/user", {
      headers: { "apikey": anon, "Authorization": "Bearer " + token },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const user = await response.json();
    return typeof user?.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

export async function enforceCheckoutRateLimit(req: Request, config: CashfreeRuntimeConfig): Promise<void> {
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 100);
  const keyHash = await sha256Hex(ip + "|" + config.clientSecret);
  let allowed: any;
  try {
    allowed = await supabaseRest("rpc/cashfree_checkout_rate_limit", "POST", {}, {
      p_key_hash: keyHash,
      p_limit: 5,
      p_window_seconds: 600,
    });
  } catch {
    throw new CheckoutError("checkout_temporarily_unavailable", 503);
  }
  if (allowed !== true) throw new CheckoutError("checkout_rate_limited", 429);
}

export async function reconcileCashfreeOrder(gatewayOrderId: string): Promise<Record<string, unknown>> {
  const config = cashfreeConfig();
  const rows = await supabaseRest("orders", "GET", {
    select: "id,order_number,gateway_order_id,currency,total_amount,payment_status,order_status,payment_failure_reason,payment_failure_code",
    gateway_order_id: "eq." + gatewayOrderId,
    limit: "1",
  });
  const order = Array.isArray(rows) ? rows[0] : null;
  if (!order) throw new CheckoutError("order_not_found", 404);

  const providerOrder = await cashfreeRequest(config, "/orders/" + encodeURIComponent(gatewayOrderId));
  const providerAmount = Number(providerOrder?.order_amount);
  const expectedAmount = Number(order.total_amount);
  const providerCurrency = String(providerOrder?.order_currency || "");
  const amountMatches = Number.isFinite(providerAmount) && Math.round(providerAmount * 100) === Math.round(expectedAmount * 100);
  const currencyMatches = providerCurrency === order.currency && providerCurrency === "INR";
  if (!amountMatches || !currencyMatches) {
    console.error("[Cashfree] Provider order amount/currency mismatch", gatewayOrderId);
    throw new CheckoutError("payment_amount_mismatch", 409);
  }

  let payments: any[] = [];
  let paymentsFetched = false;
  try {
    const paymentResponse = await cashfreeRequest(config, "/orders/" + encodeURIComponent(gatewayOrderId) + "/payments");
    if (Array.isArray(paymentResponse)) {
      payments = paymentResponse;
      paymentsFetched = true;
    } else if (Array.isArray(paymentResponse?.data)) {
      payments = paymentResponse.data;
      paymentsFetched = true;
    }
  } catch {
    // A failed payment-history lookup must not be treated as a failed payment.
    // Keep the last verified status until Cashfree can be queried successfully.
  }
  const paymentStatus = (payment: any) => String(payment?.payment_status || "").toUpperCase();
  const successful = payments.find((payment) => {
    const statusMatches = paymentStatus(payment) === "SUCCESS";
    const amount = Number(payment?.payment_amount);
    const paymentCurrency = String(payment?.payment_currency || providerCurrency);
    return statusMatches && Number.isFinite(amount) &&
      Math.round(amount * 100) === Math.round(expectedAmount * 100) &&
      paymentCurrency === order.currency;
  });
  const hasSuccessfulAttempt = payments.some((payment) => paymentStatus(payment) === "SUCCESS");
  const hasPendingAttempt = payments.some((payment) => paymentStatus(payment) === "PENDING");
  const terminalFailureStatuses = new Set(["FAILED", "USER_DROPPED", "CANCELLED", "EXPIRED"]);
  const terminalFailures = payments.filter((payment) => terminalFailureStatuses.has(paymentStatus(payment)));
  const allTerminalFailures = paymentsFetched && payments.length > 0 &&
    !hasSuccessfulAttempt && !hasPendingAttempt && terminalFailures.length === payments.length;

  const now = new Date().toISOString();
  const providerStatus = String(providerOrder?.order_status || "ACTIVE").toUpperCase();
  if (providerStatus === "PAID" && successful) {
    const paymentId = String(successful.cf_payment_id || "");
    const patch = {
      payment_status: "paid",
      order_status: order.order_status === "awaiting_payment" ? "processing" : order.order_status,
      cashfree_order_status: "PAID",
      cf_payment_id: paymentId || null,
      payment_failure_code: null,
      payment_failure_reason: null,
      paid_at: order.payment_status === "paid" ? undefined : now,
      updated_at: now,
    };
    await supabaseRest("orders", "PATCH", { gateway_order_id: "eq." + gatewayOrderId }, patch, "return=minimal");
    if (paymentId) {
      try {
        await supabaseRest("cashfree_payment_events", "POST", {}, {
          gateway_order_id: gatewayOrderId,
          cf_payment_id: paymentId,
          payment_status: "SUCCESS",
          payment_amount: expectedAmount,
          payment_currency: order.currency,
          event_source: "provider_reconciliation",
        }, "resolution=ignore-duplicates,return=minimal");
      } catch {
        // A status query may race the signed webhook. Payment state remains verified from Cashfree.
      }
    }
    return { order_number: order.order_number, payment_status: "paid", order_status: patch.order_status, amount: expectedAmount, currency: order.currency };
  }

  if (["EXPIRED", "CANCELLED"].includes(providerStatus) && order.payment_status !== "paid") {
    const terminalPaymentStatus = providerStatus === "CANCELLED" ? "cancelled" : "failed";
    await supabaseRest("orders", "PATCH", { gateway_order_id: "eq." + gatewayOrderId }, {
      payment_status: terminalPaymentStatus,
      order_status: "cancelled",
      cashfree_order_status: providerStatus,
      updated_at: now,
    }, "return=minimal");
    return { order_number: order.order_number, payment_status: terminalPaymentStatus, order_status: "cancelled", amount: expectedAmount, currency: order.currency };
  }

  if (order.payment_status !== "paid" && allTerminalFailures) {
    const latestFailure = [...terminalFailures].sort((a, b) => {
      const time = (payment: any) => Date.parse(String(payment?.payment_completion_time || payment?.payment_time || payment?.created_at || "")) || 0;
      return time(b) - time(a);
    })[0] || terminalFailures[terminalFailures.length - 1];
    const rawReason = latestFailure?.error_details?.error_description ||
      latestFailure?.payment_message ||
      latestFailure?.error_details?.error_reason ||
      "Payment was declined or could not be completed.";
    const failureReason = String(rawReason).replace(/\s+/g, " ").trim().slice(0, 500);
    const failureCode = String(latestFailure?.error_details?.error_code || paymentStatus(latestFailure) || "PAYMENT_FAILED").slice(0, 100);
    const failedPaymentId = String(latestFailure?.cf_payment_id || "");
    const failedPaymentAmount = Number(latestFailure?.payment_amount);
    const failedPaymentCurrency = String(latestFailure?.payment_currency || providerCurrency);
    await supabaseRest("orders", "PATCH", { gateway_order_id: "eq." + gatewayOrderId }, {
      payment_status: "failed",
      payment_failure_code: failureCode,
      payment_failure_reason: failureReason,
      cashfree_order_status: providerStatus,
      updated_at: now,
    }, "return=minimal");
    if (failedPaymentId && Number.isFinite(failedPaymentAmount) && failedPaymentAmount >= 0 && failedPaymentCurrency === order.currency) {
      try {
        await supabaseRest("cashfree_payment_events", "POST", {}, {
          gateway_order_id: gatewayOrderId,
          cf_payment_id: failedPaymentId,
          payment_status: paymentStatus(latestFailure),
          payment_amount: failedPaymentAmount,
          payment_currency: failedPaymentCurrency,
          event_source: "provider_reconciliation",
        }, "resolution=ignore-duplicates,return=minimal");
      } catch {
        // Failure status remains reconciled from Cashfree even if event recording races a webhook.
      }
    }
    return {
      order_number: order.order_number,
      payment_status: "failed",
      order_status: order.order_status,
      amount: expectedAmount,
      currency: order.currency,
      payment_failure_code: failureCode,
      payment_failure_reason: failureReason,
    };
  }

  // A still-pending attempt takes precedence over a previous failed attempt.
  // Never demote a verified paid order.
  if (order.payment_status !== "paid" && paymentsFetched && (hasPendingAttempt || hasSuccessfulAttempt)) {
    await supabaseRest("orders", "PATCH", { gateway_order_id: "eq." + gatewayOrderId }, {
      payment_status: "pending",
      payment_failure_code: null,
      payment_failure_reason: null,
      cashfree_order_status: providerStatus,
      updated_at: now,
    }, "return=minimal");
    return { order_number: order.order_number, payment_status: "pending", order_status: order.order_status, amount: expectedAmount, currency: order.currency };
  }

  await supabaseRest("orders", "PATCH", { gateway_order_id: "eq." + gatewayOrderId }, {
    cashfree_order_status: providerStatus,
    updated_at: now,
  }, "return=minimal");
  const currentStatus = String(order.payment_status || "pending");
  return {
    order_number: order.order_number,
    payment_status: currentStatus,
    order_status: order.order_status,
    amount: expectedAmount,
    currency: order.currency,
    ...(order.payment_failure_reason ? { payment_failure_reason: order.payment_failure_reason } : {}),
    ...(order.payment_failure_code ? { payment_failure_code: order.payment_failure_code } : {}),
  };
}
export async function verifyCashfreeWebhookSignature(
  signature: string,
  timestamp: string,
  rawBody: string,
  secret: string,
): Promise<boolean> {
  if (!signature || !timestamp || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + rawBody));
  const computed = btoa(Array.from(new Uint8Array(signed), (byte) => String.fromCharCode(byte)).join(""));
  return constantTimeEqual(computed, signature);
}
