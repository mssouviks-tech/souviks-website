(() => {
    "use strict";

    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const COPY = {
        en: {
            title: "Check estimated delivery time",
            intro: "Enter your delivery PIN code to see whether Delhivery serves your area and the estimated transit time.",
            pin: "Delivery PIN code", placeholder: "Enter 6-digit PIN code",
            checking: "Checking delivery availability and time…",
            serviceable: "Delhivery delivery is available for this PIN code.",
            unavailable: "Delhivery delivery is not currently available for this PIN code.",
            time: "Estimated delivery time", days: "business days",
            timeMissing: "Delhivery could not provide an estimated delivery time for this PIN code.",
            config: "The live delivery-time lookup is not fully configured. Please contact Souviks for help.",
            failed: "We could not check delivery time. Please try again shortly.",
            approximate: "This is an estimate only. Actual delivery time can vary by route and network conditions."
        },
        hi: {
            title: "अनुमानित डिलीवरी समय जाँचें",
            intro: "डिलीवरी पिन कोड दर्ज करें और देखें कि Delhivery आपके क्षेत्र में सेवा देता है या नहीं तथा अनुमानित समय क्या है।",
            pin: "डिलीवरी पिन कोड", placeholder: "6 अंकों का पिन कोड दर्ज करें",
            checking: "डिलीवरी उपलब्धता और समय जाँचा जा रहा है…",
            serviceable: "इस पिन कोड पर Delhivery डिलीवरी उपलब्ध है।",
            unavailable: "इस पिन कोड पर फिलहाल Delhivery डिलीवरी उपलब्ध नहीं है।",
            time: "अनुमानित डिलीवरी समय", days: "कार्य दिवस",
            timeMissing: "Delhivery इस पिन कोड के लिए अनुमानित डिलीवरी समय नहीं दे सका।",
            config: "लाइव डिलीवरी-समय जाँच पूरी तरह कॉन्फ़िगर नहीं है। कृपया Souviks से संपर्क करें।",
            failed: "डिलीवरी समय जाँचा नहीं जा सका। कुछ देर बाद फिर कोशिश करें।",
            approximate: "यह केवल अनुमान है। वास्तविक डिलीवरी समय मार्ग और नेटवर्क की स्थिति के अनुसार बदल सकता है।"
        },
        bn: {
            title: "আনুমানিক ডেলিভারির সময় যাচাই করুন",
            intro: "আপনার ডেলিভারি পিন কোড দিন। Delhivery আপনার এলাকায় পরিষেবা দেয় কি না এবং আনুমানিক সময় দেখুন।",
            pin: "ডেলিভারি পিন কোড", placeholder: "৬ অঙ্কের পিন কোড দিন",
            checking: "ডেলিভারি উপলভ্যতা ও সময় যাচাই হচ্ছে…",
            serviceable: "এই পিন কোডে Delhivery ডেলিভারি উপলভ্য।",
            unavailable: "এই পিন কোডে বর্তমানে Delhivery ডেলিভারি উপলভ্য নয়।",
            time: "আনুমানিক ডেলিভারির সময়", days: "কর্মদিবস",
            timeMissing: "এই পিন কোডের জন্য Delhivery আনুমানিক ডেলিভারির সময় দিতে পারেনি।",
            config: "লাইভ ডেলিভারি-সময় যাচাই পুরোপুরি কনফিগার করা হয়নি। Souviks-এ যোগাযোগ করুন।",
            failed: "ডেলিভারির সময় যাচাই করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
            approximate: "এটি কেবল আনুমানিক হিসাব। রুট ও নেটওয়ার্কের অবস্থার কারণে প্রকৃত সময় বদলাতে পারে।"
        }
    };
    const T = COPY[LANGUAGE] || COPY.en;

    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function init() {
        const root = document.getElementById("product-detail");
        if (!root || document.getElementById("delhivery-estimator")) return;

        const panel = document.createElement("section");
        panel.id = "delhivery-estimator";
        panel.className = "delhivery-estimator pdp-section";
        panel.setAttribute("aria-labelledby", "delhivery-estimator-title");
        panel.innerHTML =
            '<h2 id="delhivery-estimator-title">' + escapeHtml(T.title) + '</h2>' +
            '<p class="delhivery-estimator-intro">' + escapeHtml(T.intro) + '</p>' +
            '<div class="form-group delhivery-estimator-pin-group">' +
              '<label for="delhivery-destination-pin">' + escapeHtml(T.pin) + '</label>' +
              '<input id="delhivery-destination-pin" name="destination_pin" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="' + escapeHtml(T.placeholder) + '" required>' +
            '</div>' +
            '<div id="delhivery-estimator-result" class="delhivery-estimator-result" role="status" aria-live="polite" hidden></div>';

        (root.querySelector(".container") || root).appendChild(panel);
        const pinInput = panel.querySelector("#delhivery-destination-pin");
        const result = panel.querySelector("#delhivery-estimator-result");
        let debounceTimer = null;
        let requestSequence = 0;
        let lastSuccessfulPin = "";

        function setMessage(message) {
            result.hidden = !message;
            result.textContent = message || "";
        }

        async function lookup(pin) {
            const sequence = ++requestSequence;
            if (pin === lastSuccessfulPin) return;
            setMessage(T.checking);
            try {
                if (typeof supabaseClient === "undefined" || !supabaseClient?.functions?.invoke) {
                    setMessage(T.config);
                    return;
                }
                const response = await supabaseClient.functions.invoke("delhivery-estimate", {
                    body: { estimate_type: "delivery_time", destination_pin: pin }
                });
                if (sequence !== requestSequence) return;
                let data = response.data;
                if (response.error || !data?.ok) {
                    try {
                        if (response.error?.context && typeof response.error.context.json === "function") {
                            data = await response.error.context.json();
                        }
                    } catch {
                        // Use a safe fallback message.
                    }
                    if (["delhivery_b2c_token_not_configured", "rate_limit_unavailable", "delhivery_b2b_token_not_configured"].includes(data?.code)) {
                        setMessage(T.config);
                    } else {
                        setMessage(data?.message || T.failed);
                    }
                    return;
                }
                if (!data.serviceability?.serviceable) {
                    setMessage(data.serviceability?.message || T.unavailable);
                    return;
                }
                if (!data.delivery?.available) {
                    setMessage(T.serviceable + " " + T.timeMissing);
                    lastSuccessfulPin = pin;
                    return;
                }
                const days = data.delivery.tat_days == null ? NaN : Number(data.delivery.tat_days);
                const date = String(data.delivery.estimated_date || "").trim();
                const dayText = Number.isFinite(days) ? String(days) + " " + T.days : "";
                const description = date ? date + (dayText ? " (" + dayText + ")" : "") : dayText;
                result.innerHTML =
                    '<p class="delhivery-estimator-success">' + escapeHtml(T.serviceable) + '</p>' +
                    '<div class="delhivery-estimator-metric"><span>' + escapeHtml(T.time) + '</span><strong>' + escapeHtml(description || T.timeMissing) + '</strong></div>' +
                    '<p class="delhivery-estimator-disclaimer">' + escapeHtml(T.approximate) + '</p>';
                lastSuccessfulPin = pin;
            } catch (error) {
                if (window.SouviksErrors?.log) window.SouviksErrors.log("Delhivery delivery-time lookup failed", error, "warn");
                if (sequence === requestSequence) setMessage(T.failed);
            }
        }

        pinInput.addEventListener("input", () => {
            const pin = String(pinInput.value || "").replace(/\D/g, "").slice(0, 6);
            if (pinInput.value !== pin) pinInput.value = pin;
            clearTimeout(debounceTimer);
            requestSequence += 1;
            lastSuccessfulPin = "";
            if (pin.length !== 6) {
                setMessage("");
                return;
            }
            debounceTimer = setTimeout(() => { void lookup(pin); }, 400);
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
