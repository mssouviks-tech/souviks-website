(() => {
    "use strict";

    const STORAGE_KEY = "souviks_purchase_cart_v1";
    const TOKEN_KEY_PREFIX = "souviks_checkout_token:";
    const MAX_ITEMS = 50;
    const MAX_QUANTITY = 9999;
    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const TEXT = {
        en: {
            added: "Added to your cart.",
            shippingUnconfirmed: "Confirmed before payment",
            totalUnconfirmed: "Review to calculate",
            reviewInvalidated: "Your cart or checkout details changed. Review the total again before payment.",
            addFailed: "This item could not be added to the cart.",
            loadFailed: "We could not load the current catalogue. Refresh the page and try again.",
            empty: "Your cart is empty. Browse the catalogue and add priced products to begin.",
            unavailable: "One or more items are unavailable for online checkout. Remove them or request a quotation.",
            cartTooLarge: "The cart can contain up to 50 different products.",
            quantityLimit: "Quantity must be between 1 and 9,999.",
            reviewFailed: "We could not prepare this order. Check the information and try again.",
            continueFailed: "Cashfree Checkout could not open. Please retry the checkout.",
            statusLoading: "Checking your payment with Cashfree…",
            statusPaid: "Payment confirmed. Your order is recorded; Souviks will confirm availability and fulfilment.",
            statusPending: "Cashfree has not confirmed payment yet. Do not pay again while this status is pending. Retry verification shortly.",
            statusFailed: "Cashfree reports that this payment failed. Review the reason below, then try again with a different payment method if needed.",
            failureReasonPrefix: "Reason: ",
            statusUnknown: "We could not verify this order in this browser session. Keep the order reference and contact Souviks.",
            retry: "Retry verification",
            remove: "Remove",
            reviewTotal: "Review total & continue",
            continuePayment: "Continue to secure payment",
            addedStatus: "Added to cart"
        },
        hi: {
            added: "उत्पाद आपके कार्ट में जोड़ दिया गया है।",
            shippingUnconfirmed: "भुगतान से पहले पुष्टि होगी",
            totalUnconfirmed: "गणना के लिए समीक्षा करें",
            reviewInvalidated: "कार्ट या चेकआउट विवरण बदल गए हैं। भुगतान से पहले कुल राशि फिर से जाँचें।",
            addFailed: "इस उत्पाद को कार्ट में नहीं जोड़ा जा सका।",
            loadFailed: "वर्तमान कैटलॉग लोड नहीं हो सका। पेज रिफ्रेश करके फिर कोशिश करें।",
            empty: "आपका कार्ट खाली है। शुरुआत करने के लिए कैटलॉग से कीमत वाले उत्पाद जोड़ें।",
            unavailable: "कुछ उत्पाद ऑनलाइन चेकआउट के लिए उपलब्ध नहीं हैं। उन्हें हटाएँ या कोटेशन माँगें।",
            cartTooLarge: "कार्ट में अधिकतम 50 अलग-अलग उत्पाद हो सकते हैं।",
            quantityLimit: "मात्रा 1 से 9,999 के बीच होनी चाहिए।",
            reviewFailed: "ऑर्डर तैयार नहीं हो सका। जानकारी जाँचकर फिर कोशिश करें।",
            continueFailed: "Cashfree Checkout नहीं खुल सका। कृपया फिर कोशिश करें।",
            statusLoading: "Cashfree से भुगतान की पुष्टि हो रही है…",
            statusPaid: "भुगतान की पुष्टि हो गई है। आपका ऑर्डर दर्ज है; Souviks उपलब्धता और डिलीवरी की पुष्टि करेगा।",
            statusPending: "Cashfree ने अभी भुगतान की पुष्टि नहीं की है। इस स्थिति में दोबारा भुगतान न करें; थोड़ी देर बाद फिर जाँचें।",
            statusFailed: "Cashfree के अनुसार भुगतान विफल हुआ। नीचे दिया गया कारण देखें और ज़रूरत होने पर किसी अन्य भुगतान तरीके से फिर कोशिश करें।",
            failureReasonPrefix: "कारण: ",
            statusUnknown: "इस ब्राउज़र सत्र में ऑर्डर की पुष्टि नहीं हो सकी। ऑर्डर संदर्भ रखें और Souviks से संपर्क करें।",
            retry: "पुष्टि फिर जाँचें",
            remove: "हटाएँ",
            reviewTotal: "कुल राशि जाँचें और आगे बढ़ें",
            continuePayment: "सुरक्षित भुगतान पर आगे बढ़ें",
            addedStatus: "कार्ट में जोड़ा गया"
        },
        bn: {
            added: "পণ্যটি আপনার কার্টে যোগ করা হয়েছে।",
            shippingUnconfirmed: "পেমেন্টের আগে নিশ্চিত হবে",
            totalUnconfirmed: "মূল্য যাচাই করুন",
            reviewInvalidated: "কার্ট বা চেকআউটের বিবরণ বদলেছে। পেমেন্টের আগে মোট মূল্য আবার যাচাই করুন।",
            addFailed: "পণ্যটি কার্টে যোগ করা যায়নি।",
            loadFailed: "বর্তমান ক্যাটালগ লোড করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।",
            empty: "আপনার কার্ট খালি। ক্যাটালগ থেকে মূল্যযুক্ত পণ্য যোগ করে শুরু করুন।",
            unavailable: "কিছু পণ্য অনলাইন চেকআউটের জন্য উপলব্ধ নয়। সেগুলি সরান অথবা কোটেশন চাইুন।",
            cartTooLarge: "কার্টে সর্বাধিক ৫০টি আলাদা পণ্য থাকতে পারে।",
            quantityLimit: "পরিমাণ ১ থেকে ৯,৯৯৯-এর মধ্যে হতে হবে।",
            reviewFailed: "অর্ডার তৈরি করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।",
            continueFailed: "Cashfree Checkout খোলা যায়নি। আবার চেষ্টা করুন।",
            statusLoading: "Cashfree থেকে পেমেন্ট যাচাই হচ্ছে…",
            statusPaid: "পেমেন্ট নিশ্চিত হয়েছে। আপনার অর্ডার রেকর্ড করা হয়েছে; Souviks পণ্যের উপলভ্যতা ও ডেলিভারি নিশ্চিত করবে।",
            statusPending: "Cashfree এখনও পেমেন্ট নিশ্চিত করেনি। এই অবস্থায় আবার পেমেন্ট করবেন না; কিছুক্ষণ পরে যাচাই করুন।",
            statusFailed: "Cashfree অনুযায়ী পেমেন্ট ব্যর্থ হয়েছে। নিচের কারণ দেখুন, প্রয়োজনে অন্য পেমেন্ট পদ্ধতিতে আবার চেষ্টা করুন।",
            failureReasonPrefix: "কারণ: ",
            statusUnknown: "এই ব্রাউজার সেশনে অর্ডার যাচাই করা যায়নি। অর্ডার রেফারেন্স রেখে Souviks-এর সঙ্গে যোগাযোগ করুন।",
            retry: "আবার যাচাই করুন",
            reviewTotal: "মোট মূল্য যাচাই করে এগিয়ে যান",
            continuePayment: "নিরাপদ পেমেন্টে এগিয়ে যান",
            addedStatus: "কার্টে যোগ করা হয়েছে"
        }
    };
    const T = TEXT[LANGUAGE] || TEXT.en;
    let cataloguePromise = null;
    let catalogueById = new Map();
    let preparedCheckout = null;
    let isPreparing = false;
    let isLaunching = false;

    function safeReadCart() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            if (!Array.isArray(parsed)) return [];
            const unique = new Map();
            for (const item of parsed) {
                const productId = String(item?.productId || "").trim().slice(0, 128);
                const quantity = Number(item?.quantity);
                if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) continue;
                if (!unique.has(productId)) unique.set(productId, { productId, quantity });
            }
            return Array.from(unique.values()).slice(0, MAX_ITEMS);
        } catch {
            return [];
        }
    }

    function writeCart(items) {
        const cleaned = [];
        const seen = new Set();
        for (const item of items) {
            const productId = String(item?.productId || "").trim().slice(0, 128);
            const quantity = Number(item?.quantity);
            if (!productId || seen.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) continue;
            seen.add(productId);
            cleaned.push({ productId, quantity });
            if (cleaned.length >= MAX_ITEMS) break;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
            window.dispatchEvent(new CustomEvent("souviks:purchase-cart-changed", { detail: { count: cleaned.length } }));
        } catch {
            // Private-browsing storage failures are shown only when an action needs persistence.
        }
        return cleaned;
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function currency(value) {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
    }

    function getPrice(product) {
        const value = Number(product?.selling_price);
        return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
    }

    function imageUrl(product) {
        const direct = String(product?.card_image_url || product?.image_url || "").trim();
        if (direct.startsWith("/") || /^https:\/\//i.test(direct)) return direct;
        const folder = String(product?.image_folder || product?.id || "").trim();
        const gallery = Array.isArray(product?.gallery) ? product.gallery : [];
        const first = String(gallery[0] || product?.primary_image || product?.image || "").trim();
        if (folder && first && !first.includes("..")) {
            return "/assets/images/products/" + encodeURIComponent(folder) + "/" + encodeURIComponent(first.split("/").pop());
        }
        return "/assets/images/placeholder.webp";
    }

    async function loadCatalogue() {
        if (!cataloguePromise) {
            cataloguePromise = fetch("/assets/data/catalogue-index.json", {
                headers: { Accept: "application/json" },
                cache: "no-store",
                credentials: "same-origin"
            }).then(async response => {
                if (!response.ok) throw new Error("catalogue_unavailable");
                const value = await response.json();
                if (!Array.isArray(value)) throw new Error("catalogue_invalid");
                catalogueById = new Map(value.filter(product => product && product.active !== false && product.id)
                    .map(product => [String(product.id), product]));
                return catalogueById;
            }).catch(error => {
                cataloguePromise = null;
                throw error;
            });
        }
        return cataloguePromise;
    }

    function setStatus(element, message, type = "info") {
        if (!element) return;
        element.textContent = message || "";
        element.className = "form-status purchase-cart-status" + (type ? " " + type : "");
        element.hidden = !message;
    }

    function cartCount() {
        return safeReadCart().reduce((sum, item) => sum + item.quantity, 0);
    }

    function updateCartLink() {
        const count = cartCount();
        const navLinks = document.querySelectorAll('a[href$="/cart"], a[href$="/cart.html"]');
        navLinks.forEach(link => {
            let badge = link.querySelector(".purchase-cart-count");
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "purchase-cart-count";
                badge.setAttribute("aria-label", "Items in cart");
                link.appendChild(document.createTextNode(" "));
                link.appendChild(badge);
            }
            badge.textContent = String(count);
            badge.hidden = count < 1;
        });
    }

    function invalidateReview() {
        if (!preparedCheckout) return;
        preparedCheckout = null;
        const review = document.getElementById("purchase-payment-review");
        if (review) review.hidden = true;
        const status = document.getElementById("purchase-cart-status");
        const shipping = document.getElementById("purchase-cart-shipping");
        const total = document.getElementById("purchase-cart-total");
        if (shipping) shipping.textContent = T.shippingUnconfirmed;
        if (total) total.textContent = T.totalUnconfirmed;
        const payButton = document.getElementById("purchase-pay-button");
        if (payButton) payButton.disabled = true;
        setStatus(status, T.reviewInvalidated, "info");
    }

    function addProduct(productId, button, requestedQuantity = 1) {
        const quantity = Number(requestedQuantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
            setStatus(document.getElementById("purchase-cart-status"), T.quantityLimit, "error");
            return;
        }
        const items = safeReadCart();
        const existing = items.find(item => item.productId === productId);
        if (!existing && items.length >= MAX_ITEMS) {
            setStatus(document.getElementById("purchase-cart-status"), T.cartTooLarge, "error");
            return;
        }
        if (existing) {
            if (existing.quantity + quantity > MAX_QUANTITY) {
                setStatus(document.getElementById("purchase-cart-status"), T.quantityLimit, "error");
                return;
            }
            existing.quantity += quantity;
        } else {
            items.push({ productId, quantity });
        }
        const saved = writeCart(items);
        if (!saved.some(item => item.productId === productId)) {
            setStatus(document.getElementById("purchase-cart-status"), T.addFailed, "error");
            return;
        }
        invalidateReview();
        updateCartLink();
        const previous = button?.textContent || "";
        if (button) {
            button.textContent = T.addedStatus;
            button.disabled = true;
            window.setTimeout(() => {
                if (!button.isConnected) return;
                button.textContent = previous;
                button.disabled = false;
            }, 1000);
        }
        window.souviksAnalytics?.trackEvent?.("add_to_cart", { product_id: productId, quantity });
        window.dispatchEvent(new CustomEvent("souviks:purchase-cart-added", { detail: { productId } }));
    }

    function cartHasUnavailableItems() {
        return safeReadCart().some(item => {
            const product = catalogueById.get(item.productId);
            const price = getPrice(product);
            return !product || product.active === false || price === null ||
                (Number.isFinite(Number(product?.mrp)) && Number(product.mrp) > 0 && price > Number(product.mrp));
        });
    }

    function renderCart() {
        const root = document.getElementById("purchase-cart-root");
        if (!root) return;
        const itemHost = document.getElementById("purchase-cart-items");
        const empty = document.getElementById("purchase-cart-empty");
        const layout = document.getElementById("purchase-cart-layout");
        if (!itemHost) return;
        const items = safeReadCart();
        const rows = [];
        let subtotalPaise = 0;
        let unavailableCount = 0;

        for (const item of items) {
            const product = catalogueById.get(item.productId);
            const price = getPrice(product);
            if (!product || product.active === false || price === null || (Number.isFinite(Number(product?.mrp)) && Number(product.mrp) > 0 && price > Number(product.mrp))) {
                unavailableCount += 1;
                rows.push('<article class="purchase-cart-item purchase-cart-item-unavailable"><div><strong>' +
                    escapeHtml(product?.product_name || product?.name || item.productId) +
                    '</strong><p>' + escapeHtml(T.unavailable) + '</p></div><button type="button" class="btn btn-secondary" data-cart-remove="' +
                    escapeHtml(item.productId) + '">' + escapeHtml(T.remove) + '</button></article>');
                continue;
            }
            const unitPaise = Math.round(price * 100);
            const linePaise = unitPaise * item.quantity;
            subtotalPaise += linePaise;
            const name = String(product.product_name || product.name || "");
            const brand = String(product.brand_name || product.brand || "");
            const part = String(product.part_number || product.partNumber || "");
            const src = imageUrl(product);
            rows.push('<article class="purchase-cart-item">' +
                '<img class="purchase-cart-item-image" src="' + escapeHtml(src) + '" alt="' + escapeHtml(name) + '" loading="lazy" decoding="async">' +
                '<div class="purchase-cart-item-details"><h2>' + escapeHtml(name) + '</h2>' +
                '<p>' + escapeHtml(brand) + (part ? " · Part No. " + escapeHtml(part) : "") + '</p>' +
                '<p class="purchase-cart-item-price">' + currency(price) + ' each</p>' +
                '<div class="purchase-cart-quantity" aria-label="Quantity controls">' +
                '<button type="button" data-cart-decrease="' + escapeHtml(item.productId) + '" aria-label="Decrease quantity">−</button>' +
                '<span aria-live="polite">' + item.quantity + '</span>' +
                '<button type="button" data-cart-increase="' + escapeHtml(item.productId) + '" aria-label="Increase quantity">+</button>' +
                '<button type="button" class="purchase-cart-remove" data-cart-remove="' + escapeHtml(item.productId) + '">' + escapeHtml(T.remove) + '</button>' +
                '</div></div><strong class="purchase-cart-line-total">' + currency(linePaise / 100) + '</strong></article>');
        }

        itemHost.innerHTML = rows.join("");
        if (empty) empty.hidden = items.length > 0;
        if (layout) layout.hidden = items.length === 0;
        const subtotal = document.getElementById("purchase-cart-subtotal");
        if (subtotal) subtotal.textContent = currency(subtotalPaise / 100);
        const shipping = document.getElementById("purchase-cart-shipping");
        if (shipping && !preparedCheckout) shipping.textContent = T.shippingUnconfirmed;
        const total = document.getElementById("purchase-cart-total");
        if (total && !preparedCheckout) total.textContent = T.totalUnconfirmed;
        const reviewButton = document.getElementById("purchase-review-button");
        if (reviewButton) reviewButton.disabled = unavailableCount > 0 || isPreparing;
        if (unavailableCount > 0) {
            setStatus(document.getElementById("purchase-cart-status"), T.unavailable, "error");
        }
        updateCartLink();
        invalidateReviewIfEmpty();
    }

    function invalidateReviewIfEmpty() {
        if (safeReadCart().length === 0) {
            preparedCheckout = null;
            const review = document.getElementById("purchase-payment-review");
            if (review) review.hidden = true;
        }
    }

    async function prefillCustomer() {
        if (typeof supabaseClient === "undefined") return;
        try {
            const result = await supabaseClient.auth.getUser();
            const user = result?.data?.user;
            if (!user) return;
            const email = document.getElementById("checkout-email");
            if (email && !email.value && user.email) email.value = user.email;
            let profile = null;
            const query = await supabaseClient.from("profiles").select("full_name,phone,company").eq("id", user.id).maybeSingle();
            if (!query.error) profile = query.data;
            const fullName = document.getElementById("checkout-name");
            const phone = document.getElementById("checkout-phone");
            const company = document.getElementById("checkout-company");
            if (fullName && !fullName.value) fullName.value = profile?.full_name || user.user_metadata?.full_name || "";
            if (phone && !phone.value) phone.value = String(profile?.phone || "").replace(/[^0-9]/g, "").slice(-10);
            if (company && !company.value) company.value = profile?.company || "";
        } catch {
            // Guest checkout remains available if account prefill fails.
        }
    }

    async function getFunctionError(error) {
        try {
            if (error?.context && typeof error.context.json === "function") {
                const body = await error.context.json();
                if (body?.message) return String(body.message);
            }
        } catch {
            // Use the translated safe fallback below.
        }
        return "";
    }

    function bindCartPage() {
        const root = document.getElementById("purchase-cart-root");
        if (!root) return;
        const form = document.getElementById("purchase-checkout-form");
        const reviewButton = document.getElementById("purchase-review-button");
        const payButton = document.getElementById("purchase-pay-button");
        const status = document.getElementById("purchase-cart-status");

        loadCatalogue().then(() => renderCart()).catch(() => {
            setStatus(status, T.loadFailed, "error");
            const empty = document.getElementById("purchase-cart-empty");
            if (empty) empty.hidden = false;
            const layout = document.getElementById("purchase-cart-layout");
            if (layout) layout.hidden = true;
        });
        prefillCustomer();

        form?.addEventListener("input", () => invalidateReview());
        form?.addEventListener("change", () => invalidateReview());

        form?.addEventListener("submit", async event => {
            event.preventDefault();
            if (isPreparing || isLaunching || !form.reportValidity()) return;
            if (typeof supabaseClient === "undefined") {
                setStatus(status, "Secure checkout is currently unavailable. Please request a quote.", "error");
                return;
            }
            const currentCart = safeReadCart();
            if (!currentCart.length) {
                setStatus(status, T.empty, "error");
                return;
            }
            isPreparing = true;
            if (reviewButton) {
                reviewButton.disabled = true;
                reviewButton.textContent = "Preparing secure total…";
            }
            setStatus(status, "", "");
            preparedCheckout = null;
            const customer = {
                name: document.getElementById("checkout-name")?.value || "",
                email: document.getElementById("checkout-email")?.value || "",
                phone: document.getElementById("checkout-phone")?.value || "",
                company: document.getElementById("checkout-company")?.value || "",
                gst_number: document.getElementById("checkout-gst")?.value || ""
            };
            const shippingAddress = {
                line1: document.getElementById("checkout-address1")?.value || "",
                line2: document.getElementById("checkout-address2")?.value || "",
                city: document.getElementById("checkout-city")?.value || "",
                state: document.getElementById("checkout-state")?.value || "",
                postal_code: document.getElementById("checkout-pincode")?.value || "",
                country: "IN"
            };
            const terms = Boolean(document.getElementById("checkout-terms")?.checked);
            try {
                const response = await supabaseClient.functions.invoke("cashfree-create-order", {
                    body: {
                        language: LANGUAGE,
                        items: currentCart.map(item => ({ product_id: item.productId, quantity: item.quantity })),
                        customer,
                        shipping_address: shippingAddress,
                        terms_accepted: terms
                    }
                });
                if (response.error) {
                    const detail = await getFunctionError(response.error);
                    throw new Error(detail || T.reviewFailed);
                }
                const data = response.data;
                if (!data?.ok || !data?.payment_session_id || !data?.checkout_token || !data?.order_id) {
                    throw new Error(data?.message || T.reviewFailed);
                }
                preparedCheckout = {
                    orderId: String(data.order_id),
                    orderNumber: String(data.order_number || data.order_id),
                    paymentSessionId: String(data.payment_session_id),
                    token: String(data.checkout_token),
                    mode: data.mode === "production" ? "production" : "sandbox",
                    subtotal: Number(data.subtotal),
                    shipping: Number(data.shipping),
                    total: Number(data.total),
                    cartSnapshot: JSON.stringify(currentCart),
                    formSnapshot: new FormData(form)
                };
                document.getElementById("purchase-cart-shipping").textContent = currency(preparedCheckout.shipping);
                document.getElementById("purchase-cart-total").textContent = currency(preparedCheckout.total);
                document.getElementById("checkout-review-order-number").textContent = preparedCheckout.orderNumber;
                document.getElementById("checkout-review-subtotal").textContent = currency(preparedCheckout.subtotal);
                document.getElementById("checkout-review-shipping").textContent = currency(preparedCheckout.shipping);
                document.getElementById("checkout-review-total").textContent = currency(preparedCheckout.total);
                const review = document.getElementById("purchase-payment-review");
                if (review) review.hidden = false;
                if (payButton) payButton.disabled = false;
                setStatus(status, "Review your confirmed total and continue to Cashfree's secure payment page.", "success");
                review?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } catch (error) {
                setStatus(status, String(error?.message || T.reviewFailed), "error");
            } finally {
                isPreparing = false;
                if (reviewButton) {
                    reviewButton.disabled = cartHasUnavailableItems();
                    reviewButton.textContent = T.reviewTotal;
                }
            }
        });

        payButton?.addEventListener("click", async () => {
            if (isLaunching || !preparedCheckout) return;
            if (JSON.stringify(safeReadCart()) !== preparedCheckout.cartSnapshot) {
                invalidateReview();
                renderCart();
                return;
            }
            if (typeof window.Cashfree !== "function") {
                setStatus(status, T.continueFailed, "error");
                return;
            }
            isLaunching = true;
            payButton.disabled = true;
            try {
                sessionStorage.setItem(TOKEN_KEY_PREFIX + preparedCheckout.orderId, preparedCheckout.token);
                const cashfree = window.Cashfree({ mode: preparedCheckout.mode });
                await cashfree.checkout({
                    paymentSessionId: preparedCheckout.paymentSessionId,
                    redirectTarget: "_self"
                });
            } catch (error) {
                setStatus(status, String(error?.message || T.continueFailed), "error");
            } finally {
                isLaunching = false;
                payButton.disabled = false;
            }
        });

        document.addEventListener("click", event => {
            const target = event.target instanceof Element ? event.target.closest("[data-cart-increase], [data-cart-decrease], [data-cart-remove]") : null;
            if (!target || !root.contains(target)) return;
            const productId = String(target.dataset.cartIncrease || target.dataset.cartDecrease || target.dataset.cartRemove || "");
            if (!productId) return;
            let items = safeReadCart();
            const item = items.find(entry => entry.productId === productId);
            if (target.hasAttribute("data-cart-remove")) {
                items = items.filter(entry => entry.productId !== productId);
            } else if (item && target.hasAttribute("data-cart-increase")) {
                if (item.quantity >= MAX_QUANTITY) {
                    setStatus(status, T.quantityLimit, "error");
                    return;
                }
                item.quantity += 1;
            } else if (item && target.hasAttribute("data-cart-decrease")) {
                if (item.quantity <= 1) items = items.filter(entry => entry.productId !== productId);
                else item.quantity -= 1;
            }
            writeCart(items);
            invalidateReview();
            renderCart();
            setStatus(status, "", "");
        });
    }

    async function injectProductDetailCartButton() {
        if (!document.querySelector(".pdp-rfq-btn") || !/\/(en|hi|bn)\/products\//.test(window.location.pathname)) return;
        try {
            const items = await loadCatalogue();
            const slug = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || "").replace(/\.html$/i, "");
            const product = Array.from(items.values()).find(item => String(item.slug || "") === slug);
            const price = getPrice(product);
            if (!product || price === null || product.active === false) return;
            const rfqButton = document.querySelector(".pdp-rfq-btn");
            if (!rfqButton || document.querySelector(".pdp-add-to-purchase-cart")) return;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-secondary add-to-purchase-cart pdp-add-to-purchase-cart";
            button.dataset.id = String(product.id);
            button.dataset.part = String(product.part_number || product.partNumber || "");
            button.dataset.name = String(product.product_name || product.name || "");
            button.dataset.brand = String(product.brand_name || product.brand || "");
            button.textContent = LANGUAGE === "hi" ? "कार्ट में जोड़ें" : LANGUAGE === "bn" ? "কার্টে যোগ করুন" : "Add to Cart";
            button.setAttribute("aria-label", "Add " + String(product.product_name || product.name || "product") + " to cart");
            rfqButton.insertAdjacentElement("beforebegin", button);
            // Priced products use the existing PDP quantity selector and purchase cart.
            // Keep RFQ only for products without a confirmed selling price.
            rfqButton.remove();
        } catch {
            // Never block the existing RFQ action because purchase-cart hydration failed.
        }
    }

    async function bindPaymentStatusPage() {
        const root = document.getElementById("payment-status-root");
        if (!root) return;
        const status = document.getElementById("payment-status-message");
        const reference = document.getElementById("payment-status-reference");
        const detail = document.getElementById("payment-status-detail");
        const retry = document.getElementById("payment-status-retry");
        const orderId = new URL(window.location.href).searchParams.get("order_id") || "";
        if (reference && orderId) reference.textContent = orderId;

        const verify = async () => {
            if (!orderId || !/^[A-Z0-9_-]{3,45}$/.test(orderId) || typeof supabaseClient === "undefined") {
                setStatus(status, T.statusUnknown, "error");
                if (retry) retry.hidden = true;
                return;
            }
            let token = "";
            try { token = sessionStorage.getItem(TOKEN_KEY_PREFIX + orderId) || ""; } catch { token = ""; }
            if (!/^[a-f0-9]{64}$/.test(token)) {
                setStatus(status, T.statusUnknown, "error");
                if (retry) retry.hidden = true;
                return;
            }
            if (retry) {
                retry.disabled = true;
                retry.hidden = true;
            }
            setStatus(status, T.statusLoading, "info");
            try {
                const response = await supabaseClient.functions.invoke("cashfree-verify-order", {
                    body: { order_id: orderId, checkout_token: token }
                });
                if (response.error) {
                    const message = await getFunctionError(response.error);
                    throw new Error(message || T.statusUnknown);
                }
                const data = response.data;
                if (!data?.ok) throw new Error(data?.message || T.statusUnknown);
                if (reference) reference.textContent = String(data.order_number || orderId);
                if (detail) detail.textContent = currency(data.amount) + " " + String(data.currency || "INR");
                if (data.payment_status === "paid") {
                    setStatus(status, T.statusPaid, "success");
                    try {
                        localStorage.removeItem(STORAGE_KEY);
                        sessionStorage.removeItem(TOKEN_KEY_PREFIX + orderId);
                    } catch {
                        // A failed local cleanup cannot change verified payment status.
                    }
                    updateCartLink();
                    window.souviksAnalytics?.trackEvent?.("purchase", {
                        transaction_id: String(data.order_number || orderId),
                        value: Number(data.amount) || 0,
                        currency: String(data.currency || "INR")
                    });
                    if (retry) retry.hidden = true;
                } else if (["failed", "cancelled"].includes(data.payment_status)) {
                    const failureReason = String(data.payment_failure_reason || "").trim();
                    const failedMessage = failureReason ? T.statusFailed + " " + T.failureReasonPrefix + failureReason : T.statusFailed;
                    setStatus(status, failedMessage, "error");
                    if (retry) retry.hidden = true;
                } else {
                    setStatus(status, T.statusPending, "info");
                    if (retry) {
                        retry.textContent = T.retry;
                        retry.hidden = false;
                        retry.disabled = false;
                    }
                }
            } catch (error) {
                setStatus(status, String(error?.message || T.statusUnknown), "error");
                if (retry) {
                    retry.textContent = T.retry;
                    retry.hidden = false;
                    retry.disabled = false;
                }
            }
        };
        retry?.addEventListener("click", verify);
        await verify();
    }

    document.addEventListener("click", event => {
        const target = event.target instanceof Element
            ? event.target.closest("[data-product-qty-increase], [data-product-qty-decrease]")
            : null;
        if (!target) return;
        event.preventDefault();
        const controls = target.closest("[data-product-quantity-controls]");
        const input = controls?.querySelector("[data-product-quantity]");
        if (!input) return;
        const current = Number(input.value);
        const quantity = Number.isInteger(current) ? current : 1;
        const next = target.hasAttribute("data-product-qty-increase")
            ? Math.min(MAX_QUANTITY, Math.max(1, quantity) + 1)
            : Math.max(1, quantity - 1);
        input.value = String(next);
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    document.addEventListener("change", event => {
        const input = event.target instanceof Element ? event.target.closest("[data-product-quantity]") : null;
        if (!input) return;
        const value = Number(input.value);
        const normalized = Number.isFinite(value) ? Math.max(1, Math.min(MAX_QUANTITY, Math.floor(value))) : 1;
        input.value = String(normalized);
    });

    document.addEventListener("click", event => {
        const button = event.target instanceof Element ? event.target.closest(".add-to-purchase-cart") : null;
        if (!button) return;
        event.preventDefault();
        const productId = String(button.dataset.id || "").trim();
        if (!productId) return;
        const cardQuantity = button.closest(".product-card")?.querySelector("[data-product-quantity]");
        const requestedQuantity = button.classList.contains("pdp-add-to-purchase-cart")
            ? Number(document.getElementById("pdpQty")?.value || 1)
            : Number(cardQuantity?.value || 1);
        addProduct(productId, button, requestedQuantity);
        const itemCount = safeReadCart().length;
        const link = document.querySelector('a[href$="/cart"], a[href$="/cart.html"]');
        if (link && itemCount > 0) link.classList.add("purchase-cart-has-items");
    });

    window.addEventListener("souviks:purchase-cart-changed", () => {
        updateCartLink();
        if (document.getElementById("purchase-cart-root") && catalogueById.size) renderCart();
    });
    window.addEventListener("storage", event => {
        if (event.key === STORAGE_KEY) {
            updateCartLink();
            if (document.getElementById("purchase-cart-root") && catalogueById.size) renderCart();
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        updateCartLink();
        bindCartPage();
        bindPaymentStatusPage();
        injectProductDetailCartButton();
    });
})();
