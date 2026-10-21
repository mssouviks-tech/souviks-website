import {
  cashfreeConfig,
  CheckoutError,
  reconcileCashfreeOrder,
  supabaseRest,
  verifyCashfreeWebhookSignature,
} from "../_shared/cashfree.ts";

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { received: false });
  const signature = req.headers.get("x-webhook-signature") || "";
  const timestamp = req.headers.get("x-webhook-timestamp") || "";
  if (!signature || !timestamp) return response(400, { received: false });

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return response(400, { received: false });
  }
  if (!rawBody || rawBody.length > 1048576) return response(413, { received: false });

  try {
    const config = cashfreeConfig();
    const valid = await verifyCashfreeWebhookSignature(signature, timestamp, rawBody, config.clientSecret);
    if (!valid) return response(401, { received: false });

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return response(400, { received: false });
    }
    const eventType = String(payload?.type || "UNKNOWN").slice(0, 100);
    const gatewayOrderId = String(payload?.data?.order?.order_id || "").trim();
    const cfPaymentId = String(payload?.data?.payment?.cf_payment_id || "").trim();
    const paymentStatus = String(payload?.data?.payment?.payment_status || "").toUpperCase();
    const rawAmount = Number(payload?.data?.payment?.payment_amount);
    const currency = String(payload?.data?.payment?.payment_currency || "INR").toUpperCase();

    if (!gatewayOrderId || !/^[A-Z0-9_-]{3,45}$/.test(gatewayOrderId)) {
      // Authenticated events for other/legacy orders are acknowledged but cannot mutate order state.
      return response(200, { received: true, ignored: true });
    }

    const result = await reconcileCashfreeOrder(gatewayOrderId);
    if (cfPaymentId && Number.isFinite(rawAmount)) {
      const verifiedAmount = Number(result.amount);
      if (Math.round(rawAmount * 100) === Math.round(verifiedAmount * 100) && currency === "INR") {
        try {
          await supabaseRest("cashfree_payment_events", "POST", {}, {
            gateway_order_id: gatewayOrderId,
            cf_payment_id: cfPaymentId,
            payment_status: paymentStatus || "UNKNOWN",
            payment_amount: rawAmount,
            payment_currency: currency,
            event_source: eventType,
          }, "resolution=ignore-duplicates,return=minimal");
        } catch {
          // Event storage is best-effort; order status comes from a signed event plus API reconciliation.
        }
      }
    }
    return response(200, { received: true });
  } catch (error) {
    if (error instanceof CheckoutError && ["order_not_found"].includes(error.code)) {
      return response(200, { received: true, ignored: true });
    }
    console.error("[Cashfree webhook] Processing failed; provider may retry");
    return response(500, { received: false });
  }
});
