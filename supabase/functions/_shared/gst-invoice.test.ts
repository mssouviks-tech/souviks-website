import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { InvoiceError, renderInvoicePdf } from "./gst-invoice.ts";

function sampleSnapshot(lineCount: number, recipientName = "Acme Components Pvt Ltd") {
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    line_type: "product",
    product_id: "SVKS000001",
    description: "Commercial vehicle filter assembly " + (index + 1),
    part_number: "LF19662",
    brand: "Fleetguard",
    hsn_sac_code: "84212300",
    quantity: 1,
    unit_code: "NOS",
    unit_rate_inr: "1000.00",
    taxable_value_inr: "847.46",
    gst_rate_percent: 18,
    cgst_inr: "76.27",
    sgst_inr: "76.27",
    igst_inr: "0.00",
    tax_amount_inr: "152.54",
    line_total_inr: "1000.00",
  }));
  return {
    schema: "souviks-gst-invoice-draft/v1",
    order_id: "00000000-0000-4000-8000-000000000001",
    order_number: "SVKS-TEST-000001",
    gateway_order_id: "SVKS-TEST-000001",
    invoice_date: "2026-11-04",
    seller: {
      legal_name: "CHANDRANI SADHU",
      trade_name: "Souviks",
      constitution: "Proprietorship",
      gstin: "19BZMPS2461K1ZO",
      address: ["6, Souviks, Beside NH-2", "Andal, Bardhaman, West Bengal - 713321"],
      state_code: "19",
      state_name: "West Bengal",
    },
    recipient: {
      type: "B2B",
      name: recipientName,
      gstin: "19ABCDE1234F1Z5",
      address: ["Plot 1, Industrial Area", "Kolkata", "West Bengal", "700001"],
      state_name: "West Bengal",
      state_code: "19",
      postal_code: "700001",
    },
    place_of_supply: {
      state_name: "West Bengal",
      state_code: "19",
      intra_state: true,
    },
    delivery_address: ["Plot 1, Industrial Area", "Kolkata", "West Bengal", "700001"],
    reverse_charge: "No",
    fulfillment_method: "delivery",
    payment: {
      status: "PAID",
      paid_at: "2026-11-04T12:00:00+05:30",
      gateway: "Cashfree",
      provider_reference: "CF-TEST-REF",
      order_reference: "SVKS-TEST-000001",
    },
    lines,
    totals: {
      taxable_total: Number((847.46 * lineCount).toFixed(2)),
      cgst_total: Number((76.27 * lineCount).toFixed(2)),
      sgst_total: Number((76.27 * lineCount).toFixed(2)),
      igst_total: 0,
      tax_total: Number((152.54 * lineCount).toFixed(2)),
      invoice_total: 1000 * lineCount,
      freight_total: 0,
      round_off: "0.00",
    },
    currency: "INR",
    signature_status: "PENDING",
    signature_note: "DRAFT - AUTHORISED SIGNATURE REQUIRED",
  };
}

Deno.test("GST invoice PDF renders as a valid multi-page draft", async () => {
  const bytes = await renderInvoicePdf("SVKS/26-27/00001", sampleSnapshot(20));
  if (bytes.byteLength < 1000) throw new Error("Generated PDF is unexpectedly small.");
  const pdf = await PDFDocument.load(new Uint8Array(bytes));
  if (pdf.getPageCount() < 2) throw new Error("Expected a multi-page PDF for 20 invoice lines.");
  const title = pdf.getTitle() || "";
  if (!title.includes("SVKS/26-27/00001")) throw new Error("Invoice number is missing from PDF metadata.");
});

Deno.test("GST invoice PDF refuses unsupported non-English recipient text instead of losing it", async () => {
  try {
    await renderInvoicePdf("SVKS/26-27/00002", sampleSnapshot(1, "বাংলা গ্রাহক"));
    throw new Error("Expected non-English text to be rejected.");
  } catch (error) {
    if (!(error instanceof InvoiceError) || error.code !== "invoice_text_requires_english") {
      throw error;
    }
  }
});
