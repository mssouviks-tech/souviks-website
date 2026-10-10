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
    table: "rfq_cart_items",
    storageKey: "souviks_rfq_guest",
    MAX_QUANTITY: 9999,
    MAX_ITEMS: 50
};

RFQ.normalizeQuantity = function (value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(RFQ.MAX_QUANTITY, Math.max(1, Math.floor(numeric)));
};

RFQ.normalizeText = function (value, maxLength = 500) {
    return String(value ?? "").trim().slice(0, maxLength);
};

RFQ.normalizeItem = function (item) {
    const id = RFQ.normalizeText(item?.id, 128);
    if (!id) return null;
    const name = RFQ.normalizeText(item?.name, 300) || `Product ${id}`;

    return {
        id,
        rowId: item?.rowId || null,
        partNumber: RFQ.normalizeText(item?.partNumber, 128),
        name,
        brand: RFQ.normalizeText(item?.brand, 160),
        qty: RFQ.normalizeQuantity(item?.qty)
    };
};

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
    const lang = (
        document.documentElement.lang ||
        window.souviks?.currentLanguage ||
        "en"
    ).trim().toLowerCase();
    const dictionary = RFQ_UI_MESSAGES[lang] || RFQ_UI_MESSAGES.en;
    const message = dictionary[messageKey] || RFQ_UI_MESSAGES.en[messageKey] || "";
    if (!message) return;

    const control = anchor instanceof Element ? anchor : null;
    let host = null;
    let insertAfter = null;

    const card = control?.closest(".product-card");
    const pdpActions = control?.closest(".pdp-actions");
    const basketBody = control?.closest("#rfq-items");

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
        const stored = localStorage.getItem(RFQ.storageKey);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];

        // Keep all valid legacy rows visible so a basket over the current limit
        // can be reduced by the customer instead of silently dropping products.
        return parsed.map(item => RFQ.normalizeItem({ ...item, rowId: null })).filter(Boolean);
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

