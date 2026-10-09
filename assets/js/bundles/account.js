/* ===== runtime-error-fallback.js ===== */
(() => {
    "use strict";

    if (window.SouviksErrors) return;

    const safeString = value => String(value ?? "")
        .replace(/https?:\/\/\S+/gi, "[url]")
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
        .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");

    window.SouviksErrors = {
        sanitise(error) {
            return {
                name: safeString(error?.name || "Error").slice(0, 48),
                ...(error?.code ? { code: safeString(error.code).slice(0, 48) } : {})
            };
        },
        log(context, error) {
            if (typeof console !== "undefined" && typeof console.error === "function") {
                console.error("[Souviks]", safeString(context || "Runtime error"), this.sanitise(error));
            }
        }
    };
})();

/* ===== auth/register.js ===== */
/* ==========================================================
   SOUVIKS — REGISTRATION
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const form =
        document.getElementById(
            "registerForm"
        );

    if (!form) {

        return;

    }


    /*
    ----------------------------------------------------------
    ELEMENTS
    ----------------------------------------------------------
    */

    const fullNameInput =
        document.getElementById(
            "fullName"
        );

    const emailInput =
        document.getElementById(
            "email"
        );

    const passwordInput =
        document.getElementById(
            "password"
        );

    const confirmPasswordInput =
        document.getElementById(
            "confirmPassword"
        );

    const submitButton =
        form.querySelector(
            'button[type="submit"]'
        );


    /*
    ----------------------------------------------------------
    STATUS ELEMENT
    ----------------------------------------------------------
    */

    let statusElement =
        document.getElementById(
            "registerStatus"
        );


    if (!statusElement) {

        statusElement =
            document.createElement(
                "div"
            );

        statusElement.id =
            "registerStatus";

        statusElement.className =
            "form-status";

        form.appendChild(
            statusElement
        );

    }


    /*
    ----------------------------------------------------------
    TRANSLATIONS
    ----------------------------------------------------------

    Registration messages are provided by the hidden
    #authTranslations element in register.html.

    ----------------------------------------------------------
    */

    const translationElement =
        document.getElementById(
            "authTranslations"
        );


    function getAuthMessage(
        key,
        fallback
    ) {

        if (!translationElement) {

            return fallback;

        }


        return translationElement.dataset[key] ||
            fallback;

    }


    /*
    ----------------------------------------------------------
    CURRENT LANGUAGE
    ----------------------------------------------------------
    */

    function getCurrentLanguage() {

        const language =
            document.documentElement
                .lang
                ?.trim()
                .toLowerCase();


        if (language) {

            return language;

        }


        return "en";

    }


    /*
    ----------------------------------------------------------
    SHOW STATUS
    ----------------------------------------------------------
    */

    function showStatus(
        message,
        type = ""
    ) {

        statusElement.textContent =
            message;

        statusElement.className =
            "form-status";


        if (type) {

            statusElement.classList.add(
                type
            );

        }

    }


    /*
    ----------------------------------------------------------
    DISABLE / ENABLE FORM
    ----------------------------------------------------------
    */

    function setSubmitting(
        isSubmitting
    ) {

        if (submitButton) {

            submitButton.disabled =
                isSubmitting;

        }


        fullNameInput.disabled =
            isSubmitting;

        emailInput.disabled =
            isSubmitting;

        passwordInput.disabled =
            isSubmitting;

        confirmPasswordInput.disabled =
            isSubmitting;

    }


    /*
    ----------------------------------------------------------
    SUBMIT
    ----------------------------------------------------------
    */

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            showStatus("");


            const fullName =
                fullNameInput.value.trim();

            const email =
                emailInput.value.trim();

            const password =
                passwordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;


            /*
            --------------------------------------------------
            VALIDATION
            --------------------------------------------------
            */

            if (!fullName) {

                showStatus(
                    getAuthMessage(
                        "fullNameRequired",
                        "Please enter your full name."
                    ),
                    "error"
                );

                fullNameInput.focus();

                return;

            }


            if (!email) {

                showStatus(
                    getAuthMessage(
                        "emailRequired",
                        "Please enter your email address."
                    ),
                    "error"
                );

                emailInput.focus();

                return;

            }


            if (!password) {

                showStatus(
                    getAuthMessage(
                        "passwordCreateRequired",
                        "Please enter a password."
                    ),
                    "error"
                );

                passwordInput.focus();

                return;

            }


            if (
                password.length < 8
            ) {

                showStatus(
                    getAuthMessage(
                        "passwordMinLength",
                        "Password must be at least 8 characters."
                    ),
                    "error"
                );

                passwordInput.focus();

                return;

            }


            if (
                password !==
                confirmPassword
            ) {

                showStatus(
                    getAuthMessage(
                        "passwordMismatch",
                        "Passwords do not match."
                    ),
                    "error"
                );

                confirmPasswordInput.focus();

                return;

            }


            /*
            --------------------------------------------------
            SUPABASE CHECK
            --------------------------------------------------
            */

            if (
                typeof supabaseClient ===
                "undefined"
            ) {

                console.error(
                    "[Souviks Auth] Supabase client unavailable."
                );

                showStatus(
                    getAuthMessage(
                        "authenticationUnavailable",
                        "Authentication service is unavailable. Please try again later."
                    ),
                    "error"
                );

                return;

            }


            /*
            --------------------------------------------------
            LANGUAGE-AWARE EMAIL REDIRECT
            --------------------------------------------------
            */

            const language =
                getCurrentLanguage();


            const emailRedirectTo =
                `https://www.souviks.co.in/${language}/login`;


            /*
            --------------------------------------------------
            SUBMIT
            --------------------------------------------------
            */

            setSubmitting(true);


            try {

                const {
                    data,
                    error
                } =
                    await supabaseClient.auth
                        .signUp({

                            email:
                                email,

                            password:
                                password,

                            options: {

                                data: {

                                    full_name:
                                        fullName

                                },

                                emailRedirectTo:
                                    emailRedirectTo

                            }

                        });


                /*
                --------------------------------------------------
                SUPABASE ERROR
                --------------------------------------------------
                */

                if (error) {

                    SouviksErrors?.log("[Souviks Auth] Registration failed:", error, "error");


                    let message =
                        getAuthMessage(
                            "registrationFailed",
                            "Unable to create your account. Please try again."
                        );


                    const errorMessage =
                        error.message
                            ? error.message
                                .toLowerCase()
                            : "";


                    if (
                        errorMessage.includes(
                            "already registered"
                        )
                    ) {

                        message =
                            getAuthMessage(
                                "accountExists",
                                "An account with this email already exists."
                            );

                    } else if (
                        errorMessage.includes(
                            "password"
                        )
                    ) {

                        /*
                        Supabase may return a more specific
                        password-policy error. Keep that
                        provider message rather than replacing
                        it with an inaccurate translation.
                        */

                        message =
                            error.message;

                    }


                    showStatus(
                        message,
                        "error"
                    );


                    setSubmitting(false);

                    return;

                }


                /*
                --------------------------------------------------
                SUCCESS
                --------------------------------------------------
                */

                


                form.reset();


                showStatus(
                    getAuthMessage(
                        "registrationSuccess",
                        "Account created successfully. Please check your email to verify your account."
                    ),
                    "success"
                );


                setSubmitting(false);

            } catch (error) {

                SouviksErrors?.log("[Souviks Auth] Unexpected registration error:", error, "error");


                showStatus(
                    getAuthMessage(
                        "somethingWentWrong",
                        "Something went wrong. Please try again."
                    ),
                    "error"
                );


                setSubmitting(false);

            }

        }
    );

});

/* ===== api.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
API LAYER
Version : 1.0
==========================================================
*/

class SouviksAPI {

    constructor() {

        this.cache = {};

        this.basePath = "/assets/data";

    }
    // ======================================================
    // FETCH JSON
    // ======================================================

    async fetchJson(filename) {

        if (this.cache[filename]) {

            return this.cache[filename];

        }

        try {

            const response = await fetch(

                `${this.basePath}/${filename}`,

                {

                    cache: "no-store",

                    credentials: "same-origin"

                }

            );

            if (!response.ok) {

                throw new Error(

                    `Failed loading ${filename}`

                );

            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new TypeError("Catalogue data must be an array");
            }

            this.cache[filename] = data;

            return data;

        }

        catch (error) {

            this.cache[filename] = [];
            SouviksErrors?.log(
                "Catalogue data load failed",
                error
            );

            return [];

        }

    }
    // ======================================================
    // PRODUCTS
    // ======================================================

    async products() {

        return (await this.fetchJson(

            "products.json"

        )).filter(item => item && item.active !== false);

    }

    async catalogueIndex() {
        return await this.fetchJson("catalogue-index.json");
    }

    async productBySlug(slug) {

        const products = await this.products();

        return products.find(

            item => item.slug === slug

        );

    }

    async productById(id) {

        const products = await this.products();

        return products.find(

            item => item.id === id

        );

    }
    // ======================================================
    // BRANDS
    // ======================================================

    async brands() {

        return (await this.fetchJson(

            "brands.json"

        )).filter(item => item && item.active !== false);

    }

    async brandBySlug(slug) {

        const brands = await this.brands();

        return brands.find(

            item => item.slug === slug

        );

    }

    async brandById(id) {

        const brands = await this.brands();

        return brands.find(

            item => item.id === id

        );

    }
    // ======================================================
    // CATEGORIES
    // ======================================================

    async categories() {

        return (await this.fetchJson(

            "categories.json"

        )).filter(item => item && item.active !== false);

    }

    async categoryBySlug(slug) {

        const categories = await this.categories();

        return categories.find(

            item => item.slug === slug

        );

    }

    async categoryById(id) {

        const categories = await this.categories();

        return categories.find(

            item => item.id === id

        );

    }
    // ======================================================
    // VEHICLES
    // ======================================================

    async vehicles() {

        return (await this.fetchJson(

            "vehicles.json"

        )).filter(item => item && item.active !== false);

    }

    async vehicleBySlug(slug) {

        const vehicles = await this.vehicles();

        return vehicles.find(

            item => item.slug === slug

        );

    }

    async vehicleById(id) {

        const vehicles = await this.vehicles();

        return vehicles.find(

            item => item.id === id

        );

    }
    // ======================================================
    // SEARCH
    // ======================================================

    async searchIndex() {

        return await this.fetchJson(

            "search.json"

        );

    }
    // ======================================================
    // PRODUCTS BY BRAND
    // ======================================================

    async productsByBrand(brandId) {

        const products = await this.products();

        return products.filter(

            product =>

                product.brand_id === brandId

        );

    }

    // ======================================================
    // PRODUCTS BY CATEGORY
    // ======================================================

    async productsByCategory(categoryId) {

        const products = await this.products();

        return products.filter(

            product =>

                product.category_id === categoryId

        );

    }

    // ======================================================
    // PRODUCTS BY VEHICLE
    // ======================================================

    async productsByVehicle(vehicleName) {

        const products = await this.products();
        const target = String(vehicleName ?? "").trim();
        if (!target) return [];

        return products.filter(

            product => Array.isArray(product?.vehicles) &&
                product.vehicles.some(
                    value => String(value ?? "").trim() === target
                )

        );

    }
}

window.API = new SouviksAPI();


/* ===== breadcrumb.js ===== */
/* ==========================================================
   SOUVIKS BREADCRUMB MANAGER
   Deterministic, route-safe breadcrumbs.
========================================================== */

const Breadcrumb = {

    homeUrl() {
        const language = window.souviks?.currentLanguage || "en";
        return `/${language}/`;
    },

    escape(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    label(key, fallback) {
        return String(
            window.souviks?.translations?.navigation?.[key] || fallback || ""
        );
    },

    localizeKnownLabel(title) {
        const value = String(title || "").trim().toLowerCase();
        const labels = {
            home: this.label("home", "Home"),
            products: this.label("products", "Products"),
            brands: this.label("brands", "Brands"),
            vehicles: this.label("vehicles", "Vehicles"),
            categories: this.label("categories", "Categories")
        };
        return labels[value] || title;
    },

    reset() {},
    start() {},
    visit() {},
    replace() {},
    current() { return []; },

    render(currentPage, items = []) {
        const list = document.getElementById("breadcrumb-list");
        if (!list) return;

        const path = [{ title: this.label("home", "Home"), url: this.homeUrl() }];
        for (const item of (Array.isArray(items) ? items : [])) {
            if (!item?.title || !item?.url) continue;
            if (item.title === "Home" || item.url === path[0].url) continue;
            path.push({ title: this.localizeKnownLabel(item.title), url: item.url });
        }

        if (path[path.length - 1]?.title !== currentPage) {
            path.push({ title: currentPage, url: "" });
        }

        list.innerHTML = path.map((item, index) => {
            const current = index === path.length - 1;
            if (current) {
                return `<li class="breadcrumb-item active" aria-current="page">${this.escape(item.title)}</li>`;
            }
            return `<li class="breadcrumb-item"><a href="${this.escape(item.url)}">${this.escape(item.title)}</a></li>`;
        }).join("");
    }
};


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
    table: "rfq_cart_items",
    storageKey: "souviks_rfq_guest",
    MAX_QUANTITY: 9999,
    MAX_ITEMS: 50
};
RFQ.normalizeQuantity = function(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(RFQ.MAX_QUANTITY, Math.max(1, Math.floor(numeric)));
};
RFQ.normalizeText = function(value, maxLength = 500) {
    return String(value ?? "").trim().slice(0, maxLength);
};
RFQ.normalizeItem = function(item) {
    const id = RFQ.normalizeText(item?.id, 128);
    if (!id) return null;
    return {
        id,
        rowId: item?.rowId || null,
        partNumber: RFQ.normalizeText(item?.partNumber, 128),
        name: RFQ.normalizeText(item?.name, 300),
        brand: RFQ.normalizeText(item?.brand, 160),
        qty: RFQ.normalizeQuantity(item?.qty)
    };
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

/* ===== saved-products.js ===== */
/*
==========================================================
SOUVIKS — SAVED PRODUCTS
==========================================================

Authenticated users:
    Supabase → public.saved_products

Anonymous users:
    No persistent saved-products account state.

Product identifier:
    product.id

Database fields:
    user_id
    product_id
    created_at
==========================================================
*/


const SavedProducts = {};


/*
==========================================================
INTERNAL STATE
==========================================================
*/

SavedProducts.state = {

    initialized:
        false,

    user:
        null,

    savedIds:
        new Set()

};


/*
==========================================================
INITIALIZE
==========================================================
*/

SavedProducts.init = async function () {

    if (
        SavedProducts.state.initialized
    ) {

        return;

    }


    SavedProducts.state.initialized =
        true;


    /*
    ------------------------------------------------------
    Supabase must already be available.
    ------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks Saved] Supabase client unavailable."
        );

        return;

    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getUser();


        if (error) {

            throw error;

        }


        SavedProducts.state.user =
            data?.user ||
            null;


        /*
        --------------------------------------------------
        Anonymous users simply have no saved account data.
        --------------------------------------------------
        */

        if (
            !SavedProducts.state.user
        ) {

            return;

        }


        await SavedProducts.load();

        SavedProducts.updateButtons();


    }

    catch (error) {

        SouviksErrors?.log("[Souviks Saved] Initialization failed:", error, "error");

    }

};


/*
==========================================================
GET CURRENT USER
==========================================================
*/

SavedProducts.getUser = async function () {

    if (
        SavedProducts.state.user
    ) {

        return SavedProducts.state.user;

    }


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

            throw error;

        }


        SavedProducts.state.user =
            data?.user ||
            null;


        return (
            SavedProducts.state.user
        );

    }

    catch (error) {

        SouviksErrors?.log("[Souviks Saved] Unable to get user:", error, "error");

        return null;

    }

};


/*
==========================================================
LOAD SAVED PRODUCTS
==========================================================
*/

SavedProducts.load = async function () {

    const user =
        await SavedProducts.getUser();


    if (!user) {

        SavedProducts.state.savedIds =
            new Set();

        return [];

    }


    const {
        data,
        error
    } =
        await supabaseClient

            .from(
                "saved_products"
            )

            .select(
                "product_id"
            )

            .eq(
                "user_id",
                user.id
            );


    if (error) {

        SouviksErrors?.log("[Souviks Saved] Failed to load saved products:", error, "error");

        return [];

    }


    const rows =
        data || [];


    SavedProducts.state.savedIds =
        new Set(

            rows
                .map(
                    row =>
                        String(
                            row.product_id
                        )
                )

        );


    return rows;

};


/*
==========================================================
CHECK SAVED STATE
==========================================================
*/

SavedProducts.isSaved = function (
    productId
) {

    if (
        productId ===
        null ||
        productId ===
        undefined
    ) {

        return false;

    }


    return SavedProducts.state.savedIds.has(
        String(
            productId
        )
    );

};


/*
==========================================================
SAVE PRODUCT
==========================================================
*/

SavedProducts.save = async function (
    productId
) {

    if (
        productId ===
        null ||
        productId ===
        undefined
    ) {

        console.error(
            "[Souviks Saved] Missing product ID."
        );

        return false;

    }


    const user =
        await SavedProducts.getUser();


    /*
    ------------------------------------------------------
    Anonymous user
    ------------------------------------------------------
    */

    if (!user) {

        SavedProducts.handleAuthenticationRequired();

        return false;

    }


    const normalizedId =
        String(
            productId
        );


    /*
    ------------------------------------------------------
    Already saved
    ------------------------------------------------------
    */

    if (
        SavedProducts.isSaved(
            normalizedId
        )
    ) {

        return true;

    }


    const {
        error
    } =
        await supabaseClient

            .from(
                "saved_products"
            )

            .insert({

                user_id:
                    user.id,

                product_id:
                    normalizedId

            });


    if (error) {

        /*
        --------------------------------------------------
        Unique constraint protection.
        Another request may have saved it already.
        --------------------------------------------------
        */

        if (
            error.code ===
            "23505"
        ) {

            SavedProducts.state.savedIds.add(
                normalizedId
            );

            SavedProducts.updateButton(
                normalizedId
            );

            return true;

        }


        SouviksErrors?.log("[Souviks Saved] Failed to save product:", error, "error");

        return false;

    }


    SavedProducts.state.savedIds.add(
        normalizedId
    );


    SavedProducts.updateButton(
        normalizedId
    );


    return true;

};


/*
==========================================================
REMOVE SAVED PRODUCT
==========================================================
*/

SavedProducts.remove = async function (
    productId
) {

    if (
        productId ===
        null ||
        productId ===
        undefined
    ) {

        return false;

    }


    const user =
        await SavedProducts.getUser();


    if (!user) {

        SavedProducts.handleAuthenticationRequired();

        return false;

    }


    const normalizedId =
        String(
            productId
        );


    const {
        error
    } =
        await supabaseClient

            .from(
                "saved_products"
            )

            .delete()

            .eq(
                "user_id",
                user.id
            )

            .eq(
                "product_id",
                normalizedId
            );


    if (error) {

        SouviksErrors?.log("[Souviks Saved] Failed to remove product:", error, "error");

        return false;

    }


    SavedProducts.state.savedIds.delete(
        normalizedId
    );


    SavedProducts.updateButton(
        normalizedId
    );


    /*
    ------------------------------------------------------
    If My Saved is currently visible, refresh it.
    ------------------------------------------------------
    */

    if (
        typeof window.refreshSavedProducts ===
        "function"
    ) {

        await window.refreshSavedProducts();

    }


    return true;

};


