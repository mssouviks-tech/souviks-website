(() => {
    "use strict";
    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const CART_KEY = "souviks_purchase_cart_v1";
    const COPY = {
        en: {
            helper: "Once item weights are available in the catalogue, the combined prepaid courier charge will be estimated automatically from your delivery PIN code. Until then, below-threshold online checkout requires a shipping quote.",
            checking: "Calculating estimated prepaid shipping…",
            serviceable: "Delhivery prepaid delivery is available for this PIN code.",
            unavailable: "Delhivery prepaid service is not available for this PIN code.",
            time: "Estimated delivery",
            timeMissing: "Estimated delivery date not available",
            days: "days",
            price: "Estimated prepaid courier charge",
            weightMissing: "Product weights are not available for every item yet. The Delhivery charge estimate will appear once the stock sheet is updated. Below the free-shipping threshold, checkout needs a shipping quote until then.",
            weightInvalid: "The cart's combined approximate weight is outside the supported range. Please request a shipping quote.",
            priceMissing: "Delhivery did not return a usable prepaid charge for this route.",
            config: "Live Delhivery shipping estimates are not configured. The order review will show the available shipping policy.",
            failed: "We could not retrieve a Delhivery estimate. The final amount will be confirmed at order review.",
            approximate: "Approximate courier charge only. The final shipping amount is recalculated securely when you review your order."
        },
        hi: {
            helper: "कैटलॉग में सभी उत्पादों का वज़न उपलब्ध होने पर, डिलीवरी पिन कोड के आधार पर कुल प्रीपेड कूरियर शुल्क अपने-आप निकलेगा। अंतिम शिपिंग राशि ऑर्डर रिव्यू में पक्की होगी।",
            checking: "अनुमानित प्रीपेड शिपिंग की गणना हो रही है…",
            serviceable: "इस पिन कोड पर Delhivery प्रीपेड डिलीवरी उपलब्ध है।",
            unavailable: "इस पिन कोड पर Delhivery प्रीपेड सेवा उपलब्ध नहीं है।",
            time: "अनुमानित डिलीवरी",
            timeMissing: "अनुमानित डिलीवरी तारीख उपलब्ध नहीं है",
            days: "दिन",
            price: "अनुमानित प्रीपेड कूरियर शुल्क",
            weightMissing: "अभी सभी उत्पादों के वज़न उपलब्ध नहीं हैं। स्टॉक शीट अपडेट होने के बाद Delhivery शुल्क का अनुमान दिखेगा। तब तक फ्री-शिपिंग सीमा से कम वाले ऑर्डर के लिए शिपिंग कोट आवश्यक है।",
            weightInvalid: "कार्ट का कुल अनुमानित वज़न समर्थित सीमा से बाहर है। शिपिंग कोट माँगें।",
            priceMissing: "Delhivery ने इस मार्ग के लिए मान्य प्रीपेड शुल्क नहीं दिया।",
            config: "लाइव Delhivery शिपिंग अनुमान कॉन्फ़िगर नहीं है। उपलब्ध शिपिंग नीति ऑर्डर रिव्यू में दिखाई जाएगी।",
            failed: "Delhivery अनुमान प्राप्त नहीं हुआ। अंतिम राशि ऑर्डर रिव्यू में पक्की होगी।",
            approximate: "यह केवल अनुमानित कूरियर शुल्क है। ऑर्डर रिव्यू में अंतिम शिपिंग राशि सुरक्षित रूप से दोबारा निकाली जाएगी।"
        },
        bn: {
            helper: "ক্যাটালগে সব পণ্যের ওজন উপলভ্য হলে, আপনার ডেলিভারি পিন কোড থেকে মোট প্রিপেইড কুরিয়ার চার্জ স্বয়ংক্রিয়ভাবে হিসাব হবে। ততদিন কম-সাবটোটালের অনলাইন অর্ডারের জন্য শিপিং কোট প্রয়োজন।",
            checking: "আনুমানিক প্রিপেইড শিপিং হিসাব হচ্ছে…",
            serviceable: "এই পিন কোডে Delhivery প্রিপেইড ডেলিভারি উপলভ্য।",
            unavailable: "এই পিন কোডে Delhivery প্রিপেইড পরিষেবা উপলভ্য নয়।",
            time: "আনুমানিক ডেলিভারি",
            timeMissing: "আনুমানিক ডেলিভারির তারিখ উপলভ্য নয়",
            days: "দিন",
            price: "আনুমানিক প্রিপেইড কুরিয়ার চার্জ",
            weightMissing: "এখনও সব পণ্যের ওজন উপলভ্য নয়। স্টক শিট আপডেট হলে Delhivery চার্জের হিসাব দেখানো হবে। ততদিন ফ্রি-শিপিং সীমার নিচের অর্ডারের জন্য শিপিং কোট প্রয়োজন।",
            weightInvalid: "কার্টের মোট আনুমানিক ওজন সমর্থিত সীমার বাইরে। শিপিং কোট চাইুন।",
            priceMissing: "এই রুটের জন্য Delhivery ব্যবহারযোগ্য প্রিপেইড চার্জ দেয়নি।",
            config: "লাইভ Delhivery শিপিং হিসাব কনফিগার করা হয়নি। অর্ডার রিভিউতে উপলভ্য শিপিং নীতি দেখানো হবে।",
            failed: "Delhivery হিসাব পাওয়া যায়নি। অর্ডার রিভিউতে চূড়ান্ত চার্জ নিশ্চিত হবে।",
            approximate: "এটি কেবল আনুমানিক কুরিয়ার চার্জ। অর্ডার রিভিউতে চূড়ান্ত শিপিং চার্জ নিরাপদভাবে পুনরায় হিসাব হবে।"
        }
    };
    const T = COPY[LANGUAGE] || COPY.en;

    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function currency(value) {
        return new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value)||0);
    }

    function init() {
        const pinInput = document.getElementById("checkout-pincode");
        const methodInputs = Array.from(document.querySelectorAll('input[name="fulfillment_method"]'));
        if (!pinInput || !methodInputs.length || document.getElementById("delhivery-cart-estimate-result")) return;

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

        let timer = null;
        let sequence = 0;

        function setMessage(message) {
            result.hidden = !message;
            result.textContent = message || "";
        }
        function isHomeDeliverySelected() {
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
            if (!cart.length) return {error:T.weightMissing};
            const response = await fetch("/assets/data/catalogue-index.json", {
                headers:{Accept:"application/json"}, cache:"no-store", credentials:"same-origin"
            });
            if (!response.ok) throw new Error("catalogue_unavailable");
            const catalogue = await response.json();
            if (!Array.isArray(catalogue)) throw new Error("catalogue_unavailable");
            const byId = new Map(catalogue.filter(item => item && typeof item.id === "string").map(item => [item.id, item]));
            let total = 0;
            for (const line of cart) {
                const product = byId.get(String(line.productId));
                const rawWeight = product?.approx_weight_g ?? product?.approx_weight_grams ?? product?.weight_g ?? product?.shipping_weight_g;
                const weight = Number(rawWeight);
                const quantity = Number(line.quantity);
                if (rawWeight == null || rawWeight === "" || !Number.isFinite(weight) || weight <= 0 ||
                    !Number.isInteger(quantity) || quantity < 1) return {error:T.weightMissing};
                total += Math.round(weight) * quantity;
            }
            if (!Number.isInteger(total) || total < 1 || total > 200000) return {error:T.weightInvalid};
            return {grams:total};
        }

        async function lookup(pin) {
            if (!isHomeDeliverySelected()) return;
            const current = ++sequence;
            setMessage(T.checking);
            try {
                if (typeof supabaseClient === "undefined" || !supabaseClient?.functions?.invoke) {
                    setMessage(T.config);
                    return;
                }

                // Check the destination PIN and delivery estimate independently of
                // catalogue weights, so missing weights do not hide serviceability.
                const deliveryResponse = await supabaseClient.functions.invoke("delhivery-estimate", {
                    body: {estimate_type:"delivery_time", destination_pin:pin}
                });
                if (current !== sequence) return;
                let deliveryData = deliveryResponse.data;
                if (deliveryResponse.error || !deliveryData?.ok) {
                    try {
                        if (deliveryResponse.error?.context && typeof deliveryResponse.error.context.json === "function") {
                            deliveryData = await deliveryResponse.error.context.json();
                        }
                    } catch {
                        // Use the safe fallback message.
                    }
                    if (["delhivery_b2c_token_not_configured","rate_limit_unavailable"].includes(deliveryData?.code)) setMessage(T.config);
                    else setMessage(deliveryData?.message || T.failed);
                    return;
                }
                if (!deliveryData.serviceability?.serviceable) {
                    setMessage(deliveryData.serviceability?.message || T.unavailable);
                    return;
                }

                const deliveryDate = String(deliveryData.delivery?.estimated_date || "").trim();
                const deliveryDays = deliveryData.delivery?.tat_days == null ? NaN : Number(deliveryData.delivery.tat_days);
                const eta = deliveryDate || (Number.isFinite(deliveryDays) ? deliveryDays + " " + T.days : T.timeMissing);
                let resultHtml =
                    '<p class="delhivery-estimator-success">' + escapeHtml(T.serviceable) + '</p>' +
                    '<div class="delhivery-estimator-metric"><span>' + escapeHtml(T.time) + '</span><strong>' + escapeHtml(eta) + '</strong></div>';

                const weight = await getTotalWeight();
                if (current !== sequence) return;
                if (weight.error) {
                    result.innerHTML = resultHtml + '<p class="delhivery-estimator-help">' + escapeHtml(weight.error) + '</p>';
                    return;
                }

                const response = await supabaseClient.functions.invoke("delhivery-estimate", {
                    body: {estimate_type:"shipping_charge", destination_pin:pin, chargeable_weight_g:weight.grams}
                });
                if (current !== sequence) return;
                let data = response.data;
                if (response.error || !data?.ok) {
                    try {
                        if (response.error?.context && typeof response.error.context.json === "function") {
                            data = await response.error.context.json();
                        }
                    } catch {
                        // Use the safe fallback message.
                    }
                    const message = ["delhivery_b2c_token_not_configured","rate_limit_unavailable"].includes(data?.code)
                        ? T.config : (data?.message || T.failed);
                    result.innerHTML = resultHtml + '<p class="delhivery-estimator-help">' + escapeHtml(message) + '</p>';
                    return;
                }
                if (!data.serviceability?.serviceable) {
                    setMessage(data.serviceability?.message || T.unavailable);
                    return;
                }
                if (!data.shipping?.available) {
                    result.innerHTML = resultHtml + '<p class="delhivery-estimator-help">' + escapeHtml(T.priceMissing) + '</p>';
                    return;
                }
                resultHtml +=
                    '<div class="delhivery-estimator-metric"><span>' + escapeHtml(T.price) + '</span><strong>' + escapeHtml(currency(data.shipping.amount)) + '</strong></div>' +
                    '<p class="delhivery-estimator-disclaimer">' + escapeHtml(T.approximate) + '</p>';
                result.innerHTML = resultHtml;
            } catch (error) {
                if (window.SouviksErrors?.log) window.SouviksErrors.log("Delhivery cart shipping estimate failed", error, "warn");
                if (current === sequence) setMessage(T.failed);
            }
        }

        function schedule(value) {
            if (!isHomeDeliverySelected()) {
                clearTimeout(timer);
                sequence += 1;
                setMessage("");
                return;
            }
            const pin = String(value || "").replace(/\D/g, "").slice(0, 6);
            clearTimeout(timer);
            sequence += 1;
            if (pinInput.value !== pin) pinInput.value = pin;
            if (pin.length !== 6) { setMessage(""); return; }
            timer = setTimeout(() => { void lookup(pin); }, 400);
        }

        pinInput.addEventListener("input", () => schedule(pinInput.value));
        pinInput.addEventListener("change", () => schedule(pinInput.value));
        methodInputs.forEach(input => input.addEventListener("change", () => {
            const deliverySelected = isHomeDeliverySelected();
            helper.hidden = !deliverySelected;
            if (!deliverySelected) {
                clearTimeout(timer);
                sequence += 1;
                setMessage("");
                return;
            }
            if (/^\d{6}$/.test(pinInput.value)) schedule(pinInput.value);
        }));
        window.addEventListener("souviks:purchase-cart-changed", () => {
            const pin = String(pinInput.value || "").trim();
            if (/^\d{6}$/.test(pin)) schedule(pin);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
    else init();
})();
