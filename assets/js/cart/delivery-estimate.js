(() => {
    "use strict";
    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const CART_KEY = "souviks_purchase_cart_v1";
    const ESTIMATE_KEY = "souviks_delivery_estimate_v2";
    const ESTIMATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const DATE_LOCALES = { en: "en-IN", hi: "hi-IN", bn: "bn-IN" };
    const COPY = {
        en: {
            helper: "Enter your PIN code to see the estimated delivery date and calculate delivery charges.",
            checking: "Checking delivery details and calculating estimated charges…",
            serviceable: "Souviks delivery is available for PIN code ",
            unavailable: "We could not confirm delivery to PIN code ",
            time: "Estimated delivery date",
            timeMissing: "An estimated delivery date is not available for this PIN code. Please contact Souviks.",
            price: "Estimated delivery charges",
            weightMissing: "We cannot calculate a delivery charge because shipping weights are missing for one or more items. Please contact Souviks for a shipping quote.",
            weightInvalid: "The cart's combined estimated weight is outside the supported range. Please contact Souviks for a shipping quote.",
            priceMissing: "We could not calculate delivery charges for this PIN code. Please try again or contact Souviks.",
            config: "We cannot calculate a delivery estimate right now. Please try again shortly or contact Souviks.",
            failed: "We could not confirm delivery details right now. Please try again shortly or contact Souviks.",
            approximate: "Delivery charges are an estimate. The applicable amount is rechecked before payment.",
            estimated: "estimated",
            pickupShipping: "No courier charge"
        },
        hi: {
            helper: "अनुमानित डिलीवरी तारीख देखने और डिलीवरी शुल्क की गणना के लिए पिन कोड दर्ज करें।",
            checking: "डिलीवरी विवरण जाँचे जा रहे हैं और अनुमानित शुल्क निकाला जा रहा है…",
            serviceable: "Souviks इस पिन कोड पर डिलीवरी कर सकता है: ",
            unavailable: "हम इस पिन कोड पर डिलीवरी की पुष्टि नहीं कर सके: ",
            time: "अनुमानित डिलीवरी तारीख",
            timeMissing: "इस पिन कोड की अनुमानित डिलीवरी तारीख उपलब्ध नहीं है। कृपया Souviks से संपर्क करें।",
            price: "अनुमानित डिलीवरी शुल्क",
            weightMissing: "एक या अधिक उत्पादों का शिपिंग वज़न उपलब्ध नहीं है, इसलिए शुल्क की गणना नहीं हो सकी। कृपया शिपिंग कोट के लिए Souviks से संपर्क करें।",
            weightInvalid: "कार्ट का कुल अनुमानित वज़न समर्थित सीमा से बाहर है। कृपया शिपिंग कोट के लिए Souviks से संपर्क करें।",
            priceMissing: "इस पिन कोड के लिए डिलीवरी शुल्क की गणना नहीं हो सकी। कृपया फिर प्रयास करें या Souviks से संपर्क करें।",
            config: "अभी डिलीवरी का अनुमान नहीं निकाला जा सकता। कृपया थोड़ी देर बाद फिर प्रयास करें या Souviks से संपर्क करें।",
            failed: "अभी डिलीवरी विवरण की पुष्टि नहीं हो सकी। कृपया थोड़ी देर बाद फिर प्रयास करें या Souviks से संपर्क करें।",
            approximate: "डिलीवरी शुल्क अनुमानित है। भुगतान से पहले लागू राशि की दोबारा जाँच की जाएगी।",
            estimated: "अनुमानित",
            pickupShipping: "कोई कूरियर शुल्क नहीं"
        },
        bn: {
            helper: "আনুমানিক ডেলিভারির তারিখ দেখতে এবং ডেলিভারি চার্জ হিসাব করতে পিন কোড দিন।",
            checking: "ডেলিভারির তথ্য যাচাই ও আনুমানিক চার্জ হিসাব হচ্ছে…",
            serviceable: "Souviks এই পিন কোডে ডেলিভারি করতে পারে: ",
            unavailable: "এই পিন কোডে ডেলিভারি নিশ্চিত করা যায়নি: ",
            time: "আনুমানিক ডেলিভারির তারিখ",
            timeMissing: "এই পিন কোডের আনুমানিক ডেলিভারির তারিখ উপলভ্য নয়। Souviks-এর সঙ্গে যোগাযোগ করুন।",
            price: "আনুমানিক ডেলিভারি চার্জ",
            weightMissing: "এক বা একাধিক পণ্যের শিপিং ওজন নেই, তাই চার্জ হিসাব করা যায়নি। শিপিং কোটের জন্য Souviks-এর সঙ্গে যোগাযোগ করুন।",
            weightInvalid: "কার্টের মোট আনুমানিক ওজন নির্ধারিত সীমার বাইরে। শিপিং কোটের জন্য Souviks-এর সঙ্গে যোগাযোগ করুন।",
            priceMissing: "এই পিন কোডের ডেলিভারি চার্জ হিসাব করা যায়নি। আবার চেষ্টা করুন বা Souviks-এর সঙ্গে যোগাযোগ করুন।",
            config: "এই মুহূর্তে ডেলিভারির অনুমান হিসাব করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন বা Souviks-এর সঙ্গে যোগাযোগ করুন।",
            failed: "এই মুহূর্তে ডেলিভারির তথ্য নিশ্চিত করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন বা Souviks-এর সঙ্গে যোগাযোগ করুন।",
            approximate: "ডেলিভারি চার্জ আনুমানিক। পেমেন্টের আগে প্রযোজ্য চার্জ আবার যাচাই করা হবে।",
            estimated: "আনুমানিক",
            pickupShipping: "কুরিয়ার চার্জ নেই"
        }
    };
    const T = COPY[LANGUAGE] || COPY.en;

    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function currency(value) {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
            .format(Number(value) || 0);
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

    function nextWorkingDay() {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        do {
            date.setDate(date.getDate() + 1);
        } while (date.getDay() === 0 || date.getDay() === 6);
        return date;
    }

    function addWorkingDaysFrom(startDate, count) {
        const date = new Date(startDate);
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
        const pickupDate = nextWorkingDay();
        const direct = parseDate(delivery.estimated_date || delivery.estimated_delivery_date ||
            delivery.delivery_date || delivery.estimatedDate);
        if (direct) {
            const chosen = direct < pickupDate ? pickupDate : direct;
            return { estimatedDate: dateOnly(chosen), pickupDate: dateOnly(pickupDate), source: direct < pickupDate ? "pickup_date_floor" : "carrier_date" };
        }

        const tatDays = Number(delivery.tat_days ?? delivery.tat ?? delivery.expected_tat ??
            delivery.estimated_days ?? delivery.days);
        if (Number.isFinite(tatDays) && tatDays >= 0 && tatDays <= 90) {
            const date = new Date(pickupDate);
            date.setDate(date.getDate() + Math.max(0, Math.ceil(tatDays) - 1));
            return { estimatedDate: dateOnly(date), pickupDate: dateOnly(pickupDate), source: "carrier_tat" };
        }
        return { estimatedDate: dateOnly(addWorkingDaysFrom(pickupDate, 10)), pickupDate: dateOnly(pickupDate), source: "standard_window" };
    }

    function formatDate(value) {
        const date = parseDate(value);
        if (!date) return "";
        return new Intl.DateTimeFormat(DATE_LOCALES[LANGUAGE] || "en-IN", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        }).format(date);
    }

    function readSavedEstimate() {
        try {
            const item = JSON.parse(localStorage.getItem(ESTIMATE_KEY) || "null");
            if (item && /^\d{6}$/.test(String(item.destinationPin || "")) &&
                item.serviceable === true && parseDate(item.estimatedDate) && item.checkedAt) return item;
        } catch {
            // Storage is optional; continue with a fresh delivery lookup.
        }
        return null;
    }

    function savedEstimateForPin(pin) {
        const item = readSavedEstimate();
        const checked = Date.parse(item?.checkedAt || "");
        if (!item || item.destinationPin !== pin || !Number.isFinite(checked)) return null;
        const age = Date.now() - checked;
        return age >= 0 && age <= ESTIMATE_MAX_AGE_MS ? item : null;
    }

    function saveEstimate(item) {
        try { localStorage.setItem(ESTIMATE_KEY, JSON.stringify(item)); } catch { /* Storage is optional. */ }
    }

    function clearSavedEstimate() {
        try { localStorage.removeItem(ESTIMATE_KEY); } catch { /* Storage is optional. */ }
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
        const pinInput = document.getElementById("checkout-pincode");
        const methodInputs = Array.from(document.querySelectorAll('input[name="fulfillment_method"]'));
        if (!pinInput || !methodInputs.length || document.getElementById("delhivery-cart-estimate-result")) return;

        const savedAtLoad = readSavedEstimate();
        if (!pinInput.value && savedAtLoad) pinInput.value = savedAtLoad.destinationPin;

        const result = document.createElement("div");
        result.id = "delhivery-cart-estimate-result";
        result.className = "delhivery-estimator-result delhivery-cart-estimate-result";
        result.setAttribute("role", "status");
        result.setAttribute("aria-live", "polite");
        result.hidden = true;
        const pinGroup = pinInput.closest(".form-group") || pinInput.parentElement;
        pinGroup?.appendChild(result);

        const helper = document.createElement("p");
        helper.className = "delhivery-estimator-help delhivery-cart-estimate-help";
        helper.textContent = T.helper;
        helper.hidden = document.querySelector('input[name="fulfillment_method"]:checked')?.value !== "delivery";
        pinGroup?.appendChild(helper);

        const shippingNode = document.getElementById("purchase-cart-shipping");
        const subtotalNode = document.getElementById("purchase-cart-subtotal");
        const totalNode = document.getElementById("purchase-cart-total");
        const initialShipping = shippingNode?.textContent || "";
        const initialTotal = totalNode?.textContent || "";

        function subtotalValue() {
            if (!subtotalNode) return null;
            const amount = Number(String(subtotalNode.textContent || "").replace(/,/g, "").replace(/[^\d.]/g, ""));
            return Number.isFinite(amount) ? amount : null;
        }

        function setShippingSummary(amount) {
            if (shippingNode) shippingNode.textContent = currency(amount) + " (" + T.estimated + ")";
            const subtotal = subtotalValue();
            if (totalNode && subtotal !== null) totalNode.textContent = currency(subtotal + amount) + " (" + T.estimated + ")";
        }

        function setPickupSummary() {
            if (shippingNode) shippingNode.textContent = T.pickupShipping;
            const subtotal = subtotalValue();
            if (totalNode && subtotal !== null) totalNode.textContent = currency(subtotal);
        }

        function resetSummary() {
            if (isDeliverySelected()) {
                if (shippingNode) shippingNode.textContent = initialShipping;
                if (totalNode) totalNode.textContent = initialTotal;
            } else {
                setPickupSummary();
            }
        }

        let timer = null;
        let sequence = 0;

        function setMessage(message) {
            result.hidden = !message;
            result.textContent = message || "";
        }

        function isDeliverySelected() {
            return document.querySelector('input[name="fulfillment_method"]:checked')?.value === "delivery";
        }

        function readCart() {
            try {
                const items = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
                return Array.isArray(items) ? items.filter(item => item && typeof item.productId === "string" &&
                    Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0) : [];
            } catch {
                return [];
            }
        }

        async function getTotalWeight() {
            const cart = readCart();
            if (!cart.length) return { error: T.weightMissing };
            const response = await fetch("/assets/data/catalogue-index.json", {
                headers: { Accept: "application/json" }, cache: "no-store", credentials: "same-origin"
            });
            if (!response.ok) throw new Error("catalogue_unavailable");
            const catalogue = await response.json();
            if (!Array.isArray(catalogue)) throw new Error("catalogue_unavailable");
            const byId = new Map(catalogue.filter(item => item && typeof item.id === "string").map(item => [item.id, item]));
            let total = 0;
            for (const line of cart) {
                const product = byId.get(String(line.productId));
                const rawWeight = product?.approx_weight_g ?? product?.approx_weight_grams ??
                    product?.weight_g ?? product?.shipping_weight_g;
                const weight = Number(rawWeight);
                const quantity = Number(line.quantity);
                if (rawWeight == null || rawWeight === "" || !Number.isFinite(weight) || weight <= 0 ||
                    !Number.isInteger(quantity) || quantity < 1) return { error: T.weightMissing };
                total += Math.round(weight) * quantity;
            }
            if (!Number.isInteger(total) || total < 1 || total > 200000) return { error: T.weightInvalid };
            return { grams: total };
        }

        async function lookup(pin) {
            if (!isDeliverySelected()) return;
            const current = ++sequence;
            setMessage(T.checking);
            resetSummary();

            try {
                if (typeof supabaseClient === "undefined" || !supabaseClient?.functions?.invoke) {
                    setMessage(T.config);
                    return;
                }

                let saved = savedEstimateForPin(pin);
                let estimatedDate = saved?.estimatedDate || "";
                if (!saved) {
                    const deliveryResponse = await supabaseClient.functions.invoke("delhivery-estimate", {
                        body: { estimate_type:"delivery_time", destination_pin: pin }
                    });
                    let deliveryData = await unpackResponse(deliveryResponse);
                    if (current !== sequence) return;
                    if (deliveryResponse.error || !deliveryData?.ok) {
                        clearSavedEstimate();
                        const code = deliveryData?.code;
                        setMessage(["delhivery_b2c_token_not_configured", "delhivery_b2b_token_not_configured",
                            "origin_pin_not_configured", "rate_limit_unavailable"].includes(code) ? T.config : T.failed);
                        return;
                    }
                    if (!deliveryData.serviceability?.serviceable) {
                        clearSavedEstimate();
                        setMessage(T.unavailable + pin + ". Please contact Souviks if you need help confirming an alternative.");
                        return;
                    }

                    const estimate = resolveDeliveryDate(deliveryData);
                    estimatedDate = estimate.estimatedDate;
                    saved = {
                        destinationPin: pin,
                        estimatedDate: estimatedDate,
                        dateSource: estimate.source,
                        serviceable: true,
                        checkedAt: new Date().toISOString()
                    };
                    saveEstimate(saved);
                }

                const resultHtml =
                    '<p class="delhivery-estimator-success">' + escapeHtml(T.serviceable + pin + ".") + '</p>' +
                    '<div class="delhivery-estimator-metric"><span>' + escapeHtml(T.time) + '</span><strong>' +
                    escapeHtml(formatDate(estimatedDate) || T.timeMissing) + '</strong></div>';

                const weight = await getTotalWeight();
                if (current !== sequence) return;
                if (weight.error) {
                    result.innerHTML = resultHtml + '<p class="delhivery-estimator-help">' + escapeHtml(weight.error) + '</p>';
                    result.hidden = false;
                    resetSummary();
                    return;
                }

                const response = await supabaseClient.functions.invoke("delhivery-estimate", {
                    body: { estimate_type:"shipping_charge", destination_pin: pin, chargeable_weight_g: weight.grams }
                });
                const data = await unpackResponse(response);
                if (current !== sequence) return;
                if (response.error || !data?.ok) {
                    const code = data?.code;
                    const message = ["delhivery_b2c_token_not_configured", "rate_limit_unavailable",
                        "origin_pin_not_configured"].includes(code) ? T.config : T.failed;
                    result.innerHTML = resultHtml + '<p class="delhivery-estimator-help">' + escapeHtml(message) + '</p>';
                    result.hidden = false;
                    resetSummary();
                    return;
                }
                if (!data.serviceability?.serviceable) {
                    clearSavedEstimate();
                    result.innerHTML = '<p class="delhivery-estimator-help">' +
                        escapeHtml(T.unavailable + pin + ". Please contact Souviks if you need help confirming an alternative.") + '</p>';
                    result.hidden = false;
                    resetSummary();
                    return;
                }
                if (!data.shipping?.available || !Number.isFinite(Number(data.shipping.amount)) || Number(data.shipping.amount) <= 0) {
                    result.innerHTML = resultHtml + '<p class="delhivery-estimator-help">' + escapeHtml(T.priceMissing) + '</p>';
                    result.hidden = false;
                    resetSummary();
                    return;
                }

                const amount = Number(data.shipping.amount);
                setShippingSummary(amount);
                result.innerHTML = resultHtml +
                    '<div class="delhivery-estimator-metric"><span>' + escapeHtml(T.price) + '</span><strong>' +
                    escapeHtml(currency(amount)) + '</strong></div>' +
                    '<p class="delhivery-estimator-disclaimer">' + escapeHtml(T.approximate) + '</p>';
                result.hidden = false;
            } catch (error) {
                if (window.SouviksErrors?.log) window.SouviksErrors.log("Checkout delivery estimate failed", error, "warn");
                if (current === sequence) {
                    setMessage(T.failed);
                    resetSummary();
                }
            }
        }

        function schedule(value) {
            if (!isDeliverySelected()) {
                clearTimeout(timer);
                sequence += 1;
                setMessage("");
                resetSummary();
                return;
            }
            const pin = String(value || "").replace(/\D/g, "").slice(0, 6);
            clearTimeout(timer);
            sequence += 1;
            if (pinInput.value !== pin) pinInput.value = pin;
            const saved = readSavedEstimate();
            if (saved && saved.destinationPin !== pin) clearSavedEstimate();
            if (pin.length !== 6) {
                setMessage("");
                resetSummary();
                return;
            }
            timer = setTimeout(() => { void lookup(pin); }, 250);
        }

        pinInput.addEventListener("input", () => schedule(pinInput.value));
        pinInput.addEventListener("change", () => schedule(pinInput.value));
        methodInputs.forEach(input => input.addEventListener("change", () => {
            const deliverySelected = isDeliverySelected();
            helper.hidden = !deliverySelected;
            if (!deliverySelected) {
                clearTimeout(timer);
                sequence += 1;
                setMessage("");
                setPickupSummary();
                return;
            }
            resetSummary();
            if (/^\d{6}$/.test(pinInput.value)) schedule(pinInput.value);
        }));
        window.addEventListener("souviks:purchase-cart-changed", () => {
            const pin = String(pinInput.value || "").trim();
            if (/^\d{6}$/.test(pin)) schedule(pin);
        });

        if (isDeliverySelected()) {
            helper.hidden = false;
            if (/^\d{6}$/.test(pinInput.value)) schedule(pinInput.value);
        } else if (document.querySelector('input[name="fulfillment_method"]:checked')?.value === "pickup") {
            setPickupSummary();
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();