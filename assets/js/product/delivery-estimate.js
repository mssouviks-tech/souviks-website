(() => {
    "use strict";
    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const COPY = {
        en: {
            title:"Check delivery time & COD shipping charges",
            intro:"Enter your 6-digit delivery PIN code. The estimate will calculate automatically.",
            pin:"Delivery PIN code", placeholder:"6-digit PIN code",
            helper:"Uses the approximate item weight recorded by Souviks and assumes Cash on Delivery (COD).",
            checking:"Calculating delivery time and COD charges…",
            serviceable:"Delhivery delivery is available for this PIN code.",
            unavailable:"Delhivery COD delivery is not available for this PIN code.",
            price:"Estimated COD courier charge", time:"Estimated delivery time", days:"business days",
            priceMissing:"Delhivery did not return a usable COD charge for this route.",
            timeMissing:"Delivery-time estimate is unavailable for this route.",
            weightMissing:"A weight has not been recorded for this product yet, so shipping cannot be estimated.",
            weightInvalid:"The recorded item weight is invalid. Please contact Souviks for a quote.",
            approximate:"Approximate estimate only. Final courier charges and delivery time may differ.",
            config:"The live delivery estimator is not fully configured. Please contact Souviks for a quote.",
            failed:"We could not retrieve an estimate. Please try again shortly."
        },
        hi: {
            title:"डिलीवरी समय और COD शिपिंग शुल्क जाँचें",
            intro:"अपना 6 अंकों का डिलीवरी पिन कोड दर्ज करें। अनुमान अपने-आप निकलेगा।",
            pin:"डिलीवरी पिन कोड", placeholder:"6 अंकों का पिन कोड",
            helper:"Souviks में दर्ज उत्पाद के लगभग वज़न के आधार पर और Cash on Delivery (COD) के लिए गणना होगी।",
            checking:"डिलीवरी समय और COD शुल्क की गणना हो रही है…",
            serviceable:"इस पिन कोड पर Delhivery डिलीवरी उपलब्ध है।",
            unavailable:"इस पिन कोड पर Delhivery COD डिलीवरी उपलब्ध नहीं है।",
            price:"अनुमानित COD कूरियर शुल्क", time:"अनुमानित डिलीवरी समय", days:"कार्य दिवस",
            priceMissing:"Delhivery ने इस मार्ग के लिए मान्य COD शुल्क नहीं दिया।",
            timeMissing:"इस मार्ग के लिए डिलीवरी समय का अनुमान उपलब्ध नहीं है।",
            weightMissing:"इस उत्पाद का वज़न अभी दर्ज नहीं है, इसलिए शिपिंग अनुमान नहीं निकाला जा सकता।",
            weightInvalid:"दर्ज वज़न सही नहीं है। कोट के लिए Souviks से संपर्क करें।",
            approximate:"यह केवल अनुमान है। अंतिम कूरियर शुल्क और डिलीवरी समय अलग हो सकते हैं।",
            config:"लाइव अनुमान पूरी तरह कॉन्फ़िगर नहीं है। कोट के लिए Souviks से संपर्क करें।",
            failed:"अनुमान प्राप्त नहीं हुआ। कुछ देर बाद फिर कोशिश करें।"
        },
        bn: {
            title:"ডেলিভারির সময় ও COD শিপিং চার্জ যাচাই করুন",
            intro:"আপনার ৬ অঙ্কের ডেলিভারি পিন কোড দিন। হিসাব স্বয়ংক্রিয়ভাবে হবে।",
            pin:"ডেলিভারি পিন কোড", placeholder:"৬ অঙ্কের পিন কোড",
            helper:"Souviks-এ নথিভুক্ত পণ্যের আনুমানিক ওজন ধরে Cash on Delivery (COD) হিসাব করা হবে।",
            checking:"ডেলিভারির সময় ও COD চার্জ গণনা হচ্ছে…",
            serviceable:"এই পিন কোডে Delhivery ডেলিভারি উপলব্ধ।",
            unavailable:"এই পিন কোডে Delhivery COD ডেলিভারি উপলব্ধ নয়।",
            price:"আনুমানিক COD কুরিয়ার চার্জ", time:"আনুমানিক ডেলিভারির সময়", days:"কর্মদিবস",
            priceMissing:"এই রুটের জন্য Delhivery ব্যবহারযোগ্য COD চার্জ দেয়নি।",
            timeMissing:"এই রুটের জন্য ডেলিভারির সময়ের হিসাব উপলব্ধ নয়।",
            weightMissing:"এই পণ্যের ওজন নথিভুক্ত নেই, তাই শিপিং হিসাব করা যাচ্ছে না।",
            weightInvalid:"নথিভুক্ত ওজন সঠিক নয়। কোটের জন্য Souviks-এ যোগাযোগ করুন।",
            approximate:"এটি কেবল আনুমানিক হিসাব। চূড়ান্ত কুরিয়ার চার্জ ও সময় আলাদা হতে পারে।",
            config:"লাইভ হিসাব পুরোপুরি কনফিগার করা হয়নি। কোটের জন্য Souviks-এ যোগাযোগ করুন।",
            failed:"হিসাব পাওয়া যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
        }
    };
    const T = COPY[LANGUAGE] || COPY.en;
    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function currency(value) {
        return new Intl.NumberFormat("en-IN", {style:"currency", currency:"INR", maximumFractionDigits:2}).format(Number(value) || 0);
    }
    function init() {
        const root = document.getElementById("product-detail");
        if (!root || document.getElementById("delhivery-estimator")) return;
        const product = window.SOUVIKS_PRODUCT_PAGE_DATA || {};
        const baseWeight = Number(product.approx_weight_g ?? product.approx_weight_grams ?? product.weight_g ?? product.shipping_weight_g);
        const panel = document.createElement("section");
        panel.id = "delhivery-estimator";
        panel.className = "delhivery-estimator pdp-section";
        panel.setAttribute("aria-labelledby", "delhivery-estimator-title");
        panel.innerHTML =
            '<h2 id="delhivery-estimator-title">' + escapeHtml(T.title) + '</h2>' +
            '<p class="delhivery-estimator-intro">' + escapeHtml(T.intro) + '</p>' +
            '<div class="form-group delhivery-estimator-pin-group">' +
              '<label for="delhivery-destination-pin">' + escapeHtml(T.pin) + '</label>' +
              '<input id="delhivery-destination-pin" name="destination_pin" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="' + escapeHtml(T.placeholder) + '" aria-describedby="delhivery-estimator-help" required>' +
            '</div>' +
            '<p id="delhivery-estimator-help" class="delhivery-estimator-help">' + escapeHtml(T.helper) + '</p>' +
            '<div id="delhivery-estimator-result" class="delhivery-estimator-result" role="status" aria-live="polite" hidden></div>';
        (root.querySelector(".container") || root).appendChild(panel);
        const pinInput = panel.querySelector("#delhivery-destination-pin");
        const result = panel.querySelector("#delhivery-estimator-result");
        let debounceTimer = null, requestSequence = 0, lastSuccessfulSignature = "";
        function setMessage(message) {
            result.hidden = !message;
            result.textContent = message || "";
        }
        async function lookup(pin) {
            const sequence = ++requestSequence;
            const qtyInput = document.getElementById("pdpQty");
            const quantity = Math.max(1, Math.min(9999, Math.floor(Number(qtyInput?.value) || 1)));
            if (!Number.isFinite(baseWeight) || baseWeight <= 0) { setMessage(T.weightMissing); return; }
            const grams = Math.round(baseWeight * quantity);
            if (!Number.isInteger(grams) || grams < 1 || grams > 200000) { setMessage(T.weightInvalid); return; }
            const signature = pin + ":" + grams + ":COD:E";
            if (signature === lastSuccessfulSignature) return;
            setMessage(T.checking);
            try {
                if (typeof supabaseClient === "undefined" || !supabaseClient?.functions?.invoke) { setMessage(T.config); return; }
                const response = await supabaseClient.functions.invoke("delhivery-estimate", {
                    body: {destination_pin:pin, chargeable_weight_g:grams}
                });
                if (sequence !== requestSequence) return;
                let data = response.data;
                if (response.error || !data?.ok) {
                    try {
                        if (response.error?.context && typeof response.error.context.json === "function") data = await response.error.context.json();
                    } catch { /* Use a safe fallback. */ }
                    if (["delhivery_b2c_token_not_configured","rate_limit_unavailable"].includes(data?.code)) setMessage(T.config);
                    else setMessage(data?.message || T.failed);
                    return;
                }
                if (!data.serviceability?.serviceable) { setMessage(T.unavailable); return; }
                const price = data.shipping?.available
                    ? '<div class="delhivery-estimator-metric"><span>' + escapeHtml(T.price) + '</span><strong>' + escapeHtml(currency(data.shipping.amount)) + '</strong></div>'
                    : '<p>' + escapeHtml(T.priceMissing) + '</p>';
                let delivery = '<p>' + escapeHtml(T.timeMissing) + '</p>';
                if (data.delivery?.available) {
                    const days = data.delivery.tat_days == null ? NaN : Number(data.delivery.tat_days);
                    const date = String(data.delivery.estimated_date || "").trim();
                    const dayText = Number.isFinite(days) ? escapeHtml(String(days)) + ' ' + escapeHtml(T.days) : "";
                    const description = date
                        ? escapeHtml(date) + (dayText ? ' (' + dayText + ')' : '')
                        : (dayText || escapeHtml(T.timeMissing));
                    delivery = '<div class="delhivery-estimator-metric"><span>' + escapeHtml(T.time) + '</span><strong>' + description + '</strong></div>';
                }
                result.innerHTML = '<p class="delhivery-estimator-success">' + escapeHtml(T.serviceable) + '</p>' +
                    price + delivery + '<p class="delhivery-estimator-disclaimer">' + escapeHtml(T.approximate) + '</p>';
                lastSuccessfulSignature = signature;
            } catch (error) {
                if (window.SouviksErrors?.log) window.SouviksErrors.log("Delhivery product estimate failed", error, "warn");
                if (sequence === requestSequence) setMessage(T.failed);
            }
        }
        function scheduleLookup(value) {
            const pin = String(value || "").replace(/\D/g, "").slice(0, 6);
            clearTimeout(debounceTimer);
            requestSequence += 1;
            lastSuccessfulSignature = "";
            if (pinInput.value !== pin) pinInput.value = pin;
            if (pin.length !== 6) { setMessage(""); return; }
            debounceTimer = setTimeout(() => { void lookup(pin); }, 450);
        }
        pinInput.addEventListener("input", () => scheduleLookup(pinInput.value));
        document.getElementById("pdpQty")?.addEventListener("change", () => {
            const pin = String(pinInput.value || "").trim();
            if (/^\d{6}$/.test(pin)) scheduleLookup(pin);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
    else init();
})();
