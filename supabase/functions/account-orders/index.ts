import {
  allowedOrigin,
  jsonResponse,
  optionalUserId,
  reconcileCashfreeOrder,
  supabaseRest,
} from "../_shared/cashfree.ts";

function runtimeMode(): "sandbox" | "production" {
  return (Deno.env.get("CASHFREE_MODE") || "sandbox").trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

async function loadOrders(userId: string, includeFailureReason: boolean): Promise<any[]> {
  const fields = [
    "id", "order_number", "gateway_order_id", "created_at", "currency",
    "subtotal", "shipping_amount", "total_amount", "fulfillment_method", "payment_status",
    "order_status", "cashfree_order_status", "fulfillment_method", "paid_at", "updated_at",
  ];
  if (includeFailureReason) fields.push("payment_failure_code", "payment_failure_reason");
  return await supabaseRest("orders", "GET", {
    select: fields.join(","),
    user_id: "eq." + userId,
    order: "created_at.desc",
    limit: "20",
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin, runtimeMode())) return new Response("Origin not allowed", { status: 403 });
    return jsonResponse(req, { ok: true });
  }
  if (req.method !== "POST") return jsonResponse(req, { ok: false, code: "method_not_allowed" }, 405);
  if (!allowedOrigin(origin, runtimeMode())) return jsonResponse(req, { ok: false, code: "origin_not_allowed" }, 403);

  try {
    const userId = await optionalUserId(req);
    if (!userId) return jsonResponse(req, { ok: false, code: "authentication_required" }, 401);

    let orders: any[];
    try {
      orders = await loadOrders(userId, true);
    } catch {
      // This endpoint can be deployed before the optional payment-failure columns;
      // after the migration arrives the richer result is returned automatically.
      orders = await loadOrders(userId, false);
    }
    if (!Array.isArray(orders)) throw new Error("Account orders response was not an array.");
    if (!orders.length) return jsonResponse(req, { ok: true, orders: [] });

    // Refresh only the five most recent pending orders. A failed provider query
    // must not break order history, and only orders already scoped to this
    // authenticated user can be reconciled here.
    const pendingOrders = orders
      .filter(order => String(order?.payment_status || "").toLowerCase() === "pending" && order?.gateway_order_id)
      .slice(0, 5);
    await Promise.all(pendingOrders.map(async order => {
      try {
        await reconcileCashfreeOrder(String(order.gateway_order_id));
      } catch {
        // Keep showing the last stored status if Cashfree or its configuration
        // cannot be reached. The payment verifier/webhook can reconcile later.
      }
    }));

    // Read the changed statuses and optional bank-decline reason back from storage.
    try {
      orders = await loadOrders(userId, true);
    } catch {
      orders = await loadOrders(userId, false);
    }
    if (!Array.isArray(orders)) throw new Error("Account order refresh response was not an array.");

    const orderIds = orders.map(order => String(order?.id || "")).filter(id => /^[0-9a-f-]{36}$/i.test(id));
    const items = orderIds.length
      ? await supabaseRest("order_items", "GET", {
          select: "order_id,part_number,product_name,brand,hsn_code,hsn_description,hsn_classification_status,hsn_confidence,quantity,unit_price,line_total",
          order_id: "in.(" + orderIds.join(",") + ")",
          limit: "1000",
        })
      : [];
    const invoiceRows = orderIds.length
      ? await supabaseRest("gst_invoices", "GET", {
          select: "order_id,invoice_number,invoice_status",
          order_id: "in.(" + orderIds.join(",") + ")",
          limit: "20",
        })
      : [];
    const freightRows = orderIds.length
      ? await supabaseRest("freight_quotes", "GET", {
          select: "id,order_id,quote_number,status,amount,valid_until,carrier,delivery_estimate",
          order_id: "in.(" + orderIds.join(",") + ")",
          limit: "20",
        })
      : [];
    const freightByOrder = new Map<string, any>();
    for (const freight of Array.isArray(freightRows) ? freightRows : []) {
      freightByOrder.set(String(freight.order_id), freight);
    }
    const invoicesByOrder = new Map<string, any>();
    for (const invoice of Array.isArray(invoiceRows) ? invoiceRows : []) {
      invoicesByOrder.set(String(invoice.order_id), invoice);
    }
    const itemsByOrder = new Map<string, any[]>();
    for (const item of Array.isArray(items) ? items : []) {
      const key = String(item?.order_id || "");
      if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
      itemsByOrder.get(key)!.push({
        part_number: item.part_number || null,
        product_name: String(item.product_name || ""),
        brand: item.brand || null,
        hsn_code: item.hsn_code || null,
        hsn_description: item.hsn_description || null,
        hsn_classification_status: item.hsn_classification_status || null,
        hsn_confidence: item.hsn_confidence || null,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        line_total: Number(item.line_total) || 0,
      });
    }

    const result = orders.map(order => ({
      order_number: String(order.order_number || ""),
      gateway_order_id: String(order.gateway_order_id || ""),
      created_at: order.created_at,
      currency: String(order.currency || "INR"),
      subtotal: Number(order.subtotal) || 0,
      shipping_amount: Number(order.shipping_amount) || 0,
      total_amount: Number(order.total_amount) || 0,
      fulfillment_method: String(order.fulfillment_method || "delivery"),
      payment_status: String(order.payment_status || "pending"),
      order_status: String(order.order_status || "awaiting_payment"),
      cashfree_order_status: String(order.cashfree_order_status || ""),
      paid_at: order.paid_at || null,
      updated_at: order.updated_at || null,
      payment_failure_code: order.payment_failure_code || null,
      payment_failure_reason: order.payment_failure_reason || null,
      invoice_status: invoicesByOrder.get(String(order.id))?.invoice_status ||
        (Deno.env.get("GST_INVOICE_ISSUANCE_ENABLED") === "true" &&
         String(order.payment_status || "") === "paid" &&
         (String(order.fulfillment_method || "delivery") === "pickup" ||
          freightByOrder.get(String(order.id))?.status === "paid") ? "pending" : null),
      invoice_number: invoicesByOrder.get(String(order.id))?.invoice_number || null,
      freight_quote_id: freightByOrder.get(String(order.id))?.id || null,
      freight_quote_number: freightByOrder.get(String(order.id))?.quote_number || null,
      freight_status: freightByOrder.get(String(order.id))?.status || null,
      freight_amount: Number(freightByOrder.get(String(order.id))?.amount) || 0,
      freight_valid_until: freightByOrder.get(String(order.id))?.valid_until || null,
      freight_carrier: freightByOrder.get(String(order.id))?.carrier || null,
      freight_delivery_estimate: freightByOrder.get(String(order.id))?.delivery_estimate || null,
      items: itemsByOrder.get(String(order.id)) || [],
    }));
    return jsonResponse(req, { ok: true, orders: result });
  } catch {
    console.error("[Account orders] Could not load authenticated order history.");
    return jsonResponse(req, { ok: false, code: "account_orders_unavailable" }, 503);
  }
});
