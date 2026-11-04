import {
  allowedOrigin,
  jsonResponse,
  optionalUserId,
  sha256Hex,
  supabaseRest,
} from "../_shared/cashfree.ts";
import {
  InvoiceError,
  getInvoiceOrder,
  prepareInvoiceDraft,
} from "../_shared/gst-invoice.ts";

function mode(): "sandbox" | "production" {
  return (Deno.env.get("CASHFREE_MODE") || "sandbox").trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    invoice_order_not_found: "The order could not be found.",
    invoice_payment_not_confirmed: "A draft invoice is available only after Cashfree confirms payment.",
    invoice_tax_profile_missing: "Invoice preparation is pending accountant-approved HSN/SAC and GST-rate details for one or more items. Please contact Souviks.",
    invoice_order_tax_basis_unconfirmed: "Invoice preparation is on hold until the tax basis is verified.",
    invoice_place_of_supply_state_unrecognised: "The recipient state could not be verified for GST calculation. Please contact Souviks.",
    invoice_recipient_gstin_invalid: "The GSTIN entered at checkout is invalid. Please contact Souviks to correct the invoice details.",
    invoice_b2b_recipient_details_missing: "Business recipient details are incomplete. Please contact Souviks.",
    invoice_order_total_mismatch: "The invoice total does not match the verified paid order. Please contact Souviks.",
    invoice_storage_unavailable: "The invoice PDF could not be stored securely. Please retry shortly.",
    invoice_download_unavailable: "The invoice download is temporarily unavailable. Please retry shortly.",
  };
  return messages[code] || "The invoice could not be prepared. Please contact Souviks with your order reference.";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin, mode())) return new Response("Origin not allowed", { status: 403 });
    return jsonResponse(req, { ok: true });
  }
  if (req.method !== "POST") return jsonResponse(req, { ok: false, code: "method_not_allowed" }, 405);
  if (!allowedOrigin(origin, mode())) return jsonResponse(req, { ok: false, code: "origin_not_allowed" }, 403);

  try {
    const input = await req.json();
    const orderId = String(input?.order_id || "").trim();
    const token = String(input?.checkout_token || "").trim();
    if (!/^[A-Z0-9_-]{3,45}$/.test(orderId)) {
      return jsonResponse(req, { ok: false, code: "order_reference_invalid" }, 400);
    }

    const order = await getInvoiceOrder(orderId);
    const userId = await optionalUserId(req);
    const ownerId = order.user_id ? String(order.user_id) : null;

    if (userId) {
      if (!ownerId || ownerId !== userId) {
        return jsonResponse(req, { ok: false, code: "invoice_access_denied" }, 403);
      }
    } else {
      if (!/^[a-f0-9]{64}$/.test(token)) {
        return jsonResponse(req, { ok: false, code: "invoice_access_denied" }, 403);
      }
      const tokenHash = await sha256Hex(token);
      const tokens = await supabaseRest("checkout_access_tokens", "GET", {
        select: "order_id,gateway_order_id,expires_at",
        gateway_order_id: "eq." + orderId,
        token_hash: "eq." + tokenHash,
        expires_at: "gt." + new Date().toISOString(),
        limit: "1",
      });
      if (!Array.isArray(tokens) || !tokens.length || String(tokens[0].order_id) !== String(order.id)) {
        return jsonResponse(req, { ok: false, code: "invoice_access_denied" }, 403);
      }
    }

    const invoice = await prepareInvoiceDraft(orderId);
    return jsonResponse(req, {
      ok: true,
      invoice_id: invoice.invoice_id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      signature_status: invoice.signature_status,
      pdf_url: invoice.pdf_url,
      message: "This is a draft tax invoice. It is not an issued GST tax invoice until an authorised signature has been applied.",
      totals: invoice.snapshot?.totals || null,
    });
  } catch (error) {
    if (error instanceof InvoiceError) {
      return jsonResponse(req, {
        ok: false,
        code: error.code,
        message: errorMessage(error.code),
      }, error.status);
    }
    console.error("[Sales invoice] Draft generation failed.");
    return jsonResponse(req, {
      ok: false,
      code: "invoice_generation_unavailable",
      message: "The invoice could not be prepared. Please contact Souviks with your order reference.",
    }, 503);
  }
});