/*
==========================================================
TOGGLE
==========================================================
*/

SavedProducts.toggle = async function (
    productId
) {

    if (
        SavedProducts.isSaved(
            productId
        )
    ) {

        return (
            await SavedProducts.remove(
                productId
            )
        );

    }


    return (
        await SavedProducts.save(
            productId
        )
    );

};


/*
==========================================================
UPDATE ALL SAVE BUTTONS
==========================================================
*/

SavedProducts.updateButtons = function () {

    const buttons =
        document.querySelectorAll(
            "[data-saved-product-id]"
        );


    buttons.forEach(
        button => {

            SavedProducts.updateButtonElement(
                button
            );

        }
    );

};


/*
==========================================================
UPDATE BUTTON BY PRODUCT ID
==========================================================
*/

SavedProducts.updateButton = function (
    productId
) {

    const buttons =
        document.querySelectorAll(
            `[data-saved-product-id="${CSS.escape(
                String(
                    productId
                )
            )}"]`
        );


    buttons.forEach(
        button => {

            SavedProducts.updateButtonElement(
                button
            );

        }
    );

};


/*
==========================================================
UPDATE INDIVIDUAL BUTTON
==========================================================
*/

SavedProducts.updateButtonElement =
    function (
        button
    ) {

        const productId =
            button.dataset.savedProductId;


        const saved =
            SavedProducts.isSaved(
                productId
            );


        button.classList.toggle(
            "is-saved",
            saved
        );


        button.setAttribute(
            "aria-pressed",
            String(
                saved
            )
        );


        button.setAttribute(
            "data-saved",
            saved
                ? "true"
                : "false"
        );


        const label =
            saved
                ? "Remove from saved products"
                : "Save product";


        button.setAttribute(
            "aria-label",
            label
        );


        const text =
            button.querySelector(
                "[data-saved-label]"
            );


        if (text) {

            text.textContent =
                saved
                    ? "Saved"
                    : "Save";

        }


        const icon =
            button.querySelector(
                "[data-saved-icon]"
            );


        if (icon) {

            icon.textContent =
                saved
                    ? "♥"
                    : "♡";

        }

    };


/*
==========================================================
AUTHENTICATION REQUIRED
==========================================================
*/

SavedProducts.handleAuthenticationRequired =
    function () {

        /*
        --------------------------------------------------
        Don't silently save anonymous users locally.
        My Saved is an account feature.
        --------------------------------------------------
        */

        const loginUrl =
            `/${encodeURIComponent(window.souviks?.currentLanguage || "en")}/login`;


        const currentUrl =
            window.location.href;


        const separator =
            loginUrl.includes("?")
                ? "&"
                : "?";


        window.location.href =
            loginUrl +
            separator +
            "redirect=" +
            encodeURIComponent(
                currentUrl
            );

    };


/*
==========================================================
BUTTON EVENT DELEGATION
==========================================================
*/

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "[data-saved-product-id]"
            );

        if (!button) {

            return;

        }


        /*
        --------------------------------------------------
        Completely isolate Save-button clicks from the
        product-card/product-link click handlers.
        --------------------------------------------------
        */

        event.preventDefault();

        event.stopPropagation();

        if (
            typeof event.stopImmediatePropagation ===
            "function"
        ) {

            event.stopImmediatePropagation();

        }


        const productId =
            button.dataset.savedProductId;


        if (!productId) {

            return;

        }


        if (button.disabled) {

            return;

        }


        button.disabled = true;


        try {

            await SavedProducts.toggle(
                productId
            );

        }

        catch (error) {

            SouviksErrors?.log("[Souviks Saved] Toggle failed:", error, "error");

        }

        finally {

            button.disabled = false;

        }

    },
    true
);


/*
==========================================================
AUTH STATE
==========================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const scheduleSavedInitialisation = () => SavedProducts.init();
    if ("requestIdleCallback" in window) {
        window.requestIdleCallback(scheduleSavedInitialisation, { timeout: 1800 });
    } else {
        window.setTimeout(scheduleSavedInitialisation, 700);
    }

    }
);


/*
==========================================================
GLOBAL API
==========================================================
*/

window.SavedProducts =
    SavedProducts;

/* ===== rfq-submit.js ===== */
/*
==========================================================
SOUVIKS — AUTHENTICATED RFQ SUBMISSION
==========================================================

Purpose:
    Submit an authenticated user's RFQ.

Used by:
    Account → RFQ

This module does NOT:
    - render the RFQ UI
    - manage the RFQ basket
    - handle anonymous RFQs
    - handle Account section navigation

Dependencies:
    - supabaseClient
    - RFQ
    - EmailJS
==========================================================
*/


window.RFQSubmission = {


    /*
    ======================================================
    EMAILJS CONFIGURATION
    ======================================================
    */

    emailService:
        "service_trsy6ll",

    emailTemplate:
        "template_udttxcf",

    emailPublicKey:
        "HYXrRpK5XSEAGf5s2",


    /*
    ======================================================
    INITIALIZE EMAILJS
    ======================================================
    */

    initializeEmailJS() {

        if (
            typeof emailjs ===
            "undefined"
        ) {

            console.error(
                "[Souviks RFQ] EmailJS is unavailable."
            );

            return false;

        }


        try {

            emailjs.init(
                this.emailPublicKey
            );


            return true;


        } catch (error) {

            SouviksErrors?.log("[Souviks RFQ] Unable to initialize EmailJS:", error, "error");

            return false;

        }

    },


    /*
    ======================================================
    GET AUTHENTICATED USER
    ======================================================
    */

    async getUser() {

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            throw new Error(
                "Supabase client is unavailable."
            );

        }


        const {
            data,
            error
        } =
            await supabaseClient.auth.getUser();


        if (error) {

            throw error;

        }


        if (
            !data ||
            !data.user
        ) {

            throw new Error(
                "No authenticated user found."
            );

        }


        return data.user;

    },


    /*
    ======================================================
    GET USER PROFILE
    ======================================================
    */

    async getProfile(
        userId
    ) {

        const {
            data,
            error
        } =
            await supabaseClient

                .from(
                    "profiles"
                )

                .select(
                    `
                    id,
                    full_name,
                    phone,
                    company,
                    is_business,
                    gst_number
                    `
                )

                .eq(
                    "id",
                    userId
                )

                .maybeSingle();


        if (error) {

            throw error;

        }


        if (!data) {

            throw new Error(
                "Your account profile could not be found."
            );

        }


        return data;

    },


    /*
    ======================================================
    VALIDATE PROFILE
    ======================================================
    */

    validateProfile(
        profile,
        user
    ) {

        const name =
            (
                profile.full_name ||
                ""
            ).trim();


        const phone =
            (
                profile.phone ||
                ""
            ).trim();


        const email =
            (
                user.email ||
                ""
            ).trim();


        if (!name) {

            throw new Error(
                "Your account profile does not contain your full name."
            );

        }


        if (!phone) {

            throw new Error(
                "Your account profile does not contain your phone number."
            );

        }


        if (!email) {

            throw new Error(
                "Your account does not contain an email address."
            );

        }


        return true;

    },


    /*
    ======================================================
    GET CURRENT RFQ ITEMS
    ======================================================
    */

    async getItems() {

        if (
            typeof RFQ ===
            "undefined"
        ) {

            throw new Error(
                "RFQ basket engine is unavailable."
            );

        }


        const items =
            await RFQ.get();


        if (
            !Array.isArray(
                items
            ) ||
            !items.length
        ) {

            throw new Error(
                "Your RFQ basket is empty."
            );

        }


        return items;

    },


    /*
    ======================================================
    FORMAT RFQ ITEMS FOR EMAIL
    ======================================================
    */

    formatEmailItems(
        items
    ) {

        return items.map(

            item =>

`Part Number: ${item.partNumber}
Product: ${item.name}
Brand: ${item.brand}
Quantity: ${item.qty}

--------------------------------`

        ).join(
            "\n"
        );

    },


    /*
    ======================================================
    FORMAT RFQ NUMBER
    ======================================================

    Database:
        1

    Customer-facing:
        RFQ000001
    ======================================================
    */

    formatReference(
        number
    ) {

        return (
            "RFQ" +
            String(
                number
            ).padStart(
                6,
                "0"
            )
        );

    },


    /*
    ======================================================
    CREATE RFQ
    ======================================================
    */

    async createRFQTransaction(
        user,
        profile,
        items,
        message = ""
    ) {

        if (
            !Array.isArray(items) ||
            !items.length
        ) {
            throw new Error("Your RFQ basket is empty.");
        }

        if (items.length > (RFQ.MAX_ITEMS || 50)) {
            throw new Error(
                "Your RFQ contains too many items. Please submit no more than " +
                (RFQ.MAX_ITEMS || 50) +
                " items at a time."
            );
        }

        const normalizedItems =
            items
                .map(item => RFQ.normalizeItem(item))
                .filter(Boolean);

        if (normalizedItems.length !== items.length) {
            throw new Error(
                "One or more RFQ items are invalid. Please remove them and add the products again."
            );
        }

        const {
            data,
            error
        } =
            await supabaseClient.rpc(
                "submit_rfq",
                {
                    p_customer_name:
                        profile.full_name?.trim() || "",

                    p_customer_phone:
                        profile.phone?.trim() || "",

                    p_company:
                        profile.company?.trim() || null,

                    p_gst_number:
                        profile.gst_number?.trim() || null,

                    p_message:
                        (message || "").trim() || null,

                    p_items:
                        normalizedItems.map(item => ({
                            id: item.id,
                            partNumber: item.partNumber,
                            name: item.name,
                            brand: item.brand,
                            quantity: RFQ.normalizeQuantity(item.qty)
                        }))
                }
            );

        if (error) {
            throw error;
        }

        if (!data || !data.rfq_number) {
            throw new Error(
                "The RFQ could not be created."
            );
        }

        return {
            rfq: data,
            items: normalizedItems
        };

    },


    /*
    ======================================================
    SEND EMAIL NOTIFICATION
    ======================================================
    */

    async sendEmail(
        reference,
        user,
        profile,
        items,
        message
    ) {

        const initialized =
            this.initializeEmailJS();


        if (!initialized) {

            throw new Error(
                "Email notification service is unavailable."
            );

        }


        const rfqItems =
            this.formatEmailItems(
                items
            );


        const payload = {

            lead_id:
                reference,

            name:
                profile.full_name
                    ?.trim() ||
                "",

            company:
                profile.company
                    ?.trim() ||
                "",

            phone:
                profile.phone
                    ?.trim() ||
                "",

            email:
                user.email
                    ?.trim() ||
                "",

            gst:
                profile.gst_number
                    ?.trim() ||
                "",

            message:
                (
                    message ||
                    ""
                ).trim(),

            rfq_items:
                rfqItems

        };


        await emailjs.send(

            this.emailService,

            this.emailTemplate,

            payload

        );


        return payload;

    },


    /*
    ======================================================
    CLEAR USER RFQ BASKET
    ======================================================
    */

    async clearBasket() {

        if (
            typeof RFQ ===
            "undefined"
        ) {

            throw new Error(
                "RFQ basket engine is unavailable."
            );

        }


        const cleared =
            await RFQ.clear();


        if (!cleared) {

            throw new Error(
                "The RFQ basket could not be cleared."
            );

        }


        return true;

    },


    /*
    ======================================================
    SUBMIT
    ======================================================

    Options:

        {
            message: "Optional customer message"
        }

    Returns:

        {
            rfq,
            items,
            reference,
            emailPayload
        }
    ======================================================
    */

    async submit(
        options = {}
    ) {

        /*
        --------------------------------------------------
        VALIDATE SUPABASE
        --------------------------------------------------
        */

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            throw new Error(
                "Supabase client is unavailable."
            );

        }


        /*
        --------------------------------------------------
        AUTHENTICATED USER
        --------------------------------------------------
        */

        const user =
            await this.getUser();


        /*
        --------------------------------------------------
        PROFILE
        --------------------------------------------------
        */

        const profile =
            await this.getProfile(
                user.id
            );


        this.validateProfile(
            profile,
            user
        );


        /*
        --------------------------------------------------
        RFQ BASKET
        --------------------------------------------------
        */

        const items =
            await this.getItems();


        /*
        --------------------------------------------------
        CUSTOMER MESSAGE
        --------------------------------------------------
        */

        const message =
            (
                options.message ||
                ""
            ).trim();


        /*
        --------------------------------------------------
        CREATE RFQ
        --------------------------------------------------
        */

        const databaseResult =
            await this.createRFQTransaction(
                user,
                profile,
                items,
                message
            );

        const rfq =
            databaseResult.rfq;

        const createdItems =
            databaseResult.items;

        const reference =
            this.formatReference(
                rfq.rfq_number
            );


        /*
        --------------------------------------------------
        SEND EMAIL
        --------------------------------------------------
        */

        window.souviksAnalytics?.trackLead("rfq_account");

        let emailPayload;


        try {

            emailPayload =
                await this.sendEmail(

                    reference,

                    user,

                    profile,

                    items,

                    message

                );


        } catch (error) {

            SouviksErrors?.log("[Souviks RFQ] Email notification failed:", error, "error");


            /*
            --------------------------------------------------
            IMPORTANT

            The RFQ already exists in Supabase.

            Do NOT clear the basket here.

            This prevents the customer from losing their
            RFQ basket if the notification service fails.
            --------------------------------------------------
            */

            throw new Error(
                "Your RFQ was recorded successfully as " +
                reference +
                ", but the notification could not be sent. Please contact Souviks with this reference."
            );

        }


        /*
        --------------------------------------------------
        CLEAR BASKET
        --------------------------------------------------
        */

        try {

            await this.clearBasket();


        } catch (error) {

            SouviksErrors?.log("[Souviks RFQ] Basket clearing failed:", error, "error");


            /*
            --------------------------------------------------
            The RFQ itself was successful.

            We don't turn a successful submission into
            a failure merely because the basket cleanup
            failed.
            --------------------------------------------------
            */

        }


        /*
        --------------------------------------------------
        RETURN RESULT
        --------------------------------------------------
        */

        return {

            rfq,

            items:
                createdItems,

            reference,

            emailPayload

        };

    }

};

/* ===== auth/inquiries.js ===== */
/*
==========================================================
SOUVIKS — MY INQUIRIES
==========================================================

Displays authenticated user's previously submitted RFQs.

Data source:

    public.rfqs
    public.rfq_items

Security:

    Supabase RLS limits records to auth.uid().
==========================================================
*/


const InquiryState = {
    rfqs: [],
    itemsByRFQ: {},
    filter: "all",
    repeatSubmitting: false
};


document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeInquiries();

    }
);


/*
==========================================================
INITIALIZE
==========================================================
*/

async function initializeInquiries() {

    /*
    ------------------------------------------------------
    The Account page may load this script before the
    account view is opened.
    ------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks Inquiries] Supabase client unavailable."
        );

        return;

    }


    /*
    ------------------------------------------------------
    If the inquiries container doesn't exist, there is
    nothing to initialize.
    ------------------------------------------------------
    */

    const container =
        document.getElementById(
            "accountInquiries"
        );


    if (!container) {

        return;

    }


    /*
    ------------------------------------------------------
    Expose refresh function for account.js
    ------------------------------------------------------
    */

    window.refreshAccountInquiries =
        loadInquiries;

    initializeInquiryFilters();


    /*
    ------------------------------------------------------
    Load immediately
    ------------------------------------------------------
    */

    await loadInquiries();

}


/*
==========================================================
LOAD INQUIRIES
==========================================================
*/

async function loadInquiries() {

    const loading =
        document.getElementById(
            "accountInquiriesLoading"
        );


    const empty =
        document.getElementById(
            "accountInquiriesEmpty"
        );


    const list =
        document.getElementById(
            "accountInquiriesList"
        );


    if (
        !loading ||
        !empty ||
        !list
    ) {

        return;

    }


    /*
    ------------------------------------------------------
    Initial state
    ------------------------------------------------------
    */

    loading.hidden =
        false;

    empty.hidden =
        true;

    list.hidden =
        true;


    list.innerHTML =
        "";


    try {

        /*
        --------------------------------------------------
        Get authenticated user
        --------------------------------------------------
        */

        const {
            data: authData,
            error: authError
        } =
            await supabaseClient.auth.getUser();


        if (authError) {

            throw authError;

        }


        const user =
            authData?.user;


        if (!user) {

            throw new Error(
                "Authentication required."
            );

        }


        /*
        --------------------------------------------------
        Fetch RFQs
        --------------------------------------------------
        */

        const {
            data: rfqs,
            error: rfqError
        } =
            await supabaseClient

                .from(
                    "rfqs"
                )

                .select(
                    `
                    id,
                    rfq_number,
                    customer_name,
                    customer_email,
                    customer_phone,
                    company,
                    gst_number,
                    is_business,
                    message,
                    status,
                    created_at,
                    updated_at
                    `
                )

                .eq(
                    "user_id",
                    user.id
                )

                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        if (rfqError) {

            throw rfqError;

        }


        /*
        --------------------------------------------------
        No inquiries
        --------------------------------------------------
        */

        if (
            !rfqs ||
            !rfqs.length
        ) {

            loading.hidden =
                true;

            empty.hidden =
                false;

            list.hidden =
                true;

            return;

        }


        /*
        --------------------------------------------------
        Fetch RFQ items
        --------------------------------------------------
        */

        const rfqIds =
            rfqs.map(
                rfq =>
                    rfq.id
            );


        const {
            data: items,
            error: itemsError
        } =
            await supabaseClient

                .from(
                    "rfq_items"
                )

                .select(
                    `
                    id,
                    rfq_id,
                    product_id,
                    part_number,
                    product_name,
                    brand,
                    quantity,
                    created_at
                    `
                )

                .in(
                    "rfq_id",
                    rfqIds
                )

                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                );


        if (itemsError) {

            throw itemsError;

        }


        /*
        --------------------------------------------------
        Group items by RFQ
        --------------------------------------------------
        */

        const itemsByRFQ =
            {};


        (
            items ||
            []
        ).forEach(
            item => {

                if (
                    !itemsByRFQ[
                        item.rfq_id
                    ]
                ) {

                    itemsByRFQ[
                        item.rfq_id
                    ] = [];

                }


                itemsByRFQ[
                    item.rfq_id
                ].push(
                    item
                );

            }
        );


        /*
        --------------------------------------------------
        Render
        --------------------------------------------------
        */

        InquiryState.rfqs = rfqs || [];
        InquiryState.itemsByRFQ = itemsByRFQ;

        loading.hidden = true;
        empty.hidden = true;

        renderInquiryList();


    } catch (error) {

        SouviksErrors?.log("[Souviks Inquiries] Failed to load inquiries:", error, "error");


        loading.hidden =
            true;


        empty.hidden =
            false;


        empty.textContent =
            getInquiryTranslation(
                "inquiriesLoadError",
                "Unable to load your inquiries. Please try again."
            );

    }

}


