
/* ===== utils.js ===== */
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

    return `/${LANG}/products/${product.slug}`;

};

// ======================================================
// BRAND URL
// ======================================================

Utils.brandUrl = function(brand) {

    return `/${LANG}/brands/${brand.slug}`;

};

// ======================================================
// CATEGORY URL
// ======================================================

Utils.categoryUrl = function(category) {

    return `/${LANG}/categories/${category.slug}`;

};

// ======================================================
// VEHICLE URL
// ======================================================

Utils.vehicleUrl = function(vehicle) {

    return `/${LANG}/vehicles/${vehicle.slug}`;

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

const LANG = window.souviks.currentLanguage;
// ======================================================
// RESPONSIVE PRODUCT IMAGE ATTRIBUTES
// ======================================================

Utils.responsiveImageAttrs = function(src, dimensions, sizes, loading = "lazy") {

    // This helper intentionally does NOT generate responsive image URLs.
    // Image files are maintained by the separate 400x400 image utility.
    // The website must only request files that are actually present in
    // the product gallery.
    const attrs = [
        `loading="${loading}"`,
        `decoding="async"`
    ];

    let width = null;
    let height = null;
    if (Array.isArray(dimensions) && dimensions.length === 2) {
        const w = Number(dimensions[0]);
        const h = Number(dimensions[1]);
        if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
            width = w;
            height = h;
        }
    }
    if (width === null) {
        const value = String(src || "").toLowerCase();
        if (value.includes("/assets/images/placeholder.webp")) {
            width = 1200; height = 1200;
        } else if (value.includes("/assets/images/no-results.svg")) {
            width = 640; height = 420;
        } else if (value.includes("/assets/logo/") || value.includes("/assets/favicon/")) {
            width = 1024; height = 1024;
        } else if (value.includes("/assets/icons/")) {
            width = 24; height = 24;
        } else if (value.includes("/assets/images/vehicles/") && value.includes("thumbnail-400x300")) {
            width = 400; height = 300;
        }
    }
    if (width !== null) {
        attrs.push(`width="${width}"`);
        attrs.push(`height="${height}"`);
    }

    return attrs.join(" ");
};




/* ===== auth/supabase.js ===== */
/* ==========================================================
   SOUVIKS — SUPABASE CLIENT
   ========================================================== */

const SUPABASE_URL =
    "https://kjxrfmujzdxatpgegqcs.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_lw2angemSUxOJrcLdbyTDw_0hQbCj3x";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        }
    );

/* ===== auth/auth-state.js ===== */
/* ==========================================================
   SOUVIKS — GLOBAL AUTH STATE
   Top-bar authentication control
   ========================================================== */

