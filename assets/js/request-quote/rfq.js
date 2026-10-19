/* request-quote.js module extracted from legacy section: rfq.js */

const RFQ_LANG =
    (window.souviks?.currentLanguage || document.documentElement.lang || "en").trim().toLowerCase();

const RFQ_TEXT = {
    en: { empty: "No items added yet.", decrease: "Decrease quantity", increase: "Increase quantity", remove: "Remove" },
    bn: { empty: "এখনও কোনো পণ্য যোগ করা হয়নি।", decrease: "পরিমাণ কমান", increase: "পরিমাণ বাড়ান", remove: "সরান" },
    hi: { empty: "अभी तक कोई आइटम नहीं जोड़ा गया है।", decrease: "मात्रा कम करें", increase: "मात्रा बढ़ाएँ", remove: "हटाएँ" }
};

const rfqText = RFQ_TEXT[RFQ_LANG] || RFQ_TEXT.en;

/* ==========================================================
   SOUVIKS — RFQ
   Shared RFQ Basket Engine

   AUTHENTICATED USERS:
       Supabase → rfq_cart_items

   ANONYMOUS USERS:
       localStorage → local RFQ basket

   Submission is handled separately by:
       assets/js/pages/rfq.js
       Account authenticated RFQ logic
   ========================================================== */


const RFQ_MESSAGE = {
    en: {
        emptySubmit: "Your RFQ basket is empty. Add at least one product before submitting.",
        namePhone: "Please enter your name and phone number.",
        unavailable: "Notification service is unavailable. Please try again later.",
        createdItems: ref => `Your RFQ was created as ${ref}, but its items could not be recorded. Please contact Souviks with this reference.`,
        notificationFailed: ref => `Your RFQ was recorded successfully as ${ref}, but the notification could not be sent. Please contact Souviks with this reference.`,
        submitting: "Submitting your RFQ…",
        success: ref => `RFQ submitted successfully. Reference: ${ref}`,
        failed: "Unable to submit your RFQ. Please try again.",
        rateLimited: "You have submitted several RFQs recently. Please wait a few minutes before trying again.",
        whatsappEmpty: "Your RFQ basket is empty. Add at least one product first."
    },
    bn: {
        emptySubmit: "আপনার RFQ ঝুড়ি খালি। জমা দেওয়ার আগে অন্তত একটি পণ্য যোগ করুন।",
        namePhone: "অনুগ্রহ করে আপনার নাম ও ফোন নম্বর লিখুন।",
        unavailable: "নোটিফিকেশন পরিষেবা বর্তমানে উপলব্ধ নয়। পরে আবার চেষ্টা করুন।",
        createdItems: ref => `আপনার RFQ ${ref} হিসেবে তৈরি হয়েছে, কিন্তু পণ্যগুলির তথ্য সংরক্ষণ করা যায়নি। এই রেফারেন্স দিয়ে Souviks-এর সঙ্গে যোগাযোগ করুন।`,
        notificationFailed: ref => `আপনার RFQ ${ref} হিসেবে সফলভাবে রেকর্ড হয়েছে, কিন্তু নোটিফিকেশন পাঠানো যায়নি। এই রেফারেন্স দিয়ে Souviks-এর সঙ্গে যোগাযোগ করুন।`,
        submitting: "আপনার RFQ জমা হচ্ছে…",
        success: ref => `RFQ সফলভাবে জমা হয়েছে। রেফারেন্স: ${ref}`,
        failed: "আপনার RFQ জমা দেওয়া যায়নি। আবার চেষ্টা করুন।",
        rateLimited: "আপনি সম্প্রতি একাধিক RFQ জমা দিয়েছেন। অনুগ্রহ করে কয়েক মিনিট পরে আবার চেষ্টা করুন।",
        whatsappEmpty: "আপনার RFQ ঝুড়ি খালি। আগে অন্তত একটি পণ্য যোগ করুন।"
    },
    hi: {
        emptySubmit: "आपका RFQ बास्केट खाली है। सबमिट करने से पहले कम से कम एक उत्पाद जोड़ें।",
        namePhone: "कृपया अपना नाम और फ़ोन नंबर दर्ज करें।",
        unavailable: "नोटिफिकेशन सेवा अभी उपलब्ध नहीं है। कृपया बाद में फिर प्रयास करें।",
        createdItems: ref => `आपका RFQ ${ref} के रूप में बनाया गया, लेकिन आइटम दर्ज नहीं किए जा सके। इस संदर्भ के साथ Souviks से संपर्क करें।`,
        notificationFailed: ref => `आपका RFQ ${ref} के रूप में सफलतापूर्वक दर्ज हुआ, लेकिन नोटिफिकेशन नहीं भेजा जा सका। इस संदर्भ के साथ Souviks से संपर्क करें।`,
        submitting: "आपका RFQ सबमिट हो रहा है…",
        success: ref => `RFQ सफलतापूर्वक सबमिट हो गया। संदर्भ: ${ref}`,
        failed: "आपका RFQ सबमिट नहीं किया जा सका। कृपया फिर प्रयास करें।",
        rateLimited: "आपने हाल ही में कई RFQ सबमिट किए हैं। कृपया कुछ मिनट बाद फिर प्रयास करें।",
        whatsappEmpty: "आपका RFQ बास्केट खाली है। पहले कम से कम एक उत्पाद जोड़ें।"
    }
};