/*
==========================================================
INQUIRY FILTERS
==========================================================
*/

function initializeInquiryFilters() {
    const filter = document.getElementById("accountInquiryStatusFilter");
    if (!filter) return;

    filter.value = InquiryState.filter;
    filter.addEventListener("change", () => {
        InquiryState.filter = String(filter.value || "all").toLowerCase();
        renderInquiryList();
    });
}


function renderInquiryList() {
    const loading = document.getElementById("accountInquiriesLoading");
    const empty = document.getElementById("accountInquiriesEmpty");
    const filteredEmpty = document.getElementById("accountInquiriesFilterEmpty");
    const list = document.getElementById("accountInquiriesList");
    const count = document.getElementById("accountInquiriesCount");
    if (!list) return;

    const all = Array.isArray(InquiryState.rfqs) ? InquiryState.rfqs : [];
    const filtered = InquiryState.filter === "all"
        ? all
        : all.filter(rfq => normalizeInquiryStatus(rfq?.status) === InquiryState.filter);

    if (count) {
        count.textContent = getInquiryTranslation("inquiriesShowing", "Showing {shown} of {total}")
            .replace("{shown}", String(filtered.length))
            .replace("{total}", String(all.length));
    }

    if (loading) loading.hidden = true;

    if (!all.length) {
        if (empty) empty.hidden = false;
        if (filteredEmpty) filteredEmpty.hidden = true;
        list.hidden = true;
        list.innerHTML = "";
        return;
    }

    if (!filtered.length) {
        if (empty) empty.hidden = true;
        if (filteredEmpty) filteredEmpty.hidden = false;
        list.hidden = true;
        list.innerHTML = "";
        return;
    }

    if (empty) empty.hidden = true;
    if (filteredEmpty) filteredEmpty.hidden = true;

    list.innerHTML = filtered.map(rfq => renderInquiry(rfq, InquiryState.itemsByRFQ[rfq.id] || [])).join("");
    list.hidden = false;
    initializeInquiryDetails();
    initializeRepeatRFQ();
}


/*
==========================================================
RENDER INQUIRY
==========================================================
*/

function renderInquiry(
    rfq,
    items
) {

    const reference =
        formatRFQNumber(
            rfq.rfq_number
        );


    const date =
        formatInquiryDate(
            rfq.created_at
        );


    const status =
        formatStatus(
            rfq.status
        );

    const normalizedStatus =
        normalizeInquiryStatus(
            rfq.status
        );


    const itemCount =
        items.length;


    const itemLabel =
        itemCount === 1

            ? getInquiryTranslation(
                "inquiryItem",
                "item"
            )

            : getInquiryTranslation(
                "inquiryItems",
                "items"
            );


    return `

        <article
            class="account-inquiry-card"
            data-inquiry-id="${escapeHTML(
                rfq.id
            )}">


            <!-- ==================================
                 SUMMARY
            =================================== -->

            <button
                type="button"
                class="account-inquiry-summary"
                aria-expanded="false">


                <span
                    class="account-inquiry-main">


                    <span
                        class="account-inquiry-reference">

                        ${escapeHTML(
                            reference
                        )}

                    </span>


                    <span
                        class="account-inquiry-meta">

                        ${escapeHTML(
                            date
                        )}

                        ·

                        ${itemCount}

                        ${escapeHTML(
                            itemLabel
                        )}

                    </span>


                </span>


                <span
                    class="account-inquiry-status status-${normalizedStatus}">

                    ${escapeHTML(
                        status
                    )}

                </span>


                <span
                    class="account-inquiry-arrow"
                    aria-hidden="true">

                    ▼

                </span>


            </button>


            <!-- ==================================
                 DETAILS
            =================================== -->

            <div
                class="account-inquiry-details"
                hidden>


                ${renderInquiryDetails(
                    rfq,
                    items
                )}


            </div>


        </article>

    `;

}


/*
==========================================================
RENDER DETAILS
==========================================================
*/

function renderInquiryDetails(
    rfq,
    items
) {

    const products =
        items.length

            ? items
                .map(
                    item =>
                        `
                        <tr>

                            <td>
                                ${escapeHTML(
                                    item.part_number ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.product_name ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.brand ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    String(
                                        item.quantity ||
                                        0
                                    )
                                )}
                            </td>

                        </tr>
                        `
                )
                .join(
                    ""
                )

            : `
                <tr>

                    <td colspan="4">

                        ${escapeHTML(
                            getInquiryTranslation(
                                "inquiriesNoItems",
                                "No products were recorded for this inquiry."
                            )
                        )}

                    </td>

                </tr>
            `;


    return `

        <div
            class="account-inquiry-content">


            <!-- ==================================
                 PRODUCTS
            =================================== -->

            <section
                class="account-inquiry-products">


                <h3>

                    ${escapeHTML(
                        getInquiryTranslation(
                            "inquiriesProducts",
                            "Products"
                        )
                    )}

                </h3>


                <div
                    class="account-inquiry-table-wrapper">


                    <table
                        class="account-inquiry-table">


                        <thead>

                            <tr>

                                <th>

                                    ${escapeHTML(
                                        getInquiryTranslation(
                                            "inquiriesPartNumber",
                                            "Part Number"
                                        )
                                    )}

                                </th>

                                <th>

                                    ${escapeHTML(
                                        getInquiryTranslation(
                                            "inquiriesProduct",
                                            "Product"
                                        )
                                    )}

                                </th>

                                <th>

                                    ${escapeHTML(
                                        getInquiryTranslation(
                                            "inquiriesBrand",
                                            "Brand"
                                        )
                                    )}

                                </th>

                                <th>

                                    ${escapeHTML(
                                        getInquiryTranslation(
                                            "inquiriesQuantity",
                                            "Quantity"
                                        )
                                    )}

                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            ${products}

                        </tbody>


                    </table>


                </div>


            </section>


            <!-- ==================================
                 CUSTOMER
            =================================== -->

            <section
                class="account-inquiry-customer">


                <h3>

                    ${escapeHTML(
                        getInquiryTranslation(
                            "inquiriesCustomer",
                            "Customer Information"
                        )
                    )}

                </h3>


                <dl>

                    <div>

                        <dt>
                            ${escapeHTML(
                                getInquiryTranslation(
                                    "inquiriesName",
                                    "Name"
                                )
                            )}
                        </dt>

                        <dd>
                            ${escapeHTML(
                                rfq.customer_name ||
                                "—"
                            )}
                        </dd>

                    </div>


                    <div>

                        <dt>
                            ${escapeHTML(
                                getInquiryTranslation(
                                    "inquiriesEmail",
                                    "Email"
                                )
                            )}
                        </dt>

                        <dd>
                            ${escapeHTML(
                                rfq.customer_email ||
                                "—"
                            )}
                        </dd>

                    </div>


                    <div>

                        <dt>
                            ${escapeHTML(
                                getInquiryTranslation(
                                    "inquiriesPhone",
                                    "Phone"
                                )
                            )}
                        </dt>

                        <dd>
                            ${escapeHTML(
                                rfq.customer_phone ||
                                "—"
                            )}
                        </dd>

                    </div>


                    <div>

                        <dt>
                            ${escapeHTML(
                                getInquiryTranslation(
                                    "inquiriesCompany",
                                    "Company"
                                )
                            )}
                        </dt>

                        <dd>
                            ${escapeHTML(
                                rfq.company ||
                                "—"
                            )}
                        </dd>

                    </div>


                    ${
                        rfq.is_business
                            ? `

                                <div>

                                    <dt>
                                        ${escapeHTML(
                                            getInquiryTranslation(
                                                "inquiriesGst",
                                                "GST Number"
                                            )
                                        )}
                                    </dt>

                                    <dd>
                                        ${escapeHTML(
                                            rfq.gst_number ||
                                            "—"
                                        )}
                                    </dd>

                                </div>

                            `
                            : ""
                    }


                </dl>


            </section>


            <!-- ==================================
                 MESSAGE
            =================================== -->

            ${
                rfq.message
                    ? `

                        <section
                            class="account-inquiry-message">


                            <h3>

                                ${escapeHTML(
                                    getInquiryTranslation(
                                        "inquiriesMessage",
                                        "Additional Notes"
                                    )
                                )}

                            </h3>


                            <p>

                                ${escapeHTML(
                                    rfq.message
                                )}

                            </p>


                        </section>

                    `
                    : ""
            }


            <!-- ==================================
                 STATUS + ACTIONS
            =================================== -->

            <section
                class="account-inquiry-actions">

                <div
                    class="account-inquiry-progress-wrap">

                    <h3>

                        ${escapeHTML(
                            getInquiryTranslation(
                                "inquiryStatusTimeline",
                                "RFQ Status"
                            )
                        )}

                    </h3>

                    ${renderInquiryProgress(rfq.status)}

                </div>

                <div
                    class="account-inquiry-action-row">

                    <button
                        type="button"
                        class="btn btn-primary account-repeat-rfq"
                        data-repeat-rfq-id="${escapeHTML(rfq.id)}">

                        ${escapeHTML(
                            getInquiryTranslation(
                                "inquiryRepeatRFQ",
                                "Repeat this RFQ"
                            )
                        )}

                    </button>

                    <a
                        href="?view=rfq"
                        class="btn btn-secondary"
                        data-account-view="rfq">

                        ${escapeHTML(
                            getInquiryTranslation(
                                "inquiryOpenRFQ",
                                "Open RFQ Basket"
                            )
                        )}

                    </a>

                </div>

                <div
                    class="account-inquiry-repeat-status form-status"
                    role="status"
                    aria-live="polite"
                    hidden>
                </div>

            </section>


        </div>

    `;

}


/*
==========================================================
INQUIRY STATUS PROGRESS
==========================================================
*/

function renderInquiryProgress(status) {

    const normalized =
        normalizeInquiryStatus(status);

    const steps = [
        "submitted",
        "processing",
        "quoted",
        "completed"
    ];

    const cancelled =
        normalized === "cancelled";

    const currentIndex =
        steps.indexOf(normalized);

    const items = steps.map(
        (step, index) => {

            const state =
                cancelled
                    ? ""
                    : index < currentIndex
                        ? "is-complete"
                        : index === currentIndex
                            ? "is-current"
                            : "";

            return `
                <li class="account-inquiry-progress-step ${state}">
                    <span class="account-inquiry-progress-dot" aria-hidden="true"></span>
                    <span class="account-inquiry-progress-label">
                        ${escapeHTML(formatStatus(step))}
                    </span>
                </li>
            `;

        }
    ).join("");

    return `
        <ol class="account-inquiry-progress" aria-label="${escapeHTML(
            getInquiryTranslation(
                "inquiryStatusTimeline",
                "RFQ Status"
            )
        )}">
            ${items}
            ${cancelled ? `
                <li class="account-inquiry-progress-step is-cancelled">
                    <span class="account-inquiry-progress-dot" aria-hidden="true"></span>
                    <span class="account-inquiry-progress-label">
                        ${escapeHTML(formatStatus("cancelled"))}
                    </span>
                </li>
            ` : ""}
        </ol>
    `;
}


/*
==========================================================
REPEAT RFQ
==========================================================
*/

function initializeRepeatRFQ() {

    document
        .querySelectorAll(".account-repeat-rfq")
        .forEach(button => {

            if (button.dataset.repeatBound === "true") {
                return;
            }

            button.dataset.repeatBound = "true";

            button.addEventListener("click", async () => {

                if (InquiryState.repeatSubmitting) {
                    return;
                }

                const rfqId =
                    String(button.dataset.repeatRfqId || "").trim();

                if (!rfqId) {
                    return;
                }

                const card =
                    button.closest(".account-inquiry-card");

                const statusElement =
                    card?.querySelector(
                        ".account-inquiry-repeat-status"
                    );

                const items =
                    InquiryState.itemsByRFQ[rfqId] || [];

                if (!items.length) {

                    showRepeatStatus(
                        statusElement,
                        getInquiryTranslation(
                            "inquiryRepeatNoItems",
                            "This RFQ has no recorded items to repeat."
                        ),
                        "error"
                    );

                    return;
                }

                InquiryState.repeatSubmitting = true;
                button.disabled = true;
                button.textContent = getInquiryTranslation(
                    "inquiryRepeatingRFQ",
                    "Adding to RFQ..."
                );
                showRepeatStatus(
                    statusElement,
                    "",
                    ""
                );

                try {

                    if (
                        typeof RFQ === "undefined" ||
                        typeof RFQ.get !== "function" ||
                        typeof RFQ.setQuantity !== "function"
                    ) {
                        throw new Error("RFQ basket unavailable.");
                    }

                    const existingItems =
                        await RFQ.get();

                    const existingById = new Map(
                        existingItems.map(item => [
                            String(item.id),
                            item
                        ])
                    );

                    const grouped = new Map();

                    items.forEach(item => {

                        const productId =
                            String(item.product_id || "").trim();

                        if (!productId) {
                            return;
                        }

                        const quantity = Math.max(
                            1,
                            Number(item.quantity) || 1
                        );

                        const current =
                            grouped.get(productId);

                        if (current) {
                            current.qty += quantity;
                            return;
                        }

                        grouped.set(productId, {
                            id: productId,
                            partNumber: item.part_number || "",
                            name: item.product_name || "",
                            brand: item.brand || "",
                            qty: quantity
                        });
                    });

                    let addedParts = 0;
                    let addedUnits = 0;
                    let failedParts = 0;

                    for (const item of grouped.values()) {

                        const existing =
                            existingById.get(item.id);

                        const targetQuantity =
                            (existing?.qty || 0) + item.qty;

                        const added =
                            await RFQ.setQuantity(
                                item.id,
                                item,
                                targetQuantity
                            );

                        if (added) {
                            addedParts += 1;
                            addedUnits += item.qty;
                        } else {
                            failedParts += 1;
                        }
                    }

                    if (!addedParts) {
                        throw new Error(
                            getInquiryTranslation(
                                "inquiryRepeatFailed",
                                "The RFQ could not be added to your basket. Please try again."
                            )
                        );
                    }

                    const successMessage =
                        getInquiryTranslation(
                            failedParts
                                ? "inquiryRepeatPartial"
                                : "inquiryRepeatSuccess",
                            failedParts
                                ? "Added {parts} parts ({units} units). Some items could not be added."
                                : "Added {parts} parts ({units} units) to your RFQ basket."
                        )
                            .replace("{parts}", String(addedParts))
                            .replace("{units}", String(addedUnits));

                    showRepeatStatus(
                        statusElement,
                        successMessage,
                        failedParts ? "warning" : "success"
                    );

                    button.textContent = getInquiryTranslation(
                        "inquiryRepeatedRFQ",
                        "Added to RFQ"
                    );

                    const actionRow =
                        card?.querySelector(
                            ".account-inquiry-action-row"
                        );

                    if (actionRow) {

                        actionRow
                            .querySelectorAll(
                                ".account-repeat-rfq"
                            )
                            .forEach(
                                element => {
                                    element.disabled = true;
                                }
                            );
                    }

                } catch (error) {

                    SouviksErrors?.log("[Souviks Inquiries] Repeat RFQ failed:", error, "error");

                    showRepeatStatus(
                        statusElement,
                        error?.message ||
                            getInquiryTranslation(
                                "inquiryRepeatFailed",
                                "The RFQ could not be added to your basket. Please try again."
                            ),
                        "error"
                    );

                    button.disabled = false;
                    button.textContent = getInquiryTranslation(
                        "inquiryRepeatRFQ",
                        "Repeat this RFQ"
                    );

                } finally {
                    InquiryState.repeatSubmitting = false;
                }

            });

        });

}


function showRepeatStatus(element, message, type = "") {

    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.className = "account-inquiry-repeat-status form-status";

    if (type) {
        element.classList.add(type);
    }

    element.hidden = !message;
}


/*
==========================================================
DETAIL TOGGLE
==========================================================
*/

function initializeInquiryDetails() {

    const cards =
        document.querySelectorAll(
            ".account-inquiry-card"
        );


    cards.forEach(
        card => {

            const button =
                card.querySelector(
                    ".account-inquiry-summary"
                );


            const details =
                card.querySelector(
                    ".account-inquiry-details"
                );


            if (
                !button ||
                !details
            ) {

                return;

            }


            button.addEventListener(
                "click",
                () => {

                    const expanded =
                        button.getAttribute(
                            "aria-expanded"
                        ) ===
                        "true";


                    button.setAttribute(
                        "aria-expanded",
                        String(
                            !expanded
                        )
                    );


                    details.hidden =
                        expanded;

                }
            );

        }
    );

}


/*
==========================================================
RFQ NUMBER
==========================================================
*/

function formatRFQNumber(
    number
) {

    if (
        number === null ||
        number === undefined ||
        number === ""
    ) {

        return getInquiryTranslation(
            "inquiryReferenceUnavailable",
            "RFQ"
        );

    }


    /*
    ------------------------------------------------------
    Database rfq_number is numeric.
    Display consistently as RFQ000001.
    ------------------------------------------------------
    */

    const numeric =
        Number(
            number
        );


    if (
        Number.isFinite(
            numeric
        )
    ) {

        return (
            "RFQ" +
            String(
                numeric
            ).padStart(
                6,
                "0"
            )
        );

    }


    return String(
        number
    );

}


/*
==========================================================
DATE
==========================================================
*/

function formatInquiryDate(
    value
) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        document.documentElement.lang ||
        "en",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"
        }
    ).format(
        date
    );

}


function normalizeInquiryStatus(
    status
) {
    const value = String(status || "submitted").trim().toLowerCase();
    const allowed = ["submitted", "processing", "quoted", "completed", "cancelled"];
    return allowed.includes(value) ? value : "submitted";
}


/*
==========================================================
STATUS
==========================================================
*/

function formatStatus(
    status
) {

    const value =
        String(
            status ||
            "submitted"
        )
            .trim()
            .toLowerCase();


    const translations = {

        submitted:
            getInquiryTranslation(
                "inquiryStatusSubmitted",
                "Submitted"
            ),

        processing:
            getInquiryTranslation(
                "inquiryStatusProcessing",
                "Processing"
            ),

        quoted:
            getInquiryTranslation(
                "inquiryStatusQuoted",
                "Quoted"
            ),

        completed:
            getInquiryTranslation(
                "inquiryStatusCompleted",
                "Completed"
            ),

        cancelled:
            getInquiryTranslation(
                "inquiryStatusCancelled",
                "Cancelled"
            )

    };


    return (
        translations[value] ||
        status ||
        "Submitted"
    );

}


/*
==========================================================
ESCAPE HTML
==========================================================
*/