document.addEventListener("DOMContentLoaded", async () => {

    /*
    ----------------------------------------------------------
    ELEMENTS
    ----------------------------------------------------------
    */

    const topSignIn =
        document.getElementById("topSignIn");

    const topUserMenu =
        document.getElementById("topUserMenu");

    const topUserButton =
        document.getElementById("topUserButton");

    const topUserName =
        document.getElementById("topUserName");

    const topUserDropdown =
        document.getElementById("topUserDropdown");

    const mobileNavSignIn =
        document.getElementById("mobileNavSignIn");

    const mobileNavUserMenu =
        document.getElementById("mobileNavUserMenu");

    const mobileNavUserName =
        document.getElementById("mobileNavUserName");


    /*
    ----------------------------------------------------------
    SUPABASE CHECK
    ----------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks Auth] Supabase client unavailable."
        );

        return;
    }


    /*
    ----------------------------------------------------------
    HELPERS
    ----------------------------------------------------------
    */

    function setHidden(element, hidden) {

        if (!element) {
            return;
        }

        element.hidden = hidden;

    }


    function closeDropdown() {

        if (!topUserDropdown) {
            return;
        }

        topUserDropdown.hidden = true;

        if (topUserButton) {

            topUserButton.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    }


    function openDropdown() {

        if (!topUserDropdown) {
            return;
        }

        topUserDropdown.hidden = false;

        if (topUserButton) {

            topUserButton.setAttribute(
                "aria-expanded",
                "true"
            );

        }

    }


    /*
    ----------------------------------------------------------
    USER MENU TOGGLE
    ----------------------------------------------------------
    */

    if (
        topUserButton &&
        topUserDropdown
    ) {

        topUserButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                const isOpen =
                    topUserButton.getAttribute(
                        "aria-expanded"
                    ) === "true";

                if (isOpen) {

                    closeDropdown();

                } else {

                    openDropdown();

                }

            }
        );

    }


    /*
    ----------------------------------------------------------
    CLOSE WHEN CLICKING OUTSIDE
    ----------------------------------------------------------
    */

    document.addEventListener(
        "click",
        (event) => {

            if (
                !topUserMenu ||
                !topUserMenu.contains(event.target)
            ) {

                closeDropdown();

            }

        }
    );


    /*
    ----------------------------------------------------------
    ESCAPE KEY
    ----------------------------------------------------------
    */

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {

                closeDropdown();

            }

        }
    );


    /*
    ----------------------------------------------------------
    APPLY AUTH STATE
    ----------------------------------------------------------
    */

    async function applyAuthState(session) {

        /*
        ----------------------------------------------
        LOGGED OUT
        ----------------------------------------------
        */

        if (!session || !session.user) {

            setHidden(
                topSignIn,
                false
            );

            setHidden(
                topUserMenu,
                true
            );

            setHidden(
                mobileNavSignIn,
                false
            );

            setHidden(
                mobileNavUserMenu,
                true
            );

            closeDropdown();

            return;
        }


        /*
        ----------------------------------------------
        LOGGED IN
        ----------------------------------------------
        */

        const user =
            session.user;

        let fullName = "";


        /*
        ----------------------------------------------
        LOAD PROFILE NAME
        ----------------------------------------------
        */

        try {

            const {
                data: profile,
                error
            } =
                await supabaseClient
                    .from("profiles")
                    .select("full_name")
                    .eq("id", user.id)
                    .single();

            if (!error && profile) {

                fullName =
                    profile.full_name || "";

            }

        } catch (error) {

            console.error(
                "[Souviks Auth] Unable to load profile name:",
                error
            );

        }


        /*
        ----------------------------------------------
        FALLBACK TO AUTH METADATA
        ----------------------------------------------
        */

        if (!fullName) {

            fullName =
                user.user_metadata?.full_name ||
                "";

        }


        /*
        ----------------------------------------------
        FINAL FALLBACK
        ----------------------------------------------
        */

        if (!fullName) {

            fullName =
                "Account";

        }


        /*
        ----------------------------------------------
        UPDATE TOP BAR
        ----------------------------------------------
        */

        if (topUserName) {

            topUserName.textContent =
                fullName;

        }

        if (mobileNavUserName) {

            mobileNavUserName.textContent =
                fullName;

        }

        setHidden(
            topSignIn,
            true
        );

        setHidden(
            topUserMenu,
            false
        );

        setHidden(
            mobileNavSignIn,
            true
        );

        setHidden(
            mobileNavUserMenu,
            false
        );

        closeDropdown();

    }


    /*
    ----------------------------------------------------------
    INITIAL SESSION
    ----------------------------------------------------------
    */
    const runAuthStateCheck = async () => {
            try {
        
                const {
                    data,
                    error
                } =
                    await supabaseClient.auth.getSession();
        
                if (error) {
        
                    console.error(
                        "[Souviks Auth] Unable to retrieve session:",
                        error
                    );
        
                    return;
        
                }
        
                await applyAuthState(
                    data.session
                );
        
            } catch (error) {
        
                console.error(
                    "[Souviks Auth] Unexpected auth-state error:",
                    error
                );
        
            }
    };

    if ("requestIdleCallback" in window) {
        window.requestIdleCallback(runAuthStateCheck, { timeout: 1600 });
    } else {
        window.setTimeout(runAuthStateCheck, 500);
    }


    /*
    ----------------------------------------------------------
    AUTH STATE CHANGES
    ----------------------------------------------------------
    */

/*
----------------------------------------------------------
AUTH STATE CHANGES
----------------------------------------------------------
*/

