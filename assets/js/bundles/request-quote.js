/* Shared core is loaded by the HTML page before this bundle. */

const RFQ_TEXT = {
    en: {
        empty: "RFQ Basket Empty",
        decrease: "Decrease quantity",
        increase: "Increase quantity",
        remove: "Remove"
    },
    hi: {
        empty: "RFQ बास्केट खाली है",
        decrease: "मात्रा कम करें",
        increase: "मात्रा बढ़ाएँ",
        remove: "हटाएँ"
    },
    bn: {
        empty: "RFQ ঝুড়ি খালি",
        decrease: "পরিমাণ কমান",
        increase: "পরিমাণ বাড়ান",
        remove: "সরান"
    }
};

const rfqText = RFQ_TEXT[LANG] || RFQ_TEXT.en;

/* Shared core is loaded by the HTML page before this bundle. */

/* ==========================================================
   SOUVIKS — PRODUCT IMAGE ZOOM + BEST-EFFORT PROTECTION
========================================================== */

(function initialiseSouviksImageProtection() {
    "use strict";

    if (window.__SOUVIKS_IMAGE_PROTECTION_BOUND__) {
        return;
    }
    window.__SOUVIKS_IMAGE_PROTECTION_BOUND__ = true;

    const VIEWER_SELECTOR = ".pdp-main-image img";
    const PROTECTED_SELECTOR = [
        ".product-image img",
        ".pdp-main-image img",
        ".pdp-thumbnails img",
        ".souviks-image-zoom-image"
    ].join(", ");

    let layer = null;
    let preview = null;
    let closeButton = null;
    let activeSource = null;

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOriginX = 0;
    let dragOriginY = 0;
    let dragging = false;

    const pointers = new Map();
    let pinchStartDistance = 0;
    let pinchStartScale = 1;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function constrainedPan(x, y) {
        if (!preview || !layer || scale <= 1.02) return { x: 0, y: 0 };

        const baseWidth = preview.offsetWidth || preview.getBoundingClientRect().width;
        const baseHeight = preview.offsetHeight || preview.getBoundingClientRect().height;
        const viewportWidth = layer.clientWidth;
        const viewportHeight = layer.clientHeight;

        const overflowX = Math.max(0, (baseWidth * scale - viewportWidth) / 2);
        const overflowY = Math.max(0, (baseHeight * scale - viewportHeight) / 2);

        return {
            x: clamp(x, -overflowX, overflowX),
            y: clamp(y, -overflowY, overflowY)
        };
    }

    function applyTransform(animate = false) {
        if (!preview) return;

        const constrained = constrainedPan(panX, panY);
        panX = constrained.x;
        panY = constrained.y;

        preview.style.transition = animate
            ? "transform 0.18s ease"
            : "none";

        preview.style.transform =
            `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;

        layer?.classList.toggle("is-zoomed", scale > 1.02);
    }

    function resetTransform() {
        scale = 1;
        panX = 0;
        panY = 0;
        applyTransform(true);
    }

    function setScale(nextScale, animate = false) {
        scale = clamp(nextScale, 1, 4);

        if (scale === 1) {
            panX = 0;
            panY = 0;
        }

        applyTransform(animate);
    }

    function createViewer() {
        if (layer) return;

        layer = document.createElement("div");
        layer.className = "souviks-image-zoom-layer";
        layer.id = "souviksImageZoomLayer";
        layer.setAttribute("aria-hidden", "true");
        layer.setAttribute("role", "dialog");
        layer.setAttribute("aria-modal", "true");

        layer.innerHTML = `
            <h2 id="souviksImageZoomTitle" class="souviks-image-zoom-title" aria-live="polite">Product image preview</h2>
            <button
                type="button"
                class="souviks-image-zoom-close"
                aria-label="Close image preview">×</button>
            <img
                class="souviks-image-zoom-image"
                alt=""
                tabindex="0"
                draggable="false">
        `;

        preview = layer.querySelector(".souviks-image-zoom-image");
        closeButton = layer.querySelector(".souviks-image-zoom-close");

        document.body.appendChild(layer);

        layer.addEventListener("click", event => {
            if (event.target === layer || event.target === closeButton) {
                closeViewer();
            }
        });

        preview.addEventListener("wheel", event => {
            if (!layer.classList.contains("is-visible")) return;

            event.preventDefault();

            const direction = event.deltaY < 0 ? 1 : -1;
            const factor = direction > 0 ? 1.18 : 0.85;

            setScale(scale * factor, false);
        }, { passive: false });

        preview.addEventListener("dblclick", event => {
            event.preventDefault();
            setScale(scale > 1.02 ? 1 : 2.5, true);
        });

        preview.addEventListener("pointerdown", event => {
            if (!layer.classList.contains("is-visible")) return;

            pointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY
            });

            preview.setPointerCapture?.(event.pointerId);

            if (pointers.size === 1 && scale > 1.02) {
                dragging = true;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                dragOriginX = panX;
                dragOriginY = panY;
            }

            if (pointers.size === 2) {
                dragging = false;
                const [a, b] = [...pointers.values()];
                pinchStartDistance = Math.hypot(
                    b.x - a.x,
                    b.y - a.y
                );
                pinchStartScale = scale;
            }
        });

        preview.addEventListener("pointermove", event => {
            if (!pointers.has(event.pointerId)) return;

            pointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY
            });

            if (pointers.size === 2 && pinchStartDistance > 0) {
                const [a, b] = [...pointers.values()];
                const currentDistance = Math.hypot(
                    b.x - a.x,
                    b.y - a.y
                );

                if (currentDistance > 0) {
                    setScale(
                        pinchStartScale *
                        (currentDistance / pinchStartDistance),
                        false
                    );
                }
                return;
            }

            if (dragging && scale > 1.02) {
                panX = dragOriginX + (event.clientX - dragStartX);
                panY = dragOriginY + (event.clientY - dragStartY);
                applyTransform(false);
            }
        });

        const endPointer = event => {
            pointers.delete(event.pointerId);

            if (pointers.size < 2) {
                pinchStartDistance = 0;
            }

            if (pointers.size === 0) {
                dragging = false;
            }
        };

        preview.addEventListener("pointerup", endPointer);
        preview.addEventListener("pointercancel", endPointer);
        preview.addEventListener("pointerleave", event => {
            if (!event.buttons) endPointer(event);
        });
    }

    function openViewer(img) {
        if (!img || !img.currentSrc && !img.src) return;

        createViewer();

        const source = img.currentSrc || img.src;
        if (!source) return;

        preview.src = source;
        preview.alt = img.alt || "Product image";
        const title = layer.querySelector("#souviksImageZoomTitle");
        if (title) title.textContent = img.alt ? `${img.alt} preview` : "Product image preview";

        activeSource = img;
        resetTransform();
        layer.setAttribute("aria-labelledby", "souviksImageZoomTitle");

        layer.classList.add("is-visible");
        layer.setAttribute("aria-hidden", "false");
        document.body.classList.add("souviks-image-viewer-open");

        closeButton?.focus({ preventScroll: true });
    }

    function closeViewer() {
        if (!layer) return;

        layer.classList.remove("is-visible", "is-zoomed");
        layer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("souviks-image-viewer-open");

        pointers.clear();
        dragging = false;
        pinchStartDistance = 0;

        if (preview) {
            preview.removeAttribute("src");
            preview.alt = "";
            preview.style.transform = "";
        }

        const returnTarget = activeSource;
        activeSource = null;
        returnTarget?.focus?.({ preventScroll: true });
    }

    function isProtectedImage(target) {
        return target instanceof Element &&
            !!target.closest(PROTECTED_SELECTOR);
    }

    // Product assets can fail independently of the product record being valid
    // (for example a stale CDN edge or a legacy filename). Replace the failed
    // request immediately with the known-good global placeholder and remove
    // responsive URL attributes so no second broken request is attempted.
    document.addEventListener("error", event => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement)) return;
        if (!image.closest(".product-image, .pdp-main-image, .pdp-thumbnails")) return;

        const placeholder = "/assets/images/placeholder.webp";
        if (image.dataset.souviksImageFallback === "done") return;

        image.dataset.souviksImageFallback = "done";
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");

        // Hide the failed element while the known-good placeholder loads so
        // the browser cannot leave its native broken-image glyph visible.
        image.style.visibility = "hidden";
        const revealFallback = () => {
            image.style.visibility = "visible";
            image.hidden = false;
        };

        image.addEventListener("load", revealFallback, { once: true });

        if (image.getAttribute("src") !== placeholder) {
            image.src = placeholder;
            return;
        }

        // Even the placeholder must not leave a native broken-image glyph.
        image.hidden = true;
    }, true);

    // Use capture-phase delegation so later catalogue/PDP handlers cannot
    // swallow the click before the viewer sees it.
    document.addEventListener("click", event => {
        const img = event.target instanceof Element
            ? event.target.closest(VIEWER_SELECTOR)
            : null;

        if (!img || !img.complete || !img.naturalWidth) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        openViewer(img);
    }, true);

    document.addEventListener("keydown", event => {
        if (!layer?.classList.contains("is-visible")) {
            return;
        }

        if (event.key === "Tab") {
            const focusable = [closeButton, preview].filter(Boolean);
            if (focusable.length) {
                const current = document.activeElement;
                const index = focusable.indexOf(current);
                if (event.shiftKey) {
                    event.preventDefault();
                    focusable[index <= 0 ? focusable.length - 1 : index - 1].focus({ preventScroll: true });
                } else {
                    event.preventDefault();
                    focusable[index >= focusable.length - 1 ? 0 : index + 1].focus({ preventScroll: true });
                }
            }
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closeViewer();
            return;
        }

        if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            setScale(scale + 0.25, true);
            return;
        }

        if (event.key === "-" || event.key === "_") {
            event.preventDefault();
            setScale(scale - 0.25, true);
            return;
        }

        if (event.key === "0") {
            event.preventDefault();
            setScale(1, true);
        }
    });

    /*
     * Best-effort casual-download deterrence.
     * A browser must receive the image bytes in order to display them, so this
     * cannot prevent screenshots, DevTools, network retrieval, or other capture.
     */
    document.addEventListener("contextmenu", event => {
        if (isProtectedImage(event.target)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);

    document.addEventListener("dragstart", event => {
        if (isProtectedImage(event.target)) {
            event.preventDefault();
        }
    }, true);

    // Prevent accidental selection/copy gestures on the viewer itself.
    document.addEventListener("selectstart", event => {
        if (isProtectedImage(event.target)) {
            event.preventDefault();
        }
    }, true);
})();


/* ===== rfq.js ===== */
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

            console.error(
                "[Souviks RFQ] Unable to get authenticated user:",
                error
            );

            return null;

        }


        return data?.user || null;


    } catch (error) {

        console.error(
            "[Souviks RFQ] Unexpected authentication error:",
            error
        );

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

        console.error(
            "[Souviks RFQ] Unable to read guest RFQ basket:",
            error
        );

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

        console.error(
            "[Souviks RFQ] Unable to save guest RFQ basket:",
            error
        );

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

        console.error(
            "[Souviks RFQ] Unable to load RFQ basket:",
            error
        );

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
                    item.id ===
                    productId

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

        console.error(
            "[Souviks RFQ] Unable to find RFQ product:",
            findError
        );

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

            console.error(
                "[Souviks RFQ] Unable to update RFQ quantity:",
                error
            );

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

            console.error(
                "[Souviks RFQ] Unable to insert RFQ product:",
                error
            );

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

                console.error(
                    "[Souviks RFQ] Add-to-RFQ error:",
                    error
                );

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

        console.error(
            "[Souviks RFQ] Unable to find RFQ item:",
            findError
        );

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

        console.error(
            "[Souviks RFQ] Unable to update RFQ quantity:",
            updateError
        );

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

        console.error(
            "[Souviks RFQ] Unable to remove RFQ item:",
            error
        );

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

            console.error(
                "[Souviks RFQ] Unable to clear guest RFQ basket:",
                error
            );

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

        console.error(
            "[Souviks RFQ] Unable to clear RFQ basket:",
            error
        );

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

                console.error(
                    "[Souviks RFQ] Unable to check guest basket item:",
                    error
                );

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

                    console.error(
                        "[Souviks RFQ] Unable to merge guest RFQ item:",
                        updateError
                    );

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

                    console.error(
                        "[Souviks RFQ] Unable to import guest RFQ item:",
                        insertError
                    );

                }

            }

        } catch (error) {

            console.error(
                "[Souviks RFQ] Unexpected guest RFQ merge error:",
                error
            );

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

        console.error(
            "[Souviks RFQ] Unable to clear guest RFQ storage:",
            error
        );

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

Supabase recommends avoiding direct database work
inside the auth callback. We defer the RFQ refresh.
----------------------------------------------------------
*/

document.addEventListener(

    "DOMContentLoaded",

    () => {

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            return;

        }


        supabaseClient.auth.onAuthStateChange(

            (
                event,
                session
            ) => {

                console.log(
                    "[Souviks RFQ] Auth event:",
                    event
                );


                /*
                ------------------------------------------
                SIGNED IN
                ------------------------------------------
                */

                if (
                    event ===
                    "SIGNED_IN"
                ) {

                    setTimeout(

                        async () => {

                            await RFQ.mergeGuestBasket();

                            await RFQ.updateBadge();

                            await RFQ.renderPage();

                        },

                        0

                    );


                    return;

                }


                /*
                ------------------------------------------
                SIGNED OUT
                ------------------------------------------
                */

                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    setTimeout(

                        async () => {

                            await RFQ.updateBadge();

                            await RFQ.renderPage();

                        },

                        0

                    );

                }

            }

        );

    }

);
