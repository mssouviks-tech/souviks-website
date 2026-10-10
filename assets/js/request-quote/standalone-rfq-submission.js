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
    const storedItems = await RFQ.get();
    const items = RFQ.validateSubmissionItems(storedItems);
    const user = await RFQ.getUser();
    window.__SOUVIKS_RFQ_USER_EMAIL__ = user?.email?.trim() || "";

    const customer = RFQ.validateSubmissionCustomer(
        RFQ.collectCustomerData(form)
    );

    if (typeof emailjs === "undefined") {
        throw new Error(rfqMessage.unavailable);
    }

    if (user) {
        if (typeof supabaseClient === "undefined") {
            throw new Error(rfqMessage.failed);
        }

        const rpcItems = items.map(item => ({
            id: item.id,
            partNumber: item.partNumber,
            name: item.name,
            brand: item.brand,
            quantity: item.quantity
        }));

        const { data: rfq, error: rfqError } = await supabaseClient.rpc(
            "submit_rfq",
            {
                p_customer_name: customer.name,
                p_customer_phone: customer.phone,
                p_company: customer.company || null,
                p_gst_number: customer.gst || null,
                p_message: customer.message || null,
                p_items: rpcItems
            }
        );

        if (rfqError) {
            SouviksErrors?.log(
                "[Souviks RFQ] Atomic RFQ submission failed:",
                rfqError,
                "error"
            );
            throw new Error(rfqMessage.failed);
        }

        if (
            !rfq ||
            typeof rfq !== "object" ||
            !rfq.id ||
            !Number.isSafeInteger(Number(rfq.rfq_number)) || Number(rfq.rfq_number) < 1
        ) {
            throw new Error(rfqMessage.failed);
        }

        const reference = RFQ.formatReference(rfq.rfq_number);
        const payload = {
            lead_id: reference,
            name: customer.name,
            company: customer.company,
            phone: customer.phone,
            email: user.email?.trim() || customer.email,
            gst: customer.gst,
            location: customer.location,
            message: customer.message,
            rfq_items: RFQ.formatSubmissionItems(items)
        };

        try {
            await emailjs.send(
                "service_trsy6ll",
                "template_udttxcf",
                payload
            );
        } catch (error) {
            SouviksErrors?.log(
                "[Souviks RFQ] Notification failed after RFQ creation:",
                error,
                "error"
            );
            throw new Error(
                rfqMessage.notificationFailed(reference)
            );
        }

        window.souviksAnalytics?.trackLead("rfq");
        try {
            const cleared = await RFQ.clear();
            if (cleared === false) {
                SouviksErrors?.log(
                    "[Souviks RFQ] Basket could not be cleared after successful submission.",
                    new Error("Basket clear returned false."),
                    "warn"
                );
            }
        } catch (error) {
            SouviksErrors?.log(
                "[Souviks RFQ] Basket clear failed after successful submission:",
                error,
                "error"
            );
        }
        return reference;
    }

    const reference = "RFQ-" + Date.now();
    const payload = {
        lead_id: reference,
        name: customer.name,
        company: customer.company,
        phone: customer.phone,
        email: customer.email,
        gst: customer.gst,
        location: customer.location,
        message: customer.message,
        rfq_items: RFQ.formatSubmissionItems(items)
    };

    await emailjs.send(
        "service_trsy6ll",
        "template_gpvlrc8",
        payload
    );

    window.souviksAnalytics?.trackLead("rfq_guest");
    try {
        const cleared = await RFQ.clear();
        if (cleared === false) {
            SouviksErrors?.log(
                "[Souviks RFQ] Guest basket could not be cleared after successful submission.",
                new Error("Basket clear returned false."),
                "warn"
            );
        }
    } catch (error) {
        SouviksErrors?.log(
            "[Souviks RFQ] Guest basket clear failed after successful submission:",
            error,
            "error"
        );
    }
    return reference;
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
            const reference = await RFQ.submitStandalone(form);

            form.reset();
            await RFQ.updateBadge();
            await RFQ.renderPage();

            RFQ.setSubmissionStatus(
                status,
                rfqMessage.success(reference),
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