supabaseClient.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        console.log(
            "[Souviks Auth] Auth event:",
            event
        );

        /*
        * Do not perform Supabase operations directly
        * inside the auth-state callback.
        */

        setTimeout(
            async () => {

                await applyAuthState(
                    session
                );

            },
            0
        );

    }
);

});

/* ===== auth/auth-modal.js ===== */
/* ==========================================================
   SOUVIKS — AUTHENTICATION MODAL
   Global login / registration modal
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const modal = document.getElementById("authModal");

    if (!modal) return;

    // Move the modal to <body> so it is outside the header/top-bar stacking
    // context. This guarantees the fixed overlay can sit above catalogue
    // search layers regardless of their z-index.
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    const loginForm = document.getElementById("authModalLoginForm");
    const registerForm = document.getElementById("authModalRegisterForm");
    const loginPanel = document.getElementById("authModalLoginPanel");
    const registerPanel = document.getElementById("authModalRegisterPanel");
    const title = document.getElementById("authModalTitle");
    const translations = document.getElementById("authModalTranslations");

    const loginStatus = document.getElementById("authModalLoginStatus");
    const registerStatus = document.getElementById("authModalRegisterStatus");

    const loginEmail = document.getElementById("authModalLoginEmail");
    const loginPassword = document.getElementById("authModalLoginPassword");

    const fullName = document.getElementById("authModalFullName");
    const registerEmail = document.getElementById("authModalRegisterEmail");
    const registerPassword = document.getElementById("authModalRegisterPassword");
    const confirmPassword = document.getElementById("authModalConfirmPassword");

    const tabs = modal.querySelectorAll("[data-auth-tab]");

    let lastFocusedElement = null;

    function message(key, fallback) {
        return translations?.dataset[key] || fallback;
    }

    function language() {
        return (
            document.documentElement.lang ||
            window.souviks?.currentLanguage ||
            "en"
        ).trim().toLowerCase();
    }

    function showStatus(element, text, type = "") {
        if (!element) return;
        element.textContent = text || "";
        element.className = "form-status";
        if (type) element.classList.add(type);
    }

    function setTab(tab) {
        const register = tab === "register";

        loginPanel.hidden = register;
        registerPanel.hidden = !register;

        tabs.forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.authTab === tab
            );
        });

        title.textContent = register
            ? tabs[1]?.textContent.trim()
            : tabs[0]?.textContent.trim();

        showStatus(loginStatus, "");
        showStatus(registerStatus, "");

        window.setTimeout(() => {
            (register ? fullName : loginEmail)?.focus();
        }, 0);
    }

    function open(tab = "login") {
        lastFocusedElement = document.activeElement;
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("auth-modal-open");
        setTab(tab);
    }

    function close() {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("auth-modal-open");
        lastFocusedElement?.focus?.();
        lastFocusedElement = null;
    }

    document.querySelectorAll("[data-auth-open]").forEach(trigger => {
        trigger.addEventListener("click", event => {
            event.preventDefault();
            open(trigger.dataset.authOpen || "login");
        });
    });

    modal.querySelectorAll("[data-auth-close]").forEach(trigger => {
        trigger.addEventListener("click", event => {
            event.preventDefault();
            close();
        });
    });

    tabs.forEach(button => {
        button.addEventListener("click", () => {
            setTab(button.dataset.authTab);
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) {
            close();
        }
    });

    function setDisabled(form, disabled) {
        form?.querySelectorAll("input, button").forEach(element => {
            element.disabled = disabled;
        });
    }

    loginForm?.addEventListener("submit", async event => {
        event.preventDefault();
        showStatus(loginStatus, "");

        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email) {
            showStatus(
                loginStatus,
                message("emailRequired", "Please enter your email address."),
                "error"
            );
            loginEmail.focus();
            return;
        }

        if (!password) {
            showStatus(
                loginStatus,
                message("passwordRequired", "Please enter your password."),
                "error"
            );
            loginPassword.focus();
            return;
        }

        if (typeof supabaseClient === "undefined") {
            showStatus(
                loginStatus,
                message(
                    "authenticationUnavailable",
                    "Authentication service is unavailable. Please try again later."
                ),
                "error"
            );
            return;
        }

        setDisabled(loginForm, true);

        try {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) {
                const errorMessage =
                    error.message?.toLowerCase() || "";

                let text = message(
                    "invalidCredentials",
                    "Invalid email or password."
                );

                if (errorMessage.includes("email not confirmed")) {
                    text = message(
                        "emailNotConfirmed",
                        "Please verify your email address before logging in."
                    );
                } else if (
                    errorMessage.includes("too many requests") ||
                    errorMessage.includes("rate limit")
                ) {
                    text = message(
                        "tooManyAttempts",
                        "Too many login attempts. Please wait and try again."
                    );
                } else if (errorMessage.includes("network")) {
                    text = message(
                        "networkError",
                        "Unable to connect to the authentication service. Please try again."
                    );
                }

                showStatus(loginStatus, text, "error");
                setDisabled(loginForm, false);
                return;
            }

            if (!data?.session || !data?.user) {
                showStatus(
                    loginStatus,
                    message(
                        "loginFailed",
                        "Login could not be completed. Please try again."
                    ),
                    "error"
                );
                setDisabled(loginForm, false);
                return;
            }

            window.location.replace(`/${language()}/account`);

        } catch (error) {
            console.error("[Souviks Auth] Modal login error:", error);

            showStatus(
                loginStatus,
                message(
                    "somethingWentWrong",
                    "Something went wrong. Please try again."
                ),
                "error"
            );

            setDisabled(loginForm, false);
        }
    });

    registerForm?.addEventListener("submit", async event => {
        event.preventDefault();
        showStatus(registerStatus, "");

        const name = fullName.value.trim();
        const email = registerEmail.value.trim();
        const password = registerPassword.value;
        const confirmation = confirmPassword.value;

        if (!name) {
            showStatus(
                registerStatus,
                message("fullNameRequired", "Please enter your full name."),
                "error"
            );
            fullName.focus();
            return;
        }

        if (!email) {
            showStatus(
                registerStatus,
                message("emailRequired", "Please enter your email address."),
                "error"
            );
            registerEmail.focus();
            return;
        }

        if (!password) {
            showStatus(
                registerStatus,
                message("passwordCreateRequired", "Please enter a password."),
                "error"
            );
            registerPassword.focus();
            return;
        }

        if (password.length < 6) {
            showStatus(
                registerStatus,
                message("passwordMinLength", "Password must be at least 6 characters."),
                "error"
            );
            registerPassword.focus();
            return;
        }

        if (password !== confirmation) {
            showStatus(
                registerStatus,
                message("passwordMismatch", "Passwords do not match."),
                "error"
            );
            confirmPassword.focus();
            return;
        }

        if (typeof supabaseClient === "undefined") {
            showStatus(
                registerStatus,
                message(
                    "authenticationUnavailable",
                    "Authentication service is unavailable. Please try again later."
                ),
                "error"
            );
            return;
        }

        setDisabled(registerForm, true);

        try {
            const currentLanguage = language();
            const emailRedirectTo =
                `https://www.souviks.co.in/${currentLanguage}/login?auth=login`;

            const { data, error } =
                await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name
                        },
                        emailRedirectTo
                    }
                });

            if (error) {
                let text = message(
                    "registrationFailed",
                    "Unable to create your account. Please try again."
                );

                const errorMessage =
                    error.message?.toLowerCase() || "";

                if (errorMessage.includes("already registered")) {
                    text = message(
                        "accountExists",
                        "An account with this email already exists."
                    );
                } else if (errorMessage.includes("password")) {
                    text = error.message;
                }

                showStatus(registerStatus, text, "error");
                setDisabled(registerForm, false);
                return;
            }

            console.log(
                "[Souviks Auth] Modal registration successful:",
                data
            );

            registerForm.reset();

            showStatus(
                registerStatus,
                message(
                    "registrationSuccess",
                    "Account created successfully. Please check your email to verify your account."
                ),
                "success"
            );

            setDisabled(registerForm, false);

        } catch (error) {
            console.error(
                "[Souviks Auth] Modal registration error:",
                error
            );

            showStatus(
                registerStatus,
                message(
                    "somethingWentWrong",
                    "Something went wrong. Please try again."
                ),
                "error"
            );

            setDisabled(registerForm, false);
        }
    });

    const params = new URLSearchParams(window.location.search);
    const autoOpen = params.get("auth");

    if (autoOpen === "login" || autoOpen === "register") {
        open(autoOpen);
    }
});


/* ===== auth/logout.js ===== */
/* ==========================================================
   SOUVIKS — LOGOUT
   ========================================================== */