function escapeHTML(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/*
==========================================================
TRANSLATION HELPER
==========================================================
*/

function getInquiryTranslation(
    key,
    fallback
) {

    /*
    ------------------------------------------------------
    The account page can expose translations through
    data attributes in the future.

    Until then, fallback text keeps the component
    functional.
    ------------------------------------------------------
    */

    const html =
        document.documentElement;


    const datasetKey =
        key.replace(
            /[A-Z]/g,
            letter =>
                `-${letter.toLowerCase()}`
        );


    return (
        html.dataset[
            datasetKey
        ] ||
        fallback
    );

}

/* ===== auth/saved.js ===== */
/*
==========================================================
SOUVIKS — ACCOUNT SAVED PRODUCTS
==========================================================
*/


const AccountSavedState = {
    catalogue: null,
    cataloguePromise: null
};


async function refreshAccountSaved() {

    const loading =
        document.getElementById(
            "accountSavedLoading"
        );

    const empty =
        document.getElementById(
            "accountSavedEmpty"
        );

    const list =
        document.getElementById(
            "accountSavedList"
        );


    if (
        !loading ||
        !empty ||
        !list
    ) {

        return;

    }


    loading.hidden =
        false;

    empty.hidden =
        true;

    list.hidden =
        true;

    list.innerHTML =
        "";


    try {

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            throw new Error(
                "Supabase client unavailable."
            );

        }


        const {
            data: userData,
            error: userError
        } =
            await supabaseClient.auth.getUser();


        if (userError) {

            throw userError;

        }


        const user =
            userData?.user;


        if (!user) {

            throw new Error(
                "User is not authenticated."
            );

        }


        const {
            data,
            error
        } =
            await supabaseClient

                .from(
                    "saved_products"
                )

                .select(
                    "product_id, created_at"
                )

                .eq(
                    "user_id",
                    user.id
                )

                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            throw error;

        }


        const savedRows =
            data || [];


        loading.hidden =
            true;


        if (!savedRows.length) {

            empty.hidden =
                false;

            return;

        }


        /*
        --------------------------------------------------
        Resolve saved IDs against existing catalogue.
        --------------------------------------------------
        */

        const savedIds =
            new Set(
                savedRows.map(
                    row =>
                        String(
                            row.product_id
                        )
                )
            );


        const products =
            await getAccountSavedProducts();

        const productById = new Map(
            products.map(product => [String(product.id), product])
        );

        const savedProducts = savedRows
            .map(row => productById.get(String(row.product_id)))
            .filter(Boolean);


        /*
        --------------------------------------------------
        Handle products that no longer exist.
        --------------------------------------------------
        */

        if (!savedProducts.length) {

            empty.hidden =
                false;

            return;

        }


        list.innerHTML =
            savedProducts
                .map(
                    renderAccountSavedProduct
                )
                .join(
                    ""
                );


        list.hidden =
            false;


        /*
        --------------------------------------------------
        Make sure the current saved state is reflected.
        --------------------------------------------------
        */

        if (
            typeof SavedProducts !==
            "undefined"
        ) {

            SavedProducts.updateButtons();

        }

    }

    catch (error) {

        SouviksErrors?.log("[Souviks Account] Failed to load saved products:", error, "error");


        loading.hidden =
            true;


        empty.hidden =
            false;


        empty.innerHTML = `

            <p>
                Unable to load your saved products.
                Please try again.
            </p>

        `;

    }

}


/*
==========================================================
GET CATALOGUE
==========================================================
*/

async function getAccountSavedProducts() {
    if (Array.isArray(AccountSavedState.catalogue)) {
        return AccountSavedState.catalogue;
    }

    if (AccountSavedState.cataloguePromise) {
        return AccountSavedState.cataloguePromise;
    }

    AccountSavedState.cataloguePromise = fetch("/assets/data/products.json", {
        credentials: "same-origin",
        cache: "no-store"
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Catalogue request failed (${response.status})`);
            }
            return response.json();
        })
        .then(payload => {
            const products = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.products)
                    ? payload.products
                    : [];
            AccountSavedState.catalogue = products;
            return products;
        })
        .catch(error => {
            AccountSavedState.cataloguePromise = null;
            throw error;
        });

    return AccountSavedState.cataloguePromise;
}


/*
==========================================================
RENDER SAVED PRODUCT
==========================================================
*/

function renderAccountSavedProduct(
    product
) {

    const productId =
        String(
            product.id
        );


    const image =
        String(
            product.image_url ||
            ""
        ).trim() ||
        (product.gallery && product.gallery.length
            ? `/assets/images/products/${product.image_folder}/${product.gallery[0]}`
            : product.primary_image && product.image_folder
                ? `/assets/images/products/${product.image_folder}/${product.primary_image}`
                : "/assets/images/placeholder.webp");


    return `

        <article
            class="account-saved-card">

            <a
                href="${Utils.productUrl(product)}"
                class="account-saved-image">

                <img
                    src="${image}"
                    alt="${product.product_name}"
                    ${Utils.responsiveImageAttrs(image, product.gallery_dimensions?.[product.gallery?.[0]], '(max-width: 640px) 92vw, 280px', 'lazy')}
                >

            </a>


            <div
                class="account-saved-content">

                <div
                    class="account-saved-id">

                    ${product.id}

                </div>


                <h3>

                    <a
                        href="${Utils.productUrl(product)}">

                        ${product.product_name}

                    </a>

                </h3>


                <p
                    class="account-saved-brand">

                    ${product.brand_name || ""}

                </p>


                <div
                    class="account-saved-actions">

                    <a
                        href="${Utils.productUrl(product)}"
                        class="btn btn-secondary">
                        View Product
                    </a>

                    <button
                        type="button"
                        class="btn btn-primary account-saved-add-rfq"
                        data-account-saved-add-rfq="${productId}"
                        data-id="${productId}"
                        data-part="${escapeSavedHTML(product.part_number || product.partNumber || "")}"
                        data-name="${escapeSavedHTML(product.product_name || product.name || "")}"
                        data-brand="${escapeSavedHTML(product.brand_name || product.brand || "")}">
                        Add to RFQ
                    </button>

                    <button
                        type="button"
                        class="btn btn-link account-saved-remove"
                        data-account-saved-remove="${productId}">
                        Remove
                    </button>

                </div>

            </div>

        </article>

    `;

}


function escapeSavedHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


document.addEventListener("click", async event => {

    const addButton = event.target.closest(".account-saved-add-rfq");
    if (addButton) {
        event.preventDefault();
        if (typeof RFQ === "undefined" || addButton.disabled) return;
        addButton.disabled = true;
        try {
            const added = await RFQ.add({
                id: addButton.dataset.id,
                partNumber: addButton.dataset.part || "",
                name: addButton.dataset.name || "",
                brand: addButton.dataset.brand || ""
            });
            if (added) {
                const original = addButton.textContent;
                addButton.textContent = "Added to RFQ";
                window.setTimeout(() => {
                    addButton.textContent = original;
                    addButton.disabled = false;
                }, 1400);
                return;
            }
        } catch (error) {
            SouviksErrors?.log("[Souviks Account] Unable to add saved product to RFQ:", error, "error");
        }
        addButton.disabled = false;
        return;
    }

    const removeButton = event.target.closest(".account-saved-remove");
    if (!removeButton) return;
    event.preventDefault();
    if (removeButton.disabled) return;
    const productId = removeButton.dataset.accountSavedRemove;
    if (!productId) return;
    removeButton.disabled = true;
    try {
        if (typeof SavedProducts !== "undefined") {
            const removed = await SavedProducts.remove(productId);
            if (removed) {
                return;
            }
        }
    } catch (error) {
        SouviksErrors?.log("[Souviks Account] Unable to remove saved product:", error, "error");
    }
    removeButton.disabled = false;
});


window.refreshAccountSaved =
    refreshAccountSaved;

/* ===== auth/vehicles.js ===== */
/*
==========================================================
SOUVIKS — MY VEHICLES
==========================================================

Persistent customer vehicle garage backed by Supabase.
The account's authenticated user_id is always used for
CRUD operations; RLS must enforce the same ownership rule.
*/

const AccountVehiclesState = {
    vehicles: [],
    catalogue: [],
    editingId: null,
    busy: false
};

window.AccountVehiclesState = AccountVehiclesState;


document.addEventListener("DOMContentLoaded", () => {
    initializeAccountVehicles();
});


async function initializeAccountVehicles() {
    if (typeof supabaseClient === "undefined") {
        console.error("[Souviks Vehicles] Supabase client unavailable.");
        return;
    }

    const list = document.getElementById("accountVehiclesList");
    if (!list) return;

    try {
        AccountVehiclesState.catalogue = await loadVehicleCatalogue();
        populateVehicleSelect();
    } catch (error) {
        SouviksErrors?.log("[Souviks Vehicles] Unable to load vehicle catalogue:", error, "error");
    }

    bindVehicleEvents();
    window.refreshAccountVehicles = loadAccountVehicles;
}


async function loadVehicleCatalogue() {
    const response = await fetch("/assets/data/vehicles.json", {
        credentials: "same-origin",
        cache: "no-store"
    });
    if (!response.ok) {
        throw new Error(`Vehicle catalogue returned ${response.status}.`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data.filter(vehicle => vehicle && vehicle.active !== false) : [];
}


function bindVehicleEvents() {
    document.getElementById("addAccountVehicle")?.addEventListener("click", () => openVehicleModal());
    document.getElementById("addFirstAccountVehicle")?.addEventListener("click", () => openVehicleModal());
    document.getElementById("cancelAccountVehicle")?.addEventListener("click", closeVehicleModal);
    document.querySelectorAll("[data-vehicle-modal-close]").forEach(element => {
        element.addEventListener("click", closeVehicleModal);
    });

    document.getElementById("accountVehicleForm")?.addEventListener("submit", event => {
        event.preventDefault();
        saveAccountVehicle();
    });

    document.getElementById("accountVehiclesList")?.addEventListener("click", event => {
        const action = event.target.closest("[data-vehicle-action]");
        if (!action) return;

        const id = action.dataset.vehicleId || "";
        const type = action.dataset.vehicleAction;

        if (type === "edit") openVehicleModal(id);
        if (type === "remove") removeAccountVehicle(id);
        if (type === "parts") openVehicleParts(id);
    });

    document.addEventListener("keydown", event => {
        const modal = document.getElementById("accountVehicleModal");
        if (event.key === "Escape" && modal && !modal.hidden) {
            closeVehicleModal();
        }
    });
}


async function getCurrentUserId() {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error("Authentication required.");
    return data.user.id;
}


async function loadAccountVehicles() {
    const loading = document.getElementById("accountVehiclesLoading");
    const empty = document.getElementById("accountVehiclesEmpty");
    const list = document.getElementById("accountVehiclesList");

    if (!loading || !empty || !list) return;

    loading.hidden = false;
    empty.hidden = true;
    list.hidden = true;
    list.innerHTML = "";
    showVehicleStatus("");

    try {
        const userId = await getCurrentUserId();
        const { data, error } = await supabaseClient
            .from("customer_vehicles")
            .select("id, vehicle_id, vehicle_model, nickname, registration_number, variant, model_year, notes, created_at, updated_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        AccountVehiclesState.vehicles = data || [];
        loading.hidden = true;

        if (typeof renderAccountVehicleRecommendations === "function") {
            renderAccountVehicleRecommendations(AccountVehiclesState.vehicles);
        }

        if (!AccountVehiclesState.vehicles.length) {
            empty.hidden = false;
            return;
        }

        list.innerHTML = AccountVehiclesState.vehicles.map(renderVehicleCard).join("");
        list.hidden = false;

    } catch (error) {
        SouviksErrors?.log("[Souviks Vehicles] Failed to load vehicles:", error, "error");
        loading.hidden = true;
        empty.hidden = false;
        empty.innerHTML = `
            <strong>${escapeVehicleHTML(getVehicleTranslation("vehiclesLoadError", "Unable to load your vehicles."))}</strong>
            <p>${escapeVehicleHTML(error?.message || getVehicleTranslation("vehiclesLoadError", "Please try again."))}</p>
            <button type="button" class="btn btn-secondary" id="retryAccountVehicles">${escapeVehicleHTML(getVehicleTranslation("vehiclesTryAgain", "Try Again"))}</button>
        `;
        document.getElementById("retryAccountVehicles")?.addEventListener("click", loadAccountVehicles, { once: true });
        showVehicleStatus(getVehicleTranslation("vehiclesSaveError", "Unable to load your vehicles. Please try again."), "error");
    }
}


function renderVehicleCard(vehicle) {
    const catalogue = AccountVehiclesState.catalogue.find(item => String(item.id) === String(vehicle.vehicle_id));
    const image = catalogue?.image || "/assets/images/placeholder.webp";
    const model = vehicle.vehicle_model || catalogue?.model || vehicle.vehicle_id || "Vehicle";
    const nickname = vehicle.nickname || "";
    const registration = vehicle.registration_number || "";
    const variant = vehicle.variant || "";
    const year = vehicle.model_year ? String(vehicle.model_year) : "";
    const meta = [variant, year].filter(Boolean).join(" · ");

    return `
        <article class="account-vehicle-card">
            <div class="account-vehicle-image">
                <img src="${escapeVehicleAttr(image)}" alt="${escapeVehicleAttr(model)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/assets/images/placeholder.webp';">
            </div>
            <div class="account-vehicle-content">
                <div class="account-vehicle-card-heading">
                    <div>
                        <span class="account-vehicle-model">${escapeVehicleHTML(model)}</span>
                        ${nickname ? `<strong class="account-vehicle-nickname">${escapeVehicleHTML(nickname)}</strong>` : ""}
                    </div>
                    ${registration ? `<span class="account-vehicle-registration">${escapeVehicleHTML(registration)}</span>` : ""}
                </div>
                ${meta ? `<p class="account-vehicle-meta">${escapeVehicleHTML(meta)}</p>` : ""}
                ${vehicle.notes ? `<p class="account-vehicle-notes">${escapeVehicleHTML(vehicle.notes)}</p>` : ""}
                <div class="account-vehicle-actions">
                    <button type="button" class="btn btn-primary" data-vehicle-action="parts" data-vehicle-id="${escapeVehicleAttr(vehicle.id)}">${escapeVehicleHTML(getVehicleTranslation("viewVehicleParts", "View Compatible Parts"))}</button>
                    <button type="button" class="btn btn-secondary" data-vehicle-action="edit" data-vehicle-id="${escapeVehicleAttr(vehicle.id)}">${escapeVehicleHTML(getVehicleTranslation("editVehicle", "Edit"))}</button>
                    <button type="button" class="btn btn-secondary" data-vehicle-action="remove" data-vehicle-id="${escapeVehicleAttr(vehicle.id)}">${escapeVehicleHTML(getVehicleTranslation("removeVehicle", "Remove"))}</button>
                </div>
            </div>
        </article>
    `;
}


function ensureVehiclePicker() {
    const select = document.getElementById("accountVehicleSelect");
    if (!select) return null;
    if (select.dataset.customPickerReady === "true") return select.closest(".account-vehicle-picker");

    const parent = select.parentElement;
    if (!parent) return null;

    const wrapper = document.createElement("div");
    wrapper.className = "account-vehicle-picker";
    parent.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    select.classList.add("account-vehicle-select-native");
    select.tabIndex = -1;
    const associatedLabel = document.querySelector('label[for="accountVehicleSelect"]');
    if (associatedLabel) associatedLabel.htmlFor = "accountVehiclePickerTrigger";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "account-vehicle-picker-trigger";
    trigger.id = "accountVehiclePickerTrigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `
        <span class="account-vehicle-picker-icon" aria-hidden="true">🚚</span>
        <span class="account-vehicle-picker-copy">
            <strong class="account-vehicle-picker-value"></strong>
            <small class="account-vehicle-picker-hint"></small>
        </span>
        <span class="account-vehicle-picker-chevron" aria-hidden="true">▾</span>
    `;

    const panel = document.createElement("div");
    panel.className = "account-vehicle-picker-panel";
    panel.id = "accountVehiclePickerPanel";
    panel.hidden = true;
    panel.setAttribute("role", "listbox");
    panel.setAttribute("aria-label", "Vehicle models");
    panel.innerHTML = `
        <input
            type="search"
            class="account-vehicle-picker-search"
            placeholder="${escapeVehicleAttr(getVehicleTranslation("searchVehicle", document.getElementById("accountMessages")?.dataset.searchVehicle || "Search vehicle..."))}"
            aria-label="${escapeVehicleAttr(getVehicleTranslation("searchVehicle", document.getElementById("accountMessages")?.dataset.searchVehicle || "Search vehicle..."))}"
            autocomplete="off">
        <div class="account-vehicle-picker-options"></div>
        <div class="account-vehicle-picker-empty" hidden>
            ${escapeVehicleHTML(getVehicleTranslation("noVehiclesFound", document.getElementById("accountMessages")?.dataset.noVehiclesFound || "No matching vehicles found."))}
        </div>
    `;

    wrapper.insertBefore(trigger, select);
    wrapper.insertBefore(panel, select);

    const valueEl = trigger.querySelector(".account-vehicle-picker-value");
    const hintEl = trigger.querySelector(".account-vehicle-picker-hint");
    const search = panel.querySelector(".account-vehicle-picker-search");
    const options = panel.querySelector(".account-vehicle-picker-options");

    const close = () => {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };

    const open = () => {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        search.value = "";
        renderVehiclePickerOptions("");
        setTimeout(() => search.focus(), 0);
    };

    const sync = () => {
        const selected = AccountVehiclesState.catalogue.find(item => String(item.id) === String(select.value));
        const model = selected?.model || "";
        valueEl.textContent = model || getVehicleTranslation("selectVehicle", "Select a vehicle");
        hintEl.textContent = model ? "Vehicle model" : "Choose from the catalogue";
        trigger.classList.toggle("has-value", !!model);
        [...options.querySelectorAll("[data-vehicle-picker-id]")].forEach(option => {
            const active = String(option.dataset.vehiclePickerId) === String(select.value);
            option.classList.toggle("is-selected", active);
            option.setAttribute("aria-selected", active ? "true" : "false");
        });
    };

    function renderVehiclePickerOptions(query) {
        const needle = String(query || "").trim().toLocaleLowerCase();
        const matches = AccountVehiclesState.catalogue.filter(vehicle =>
            String(vehicle.model || vehicle.id || "").toLocaleLowerCase().includes(needle)
        );
        options.innerHTML = matches.map(vehicle => `
            <button type="button" class="account-vehicle-picker-option" role="option"
                data-vehicle-picker-id="${escapeVehicleAttr(vehicle.id)}" aria-selected="false">
                <span class="account-vehicle-picker-option-icon" aria-hidden="true">🚚</span>
                <span class="account-vehicle-picker-option-copy">
                    <strong>${escapeVehicleHTML(vehicle.model || vehicle.id)}</strong>
                    <small>Vehicle model</small>
                </span>
            </button>
        `).join("");
        panel.querySelector(".account-vehicle-picker-empty").hidden = matches.length !== 0;
        [...options.querySelectorAll("[data-vehicle-picker-id]")].forEach(option => {
            option.addEventListener("click", () => {
                select.value = option.dataset.vehiclePickerId || "";
                select.dispatchEvent(new Event("change", { bubbles: true }));
                sync();
                close();
                trigger.focus();
            });
        });
        sync();
    }

    trigger.addEventListener("click", () => {
        if (panel.hidden) open(); else close();
    });

    search.addEventListener("input", () => renderVehiclePickerOptions(search.value));
    search.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            trigger.focus();
        }
    });

    select.addEventListener("change", sync);

    document.addEventListener("click", event => {
        if (!wrapper.contains(event.target)) close();
    });

    select.dataset.customPickerReady = "true";
    renderVehiclePickerOptions("");
    return wrapper;
}


function syncVehiclePicker() {
    const select = document.getElementById("accountVehicleSelect");
    const wrapper = select?.closest(".account-vehicle-picker");
    if (!wrapper) return;
    const trigger = wrapper.querySelector(".account-vehicle-picker-trigger");
    const valueEl = wrapper.querySelector(".account-vehicle-picker-value");
    const hintEl = wrapper.querySelector(".account-vehicle-picker-hint");
    const selected = AccountVehiclesState.catalogue.find(item => String(item.id) === String(select.value));
    const model = selected?.model || "";
    if (valueEl) valueEl.textContent = model || getVehicleTranslation("selectVehicle", "Select a vehicle");
    if (hintEl) hintEl.textContent = model ? "Vehicle model" : "Choose from the catalogue";
    trigger?.classList.toggle("has-value", !!model);
}


function populateVehicleSelect() {
    const select = document.getElementById("accountVehicleSelect");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = `<option value="">${escapeVehicleHTML(getVehicleTranslation("selectVehicle", "Select a vehicle"))}</option>` +
        AccountVehiclesState.catalogue.map(vehicle =>
            `<option value="${escapeVehicleAttr(vehicle.id)}">${escapeVehicleHTML(vehicle.model || vehicle.id)}</option>`
        ).join("");
    if (currentValue) select.value = currentValue;

    ensureVehiclePicker();
    syncVehiclePicker();
}


function openVehicleModal(vehicleId = "") {
    const modal = document.getElementById("accountVehicleModal");
    const title = document.getElementById("accountVehicleModalTitle");
    if (!modal) return;

    AccountVehiclesState.editingId = vehicleId || null;
    populateVehicleSelect();
    resetVehicleForm();

    const existing = vehicleId
        ? AccountVehiclesState.vehicles.find(vehicle => String(vehicle.id) === String(vehicleId))
        : null;

    if (existing) {
        document.getElementById("accountVehicleSelect").value = existing.vehicle_id || "";
        syncVehiclePicker();
        document.getElementById("accountVehicleLabel").value = existing.nickname || "";
        document.getElementById("accountVehicleRegistration").value = existing.registration_number || "";
        document.getElementById("accountVehicleVariant").value = existing.variant || "";
        document.getElementById("accountVehicleYear").value = existing.model_year || "";
        document.getElementById("accountVehicleNotes").value = existing.notes || "";
        title.textContent = getVehicleTranslation("editVehicleTitle", "Edit Vehicle");
    } else {
        title.textContent = getVehicleTranslation("addVehicleTitle", "Add Vehicle");
    }

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("account-vehicle-modal-open");
    setTimeout(() => document.getElementById("accountVehiclePickerTrigger")?.focus(), 0);
}


function closeVehicleModal() {
    const modal = document.getElementById("accountVehicleModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("account-vehicle-modal-open");
    AccountVehiclesState.editingId = null;
    resetVehicleForm();
}


function resetVehicleForm() {
    const form = document.getElementById("accountVehicleForm");
    if (form) form.reset();
    syncVehiclePicker();
    showVehicleFormStatus("");
    const button = document.getElementById("saveAccountVehicle");
    if (button) button.disabled = false;
}


async function saveAccountVehicle() {
    if (AccountVehiclesState.busy) return;

    const select = document.getElementById("accountVehicleSelect");
    const userLabel = document.getElementById("accountVehicleLabel");
    const registration = document.getElementById("accountVehicleRegistration");
    const variant = document.getElementById("accountVehicleVariant");
    const year = document.getElementById("accountVehicleYear");
    const notes = document.getElementById("accountVehicleNotes");
    const button = document.getElementById("saveAccountVehicle");

    const vehicleId = String(select?.value || "").trim();
    if (!vehicleId) {
        showVehicleFormStatus(getVehicleTranslation("vehicleRequired", "Please select a vehicle."), "error");
        document.getElementById("accountVehiclePickerTrigger")?.focus();
        return;
    }

    const catalogue = AccountVehiclesState.catalogue.find(item => String(item.id) === vehicleId);
    if (!catalogue) {
        showVehicleFormStatus(getVehicleTranslation("vehicleRequired", "Please select a vehicle."), "error");
        return;
    }

    const payload = {
        vehicle_id: vehicleId,
        vehicle_model: catalogue.model || vehicleId,
        nickname: String(userLabel?.value || "").trim() || null,
        registration_number: String(registration?.value || "").trim().toUpperCase() || null,
        variant: String(variant?.value || "").trim() || null,
        model_year: year?.value ? Number(year.value) : null,
        notes: String(notes?.value || "").trim() || null
    };

    if (payload.model_year && (!Number.isInteger(payload.model_year) || payload.model_year < 1950 || payload.model_year > 2100)) {
        showVehicleFormStatus(getVehicleTranslation("vehicleYearInvalid", "Please enter a valid model year."), "error");
        year?.focus();
        return;
    }

    AccountVehiclesState.busy = true;
    if (button) button.disabled = true;
    showVehicleFormStatus(getVehicleTranslation("saving", "Saving..."));

    try {
        const userId = await getCurrentUserId();
        let result;

        if (AccountVehiclesState.editingId) {
            result = await supabaseClient
                .from("customer_vehicles")
                .update(payload)
                .eq("id", AccountVehiclesState.editingId)
                .eq("user_id", userId)
                .select("id, vehicle_id, vehicle_model, nickname, registration_number, variant, model_year, notes, created_at, updated_at")
                .single();
        } else {
            result = await supabaseClient
                .from("customer_vehicles")
                .insert({ ...payload, user_id: userId })
                .select("id, vehicle_id, vehicle_model, nickname, registration_number, variant, model_year, notes, created_at, updated_at")
                .single();
        }

        if (result.error) throw result.error;

        showVehicleStatus(
            AccountVehiclesState.editingId
                ? getVehicleTranslation("vehicleUpdated", "Vehicle updated successfully.")
                : getVehicleTranslation("vehicleSaved", "Vehicle saved successfully."),
            "success"
        );
        closeVehicleModal();
        await loadAccountVehicles();
        document.getElementById("accountDashboardVehicleCount") && updateDashboardVehicleCount();

    } catch (error) {
        SouviksErrors?.log("[Souviks Vehicles] Failed to save vehicle:", error, "error");
        showVehicleFormStatus(getVehicleTranslation("vehicleSaveError", "Unable to save this vehicle. Please try again."), "error");
    } finally {
        AccountVehiclesState.busy = false;
        if (button) button.disabled = false;
    }
}


async function removeAccountVehicle(vehicleId) {
    const existing = AccountVehiclesState.vehicles.find(vehicle => String(vehicle.id) === String(vehicleId));
    if (!existing) return;

    const label = existing.nickname || existing.vehicle_model || getVehicleTranslation("myVehicles", "vehicle");
    const confirmed = window.confirm(`${getVehicleTranslation("removeVehicleConfirm", "Remove this vehicle from your account?")}\n\n${label}`);
    if (!confirmed) return;

    try {
        const userId = await getCurrentUserId();
        const { error } = await supabaseClient
            .from("customer_vehicles")
            .delete()
            .eq("id", vehicleId)
            .eq("user_id", userId);

        if (error) throw error;
        showVehicleStatus(getVehicleTranslation("vehicleRemoved", "Vehicle removed."), "success");
        await loadAccountVehicles();
        await updateDashboardVehicleCount();
    } catch (error) {
        SouviksErrors?.log("[Souviks Vehicles] Failed to remove vehicle:", error, "error");
        showVehicleStatus(getVehicleTranslation("vehicleSaveError", "Unable to update your vehicles. Please try again."), "error");
    }
}


function openVehicleParts(vehicleId) {
    const vehicle = AccountVehiclesState.catalogue.find(item => String(item.id) === String(vehicleId)) ||
        AccountVehiclesState.vehicles.find(item => String(item.id) === String(vehicleId));
    if (!vehicle) return;
    const slug = vehicle.slug || vehicle.vehicle_id || vehicleId;
    const lang = document.documentElement.lang || "en";
    window.location.href = `/${encodeURIComponent(lang)}/vehicles/${encodeURIComponent(slug)}`;
}


async function updateDashboardVehicleCount() {
    const target = document.getElementById("accountDashboardVehicleCount");
    if (!target) return;
    try {
        const userId = await getCurrentUserId();
        const { count, error } = await supabaseClient
            .from("customer_vehicles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId);
        target.textContent = error ? "—" : String(count ?? 0);
    } catch {
        target.textContent = "—";
    }
}


function showVehicleStatus(message, type = "") {
    const element = document.getElementById("accountVehiclesStatus");
    if (!element) return;
    element.textContent = message || "";
    element.className = "form-status";
    if (type) element.classList.add(type);
    element.hidden = !message;
}


function showVehicleFormStatus(message, type = "") {
    const element = document.getElementById("accountVehicleFormStatus");
    if (!element) return;
    element.textContent = message || "";
    element.className = "form-status";
    if (type) element.classList.add(type);
    element.hidden = !message;
}


function getVehicleTranslation(key, fallback) {
    const messages = document.getElementById("accountMessages");
    if (!messages) return fallback;
    const datasetKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    return messages.dataset[datasetKey] || fallback;
}


function escapeVehicleHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeVehicleAttr(value) {
    return escapeVehicleHTML(value);
}


/* ===== auth/vehicle-recommendations.js ===== */
/*
==========================================================
SOUVIKS — VEHICLE PART RECOMMENDATIONS
==========================================================

Connects the customer's saved vehicles to the existing
catalogue mapping in vehicles.json and surfaces a small,
useful set of compatible products on the account dashboard.

No extra database table is required. The source of truth for
vehicle/product compatibility remains the public catalogue.
==========================================================
*/

const AccountVehicleRecommendations = {
    products: [],
    loaded: false,
    loading: false,
    loadingPromise: null,
    vehicles: [],
    selectedVehicleId: ""
};


document.addEventListener("DOMContentLoaded", () => {
    initializeVehicleRecommendations();
});


async function initializeVehicleRecommendations() {
    const root = document.getElementById("accountVehiclePartsSection");
    if (!root) return;

    bindVehicleRecommendationEvents();

}


function bindVehicleRecommendationEvents() {
    const select = document.getElementById("accountVehiclePartsVehicle");
    if (!select || select.dataset.bound === "true") return;

    select.dataset.bound = "true";
    select.addEventListener("change", () => {
        AccountVehicleRecommendations.selectedVehicleId = select.value;
        syncVehicleRecommendationRichSelect(select);
        renderVehicleRecommendations();
    });

    if (document.documentElement.dataset.vehicleRichSelectBound !== "true") {
        document.documentElement.dataset.vehicleRichSelectBound = "true";

        document.addEventListener("click", event => {
            if (!event.target.closest(".account-rich-select")) {
                closeVehicleRecommendationRichSelect();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeVehicleRecommendationRichSelect();
            }
        });
    }
}


async function loadVehicleRecommendationProducts() {
    if (AccountVehicleRecommendations.loaded) {
        return AccountVehicleRecommendations.products;
    }

    if (AccountVehicleRecommendations.loadingPromise) {
        return AccountVehicleRecommendations.loadingPromise;
    }

    AccountVehicleRecommendations.loading = true;

    AccountVehicleRecommendations.loadingPromise = fetch("/assets/data/products.json", {
        credentials: "same-origin",
        cache: "no-store"
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Product catalogue returned ${response.status}.`);
            }
            return response.json();
        })
        .then(data => {
            AccountVehicleRecommendations.products = Array.isArray(data)
                ? data.filter(product => product && product.active !== false)
                : [];
            AccountVehicleRecommendations.loaded = true;
            return AccountVehicleRecommendations.products;
        })
        .finally(() => {
            AccountVehicleRecommendations.loading = false;
            AccountVehicleRecommendations.loadingPromise = null;
        });

    return AccountVehicleRecommendations.loadingPromise;
}


