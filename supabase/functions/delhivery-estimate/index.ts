const ALLOWED_ORIGINS = new Set([
  "https://www.souviks.co.in",
  "https://souviks.co.in",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
]);
const DEFAULT_ORIGIN_PIN = "713321";
const MAX_WEIGHT_GRAMS = 200000;

class EstimateError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function serviceKey(): string {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_SECRET_KEY")?.trim() || "";
  if (direct) return direct;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, string>;
    return keys.default || Object.values(keys).find((value) => typeof value === "string") || "";
  } catch {
    return "";
  }
}

function headers(origin: string | null): Headers {
  const result = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) result.set("Access-Control-Allow-Origin", origin);
  return result;
}

function respond(req: Request, body: Record<string, unknown>, status = 200): Response {
  const result = headers(req.headers.get("origin"));
  result.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers: result });
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function enforceRateLimit(req: Request): Promise<void> {
  const base = (Deno.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, "");
  const key = serviceKey();
  if (!base || !key) throw new EstimateError("rate_limit_unavailable", 503);
  const ip = (req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 100);
  const requestHeaders: Record<string, string> = {
    "apikey": key,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (!key.startsWith("sb_secret_")) requestHeaders.Authorization = "Bearer " + key;

  async function claim(keyHash: string, limit: number, windowSeconds: number): Promise<void> {
    let response: Response;
    try {
      response = await fetch(base + "/rest/v1/rpc/cashfree_checkout_rate_limit", {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ p_key_hash: keyHash, p_limit: limit, p_window_seconds: windowSeconds }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new EstimateError("rate_limit_unavailable", 503);
    }
    if (!response.ok) throw new EstimateError("rate_limit_unavailable", 503);
    if (await response.json() !== true) throw new EstimateError("rate_limited", 429);
  }

  // A site-wide ceiling prevents rotating IPs from exhausting Delhivery's
  // approximate freight endpoint (documented maximum: 40 charge requests/min).
  await claim(await digest("delhivery-global|" + key), 20, 60);
  await claim(await digest("delhivery-ip|" + ip + "|" + key), 8, 600);
}

async function providerGet(url: URL, authorization: string): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": authorization, "Accept": "application/json", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new EstimateError("delhivery_unreachable", 502);
  }
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    console.error("[Delhivery estimate] Provider request failed", response.status);
    throw new EstimateError(response.status === 401 || response.status === 403 ? "delhivery_auth_failed" : "delhivery_request_failed", 502);
  }
  return data;
}

function findNumber(value: any, wanted: string[], depth = 0): number | null {
  if (!value || typeof value !== "object" || depth > 5) return null;
  for (const key of wanted) {
    const candidate = value[key];
    if ((typeof candidate === "number" || (typeof candidate === "string" && candidate.trim() !== "")) && Number.isFinite(Number(candidate))) {
      return Number(candidate);
    }
  }
  for (const child of Object.values(value)) {
    const result = findNumber(child, wanted, depth + 1);
    if (result !== null) return result;
  }
  return null;
}