document.addEventListener("click", async (event) => {

    const logoutButton =
        event.target.closest("[data-auth-logout]");

    if (!logoutButton) {
        return;
    }

    event.preventDefault();


    /*
    ----------------------------------------------------------
    SUPABASE CHECK
    ----------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks Auth] Supabase client unavailable."
        );

        return;
    }


    /*
    ----------------------------------------------------------
    PREVENT MULTIPLE CLICKS
    ----------------------------------------------------------
    */

    if (logoutButton.disabled) {
        return;
    }

    logoutButton.disabled = true;


    /*
    ----------------------------------------------------------
    ACCOUNT PAGE CHECK
    ----------------------------------------------------------
    */

    function isAccountPage() {

        const pathname =
            window.location.pathname
                .toLowerCase();


        /*
        ----------------------------------------------
        /en/account
        /hi/account
        /bn/account
        ----------------------------------------------
        */

        if (
            /\/account\.html$/.test(
                pathname
            )
        ) {

            return true;

        }


        /*
        ----------------------------------------------
        Future account routes
        /en/account/...
        ----------------------------------------------
        */

        if (
            /\/account(?:\/|$)/.test(
                pathname
            )
        ) {

            return true;

        }


        return false;

    }


    /*
    ----------------------------------------------------------
    LANGUAGE
    ----------------------------------------------------------
    */

    function getCurrentLanguage() {

        const language =
            document.documentElement
                .lang
                ?.trim()
                .toLowerCase();


        return language || "en";

    }


    /*
    ----------------------------------------------------------
    SIGN OUT
    ----------------------------------------------------------
    */

    try {

        const {
            error
        } =
            await supabaseClient.auth.signOut();


        /*
        ------------------------------------------------------
        LOGOUT ERROR
        ------------------------------------------------------
        */

        if (error) {

            console.error(
                "[Souviks Auth] Logout failed:",
                error
            );

            logoutButton.disabled =
                false;

            return;

        }


        console.log(
            "[Souviks Auth] Logout successful."
        );


        /*
        ------------------------------------------------------
        ACCOUNT SECTION
        ------------------------------------------------------

        Account information must not remain visible after
        logout.

        Redirect immediately to the Sign In page using the
        current site's language.
        ------------------------------------------------------
        */

        if (
            isAccountPage()
        ) {

            const language =
                getCurrentLanguage();

            const loginPath =
                `/${language}/login`;


            window.location.replace(
                loginPath
            );

            return;

        }


        /*
        ------------------------------------------------------
        ALL OTHER PAGES
        ------------------------------------------------------

        Keep the user on the exact same page.

        Reloading allows auth-state.js to rebuild the
        authentication UI using the logged-out session.
        ------------------------------------------------------
        */

        window.location.reload();


    } catch (error) {

        console.error(
            "[Souviks Auth] Unexpected logout error:",
            error
        );

        logoutButton.disabled =
            false;

    }

});

