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
    "subtotal", "shipping_amount", "total_amount", "payment_status",
    "order_status", "cashfree_order_status", "paid_at", "updated_at",
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
          select: "order_id,part_number,product_name,brand,quantity,unit_price,line_total",
          order_id: "in.(" + orderIds.join(",") + ")",
          limit: "1000",
        })
      : [];
    const itemsByOrder = new Map<string, any[]>();
    for (const item of Array.isArray(items) ? items : []) {
      const key = String(item?.order_id || "");
      if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
      itemsByOrder.get(key)!.push({
        part_number: item.part_number || null,
        product_name: String(item.product_name || ""),
        brand: item.brand || null,
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
      payment_status: String(order.payment_status || "pending"),
      order_status: String(order.order_status || "awaiting_payment"),
      cashfree_order_status: String(order.cashfree_order_status || ""),
      paid_at: order.paid_at || null,
      updated_at: order.updated_at || null,
      payment_failure_code: order.payment_failure_code || null,
      payment_failure_reason: order.payment_failure_reason || null,
      items: itemsByOrder.get(String(order.id)) || [],
    }));
    return jsonResponse(req, { ok: true, orders: result });
  } catch {
    console.error("[Account orders] Could not load authenticated order history.");
    return jsonResponse(req, { ok: false, code: "account_orders_unavailable" }, 503);
  }
});
