/*
==========================================================
SOUVIKS WEBSITE
UTILITIES
Version : 1.0
==========================================================
*/

const Utils = {};

// ======================================================
// SLUG
// ======================================================

Utils.slugify = function(value) {

    if (!value) {

        return "";

    }

    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

};

// ======================================================
// TITLE CASE
// ======================================================

Utils.titleCase = function(value) {

    if (!value) {

        return "";

    }

    return value.replace(

        /\w\S*/g,

        word =>

            word.charAt(0).toUpperCase() +

            word.substring(1).toLowerCase()

    );

};

// ======================================================
// INR FORMAT
// ======================================================

Utils.currency = function(value) {

    if (

        value === null ||

        value === undefined ||

        value === ""

    ) {

        return "";

    }

    return new Intl.NumberFormat(

        "en-IN",

        {

            style: "currency",

            currency: "INR",

            maximumFractionDigits: 2

        }

    ).format(value);

};

// ======================================================
// QUERY PARAM
// ======================================================

Utils.query = function(key) {

    const params = new URLSearchParams(

        window.location.search

    );

    return params.get(key);

};

// ======================================================
// CURRENT SLUG
// ======================================================

Utils.currentSlug = function() {

    const path = window.location.pathname;

    const page = path.split("/").pop();

    return page.replace(

        ".html",

        ""

    );

};


// ======================================================
// UNIQUE
// ======================================================

Utils.unique = function(array) {

    return [

        ...new Set(array)

    ];

};

// ======================================================
// SORT BY NAME
// ======================================================

Utils.sortByName = function(array) {

    return array.sort(

        (a, b) =>

            a.name.localeCompare(

                b.name

            )

    );

};

// ======================================================
// ELEMENT
// ======================================================

Utils.el = function(selector) {

    return document.querySelector(

        selector

    );

};

// ======================================================
// ELEMENTS
// ======================================================

Utils.els = function(selector) {

    return [

        ...document.querySelectorAll(

            selector

        )

    ];

};

// ======================================================
// CLEAR
// ======================================================

Utils.clear = function(selector) {

    const element =

        typeof selector === "string"

            ? Utils.el(selector)

            : selector;

    if (!element) {

        return;

    }

    element.innerHTML = "";

};

// ======================================================
// DEBOUNCE
// ======================================================

Utils.debounce = function(

    callback,

    delay = 300

) {

    let timer;

    return function(...args) {

        clearTimeout(

            timer

        );

        timer = setTimeout(

            () => callback.apply(

                this,

                args

            ),

            delay

        );

    };

};

// ======================================================
// PRODUCT URL
// ======================================================

Utils.productUrl = function(product) {

    return `/products/${product.slug}.html`;

};

// ======================================================
// BRAND URL
// ======================================================

Utils.brandUrl = function(brand) {

    return `/brands/${brand.slug}.html`;

};

// ======================================================
// CATEGORY URL
// ======================================================

Utils.categoryUrl = function(category) {

    return `/categories/${category.slug}.html`;

};

// ======================================================
// VEHICLE URL
// ======================================================

Utils.vehicleUrl = function(vehicle) {

    return `/vehicles/${vehicle.slug}.html`;

};

// ======================================================
// EMPTY STATE
// ======================================================

Utils.emptyState = function(

    message = "No records found."

) {

    return `

        <div class="empty-state">

            <p>${message}</p>

        </div>

    `;

};


// ======================================================
// GLOBAL EXPORT
// ======================================================

window.Utils = Utils;