const rfqMessages = RFQ_MESSAGE[RFQ_LANG] || RFQ_MESSAGE.en;

window.RFQ = {

    table:
        "rfq_cart_items",

    storageKey:
        "souviks_rfq_guest",

    messages: rfqMessages

};



RFQ.SUBMISSION_LIMITS = Object.freeze({
    maxItems: 50,
    maxQuantity: 9999,
    productId: 128,
    partNumber: 128,
    productName: 300,
    brand: 160,
    customerName: 120,
    customerPhone: 40,
    company: 160,
    gst: 15,
    message: 2000,
    email: 254,
    location: 200
});

const RFQ_UI_MESSAGES = {
    en: {
        added: "Product added to your RFQ basket.",
        addFailed: "Could not add this product to your RFQ basket. Please try again.",
        quantityFailed: "Could not update the RFQ quantity. Please try again.",
        removeFailed: "Could not remove this product from your RFQ basket. Please try again.",
        removeSuccess: "Product removed from your RFQ basket."
    },
    hi: {
        added: "उत्पाद आपके RFQ बास्केट में जोड़ दिया गया है।",
        addFailed: "उत्पाद RFQ बास्केट में नहीं जोड़ा जा सका। कृपया फिर प्रयास करें।",
        quantityFailed: "RFQ की मात्रा अपडेट नहीं हो सकी। कृपया फिर प्रयास करें।",
        removeFailed: "उत्पाद RFQ बास्केट से हटाया नहीं जा सका। कृपया फिर प्रयास करें।",
        removeSuccess: "उत्पाद RFQ बास्केट से हटा दिया गया है।"
    },
    bn: {
        added: "পণ্যটি আপনার RFQ ঝুড়িতে যোগ করা হয়েছে।",
        addFailed: "পণ্যটি RFQ ঝুড়িতে যোগ করা যায়নি। আবার চেষ্টা করুন।",
        quantityFailed: "RFQ-এর পরিমাণ আপডেট করা যায়নি। আবার চেষ্টা করুন।",
        removeFailed: "পণ্যটি RFQ ঝুড়ি থেকে সরানো যায়নি। আবার চেষ্টা করুন।",
        removeSuccess: "পণ্যটি RFQ ঝুড়ি থেকে সরানো হয়েছে।"
    }
};

RFQ.showActionStatus = function (anchor, messageKey, type = "error") {
    const language = String(
        document.documentElement.lang ||
        window.souviks?.currentLanguage ||
        "en"
    ).slice(0, 2).toLowerCase();
    const dictionary = RFQ_UI_MESSAGES[language] || RFQ_UI_MESSAGES.en;
    const message = dictionary[messageKey] || RFQ_UI_MESSAGES.en[messageKey] || "";
    if (!message) return;

    const control = anchor instanceof Element ? anchor : null;
    const card = control?.closest(".product-card");
    const pdpActions = control?.closest(".pdp-actions");
    const basketBody = control?.closest("#rfq-items");
    let host = null;
    let insertAfter = null;

    if (card) {
        host = card.querySelector(".product-content") || card;
    } else if (pdpActions) {
        host = pdpActions;
    } else if (basketBody) {
        insertAfter = basketBody.closest("table");
        host = insertAfter?.parentElement || basketBody.parentElement;
    } else {
        host = control?.closest("#rfq-form") ||
            document.getElementById("rfq-form") ||
            document.querySelector("main") ||
            document.body;
    }
    if (!host) return;

    let status = host.querySelector(":scope > .rfq-inline-status");
    if (!status) {
        status = document.createElement("div");
        status.className = "form-status rfq-inline-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
    }
    status.textContent = message;
    status.className = "form-status rfq-inline-status";
    if (type) status.classList.add(type);

    if (insertAfter && status.previousElementSibling !== insertAfter) {
        insertAfter.insertAdjacentElement("afterend", status);
    } else if (status.parentElement !== host) {
        host.appendChild(status);
    }
};

