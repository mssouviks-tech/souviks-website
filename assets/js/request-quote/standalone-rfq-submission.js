/* request-quote.js module extracted from legacy section: standalone RFQ submission */

RFQ.ensureSubmissionStatus = function (form) {
    let status = document.getElementById("rfqFormStatus");
    if (status) return status;

    status = document.createElement("div");
    status.id = "rfqFormStatus";
    status.className = "form-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const actions = form.querySelector(".rfq-actions");
    if (actions) {
        form.insertBefore(status, actions);
    } else {
        form.appendChild(status);
    }

    return status;
};

RFQ.setSubmissionStatus = function (status, message, type = "") {
    if (!status) return;

    status.textContent = message;
    status.className = "form-status";

    if (type) {
        status.classList.add(type);
    }
};

RFQ.formatSubmissionItems = function (items) {
    return items.map((item, index) => [
        `Part Number: ${item.partNumber || "Available on request"}`,
        `Product: ${item.name || "Unnamed product"}`,
        `Brand: ${item.brand || "—"}`,
        `Quantity: ${Math.max(1, Number(item.qty) || 1)}`,
        index < items.length - 1 ? "--------------------------------" : ""
    ].filter(Boolean).join("\n")).join("\n");
};

RFQ.formatReference = function (number) {
    return "RFQ" + String(number).padStart(6, "0");
};

RFQ.collectCustomerData = function (form) {
    const userEmail = window.__SOUVIKS_RFQ_USER_EMAIL__ || "";

    return {
        name: document.getElementById("rfq-name")?.value.trim() || "",
        company: document.getElementById("rfq-company")?.value.trim() || "",
        phone: document.getElementById("rfq-phone")?.value.trim() || "",
        email: document.getElementById("rfq-email")?.value.trim() || userEmail,
        location: document.getElementById("rfq-location")?.value.trim() || "",
        gst: document.getElementById("rfq-gst")?.value.trim().toUpperCase() || "",
        message: document.getElementById("rfq-message")?.value.trim() || ""
    };
};

