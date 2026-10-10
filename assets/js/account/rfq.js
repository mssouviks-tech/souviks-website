/* Extracted from the former account.js bundle: rfq.js */

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


window.RFQ = {

    table:
        "rfq_cart_items",

    storageKey:
        "souviks_rfq_guest"

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

            SouviksErrors?.log("[Souviks RFQ] Unable to get authenticated user:", error, "error");

            return null;

        }


        return data?.user || null;


    } catch (error) {

        SouviksErrors?.log("[Souviks RFQ] Unexpected authentication error:", error, "error");

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


        await RFQ.updateBadge();

        await RFQ.renderPage();


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


    await RFQ.updateBadge();

    await RFQ.renderPage();


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

    if (
        !product ||
        !product.id
    ) {

        console.error(
            "[Souviks RFQ] Invalid product supplied to RFQ.add()."
        );

        return false;

    }


    const items =
        await RFQ.get();


    const existing =
        items.find(

            item =>
                item.id ===
                product.id

        );


    if (!existing && items.length >= RFQ.SUBMISSION_LIMITS.maxItems) {
        SouviksErrors?.log(
            "[Souviks RFQ] RFQ basket item limit reached.",
            new Error("An RFQ can contain at most 50 different products."),
            "warn"
        );
        return false;
    }

    if (existing) {

        return RFQ.setQuantity(

            product.id,

            product,

            Number(existing.qty) + 1

        );

    }


    return RFQ.setQuantity(

        product.id,

        product,

        1

    );

};


/*
----------------------------------------------------------
ADD TO RFQ — PRODUCT CARD
----------------------------------------------------------
*/

document.addEventListener(

    "click",

    event => {

        const button =
            event.target.closest(
                ".add-to-cart"
            );


        if (!button) {

            return;

        }


        event.preventDefault();


        RFQ.add({

            id:
                button.dataset.id,

            partNumber:
                button.dataset.part,

            name:
                button.dataset.name,

            brand:
                button.dataset.brand

        })

        .then(

            added => {

                if (added) {

                    button.textContent =
                        "Added";

                }

            }

        )

        .catch(

            error => {

                SouviksErrors?.log("[Souviks RFQ] Add-to-RFQ error:", error, "error");

            }

        );

    }

);


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

                    RFQ Basket Empty

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
                                    aria-label="Decrease quantity"
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
                                    aria-label="Increase quantity"
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

                                Remove

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

        return;

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

    if (
        newQuantity <=
        0
    ) {

        await RFQ.remove(
            productId
        );

        return;

    }

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

            return;

        }


        guestItems[
            guestIndex
        ].qty =
            newQuantity;


        RFQ.saveGuestItems(
            guestItems
        );


        await RFQ.updateBadge();

        await RFQ.renderPage();


        return;

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

        return;

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

        return;

    }


    if (!dbItem) {

        return;

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

        return;

    }


    await RFQ.updateBadge();

    await RFQ.renderPage();

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


        RFQ.saveGuestItems(
            filtered
        );


        await RFQ.updateBadge();

        await RFQ.renderPage();


        return;

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

        return;

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

        return;

    }


    await RFQ.updateBadge();

    await RFQ.renderPage();

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

        }


        await RFQ.updateBadge();

        await RFQ.renderPage();


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


    await RFQ.updateBadge();

    await RFQ.renderPage();


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


    await RFQ.updateBadge();

    await RFQ.renderPage();

};


/*
----------------------------------------------------------
RFQ PAGE BUTTONS
----------------------------------------------------------
*/

document.addEventListener(

    "click",

    event => {

        const plus =
            event.target.closest(
                ".qty-plus"
            );


        if (plus) {

            event.preventDefault();


            RFQ.changeQty(

                plus.dataset.id,

                1

            );


            return;

        }


        const minus =
            event.target.closest(
                ".qty-minus"
            );


        if (minus) {

            event.preventDefault();


            RFQ.changeQty(

                minus.dataset.id,

                -1

            );


            return;

        }


        const remove =
            event.target.closest(
                ".remove-rfq"
            );


        if (remove) {

            event.preventDefault();


            RFQ.remove(

                remove.dataset.id

            );

        }

    }

);


/*
----------------------------------------------------------
INITIAL RFQ STATE
----------------------------------------------------------
*/

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        await RFQ.updateBadge();

        await RFQ.renderPage();

    }

);


/*
----------------------------------------------------------
AUTH STATE CHANGES
----------------------------------------------------------

The shared site core owns the Supabase subscription. This bundle listens for
its normalized event and performs only page-specific RFQ refresh work.
----------------------------------------------------------
*/

document.addEventListener(
    "souviks:auth-state",
    event => {
        const authEvent = event?.detail?.event;

        if (authEvent === "SIGNED_IN") {
            setTimeout(async () => {
                await RFQ.mergeGuestBasket();
                await RFQ.updateBadge();
                await RFQ.renderPage();
            }, 0);
            return;
        }

        if (authEvent === "SIGNED_OUT") {
            setTimeout(async () => {
                await RFQ.updateBadge();
                await RFQ.renderPage();
            }, 0);
        }
    }
);