RFQ.submissionMessage = function (key) {
    const messages = {
        en: {
            empty: "Your RFQ basket is empty. Add at least one product.",
            tooMany: "An RFQ can contain at most 50 different products.",
            duplicate: "Your RFQ contains duplicate products. Remove duplicates and try again.",
            quantity: "Each quantity must be a whole number from 1 to 9,999.",
            product: "One or more products have invalid details. Refresh the basket and try again.",
            customer: "Please enter your name and phone number.",
            fieldLength: "One or more fields exceed the permitted length."
        },
        hi: {
            empty: "आपका RFQ बास्केट खाली है। कम से कम एक उत्पाद जोड़ें।",
            tooMany: "एक RFQ में अधिकतम 50 अलग-अलग उत्पाद हो सकते हैं।",
            duplicate: "आपके RFQ में डुप्लिकेट उत्पाद हैं। उन्हें हटाकर फिर प्रयास करें।",
            quantity: "प्रत्येक मात्रा 1 से 9,999 के बीच पूर्ण संख्या होनी चाहिए।",
            product: "एक या अधिक उत्पादों का विवरण अमान्य है। बास्केट रीफ़्रेश करके फिर प्रयास करें।",
            customer: "कृपया अपना नाम और फ़ोन नंबर दर्ज करें।",
            fieldLength: "एक या अधिक फ़ील्ड अनुमत लंबाई से अधिक हैं।"
        },
        bn: {
            empty: "আপনার RFQ ঝুড়ি খালি। অন্তত একটি পণ্য যোগ করুন।",
            tooMany: "একটি RFQ-তে সর্বাধিক ৫০টি আলাদা পণ্য থাকতে পারে।",
            duplicate: "আপনার RFQ-তে একই পণ্য একাধিকবার আছে। ডুপ্লিকেট সরিয়ে আবার চেষ্টা করুন।",
            quantity: "প্রতিটি পরিমাণ ১ থেকে ৯,৯৯৯-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।",
            product: "এক বা একাধিক পণ্যের বিবরণ অবৈধ। ঝুড়ি রিফ্রেশ করে আবার চেষ্টা করুন।",
            customer: "অনুগ্রহ করে আপনার নাম ও ফোন নম্বর লিখুন।",
            fieldLength: "এক বা একাধিক ফিল্ড অনুমোদিত দৈর্ঘ্যের বেশি।"
        }
    };
    const language = String(
        window.souviks?.currentLanguage ||
        document.documentElement.lang ||
        "en"
    ).slice(0, 2).toLowerCase();
    return (messages[language] || messages.en)[key] || messages.en.product;
};

RFQ.validateSubmissionItems = function (items) {
    const limits = RFQ.SUBMISSION_LIMITS;
    const message = key => RFQ.submissionMessage(key);

    if (!Array.isArray(items) || items.length === 0) {
        throw new Error(message("empty"));
    }
    if (items.length > limits.maxItems) {
        throw new Error(message("tooMany"));
    }

    const asText = value =>
        typeof value === "string" || typeof value === "number"
            ? String(value).trim()
            : "";
    const seenIds = new Set();

    return items.map(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new Error(message("product"));
        }

        const id = asText(item.id);
        const partNumber = asText(item.partNumber);
        const name = asText(item.name);
        const brand = asText(item.brand);

        if (
            !id ||
            id.length > limits.productId ||
            !name ||
            name.length > limits.productName ||
            partNumber.length > limits.partNumber ||
            brand.length > limits.brand
        ) {
            throw new Error(message("product"));
        }
        if (seenIds.has(id)) {
            throw new Error(message("duplicate"));
        }
        seenIds.add(id);

        const quantityText = asText(item.qty ?? item.quantity);
        if (!/^[0-9]{1,4}$/.test(quantityText)) {
            throw new Error(message("quantity"));
        }
        const quantity = Number(quantityText);
        if (
            !Number.isSafeInteger(quantity) ||
            quantity < 1 ||
            quantity > limits.maxQuantity
        ) {
            throw new Error(message("quantity"));
        }

        return { id, partNumber, name, brand, qty: quantity, quantity };
    });
};

RFQ.validateSubmissionCustomer = function (customer = {}) {
    const limits = RFQ.SUBMISSION_LIMITS;
    const asText = value =>
        typeof value === "string" || typeof value === "number"
            ? String(value).trim()
            : "";
    const result = {
        name: asText(customer.name),
        phone: asText(customer.phone),
        company: asText(customer.company),
        gst: asText(customer.gst).toUpperCase(),
        message: asText(customer.message),
        email: asText(customer.email),
        location: asText(customer.location)
    };

    if (!result.name || !result.phone) {
        throw new Error(RFQ.submissionMessage("customer"));
    }
    if (
        result.name.length > limits.customerName ||
        result.phone.length > limits.customerPhone ||
        result.company.length > limits.company ||
        result.gst.length > limits.gst ||
        result.message.length > limits.message ||
        result.email.length > limits.email ||
        result.location.length > limits.location
    ) {
        throw new Error(RFQ.submissionMessage("fieldLength"));
    }
    return result;
};


