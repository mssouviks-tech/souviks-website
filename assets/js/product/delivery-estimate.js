(() => {
    "use strict";

    const FUNCTION_URL = "https://kjxrfmujzdxatpgegqcs.supabase.co/functions/v1/delhivery-estimate";
    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const COPY = {
        en: {
            title: "Check delivery time & shipping charges",
            intro: "Enter your delivery PIN code for a Delhivery estimate.",
            pin: "Delivery PIN code",
            weight: "Chargeable shipment weight (grams)",
            weightHelp: "Use packed chargeable weight where known. The 1,000 g default is only a rough starting point.",
            billing: "Service",
            express: "Express",
            surface: "Surface",
            payment: "Payment mode",
            prepaid: "Prepaid",
            cod: "Cash on delivery",
            button: "Check delivery",
            checking: "Checking Delhivery…",
            serviceable: "Delivery is serviceable to this PIN code.",
            unavailable: "Delivery service is not available to this PIN code for the selected payment mode.",
            price: "Estimated courier charge",
            time: "Estimated delivery time",
            days: "business day(s)",
            date: "Estimated date",
            approximate: "Approximate courier estimate only. Final shipping charges and delivery date may differ.",
            priceMissing: "Delhivery did not return a shipping price for these details.",
            timeMissing: "Delivery time estimate is currently unavailable.",
            badPin: "Enter a valid 6-digit PIN code.",
            badWeight: "Enter a chargeable weight between 1 and 200,000 grams.",
            failed: "We could not retrieve an estimate. Please try again shortly.",
            config: "Live estimates are not configured yet. Please contact Souviks for a delivery quote."
        },
        hi: {
            title: "डिलीवरी समय और शिपिंग शुल्क जाँचें",
            intro: "Delhivery का अनुमान पाने के लिए डिलीवरी पिन कोड दर्ज करें।",
            pin: "डिलीवरी पिन कोड",
            weight: "शिपमेंट का चार्जेबल वज़न (ग्राम)",
            weightHelp: "जहाँ संभव हो, पैक किए गए चार्जेबल वज़न का उपयोग करें। 1,000 ग्राम केवल एक मोटा अनुमान है।",
            billing: "सेवा",
            express: "एक्सप्रेस",
            surface: "सरफेस",
            payment: "भुगतान का तरीका",
            prepaid: "प्रीपेड",
            cod: "कैश ऑन डिलीवरी",
            button: "डिलीवरी जाँचें",
            checking: "Delhivery जाँच हो रही है…",
            serviceable: "इस पिन कोड पर डिलीवरी उपलब्ध है।",
            unavailable: "चुने गए भुगतान तरीके के लिए इस पिन कोड पर डिलीवरी उपलब्ध नहीं है।",
            price: "अनुमानित कूरियर शुल्क",
            time: "अनुमानित डिलीवरी समय",
            days: "कार्य दिवस",
            date: "अनुमानित तारीख",
            approximate: "यह केवल अनुमान है। अंतिम शिपिंग शुल्क और तारीख अलग हो सकते हैं।",
            priceMissing: "Delhivery ने इन विवरणों के लिए शुल्क नहीं लौटाया।",
            timeMissing: "डिलीवरी समय का अनुमान अभी उपलब्ध नहीं है।",
            badPin: "6 अंकों का सही पिन कोड दर्ज करें।",
            badWeight: "1 से 200,000 ग्राम के बीच चार्जेबल वज़न दर्ज करें।",
            failed: "अनुमान प्राप्त नहीं हुआ। कुछ देर बाद फिर कोशिश करें।",
            config: "लाइव अनुमान अभी कॉन्फ़िगर नहीं हैं। डिलीवरी कोट के लिए Souviks से संपर्क करें।"
        },
        bn: {
            title: "ডেলিভারির সময় ও শিপিং চার্জ যাচাই করুন",
            intro: "Delhivery-এর আনুমানিক হিসাব পেতে ডেলিভারি পিন কোড দিন।",
            pin: "ডেলিভারি পিন কোড",
            weight: "শিপমেন্টের চার্জেবল ওজন (গ্রাম)",
            weightHelp: "সম্ভব হলে প্যাক করা চার্জেবল ওজন ব্যবহার করুন। ১,০০০ গ্রাম কেবল প্রাথমিক আনুমানিক মান।",
            billing: "পরিষেবা",
            express: "এক্সপ্রেস",
            surface: "সারফেস",
            payment: "পেমেন্টের ধরন",
            prepaid: "প্রিপেইড",
            cod: "ক্যাশ অন ডেলিভারি",
            button: "ডেলিভারি যাচাই করুন",
            checking: "Delhivery যাচাই হচ্ছে…",
            serviceable: "এই পিন কোডে ডেলিভারি পরিষেবা উপলব্ধ।",
            unavailable: "নির্বাচিত পেমেন্টের ধরনে এই পিন কোডে ডেলিভারি উপলব্ধ নয়।",
            price: "আনুমানিক কুরিয়ার চার্জ",
            time: "আনুমানিক ডেলিভারির সময়",
            days: "কর্মদিবস",
            date: "আনুমানিক তারিখ",
            approximate: "এটি আনুমানিক হিসাব। চূড়ান্ত শিপিং চার্জ ও তারিখ আলাদা হতে পারে।",
            priceMissing: "এই তথ্যের জন্য Delhivery শিপিং মূল্য দেয়নি।",
            timeMissing: "ডেলিভারির সময়ের হিসাব এখন উপলব্ধ নয়।",
            badPin: "৬ অঙ্কের সঠিক পিন কোড দিন।",
            badWeight: "১ থেকে ২০০,০০০ গ্রামের মধ্যে চার্জেবল ওজন দিন।",
            failed: "হিসাব পাওয়া যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
            config: "লাইভ হিসাব এখনও কনফিগার করা হয়নি। ডেলিভারি কোটের জন্য Souviks-এ যোগাযোগ করুন।"
        }
    };
    const T = COPY[LANGUAGE] || COPY.en;

    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function currency(value) {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
    }

    function init() {
        const productRoot = document.getElementById("product-detail");
        const summary = productRoot?.querySelector(".pdp-summary");
        if (!productRoot || !summary || document.getElementById("delhivery-estimator")) return;

        const panel = document.createElement("section");
        panel.id = "delhivery-estimator";
        panel.className = "delhivery-estimator pdp-section";
        panel.setAttribute("aria-labelledby", "delhivery-estimator-title");
        panel.innerHTML = `
            <h2 id="delhivery-estimator-title">${escapeHtml(T.title)}</h2>
            <p class="delhivery-estimator-intro">${escapeHtml(T.intro)}</p>
            <form id="delhivery-estimator-form" class="delhivery-estimator-form" novalidate>
                <div class="delhivery-estimator-fields">
                    <div class="form-group">
                        <label for="delhivery-destination-pin">${escapeHtml(T.pin)}</label>
                        <input id="delhivery-destination-pin" name="destination_pin" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required>
                    </div>
                    <div class="form-group">
                        <label for="delhivery-chargeable-weight">${escapeHtml(T.weight)}</label>
                        <input id="delhivery-chargeable-weight" name="chargeable_weight_g" type="number" min="1" max="200000" step="1" value="1000" required>
                    </div>
                    <div class="form-group">
                        <label for="delhivery-billing-mode">${escapeHtml(T.billing)}</label>
                        <select id="delhivery-billing-mode" name="billing_mode">
                            <option value="E">${escapeHtml(T.express)}</option>
                            <option value="S">${escapeHtml(T.surface)}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="delhivery-payment-mode">${escapeHtml(T.payment)}</label>
                        <select id="delhivery-payment-mode" name="payment_mode">
                            <option value="Pre-paid">${escapeHtml(T.prepaid)}</option>
                            <option value="COD">${escapeHtml(T.cod)}</option>
                        </select>
                    </div>
                </div>
                <p class="delhivery-estimator-help">${escapeHtml(T.weightHelp)}</p>
                <button class="btn btn-primary" id="delhivery-estimator-submit" type="submit">${escapeHtml(T.button)}</button>
                <div id="delhivery-estimator-result" class="delhivery-estimator-result" role="status" aria-live="polite" hidden></div>
            </form>`;
        productRoot.appendChild(panel);

        const form = panel.querySelector("#delhivery-estimator-form");
        const button = panel.querySelector("#delhivery-estimator-submit");
        const result = panel.querySelector("#delhivery-estimator-result");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const pin = String(form.elements.destination_pin.value || "").trim();
            const grams = Number(form.elements.chargeable_weight_g.value);
            if (!/^\d{6}$/.test(pin)) {
                result.hidden = false;
                result.textContent = T.badPin;
                form.elements.destination_pin.focus();
                return;
            }
            if (!Number.isInteger(grams) || grams < 1 || grams > 200000) {
                result.hidden = false;
                result.textContent = T.badWeight;
                form.elements.chargeable_weight_g.focus();
                return;
            }

            button.disabled = true;
            button.textContent = T.checking;
            result.hidden = false;
            result.textContent = T.checking;
            try {
                if (!window.supabaseClient?.functions?.invoke) {
                    throw new Error("client_unavailable");
                }
                const { data, error } = await window.supabaseClient.functions.invoke("delhivery-estimate", {
                    body: {
                        destination_pin: pin,
                        chargeable_weight_g: grams,
                        billing_mode: form.elements.billing_mode.value,
                        payment_mode: form.elements.payment_mode.value
                    }
                });
                if (error || !data?.ok) {
                    if (data?.code === "delhivery_b2c_token_not_configured" || data?.code === "rate_limit_unavailable") {
                        result.textContent = T.config;
                    } else {
                        result.textContent = data?.message || T.failed;
                    }
                    return;
                }
                if (!data.serviceability?.serviceable) {
                    result.textContent = data.serviceability?.message || T.unavailable;
                    return;
                }

                const price = data.shipping?.available
                    ? `<div class="delhivery-estimator-metric"><span>${escapeHtml(T.price)}</span><strong>${escapeHtml(currency(data.shipping.amount))}</strong></div>`
                    : `<p>${escapeHtml(T.priceMissing)}</p>`;
                let delivery = `<p>${escapeHtml(T.timeMissing)}</p>`;
                if (data.delivery?.available) {
                    const days = Number(data.delivery.tat_days);
                    const date = String(data.delivery.estimated_date || "").trim();
                    const description = date
                        ? `${escapeHtml(date)} (${Number.isFinite(days) ? days : "—"} ${escapeHtml(T.days)})`
                        : `${Number.isFinite(days) ? days : "—"} ${escapeHtml(T.days)}`;
                    delivery = `<div class="delhivery-estimator-metric"><span>${escapeHtml(T.time)}</span><strong>${description}</strong></div>`;
                }
                result.innerHTML = `<p class="delhivery-estimator-success">${escapeHtml(T.serviceable)}</p>${price}${delivery}<p class="delhivery-estimator-disclaimer">${escapeHtml(T.approximate)}</p>`;
            } catch (error) {
                if (window.SouviksErrors?.log) window.SouviksErrors.log("Delhivery delivery estimate failed", error, "warn");
                result.textContent = T.failed;
            } finally {
                button.disabled = false;
                button.textContent = T.button;
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