window.renderAccountVehicleRecommendations = async function(savedVehicles = []) {
    const root = document.getElementById("accountVehiclePartsSection");
    if (!root) return;

    AccountVehicleRecommendations.vehicles = Array.isArray(savedVehicles)
        ? savedVehicles
        : [];

    const loadingState = document.getElementById("accountVehiclePartsLoading");
    const emptyState = document.getElementById("accountVehiclePartsEmpty");
    const controls = document.getElementById("accountVehiclePartsControls");
    const list = document.getElementById("accountVehiclePartsList");

    if (!loadingState || !emptyState || !controls || !list) return;

    if (!AccountVehicleRecommendations.loaded) {
        loadingState.hidden = false;
        emptyState.hidden = true;
        controls.hidden = true;
        list.hidden = true;

        try {
            await loadVehicleRecommendationProducts();
        } catch (error) {
            SouviksErrors?.log("[Souviks Vehicle Parts] Product catalogue failed:", error, "error");
            renderVehicleRecommendationError();
            return;
        }
    }

    loadingState.hidden = true;

    if (!AccountVehicleRecommendations.vehicles.length) {
        controls.hidden = true;
        list.hidden = true;
        emptyState.hidden = false;
        emptyState.innerHTML = `
            <p>${escapeVehicleRecommendationHTML(
                getVehicleRecommendationTranslation(
                    "vehiclePartsNoVehicles",
                    "Add a vehicle to see compatible parts here."
                )
            )}</p>
            <a href="${getAccountPath("vehicles")}" class="btn btn-primary">
                ${escapeVehicleRecommendationHTML(
                    getVehicleRecommendationTranslation(
                        "addVehicle",
                        "Add Vehicle"
                    )
                )}
            </a>
        `;
        return;
    }

    emptyState.hidden = true;
    controls.hidden = false;
    list.hidden = false;

    populateVehicleRecommendationSelect();
    renderVehicleRecommendations();
};


function populateVehicleRecommendationSelect() {
    const select = document.getElementById("accountVehiclePartsVehicle");
    if (!select) return;

    const existing = AccountVehicleRecommendations.vehicles.find(vehicle =>
        String(vehicle.id) === String(AccountVehicleRecommendations.selectedVehicleId)
    );

    if (!existing) {
        AccountVehicleRecommendations.selectedVehicleId = String(
            AccountVehicleRecommendations.vehicles[0]?.id || ""
        );
    }

    select.innerHTML = AccountVehicleRecommendations.vehicles.map(vehicle => {
        const catalogue = findCatalogueVehicle(vehicle.vehicle_id);
        const model = vehicle.vehicle_model || catalogue?.model || vehicle.vehicle_id || "Vehicle";
        const label = vehicle.nickname
            ? `${vehicle.nickname} — ${model}`
            : model;

        return `
            <option value="${escapeVehicleRecommendationAttr(vehicle.id)}">
                ${escapeVehicleRecommendationHTML(label)}
            </option>
        `;
    }).join("");

    select.value = AccountVehicleRecommendations.selectedVehicleId;
    renderVehicleRecommendationRichSelect(select);
}


function getVehicleFamily(model = "") {
    const name = String(model || "").trim().toLowerCase();

    if (name.includes("tata")) return { key: "tata", label: "Tata", icon: "/assets/icons/vehicle.svg" };
    if (name.includes("ashok leyland") || name.includes("ashok")) return { key: "ashok-leyland", label: "Ashok Leyland", icon: "/assets/icons/vehicle.svg" };
    if (name.includes("mahindra")) return { key: "mahindra", label: "Mahindra", icon: "/assets/icons/vehicle.svg" };
    if (name.includes("eicher")) return { key: "eicher", label: "Eicher", icon: "/assets/icons/vehicle.svg" };
    if (name.includes("bharatbenz") || name.includes("bharat benz")) return { key: "bharatbenz", label: "BharatBenz", icon: "/assets/icons/vehicle.svg" };
    if (/tractor|swaraj|massey|farmtrac|sonalika|deutz|utility/.test(name)) {
        return { key: "utility", label: "Tractors & Utility", icon: "/assets/icons/vehicle.svg" };
    }

    return { key: "other", label: "Other Vehicles", icon: "/assets/icons/vehicle.svg" };
}


function getVehicleCatalogueImage(catalogueVehicle) {
    return String(
        catalogueVehicle?.image ||
        catalogueVehicle?.cutout ||
        catalogueVehicle?.hero ||
        ""
    ).trim() || "/assets/images/placeholder.webp";
}


function getSavedVehicleDisplay(vehicle) {
    const catalogue = findCatalogueVehicle(vehicle.vehicle_id);
    const model = String(
        vehicle.vehicle_model ||
        catalogue?.model ||
        vehicle.vehicle_id ||
        "Vehicle"
    ).trim();

    return {
        catalogue,
        model,
        primary: String(vehicle.nickname || model).trim(),
        secondary: vehicle.nickname ? model : ""
    };
}


