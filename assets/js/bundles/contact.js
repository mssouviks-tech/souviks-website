/* Shared core is loaded by the HTML page before this bundle. */

/* ===== pages/contact.js ===== */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const submitButton = form.querySelector('button[type="submit"]');
    const honeypot = document.getElementById("website");
    const status = ensureStatus(form, "contactFormStatus");

    emailjs.init("HYXrRpK5XSEAGf5s2");

    let submitting = false;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (submitting) return;
        if (!form.reportValidity()) return;
        if (honeypot?.value.trim()) return;

        const payload = {
            lead_id: `ENQ-${Date.now()}`,
            name: document.getElementById("contactName")?.value.trim() || "",
            phone: document.getElementById("contactPhone")?.value.trim() || "",
            email: document.getElementById("contactEmail")?.value.trim() || "",
            vehicle: document.getElementById("contactVehicle")?.value.trim() || "",
            message: document.getElementById("contactMessage")?.value.trim() || ""
        };

        if (!payload.name || !payload.phone || !payload.message) return;

        submitting = true;
        setSubmitting(submitButton, true);
        setStatus(status, "Sending your enquiry…");

        try {
            if (typeof emailjs === "undefined") {
                throw new Error("Email service unavailable.");
            }

            await emailjs.send(
                "service_trsy6ll",
                "template_gpvlrc8",
                payload
            );

            window.souviksAnalytics?.trackLead("contact");
            form.reset();
            setStatus(
                status,
                getMessage("success", `Enquiry submitted successfully. Reference: ${payload.lead_id}`),
                "success"
            );
            showLeadSuccess(payload.lead_id, payload);
        } catch (error) {
            SouviksErrors?.log("[Souviks Contact] Submission failed:", error, "error");
            setStatus(
                status,
                getMessage("error", "Unable to submit your enquiry. Please try again."),
                "error"
            );
        } finally {
            submitting = false;
            setSubmitting(submitButton, false);
        }
    });
});

function ensureStatus(form, id) {
    let status = document.getElementById(id);
    if (status) return status;

    status = document.createElement("div");
    status.id = id;
    status.className = "form-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.appendChild(status);
    return status;
}

function setStatus(element, message, type = "") {
    if (!element) return;
    element.textContent = message;
    element.className = "form-status";
    if (type) element.classList.add(type);
}

function setSubmitting(button, submitting) {
    if (!button) return;

    if (submitting) {
        button.dataset.defaultText = button.textContent.trim();
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = "Sending…";
        return;
    }

    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = button.dataset.defaultText || "Send Inquiry";
}

function getMessage(key, fallback) {
    const lang = (document.documentElement.lang || "en").toLowerCase();

    const messages = {
        bn: {
            success: "আপনার জিজ্ঞাসা সফলভাবে পাঠানো হয়েছে।",
            error: "আপনার জিজ্ঞাসা পাঠানো যায়নি। আবার চেষ্টা করুন।"
        },
        hi: {
            success: "आपकी पूछताछ सफलतापूर्वक भेज दी गई है।",
            error: "आपकी पूछताछ भेजी नहीं जा सकी। कृपया फिर प्रयास करें।"
        }
    };

    return messages[lang]?.[key] || fallback;
}

function showLeadSuccess(leadId, payload) {
    document.querySelectorAll(".lead-success-modal").forEach(modal => modal.remove());

    const closeReturnTarget = document.activeElement;

    const modal = document.createElement("div");
    modal.className = "lead-success-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "contactSuccessTitle");
    modal.tabIndex = -1;

    const content = document.createElement("div");
    content.className = "lead-success-content";

    const title = document.createElement("h2");
    title.id = "contactSuccessTitle";
    title.textContent = "Enquiry Submitted Successfully";

    const referenceLabel = document.createElement("p");
    referenceLabel.textContent = "Reference Number";

    const reference = document.createElement("h3");
    reference.textContent = leadId;

    const note = document.createElement("p");
    note.textContent = "We have received your enquiry. For a faster response, you can also share it with Souviks on WhatsApp.";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "12px";
    actions.style.justifyContent = "center";
    actions.style.marginTop = "20px";
    actions.style.flexWrap = "wrap";

    const whatsapp = document.createElement("a");
    whatsapp.href = `https://wa.me/917908215701?text=${encodeURIComponent(
        `Enquiry ${leadId}\n\nName: ${payload.name}\nPhone: ${payload.phone}\nEmail: ${payload.email}\nVehicle: ${payload.vehicle}\n\nMessage:\n${payload.message}`
    )}`;
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
    whatsapp.className = "btn btn-primary";
    whatsapp.textContent = "Open WhatsApp";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-secondary";
    close.textContent = "Close";

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKeyDown = event => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeModal();
            return;
        }

        if (event.key !== "Tab") return;

        const focusable = [...modal.querySelectorAll(focusableSelector)].filter(element =>
            !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true"
        );
        if (!focusable.length) {
            event.preventDefault();
            modal.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    const closeModal = () => {
        modal.remove();
        document.removeEventListener("keydown", onKeyDown);
        closeReturnTarget?.focus?.({ preventScroll: true });
    };

    close.addEventListener("click", closeModal);
    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", onKeyDown);

    actions.append(whatsapp, close);
    content.append(title, referenceLabel, reference, note, actions);
    modal.appendChild(content);
    document.body.appendChild(modal);
    close.focus({ preventScroll: true });
}