function findString(value: any, wanted: string[], depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 5) return null;
  for (const key of wanted) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  for (const child of Object.values(value)) {
    const result = findString(child, wanted, depth + 1);
    if (result !== null) return result;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response(null, { status: 204, headers: headers(origin) });
  }
  if (req.method !== "POST") return respond(req, { ok: false, code: "method_not_allowed" }, 405);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return respond(req, { ok: false, code: "origin_not_allowed" }, 403);

  try {
    const input = await req.json();
    const destinationPin = String(input?.destination_pin ?? "").trim();
    // Customer-facing estimates deliberately use COD + Express by default.
    // Customers provide only their delivery PIN; weight comes from catalogue data.
    const paymentMode = "COD";
    const billingMode = "E";
    const weightGrams = Number(input?.chargeable_weight_g);
    if (!/^\d{6}$/.test(destinationPin)) throw new EstimateError("invalid_destination_pin", 400);
    if (!Number.isInteger(weightGrams) || weightGrams < 1 || weightGrams > MAX_WEIGHT_GRAMS) {
      throw new EstimateError("invalid_chargeable_weight", 400);
    }

    const originPin = (Deno.env.get("DELHIVERY_ORIGIN_PIN") || DEFAULT_ORIGIN_PIN).trim();
    if (!/^\d{6}$/.test(originPin)) throw new EstimateError("origin_pin_not_configured", 503);
    await enforceRateLimit(req);

    const b2cToken = (Deno.env.get("DELHIVERY_B2C_API_TOKEN") || Deno.env.get("DELHIVERY_API_TOKEN") || "").trim();
    const b2bToken = (Deno.env.get("DELHIVERY_B2B_BEARER_TOKEN") || Deno.env.get("DELHIVERY_UMS_BEARER_TOKEN") || Deno.env.get("DELHIVERY_API_TOKEN") || Deno.env.get("DELHIVERY_B2C_API_TOKEN") || "").trim();
    if (!b2cToken) throw new EstimateError("delhivery_b2c_token_not_configured", 503);

    const serviceUrl = new URL("https://track.delhivery.com/c/api/pin-codes/json/");
    serviceUrl.searchParams.set("filter_codes", destinationPin);
    const serviceData = await providerGet(serviceUrl, "Token " + b2cToken);
    const deliveryCodes = Array.isArray(serviceData?.delivery_codes) ? serviceData.delivery_codes : [];
    const postal = deliveryCodes[0]?.postal_code || deliveryCodes[0] || null;
    if (!postal) {
      return respond(req, {
        ok: true,
        origin_pin: originPin,
        destination_pin: destinationPin,
        serviceability: { available: true, serviceable: false, message: "Delhivery did not return this PIN code as serviceable." },
        shipping: { available: false },
        delivery: { available: false },
      });
    }

    const requestedModeAvailable = paymentMode === "COD"
      ? String(postal.cod || "").toUpperCase() === "Y"
      : String(postal.pre_paid || postal.prepaid || "").toUpperCase() === "Y";
    const isServiceable = requestedModeAvailable &&
      String(postal.remarks || "").toLowerCase() !== "embargo";
    if (!isServiceable) {
      return respond(req, {
        ok: true,
        origin_pin: originPin,
        destination_pin: destinationPin,
        serviceability: {
          available: true,
          serviceable: false,
          message: paymentMode === "COD" ? "Delhivery COD service is not available for this PIN code." : "Delhivery prepaid delivery is not available for this PIN code.",
          city: String(postal.city || ""),
          state: String(postal.state_code || ""),
        },
        shipping: { available: false },
        delivery: { available: false },
      });
    }

    const chargesUrl = new URL("https://track.delhivery.com/api/kinko/v1/invoice/charges/.json");
    chargesUrl.searchParams.set("md", billingMode);
    chargesUrl.searchParams.set("ss", "Delivered");
    chargesUrl.searchParams.set("d_pin", destinationPin);
    chargesUrl.searchParams.set("o_pin", originPin);
    chargesUrl.searchParams.set("cgm", String(weightGrams));
    chargesUrl.searchParams.set("pt", paymentMode);
    const chargePromise = providerGet(chargesUrl, "Token " + b2cToken).then((chargeData) => {
      const amount = findNumber(chargeData, ["total_amount", "totalAmount", "total_charges", "total_charges_amount"]);
      if (amount === null || amount <= 0) return { available: false };
      return { available: true, amount: Math.round(amount * 100) / 100, currency: "INR", approximate: true };
    }).catch((error) => {
      console.error("[Delhivery estimate] Shipping charge estimate unavailable", error instanceof EstimateError ? error.code : "provider_error");
      return { available: false };
    });

    const deliveryPromise = b2bToken ? (() => {
      const tatUrl = new URL("https://ltl-clients-api.delhivery.com/tat/estimate");
      tatUrl.searchParams.set("origin_pin", originPin);
      tatUrl.searchParams.set("destination_pin", destinationPin);
      return providerGet(tatUrl, "Bearer " + b2bToken).then((tatData) => {
        const days = findNumber(tatData, ["tat_days", "tat", "expected_tat", "estimated_days", "days"]);
        const date = findString(tatData, ["estimated_date", "estimated_delivery_date", "delivery_date", "estimatedDate"]);
        const hasDays = days !== null && days >= 0;
        return hasDays || Boolean(date)
          ? { available: true, tat_days: hasDays ? Math.ceil(days) : null, estimated_date: date }
          : { available: false };
      }).catch((error) => {
        console.error("[Delhivery estimate] TAT estimate unavailable", error instanceof EstimateError ? error.code : "provider_error");
        return { available: false };
      });
    })() : Promise.resolve({ available: false });

    const [shipping, delivery] = await Promise.all([chargePromise, deliveryPromise]);
    return respond(req, {
      ok: true,
      origin_pin: originPin,
      destination_pin: destinationPin,
      serviceability: {
        available: true,
        serviceable: true,
        message: "Delhivery reports this PIN code as serviceable.",
        city: String(postal.city || ""),
        state: String(postal.state_code || ""),
      },
      shipping: { ...shipping, chargeable_weight_g: weightGrams, billing_mode: billingMode, payment_mode: paymentMode },
      delivery,
      notice: "Courier charges and delivery time are estimates, not guaranteed final values.",
    });
  } catch (error) {
    const known = error instanceof EstimateError ? error : new EstimateError("estimate_temporarily_unavailable", 503);
    if (!(error instanceof EstimateError)) console.error("[Delhivery estimate] Unexpected error");
    const messages: Record<string, string> = {
      invalid_destination_pin: "Enter a valid 6-digit destination PIN code.",
      invalid_chargeable_weight: "Enter a chargeable weight between 1 and 200,000 grams.",
      rate_limit_unavailable: "The delivery estimator is temporarily unavailable. Please try again shortly.",
      rate_limited: "Too many estimates have been requested. Please wait a few minutes and try again.",
      origin_pin_not_configured: "Souviks pickup PIN code has not been configured correctly.",
      delhivery_b2c_token_not_configured: "The Delhivery shipping estimate is not configured yet.",
      delhivery_auth_failed: "Delhivery credentials need to be checked.",
      delhivery_request_failed: "Delhivery could not return an estimate for these details.",
      delhivery_unreachable: "Delhivery is temporarily unreachable. Please try again shortly.",
    };
    return respond(req, { ok: false, code: known.code, message: messages[known.code] || "We could not calculate the estimate. Please try again or contact Souviks." }, known.status);
  }
});