/* ===== language-switcher.js ===== */
const toggle =
    document.getElementById(
        "language-toggle"
    );

const menu =
    document.getElementById(
        "language-menu"
    );

document.querySelectorAll(
    "#language-menu [data-language]"
).forEach(
    link => {

        link.addEventListener(
            "click",
            event => {


                const language =
                    event.currentTarget.dataset.language;

                const supported = [
                    "en",
                    "bn",
                    "hi"
                ];

                if (supported.includes(language)) {
                    try {
                        localStorage.setItem("svks_language", language);
                    } catch {
                        // Ignore storage restrictions; navigation still works.
                    }
                }

                const url =
                    new URL(
                        window.location.href
                    );

                const parts =
                    url.pathname.split("/");

                if (
                    parts.length > 1 &&
                    supported.includes(
                        parts[1]
                    )
                ) {

                    parts[1] = language;

                }

                else {

                    parts.splice(
                        1,
                        0,
                        language
                    );

                }

                url.pathname =
                    parts.join("/");

                window.location.href =
                    url.toString();

            }
        );

    }
);

toggle.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        const isOpen = !menu.classList.contains("open");
        menu.classList.toggle("open", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));

        toggle.querySelector(
            ".language-arrow"
        ).textContent = isOpen ? "▲" : "▼";

    }
);