RFQ.submitStandalone = async function (form) {
    const items = await RFQ.get();

    if (!items.length) {
        throw new Error(rfqMessage.emptySubmit);
    }

    if (items.length > RFQ.MAX_ITEMS) {
        throw new Error("Your RFQ contains too many items. Please submit no more than 50 items at a time.");
    }

    const normalizedItems = items
        .map(item => RFQ.normalizeItem(item))
        .filter(Boolean);
    if (normalizedItems.length !== items.length) {
        throw new Error("One or more RFQ items are missing required product details. Please remove and add them again.");
    }

    const user = await RFQ.getUser();
    window.__SOUVIKS_RFQ_USER_EMAIL__ = user?.email?.trim() || "";

    const customer = RFQ.collectCustomerData(form);
    customer.name = RFQ.normalizeText(customer.name, 120);
    customer.company = RFQ.normalizeText(customer.company, 160);
    customer.phone = RFQ.normalizeText(customer.phone, 40);
    customer.email = RFQ.normalizeText(customer.email || user?.email || "", 254).toLowerCase();
    customer.location = RFQ.normalizeText(customer.location, 200);
    customer.gst = RFQ.normalizeText(customer.gst, 15).toUpperCase();
    customer.message = RFQ.normalizeText(customer.message, 2000);

    if (!customer.name || !customer.phone) {
        throw new Error(rfqMessage.namePhone);
    }

    if (typeof emailjs === "undefined") {
        throw new Error(rfqMessage.unavailable);
    }

    const rfqItemsText = RFQ.formatSubmissionItems(normalizedItems);

    if (user) {
        if (typeof supabaseClient === "undefined") {
            throw new Error(rfqMessage.unavailable);
        }

        customer.email = RFQ.normalizeText(user.email, 254).toLowerCase();

        const { data: databaseResult, error: rfqError } = await supabaseClient.rpc("submit_rfq", {
            p_customer_name: customer.name,
            p_customer_phone: customer.phone,
            p_company: customer.company || null,
            p_gst_number: customer.gst || null,
            p_message: customer.message || null,
            p_items: normalizedItems.map(item => ({
                id: item.id,
                partNumber: item.partNumber,
                name: item.name,
                brand: item.brand,
                quantity: RFQ.normalizeQuantity(item.qty)
            }))
        });

        if (rfqError || !databaseResult?.rfq_number) {
            SouviksErrors?.log("[Souviks RFQ] Atomic RFQ submission failed:", rfqError, "error");
            throw rfqError || new Error("The RFQ could not be created.");
        }

        const reference = RFQ.formatReference(databaseResult.rfq_number);
        const payload = {
            lead_id: reference,
            name: customer.name,
            company: customer.company,
            phone: customer.phone,
            email: customer.email,
            gst: customer.gst,
            location: customer.location,
            message: customer.message,
            rfq_items: rfqItemsText
        };

        let notificationSent = true;
        try {
            await emailjs.send(
                "service_trsy6ll",
                "template_udttxcf",
                payload
            );
        } catch (error) {
            notificationSent = false;
            SouviksErrors?.log("[Souviks RFQ] Notification failed after atomic RFQ creation:", error, "error");
        }

        window.souviksAnalytics?.trackLead("rfq");
        const basketCleared = await RFQ.clear();
        return { reference, basketCleared, notificationSent };
    }

    const reference = `RFQ-${Date.now()}`;
    const payload = {
        lead_id: reference,
        name: customer.name,
        company: customer.company,
        phone: customer.phone,
        email: customer.email,
        gst: customer.gst,
        location: customer.location,
        message: customer.message,
        rfq_items: rfqItemsText
    };

    await emailjs.send(
        "service_trsy6ll",
        "template_gpvlrc8",
        payload
    );

    window.souviksAnalytics?.trackLead("rfq_guest");
    const basketCleared = await RFQ.clear();
    return { reference, basketCleared, notificationSent: true };
};

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("rfq-form");
    if (!form) return;

    const status = RFQ.ensureSubmissionStatus(form);
    const submitButton = form.querySelector('button[type="submit"]');
    const honeypot = document.getElementById("website");
    const whatsappButton = document.getElementById("rfq-whatsapp");

    let submitting = false;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (submitting) return;

        if (!form.reportValidity()) return;

        if (honeypot?.value.trim()) {
            return;
        }

        submitting = true;
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        const originalText = submitButton.textContent.trim();
        submitButton.textContent = "Submitting…";
        RFQ.setSubmissionStatus(status, "Submitting your RFQ…");

        try {
            const submission = await RFQ.submitStandalone(form);
            const reference = submission.reference;
            const successMessage = submission.notificationSent === false
                ? rfqMessage.notificationFailed(reference)
                : rfqMessage.success(reference);
            const statusMessage = submission.basketCleared === false
                ? `${successMessage} ${rfqMessage.basketClearFailed || "The basket could not be cleared. Check the reference before submitting again."}`
                : successMessage;

            form.reset();
            await RFQ.refreshUI();

            RFQ.setSubmissionStatus(
                status,
                statusMessage,
                "success"
            );
        } catch (error) {
            SouviksErrors?.log("[Souviks RFQ] Submission failed:", error, "error");
            RFQ.setSubmissionStatus(
                status,
                error?.message || "Unable to submit your RFQ. Please try again.",
                "error"
            );
        } finally {
            submitting = false;
            submitButton.disabled = false;
            submitButton.removeAttribute("aria-busy");
            submitButton.textContent = originalText;
        }
    });

    whatsappButton?.addEventListener("click", async event => {
        event.preventDefault();

        const items = await RFQ.get();

        if (!items.length) {
            RFQ.setSubmissionStatus(
                status,
                "Your RFQ basket is empty. Add at least one product first.",
                "error"
            );
            return;
        }

        const customer = RFQ.collectCustomerData(form);
        const reference = `RFQ-${Date.now()}`;

        const message = [
            `RFQ Reference: ${reference}`,
            "",
            `Name: ${customer.name || "—"}`,
            `Company: ${customer.company || "—"}`,
            `Phone: ${customer.phone || "—"}`,
            `Email: ${customer.email || "—"}`,
            `Delivery Location: ${customer.location || "—"}`,
            `GST: ${customer.gst || "—"}`,
            "",
            "Requested Parts:",
            RFQ.formatSubmissionItems(items),
            "",
            "Additional Notes:",
            customer.message || "—"
        ].join("\n");

        const anchor = document.createElement("a");
        anchor.href = `https://wa.me/917908215701?text=${encodeURIComponent(message)}`;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => anchor.remove(), 0);
    });
});