function renderVehicleRecommendationRichSelect(select) {
    if (!select) return;

    let wrapper = select.parentElement?.querySelector(".account-rich-select");

    if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "account-rich-select";
        wrapper.innerHTML = `
            <button
                type="button"
                class="account-rich-select-trigger"
                aria-haspopup="listbox"
                aria-expanded="false">
            </button>
            <div
                class="account-rich-select-panel"
                role="listbox"
                hidden>
            </div>
        `;
        select.insertAdjacentElement("afterend", wrapper);

        const trigger = wrapper.querySelector(".account-rich-select-trigger");
        trigger.addEventListener("click", () => {
            const expanded = trigger.getAttribute("aria-expanded") === "true";
            if (expanded) {
                closeVehicleRecommendationRichSelect();
            } else {
                closeVehicleRecommendationRichSelect();
                trigger.setAttribute("aria-expanded", "true");
                wrapper.querySelector(".account-rich-select-panel").hidden = false;
            }
        });
    }

    select.classList.add("account-rich-select-source");

    const panel = wrapper.querySelector(".account-rich-select-panel");
    const selectedId = String(AccountVehicleRecommendations.selectedVehicleId || select.value || "");
    const groups = new Map();

    AccountVehicleRecommendations.vehicles.forEach(vehicle => {
        const display = getSavedVehicleDisplay(vehicle);
        const family = getVehicleFamily(display.model);
        if (!groups.has(family.key)) {
            groups.set(family.key, { family, vehicles: [] });
        }
        groups.get(family.key).vehicles.push({ vehicle, display });
    });

    panel.innerHTML = Array.from(groups.values()).map(group => `
        <section class="account-rich-select-group">
            <div class="account-rich-select-group-label">
                <span class="account-rich-select-group-icon" aria-hidden="true"><img src="/assets/icons/vehicle.svg" alt="" width="24" height="24"></span>
                <span>${escapeVehicleRecommendationHTML(group.family.label)}</span>
            </div>
            <div>
                ${group.vehicles.map(({ vehicle, display }) => {
                    const id = String(vehicle.id);
                    const selected = id === selectedId;
                    const image = getVehicleCatalogueImage(display.catalogue);
                    return `
                        <button
                            type="button"
                            class="account-rich-select-option"
                            role="option"
                            aria-selected="${selected ? "true" : "false"}"
                            data-vehicle-recommendation-id="${escapeVehicleRecommendationAttr(id)}">
                            <span class="account-rich-select-option-thumb">
                                <img
                                    src="${escapeVehicleRecommendationAttr(image)}"
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    onerror="this.onerror=null;this.src='/assets/images/placeholder.webp';">
                            </span>
                            <span class="account-rich-select-option-copy">
                                <strong>${escapeVehicleRecommendationHTML(display.primary)}</strong>
                                ${display.secondary ? `<small>${escapeVehicleRecommendationHTML(display.secondary)}</small>` : ""}
                            </span>
                            <span class="account-rich-select-option-check" aria-hidden="true">${selected ? "✓" : ""}</span>
                        </button>
                    `;
                }).join("")}
            </div>
        </section>
    `).join("");

    panel.querySelectorAll("[data-vehicle-recommendation-id]").forEach(option => {
        option.addEventListener("click", () => {
            const value = option.getAttribute("data-vehicle-recommendation-id") || "";
            select.value = value;
            AccountVehicleRecommendations.selectedVehicleId = value;
            syncVehicleRecommendationRichSelect(select);
            closeVehicleRecommendationRichSelect();
            select.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });

    syncVehicleRecommendationRichSelect(select);
}


function syncVehicleRecommendationRichSelect(select) {
    if (!select) return;

    const wrapper = select.parentElement?.querySelector(".account-rich-select");
    if (!wrapper) return;

    const trigger = wrapper.querySelector(".account-rich-select-trigger");
    const current = AccountVehicleRecommendations.vehicles.find(vehicle =>
        String(vehicle.id) === String(select.value)
    );

    if (!trigger || !current) return;

    const display = getSavedVehicleDisplay(current);
    const image = getVehicleCatalogueImage(display.catalogue);

    trigger.innerHTML = `
        <span class="account-rich-select-trigger-thumb">
            <img
                src="${escapeVehicleRecommendationAttr(image)}"
                alt=""
                loading="lazy"
                decoding="async"
                onerror="this.onerror=null;this.src='/assets/images/placeholder.webp';">
        </span>
        <span class="account-rich-select-trigger-copy">
            <strong>${escapeVehicleRecommendationHTML(display.primary)}</strong>
            ${display.secondary ? `<small>${escapeVehicleRecommendationHTML(display.secondary)}</small>` : ""}
        </span>
        <span class="account-rich-select-chevron" aria-hidden="true">⌄</span>
    `;

    wrapper.querySelectorAll("[data-vehicle-recommendation-id]").forEach(option => {
        const selected = String(option.getAttribute("data-vehicle-recommendation-id")) === String(select.value);
        option.setAttribute("aria-selected", selected ? "true" : "false");
        const check = option.querySelector(".account-rich-select-option-check");
        if (check) check.textContent = selected ? "✓" : "";
    });
}


function closeVehicleRecommendationRichSelect() {
    document.querySelectorAll(".account-rich-select").forEach(wrapper => {
        const trigger = wrapper.querySelector(".account-rich-select-trigger");
        const panel = wrapper.querySelector(".account-rich-select-panel");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        if (panel) panel.hidden = true;
    });
}



function renderVehicleRecommendations() {
    const selected = AccountVehicleRecommendations.vehicles.find(vehicle =>
        String(vehicle.id) === String(AccountVehicleRecommendations.selectedVehicleId)
    );

    const list = document.getElementById("accountVehiclePartsList");
    const count = document.getElementById("accountVehiclePartsCount");
    const title = document.getElementById("accountVehiclePartsSelectedTitle");
    const browse = document.getElementById("accountVehiclePartsBrowse");

    if (!list || !count || !title || !browse) return;

    if (!selected) {
        list.innerHTML = "";
        count.textContent = "";
        title.textContent = "";
        browse.hidden = true;
        return;
    }

    const catalogueVehicle = findCatalogueVehicle(selected.vehicle_id);
    const products = resolveVehicleProducts(catalogueVehicle, selected.vehicle_model);

    const visibleProducts = products.slice(0, 4);

    const model = selected.vehicle_model || catalogueVehicle?.model || selected.vehicle_id || "Vehicle";
    const label = selected.nickname
        ? `${selected.nickname} · ${model}`
        : model;

    title.textContent = label;
    count.textContent = `${products.length} ${getVehicleRecommendationTranslation(
        "vehiclePartsCompatibleCount",
        "compatible parts"
    )}`;

    if (catalogueVehicle?.slug) {
        browse.hidden = false;
        browse.href = getVehiclePath(catalogueVehicle.slug);
    } else {
        browse.hidden = true;
    }

    if (!visibleProducts.length) {
        list.innerHTML = `
            <div class="account-vehicle-parts-empty-inline">
                ${escapeVehicleRecommendationHTML(
                    getVehicleRecommendationTranslation(
                        "vehiclePartsNoMappedProducts",
                        "No compatible products are mapped to this vehicle yet."
                    )
                )}
            </div>
        `;
        return;
    }

    list.innerHTML = visibleProducts
        .map(renderVehicleRecommendationCard)
        .join("");
}


function resolveVehicleProducts(catalogueVehicle, vehicleModel = "") {
    const productMap = new Map(
        AccountVehicleRecommendations.products.map(product => [String(product.id), product])
    );

    if (Array.isArray(catalogueVehicle?.products) && catalogueVehicle.products.length) {
        return catalogueVehicle.products
            .map(id => productMap.get(String(id)))
            .filter(Boolean)
            .filter(product => product.active !== false);
    }

    const target = normalizeVehicleName(vehicleModel);
    if (!target) return [];

    return AccountVehicleRecommendations.products
        .filter(product => Array.isArray(product.vehicles))
        .filter(product => product.vehicles.some(name => normalizeVehicleName(name) === target))
        .slice(0, 50);
}


function renderVehicleRecommendationCard(product) {
    const image = String(
        product.image_url ||
        (product.image_folder && product.gallery?.[0]
            ? `/assets/images/products/${product.image_folder}/${product.gallery[0]}`
            : product.primary_image || "")
    ).trim() || "/assets/images/placeholder.webp";

    const productName = product.product_name || product.name || "Product";
    const brand = product.brand_name || product.brand || "";
    const part = product.part_number || product.partNumber || "";
    const sale = Number(product.selling_price);
    const mrp = Number(product.mrp);
    const hasSale = Number.isFinite(sale) && sale > 0;
    const hasMrp = Number.isFinite(mrp) && mrp > 0;
    const hasDiscount = hasSale && hasMrp && sale < mrp;

    let pricing = `<span class="account-vehicle-part-price-request">${escapeVehicleRecommendationHTML(
        getVehicleRecommendationTranslation("priceOnRequest", "Price on request")
    )}</span>`;

    if (hasSale) {
        pricing = `
            <span class="account-vehicle-part-price">₹${sale.toLocaleString("en-IN")}</span>
            ${hasDiscount ? `<span class="account-vehicle-part-mrp">₹${mrp.toLocaleString("en-IN")}</span>` : ""}
            ${hasDiscount ? `<span class="account-vehicle-part-discount">${Math.round(((mrp - sale) / mrp) * 100)}% OFF</span>` : ""}
        `;
    } else if (hasMrp) {
        pricing = `<span class="account-vehicle-part-price">₹${mrp.toLocaleString("en-IN")}</span>`;
    }

    const productUrl = getProductUrl(product);

    return `
        <article class="account-vehicle-part-card">
            <a href="${escapeVehicleRecommendationAttr(productUrl)}" class="account-vehicle-part-image">
                <img
                    src="${escapeVehicleRecommendationAttr(image)}"
                    alt="${escapeVehicleRecommendationAttr(productName)}"
                    loading="lazy"
                    decoding="async"
                    onerror="this.onerror=null;this.src='/assets/images/placeholder.webp';">
            </a>
            <div class="account-vehicle-part-content">
                <span class="account-vehicle-part-brand">${escapeVehicleRecommendationHTML(brand)}</span>
                <h4>
                    <a href="${escapeVehicleRecommendationAttr(productUrl)}">
                        ${escapeVehicleRecommendationHTML(productName)}
                    </a>
                </h4>
                ${part ? `<span class="account-vehicle-part-number">${escapeVehicleRecommendationHTML(part)}</span>` : ""}
                <div class="account-vehicle-part-pricing">${pricing}</div>
                <button
                    type="button"
                    class="btn btn-primary add-to-cart account-vehicle-part-rfq"
                    data-id="${escapeVehicleRecommendationAttr(product.id)}"
                    data-part="${escapeVehicleRecommendationAttr(part)}"
                    data-name="${escapeVehicleRecommendationAttr(productName)}"
                    data-brand="${escapeVehicleRecommendationAttr(brand)}">
                    ${escapeVehicleRecommendationHTML(
                        getVehicleRecommendationTranslation("addToRFQ", "Add to RFQ")
                    )}
                </button>
            </div>
        </article>
    `;
}


function findCatalogueVehicle(vehicleId) {
    const catalogue = Array.isArray(window.AccountVehiclesState?.catalogue)
        ? window.AccountVehiclesState.catalogue
        : [];

    return catalogue.find(vehicle => String(vehicle.id) === String(vehicleId)) || null;
}


function normalizeVehicleName(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}


function getProductUrl(product) {
    const lang = document.documentElement.lang || window.souviks?.currentLanguage || "en";
    const slug = product.slug || "";
    return `/${encodeURIComponent(lang)}/products/${encodeURIComponent(slug)}`;
}


function getVehiclePath(slug) {
    const lang = document.documentElement.lang || window.souviks?.currentLanguage || "en";
    return `/${encodeURIComponent(lang)}/vehicles/${encodeURIComponent(slug)}`;
}


function getAccountPath(view) {
    const lang = document.documentElement.lang || window.souviks?.currentLanguage || "en";
    return `/${encodeURIComponent(lang)}/account?view=${encodeURIComponent(view)}`;
}


function renderVehicleRecommendationError() {
    const loading = document.getElementById("accountVehiclePartsLoading");
    const empty = document.getElementById("accountVehiclePartsEmpty");
    const controls = document.getElementById("accountVehiclePartsControls");
    const list = document.getElementById("accountVehiclePartsList");

    if (loading) loading.hidden = true;
    if (controls) controls.hidden = true;
    if (list) list.hidden = true;

    if (empty) {
        empty.hidden = false;
        empty.innerHTML = `
            <p>${escapeVehicleRecommendationHTML(
                getVehicleRecommendationTranslation(
                    "vehiclePartsLoadError",
                    "Compatible parts could not be loaded right now."
                )
            )}</p>
        `;
    }
}


function getVehicleRecommendationTranslation(key, fallback) {
    const messages = document.getElementById("accountMessages");
    if (!messages) return fallback;

    const datasetKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    return messages.dataset[datasetKey] || fallback;
}


function escapeVehicleRecommendationHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeVehicleRecommendationAttr(value) {
    return escapeVehicleRecommendationHTML(value);
}


/* ===== auth/account.js ===== */
/*
==========================================================
SOUVIKS — ACCOUNT
==========================================================

Responsibilities:

    • Authentication guard
    • Load authenticated user
    • Load profile
    • Display profile
    • Edit profile
    • Business-account handling
    • Account section navigation
    • Embedded RFQ section
    • Privacy section
    • Logout remains handled by logout.js

Dependencies:

    • supabaseClient
    • RFQ
    • RFQSubmission
==========================================================
*/


document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
        ======================================================
        SUPABASE CHECK
        ======================================================
        */

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            console.error(
                "[Souviks Account] Supabase client unavailable."
            );

            return;

        }


        initializeAccount();

    }
);


/*
==========================================================
ACCOUNT STATE
==========================================================
*/

const AccountState = {

    user: null,

    profile: null,

    currentView: "account",

    editing: false,

    rfqSubmitting: false

};


/*
==========================================================
INITIALIZE ACCOUNT
==========================================================
*/

async function initializeAccount() {

    try {

        /*
        ------------------------------------------------------
        AUTHENTICATION
        ------------------------------------------------------
        */

        const {
            data,
            error
        } =
            await supabaseClient.auth.getUser();


        if (error) {

            throw error;

        }


        const user =
            data?.user;


        /*
        ------------------------------------------------------
        NOT AUTHENTICATED
        ------------------------------------------------------
        */

        if (!user) {

            redirectToLogin();

            return;

        }


        AccountState.user =
            user;


        document.addEventListener(
            "souviks:rfq-updated",
            event => {
                syncAccountRFQSummary(
                    event?.detail?.items || []
                );
            }
        );


        /*
        ------------------------------------------------------
        LOAD PROFILE
        ------------------------------------------------------
        */

        await loadProfile();


        /*
        ------------------------------------------------------
        DISPLAY ACCOUNT
        ------------------------------------------------------
        */

        renderProfile();

        renderEditForm();

        renderPrivacy();

        initializeDashboard();


        /*
        ------------------------------------------------------
        ACCOUNT NAVIGATION
        ------------------------------------------------------
        */

        initializeNavigation();


        /*
        ------------------------------------------------------
        PROFILE EDITING
        ------------------------------------------------------
        */

        initializeProfileEditing();


        /*
        ------------------------------------------------------
        SECURITY SETTINGS
        ------------------------------------------------------
        */

        initializeSecuritySettings();


        /*
        ------------------------------------------------------
        RFQ
        ------------------------------------------------------
        */

        initializeAccountRFQ();


        /*
        ------------------------------------------------------
        INITIAL VIEW
        ------------------------------------------------------
        */

        const requestedView =
            getRequestedView();


        showAccountView(
            requestedView
        );


        /*
        ------------------------------------------------------
        AUTHENTICATED
        ------------------------------------------------------
        */

        document.body.classList.remove(
            "account-auth-pending"
        );

        document.body.classList.add(
            "account-authenticated"
        );


    } catch (error) {

        SouviksErrors?.log("[Souviks Account] Initialization failed:", error, "error");


        showAccountStatus(
            getTranslation(
                "accountSessionExpired",
                "Your session has expired. Please sign in again."
            ),
            "error"
        );


        /*
        ------------------------------------------------------
        If authentication itself failed, return to login.
        ------------------------------------------------------
        */

        if (
            error?.message?.toLowerCase()
                .includes("auth")
        ) {

            redirectToLogin();

        }

    }

}


/*
==========================================================
LOAD PROFILE
==========================================================
*/

async function loadProfile() {

    if (
        !AccountState.user
    ) {

        throw new Error(
            "Authenticated user is unavailable."
        );

    }


    const {
        data,
        error
    } =
        await supabaseClient

            .from(
                "profiles"
            )

            .select(
                `
                id,
                full_name,
                phone,
                company,
                is_business,
                gst_number
                `
            )

            .eq(
                "id",
                AccountState.user.id
            )

            .maybeSingle();


    if (error) {

        throw error;

    }


    /*
    ------------------------------------------------------
    PROFILE DOES NOT EXIST
    ------------------------------------------------------
    */

    if (!data) {

        /*
        --------------------------------------------------
        Create an empty profile for the authenticated user.
        --------------------------------------------------
        */

        const {
            data: createdProfile,
            error: createError
        } =
            await supabaseClient

                .from(
                    "profiles"
                )

                .insert({

                    id:
                        AccountState.user.id,

                    full_name:
                        "",

                    phone:
                        "",

                    company:
                        "",

                    is_business:
                        false,

                    gst_number:
                        null

                })

                .select(
                    `
                    id,
                    full_name,
                    phone,
                    company,
                    is_business,
                    gst_number
                    `
                )

                .single();


        if (createError) {

            throw createError;

        }


        AccountState.profile =
            createdProfile;

        return;

    }


    AccountState.profile =
        data;

}


/*
==========================================================
GET REQUESTED ACCOUNT VIEW
==========================================================
*/

function getRequestedView() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const requested =
        (
            params.get(
                "view"
            ) ||
            ""
        )
            .trim()
            .toLowerCase();


    const allowedViews = [
        "account",
        "rfq",
        "privacy",
        "profile",
        "inquiries",
        "saved",
        "vehicles"
    ];


    if (
        allowedViews.includes(
            requested
        )
    ) {

        return requested;

    }


    return "account";

}


/*
==========================================================
ACCOUNT NAVIGATION
==========================================================
*/

function initializeNavigation() {

    /*
    ------------------------------------------------------
    Account views can be opened from the sidebar, dashboard
    cards, recent activity and other account-local links.
    ------------------------------------------------------
    */

    document.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest(
                    "a[data-account-view]"
                );


            if (!link) {
                return;
            }


            const view =
                String(
                    link.dataset.accountView || ""
                )
                    .trim()
                    .toLowerCase();


            if (!view) {
                return;
            }


            if (
                link.classList.contains("is-disabled")
            ) {
                event.preventDefault();
                return;
            }


            /* Only intercept actual account views. */
            const accountViews = [
                "account",
                "rfq",
                "inquiries",
                "privacy",
                "profile",
                "saved",
                "vehicles"
            ];


            if (!accountViews.includes(view)) {
                return;
            }


            event.preventDefault();

            showAccountView(
                view
            );

            updateUrl(
                view
            );

        }
    );

}


/*
==========================================================
ACCOUNT DASHBOARD
==========================================================
*/

function initializeDashboard() {

    const name =
        AccountState.profile?.full_name ||
        "Account";

    const company =
        AccountState.profile?.company ||
        "";

    const accountType =
        AccountState.profile?.is_business
            ? getTranslation(
                "accountBusinessAccountLabel",
                "Business Account"
            )
            : getTranslation(
                "accountIndividualAccount",
                "Individual Account"
            );

    setText(
        "accountDashboardName",
        name
    );

    setText(
        "accountDashboardCompany",
        company ||
        getTranslation(
            "accountDashboardIntro",
            "Manage RFQs, enquiries, saved parts and your profile from one place."
        )
    );

    setText(
        "accountDashboardType",
        accountType
    );

    renderDashboardProfileSummary();

    renderProfileCompletion();

    loadDashboardData();

}


function renderDashboardProfileSummary() {

    const profile =
        AccountState.profile || {};

    setText(
        "accountDashboardProfileName",
        profile.full_name
    );

    setText(
        "accountDashboardProfileEmail",
        AccountState.user?.email
    );

    setText(
        "accountDashboardProfilePhone",
        profile.phone
    );

    setText(
        "accountDashboardProfileCompany",
        profile.company ||
        getTranslation(
            "accountBusinessDetailsNotAdded",
            "Not added"
        )
    );

}


