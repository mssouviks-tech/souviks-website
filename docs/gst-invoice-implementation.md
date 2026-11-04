# Souviks website GST invoice creation

**Status:** Implementation branch; not deployed to production  
**Branch:** `feat/gst-invoice-creation`  
**Business facts:** GST REG-06 certificate supplied 4 November 2026; sales to B2B and B2C; Cashfree checkout prices configured as GST-inclusive.

## Seller identity loaded from supplied GST REG-06

- Legal name: **CHANDRANI SADHU**
- Trade name: **Souviks**
- Constitution: **Proprietorship**
- GSTIN: **19BZMPS2461K1ZO**
- Principal place of business: **6, Souviks, Beside NH-2, Andal, Bardhaman, West Bengal, 713321**
- State code: **19**
- Registration type on certificate: Regular
- Certificate issue date: 7 July 2018
- Annexure A: no additional places of business listed

The sample letterhead uses a different CN-119(2) address. The invoice seller address uses the GST REG-06 principal place above. The uploaded certificate is from 2018; verify current GST Portal registration status and check for later amendments before production use.

Bank details are transcribed from the supplied letterhead only (PNB, IFSC PUNB0048510, account name Souviks, account 04854015003137). They are not in the GST certificate; independently confirm them with the bank before using them for customer payments. The implementation currently retains these details in the draft PDF to match the supplied invoice sample.

## Customer workflow

1. Cashfree must confirm payment and the order must be stored with `payment_status=paid` and `paid_at`.
2. The payment-status page shows a “Download draft tax invoice” control. The customer's short-lived checkout access token is retained in session storage after payment for up to the checkout-token expiry (currently seven days).
3. Signed-in customers can request the same draft from My Account order history; the Edge Function checks that the order belongs to the authenticated user. Guest access requires the matching high-entropy checkout token.
4. The Edge Function re-reads the paid order and order items from Supabase; it does not trust product prices, taxes or totals sent from the browser.
5. It looks up an approved tax profile for every product SKU and, where freight was charged, the separate `FREIGHT` profile.
6. It calculates GST from the stored paid gross amount, using the approved rate and inclusive-price basis. For intra-state supplies, it splits GST into CGST and SGST; for inter-state supplies, it uses IGST. The result must reconcile exactly to the verified Cashfree order total.
7. It creates one draft invoice per order, allocates a consecutive financial-year serial such as `SVKS/26-27/00001`, generates a PDF and stores it in a private Supabase Storage bucket. The browser receives a five-minute signed download URL.
8. The customer PDF is visibly marked **DRAFT - AUTHORISED SIGNATURE PENDING**. The system does not call it an issued tax invoice.

## Tax profile requirements

The migration creates `public.gst_tax_profiles`, but intentionally inserts no tax rates or HSN/SAC values. The accountant must approve an effective-dated profile for every active SKU and a separate profile for freight, with:
- HSN/SAC code and item description;
- unit of measure;
- GST rate and confirmation that the checkout amount includes GST;
- effective date range and documentary source (a new profile row is required when the treatment changes, preserving prior approved rows);
- approver identity and approval timestamp;
- explicit reverse-charge and cess applicability;
- approver identity and approval timestamp for every effective-dated row.

Only profiles with `approval_status=approved`, evidence fields, valid dates, a non-empty unit code and explicit reverse-charge/cess decisions are accepted. The database allows multiple rows for one SKU with different effective dates, and the invoice lookup selects a profile valid on the invoice date. The current invoice calculation does not support reverse-charge or cess-rated lines; such orders fail closed pending a separate implementation. A zero GST rate must be an explicit accountant-approved classification, not a default.

Worklist: `docs/audit/gst-tax-profile-worklist.csv` (1,157 active SKUs plus one freight profile). It is a data-collection sheet, not an approved rate master.

## Billing address and place of supply

Checkout captures:
- the delivery address used for serviceability and delivery;
- a “billing address same as delivery” choice; and
- a separate billing address when the customer chooses a different bill-to address or store pickup.

The invoice prints the billing address as the recipient address. If a delivery address differs, the PDF separately prints “Ship To”. For delivery, the implementation uses the destination state as the place-of-supply input; for store pickup, it uses Souviks' West Bengal location. Special bill-to/ship-to transactions, third-party-directed movement and any exceptions must be reviewed by the accountant before production use.

## Draft versus issued invoice

This first implementation creates a **draft only**. The PDF contains a blank authorised-signatory line and a visible draft watermark. The database has a separate signature/issue state, but this PR does not provide a proprietor signature-capture, DSC/e-sign provider or staff issuance workflow. Do not send the draft as the final statutory tax invoice or mark the order invoice as issued. A separate authorised signature and issuance process is required first.

The invoice PDF does not yet implement:
- e-invoice IRN/QR code generation where applicable;
- credit notes, debit notes and partial-return GST adjustment;
- reverse-charge or compensation cess calculations;
- multiple tax-component/cess configurations;
- an admin screen to approve tax profiles or sign/issue invoices;
- a separate delivery note/e-way bill workflow.

The accountant must determine whether e-invoicing, e-way bills, export/SEZ, reverse charge or other special treatment applies to a transaction before the invoice can be considered complete.

## Production release gates

Do not apply the migration or deploy the Edge Function to production until:
1. The GST Portal confirms the registration is active and has no later amendment; legal name/address/state match the certificate.
2. The accountant completes and signs off all SKU and freight tax profiles.
3. Bank account details are verified independently.
4. B2B and B2C sample orders pass intra-state, inter-state, pickup, delivery, freight, mixed-rate, rounding and GST-inclusive-total reconciliation tests.
5. A designated authorised signatory process is implemented and tested before invoices are issued.
6. Security review confirms that customer PDFs remain in the private bucket, guest token access is time-limited, account access is owner-scoped, and tax profile tables cannot be written by browser clients.

## Regulatory reference

Check current requirements and applicability with the accountant / Indian GST professional before production issuance. See the official CBIC GST Invoice Rules at https://cbic-gst.gov.in/gst-invoice-rules.html.
