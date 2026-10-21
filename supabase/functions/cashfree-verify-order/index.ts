import {
  CheckoutError,
  allowedOrigin,
  jsonResponse,
  reconcileCashfreeOrder,
  sha256Hex,
  supabaseRest,
} from "../_shared/cashfree.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const mode = (Deno.env.get("CASHFREE_MODE") || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox";
  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin, mode)) return new Response("Origin not allowed", { status: 403 });
    return jsonResponse(req, { ok: true });
  }
  if (req.method !== "POST") return jsonResponse(req, { code: "method_not_allowed" }, 405);
  if (!allowedOrigin(origin, mode)) return jsonResponse(req, { code: "origin_not_allowed" }, 403);

  try {
    const input = await req.json();
    const orderId = String(input?.order_id || "").trim();
    const token = String(input?.checkout_token || "").trim();
    if (!/^[A-Z0-9_-]{3,45}$/.test(orderId) || !/^[a-f0-9]{64}$/.test(token)) {
      throw new CheckoutError("order_access_denied", 403);
    }
    const tokenHash = await sha256Hex(token);
    const tokens = await supabaseRest("checkout_access_tokens", "GET", {
      select: "order_id,gateway_order_id,expires_at",
      gateway_order_id: "eq." + orderId,
      token_hash: "eq." + tokenHash,
      expires_at: "gt." + new Date().toISOString(),
      limit: "1",
    });
    if (!Array.isArray(tokens) || !tokens.length) throw new CheckoutError("order_access_denied", 403);

    const status = await reconcileCashfreeOrder(orderId);
    return jsonResponse(req, { ok: true, ...status });
  } catch (error) {
    if (error instanceof CheckoutError) {
      const messages: Record<string, string> = {
        order_access_denied: "We could not verify this order in this browser session. Contact Souviks with your order reference.",
        order_not_found: "This order could not be found.",
        payment_amount_mismatch: "Payment verification needs manual review. Please contact Souviks.",
        payment_provider_not_configured: "Payment verification is temporarily unavailable.",
        live_checkout_not_approved: "Payment verification is temporarily unavailable.",
      };
      return jsonResponse(req, {
        ok: false,
        code: error.code,
        message: messages[error.code] || "Payment verification is temporarily unavailable. Please retry shortly.",
      }, error.status);
    }
    console.error("[Cashfree verify-order] Unexpected verification error");
    return jsonResponse(req, {
      ok: false,
      code: "payment_verification_unavailable",
      message: "Payment verification is temporarily unavailable. Please retry shortly.",
    }, 503);
  }
});