function getProfileCompletion() {

    const profile =
        AccountState.profile || {};

    const isBusiness =
        Boolean(profile.is_business);

    const checks = [
        Boolean(String(profile.full_name || "").trim()),
        Boolean(String(AccountState.user?.email || "").trim()),
        Boolean(String(profile.phone || "").trim())
    ];


    if (isBusiness) {

        checks.push(
            Boolean(String(profile.company || "").trim()),
            Boolean(String(profile.gst_number || "").trim())
        );

    }


    const total = checks.length;
    const completed = checks.filter(Boolean).length;
    const percent = total
        ? Math.round((completed / total) * 100)
        : 0;


    return {
        completed,
        total,
        percent,
        isBusiness
    };

}


function renderProfileCompletion() {

    const completion =
        getProfileCompletion();

    const bar =
        document.getElementById(
            "accountProfileCompletionBar"
        );

    const percent =
        document.getElementById(
            "accountProfileCompletionPercent"
        );

    const text =
        document.getElementById(
            "accountProfileCompletionText"
        );

    const action =
        document.getElementById(
            "accountProfileCompletionAction"
        );

    const emailStatus =
        document.getElementById(
            "accountDashboardEmailStatus"
        );


    if (bar) {
        bar.style.width = `${completion.percent}%`;
        bar.setAttribute(
            "aria-valuenow",
            String(completion.percent)
        );
    }


    if (percent) {
        percent.textContent =
            `${completion.percent}%`;
    }


    const completionText =
        completion.percent >= 100
            ? getTranslation(
                "accountProfileComplete",
                "Your profile is complete."
            )
            : getTranslation(
                "accountProfileNeedsAttention",
                "Complete your profile to keep RFQ and quotation information ready."
            );


    if (text) {
        text.textContent = completionText;
    }


    if (action) {
        action.hidden = completion.percent >= 100;
    }


    if (emailStatus) {

        const verified =
            Boolean(
                AccountState.user?.email_confirmed_at
            );

        emailStatus.textContent =
            verified
                ? getTranslation(
                    "accountEmailVerified",
                    "Email verified"
                )
                : getTranslation(
                    "accountEmailNotVerified",
                    "Email not verified"
                );

        emailStatus.classList.toggle(
            "is-verified",
            verified
        );

    }

}


async function loadDashboardData() {

    const rfqCount =
        document.getElementById(
            "accountDashboardRfqCount"
        );

    const inquiryCount =
        document.getElementById(
            "accountDashboardInquiryCount"
        );

    const savedCount =
        document.getElementById(
            "accountDashboardSavedCount"
        );

    const vehicleCount =
        document.getElementById(
            "accountDashboardVehicleCount"
        );

    try {

        if (typeof RFQ !== "undefined") {

            const items =
                await RFQ.get();

            const totalQuantity =
                (items || []).reduce(
                    (sum, item) =>
                        sum + Number(item?.qty || 0),
                    0
                );

            if (rfqCount) {
                rfqCount.textContent =
                    String(totalQuantity);
            }

        }

    } catch (error) {

        SouviksErrors?.log("[Souviks Account] Unable to load RFQ dashboard count:", error, "error");

    }

    try {

        const userId =
            AccountState.user?.id;

        if (!userId) {
            return;
        }

        const safeRequest = promise =>
            Promise.resolve(promise).catch(error => ({
                data: null,
                error
            }));

        const [
            inquiriesResult,
            savedResult,
            vehiclesResult,
            recentResult
        ] = await Promise.all([
            safeRequest(
                supabaseClient
                    .from("rfqs")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", userId)
            ),
            safeRequest(
                supabaseClient
                    .from("saved_products")
                    .select("product_id", { count: "exact", head: true })
                    .eq("user_id", userId)
            ),
            safeRequest(
                supabaseClient
                    .from("customer_vehicles")
                    .select("id, vehicle_id, vehicle_model, nickname")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false })
            ),
            safeRequest(
                supabaseClient
                    .from("rfqs")
                    .select("id, rfq_number, status, created_at")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false })
                    .limit(3)
            )
        ]);

        [inquiriesResult, savedResult, vehiclesResult, recentResult]
            .forEach((result, index) => {
                if (result?.error) {
                    SouviksErrors?.log(
                        [
                            "[Souviks Account] Dashboard inquiries request failed",
                            "[Souviks Account] Dashboard saved-products request failed",
                            "[Souviks Account] Dashboard vehicles request failed",
                            "[Souviks Account] Dashboard recent-inquiries request failed"
                        ][index],
                        result.error
                    );
                }
            });

        if (inquiryCount) {
            inquiryCount.textContent =
                inquiriesResult?.error
                    ? "—"
                    : String(inquiriesResult.count ?? 0);
        }

        if (savedCount) {
            savedCount.textContent =
                savedResult?.error
                    ? "—"
                    : String(savedResult.count ?? 0);
        }

        if (vehicleCount) {
            vehicleCount.textContent =
                vehiclesResult?.error
                    ? "—"
                    : String((vehiclesResult.data || []).length);
        }

        if (typeof renderAccountVehicleRecommendations === "function") {
            renderAccountVehicleRecommendations(vehiclesResult?.data || []);
        }

        renderRecentInquiries(
            recentResult?.data || [],
            Boolean(recentResult?.error)
        );

    } catch (error) {

        SouviksErrors?.log("[Souviks Account] Unable to load dashboard activity:", error, "error");

        renderRecentInquiries(
            [],
            true
        );

    }

}


function renderRecentInquiries(
    inquiries,
    unavailable = false
) {

    const container =
        document.getElementById(
            "accountRecentInquiries"
        );

    if (!container) {
        return;
    }

    if (unavailable) {

        container.innerHTML = `
            <div class="account-dashboard-recent-state">
                ${escapeHTML(
                    getTranslation(
                        "accountRecentUnavailable",
                        "Recent activity could not be loaded."
                    )
                )}
            </div>
        `;

        return;
    }

    if (!inquiries.length) {

        container.innerHTML = `
            <div class="account-dashboard-recent-state">
                ${escapeHTML(
                    getTranslation(
                        "accountRecentInquiriesEmpty",
                        "No inquiries yet. Your submitted quotation requests will appear here."
                    )
                )}
            </div>
        `;

        return;
    }

    container.innerHTML =
        inquiries
            .map(renderRecentInquiry)
            .join("");

}


function renderRecentInquiry(
    inquiry
) {

    const reference =
        inquiry?.rfq_number ||
        "RFQ";

    const date =
        formatDashboardDate(
            inquiry?.created_at
        );

    const status =
        formatDashboardStatus(
            inquiry?.status
        );

    return `
        <a
            class="account-dashboard-recent-item"
            href="${window.location.pathname}?view=inquiries"
            data-account-view="inquiries">

            <span class="account-dashboard-recent-main">
                <span class="account-dashboard-recent-reference">
                    ${escapeHTML(reference)}
                </span>
                <span class="account-dashboard-recent-meta">
                    ${escapeHTML(date)}
                </span>
            </span>

            <span class="account-dashboard-recent-status">
                ${escapeHTML(status)}
            </span>

            <span class="account-dashboard-recent-arrow" aria-hidden="true">
                →
            </span>

        </a>
    `;

}


function formatDashboardDate(
    value
) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        document.documentElement.lang ||
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function formatDashboardStatus(
    value
) {

    const normalized =
        String(value || "submitted")
            .trim()
            .toLowerCase();

    const keyMap = {
        submitted:
            "accountInquiryStatusSubmitted",
        processing:
            "accountInquiryStatusProcessing",
        quoted:
            "accountInquiryStatusQuoted",
        completed:
            "accountInquiryStatusCompleted",
        cancelled:
            "accountInquiryStatusCancelled"
    };

    const key =
        keyMap[normalized];

    if (key) {
        return getTranslation(
            key,
            normalized.charAt(0).toUpperCase() +
            normalized.slice(1)
        );
    }

    return normalized.charAt(0).toUpperCase() +
        normalized.slice(1);

}


/*
==========================================================
SHOW ACCOUNT VIEW
==========================================================
*/

function showAccountView(
    view
) {

    const allowedViews = [
        "account",
        "rfq",
        "inquiries",
        "privacy",
        "profile",
        "saved",
        "vehicles"
    ];


    if (
        !allowedViews.includes(
            view
        )
    ) {

        view =
            "account";

    }


    AccountState.currentView =
        view;


    /*
    ------------------------------------------------------
    HIDE / SHOW CONTENT VIEWS ONLY
    ------------------------------------------------------
    */

    const views =
        document.querySelectorAll(
            ".account-view[data-account-view]"
        );


    views.forEach(
        element => {

            const isCurrent =
                element.dataset.accountView ===
                view;


            element.hidden =
                !isCurrent;

        }
    );


    /*
    ------------------------------------------------------
    ACTIVE NAVIGATION
    ------------------------------------------------------
    */

    updateNavigationState(
        view
    );


    /*
    ------------------------------------------------------
    RFQ
    ------------------------------------------------------
    */

    if (
        view ===
        "rfq"
    ) {

        refreshAccountRFQ();

    }


    /*
    ------------------------------------------------------
    MY INQUIRIES
    ------------------------------------------------------
    */

    if (
        view ===
        "inquiries"
    ) {

        if (
            typeof refreshAccountInquiries ===
            "function"
        ) {

            refreshAccountInquiries();

        } else {

            console.error(
                "[Souviks Account] refreshAccountInquiries() is unavailable."
            );

        }

    }


    /*
    ------------------------------------------------------
    MY SAVED
    ------------------------------------------------------
    */

    if (
        view ===
        "saved"
    ) {

        if (
            typeof refreshAccountSaved ===
            "function"
        ) {

            refreshAccountSaved();

        } else {

            console.error(
                "[Souviks Account] refreshAccountSaved() is unavailable."
            );

        }

    }


    /*
    ------------------------------------------------------
    MY VEHICLES
    ------------------------------------------------------
    */

    if (
        view ===
        "vehicles"
    ) {

        if (
            typeof refreshAccountVehicles ===
            "function"
        ) {

            refreshAccountVehicles();

        } else {

            console.error(
                "[Souviks Account] refreshAccountVehicles() is unavailable."
            );

        }

    }

}

/*
==========================================================
UPDATE NAVIGATION STATE
==========================================================
*/

function updateNavigationState(
    view
) {

    const links =
        document.querySelectorAll(
            ".account-navigation-link"
        );


    links.forEach(
        link => {

            const href =
                link.getAttribute(
                    "href"
                ) || "";


            const isCurrent =
                href.includes(
                    `view=${view}`
                ) ||
                (
                    view ===
                    "account" &&
                    href.endsWith(
                        "/account"
                    )
                );


            link.classList.toggle(
                "active",
                isCurrent
            );


            if (isCurrent) {

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.removeAttribute(
                    "aria-current"
                );

            }

        }
    );

}


/*
==========================================================
UPDATE URL
==========================================================
*/

function updateUrl(
    view
) {

    const url =
        new URL(
            window.location.href
        );


    if (
        view ===
        "account"
    ) {

        url.searchParams.delete(
            "view"
        );

    } else {

        url.searchParams.set(
            "view",
            view
        );

    }


    window.history.pushState(
        {
            accountView:
                view
        },
        "",
        url
    );

}


/*
==========================================================
PROFILE DISPLAY
==========================================================
*/

function renderProfile() {

    const profile =
        AccountState.profile;


    if (!profile) {

        return;

    }


    setText(
        "accountFullName",
        profile.full_name
    );


    setText(
        "accountEmail",
        AccountState.user?.email
    );


    setText(
        "accountPhone",
        profile.phone
    );


    setText(
        "accountCompany",
        profile.company
    );


    setText(
        "accountBusiness",
        profile.is_business
            ? getTranslation(
                "accountBusinessYes",
                "Yes"
            )
            : getTranslation(
                "accountBusinessNo",
                "No"
            )
    );


    setText(
        "accountBusinessDescription",
        profile.is_business
            ? getTranslation(
                "accountBusinessAccountDescription",
                "Business details are used for quotation and customer records."
            )
            : getTranslation(
                "accountBusinessDetailsNotAdded",
                "Business details have not been added yet."
            )
    );


    const gstDetail =
        document.getElementById(
            "accountGstDetail"
        );


    setText(
        "accountGst",
        profile.gst_number
    );


    if (gstDetail) {

        gstDetail.hidden =
            !profile.is_business;

    }

    renderDashboardProfileSummary();

}


/*
==========================================================
EDIT FORM
==========================================================
*/

function renderEditForm() {

    const profile =
        AccountState.profile;


    if (!profile) {

        return;

    }


    setInputValue(
        "account-full-name",
        profile.full_name
    );


    setInputValue(
        "account-email-input",
        AccountState.user?.email
    );


    setInputValue(
        "account-phone-input",
        profile.phone
    );


    setInputValue(
        "account-company-input",
        profile.company
    );


    setInputValue(
        "account-gst-input",
        profile.gst_number
    );


    const businessCheckbox =
        document.getElementById(
            "account-is-business"
        );


    if (businessCheckbox) {

        businessCheckbox.checked =
            Boolean(
                profile.is_business
            );

    }


    updateBusinessFields();

}


/*
==========================================================
PROFILE EDITING
==========================================================
*/

function initializeProfileEditing() {

    const editButton =
        document.getElementById(
            "editAccountProfile"
        );


    const cancelButton =
        document.getElementById(
            "cancelAccountEdit"
        );


    const form =
        document.getElementById(
            "account-profile-form"
        );


    const businessCheckbox =
        document.getElementById(
            "account-is-business"
        );


    if (editButton) {

        editButton.addEventListener(
            "click",
            () => {

                showEditSection();

            }
        );

    }


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            () => {

                hideEditSection();

            }
        );

    }


    if (businessCheckbox) {

        businessCheckbox.addEventListener(
            "change",
            () => {

                updateBusinessFields();

            }
        );

    }


    if (form) {

        form.addEventListener(
            "submit",
            handleProfileSubmit
        );

    }

}


/*
==========================================================
SHOW EDIT SECTION
==========================================================
*/

function showEditSection() {

    const editSection =
        document.getElementById(
            "accountEditSection"
        );


    if (!editSection) {

        return;

    }


    editSection.hidden =
        false;


    AccountState.editing =
        true;


    editSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/*
==========================================================
HIDE EDIT SECTION
==========================================================
*/

function hideEditSection() {

    const editSection =
        document.getElementById(
            "accountEditSection"
        );


    if (!editSection) {

        return;

    }


    editSection.hidden =
        true;


    AccountState.editing =
        false;


    renderEditForm();

    showAccountStatus(
        ""
    );

}


/*
==========================================================
BUSINESS FIELDS
==========================================================
*/

function updateBusinessFields() {

    const checkbox =
        document.getElementById(
            "account-is-business"
        );


    const fields =
        document.getElementById(
            "account-business-fields"
        );


    const companyInput =
        document.getElementById(
            "account-company-input"
        );


    const gstInput =
        document.getElementById(
            "account-gst-input"
        );


    if (
        !checkbox ||
        !fields
    ) {

        return;

    }


    const isBusiness =
        checkbox.checked;


    fields.hidden =
        !isBusiness;


    if (companyInput) {

        companyInput.required =
            isBusiness;

    }


    if (gstInput) {

        gstInput.required =
            isBusiness;

    }


    if (!isBusiness) {

        if (companyInput) {

            companyInput.value =
                "";

        }


        if (gstInput) {

            gstInput.value =
                "";

        }

    }

}


/*
==========================================================
PROFILE SUBMISSION
==========================================================
*/

async function handleProfileSubmit(
    event
) {

    event.preventDefault();


    const form =
        event.currentTarget;


    const saveButton =
        document.getElementById(
            "saveAccountProfile"
        );


    const fullNameInput =
        document.getElementById(
            "account-full-name"
        );


    const phoneInput =
        document.getElementById(
            "account-phone-input"
        );


    const companyInput =
        document.getElementById(
            "account-company-input"
        );


    const gstInput =
        document.getElementById(
            "account-gst-input"
        );


    const businessCheckbox =
        document.getElementById(
            "account-is-business"
        );


    const fullName =
        fullNameInput?.value
            .trim() ||
        "";


    const phone =
        phoneInput?.value
            .trim() ||
        "";


    const company =
        companyInput?.value
            .trim() ||
        "";


    const gstNumber =
        gstInput?.value
            .trim()
            .toUpperCase() ||
        "";


    const isBusiness =
        Boolean(
            businessCheckbox?.checked
        );


    /*
    ------------------------------------------------------
    VALIDATION
    ------------------------------------------------------
    */

    if (!fullName) {

        showProfileStatus(
            getTranslation(
                "accountNameRequired",
                "Please enter your full name."
            ),
            "error"
        );

        fullNameInput?.focus();

        return;

    }


    if (
        isBusiness &&
        !company
    ) {

        showProfileStatus(
            getTranslation(
                "accountCompanyRequired",
                "Please enter your company name."
            ),
            "error"
        );

        companyInput?.focus();

        return;

    }


    if (
        isBusiness &&
        !gstNumber
    ) {

        showProfileStatus(
            getTranslation(
                "accountGstRequired",
                "Please enter your GST number."
            ),
            "error"
        );

        gstInput?.focus();

        return;

    }


    if (
        isBusiness &&
        !isValidGSTIN(
            gstNumber
        )
    ) {

        showProfileStatus(
            getTranslation(
                "accountGstInvalid",
                "Please enter a valid GST number."
            ),
            "error"
        );

        gstInput?.focus();

        return;

    }


    /*
    ------------------------------------------------------
    SUBMITTING
    ------------------------------------------------------
    */

    setProfileSaving(
        true
    );


    showProfileStatus(
        getTranslation(
            "accountSaving",
            "Saving..."
        )
    );


    try {

        const {
            error
        } =
            await supabaseClient

                .from(
                    "profiles"
                )

                .update({

                    full_name:
                        fullName,

                    phone:
                        phone,

                    company:
                        isBusiness
                            ? company
                            : null,

                    is_business:
                        isBusiness,

                    gst_number:
                        isBusiness
                            ? gstNumber
                            : null,

                    updated_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "id",
                    AccountState.user.id
                );


        if (error) {

            throw error;

        }


        /*
        --------------------------------------------------
        RELOAD PROFILE
        --------------------------------------------------
        */

        await loadProfile();


        renderProfile();

        renderEditForm();

        renderPrivacy();

        hideEditSection();


        showProfileStatus(
            getTranslation(
                "accountSaved",
                "Your profile has been updated."
            ),
            "success"
        );


    } catch (error) {

        SouviksErrors?.log("[Souviks Account] Profile update failed:", error, "error");


        showProfileStatus(
            getTranslation(
                "accountSaveError",
                "Unable to save your profile. Please try again."
            ),
            "error"
        );


    } finally {

        setProfileSaving(
            false
        );

    }

}


/*
==========================================================
GSTIN FORMAT VALIDATION
==========================================================

This validates the structure only.

It does NOT verify that the GSTIN exists.

GST verification was deliberately deferred.
==========================================================
*/

function isValidGSTIN(
    value
) {

    const gstin =
        String(
            value || ""
        )
            .trim()
            .toUpperCase();


    /*
    ------------------------------------------------------
    Standard GSTIN structural pattern
    ------------------------------------------------------
    */

    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
        .test(
            gstin
        );

}


/*
==========================================================
PROFILE SAVING STATE
==========================================================
*/

function setProfileSaving(
    saving
) {

    const form =
        document.getElementById(
            "account-profile-form"
        );


    if (!form) {

        return;

    }


    const controls =
        form.querySelectorAll(
            "input, button, textarea, select"
        );


    controls.forEach(
        control => {

            /*
            --------------------------------------------------
            Email is always readonly anyway.
            --------------------------------------------------
            */

            control.disabled =
                saving;

        }
    );


    const saveButton =
        document.getElementById(
            "saveAccountProfile"
        );


    if (saveButton) {

        saveButton.disabled =
            saving;

    }

}


/*
==========================================================
PRIVACY
==========================================================
*/

function renderPrivacy() {

    const email =
        AccountState.user?.email ||
        "";


    setText(
        "privacyEmail",
        email
    );

    const verification =
        document.getElementById(
            "privacyEmailVerificationStatus"
        );

    if (verification) {

        const verified =
            Boolean(
                AccountState.user?.email_confirmed_at
            );

        verification.textContent =
            getTranslation(
                verified
                    ? "accountEmailVerified"
                    : "accountEmailNotVerified",
                verified
                    ? "Verified"
                    : "Not verified"
            );

        verification.classList.toggle(
            "is-verified",
            verified
        );

    }

}


/*
==========================================================
SECURITY SETTINGS
==========================================================
*/

function initializeSecuritySettings() {

    const changeEmailButton =
        document.getElementById(
            "changeEmailButton"
        );

    const changePasswordButton =
        document.getElementById(
            "changePasswordButton"
        );

    const cancelEmailButton =
        document.getElementById(
            "cancelEmailChange"
        );

    const cancelPasswordButton =
        document.getElementById(
            "cancelPasswordChange"
        );

    const emailForm =
        document.getElementById(
            "account-change-email-form"
        );

    const passwordForm =
        document.getElementById(
            "account-change-password-form"
        );

    if (changeEmailButton) {
        changeEmailButton.addEventListener(
            "click",
            () => toggleSecurityPanel("email")
        );
    }

    if (changePasswordButton) {
        changePasswordButton.addEventListener(
            "click",
            () => toggleSecurityPanel("password")
        );
    }

    if (cancelEmailButton) {
        cancelEmailButton.addEventListener(
            "click",
            () => resetSecurityForm("email")
        );
    }

    if (cancelPasswordButton) {
        cancelPasswordButton.addEventListener(
            "click",
            () => resetSecurityForm("password")
        );
    }

    if (emailForm) {
        emailForm.addEventListener(
            "submit",
            handleEmailChange
        );
    }

    if (passwordForm) {
        passwordForm.addEventListener(
            "submit",
            handlePasswordChange
        );
    }

    document.querySelectorAll(
        "[data-password-toggle]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            () => togglePasswordVisibility(button)
        );
    });

    const passwordInput =
        document.getElementById(
            "account-new-password"
        );

    if (passwordInput) {
        passwordInput.addEventListener(
            "input",
            updatePasswordStrength
        );
    }

    renderPrivacy();

}


