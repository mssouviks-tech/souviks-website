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
        failed: "Your RFQ could not be submitted. Please try again.",
        whatsappEmpty: "Your RFQ basket is empty. Add at least one product first.",
        basketClearFailed: "Your RFQ was submitted, but the basket could not be cleared from this browser. Check the reference before submitting again."
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
        whatsappEmpty: "আপনার RFQ ঝুড়ি খালি। আগে অন্তত একটি পণ্য যোগ করুন।",
        basketClearFailed: "আপনার RFQ জমা হয়েছে, কিন্তু ব্রাউজার থেকে ঝুড়ি খালি করা যায়নি। আবার জমা দেওয়ার আগে রেফারেন্সটি যাচাই করুন."
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
        whatsappEmpty: "आपका RFQ बास्केट खाली है। पहले कम से कम एक उत्पाद जोड़ें।",
        basketClearFailed: "आपका RFQ जमा हो गया, लेकिन ब्राउज़र से बास्केट खाली नहीं हो सका। दोबारा जमा करने से पहले संदर्भ जाँच लें."
    }
};

const rfqMessage = RFQ_MESSAGE[RFQ_LANG] || RFQ_MESSAGE.en;

window.RFQ = {

    table:
        "rfq_cart_items",

    storageKey:
        "souviks_rfq_guest"

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

    const qty =
        Math.max(
            1,
            Number(
                quantity
            ) || 1
        );


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
                    String(item.id) === String(productId)

            );


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
                    String(item.id) === String(product.id)

        );


    if (existing) {

        return RFQ.setQuantity(

            product.id,

            product,

            existing.qty + 1

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

RFQ.renderGuestMergeWarning = async function (table) {
    table.querySelector("#rfq-merge-warning")?.remove();
    const user = await RFQ.getUser();
    const remainingGuestItems = RFQ.getGuestItems();
    if (!user || !remainingGuestItems.length) return;

    const row = document.createElement("tr");
    row.id = "rfq-merge-warning";
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.setAttribute("role", "alert");
    cell.textContent =
        `${remainingGuestItems.length} guest RFQ item(s) could not be transferred to your account. They remain saved in this browser. Please retry after checking your connection.`;
    row.appendChild(cell);
    table.appendChild(row);
};

RFQ.renderPage = async function () {
    const table = document.getElementById("rfq-items");
    if (!table) return;

    const items = await RFQ.get();
    if (!items.length) {
        table.innerHTML = '<tr><td colspan="5">RFQ Basket Empty</td></tr>';
        await RFQ.renderGuestMergeWarning(table);
        return;
    }

    table.innerHTML = items.map(item => {
        const id = RFQ.escapeHTML(item.id);
        const partNumber = RFQ.escapeHTML(item.partNumber);
        const name = RFQ.escapeHTML(item.name);
        const brand = RFQ.escapeHTML(item.brand);
        const qty = Math.max(1, Number(item.qty) || 1);

        return `
            <tr>
                <td>${partNumber}</td>
                <td>${name}</td>
                <td>${brand}</td>
                <td>
                    <div class="rfq-qty">
                        <button type="button" class="qty-minus" data-id="${id}" aria-label="Decrease quantity">-</button>
                        <span>${qty}</span>
                        <button type="button" class="qty-plus" data-id="${id}" aria-label="Increase quantity">+</button>
                    </div>
                </td>
                <td><button type="button" class="remove-rfq" data-id="${id}">Remove</button></td>
            </tr>
        `;
    }).join("");

    await RFQ.renderGuestMergeWarning(table);
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


        if (!RFQ.saveGuestItems(guestItems)) return false;
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

RFQ.remove = async function (productId) {
    const user = await RFQ.getUser();

    if (!user) {
        const filtered = RFQ.getGuestItems().filter(
            item => String(item.id) !== String(productId)
        );
        if (!RFQ.saveGuestItems(filtered)) return false;
        await RFQ.updateBadge();
        await RFQ.renderPage();
        return true;
    }

    if (typeof supabaseClient === "undefined") return false;

    try {
        const { error } = await supabaseClient
            .from(RFQ.table)
            .delete()
            .eq("user_id", user.id)
            .eq("product_id", productId);

        if (error) throw error;
        await RFQ.updateBadge();
        await RFQ.renderPage();
        return true;
    } catch (error) {
        SouviksErrors?.log("[Souviks RFQ] Unable to remove RFQ item:", error, "error");
        return false;
    }
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
    const user = await RFQ.getUser();

    if (!user) {
        try {
            localStorage.removeItem(RFQ.storageKey);
        } catch (error) {
            SouviksErrors?.log("[Souviks RFQ] Unable to clear guest RFQ basket:", error, "error");
            return false;
        }

        await RFQ.updateBadge();
        await RFQ.renderPage();
        return true;
    }

    if (typeof supabaseClient === "undefined") {
        console.error("[Souviks RFQ] Supabase client unavailable.");
        return false;
    }

    try {
        const { error } = await supabaseClient
            .from(RFQ.table)
            .delete()
            .eq("user_id", user.id);

        if (error) throw error;
        await RFQ.updateBadge();
        await RFQ.renderPage();
        return true;
    } catch (error) {
        SouviksErrors?.log("[Souviks RFQ] Unable to clear RFQ basket:", error, "error");
        return false;
    }
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
    if (RFQ._mergeInProgress) return false;
    RFQ._mergeInProgress = true;

    try {
        const user = await RFQ.getUser();
        if (!user) return false;
        if (typeof supabaseClient === "undefined") {
            SouviksErrors?.log("[Souviks RFQ] Supabase client unavailable during guest basket merge.", null, "error");
            return false;
        }

        let pendingItems = RFQ.getGuestItems();
        if (!pendingItems.length) return true;

        // Retain each guest row until its authenticated write has succeeded.
        for (const item of [...pendingItems]) {
            try {
                const { data: existing, error } = await supabaseClient
                    .from(RFQ.table)
                    .select("id, quantity")
                    .eq("user_id", user.id)
                    .eq("product_id", item.id)
                    .maybeSingle();
                if (error) throw error;

                if (existing) {
                    const { error: updateError } = await supabaseClient
                        .from(RFQ.table)
                        .update({
                            quantity: Number(existing.quantity || 0) + Math.max(1, Number(item.qty) || 1)
                        })
                        .eq("id", existing.id)
                        .eq("user_id", user.id);
                    if (updateError) throw updateError;
                } else {
                    const { error: insertError } = await supabaseClient
                        .from(RFQ.table)
                        .insert({
                            user_id: user.id,
                            product_id: item.id,
                            part_number: item.partNumber || "",
                            product_name: item.name || "",
                            brand: item.brand || "",
                            quantity: Math.max(1, Number(item.qty) || 1)
                        });
                    if (insertError) throw insertError;
                }

                const remainingItems = pendingItems.filter(
                    pending => String(pending.id) !== String(item.id)
                );
                if (!RFQ.saveGuestItems(remainingItems)) {
                    SouviksErrors?.log(
                        "[Souviks RFQ] An item was merged, but the remaining guest basket could not be saved. Review the basket before retrying.",
                        { productId: item.id },
                        "error"
                    );
                    return false;
                }
                pendingItems = remainingItems;
            } catch (error) {
                SouviksErrors?.log(
                    "[Souviks RFQ] Guest RFQ item was retained because merge failed:",
                    { productId: item.id, error },
                    "error"
                );
            }
        }

        await RFQ.updateBadge();
        await RFQ.renderPage();
        return pendingItems.length === 0;
    } finally {
        RFQ._mergeInProgress = false;
    }
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

        await RFQ.mergeGuestBasket();
        await RFQ.updateBadge();
        await RFQ.renderPage();

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
        await RFQ.updateBadge();
        await RFQ.renderPage();
        return;
    }

    if (authEvent === "SIGNED_OUT") {
        await RFQ.updateBadge();
        await RFQ.renderPage();
    }
});