/*
----------------------------------------------------------
GET CURRENT USER
----------------------------------------------------------
*/

RFQ.getUser = async function () {

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        return null;

    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getUser();


        if (error) {

            if (error?.name === "AuthSessionMissingError") {
                return null;
            }

            SouviksErrors?.log("[Souviks RFQ] Unable to get authenticated user:", error, "error");

            return null;

        }


        return data?.user || null;


    } catch (error) {

        if (error?.name !== "AuthSessionMissingError") {
            SouviksErrors?.log("[Souviks RFQ] Unexpected authentication error:", error, "error");
        }

        return null;

    }

};


/*
----------------------------------------------------------
HTML ESCAPE
----------------------------------------------------------

Prevents product data from being interpreted as HTML
when rendered into the RFQ table.
----------------------------------------------------------
*/

RFQ.escapeHTML = function (
    value
) {

    const text =
        String(
            value ?? ""
        );


    return text.replace(
        /[&<>"']/g,
        character => {

            const entities = {

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"

            };


            return entities[
                character
            ];

        }
    );

};


/*
----------------------------------------------------------
GET GUEST ITEMS
----------------------------------------------------------
*/

RFQ.getGuestItems = function () {

    try {

        const stored =
            localStorage.getItem(
                RFQ.storageKey
            );


        if (!stored) {

            return [];

        }


        const parsed =
            JSON.parse(
                stored
            );


        if (
            !Array.isArray(
                parsed
            )
        ) {

            return [];

        }


        return parsed.map(

            item => ({

                id:
                    item.id,

                rowId:
                    null,

                partNumber:
                    item.partNumber || "",

                name:
                    item.name || "",

                brand:
                    item.brand || "",

                qty:
                    Math.max(
                        1,
                        Number(
                            item.qty
                        ) || 1
                    )

            })

        );


    } catch (error) {

        SouviksErrors?.log("[Souviks RFQ] Unable to read guest RFQ basket:", error, "error");

        return [];

    }

};


/*
----------------------------------------------------------
SAVE GUEST ITEMS
----------------------------------------------------------
*/

RFQ.saveGuestItems = function (
    items
) {

    try {

        localStorage.setItem(

            RFQ.storageKey,

            JSON.stringify(
                items
            )

        );


        return true;


    } catch (error) {

        SouviksErrors?.log("[Souviks RFQ] Unable to save guest RFQ basket:", error, "error");

        return false;

    }

};


/*
----------------------------------------------------------
GET RFQ ITEMS
----------------------------------------------------------

Authenticated:
    Supabase rfq_cart_items

Anonymous:
    localStorage

Returns the same frontend structure in both cases:

    {
        id,
        rowId,
        partNumber,
        name,
        brand,
        qty
    }
----------------------------------------------------------
*/

RFQ.get = async function () {

    const user =
        await RFQ.getUser();


    /*
    ------------------------------------------------------
    ANONYMOUS
    ------------------------------------------------------
    */

    if (!user) {

        return RFQ.getGuestItems();

    }


    /*
    ------------------------------------------------------
    AUTHENTICATED
    ------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks RFQ] Supabase client unavailable."
        );

        return [];

    }


    const {
        data,
        error
    } =
        await supabaseClient

            .from(
                RFQ.table
            )

            .select(
                "id, user_id, product_id, part_number, product_name, brand, quantity, created_at, updated_at"
            )

            .eq(
                "user_id",
                user.id
            )

            .order(
                "created_at",
                {
                    ascending:
                        true
                }
            );


    if (error) {

        SouviksErrors?.log("[Souviks RFQ] Unable to load RFQ basket:", error, "error");

        return [];

    }


    return (
        data || []
    ).map(

        item => ({

            id:
                item.product_id,

            rowId:
                item.id,

            partNumber:
                item.part_number,

            name:
                item.product_name,

            brand:
                item.brand,

            qty:
                Number(
                    item.quantity ||
                    0
                )

        })

    );

};


/*
----------------------------------------------------------
UPDATE RFQ BADGE
----------------------------------------------------------
*/

RFQ.updateBadge = async function () {

    const items =
        await RFQ.get();


    const total =
        items.reduce(

            (
                sum,
                item
            ) =>

                sum +
                Number(
                    item.qty ||
                    0
                ),

            0

        );


    document
        .querySelectorAll(
            ".rfq-badge"
        )
        .forEach(

            badge => {

                badge.textContent =
                    total;

            }

        );


    return total;

};


/*
----------------------------------------------------------
SET PRODUCT QUANTITY
----------------------------------------------------------

Authenticated:
    UPDATE / INSERT in Supabase

Anonymous:
    UPDATE / INSERT in localStorage
----------------------------------------------------------
*/

RFQ.setQuantity = async function (

    productId,
    product,
    quantity

) {

    const qty = Number(quantity);

    if (
        !Number.isSafeInteger(qty) ||
        qty < 1 ||
        qty > RFQ.SUBMISSION_LIMITS.maxQuantity
    ) {
        SouviksErrors?.log(
            "[Souviks RFQ] Rejected quantity outside the permitted range.",
            new Error("Quantity must be an integer from 1 to 9999."),
            "warn"
        );
        return false;
    }


    const user =
        await RFQ.getUser();


    /*
    ------------------------------------------------------
    ANONYMOUS
    ------------------------------------------------------
    */

    if (!user) {

        const items =
            RFQ.getGuestItems();


        const existingIndex =
            items.findIndex(

                item =>
                    item.id ===
                    productId

            );

        if (
            existingIndex < 0 &&
            items.length >= RFQ.SUBMISSION_LIMITS.maxItems
        ) {
            return false;
        }


        const normalizedProduct = {

            id:
                productId,

            rowId:
                null,

            partNumber:
                product?.partNumber ||
                "",

            name:
                product?.name ||
                "",

            brand:
                product?.brand ||
                "",

            qty

        };


        if (
            existingIndex >=
            0
        ) {

            items[
                existingIndex
            ] =
                normalizedProduct;

        } else {

            items.push(
                normalizedProduct
            );

        }


        const saved =
            RFQ.saveGuestItems(
                items
            );


        if (!saved) {

            return false;

        }


        await RFQ.refreshUI();


        return true;

    }


    /*
    ------------------------------------------------------
    AUTHENTICATED
    ------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks RFQ] Supabase client unavailable."
        );

        return false;

    }


    /*
    ------------------------------------------------------
    FIND EXISTING PRODUCT
    ------------------------------------------------------
    */

    const {
        data: existing,
        error: findError
    } =
        await supabaseClient

            .from(
                RFQ.table
            )

            .select(
                "id, quantity"
            )

            .eq(
                "user_id",
                user.id
            )

            .eq(
                "product_id",
                productId
            )

            .maybeSingle();


    if (findError) {

        SouviksErrors?.log("[Souviks RFQ] Unable to find RFQ product:", findError, "error");

        return false;

    }

    if (!existing) {
        const { count, error: countError } = await supabaseClient
            .from(RFQ.table)
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);

        if (countError) {
            SouviksErrors?.log(
                "[Souviks RFQ] Unable to validate RFQ basket item count:",
                countError,
                "error"
            );
            return false;
        }
        if (Number(count) >= RFQ.SUBMISSION_LIMITS.maxItems) {
            return false;
        }
    }


    /*
    ------------------------------------------------------
    UPDATE EXISTING PRODUCT
    ------------------------------------------------------
    */

    if (existing) {

        const {
            error
        } =
            await supabaseClient

                .from(
                    RFQ.table
                )

                .update({

                    quantity:
                        qty

                })

                .eq(
                    "id",
                    existing.id
                )

                .eq(
                    "user_id",
                    user.id
                );


        if (error) {

            SouviksErrors?.log("[Souviks RFQ] Unable to update RFQ quantity:", error, "error");

            return false;

        }

    }


    /*
    ------------------------------------------------------
    INSERT NEW PRODUCT
    ------------------------------------------------------
    */

    else {

        const {
            error
        } =
            await supabaseClient

                .from(
                    RFQ.table
                )

                .insert({

                    user_id:
                        user.id,

                    product_id:
                        productId,

                    part_number:
                        product?.partNumber ||
                        "",

                    product_name:
                        product?.name ||
                        "",

                    brand:
                        product?.brand ||
                        "",

                    quantity:
                        qty

                });


        if (error) {

            SouviksErrors?.log("[Souviks RFQ] Unable to insert RFQ product:", error, "error");

            return false;

        }

    }


    await RFQ.refreshUI();


    return true;

};


/*
----------------------------------------------------------
ADD PRODUCT
----------------------------------------------------------

Used by product cards and product detail pages.
----------------------------------------------------------
*/

RFQ.add = async function (
    product
) {
    if (!product || !product.id) {
        console.error("[Souviks RFQ] Invalid product supplied to RFQ.add().");
        return false;
    }

    const items = await RFQ.get();
    const existing = items.find(item => item.id === product.id);

    if (!existing && items.length >= RFQ.SUBMISSION_LIMITS.maxItems) {
        SouviksErrors?.log(
            "[Souviks RFQ] RFQ basket item limit reached.",
            new Error("An RFQ can contain at most 50 different products."),
            "warn"
        );
        return false;
    }

    const saved = await RFQ.setQuantity(
        product.id,
        product,
        existing ? Number(existing.qty) + 1 : 1
    );

    if (saved) {
        window.souviksAnalytics?.trackEvent("add_to_rfq", {
            product_id: String(product.id || "").slice(0, 128),
            part_number: String(product.partNumber || product.part_number || "").slice(0, 128),
            brand: String(product.brand || product.brand_name || "").slice(0, 120),
            item_count: items.length + (existing ? 0 : 1)
        });
    }

    return saved;
};

/*
----------------------------------------------------------
ADD TO RFQ — PRODUCT CARD
----------------------------------------------------------
*/

/* RFQ item actions always report a confirmed write result. */
document.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest(".add-to-cart") : null;
    if (!button) return;
    event.preventDefault();
    if (button.disabled) return;

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    RFQ.add({
        id: button.dataset.id,
        partNumber: button.dataset.part,
        name: button.dataset.name,
        brand: button.dataset.brand
    })
        .then(added => {
            if (added) {
                button.textContent = "Added";
                RFQ.showActionStatus(button, "added", "success");
            } else {
                RFQ.showActionStatus(button, "addFailed");
            }
        })
        .catch(error => {
            SouviksErrors?.log("[Souviks RFQ] Add-to-RFQ error:", error, "error");
            RFQ.showActionStatus(button, "addFailed");
        })
        .finally(() => {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        });
});