function toggleSecurityPanel(type) {

    const emailPanel =
        document.getElementById(
            "changeEmailPanel"
        );

    const passwordPanel =
        document.getElementById(
            "changePasswordPanel"
        );

    const emailButton =
        document.getElementById(
            "changeEmailButton"
        );

    const passwordButton =
        document.getElementById(
            "changePasswordButton"
        );

    const isEmail =
        type === "email";

    const requestedPanel =
        isEmail
            ? emailPanel
            : passwordPanel;

    const shouldOpen =
        Boolean(
            requestedPanel &&
            requestedPanel.hidden
        );

    if (emailPanel) {
        emailPanel.hidden =
            !isEmail || !shouldOpen;
    }

    if (passwordPanel) {
        passwordPanel.hidden =
            isEmail || !shouldOpen;
    }

    if (emailButton) {
        emailButton.setAttribute(
            "aria-expanded",
            String(
                isEmail &&
                shouldOpen
            )
        );
    }

    if (passwordButton) {
        passwordButton.setAttribute(
            "aria-expanded",
            String(
                !isEmail &&
                shouldOpen
            )
        );
    }

    if (isEmail && shouldOpen) {
        document
            .getElementById("account-new-email")
            ?.focus();
    }

    if (!isEmail && shouldOpen) {
        document
            .getElementById("account-new-password")
            ?.focus();
    }

}


function resetSecurityForm(type) {

    if (type === "email") {
        const form = document.getElementById("account-change-email-form");
        form?.reset();
        showSecurityFormStatus("email", "");
        const panel = document.getElementById("changeEmailPanel");
        const button = document.getElementById("changeEmailButton");
        if (panel) panel.hidden = true;
        if (button) button.setAttribute("aria-expanded", "false");
        return;
    }

    const form = document.getElementById("account-change-password-form");
    form?.reset();
    showSecurityFormStatus("password", "");
    updatePasswordStrength();
    document.querySelectorAll("[data-password-toggle]").forEach(button => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (input) input.type = "password";
        button.textContent = getTranslation("accountShowPassword", "Show");
        button.setAttribute("aria-label", getTranslation("accountShowPassword", "Show"));
        button.setAttribute("aria-pressed", "false");
    });
    const panel = document.getElementById("changePasswordPanel");
    const button = document.getElementById("changePasswordButton");
    if (panel) panel.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");

}


async function handleEmailChange(event) {

    event.preventDefault();

    const input = document.getElementById("account-new-email");
    const button = document.getElementById("updateEmailButton");
    const newEmail = input?.value.trim().toLowerCase() || "";
    const currentEmail = String(AccountState.user?.email || "").trim().toLowerCase();

    if (!newEmail) {
        showSecurityFormStatus("email", getTranslation("accountEmailInvalid", "Please enter a valid email address."), "error");
        input?.focus();
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        showSecurityFormStatus("email", getTranslation("accountEmailInvalid", "Please enter a valid email address."), "error");
        input?.focus();
        return;
    }

    if (newEmail === currentEmail) {
        showSecurityFormStatus("email", getTranslation("accountEmailSame", "Please enter a different email address."), "error");
        input?.focus();
        return;
    }

    if (button) button.disabled = true;
    showSecurityFormStatus("email", getTranslation("accountSaving", "Saving..."));

    try {
        const { error } =
            await supabaseClient.auth.updateUser({
                email: newEmail
            });

        if (error) throw error;

        showSecurityFormStatus(
            "email",
            getTranslation(
                "accountEmailChangeSuccess",
                "A confirmation email has been sent to your new email address."
            ),
            "success"
        );

        input.value = "";

    } catch (error) {
        SouviksErrors?.log("[Souviks Account] Email update failed:", error, "error");
        showSecurityFormStatus(
            "email",
            getTranslation(
                "accountSecurityUpdateError",
                "Unable to update your security settings. Please try again."
            ),
            "error"
        );
    } finally {
        if (button) button.disabled = false;
    }

}


async function handlePasswordChange(event) {

    event.preventDefault();

    const input = document.getElementById("account-new-password");
    const confirmInput = document.getElementById("account-confirm-new-password");
    const button = document.getElementById("updatePasswordButton");

    const password = input?.value || "";
    const confirmPassword = confirmInput?.value || "";

    if (!password) {
        showSecurityFormStatus("password", getTranslation("accountPasswordRequired", "Please enter a new password."), "error");
        input?.focus();
        return;
    }

    if (password.length < 8) {
        showSecurityFormStatus("password", getTranslation("accountPasswordMinLength", "Password must be at least 8 characters."), "error");
        input?.focus();
        return;
    }

    if (password !== confirmPassword) {
        showSecurityFormStatus("password", getTranslation("accountPasswordMismatch", "Passwords do not match."), "error");
        confirmInput?.focus();
        return;
    }

    if (button) button.disabled = true;
    showSecurityFormStatus("password", getTranslation("accountSaving", "Saving..."));

    try {
        const { error } =
            await supabaseClient.auth.updateUser({
                password
            });

        if (error) throw error;

        showSecurityFormStatus(
            "password",
            getTranslation(
                "accountPasswordChangeSuccess",
                "Your password has been updated successfully."
            ),
            "success"
        );

        resetPasswordInputsOnly();

    } catch (error) {
        SouviksErrors?.log("[Souviks Account] Password update failed:", error, "error");
        showSecurityFormStatus(
            "password",
            getTranslation(
                "accountSecurityUpdateError",
                "Unable to update your security settings. Please try again."
            ),
            "error"
        );
    } finally {
        if (button) button.disabled = false;
    }

}


function resetPasswordInputsOnly() {
    const input = document.getElementById("account-new-password");
    const confirmInput = document.getElementById("account-confirm-new-password");
    if (input) input.value = "";
    if (confirmInput) confirmInput.value = "";
    updatePasswordStrength();
}


function updatePasswordStrength() {
    const input = document.getElementById("account-new-password");
    const bar = document.getElementById("accountPasswordStrengthBar");
    const text = document.getElementById("accountPasswordStrengthText");
    if (!input || !bar || !text) return;

    const value = input.value || "";
    bar.className = "";

    if (!value) {
        text.textContent = getTranslation("accountPasswordStrengthEmpty", "Enter a password");
        return;
    }

    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    const state = score <= 2 ? "weak" : score <= 3 ? "fair" : "strong";
    bar.classList.add(state);
    text.textContent =
        state === "weak"
            ? getTranslation("accountPasswordStrengthWeak", "Weak")
            : state === "fair"
                ? getTranslation("accountPasswordStrengthFair", "Fair")
                : getTranslation("accountPasswordStrengthStrong", "Strong");
}


function togglePasswordVisibility(button) {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    const label = getTranslation(
        showing ? "accountShowPassword" : "accountHidePassword",
        showing ? "Show" : "Hide"
    );
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(!showing));
}


function showSecurityFormStatus(type, message, statusType = "") {
    const id =
        type === "email"
            ? "accountEmailChangeStatus"
            : "accountPasswordChangeStatus";

    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = message || "";
    element.className = "form-status";
    if (statusType) element.classList.add(statusType);
    element.hidden = !message;

}


/*
==========================================================
ACCOUNT RFQ
==========================================================
*/

function initializeAccountRFQ() {

    const submitButton =
        document.getElementById(
            "accountRfqSubmit"
        );


    if (submitButton) {

        submitButton.addEventListener(
            "click",
            handleAccountRFQSubmit
        );

    }


    /*
    ------------------------------------------------------
    Initial basket render
    ------------------------------------------------------
    */

    refreshAccountRFQ();

}


/*
==========================================================
REFRESH ACCOUNT RFQ
==========================================================
*/

async function refreshAccountRFQ() {

    /*
    ------------------------------------------------------
    PROFILE DATA
    ------------------------------------------------------
    */

    populateAccountRFQCustomer();


    /*
    ------------------------------------------------------
    RFQ BASKET
    ------------------------------------------------------
    */

    if (
        typeof RFQ ===
        "undefined"
    ) {

        console.error(
            "[Souviks Account] RFQ engine unavailable."
        );

        return;

    }


    try {

        const items =
            await RFQ.get();

        syncAccountRFQSummary(items);

        await RFQ.updateBadge();

        await RFQ.renderPage();

    } catch (error) {

        SouviksErrors?.log("[Souviks Account] RFQ render failed:", error, "error");

    }

}


/*
==========================================================
RFQ SUMMARY
==========================================================
*/

function syncAccountRFQSummary(
    items
) {

    const list =
        Array.isArray(items)
            ? items
            : [];

    const parts = list.length;

    const units =
        list.reduce(
            (sum, item) =>
                sum + Math.max(0, Number(item?.qty || 0)),
            0
        );

    const summary =
        document.getElementById(
            "accountRfqSummary"
        );

    if (summary) {
        const template =
            parts
                ? getTranslation("accountRfqSummary", "{parts} parts · {units} units")
                : getTranslation("accountRfqSummaryEmpty", "Your RFQ basket is empty. Add parts to request a quotation.");
        summary.textContent = template
            .replace("{parts}", String(parts))
            .replace("{units}", String(units));
    }

    const submitButton =
        document.getElementById(
            "accountRfqSubmit"
        );

    if (submitButton) {
        submitButton.disabled =
            !parts ||
            AccountState.rfqSubmitting;

        if (parts) {
            submitButton.textContent =
                getTranslation("rfqSubmit", "Submit for Quote");

            const success = document.getElementById("accountRfqSuccess");
            if (success) success.hidden = true;
        }
    }

}


/*
==========================================================
ACCOUNT RFQ CUSTOMER INFORMATION
==========================================================
*/

function populateAccountRFQCustomer() {

    const profile =
        AccountState.profile;


    const user =
        AccountState.user;


    if (!profile) {

        return;

    }


    setText(
        "accountRfqName",
        profile.full_name
    );


    setText(
        "accountRfqEmail",
        user?.email
    );


    setText(
        "accountRfqPhone",
        profile.phone
    );


    setText(
        "accountRfqCompany",
        profile.company
    );


    const gstDetail =
        document.getElementById(
            "accountRfqGstDetail"
        );


    setText(
        "accountRfqGst",
        profile.gst_number
    );


    if (gstDetail) {

        gstDetail.hidden =
            !profile.is_business;

    }

}


/*
==========================================================
ACCOUNT RFQ SUBMISSION
==========================================================
*/

async function handleAccountRFQSubmit() {

    if (
        AccountState.rfqSubmitting
    ) {

        return;

    }


    const status =
        document.getElementById(
            "accountRfqStatus"
        );


    const submitButton =
        document.getElementById(
            "accountRfqSubmit"
        );


    /*
    ------------------------------------------------------
    CHECK SUBMISSION MODULE
    ------------------------------------------------------
    */

    if (
        typeof RFQSubmission ===
        "undefined"
    ) {

        console.error(
            "[Souviks Account] RFQSubmission unavailable."
        );


        showRFQStatus(
            "RFQ submission service is unavailable. Please try again later.",
            "error"
        );


        return;

    }


    /*
    ------------------------------------------------------
    MESSAGE
    ------------------------------------------------------
    */

    const messageInput =
        document.getElementById(
            "accountRfqMessage"
        );


    const message =
        messageInput?.value
            .trim() ||
        "";


    /*
    ------------------------------------------------------
    BASKET CHECK
    ------------------------------------------------------
    */

    try {

        const items =
            await RFQ.get();


        if (
            !Array.isArray(
                items
            ) ||
            !items.length
        ) {

            showRFQStatus(
                getTranslation(
                    "rfqEmpty",
                    "Please add at least one item to your RFQ."
                ),
                "error"
            );


            return;

        }


    } catch (error) {

        SouviksErrors?.log("[Souviks Account] Unable to read RFQ basket:", error, "error");


        showRFQStatus(
            "Unable to read your RFQ basket. Please try again.",
            "error"
        );


        return;

    }


    /*
    ------------------------------------------------------
    START SUBMISSION
    ------------------------------------------------------
    */

    AccountState.rfqSubmitting =
        true;


    if (submitButton) {

        submitButton.disabled =
            true;

    }


    showRFQStatus(
        getTranslation(
            "accountSaving",
            "Submitting..."
        )
    );


    try {

        const result =
            await RFQSubmission.submit({

                message

            });


        /*
        --------------------------------------------------
        SUCCESS
        --------------------------------------------------
        */

        showRFQSuccess(
            result
        );


        if (messageInput) {

            messageInput.value =
                "";

        }


        /*
        --------------------------------------------------
        Refresh basket.
        --------------------------------------------------
        */

        await refreshAccountRFQ();


    } catch (error) {

        SouviksErrors?.log("[Souviks Account] RFQ submission failed:", error, "error");


        showRFQStatus(
            error?.message ||
            "Unable to submit RFQ. Please try again.",
            "error"
        );


    } finally {

        AccountState.rfqSubmitting =
            false;


        if (submitButton) {

            submitButton.disabled =
                false;

        }

    }

}


/*
==========================================================
RFQ SUCCESS
==========================================================
*/

function showRFQSuccess(
    result
) {

    const reference =
        result?.reference ||
        "";

    const submitButton = document.getElementById("accountRfqSubmit");
    const success = document.getElementById("accountRfqSuccess");
    const successMessage = document.getElementById("accountRfqSuccessMessage");
    const status = document.getElementById("accountRfqStatus");

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = getTranslation("rfqSubmitted", "RFQ Submitted");
    }

    if (status) {
        status.hidden = true;
        status.textContent = "";
        status.className = "form-status";
    }

    const message = reference
        ? `${getTranslation("rfqSubmittedSuccessfully", "Your quotation request has been submitted successfully.")} ${getTranslation("rfqReference", "Reference:")} ${reference}`
        : getTranslation("rfqSubmittedSuccessfully", "Your quotation request has been submitted successfully.");

    if (success && successMessage) {
        successMessage.textContent = message;
        success.hidden = false;
        return;
    }

    showRFQStatus(message, "success");
}


/*
==========================================================
STATUS HELPERS
==========================================================
*/

function showProfileStatus(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "accountProfileStatus"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message || "";


    element.className =
        "form-status";


    if (type) {

        element.classList.add(
            type
        );

    }


    element.hidden =
        !message;

}


function showAccountStatus(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "accountStatus"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message || "";


    element.className =
        "form-status";


    if (type) {

        element.classList.add(
            type
        );

    }


    element.hidden =
        !message;

}


function showRFQStatus(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "accountRfqStatus"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message || "";


    element.className =
        "form-status";


    if (type) {

        element.classList.add(
            type
        );

    }


    element.hidden =
        !message;

}


/*
==========================================================
GENERIC TEXT HELPER
==========================================================
*/

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;

    }


    const text =
        (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        )

            ? "—"

            : String(
                value
            );


    element.textContent =
        text;

}


/*
==========================================================
GENERIC INPUT HELPER
==========================================================
*/

function setInputValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;

    }


    element.value =
        value || "";

}


/*
==========================================================
TRANSLATION HELPER
==========================================================
*/

function getTranslation(
    key,
    fallback
) {

    const html =
        document.documentElement;


    /*
    ------------------------------------------------------
    The builder can expose translated values through
    data attributes if present.
    ------------------------------------------------------
    */

    const datasetKey =
        key
            .replace(
                /[A-Z]/g,
                letter =>
                    `-${letter.toLowerCase()}`
            );


    const value =
        html.dataset[
            datasetKey
        ];


    return (
        value ||
        fallback
    );

}


/*
==========================================================
LOGIN REDIRECT
==========================================================
*/

function redirectToLogin() {

    const language =
        document.documentElement
            .lang
            ?.trim()
            .toLowerCase() ||
        "en";


    window.location.href =
        `/${language}/login?redirect=${encodeURIComponent(
            window.location.pathname +
            window.location.search
        )}`;

}


/*
==========================================================
BROWSER HISTORY
==========================================================
*/

window.addEventListener(
    "popstate",
    () => {

        const view =
            getRequestedView();


        showAccountView(
            view
        );

    }
);
