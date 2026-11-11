(() => {
    "use strict";

    const LANGUAGE = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const TEXT = {
        en: {
            loading: "Loading your orders…",
            refresh: "Refresh orders",
            loadFailed: "We couldn't load your orders. Please retry.",
            noOrders: "No orders are linked to this account yet.",
            guestNote: "Orders placed as a guest or while signed into a different account won't appear here.",
            order: "Order",
            placed: "Placed",
            total: "Total",
            items: "Items",
            quantity: "Qty",
            unitPrice: "Unit price",
            hsnCode: "HSN code",
            paymentStates: { paid: "Paid", pending: "Pending", failed: "Failed", cancelled: "Cancelled", refunded: "Refunded" },
            orderStates: { awaiting_payment: "Awaiting payment", confirmed: "Confirmed", freight_pending: "Delivery quotation pending", freight_quoted: "Delivery quotation sent", processing: "Processing", dispatched: "Dispatched", delivered: "Delivered", cancelled: "Cancelled" },
            freightPending: "Delivery charges will be calculated after packing. Souviks will send the quotation by email and WhatsApp.",
            freightQuoted: "Delivery quotation",
            freightPaid: "Delivery charges paid",
            freightPay: "Review & pay delivery charges",
            freightPendingAmount: "Final delivery amount pending calculation",
            productPaid: "Products paid",
            fulfillment: "Fulfilment",
            homeDelivery: "Home delivery",
            storePickup: "Store pickup",
            failureReason: "Payment failure reason",
            invoice: "Download tax invoice", invoicePending: "Tax invoice pending verification", invoiceFailed: "Invoice could not be downloaded. Please retry.",
            unknown: "Not available"
        },
        hi: {
            loading: "आपके ऑर्डर लोड हो रहे हैं…",
            refresh: "ऑर्डर रीफ़्रेश करें",
            loadFailed: "ऑर्डर लोड नहीं हो सके। कृपया फिर कोशिश करें।",
            noOrders: "अभी इस खाते से कोई ऑर्डर जुड़ा नहीं है।",
            guestNote: "अतिथि के रूप में या किसी दूसरे खाते में साइन इन करके किए गए ऑर्डर यहाँ नहीं दिखेंगे।",
            order: "ऑर्डर",
            placed: "तारीख",
            total: "कुल",
            items: "आइटम",
            quantity: "मात्रा",
            unitPrice: "प्रति यूनिट",
            hsnCode: "एचएसएन कोड",
            paymentStates: { paid: "भुगतान हो गया", pending: "लंबित", failed: "विफल", cancelled: "रद्द", refunded: "वापस किया गया" },
            orderStates: { awaiting_payment: "भुगतान की प्रतीक्षा", confirmed: "पुष्ट", freight_pending: "डिलीवरी शुल्क की गणना लंबित", freight_quoted: "डिलीवरी कोटेशन भेजा गया", processing: "प्रक्रिया में", dispatched: "भेज दिया गया", delivered: "डिलीवर हो गया", cancelled: "रद्द" },
            freightPending: "पैकिंग के बाद डिलीवरी शुल्क की गणना होगी। Souviks ईमेल और WhatsApp पर कोटेशन भेजेगा।",
            freightQuoted: "डिलीवरी कोटेशन",
            freightPaid: "डिलीवरी शुल्क का भुगतान हो गया",
            freightPay: "डिलीवरी शुल्क देखें और भुगतान करें",
            freightPendingAmount: "डिलीवरी शुल्क की गणना बाकी है",
            productPaid: "उत्पाद का भुगतान",
            fulfillment: "ऑर्डर प्राप्ति",
            homeDelivery: "घर पर डिलीवरी",
            storePickup: "स्टोर से पिकअप",
            failureReason: "भुगतान विफल होने का कारण",
            invoice: "टैक्स इनवॉइस डाउनलोड करें", invoicePending: "टैक्स इनवॉइस सत्यापन की प्रतीक्षा में है", invoiceFailed: "इनवॉइस डाउनलोड नहीं हो सका। फिर प्रयास करें।",
            unknown: "उपलब्ध नहीं"
        },
        bn: {
            loading: "আপনার অর্ডার লোড হচ্ছে…",
            refresh: "অর্ডার রিফ্রেশ করুন",
            loadFailed: "অর্ডার লোড করা যায়নি। আবার চেষ্টা করুন।",
            noOrders: "এখনও এই অ্যাকাউন্টের সঙ্গে কোনো অর্ডার যুক্ত নেই।",
            guestNote: "অতিথি হিসেবে বা অন্য অ্যাকাউন্টে সাইন ইন করে করা অর্ডার এখানে দেখা যাবে না।",
            order: "অর্ডার",
            placed: "তারিখ",
            total: "মোট",
            items: "পণ্য",
            quantity: "পরিমাণ",
            unitPrice: "প্রতি ইউনিট",
            hsnCode: "এইচএসএন কোড",
            paymentStates: { paid: "পেমেন্ট হয়েছে", pending: "অপেক্ষমাণ", failed: "ব্যর্থ", cancelled: "বাতিল", refunded: "ফেরত দেওয়া হয়েছে" },
            orderStates: { awaiting_payment: "পেমেন্টের অপেক্ষায়", confirmed: "নিশ্চিত", freight_pending: "ডেলিভারি চার্জের হিসাব বাকি", freight_quoted: "ডেলিভারি কোটেশন পাঠানো হয়েছে", processing: "প্রক্রিয়াধীন", dispatched: "পাঠানো হয়েছে", delivered: "ডেলিভারি হয়েছে", cancelled: "বাতিল" },
            freightPending: "প্যাকিংয়ের পরে ডেলিভারি চার্জ গণনা করা হবে। Souviks ইমেল ও WhatsApp-এ কোটেশন পাঠাবে।",
            freightQuoted: "ডেলিভারি কোটেশন",
            freightPaid: "ডেলিভারি চার্জ পরিশোধ হয়েছে",
            freightPay: "ডেলিভারি চার্জ দেখুন ও পেমেন্ট করুন",
            freightPendingAmount: "ডেলিভারি চার্জের হিসাব বাকি",
            productPaid: "পণ্যের পেমেন্ট",
            fulfillment: "অর্ডার সংগ্রহের পদ্ধতি",
            homeDelivery: "বাড়িতে ডেলিভারি",
            storePickup: "স্টোর থেকে সংগ্রহ",
            failureReason: "পেমেন্ট ব্যর্থ হওয়ার কারণ",
            invoice: "ট্যাক্স ইনভয়েস ডাউনলোড করুন", invoicePending: "ট্যাক্স ইনভয়েস যাচাইয়ের অপেক্ষায়", invoiceFailed: "ইনভয়েস ডাউনলোড করা যায়নি। আবার চেষ্টা করুন।",
            unknown: "উপলভ্য নয়"
        }
    };
    const T = TEXT[LANGUAGE] || TEXT.en;
    const root = document.getElementById("accountOrdersList");
    const loading = document.getElementById("accountOrdersLoading");
    const empty = document.getElementById("accountOrdersEmpty");
    const status = document.getElementById("accountOrdersStatus");
    const refreshButton = document.getElementById("accountOrdersRefresh");
    let pendingRequest = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function currency(value, code) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return T.unknown;
        try {
            return new Intl.NumberFormat(document.documentElement.lang || "en-IN", {
                style: "currency",
                currency: String(code || "INR")
            }).format(amount);
        } catch {
            return "₹" + amount.toFixed(2);
        }
    }

    function dateLabel(value) {
        const timestamp = Date.parse(String(value || ""));
        if (!Number.isFinite(timestamp)) return T.unknown;
        try {
            return new Intl.DateTimeFormat(document.documentElement.lang || "en-IN", {
                dateStyle: "medium"
            }).format(new Date(timestamp));
        } catch {
            return new Date(timestamp).toLocaleDateString();
        }
    }

    function normalizedStatus(value) {
        return String(value || "").trim().toLowerCase().replace(/[^a-z_]/g, "");
    }

    function statusBadge(value, labels, kind) {
        const normalized = normalizedStatus(value);
        const label = labels[normalized] || (normalized ? normalized.replace(/_/g, " ") : T.unknown);
        return element("span", "account-order-badge " + kind + " is-" + (labels[normalized] ? normalized : "unknown"), label);
    }

    function setMessage(message, kind) {
        if (!status) return;
        status.textContent = message || "";
        status.hidden = !message;
        status.classList.toggle("is-error", kind === "error");
        status.classList.toggle("is-success", kind === "success");
    }

    function renderItems(order) {
        const items = Array.isArray(order.items) ? order.items : [];
        const details = element("details", "account-order-items");
        details.appendChild(element("summary", "", T.items + " (" + items.length + ")"));
        if (!items.length) {
            details.appendChild(element("p", "account-order-no-items", T.unknown));
            return details;
        }

        const list = element("ul", "account-order-item-list");
        items.forEach((item) => {
            const row = element("li", "account-order-item");
            const description = element("div", "account-order-item-description");
            description.appendChild(element("strong", "", item.product_name || T.unknown));
            const meta = [item.part_number, item.brand].filter(Boolean).join(" · ");
            if (meta) description.appendChild(element("span", "account-order-item-meta", meta));
            const isConfirmedHsn = item.hsn_classification_status === "classified" &&
                item.hsn_confidence === "high" &&
                /^\d{8}$/.test(String(item.hsn_code || ""));
            if (isConfirmedHsn) {
                description.appendChild(element("span", "account-order-item-meta", T.hsnCode + ": " + item.hsn_code));
            }
            const pricing = element("div", "account-order-item-pricing");
            pricing.appendChild(element("span", "", T.quantity + ": " + Number(item.quantity || 0)));
            pricing.appendChild(element("span", "", T.unitPrice + ": " + currency(item.unit_price, order.currency)));
            pricing.appendChild(element("strong", "", currency(item.line_total, order.currency)));
            row.append(description, pricing);
            list.appendChild(row);
        });
        details.appendChild(list);
        return details;
    }

    function renderOrder(order) {
        const card = element("article", "account-order-card");
        const head = element("div", "account-order-head");
        const identity = element("div", "account-order-identity");
        identity.appendChild(element("span", "account-order-kicker", T.order));
        identity.appendChild(element("h3", "account-order-number", order.order_number || T.unknown));
        identity.appendChild(element("p", "account-order-date", T.placed + ": " + dateLabel(order.created_at)));
        const fulfilmentLabel = order.fulfillment_method === "pickup" ? T.storePickup : T.homeDelivery;
        identity.appendChild(element("p", "account-order-method", T.fulfillment + ": " + fulfilmentLabel));
        head.appendChild(identity);

        const badges = element("div", "account-order-badges");
        badges.appendChild(statusBadge(order.payment_status, T.paymentStates, "account-order-payment"));
        badges.appendChild(statusBadge(order.order_status, T.orderStates, "account-order-fulfillment"));
        head.appendChild(badges);
        card.appendChild(head);

        const total = element("div", "account-order-total");
        const isDeliveryAwaitingFreight = order.fulfillment_method === "delivery" &&
            order.payment_status === "paid" && order.freight_status !== "paid";
        total.appendChild(element("span", "", isDeliveryAwaitingFreight ? T.productPaid : T.total));
        total.appendChild(element("strong", "", currency(order.total_amount, order.currency)));
        card.appendChild(total);

        if (order.payment_status === "paid" && order.fulfillment_method === "delivery") {
            const freightArea = element("div", "account-order-invoice");
            if (order.freight_status === "paid") {
                freightArea.appendChild(element("p", "account-order-item-meta",
                    T.freightPaid + ": " + currency(order.freight_amount, order.currency)));
            } else if (order.freight_status === "quoted" || order.freight_status === "payment_pending") {
                freightArea.appendChild(element("p", "account-order-item-meta",
                    T.freightQuoted + ": " + currency(order.freight_amount, order.currency) +
                    (order.freight_valid_until ? " · " + dateLabel(order.freight_valid_until) : "")));
                const payFreight = element("button", "btn btn-secondary", T.freightPay);
                payFreight.type = "button";
                payFreight.addEventListener("click", () => {
                    window.location.href = "/en/payment-status?freight_quote_id=" +
                        encodeURIComponent(String(order.freight_quote_id || ""));
                });
                freightArea.appendChild(payFreight);
            } else {
                freightArea.appendChild(element("p", "account-order-item-meta", T.freightPending));
                freightArea.appendChild(element("p", "account-order-item-meta", T.freightPendingAmount));
            }
            card.appendChild(freightArea);
        }

        if (order.payment_status === "failed" && order.payment_failure_reason) {
            const failure = element("p", "account-order-failure-reason");
            failure.appendChild(element("strong", "", T.failureReason + ": "));
            failure.appendChild(document.createTextNode(String(order.payment_failure_reason)));
            card.appendChild(failure);
        }
        card.appendChild(renderItems(order));
        if (order.payment_status === "paid" && order.invoice_status) {
            const invoiceArea = element("div", "account-order-invoice");
            if (order.invoice_status === "issued" && order.invoice_number) {
                const download = element("button", "btn btn-secondary", T.invoice);
                download.type = "button";
                download.addEventListener("click", async () => {
                    const tab = window.open("about:blank", "_blank");
                    download.disabled = true;
                    try {
                        const result = await supabaseClient.functions.invoke("gst-invoice", {
                            body: { action: "download", order_id: order.gateway_order_id }
                        });
                        if (result.error || !result.data?.ok || !result.data?.signed_url) throw new Error(T.invoiceFailed);
                        if (tab) tab.location.href = result.data.signed_url;
                        else window.location.href = result.data.signed_url;
                    } catch {
                        if (tab) tab.close();
                        setMessage(T.invoiceFailed, "error");
                    } finally {
                        download.disabled = false;
                    }
                });
                invoiceArea.appendChild(download);
            } else {
                invoiceArea.appendChild(element("p", "account-order-item-meta", T.invoicePending));
            }
            card.appendChild(invoiceArea);
        }
        return card;
    }

    async function refreshAccountOrders() {
        if (!root) return;
        if (pendingRequest) return pendingRequest;

        pendingRequest = (async () => {
            if (loading) {
                loading.hidden = false;
                loading.textContent = T.loading;
            }
            if (empty) empty.hidden = true;
            root.hidden = true;
            root.replaceChildren();
            setMessage("", "");
            if (refreshButton) {
                refreshButton.disabled = true;
                refreshButton.textContent = T.loading;
            }

            try {
                if (typeof supabaseClient === "undefined" || !supabaseClient?.functions?.invoke) {
                    throw new Error("Account service unavailable");
                }
                const { data, error } = await supabaseClient.functions.invoke("account-orders", { body: {} });
                if (error || !data?.ok || !Array.isArray(data.orders)) {
                    throw new Error("Unable to load account orders");
                }
                if (loading) loading.hidden = true;
                if (!data.orders.length) {
                    if (empty) {
                        empty.replaceChildren(
                            element("p", "", T.noOrders),
                            element("p", "account-order-guest-note", T.guestNote)
                        );
                        empty.hidden = false;
                    }
                    return;
                }
                data.orders.forEach(order => root.appendChild(renderOrder(order)));
                root.hidden = false;
                const count = document.getElementById("accountDashboardOrderCount");
                if (count) count.textContent = String(data.orders.length);
            } catch {
                if (loading) loading.hidden = true;
                setMessage(T.loadFailed, "error");
                if (empty) empty.hidden = true;
                const retry = element("button", "btn btn-secondary account-order-retry", T.refresh);
                retry.type = "button";
                retry.addEventListener("click", () => refreshAccountOrders());
                root.replaceChildren(retry);
                root.hidden = false;
            } finally {
                if (refreshButton) {
                    refreshButton.disabled = false;
                    refreshButton.textContent = T.refresh;
                }
                pendingRequest = null;
            }
        })();
        return pendingRequest;
    }

    if (refreshButton) refreshButton.addEventListener("click", refreshAccountOrders);
    window.refreshAccountOrders = refreshAccountOrders;
})();