/*
----------------------------------------------------------
RENDER RFQ PAGE
----------------------------------------------------------
*/

RFQ.renderPage = async function () {

    const table =
        document.getElementById(
            "rfq-items"
        );


    if (!table) {

        return;

    }


    const items =
        await RFQ.get();


    if (!items.length) {

        table.innerHTML = `

            <tr>

                <td colspan="5">

                    ${rfqText.empty}

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =

        items.map(

            item => {

                const id =
                    RFQ.escapeHTML(
                        item.id
                    );

                const partNumber =
                    RFQ.escapeHTML(
                        item.partNumber
                    );

                const name =
                    RFQ.escapeHTML(
                        item.name
                    );

                const brand =
                    RFQ.escapeHTML(
                        item.brand
                    );

                const qty =
                    Math.max(
                        1,
                        Number(
                            item.qty
                        ) || 1
                    );


                return `

                    <tr>

                        <td>

                            ${partNumber}

                        </td>

                        <td>

                            ${name}

                        </td>

                        <td>

                            ${brand}

                        </td>

                        <td>

                            <div class="rfq-qty">

                                <button
                                    type="button"
                                    class="qty-minus"
                                    data-id="${id}"
                                    aria-label="${rfqText.decrease}"
                                >

                                    -

                                </button>


                                <span>

                                    ${qty}

                                </span>


                                <button
                                    type="button"
                                    class="qty-plus"
                                    data-id="${id}"
                                    aria-label="${rfqText.increase}"
                                >

                                    +

                                </button>

                            </div>

                        </td>

                        <td>

                            <button
                                type="button"
                                class="remove-rfq"
                                data-id="${id}"
                            >

                                ${rfqText.remove}

                            </button>

                        </td>

                    </tr>

                `;

            }

        ).join("");

};


/*
----------------------------------------------------------
CHANGE QUANTITY
----------------------------------------------------------
*/

RFQ.refreshUI = async function () {
    try {
        await RFQ.updateBadge();
    } catch (error) {
        SouviksErrors?.log("[Souviks RFQ] Unable to refresh RFQ badge:", error, "warn");
    }
    try {
        await RFQ.renderPage();
    } catch (error) {
        SouviksErrors?.log("[Souviks RFQ] Unable to refresh RFQ page:", error, "warn");
    }
};

RFQ.changeQty = async function (

    productId,
    amount

) {

    const items =
        await RFQ.get();


    const item =
        items.find(

            entry =>
                String(
                    entry.id
                ) ===
                String(
                    productId
                )

        );


    if (!item) {

        return false;

    }


    const newQuantity =
        Number(
            item.qty
        ) +
        Number(
            amount
        );


    /*
    ------------------------------------------------------
    REMOVE WHEN QUANTITY REACHES ZERO
    ------------------------------------------------------
    */

    if (newQuantity <= 0) return await RFQ.remove(productId);

    if (
        !Number.isSafeInteger(newQuantity) ||
        newQuantity > RFQ.SUBMISSION_LIMITS.maxQuantity
    ) {
        SouviksErrors?.log(
            "[Souviks RFQ] Rejected quantity change outside the permitted range.",
            new Error("Quantity must be an integer from 1 to 9999."),
            "warn"
        );
        return false;
    }

    /*
    ------------------------------------------------------
    ANONYMOUS
    ------------------------------------------------------
    */

    const user =
        await RFQ.getUser();


    if (!user) {

        const guestItems =
            RFQ.getGuestItems();


        const guestIndex =
            guestItems.findIndex(

                entry =>
                    String(
                        entry.id
                    ) ===
                    String(
                        productId
                    )

            );


        if (
            guestIndex <
            0
        ) {

            return false;

        }


        guestItems[
            guestIndex
        ].qty =
            newQuantity;


        if (!RFQ.saveGuestItems(guestItems)) return false;
        await RFQ.refreshUI();
        return true;

    }


    /*
    ------------------------------------------------------
    AUTHENTICATED
    ------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        return false;

    }


    const {
        data: dbItem,
        error: findError
    } =
        await supabaseClient

            .from(
                RFQ.table
            )

            .select(
                "id, quantity"
            )

            .eq(
                "user_id",
                user.id
            )

            .eq(
                "product_id",
                productId
            )

            .maybeSingle();


    if (findError) {

        SouviksErrors?.log("[Souviks RFQ] Unable to find RFQ item:", findError, "error");

        return false;

    }


    if (!dbItem) {

        return false;

    }


    const {
        error: updateError
    } =
        await supabaseClient

            .from(
                RFQ.table
            )

            .update({

                quantity:
                    newQuantity

            })

            .eq(
                "id",
                dbItem.id
            )

            .eq(
                "user_id",
                user.id
            );


    if (updateError) {

        SouviksErrors?.log("[Souviks RFQ] Unable to update RFQ quantity:", updateError, "error");

        return false;

    }


    await RFQ.refreshUI();

};


/*
----------------------------------------------------------
REMOVE PRODUCT
----------------------------------------------------------
*/

RFQ.remove = async function (

    productId

) {

    const user =
        await RFQ.getUser();


    /*
    ------------------------------------------------------
    ANONYMOUS
    ------------------------------------------------------
    */

    if (!user) {

        const items =
            RFQ.getGuestItems();


        const filtered =
            items.filter(

                item =>
                    String(
                        item.id
                    ) !==
                    String(
                        productId
                    )

            );


        if (!RFQ.saveGuestItems(filtered)) return false;
        await RFQ.refreshUI();
        return true;

    }


    /*
    ------------------------------------------------------
    AUTHENTICATED
    ------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        return false;

    }


    const {
        error
    } =
        await supabaseClient

            .from(
                RFQ.table
            )

            .delete()

            .eq(
                "user_id",
                user.id
            )

            .eq(
                "product_id",
                productId
            );


    if (error) {

        SouviksErrors?.log("[Souviks RFQ] Unable to remove RFQ item:", error, "error");

        return false;

    }


    await RFQ.refreshUI();

};


/*
----------------------------------------------------------
CLEAR RFQ BASKET
----------------------------------------------------------

Authenticated:
    Deletes only the current user's rows.

Anonymous:
    Clears only the Souviks guest RFQ localStorage key.
----------------------------------------------------------
*/

RFQ.clear = async function () {

    const user =
        await RFQ.getUser();


    /*
    ------------------------------------------------------
    ANONYMOUS
    ------------------------------------------------------
    */

    if (!user) {

        try {

            localStorage.removeItem(
                RFQ.storageKey
            );

        } catch (error) {

            SouviksErrors?.log("[Souviks RFQ] Unable to clear guest RFQ basket:", error, "error");
            return false;
        }


        await RFQ.refreshUI();


        return true;

    }


    /*
    ------------------------------------------------------
    AUTHENTICATED
    ------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks RFQ] Supabase client unavailable."
        );

        return false;

    }


    const {
        error
    } =
        await supabaseClient

            .from(
                RFQ.table
            )

            .delete()

            .eq(
                "user_id",
                user.id
            );


    if (error) {

        SouviksErrors?.log("[Souviks RFQ] Unable to clear RFQ basket:", error, "error");

        return false;

    }


    await RFQ.refreshUI();


    return true;

};


/*
----------------------------------------------------------
MERGE GUEST BASKET
----------------------------------------------------------

When an anonymous visitor signs in, move the guest
basket into the authenticated Supabase basket.

If the same product already exists in the account basket,
quantities are combined.
----------------------------------------------------------
*/

RFQ.mergeGuestBasket = async function () {

    const user =
        await RFQ.getUser();


    if (!user) {

        return;

    }


    const guestItems =
        RFQ.getGuestItems();


    if (!guestItems.length) {

        return;

    }


    for (
        const item
        of guestItems
    ) {

        try {

            const {
                data: existing,
                error
            } =
                await supabaseClient

                    .from(
                        RFQ.table
                    )

                    .select(
                        "id, quantity"
                    )

                    .eq(
                        "user_id",
                        user.id
                    )

                    .eq(
                        "product_id",
                        item.id
                    )

                    .maybeSingle();


            if (error) {

                SouviksErrors?.log("[Souviks RFQ] Unable to check guest basket item:", error, "error");

                continue;

            }


            if (existing) {

                const {
                    error:
                        updateError
                } =
                    await supabaseClient

                        .from(
                            RFQ.table
                        )

                        .update({

                            quantity:
                                Number(
                                    existing.quantity ||
                                    0
                                ) +
                                Number(
                                    item.qty ||
                                    0
                                )

                        })

                        .eq(
                            "id",
                            existing.id
                        )

                        .eq(
                            "user_id",
                            user.id
                        );


                if (updateError) {

                    SouviksErrors?.log("[Souviks RFQ] Unable to merge guest RFQ item:", updateError, "error");

                }

            } else {

                const {
                    error:
                        insertError
                } =
                    await supabaseClient

                        .from(
                            RFQ.table
                        )

                        .insert({

                            user_id:
                                user.id,

                            product_id:
                                item.id,

                            part_number:
                                item.partNumber,

                            product_name:
                                item.name,

                            brand:
                                item.brand,

                            quantity:
                                item.qty

                        });


                if (insertError) {

                    SouviksErrors?.log("[Souviks RFQ] Unable to import guest RFQ item:", insertError, "error");

                }

            }

        } catch (error) {

            SouviksErrors?.log("[Souviks RFQ] Unexpected guest RFQ merge error:", error, "error");

        }

    }


    /*
    ------------------------------------------------------
    CLEAR GUEST BASKET ONLY AFTER MERGE ATTEMPT
    ------------------------------------------------------
    */

    try {

        localStorage.removeItem(
            RFQ.storageKey
        );

    } catch (error) {

        SouviksErrors?.log("[Souviks RFQ] Unable to clear guest RFQ storage:", error, "error");

    }


    await RFQ.refreshUI();

};


/*
----------------------------------------------------------
RFQ PAGE BUTTONS
----------------------------------------------------------
*/

/* Basket actions are serialized per control and report failures. */
document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const plus = target?.closest(".qty-plus");
    const minus = target?.closest(".qty-minus");
    const remove = target?.closest(".remove-rfq");
    const control = plus || minus || remove;
    if (!control || control.disabled) return;
    event.preventDefault();

    control.disabled = true;
    control.setAttribute("aria-busy", "true");
    let operation;
    let failureKey;
    if (plus) {
        operation = RFQ.changeQty(plus.dataset.id, 1);
        failureKey = "quantityFailed";
    } else if (minus) {
        operation = RFQ.changeQty(minus.dataset.id, -1);
        failureKey = "quantityFailed";
    } else {
        operation = RFQ.remove(remove.dataset.id);
        failureKey = "removeFailed";
    }

    Promise.resolve(operation)
        .then(result => {
            if (result === false || result === undefined) {
                RFQ.showActionStatus(control, failureKey);
            } else if (remove) {
                RFQ.showActionStatus(control, "removeSuccess", "success");
            }
        })
        .catch(error => {
            SouviksErrors?.log("[Souviks RFQ] Basket action failed:", error, "error");
            RFQ.showActionStatus(control, failureKey);
        })
        .finally(() => {
            control.disabled = false;
            control.removeAttribute("aria-busy");
        });
});


/*
----------------------------------------------------------
INITIAL RFQ STATE
----------------------------------------------------------
*/

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        await RFQ.refreshUI();

    }

);


/*
----------------------------------------------------------
AUTH STATE CHANGES
----------------------------------------------------------

The shared site core owns the only Supabase auth-state
subscription. This page listens to its application event.
----------------------------------------------------------
*/

document.addEventListener("souviks:auth-state", async event => {
    const authEvent = event.detail?.event;

    if (authEvent === "SIGNED_IN") {
        await RFQ.mergeGuestBasket();
        await RFQ.refreshUI();
        return;
    }

    if (authEvent === "SIGNED_OUT") {
        await RFQ.refreshUI();
    }
});