RFQ.saveGuestItems = function (items) {
    try {
        const source = Array.isArray(items) ? items : [];
        if (source.length > RFQ.MAX_ITEMS) return false;

        const normalized = source.map(item => RFQ.normalizeItem(item)).filter(Boolean);
        if (normalized.length !== source.length) return false;

        localStorage.setItem(RFQ.storageKey, JSON.stringify(normalized));
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

RFQ.setQuantity = async function (productId, product, quantity) {
    const normalizedId = RFQ.normalizeText(productId, 128);
    if (!normalizedId) return false;

    const normalizedProduct = RFQ.normalizeItem({
        id: normalizedId,
        rowId: null,
        partNumber: product?.partNumber,
        name: product?.name,
        brand: product?.brand,
        qty: quantity
    });
    if (!normalizedProduct) return false;

    const qty = normalizedProduct.qty;
    const user = await RFQ.getUser();

    if (!user) {
        const items = RFQ.getGuestItems();
        const existingIndex = items.findIndex(
            item => String(item.id) === String(normalizedId)
        );

        if (existingIndex < 0 && items.length >= RFQ.MAX_ITEMS) {
            return false;
        }

        if (existingIndex >= 0) {
            items[existingIndex] = normalizedProduct;
        } else {
            items.push(normalizedProduct);
        }

        if (!RFQ.saveGuestItems(items)) return false;
        await RFQ.refreshUI();
        return true;
    }

    if (typeof supabaseClient === "undefined") {
        console.error("[Souviks RFQ] Supabase client unavailable.");
        return false;
    }

    const { data: existing, error: findError } = await supabaseClient
        .from(RFQ.table)
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", normalizedId)
        .maybeSingle();

    if (findError) {
        SouviksErrors?.log("[Souviks RFQ] Unable to find RFQ product:", findError, "error");
        return false;
    }

    if (existing) {
        const { error } = await supabaseClient
            .from(RFQ.table)
            .update({ quantity: qty })
            .eq("id", existing.id)
            .eq("user_id", user.id);

        if (error) {
            SouviksErrors?.log("[Souviks RFQ] Unable to update RFQ quantity:", error, "error");
            return false;
        }
    } else {
        const { count, error: countError } = await supabaseClient
            .from(RFQ.table)
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);

        if (countError) {
            SouviksErrors?.log("[Souviks RFQ] Unable to check RFQ basket size:", countError, "error");
            return false;
        }
        if (Number(count || 0) >= RFQ.MAX_ITEMS) return false;

        const { error } = await supabaseClient
            .from(RFQ.table)
            .insert({
                user_id: user.id,
                product_id: normalizedId,
                part_number: normalizedProduct.partNumber,
                product_name: normalizedProduct.name,
                brand: normalizedProduct.brand,
                quantity: qty
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

RFQ.refreshUI = async function () {
    let refreshed = true;
    try {
        await RFQ.updateBadge();
    } catch (error) {
        refreshed = false;
        SouviksErrors?.log("[Souviks RFQ] Unable to refresh RFQ badge:", error, "warn");
    }
    try {
        await RFQ.renderPage();
    } catch (error) {
        refreshed = false;
        SouviksErrors?.log("[Souviks RFQ] Unable to refresh RFQ page:", error, "warn");
    }
    return refreshed;
};


RFQ.changeQty = async function (productId, amount) {
    try {
        const items = await RFQ.get();
        const item = items.find(entry => String(entry.id) === String(productId));
        if (!item) return false;

        const newQuantity = Number(item.qty) + Number(amount);
        if (newQuantity <= 0) {
            return await RFQ.remove(productId);
        }

        const user = await RFQ.getUser();
        if (!user) {
            const guestItems = RFQ.getGuestItems();
            const guestIndex = guestItems.findIndex(entry => String(entry.id) === String(productId));
            if (guestIndex < 0) return false;

            guestItems[guestIndex].qty = newQuantity;
            if (!RFQ.saveGuestItems(guestItems)) return false;
            await RFQ.refreshUI();
            return true;
        }

        if (typeof supabaseClient === "undefined") return false;

        const { data: dbItem, error: findError } = await supabaseClient
            .from(RFQ.table)
            .select("id, quantity")
            .eq("user_id", user.id)
            .eq("product_id", productId)
            .maybeSingle();

        if (findError) {
            SouviksErrors?.log("[Souviks RFQ] Unable to find RFQ item:", findError, "error");
            return false;
        }
        if (!dbItem) return false;

        const { error: updateError } = await supabaseClient
            .from(RFQ.table)
            .update({ quantity: newQuantity })
            .eq("id", dbItem.id)
            .eq("user_id", user.id);

        if (updateError) {
            SouviksErrors?.log("[Souviks RFQ] Unable to update RFQ quantity:", updateError, "error");
            return false;
        }

        await RFQ.refreshUI();
        return true;
    } catch (error) {
        SouviksErrors?.log("[Souviks RFQ] Unexpected quantity update failure:", error, "error");
        return false;
    }
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
        await RFQ.refreshUI();
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
        await RFQ.refreshUI();
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

        await RFQ.refreshUI();
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
        await RFQ.refreshUI();
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
                        "[Souviks RFQ] An item was merged, but remaining guest items could not be persisted. Review before retrying.",
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

        await RFQ.refreshUI();
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


            RFQ.changeQty(plus.dataset.id, 1)
                .then(updated => {
                    if (!updated) RFQ.showActionStatus(plus, "quantityFailed");
                })
                .catch(error => {
                    SouviksErrors?.log("[Souviks RFQ] Increase quantity failed:", error, "error");
                    RFQ.showActionStatus(plus, "quantityFailed");
                });


            return;

        }


        const minus =
            event.target.closest(
                ".qty-minus"
            );


        if (minus) {

            event.preventDefault();


            RFQ.changeQty(minus.dataset.id, -1)
                .then(updated => {
                    if (!updated) RFQ.showActionStatus(minus, "quantityFailed");
                })
                .catch(error => {
                    SouviksErrors?.log("[Souviks RFQ] Decrease quantity failed:", error, "error");
                    RFQ.showActionStatus(minus, "quantityFailed");
                });


            return;

        }


        const remove =
            event.target.closest(
                ".remove-rfq"
            );


        if (remove) {

            event.preventDefault();


            RFQ.remove(remove.dataset.id)
                .then(removed => {
                    if (!removed) RFQ.showActionStatus(remove, "removeFailed");
                })
                .catch(error => {
                    SouviksErrors?.log("[Souviks RFQ] Remove product failed:", error, "error");
                    RFQ.showActionStatus(remove, "removeFailed");
                });

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
        await RFQ.refreshUI();

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
                await RFQ.refreshUI();
            }, 0);
            return;
        }

        if (authEvent === "SIGNED_OUT") {
            setTimeout(async () => {
                await RFQ.refreshUI();
            }, 0);
        }
    }
);
