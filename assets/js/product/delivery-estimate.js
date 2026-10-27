(() => {
    "use strict";

    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const ESTIMATE_KEY = "souviks_delivery_estimate_v1";
    const DATE_LOCALES = { en: "en-IN", hi: "hi-IN", bn: "bn-IN" };
    const COPY = {
        en: {
            title: "Check delivery to your PIN code",
            intro: "Enter your 6-digit PIN code to see the estimated delivery date.",
            label: "Delivery PIN code",
            check: "Check availability",
            checking: "Checking delivery availability…",
            invalid: "Enter a valid 6-digit PIN code.",
            success: "Souviks can deliver to PIN code",
            date: "Estimated delivery date",
            disclaimer: "This is an estimate, not a guaranteed date. Availability and delivery timing can change.",
            unavailable: "We could not confirm delivery to PIN code",
            failed: "We could not confirm the delivery estimate right now. Please try again shortly or contact Souviks."
        },
        hi: {
            title: "अपने पिन कोड पर डिलीवरी जाँचें",
            intro: "अनुमानित डिलीवरी तारीख देखने के लिए 6 अंकों का पिन कोड दर्ज करें।",
            label: "डिलीवरी पिन कोड",
            check: "उपलब्धता जाँचें",
            checking: "डिलीवरी उपलब्धता जाँची जा रही है…",
            invalid: "कृपया 6 अंकों का सही पिन कोड दर्ज करें।",
            success: "Souviks इस पिन कोड पर डिलीवरी कर सकता है:",
            date: "अनुमानित डिलीवरी तारीख",
            disclaimer: "यह अनुमानित तारीख है, गारंटी नहीं। उपलब्धता और डिलीवरी का समय बदल सकता है।",
            unavailable: "हम इस पिन कोड पर डिलीवरी की पुष्टि नहीं कर सके:",
            failed: "अभी डिलीवरी का अनुमान प्राप्त नहीं हुआ। कृपया कुछ देर बाद फिर प्रयास करें या Souviks से संपर्क करें।"
        },
        bn: {
            title: "আপনার পিন কোডে ডেলিভারি যাচাই করুন",
            intro: "আনুমানিক ডেলিভারির তারিখ দেখতে ৬ সংখ্যার পিন কোড দিন।",
            label: "ডেলিভারি পিন কোড",
            check: "উপলভ্যতা যাচাই করুন",
            checking: "ডেলিভারির উপলভ্যতা যাচাই হচ্ছে…",
            invalid: "সঠিক ৬ সংখ্যার পিন কোড দিন।",
            success: "Souviks এই পিন কোডে ডেলিভারি করতে পারে:",
            date: "আনুমানিক ডেলিভারির তারিখ",
            disclaimer: "এটি একটি অনুমান, নিশ্চিত তারিখ নয়। উপলভ্যতা ও ডেলিভারির সময় বদলাতে পারে।",
            unavailable: "এই পিন কোডে ডেলিভারি নিশ্চিত করা যায়নি:",
            failed: "এই মুহূর্তে ডেলিভারির অনুমান নিশ্চিত করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন বা Souviks-এর সঙ্গে যোগাযোগ করুন।"
        }
    };
    const T = COPY[LANGUAGE] || COPY.en;

    function readSavedEstimate() {
        try {
            const item = JSON.parse(localStorage.getItem(ESTIMATE_KEY) || "null");
            if (item && /^\d{6}$/.test(String(item.destinationPin || "")) && item.serviceable === true) return item;
        } catch {
            // Storage is optional; a failed read must not break the page.
        }
        return null;
    }

    function saveEstimate(item) {
        try {
            localStorage.setItem(ESTIMATE_KEY, JSON.stringify(item));
        } catch {
            // The user can still see the estimate if browser storage is unavailable.
        }
    }

    function clearSavedEstimateIfDifferent(pin) {
        const saved = readSavedEstimate();
        if (!saved || saved.destinationPin !== pin) {
            try { localStorage.removeItem(ESTIMATE_KEY); } catch { /* Storage is optional. */ }
        }
    }

    function parseDate(value) {
        const source = String(value || "").trim();
        if (!source) return null;
        const match = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
        let date;
        if (match) {
            date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
            if (date.getFullYear() !== Number(match[1]) ||
                date.getMonth() !== Number(match[2]) - 1 ||
                date.getDate() !== Number(match[3])) return null;
        } else {
            const parsed = new Date(source);
            if (!Number.isFinite(parsed.getTime())) return null;
            date = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
        }
        return Number.isFinite(date.getTime()) ? date : null;
    }

    function dateOnly(date) {
        return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0");
    }

    function addWorkingDays(count) {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        let remaining = count;
        while (remaining > 0) {
            date.setDate(date.getDate() + 1);
            if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1;
        }
        return date;
    }

    function resolveDeliveryDate(data) {
        const delivery = data?.delivery || {};
        const direct = parseDate(delivery.estimated_date || delivery.estimated_delivery_date ||
            delivery.delivery_date || delivery.estimatedDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (direct && direct >= today) return { estimatedDate: dateOnly(direct), source: "carrier_date" };

        const tatDays = Number(delivery.tat_days ?? delivery.tat ?? delivery.expected_tat ??
            delivery.estimated_days ?? delivery.days);
        if (Number.isFinite(tatDays) && tatDays >= 0 && tatDays <= 90) {
            const date = new Date();
            date.setHours(12, 0, 0, 0);
            date.setDate(date.getDate() + Math.max(1, Math.ceil(tatDays)));
            return { estimatedDate: dateOnly(date), source: "carrier_tat" };
        }

        // When the carrier returns serviceability but no usable TAT, use Souviks'
        // published 5–10 working-day window and label it as an estimate, never a promise.
        return { estimatedDate: dateOnly(addWorkingDays(10)), source: "standard_window" };
    }

    function formatDate(value) {
        const date = parseDate(value);
        if (!date) return "";
        return new Intl.DateTimeFormat(DATE_LOCALES[LANGUAGE] || "en-IN", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        }).format(date);
    }

    async function unpackResponse(response) {
        let data = response?.data;
        if ((!data || response.error) && response?.error?.context &&
            typeof response.error.context.json === "function") {
            try { data = await response.error.context.json(); } catch { /* Use a safe customer-facing message. */ }
        }
        return data;
    }

    function init() {
        const form = document.getElementById("product-delivery-pin-form");
        const input = document.getElementById("product-delivery-pincode");
        const button = document.getElementById("product-delivery-check-button");
        const result = document.getElementById("product-delivery-estimate-result");
        if (!form || !input || !button || !result) return;

        const title = document.getElementById("product-delivery-estimator-title");
        const intro = document.getElementById("product-delivery-estimator-intro");
        const label = document.getElementById("product-delivery-pincode-label");
        if (title) title.textContent = T.title;
        if (intro) intro.textContent = T.intro;
        if (label) label.textContent = T.label;
        button.textContent = T.check;

        let requestSequence = 0;

        function showMessage(message, isError) {
            result.hidden = !message;
            result.textContent = message || "";
            result.classList.toggle("delhivery-estimator-error", Boolean(isError));
        }

        function showSuccess(pin, estimate) {
            const dateLabel = formatDate(estimate.estimatedDate);
            result.hidden = false;
            result.classList.remove("delhivery-estimator-error");
            result.innerHTML =
                '<p class="delhivery-estimator-success">' + T.success + ' <strong>' + pin + '</strong>.</p>' +
                '<div class="delhivery-estimator-metric"><span>' + T.date + '</span><strong>' + dateLabel + '</strong></div>' +
                '<p class="delhivery-estimator-disclaimer">' + T.disclaimer + '</p>';
            result.dataset.pincode = pin;
        }

        async function checkPin(pin) {
            const current = ++requestSequence;
            button.disabled = true;
            button.setAttribute("aria-busy", "true");
            showMessage(T.checking, false);

            try {
                if (typeof supabaseClient === "undefined" || !supabaseClient?.functions?.invoke) {
                    showMessage(T.failed, true);
                    return;
                }
                const response = await supabaseClient.functions.invoke("delhivery-estimate", {
                    body: { estimate_type: "delivery_time", destination_pin: pin }
                });
                const data = await unpackResponse(response);
                if (current !== requestSequence) return;

                if (response?.error || !data?.ok) {
                    showMessage(T.failed, true);
                    return;
                }
                if (!data.serviceability?.serviceable) {
                    clearSavedEstimateIfDifferent(pin);
                    try {
                        const saved = readSavedEstimate();
                        if (saved?.destinationPin === pin) localStorage.removeItem(ESTIMATE_KEY);
                    } catch { /* Storage is optional. */ }
                    showMessage(T.unavailable + " " + pin + ". Please contact Souviks if you need help confirming an alternative.", true);
                    return;
                }

                const dateEstimate = resolveDeliveryDate(data);
                const savedEstimate = {
                    destinationPin: pin,
                    estimatedDate: dateEstimate.estimatedDate,
                    dateSource: dateEstimate.source,
                    serviceable: true,
                    checkedAt: new Date().toISOString()
                };
                saveEstimate(savedEstimate);
                showSuccess(pin, savedEstimate);
            } catch (error) {
                if (window.SouviksErrors?.log) window.SouviksErrors.log("Product delivery estimate failed", error, "warn");
                if (current === requestSequence) showMessage(T.failed, true);
            } finally {
                if (current === requestSequence) {
                    button.disabled = false;
                    button.removeAttribute("aria-busy");
                }
            }
        }

        input.addEventListener("input", () => {
            const pin = String(input.value || "").replace(/\D/g, "").slice(0, 6);
            if (input.value !== pin) input.value = pin;
            const saved = readSavedEstimate();
            if (saved && saved.destinationPin !== pin) {
                try { localStorage.removeItem(ESTIMATE_KEY); } catch { /* Storage is optional. */ }
            }
            if (result.dataset.pincode && result.dataset.pincode !== pin) {
                result.hidden = true;
                result.textContent = "";
                delete result.dataset.pincode;
            }
        });

        form.addEventListener("submit", event => {
            event.preventDefault();
            const pin = String(input.value || "").replace(/\D/g, "").slice(0, 6);
            input.value = pin;
            if (!/^\d{6}$/.test(pin)) {
                showMessage(T.invalid, true);
                input.focus();
                return;
            }
            void checkPin(pin);
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();