/* ===== main.js ===== */
document.addEventListener(
    "DOMContentLoaded",
    () => {
        const button = document.getElementById("mobileMenuButton");
        const navigation = document.querySelector(".main-navigation");
        const closeButton = document.getElementById("mobileNavigationClose");

        if (!button || !navigation) return;

        const setNavigationState = isOpen => {
            navigation.classList.toggle("active", isOpen);
            button.setAttribute("aria-expanded", String(isOpen));
            button.setAttribute(
                "aria-label",
                isOpen
                    ? (button.dataset.closeLabel || "Close navigation")
                    : (button.dataset.openLabel || "Open navigation")
            );
            navigation.setAttribute("aria-hidden", String(!isOpen));
            document.body.classList.toggle("mobile-navigation-open", isOpen);
        };

        button.dataset.openLabel = button.getAttribute("aria-label") || "Open navigation";
        button.dataset.closeLabel = "Close navigation";
        setNavigationState(false);

        button.addEventListener("click", () => {
            setNavigationState(!navigation.classList.contains("active"));
        });

        closeButton?.addEventListener("click", () => {
            setNavigationState(false);
            button.focus();
        });

        navigation.querySelectorAll(".navigation-menu a, .mobile-nav-auth a, .mobile-nav-auth button").forEach(control => {
            control.addEventListener("click", () => setNavigationState(false));
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && navigation.classList.contains("active")) {
                setNavigationState(false);
                button.focus();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 992 && navigation.classList.contains("active")) {
                setNavigationState(false);
            }
        });
    }
);


/* ===== image-protection.js ===== */
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

        console.error(
            "[Souviks Saved] Initialization failed:",
            error
        );

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

        console.error(
            "[Souviks Saved] Unable to get user:",
            error
        );

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

        console.error(
            "[Souviks Saved] Failed to load saved products:",
            error
        );

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


        console.error(
            "[Souviks Saved] Failed to save product:",
            error
        );

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

        console.error(
            "[Souviks Saved] Failed to remove product:",
            error
        );

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

            console.error(
                "[Souviks Saved] Toggle failed:",
                error
            );

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


/* ===== Souviks — refresh static product-card images from canonical catalogue ===== */
(() => {
    const run = async () => {
        const cards = Array.from(document.querySelectorAll(".product-card"));
        if (!cards.length) return;

        try {
            const response = await fetch("/assets/data/catalogue-index.json", {
                headers: { Accept: "application/json" },
                cache: "no-store",
                credentials: "same-origin"
            });
            if (!response.ok) return;

            const catalogue = await response.json();
            if (!Array.isArray(catalogue)) return;

            const byId = new Map(
                catalogue
                    .filter(item => item && item.id)
                    .map(item => [String(item.id), item])
            );

            cards.forEach(card => {
                const button = card.querySelector("[data-saved-product-id], .add-to-cart[data-id]");
                const id = String(
                    button?.dataset.savedProductId ||
                    button?.dataset.id ||
                    ""
                ).trim();
                if (!id) return;

                const product = byId.get(id);
                const image = String(product?.image_url || "").trim();
                if (!product || !image || image.endsWith("/placeholder.webp")) return;

                const img = card.querySelector(".product-image-file, .product-image img");
                if (!img || img.src.endsWith(image)) return;

                img.src = image;
                img.removeAttribute("srcset");
                img.removeAttribute("sizes");
                img.alt = String(product.product_name || product.name || img.alt || "Product");
            });
        } catch (error) {
            console.warn("[Souviks] Static product image refresh unavailable:", error);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
        void run();
    }
})();
