(() => {
    "use strict";
    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const CART_KEY = "souviks_purchase_cart_v1";
    const COPY = {
        en:{
            helper:"Delivery time and approximate COD courier charges calculate automatically from your PIN code and cart items.",
            checking:"Calculating delivery time and COD charges…",
            serviceable:"Delhivery COD delivery is available for this PIN code.",
            unavailable:"Delhivery COD delivery is not available for this PIN code.",
            price:"Estimated COD courier charge",time:"Estimated delivery time",days:"business days",
            priceMissing:"Delhivery did not return a usable COD charge for this route.",
            timeMissing:"Delivery-time estimate is unavailable for this route.",
            weightMissing:"A weight is missing for one or more cart items. Souviks will update the estimate when those weights are available.",
            weightInvalid:"The cart's combined approximate weight is outside the supported range. Please request a shipping quote.",
            config:"The live delivery estimator is not fully configured. Please contact Souviks for a quote.",
            failed:"We could not retrieve an estimate. Please try again shortly.",
            approximate:"Approximate estimate only. Final courier charges and delivery time may differ."
        },
        hi:{
            helper:"आपके पिन कोड और कार्ट के उत्पादों के आधार पर डिलीवरी समय और अनुमानित COD शुल्क अपने-आप निकलेगा।",
            checking:"डिलीवरी समय और COD शुल्क की गणना हो रही है…",
            serviceable:"इस पिन कोड पर Delhivery COD डिलीवरी उपलब्ध है।",
            unavailable:"इस पिन कोड पर Delhivery COD डिलीवरी उपलब्ध नहीं है।",
            price:"अनुमानित COD कूरियर शुल्क",time:"अनुमानित डिलीवरी समय",days:"कार्य दिवस",
            priceMissing:"Delhivery ने इस मार्ग के लिए मान्य COD शुल्क नहीं दिया।",
            timeMissing:"इस मार्ग के लिए डिलीवरी समय का अनुमान उपलब्ध नहीं है।",
            weightMissing:"कार्ट के एक या अधिक उत्पादों का वज़न दर्ज नहीं है। वज़न उपलब्ध होने पर अनुमान अपडेट होगा।",
            weightInvalid:"कार्ट का कुल अनुमानित वज़न समर्थित सीमा से बाहर है। शिपिंग कोट माँगें।",
            config:"लाइव अनुमान पूरी तरह कॉन्फ़िगर नहीं है। कोट के लिए Souviks से संपर्क करें।",
            failed:"अनुमान प्राप्त नहीं हुआ। कुछ देर बाद फिर कोशिश करें।",
            approximate:"यह केवल अनुमान है। अंतिम कूरियर शुल्क और डिलीवरी समय अलग हो सकते हैं।"
        },
        bn:{
            helper:"আপনার পিন কোড ও কার্টের পণ্য অনুযায়ী ডেলিভারির সময় ও আনুমানিক COD চার্জ স্বয়ংক্রিয়ভাবে গণনা হবে।",
            checking:"ডেলিভারির সময় ও COD চার্জ গণনা হচ্ছে…",
            serviceable:"এই পিন কোডে Delhivery COD ডেলিভারি উপলব্ধ।",
            unavailable:"এই পিন কোডে Delhivery COD ডেলিভারি উপলব্ধ নয়।",
            price:"আনুমানিক COD কুরিয়ার চার্জ",time:"আনুমানিক ডেলিভারির সময়",days:"কর্মদিবস",
            priceMissing:"এই রুটের জন্য Delhivery ব্যবহারযোগ্য COD চার্জ দেয়নি।",
            timeMissing:"এই রুটের জন্য ডেলিভারির সময়ের হিসাব উপলব্ধ নয়।",
            weightMissing:"কার্টের এক বা একাধিক পণ্যের ওজন নথিভুক্ত নেই। ওজন পাওয়া গেলে হিসাব আপডেট হবে।",
            weightInvalid:"কার্টের মোট আনুমানিক ওজন সমর্থিত সীমার বাইরে। শিপিং কোট চাইুন।",
            config:"লাইভ হিসাব পুরোপুরি কনফিগার করা হয়নি। কোটের জন্য Souviks-এ যোগাযোগ করুন।",
            failed:"হিসাব পাওয়া যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
            approximate:"এটি কেবল আনুমানিক হিসাব। চূড়ান্ত কুরিয়ার চার্জ ও সময় আলাদা হতে পারে।"
        }
    };
    const T = COPY[LANGUAGE] || COPY.en;
    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    }
    function currency(value) {
        return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value)||0);
    }
    function init() {
        const pinInput = document.getElementById("checkout-pincode");
        if (!pinInput || document.getElementById("delhivery-cart-estimate-result")) return;
        const result = document.createElement("div");
        result.id = "delhivery-cart-estimate-result";
        result.className = "delhivery-estimator-result delhivery-cart-estimate-result";
        result.setAttribute("role","status");
        result.setAttribute("aria-live","polite");
        result.hidden = true;
        const pinGroup = pinInput.closest(".form-group") || pinInput.parentElement;
        pinGroup?.appendChild(result);
        const helper = document.createElement("p");
        helper.className = "delhivery-estimator-help delhivery-cart-estimate-help";
        helper.textContent = T.helper;
        pinGroup?.appendChild(helper);

        let timer = null, sequence = 0, lastSuccess = "";
        function setMessage(message) { result.hidden = !message; result.textContent = message || ""; }
        function readCart() {
            try {
                const items = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
                return Array.isArray(items) ? items.filter(item => item && typeof item.productId === "string" &&
                    Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0) : [];
            } catch { return []; }
        }
        async function getTotalWeight() {
            const cart = readCart();
            if (!cart.length) return {error:T.weightMissing};
            const response = await fetch("/assets/data/catalogue-index.json", {
                headers:{Accept:"application/json"},cache:"no-store",credentials:"same-origin"
            });
            if (!response.ok) throw new Error("catalogue_unavailable");
            const catalogue = await response.json();
            if (!Array.isArray(catalogue)) throw new Error("catalogue_unavailable");
            const byId = new Map(catalogue.filter(item => item && typeof item.id === "string").map(item => [item.id,item]));
            let total = 0;
            for (const line of cart) {
                const product = byId.get(String(line.productId));
                const weight = Number(product?.approx_weight_g ?? product?.weight_g ?? product?.shipping_weight_g);
                const quantity = Number(line.quantity);
                if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(quantity) || quantity < 1) return {error:T.weightMissing};
                total += Math.round(weight) * quantity;
            }
            if (!Number.isInteger(total) || total < 1 || total > 200000) return {error:T.weightInvalid};
            return {grams:total};
        }
        async function lookup(pin) {
            const current = ++sequence;
            setMessage(T.checking);
            try {
                const total = await getTotalWeight();
                if (current !== sequence) return;
                if (total.error) { setMessage(total.error); return; }
                const signature = pin + ":" + total.grams + ":COD:E";
                if (signature === lastSuccess) return;
                if (typeof supabaseClient === "undefined" || !supabaseClient?.functions?.invoke) { setMessage(T.config); return; }
                const response = await supabaseClient.functions.invoke("delhivery-estimate", {
                    body:{destination_pin:pin,chargeable_weight_g:total.grams}
                });
                if (current !== sequence) return;
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
                    ? '<div class="delhivery-estimator-metric"><span>'+escapeHtml(T.price)+'</span><strong>'+escapeHtml(currency(data.shipping.amount))+'</strong></div>'
                    : '<p>'+escapeHtml(T.priceMissing)+'</p>';
                let delivery = '<p>'+escapeHtml(T.timeMissing)+'</p>';
                if (data.delivery?.available) {
                    const days = data.delivery.tat_days == null ? NaN : Number(data.delivery.tat_days);
                    const date = String(data.delivery.estimated_date || "").trim();
                    const dayText = Number.isFinite(days) ? escapeHtml(String(days))+' '+escapeHtml(T.days) : "";
                    const description = date
                        ? escapeHtml(date) + (dayText ? ' ('+dayText+')' : '')
                        : (dayText || escapeHtml(T.timeMissing));
                    delivery = '<div class="delhivery-estimator-metric"><span>'+escapeHtml(T.time)+'</span><strong>'+description+'</strong></div>';
                }
                result.innerHTML = '<p class="delhivery-estimator-success">'+escapeHtml(T.serviceable)+'</p>'+price+delivery+
                    '<p class="delhivery-estimator-disclaimer">'+escapeHtml(T.approximate)+'</p>';
                lastSuccess = signature;
            } catch (error) {
                if (window.SouviksErrors?.log) window.SouviksErrors.log("Delhivery cart estimate failed",error,"warn");
                if (current === sequence) setMessage(T.failed);
            }
        }
        function schedule(value) {
            const pin = String(value||"").replace(/\D/g,"").slice(0,6);
            clearTimeout(timer);
            sequence += 1;
            lastSuccess = "";
            if (pinInput.value !== pin) pinInput.value = pin;
            if (pin.length !== 6) { setMessage(""); return; }
            timer = setTimeout(() => { void lookup(pin); },450);
        }
        pinInput.addEventListener("input",() => schedule(pinInput.value));
        pinInput.addEventListener("change",() => schedule(pinInput.value));
        window.addEventListener("souviks:purchase-cart-changed",() => {
            const pin = String(pinInput.value||"").trim();
            if (/^\d{6}$/.test(pin)) schedule(pin);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
    else init();
})();
