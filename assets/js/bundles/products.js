
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

            window.location.replace(`/${language()}/account.html`);

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
                `https://www.souviks.co.in/${currentLanguage}/login.html?auth=login`;

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
        /en/account.html
        /hi/account.html
        /bn/account.html
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
                `/${language}/login.html`;


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


/* ===== search-engine.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
SMART SEARCH ENGINE
Version : 2.0
==========================================================

Features:
- Part-number punctuation tolerance
- Hindi / Bengali query expansion
- Automotive synonyms and common search variants
- Lightweight typo tolerance
- Generic text matching for directory pages
- Product-record filtering for catalogue pages
==========================================================
*/

(function () {

    "use strict";

    const TYPE_BONUS = {
        product: 10,
        category: 100,
        brand: 200,
        vehicle: 300
    };

    const INDIC_DIGIT_MAP = {
        "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
        "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
        "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
        "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9"
    };

    // Local query expansion. This deliberately stays in the browser so
    // Hindi/Bengali search does not require an external translation API.
    const QUERY_ALIASES = [
        ["air filter", ["air filter", "एयर फ़िल्टर", "एयर फिल्टर", "এয়ার ফিল্টার", "এয়ার ফিল্টার"]],
        ["fuel filter", ["fuel filter", "fuel फ़िल्टर", "फ्यूल फ़िल्टर", "फ्यूल फिल्टर", "ফুয়েল ফিল্টার", "ফুয়েল ফিল্টার"]],
        ["oil filter", ["oil filter", "ऑयल फ़िल्टर", "ऑयल फिल्टर", "তেল ফিল্টার"]],
        ["brake lining", ["brake lining", "ब्रेक लाइनिंग", "ब्रेक लाइनिंग्स", "ব্রেক লাইনিং", "ব্রেক লাইনিংস"]],
        ["brake pad", ["brake pad", "ब्रेक पैड", "ब्रेक पॅड", "ব্রেক প্যাড"]],
        ["release bearing", ["release bearing", "क्लच रिलीज़ बेयरिंग", "क्लच रिलीज बेयरिंग", "রিলিজ বেয়ারিং", "রিলিজ বিয়ারিং"]],
        ["clutch plate", ["clutch plate", "clutch disc", "क्लच प्लेट", "ক্লাচ প্লেট"]],
        ["clutch cover", ["clutch cover", "क्लच कवर", "ক্লাচ কভার"]],
        ["water pump", ["water pump", "वॉटर पंप", "वाटर पंप", "ওয়াটার পাম্প", "ওয়াটার পাম্প"]],
        ["universal joint", ["universal joint", "uj cross", "यूनिवर्सल जॉइंट", "यूनिवर्सल जॉइंट क्रॉस", "ইউনিভার্সাল জয়েন্ট", "ইউনিভার্সাল জয়েন্ট"]],
        ["center support bearing", ["center support bearing", "centre support bearing", "center bearing", "सेंटर सपोर्ट बेयरिंग", "সেন্টার সাপোর্ট বেয়ারিং", "সেন্টার সাপোর্ট বিয়ারিং"]],
        ["torque rod bush", ["torque rod bush", "torque rod bushes", "टॉर्क रॉड बुश", "টর্ক রড বুশ"]],
        ["tail lamp", ["tail lamp", "tail light", "टेल लैंप", "टेल लैम्प", "পিছনের ল্যাম্প", "টেল ল্যাম্প"]],
        ["head lamp", ["head lamp", "head light", "हेड लैंप", "হেড ল্যাম্প"]],
        ["flywheel", ["flywheel", "फ्लाईव्हील", "फ्लाई व्हील", "ফ্লাইহুইল", "ফ্লাই হুইল"]],
        ["propeller shaft", ["propeller shaft", "propshaft", "प्रोपेलर शाफ्ट", "প্রপেলার শ্যাফ্ট"]],
        ["starter motor", ["starter motor", "starter", "स्टार्टर मोटर", "স্টার্টার মোটর"]],
        ["alternator", ["alternator", "अल्टरनेटर", "অল্টারনেটর"]],
        ["radiator", ["radiator", "रेडिएटर", "রেডিয়েটর", "রেডিয়েটর"]],
        ["fan belt", ["fan belt", "fan belt", "फैन बेल्ट", "ফ্যান বেল্ট"]],
        ["wheel bearing", ["wheel bearing", "व्हील बेयरिंग", "व्हील बियरिंग", "হুইল বেয়ারিং", "হুইল বিয়ারিং"]],
        ["oil seal", ["oil seal", "ऑयल सील", "অয়েল সিল", "অয়েল সিল"]],
        ["king pin", ["king pin", "किंग पिन", "কিং পিন"]],
        ["leaf spring", ["leaf spring", "leaf springs", "लीफ स्प्रिंग", "लीफ स्प्रिंग्स", "লিফ স্প্রিং", "লিফ স্প্রিংস"]],
        ["shock absorber", ["shock absorber", "शॉक एब्जॉर्बर", "শক অ্যাবজর্বার"]],
        ["air brake", ["air brake", "एयर ब्रेक", "এয়ার ব্রেক", "এয়ার ব্রেক"]],
        ["brake chamber", ["brake chamber", "ब्रेक चैंबर", "ब्रेक चैम्बर", "ব্রেক চেম্বার"]],
        ["slack adjuster", ["slack adjuster", "स्लैक एडजस्टर", "স্ল্যাক অ্যাডজাস্টার"]],
        ["clutch", ["clutch", "क्लच", "ক্লাচ"]],
        ["brake", ["brake", "ब्रेक", "ব্রেক"]],
        ["filter", ["filter", "फ़िल्टर", "फिल्टर", "ফিল্টার", "ফিল্টার"]],
        ["bearing", ["bearing", "बेयरिंग", "बियरिंग", "বেয়ারিং", "বিয়ারিং"]],
        ["lubricant", ["lubricant", "लुब्रिकेंट", "লুব্রিকেন্ট", "oil", "तेल", "তেল"]],
        ["truck", ["truck", "ट्रक", "ট্রাক"]],
        ["bus", ["bus", "बस", "বাস"]],
        ["tractor", ["tractor", "ट्रैक्टर", "ট্রাক্টর"]],
        ["spare part", ["spare part", "spare parts", "स्पेयर पार्ट", "स्पेयर पार्ट्स", "स्पেয়ার পার্ট", "স্পেয়ার পার্টস", "স্পেয়ার পার্ট", "স্পেয়ার পার্টস"]],
        ["tata", ["tata", "टाटा", "তাতা", "টাটা"]],
        ["ashok leyland", ["ashok leyland", "अशोक लेलैंड", "अशोक लीलैंड", "অশোক লেল্যান্ড"]],
        ["eicher", ["eicher", "आयशर", "আইশার"]],
        ["bharatbenz", ["bharatbenz", "भारतबेंज़", "भारतबेंज", "ভারত বেঞ্জ"]],
        ["mahindra", ["mahindra", "महिंद्रा", "মাহিন্দ্রা"]],
        ["force motors", ["force motors", "फोर्स मोटर्स", "ফোর্স মোটরস"]],
        ["bosch", ["bosch", "बॉश", "बॉश", "বশ"]],
        ["skf", ["skf", "एसकेएफ", "এসকেএফ"]],
        ["timken", ["timken", "टिमकेन", "টিমকেন"]],
        ["setco", ["setco", "सेटको", "সেটকো"]],
        ["wabco", ["wabco", "वैबको", "ওয়াবকো", "ওয়াবকো"]],
        ["knorr bremse", ["knorr bremse", "नॉर ब्रेम्से", "নর ব্রেমসে"]]
    ];

    const PRODUCT_INTENT_TERMS = new Set([
        "clutch", "brake", "filter", "bearing", "lubricant",
        "air filter", "fuel filter", "oil filter", "brake lining",
        "brake pad", "release bearing", "clutch plate", "clutch cover",
        "water pump", "universal joint", "center support bearing",
        "torque rod bush", "tail lamp", "head lamp", "flywheel",
        "propeller shaft", "starter motor", "alternator", "radiator",
        "fan belt", "wheel bearing", "oil seal", "king pin",
        "leaf spring", "shock absorber", "air brake", "brake chamber",
        "slack adjuster", "spare part"
    ]);

    const STOP_WORDS = new Set([
        "the", "a", "an", "for", "with", "in", "on", "of", "and",
        "के", "का", "की", "को", "से", "में", "और", "लिए", "का",
        "এর", "এবং", "ও", "তে", "জন্য", "দিয়ে", "দিয়ে", "সাথে", "এর জন্য",
        "का लिए"
    ]);

    function normalise(value) {
        return String(value ?? "")
            .normalize("NFKC")
            .replace(/[०-९০-৯]/g, char => INDIC_DIGIT_MAP[char] || char)
            .trim()
            .toLocaleLowerCase();
    }

    // Part numbers are commonly entered with spaces, hyphens or slashes.
    const compact = value =>
        normalise(value).replace(/[^a-z0-9]+/g, "");

    const escapeRegExp = value =>
        String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    function searchableText(value) {
        return normalise(value);
    }

    function unique(values) {
        return [...new Set(values.filter(Boolean))];
    }

    function expandQuery(query) {
        const original = normalise(query);
        if (!original) return [];

        const variants = [original];
        let translated = original;

        // Long phrases first so "clutch plate" is expanded before "clutch".
        const aliases = QUERY_ALIASES
            .flatMap(([canonical, terms]) => terms.map(term => ({ canonical, term: normalise(term) })))
            .sort((a, b) => b.term.length - a.term.length);

        aliases.forEach(({ canonical, term }) => {
            if (!term || term === canonical) return;
            const pattern = new RegExp(`(^|\\s)${escapeRegExp(term)}(?=$|\\s)`, "giu");
            translated = translated.replace(pattern, `$1${canonical}`);
        });

        if (translated !== original) variants.push(translated.trim());

        // Also support query fragments where punctuation joins terms.
        const compactQuery = compact(original);
        aliases.forEach(({ canonical, term }) => {
            if (!term) return;
            if (compact(term) && compactQuery.includes(compact(term))) {
                variants.push(canonical);
            }
        });

        return unique(variants);
    }

    function tokenize(value) {
        return unique(
            normalise(value)
                .split(/[^a-z0-9\u0900-\u097F\u0980-\u09FF]+/u)
                .filter(token => token.length >= 2)
        );
    }

    function meaningfulTokens(value) {
        return tokenize(value).filter(token => !STOP_WORDS.has(token));
    }

    function tokenOverlapScore(query, text) {
        const queryTokens = meaningfulTokens(query);
        const textTokens = meaningfulTokens(text);
        if (!queryTokens.length || !textTokens.length) return 0;

        let matched = 0;
        queryTokens.forEach(token => {
            if (textTokens.some(candidate => candidate === token || candidate.includes(token) || token.includes(candidate))) {
                matched += 1;
            }
        });

        return matched / queryTokens.length;
    }

    function editDistanceAtMost(a, b, maxDistance = 1) {
        if (a === b) return 0;
        if (!a || !b) return Infinity;
        if (Math.abs(a.length - b.length) > maxDistance) return Infinity;

        const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
        const curr = new Array(b.length + 1).fill(0);

        for (let i = 1; i <= a.length; i++) {
            curr[0] = i;
            let rowMin = curr[0];
            for (let j = 1; j <= b.length; j++) {
                curr[j] = Math.min(
                    curr[j - 1] + 1,
                    prev[j] + 1,
                    prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
                rowMin = Math.min(rowMin, curr[j]);
            }
            if (rowMin > maxDistance) return Infinity;
            for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
        }
        return curr[b.length];
    }

    function fuzzyTokenScore(query, text) {
        const queryTokens = tokenize(query).filter(token => token.length >= 4);
        if (!queryTokens.length) return 0;

        const textTokens = tokenize(text);
        if (!textTokens.length) return 0;

        let total = 0;
        for (const qToken of queryTokens) {
            let matched = false;
            for (const token of textTokens) {
                if (token.includes(qToken) || qToken.includes(token)) {
                    total += 1;
                    matched = true;
                    break;
                }
                const allowed = qToken.length >= 8 ? 2 : 1;
                if (editDistanceAtMost(qToken, token, allowed) <= allowed) {
                    total += 1;
                    matched = true;
                    break;
                }
            }
            if (!matched) continue;
        }

        return queryTokens.length ? total / queryTokens.length : 0;
    }

    function hasProductIntent(query) {
        return expandQuery(query).some(variant => {
            const normalized = normalise(variant);
            return [...PRODUCT_INTENT_TERMS].some(term =>
                normalized === term || normalized.includes(`${term} `) || normalized.includes(` ${term}`)
            );
        });
    }

    function productIntentScore(item, query) {
        const variants = expandQuery(query);
        const normalizedQuery = variants.join(" ");
        const intentTerms = [...PRODUCT_INTENT_TERMS].filter(term =>
            normalizedQuery === term ||
            normalizedQuery.includes(`${term} `) ||
            normalizedQuery.includes(` ${term}`)
        );
        if (!intentTerms.length) return 0;

        const text = searchableText([
            item?.title,
            item?.subtitle,
            item?.keywords,
            item?.description,
            item?.applications,
            item?.category?.name,
            item?.brand?.name
        ].flat().filter(Boolean).join(" "));

        let score = 0;
        intentTerms.forEach(term => {
            if (text.includes(term)) score += term.includes(" ") ? 520 : 340;
        });
        return score;
    }

    function scoreItemForQuery(item, query) {
        const needle = normalise(query);
        if (!needle) return 0;

        const title = searchableText(item.title);
        const subtitle = searchableText(item.subtitle);
        const partNumber = searchableText(item.part_number);
        const compactNeedle = compact(needle);
        const compactPartNumber = compact(item.part_number);
        const references = searchableText([
            ...(Array.isArray(item.manufacturer_part_numbers) ? item.manufacturer_part_numbers : []),
            ...(item.manufacturer_part_number ? [item.manufacturer_part_number] : []),
            ...(Array.isArray(item.alternate_part_numbers) ? item.alternate_part_numbers : []),
            ...(Array.isArray(item.oem_numbers) ? item.oem_numbers : []),
            ...(Array.isArray(item.cross_references) ? item.cross_references : [])
        ].join(" "));
        const compactReferences = compact(references);
        const keywords = searchableText(Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords);
        const description = searchableText(item.description);
        const applications = searchableText(Array.isArray(item.applications) ? item.applications.join(" ") : item.applications);
        const vehicles = searchableText(Array.isArray(item.vehicles) ? item.vehicles.join(" ") : item.vehicles);

        let score = 0;

        if (partNumber && partNumber === needle) score += 1000;
        else if (compactPartNumber && compactPartNumber === compactNeedle && compactNeedle) score += 950;
        else if (partNumber && partNumber.includes(needle)) score += 700;
        else if (compactPartNumber && compactNeedle && compactPartNumber.includes(compactNeedle)) score += 650;

        if (references.includes(needle)) score += 650;
        else if (compactReferences && compactNeedle && compactReferences.includes(compactNeedle)) score += 600;

        if (title === needle) score += 900;
        else if (title.startsWith(needle)) score += 600;
        else if (title.includes(needle)) score += 350;

        if (subtitle.includes(needle)) score += 150;
        if (keywords.includes(needle)) score += 120;
        if (description.includes(needle)) score += 80;
        if (applications.includes(needle)) score += 70;
        if (vehicles.includes(needle)) score += 70;

        const fuzzyText = [title, subtitle, keywords, description, applications, vehicles].join(" ");
        const fuzzy = fuzzyTokenScore(needle, fuzzyText);
        if (fuzzy >= 1) score += 55 * fuzzy;

        const tokenOverlap = tokenOverlapScore(needle, fuzzyText);
        if (tokenOverlap > 0) {
            score += 85 * tokenOverlap;
            if (tokenOverlap >= 1) score += 120;
        }

        // Type bonus is only a ranking bonus; it must never turn an unrelated
        // record into a match by itself.
        if (score > 0) {
            score += TYPE_BONUS[normalise(item.type)] || 0;
        }
        return score;
    }

    function scoreItem(item, query) {
        const variants = expandQuery(query);
        if (!variants.length) return 0;

        let best = 0;
        variants.forEach((variant, index) => {
            const score = scoreItemForQuery(item, variant);
            const adjusted = index === 0 ? score : (score > 0 ? Math.max(1, score - 5) : 0);
            best = Math.max(best, adjusted);
        });
        return best;
    }

    function trackSearch(query, resultCount, source = "search") {
        const payload = {
            query: String(query || "").trim().slice(0, 160),
            resultCount: Number(resultCount) || 0,
            source: String(source || "search"),
            timestamp: new Date().toISOString()
        };

        try {
            window.dispatchEvent(new CustomEvent("souviks:search", { detail: payload }));
        } catch (error) {
            // CustomEvent may be unavailable in older embedded browsers.
        }

        if (typeof window.gtag === "function" && payload.query) {
            try {
                window.gtag("event", "search", {
                    search_term: payload.query,
                    results_count: payload.resultCount,
                    search_source: payload.source
                });
            } catch (error) {
                // Analytics must never interfere with search.
            }
        }
    }

    function search(records, query, limit = 20) {
        const max = Math.min(Math.max(Number(limit) || 20, 1), 100);

        const productIntent = hasProductIntent(query);

        return (Array.isArray(records) ? records : [])
            .map((item, index) => {
                let score = scoreItem(item, query);
                const type = normalise(item?.type);
                if (productIntent) {
                    if (type === "product") score += 420 + productIntentScore(item, query);
                    else if (type === "category") score += 90;
                }
                return { item, index, score };
            })
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, max)
            .map(entry => ({ ...entry.item, score: entry.score }));
    }

    function matchesText(text, query) {
        return scoreItem({
            type: "directory",
            title: text,
            subtitle: "",
            part_number: "",
            keywords: [text],
            description: text
        }, query) > 0;
    }

    function productSearchRecord(product) {
        return {
            ...product,
            type: "product",
            title: product?.product_name || product?.name || "",
            subtitle: product?.brand_name || product?.brand || "",
            part_number: product?.part_number || product?.partNumber || "",
            keywords: product?.keywords || [product?.brand_name, product?.category_name, product?.subcategory_name].filter(Boolean),
            description: product?.short_description || product?.description || ""
        };
    }

    function filterProducts(records, query) {
        const needle = normalise(query);
        if (!needle) return Array.isArray(records) ? records : [];

        return (Array.isArray(records) ? records : [])
            .map((product, index) => ({ product, index, score: scoreItem(productSearchRecord(product), needle) }))
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .map(entry => entry.product);
    }

    const QUICK_SUGGESTIONS = [
        "clutch", "clutch plate", "clutch cover", "release bearing",
        "brake", "brake lining", "brake pad", "air brake", "brake chamber",
        "filter", "air filter", "fuel filter", "oil filter",
        "bearing", "wheel bearing", "center support bearing",
        "water pump", "tail lamp", "head lamp", "flywheel",
        "propeller shaft", "starter motor", "alternator", "radiator",
        "torque rod bush", "universal joint", "king pin", "leaf spring",
        "shock absorber", "fan belt", "oil seal", "spare parts"
    ];

    function suggestionDistance(query, candidate) {
        const qTokens = meaningfulTokens(query);
        const cTokens = meaningfulTokens(candidate);
        if (!qTokens.length || !cTokens.length) return Infinity;

        let total = 0;
        let pairs = 0;
        qTokens.forEach(q => {
            let best = Infinity;
            cTokens.forEach(c => {
                if (q === c) best = 0;
                else if (c.includes(q) || q.includes(c)) best = Math.min(best, Math.abs(c.length - q.length));
                else if (Math.min(q.length, c.length) >= 4) best = Math.min(best, editDistanceAtMost(q, c, 2));
            });
            if (best !== Infinity) { total += best; pairs += 1; }
        });
        return pairs ? total / pairs + Math.max(0, cTokens.length - qTokens.length) * 0.25 : Infinity;
    }

    function suggestQueries(query, records = [], limit = 5) {
        const needle = normalise(query);
        if (!needle) return QUICK_SUGGESTIONS.slice(0, limit);
        const queryVariants = expandQuery(needle);

        const candidates = new Map();
        const add = value => {
            const text = String(value || "").trim();
            const key = compact(text);
            if (text && key && !candidates.has(key)) candidates.set(key, text);
        };

        QUICK_SUGGESTIONS.forEach(add);
        QUERY_ALIASES.forEach(([canonical]) => add(canonical));

        (Array.isArray(records) ? records : []).slice(0, 1200).forEach(item => {
            add(item?.part_number);
            add(item?.product_name || item?.name);
            add(item?.title);
            add(item?.brand_name);
            add(item?.category_name);
            add(item?.brand?.name);
            add(item?.category?.name);
        });

        return [...candidates.values()]
            .map((candidate, index) => {
                const candidateNormal = normalise(candidate);
                const distances = queryVariants.map(variant => suggestionDistance(variant, candidate));
                const exact = queryVariants.some(variant => normalise(variant) === candidateNormal) ? 0 : 1;
                return { candidate, distance: Math.min(...distances), index, exact };
            })
            .filter(entry => Number.isFinite(entry.distance))
            .sort((a, b) => a.exact - b.exact || a.distance - b.distance || a.index - b.index)
            .map(entry => entry.candidate)
            .slice(0, Math.min(Math.max(Number(limit) || 5, 1), 8));
    }

    window.SouviksSearchEngine = {
        normalise,
        compact,
        expandQuery,
        scoreItem,
        search,
        matchesText,
        filterProducts,
        suggestQueries,
        trackSearch
    };

})();


/* ===== voice-search.js ===== */
/* Souviks — browser-native voice search */
(function () {
    "use strict";

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function localeLanguage() {
        const lang = String(document.documentElement.lang || navigator.language || "en-IN").toLowerCase();
        if (lang.startsWith("bn")) return "bn-IN";
        if (lang.startsWith("hi")) return "hi-IN";
        return "en-IN";
    }

    function initVoiceSearch() {
        const input = document.getElementById("searchInput");
        const button = document.getElementById("voiceSearch");
        if (!input || !button || !SpeechRecognition) return;

        button.hidden = false;
        input.classList.add("has-voice-search");

        let recognition = null;
        let listening = false;

        const submitSearch = () => {
            const query = String(input.value || "").trim();
            if (!query) {
                input.focus();
                return;
            }

            if (document.body.classList.contains("products-page")) {
                input.dispatchEvent(new Event("input", { bubbles: true }));
                return;
            }

            if (document.body.classList.contains("index-page")) return;

            const lang = window.souviks?.currentLanguage || document.documentElement.lang || "en";
            const url = new URL(`/${lang}/products`, window.location.origin);
            url.searchParams.set("q", query);
            window.location.assign(url.pathname + url.search);
        };

        document.getElementById("searchButton")?.addEventListener("click", submitSearch);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !document.body.classList.contains("index-page")) {
                event.preventDefault();
                submitSearch();
            }
        });

        const setState = active => {
            listening = active;
            button.classList.toggle("is-listening", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
            button.setAttribute("title", active ? "Listening…" : "Voice search");
            button.setAttribute("aria-label", active ? "Listening for your search" : "Voice search");
        };

        const start = () => {
            if (listening) {
                recognition?.stop();
                return;
            }

            recognition = new SpeechRecognition();
            recognition.lang = localeLanguage();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setState(true);
            recognition.onresult = event => {
                const transcript = Array.from(event.results || [])
                    .map(result => result?.[0]?.transcript || "")
                    .join(" ")
                    .trim();
                if (!transcript) return;
                input.value = transcript;
                input.dispatchEvent(new Event("input", { bubbles: true }));
            };
            recognition.onerror = event => {
                setState(false);
                if (event?.error === "not-allowed") {
                    button.title = "Microphone permission is blocked";
                }
            };
            recognition.onend = () => setState(false);

            try {
                recognition.start();
            } catch (error) {
                setState(false);
            }
        };

        button.addEventListener("click", start);
    }

    window.SouviksVoiceSearch = { init: initVoiceSearch };

    document.addEventListener("DOMContentLoaded", initVoiceSearch);
})();


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

            this.cache[filename] = data;

            return data;

        }

        catch (error) {

            console.error(error);

            return [];

        }

    }
    // ======================================================
    // PRODUCTS
    // ======================================================

    async products() {

        return await this.fetchJson(

            "products.json"

        );

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

        return await this.fetchJson(

            "brands.json"

        );

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

        return await this.fetchJson(

            "categories.json"

        );

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

        return await this.fetchJson(

            "vehicles.json"

        );

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

        return products.filter(

            product =>

                product.vehicles.includes(

                    vehicleName

                )

        );

    }
}

window.API = new SouviksAPI();


/* ===== filters.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
FILTER ENGINE
Version : 1.0
==========================================================
*/

class FilterManager {

    constructor() {

        this.original = [];

        this.filtered = [];

        this.filters = {};

    }
    // ======================================================
    // INIT
    // ======================================================

    init(data = []) {

        this.original = [...data];

        this.filtered = [...data];

        this.filters = {};

        return this.filtered;

    }
    // ======================================================
    // SET FILTER
    // ======================================================

    set(key, value) {

        if (

            value === null ||

            value === undefined ||

            value === ""

        ) {

            delete this.filters[key];

        }

        else {

            this.filters[key] = value;

        }

        return this.apply();

    }
    // ======================================================
    // REMOVE FILTER
    // ======================================================

    remove(key) {

        delete this.filters[key];

        return this.apply();

    }

    // ======================================================
    // CLEAR ALL
    // ======================================================

    clear() {

        this.filters = {};

        this.filtered = [

            ...this.original

        ];

        return this.filtered;

    }
    // ======================================================
    // APPLY
    // ======================================================

    apply() {

        this.filtered = this.original.filter(

            item => {

                return Object.entries(

                    this.filters

                ).every(

                    ([key, value]) => {

                        const field = item[key];

                        if (

                            Array.isArray(

                                field

                            )

                        ) {

                            return field.includes(

                                value

                            );

                        }

                        return field === value;

                    }

                );

            }

        );

        return this.filtered;

    }
    // ======================================================
    // SEARCH
    // ======================================================

    search(

        query,

        fields = []

    ) {

        if (!query) {

            return this.filtered;

        }

        query = query.toLowerCase();

        return this.filtered.filter(

            item => {

                return fields.some(

                    field => {

                        const value =

                            item[field];

                        if (

                            value === null ||

                            value === undefined

                        ) {

                            return false;

                        }

                        return String(

                            value

                        )

                        .toLowerCase()

                        .includes(

                            query

                        );

                    }

                );

            }

        );

    }
    // ======================================================
    // SORT
    // ======================================================

    sort(

        field,

        direction = "asc"

    ) {

        const multiplier =

            direction === "desc"

                ? -1

                : 1;

        this.filtered.sort(

            (a, b) => {

                const first =

                    a[field] ?? "";

                const second =

                    b[field] ?? "";

                if (

                    first < second

                ) {

                    return -1 *

                        multiplier;

                }

                if (

                    first > second

                ) {

                    return 1 *

                        multiplier;

                }

                return 0;

            }

        );

        return this.filtered;

    }
    // ======================================================
    // COUNTS
    // ======================================================

    counts(field) {

        const counts = {};

        this.original.forEach(

            item => {

                const value =

                    item[field];

                if (

                    value === null ||

                    value === undefined ||

                    value === ""

                ) {

                    return;

                }

                counts[value] =

                    (counts[value] || 0)

                    + 1;

            }

        );

        return counts;

    }
    // ======================================================
    // RESULTS
    // ======================================================

    results() {

        return this.filtered;

    }

    // ======================================================
    // TOTAL
    // ======================================================

    total() {

        return this.filtered.length;

    }
}

const Filters = new FilterManager();

/* ===== pagination.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
PAGINATION ENGINE
Version : 2.0
==========================================================
*/

class PaginationManager {
    constructor() {
        this.data = [];
        this.currentPage = 1;
        this.perPage = 20;
        this.totalPages = 1;
        this.container = null;
        this.onChange = null;
    }

    init({ data = [], perPage = 20, container = "#pagination", onChange = null } = {}) {
        this.data = [...data];
        this.perPage = this.normalisePerPage(perPage);
        this.currentPage = 1;
        this.container = Utils.el(container);
        this.onChange = onChange;
        this.calculate();
        this.render();
        return this.pageData();
    }

    normalisePerPage(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.floor(number) : 20;
    }

    calculate() {
        this.totalPages = Math.max(1, Math.ceil(this.data.length / this.perPage));
        this.currentPage = Math.min(this.currentPage, this.totalPages);
    }

    pageData() {
        const start = (this.currentPage - 1) * this.perPage;
        return this.data.slice(start, start + this.perPage);
    }

    update(data = []) {
        this.data = [...data];
        this.currentPage = 1;
        this.calculate();
        this.render();
        return this.pageData();
    }

    setPerPage(value, resetPage = true) {
        this.perPage = this.normalisePerPage(value);
        if (resetPage) this.currentPage = 1;
        this.calculate();
        this.render();
        return this.pageData();
    }

    previous() {
        if (this.currentPage <= 1) return;
        this.currentPage -= 1;
        this.refresh();
    }

    next() {
        if (this.currentPage >= this.totalPages) return;
        this.currentPage += 1;
        this.refresh();
    }

    go(page) {
        const target = Number(page);
        if (!Number.isFinite(target) || target < 1 || target > this.totalPages) return;
        this.currentPage = Math.floor(target);
        this.refresh();
    }

    refresh() {
        this.render();
        if (typeof this.onChange === "function") this.onChange(this.pageData());
    }

    render() {
        if (!this.container) return;

        const info = this.info();
        const hasMultiplePages = info.totalPages > 1;

        this.container.hidden = !hasMultiplePages;
        this.container.setAttribute("aria-hidden", String(!hasMultiplePages));

        if (!hasMultiplePages) {
            this.container.replaceChildren();
            return;
        }

        this.container.innerHTML = `
            <button class="pagination-prev" data-page="prev" ${info.currentPage === 1 ? "disabled" : ""} aria-label="Previous page">Previous</button>
            <span class="pagination-status" aria-live="polite">Page ${info.currentPage} of ${info.totalPages}</span>
            <button class="pagination-next" data-page="next" ${info.currentPage === info.totalPages ? "disabled" : ""} aria-label="Next page">Next</button>
        `;
        this.bind();
    }

    bind() {
        this.container?.querySelectorAll("[data-page]").forEach(button => {
            button.onclick = () => {
                const value = button.dataset.page;
                if (value === "prev") return this.previous();
                if (value === "next") return this.next();
                this.go(value);
            };
        });
    }

    info() {
        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            perPage: this.perPage,
            totalRecords: this.data.length
        };
    }
}

const Pagination = new PaginationManager();


/* ===== products.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
PRODUCTS MODULE
Version : 1.0
==========================================================
*/

class ProductManager {

constructor() {

    this.products = [];
    this.filtered = [];

    this.container = null;

    this.currentPage = 1;

    this.pageSize = 20;

}
    // ======================================================
    // INIT
    // ======================================================

    async init(

        selector = "#product-grid",
        source = "products"

    ) {

        this.container = Utils.el(

            selector

        );

        if (!this.container) {

            return;

        }

        this.products = source === "catalogue-index"
            ? await API.catalogueIndex()
            : await API.products();

        this.filtered = [

            ...this.products

        ];

        // Keep builder-generated product cards in the initial HTML.
        // JavaScript continues to render after filtering, sorting,
        // pagination, or other user interaction.
        if (
            this.container.dataset.staticRendered !==
            "true"
        ) {
            this.render();
        }

    }

    // ======================================================
    // PRODUCT IMAGE RESOLUTION
    // ======================================================

    productImageSrc(product, filename = null) {
        const folder = String(product?.image_folder || "").trim();
        const candidate = String(
            filename ||
            (Array.isArray(product?.gallery) && product.gallery.length
                ? product.gallery[0]
                : product?.primary_image || "")
        ).trim();

        // The packaged gallery is authoritative. It contains the actual
        // normalized filenames (1.webp, 2.webp, ...).
        if (folder && candidate) {
            return `/assets/images/products/${encodeURIComponent(folder)}/${encodeURIComponent(candidate)}`;
        }

        const imageUrl = String(product?.image_url || "").trim();
        if (imageUrl && !imageUrl.endsWith("/placeholder.webp")) {
            return imageUrl;
        }

        return "/assets/images/placeholder.webp";
    }



    // ======================================================
    // STATIC PDP SYNCHRONIZATION
    // ======================================================

    syncStaticProductGallery(product) {
        const gallery = document.querySelector(".pdp-gallery");
        if (!gallery) return;

        const folder = String(product?.image_folder || "").trim();
        const galleryFiles = Array.isArray(product?.gallery)
            ? product.gallery.map(file => String(file || "").trim()).filter(Boolean)
            : [];
        const fallback = String(product?.image_url || "").trim() || "/assets/images/placeholder.webp";

        const srcFor = filename => {
            if (!filename) return fallback;
            if (/^https?:\/\//i.test(filename) || filename.startsWith("/")) return filename;
            if (folder) {
                return `/assets/images/products/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
            }
            if (filename === product?.image && fallback) return fallback;
            return fallback;
        };

        const dimensionsFor = filename => {
            const dims = product?.gallery_dimensions?.[filename];
            if (!Array.isArray(dims) || dims.length !== 2) return null;
            const width = Number(dims[0]);
            const height = Number(dims[1]);
            return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
                ? [width, height]
                : null;
        };

        const mainImage = document.getElementById("pdpMainImage");
        if (mainImage) {
            const src = srcFor(galleryFiles[0] || String(product?.image || "").trim());
            mainImage.src = src;
            mainImage.alt = String(product?.product_name || product?.name || "Product image");
            const dims = dimensionsFor(galleryFiles[0] || String(product?.image || "").trim());
            if (dims) {
                mainImage.width = dims[0];
                mainImage.height = dims[1];
            }
        }

        const thumbContainer = gallery.querySelector(".pdp-thumbnails");
        if (!thumbContainer || !galleryFiles.length) return;

        const existingButtons = Array.from(thumbContainer.querySelectorAll(".pdp-thumb"));
        galleryFiles.forEach((filename, index) => {
            let button = existingButtons[index];
            if (!button) {
                button = document.createElement("button");
                button.type = "button";
                button.className = "pdp-thumb";
                thumbContainer.appendChild(button);
            }
            button.hidden = false;
            button.setAttribute("type", "button");
            button.setAttribute("aria-label", `View ${String(product?.product_name || product?.name || "Product")} image ${index + 1}`);
            let img = button.querySelector("img");
            if (!img) {
                img = document.createElement("img");
                button.appendChild(img);
            }
            img.src = srcFor(filename);
            img.alt = `${String(product?.product_name || product?.name || "Product")} image ${index + 1}`;
            img.loading = "lazy";
            img.decoding = "async";
            img.draggable = false;
            const dims = dimensionsFor(filename);
            if (dims) {
                img.width = dims[0];
                img.height = dims[1];
            }
        });

        existingButtons.slice(galleryFiles.length).forEach(button => {
            button.hidden = true;
        });
    }

    async hydrateStaticRecommendations(product) {
        const frequentSlider = document.querySelector(".pdp-frequent-slider");
        const relatedSlider = document.querySelector(".pdp-related-slider-main");

        const bindSlider = (slider, prev, next) => {
            if (!slider || slider.dataset.recommendationControlsBound === "true") return;
            slider.dataset.recommendationControlsBound = "true";
            prev?.addEventListener("click", () => slider.scrollBy({ left: -600, behavior: "smooth" }));
            next?.addEventListener("click", () => slider.scrollBy({ left: 600, behavior: "smooth" }));
        };

        bindSlider(frequentSlider, document.querySelector(".pdp-frequent-prev"), document.querySelector(".pdp-frequent-next"));
        bindSlider(relatedSlider, document.querySelector(".pdp-related-prev-btn"), document.querySelector(".pdp-related-next-btn"));

        const frequentNeedsData = Boolean(frequentSlider && !frequentSlider.querySelector(".product-card"));
        const relatedNeedsData = Boolean(relatedSlider && !relatedSlider.querySelector(".product-card"));
        if (!frequentNeedsData && !relatedNeedsData) return;

        try {
            const response = await fetch("/assets/data/catalogue-index.json", {
                headers: { Accept: "application/json" },
                cache: "no-store",
                credentials: "same-origin"
            });
            if (!response.ok) return;
            const catalogue = await response.json();
            if (!Array.isArray(catalogue) || !catalogue.length) return;

            const previousProducts = this.products;
            this.products = catalogue;

            const frequentlyProducts = this.frequentlyUsedWith(product, 6);
            const frequentIds = new Set(frequentlyProducts.map(item => item.id));
            const relatedProducts = this.related(product, 6, frequentIds);

            if (frequentSlider && frequentNeedsData) {
                frequentSlider.innerHTML = frequentlyProducts.map(item => this.card(item)).join("");
            }
            if (relatedSlider && relatedNeedsData) {
                relatedSlider.innerHTML = relatedProducts.map(item => this.card(item)).join("");
            }

            this.products = previousProducts;

            bindSlider(frequentSlider, document.querySelector(".pdp-frequent-prev"), document.querySelector(".pdp-frequent-next"));
            bindSlider(relatedSlider, document.querySelector(".pdp-related-prev-btn"), document.querySelector(".pdp-related-next-btn"));
            window.SavedProducts?.updateButtons?.();
        } catch (error) {
            console.warn("[Souviks PDP] Static recommendation hydration unavailable:", error);
        }
    }

    // ======================================================
    // PRODUCT CARD
    // ======================================================

card(product) {

    const cardImage = this.productImageSrc(product);

    const productId = String(product.id || "");
    const name = String(product.product_name || product.name || "");
    const partNumber = String(product.part_number || product.partNumber || "");
    const brandName = String(product.brand_name || product.brand || "");
    const manufacturerParts = [
        ...(Array.isArray(product.manufacturer_part_numbers) ? product.manufacturer_part_numbers : []),
        ...(product.manufacturer_part_number ? [product.manufacturer_part_number] : [])
    ].map(String).map(v => v.trim()).filter(Boolean);
    const manufacturerPart = manufacturerParts[0] || "";
    const references = [
        ...manufacturerParts,
        ...(Array.isArray(product.alternate_part_numbers) ? product.alternate_part_numbers : []),
        ...(Array.isArray(product.oem_numbers) ? product.oem_numbers : []),
        ...(Array.isArray(product.cross_references) ? product.cross_references : [])
    ].filter(Boolean);
    const hasSellingPrice = product.selling_price !== null && product.selling_price !== undefined && product.selling_price !== "";
    const hasMrp = product.mrp !== null && product.mrp !== undefined && product.mrp !== "";
    const mrpNumber = Number(product.mrp);
    const sellingNumber = Number(product.selling_price);
    const discounted = Number.isFinite(mrpNumber) && Number.isFinite(sellingNumber) && mrpNumber > 0 && sellingNumber < mrpNumber;
    const discount = discounted
        ? Math.round(((mrpNumber - sellingNumber) / mrpNumber) * 100)
        : null;
    const price = discounted
        ? `<span class="product-price-current">${Utils.currency(sellingNumber)}</span><span class="product-price-mrp">MRP ${Utils.currency(mrpNumber)}</span><span class="product-price-discount">${discount}% OFF</span>`
        : (hasSellingPrice || hasMrp)
            ? `${hasSellingPrice ? "Price" : "MRP"}: ${Utils.currency(hasSellingPrice ? product.selling_price : product.mrp)}`
            : "Get current price";
    const isSaved =
        typeof SavedProducts !== "undefined" &&
        SavedProducts.isSaved(productId);

    const escape = value =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");

    return `
    <article class="product-card">
        <div class="product-image">
            <a href="${Utils.productUrl(product)}" aria-label="View ${escape(name)}">
                <img
                    class="product-image-file"
                    src="${cardImage}"
                    alt="${escape(name)}"
                    loading="lazy"
                    decoding="async"
                    draggable="false">
            </a>
            <button
                type="button"
                class="product-save-button ${isSaved ? "is-saved" : ""}"
                data-saved-product-id="${escape(productId)}"
                data-saved="${isSaved ? "true" : "false"}"
                aria-pressed="${isSaved ? "true" : "false"}"
                aria-label="${isSaved ? "Remove from saved products" : "Save product"}">
                <span data-saved-icon aria-hidden="true">${isSaved ? "♥" : "♡"}</span>
            </button>
        </div>
        <div class="product-content">
            <div class="product-brand-label">${escape(brandName)}</div>
            <div class="product-part-number">${partNumber ? `Part No. <strong>${escape(partNumber)}</strong>` : "Part number on request"}</div>
            <h3 class="product-title"><a href="${Utils.productUrl(product)}">${escape(name)}</a></h3>
            <div class="product-price ${discounted ? "product-price-sale" : ""}" aria-label="Price">${price}</div>
            <button
                type="button"
                class="btn btn-primary add-to-cart"
                data-id="${escape(productId)}"
                data-part="${escape(partNumber)}"
                data-name="${escape(name)}"
                data-brand="${escape(brandName)}"
                aria-label="Add ${escape(name)} to RFQ">
                ${window.souviks?.translations?.buttons?.add_to_rfq || "Add To RFQ"}
            </button>
        </div>
    </article>
    `;
}

    // ======================================================
    // RENDER GRID
    // ======================================================

render() {

    if (!this.container) {

        return;

    }

    if (

        !this.filtered ||

        this.filtered.length === 0

    ) {

        this.container.innerHTML =

            Utils.emptyState(

                "No products found."

            );

        return;

    }

    const start =

        (this.currentPage - 1) *

        this.pageSize;

    const end =

        start +

        this.pageSize;

    const pageProducts =

        this.filtered.slice(

            start,

            end

        );

    this.container.innerHTML =

        pageProducts

            .map(

                product =>

                    this.card(product)

            )

            .join("");

    this.updateResults();

    this.renderPagination();

}

updateResults() {

    const totalProducts =
        document.getElementById("totalProducts");

    if (totalProducts) {
        totalProducts.textContent =
            this.products.length;
    }

    const visible =
        document.getElementById("visibleProducts");

    if (visible) {
        visible.textContent =
            this.filtered.length;
    }

    const start =
        document.getElementById("currentResultStart");

    const end =
        document.getElementById("currentResultEnd");

    const total =
        document.getElementById("totalResults");

    if (start) {
        start.textContent =
            this.filtered.length
                ? ((this.currentPage - 1) * this.pageSize) + 1
                : 0;
    }

    if (end) {
        end.textContent =
            Math.min(
                this.currentPage * this.pageSize,
                this.filtered.length
            );
    }

    if (total) {
        total.textContent =
            this.filtered.length;
    }
}

    // ======================================================
    // PAGINATION
    // ======================================================

renderPagination() {

    const container =

        document.getElementById(

            "pagination"

        );

    if (!container) {

        return;

    }

    const pages = Math.ceil(

        this.filtered.length /

        this.pageSize

    );

    let html = "";

    for (

        let i = 1;

        i <= pages;

        i++

    ) {

        html += `

        <button

            class="pagination-page ${

                i === this.currentPage

                    ? "active"

                    : ""

            }"

            data-page="${i}">

            ${i}

        </button>

        `;

    }

    container.innerHTML = html;

    container

        .querySelectorAll(

            "[data-page]"

        )

        .forEach(

            button => {

                button.addEventListener(

                    "click",

                    () => {

                        this.currentPage =

                            Number(

                                button.dataset.page

                            );

                        this.render();

                    }

                );

            }

        );

}

    // ======================================================
    // FILTER BRAND
    // ======================================================

    filterBrand(

        brandId

    ) {

        if (!brandId) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;

            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.brand_id ===

                    brandId

            );

        this.render();

    }

    // ======================================================
    // FILTER CATEGORY
    // ======================================================

    filterCategory(

        categoryId

    ) {

        if (!categoryId) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;
            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.category_id ===

                    categoryId

            );

        this.render();

    }

    // ======================================================
    // FILTER VEHICLE
    // ======================================================

    filterVehicle(

        vehicleName

    ) {

        if (!vehicleName) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;
            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.vehicles.includes(

                        vehicleName

                    )

            );

        this.render();

    }

    // ======================================================
    // FEATURED
    // ======================================================

    featured(

        count = 8

    ) {

        return this.products

            .filter(

                item =>

                    item.featured === true

            )

            .slice(

                0,

                count

            );

    }

    // ======================================================
    // PDP RECOMMENDATIONS
    // ======================================================

frequentlyUsedWith(product, limit = 6, excludedIds = new Set()) {

    const currentVehicles = new Set(
        (product?.vehicles || []).map(v => String(v).trim()).filter(Boolean)
    );

    if (!currentVehicles.size) return [];

    const relevance = item => {
        const itemVehicles = new Set(
            (item?.vehicles || []).map(v => String(v).trim()).filter(Boolean)
        );
        return [...currentVehicles].filter(v => itemVehicles.has(v)).length;
    };

    return this.products
        .filter(item =>
            item.id !== product.id &&
            !excludedIds.has(item.id) &&
            item.active !== false &&
            relevance(item) > 0
        )
        .sort((a, b) => {
            const scoreA = relevance(a);
            const scoreB = relevance(b);
            if (scoreB !== scoreA) return scoreB - scoreA;
            if (a.subcategory_id === product.subcategory_id && b.subcategory_id !== product.subcategory_id) return -1;
            if (b.subcategory_id === product.subcategory_id && a.subcategory_id !== product.subcategory_id) return 1;
            if (a.category_id === product.category_id && b.category_id !== product.category_id) return -1;
            if (b.category_id === product.category_id && a.category_id !== product.category_id) return 1;
            return String(a.product_name || "").localeCompare(String(b.product_name || ""));
        })
        .slice(0, limit);
}

related(product, limit = 6, excludedIds = new Set()) {

    return this.products
        .filter(item =>
            item.id !== product.id &&
            !excludedIds.has(item.id) &&
            item.active !== false &&
            item.category_id === product.category_id
        )
        .sort((a, b) => {
            const subA = a.subcategory_id === product.subcategory_id ? 0 : 1;
            const subB = b.subcategory_id === product.subcategory_id ? 0 : 1;
            if (subA !== subB) return subA - subB;

            const brandA = a.brand_id === product.brand_id ? 0 : 1;
            const brandB = b.brand_id === product.brand_id ? 0 : 1;
            if (brandA !== brandB) return brandA - brandB;

            return String(a.product_name || "").localeCompare(String(b.product_name || ""));
        })
        .slice(0, limit);
}

    // ======================================================
    // PRODUCT PRICING
    // ======================================================

priceHtml(product) {

    const mrp = Number(product?.mrp);
    const sellingPrice = Number(product?.selling_price);

    const hasMrp = Number.isFinite(mrp) && mrp >= 0;
    const hasSellingPrice = Number.isFinite(sellingPrice) && sellingPrice >= 0;

    if (!hasMrp && !hasSellingPrice) {
        return "";
    }

    const formatPrice = value =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(value);

    let discountHtml = "";

    if (hasMrp && hasSellingPrice && mrp > 0 && sellingPrice < mrp) {
        const discount = Math.round(((mrp - sellingPrice) / mrp) * 100);
        discountHtml = `<span class="pdp-price-discount">${discount}% OFF</span>`;
    }

    return `
        <div class="pdp-pricing" aria-label="Product pricing">
            ${hasMrp ? `
                <div class="pdp-price-mrp">
                    <span class="pdp-price-label">MRP</span>
                    <span class="pdp-price-value">${formatPrice(mrp)}</span>
                </div>
            ` : ""}
            ${hasSellingPrice ? `
                <div class="pdp-price-selling">
                    <span class="pdp-price-label">Selling Price</span>
                    <span class="pdp-price-value">${formatPrice(sellingPrice)}</span>
                    ${discountHtml}
                </div>
            ` : ""}
        </div>
    `;
}

    // ======================================================
    // PRODUCT GALLERY
    // ======================================================

    bindGallery(product) {
        const gallery = document.querySelector(".pdp-gallery");
        const mainImage = document.getElementById("pdpMainImage");
        if (!gallery || !mainImage) return;

        const placeholder = "/assets/images/placeholder.webp";

        const primary = this.productImageSrc(product) || placeholder;

        const safeImage = (image, fallback = primary) => {
            if (!image || image.dataset.galleryFallback === "placeholder") return;

            image.addEventListener("error", () => {
                const stage = image.dataset.galleryFallback || "primary";

                if (stage === "primary" && fallback && fallback !== image.src) {
                    image.dataset.galleryFallback = "placeholder";
                    image.src = fallback;
                    return;
                }

                image.dataset.galleryFallback = "placeholder";
                image.src = placeholder;
            }, { once: true });
        };

        // Main image: current source -> canonical primary -> global placeholder.
        mainImage.dataset.galleryFallback = "primary";
        mainImage.addEventListener("error", () => {
            if (mainImage.dataset.galleryFallback === "primary" &&
                primary &&
                mainImage.src !== new URL(primary, window.location.href).href) {
                mainImage.dataset.galleryFallback = "placeholder";
                mainImage.src = primary;
                return;
            }

            mainImage.dataset.galleryFallback = "done";
            mainImage.src = placeholder;
        });

        const thumbs = [...gallery.querySelectorAll(".pdp-thumb")];
        const validThumbs = thumbs.length ? thumbs : [];

        validThumbs.forEach((thumb, index) => {
            const img = thumb.querySelector("img");
            if (!img) {
                thumb.hidden = true;
                return;
            }

            // Each thumbnail is isolated: one bad asset cannot break the gallery.
            img.dataset.galleryFallback = "placeholder";
            img.addEventListener("error", () => {
                img.dataset.galleryFallback = "done";
                img.src = placeholder;
                thumb.classList.add("is-gallery-fallback");
            }, { once: true });

            thumb.addEventListener("click", () => {
                const source = String(img.currentSrc || img.src || "").trim();
                if (!source) return;

                mainImage.dataset.galleryFallback = "primary";
                mainImage.src = source;

                validThumbs.forEach(item => item.classList.remove("active"));
                thumb.classList.add("active");
            });

            if (index === 0) thumb.classList.add("active");
        });

        // If the static builder produced no thumbnails, retain a functional
        // one-item fallback rather than an empty gallery rail.
        if (!thumbs.length) {
            const wrapper = gallery.querySelector(".pdp-thumbnails");
            if (wrapper) {
                wrapper.innerHTML = `
                    <button class="pdp-thumb is-gallery-fallback active" type="button"
                        aria-label="View product image">
                        <img src="${placeholder}" alt="${String(product?.product_name || "Product")} image">
                    </button>
                `;
                const fallbackThumb = wrapper.querySelector(".pdp-thumb");
                fallbackThumb?.addEventListener("click", () => {
                    mainImage.dataset.galleryFallback = "done";
                    mainImage.src = primary || placeholder;
                });
            }
        }

        const thumbContainer = gallery.querySelector(".pdp-thumbnails");
        const thumbPrev = gallery.querySelector(".pdp-thumb-prev");
        const thumbNext = gallery.querySelector(".pdp-thumb-next");

        thumbPrev?.addEventListener("click", () => {
            thumbContainer?.scrollBy({ left: -260, behavior: "smooth" });
        });

        thumbNext?.addEventListener("click", () => {
            thumbContainer?.scrollBy({ left: 260, behavior: "smooth" });
        });

        const brandImage = gallery.querySelector(".pdp-brand-badge img");
        if (brandImage) {
            brandImage.addEventListener("error", () => {
                const badge = brandImage.closest(".pdp-brand-badge");
                if (badge) badge.hidden = true;
            }, { once: true });
        }

    }

    bindPdpFastInteractions(product) {
        const qtyInput=document.getElementById("pdpQty");
        const minusBtn=document.querySelector(".pdp-qty-minus");
        const plusBtn=document.querySelector(".pdp-qty-plus");
        const rfqBtn=document.querySelector(".pdp-rfq-btn");
        const removeBtn=document.querySelector(".pdp-remove-btn");
        const bindSlider = (sliderSelector, prevSelector, nextSelector) => {
            const slider = document.querySelector(sliderSelector);
            document.querySelector(prevSelector)?.addEventListener("click", () =>
                slider?.scrollBy({ left: -600, behavior: "smooth" })
            );
            document.querySelector(nextSelector)?.addEventListener("click", () =>
                slider?.scrollBy({ left: 600, behavior: "smooth" })
            );
        };
        bindSlider(".pdp-frequent-slider", ".pdp-frequent-prev", ".pdp-frequent-next");
        bindSlider(".pdp-related-slider-main", ".pdp-related-prev-btn", ".pdp-related-next-btn");
        if(!qtyInput||!rfqBtn||!removeBtn||typeof RFQ==="undefined") return;
        let inRFQ=false;
        const markChanged=()=>{if(inRFQ) rfqBtn.textContent="Update RFQ";};
        minusBtn?.addEventListener("click",()=>{qtyInput.value=Math.max(1,Number(qtyInput.value)-1);markChanged();});
        plusBtn?.addEventListener("click",()=>{qtyInput.value=Math.max(1,Number(qtyInput.value)+1);markChanged();});
        qtyInput.addEventListener("input",markChanged);
        rfqBtn.addEventListener("click",async()=>{
            const qty=Math.max(1,Number(qtyInput.value)||1);
            const ok=await RFQ.setQuantity(product.id,{partNumber:product.part_number,name:product.product_name,brand:product.brand_name},qty);
            if(!ok)return; inRFQ=true; rfqBtn.textContent="Added ✓"; removeBtn.style.display="block";
        });
        removeBtn.addEventListener("click",async()=>{
            await RFQ.remove(product.id); inRFQ=false; qtyInput.value=1; rfqBtn.textContent="Add To RFQ"; removeBtn.style.display="none";
        });
        void (async()=>{try{
            const item=(await RFQ.get()).find(entry=>entry.id===product.id);
            if(!item)return; inRFQ=true; qtyInput.value=item.qty; rfqBtn.textContent="Added ✓"; removeBtn.style.display="block";
        }catch(error){console.warn("Souviks RFQ state unavailable:",error);}})();
    }

    // ======================================================
    // PRODUCT DETAIL
    // ======================================================

async hydrateProductPage() {

    // Builder pages are fully rendered in HTML. Do not make catalogue JSON,
    // breadcrumb lookup, vehicle lookup, or related-product loading a prerequisite
    // for the first interaction.
    const staticTarget=Utils.el("#product-detail");
    const embeddedProduct=window.SOUVIKS_PRODUCT_PAGE_DATA;
    if(staticTarget?.dataset.staticRendered==="true" && embeddedProduct?.id){
        this.bindPdpFastInteractions(embeddedProduct);
        this.syncStaticProductGallery(embeddedProduct);
        setTimeout(() => this.hydrateStaticRecommendations(embeddedProduct), 0);
        setTimeout(()=>this.initReviews(embeddedProduct),0);
        return;
    }

    const slug = Utils.currentSlug();
    const product = await API.productBySlug(slug);

    if (!product) return;

    const brand = await API.brandById(product.brand_id);
    const category = await API.categoryById(product.category_id);

    const breadcrumbItems = [
        { title: "Products", url: `/${LANG}/products` }
    ];

    if (category?.name && category?.slug) {
        breadcrumbItems.push({
            title: category.name,
            url: `/${LANG}/categories/${category.slug}`
        });
    }

    if (brand?.name && brand?.slug) {
        breadcrumbItems.push({
            title: brand.name,
            url: `/${LANG}/brands/${brand.slug}`
        });
    }

    Breadcrumb.render(product.product_name, breadcrumbItems);


const brandLogo =
    brand?.logo || "";

const imageBase =
    `/assets/images/products/${encodeURIComponent(String(product.image_folder || ""))}`;

const galleryImages =
    Array.isArray(product.gallery) && product.gallery.length
    ? product.gallery.map(file => {
        const value = String(file || "").trim();
        if (!value) return "";
        if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
        return `${imageBase}/${encodeURIComponent(value)}`;
    }).filter(Boolean)
    : (product.image_url
        ? [String(product.image_url)]
        : (product.image
            ? [`${imageBase}/${encodeURIComponent(String(product.image))}`]
            : ["/assets/images/placeholder.webp"]));

this.products =
    await API.products();



    const target =
        Utils.el("#product-detail");

    if (!target) return;
const allVehicles =
    await API.vehicles();
   
const vehiclesHtml =
    (product.vehicles || [])
        .map(vehicleName => {

            const vehicle =
                allVehicles.find(
                    v => v.model === vehicleName
                );

            return `
                <div class="pdp-vehicle-card">

                    <div class="pdp-vehicle-image">

                        <img
                            src="${
                                vehicle?.image ||
                                '/assets/images/vehicle-placeholder.webp'
                            }"
                            alt="${vehicleName}"
                            loading="lazy"
                            decoding="async">

                    </div>

                    <div class="pdp-vehicle-content">

                        <h4>${vehicleName}</h4>

                    </div>

                </div>
            `;
        })
        .join("");

    const frequentlyProducts = this.frequentlyUsedWith(product, 6);
    const frequentlyIds = new Set(frequentlyProducts.map(item => item.id));
    const relatedProducts = this.related(product, 6, frequentlyIds);

    const frequentHtml = frequentlyProducts
        .map(item => this.card(item))
        .join("");

    const relatedHtml = relatedProducts
        .map(item => this.card(item))
        .join("");

const galleryHtml = `

<div class="pdp-gallery">

    ${
        brandLogo ?

        `
        <div class="pdp-brand-badge" aria-hidden="true">

            <img
                src="${brandLogo}"
                alt=""
                loading="lazy"
                decoding="async"
                width="56"
                height="56">

        </div>
        `

        :

        ""
    }

    <div class="pdp-main-image">

        <img
            id="pdpMainImage"
            src="${galleryImages[0]}"
            alt="${product.product_name}"
            draggable="false"
            ${Utils.responsiveImageAttrs(galleryImages[0], product.gallery_dimensions?.[product.gallery?.[0]], '(max-width: 768px) 92vw, 800px', 'eager')}
        >

    </div>

<div class="pdp-thumb-wrapper">

    <button
        class="pdp-thumb-prev">

        ‹

    </button>

    <div class="pdp-thumbnails">

        ${galleryImages.map(img => `

            <button class="pdp-thumb">

                <img
                    src="${img}"
                    alt="${product.product_name}"
                    draggable="false"
                    ${Utils.responsiveImageAttrs(img, product.gallery_dimensions?.[img], '96px', 'lazy')}
                >

            </button>

        `).join("")}

    </div>

    <button
        class="pdp-thumb-next">

        ›

    </button>

</div>

</div>

`;

    if (target.dataset.staticRendered !== "true") {

    target.innerHTML = `

<div class="container">

<div class="pdp-wrapper">

    <section class="pdp-hero">
${galleryHtml}

        <div class="pdp-summary">

            <div class="pdp-badges">

                <span class="pdp-stock">
                    ${product.selling_price !== null && product.selling_price !== undefined && product.selling_price !== "" || product.mrp !== null && product.mrp !== undefined && product.mrp !== "" ? "Availability subject to confirmation" : "Price &amp; availability on request"}
                </span>

                <span class="pdp-genuine">
                    Established Brand
                </span>

            </div>

            <h1 class="pdp-title">

                ${product.product_name}

            </h1>

            <div class="pdp-part">

                PART ID:
                ${product.id || ""}

            </div>

            ${this.priceHtml(product)}

          <div class="pdp-meta">

    <div class="pdp-row">
        <strong>Product ID</strong>
        <span>${product.id || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Part Number</strong>
        <span>${product.part_number || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Brand</strong>
        <span>${product.brand_name || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Category</strong>
        <span>${product.category_name || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Sub Category</strong>
        <span>${product.subcategory_name || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Applications</strong>
        <span>${(product.applications || []).join(", ")}</span>
    </div>

    <div class="pdp-row">
        <strong>Compatible Vehicles</strong>
        <span>${(product.vehicles || []).join(", ")}</span>
    </div>

</div>
<div class="pdp-actions">

    <div class="pdp-qty">

        <button
            type="button"
            class="pdp-qty-minus">

            −

        </button>

        <input
            id="pdpQty"
            type="number"
            min="1"
            value="1">

        <button
            type="button"
            class="pdp-qty-plus">

            +

        </button>

    </div>

    <button
        class="btn btn-primary pdp-rfq-btn">

        Add To RFQ

    </button>

    <button
        class="pdp-remove-btn"
        style="display:none">

        🗑

    </button>

</div>

        </div>

        <aside class="pdp-inquiry">

            <h3>Request This Part</h3>

            <form>

                <input
                    type="text"
                    placeholder="Name">

                <input
                    type="text"
                    placeholder="Phone">

                <input
                    type="text"
                    placeholder="Vehicle">

                <input
                    type="text"
                    value="${product.part_number || ""}"
                    placeholder="Part Number">

                <textarea
                    placeholder="Requirement"></textarea>

                <button
                    class="btn btn-primary">

                    Request Quote

                </button>

            </form>

        </aside>

</section>

<section class="pdp-trust">

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/genuine.svg"
            alt="Genuine Parts">

        <div>

            <strong>
                Established Brand
            </strong>

            <span>
                Catalogue-listed product
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/trusted.svg"
            alt="Trusted">

        <div>

            <strong>
                Trusted Since 1986
            </strong>

            <span>
                Serving Workshops & Fleets
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/inventory.svg"
            alt="Inventory">

        <div>

            <strong>
                Wide Range Available
            </strong>

            <span>
                5000+ Products
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/delivery.svg"
            alt="Delivery">

        <div>

            <strong>
                Pan India Delivery
            </strong>

            <span>
                Fast & Reliable
            </span>

        </div>

    </div>

</section>

<section class="pdp-section-nav">

    <a
        href="#description-section"
        class="pdp-tab-btn">

        Description

    </a>

    <a
        href="#vehicles-section"
        class="pdp-tab-btn">

        Compatible Vehicles

    </a>

    <a
        href="#related-section"
        class="pdp-tab-btn">

        Related Products

    </a>

</section>

<section
    id="description-section"
    class="pdp-section">

    <h2 class="pdp-section-title">

        Description

    </h2>

    <div class="pdp-description-grid">

        <div class="pdp-description-card">

            <h3>Description</h3>

            <p>

                ${product.description || ""}

            </p>

        </div>

        <div class="pdp-description-card">

            <h3>Applications</h3>

            <ul>

                ${(product.applications || [])
                    .map(
                        app =>
                        `<li>${app}</li>`
                    )
                    .join("")}

            </ul>

        </div>

    </div>

</section>

<section
    id="vehicles-section"
    class="pdp-section">

    <h2 class="pdp-section-title">

        Compatible Vehicles

    </h2>

    <div class="pdp-vehicle-grid">

        ${vehiclesHtml}

    </div>

</section>

<section
    id="frequently-used-section"
    class="pdp-section pdp-recommendation-section">

    <h2 class="pdp-section-title">
        Frequently used with this part
    </h2>

    <p class="pdp-section-intro">
        Products commonly used with this part across the same vehicle group.
    </p>

    <div class="pdp-related-wrapper pdp-recommendation-wrapper">
        <button class="pdp-related-prev pdp-frequent-prev" type="button" aria-label="Previous frequently used products">‹</button>
        <div class="pdp-related-slider pdp-frequent-slider">
            ${frequentHtml}
        </div>
        <button class="pdp-related-next pdp-frequent-next" type="button" aria-label="Next frequently used products">›</button>
    </div>

</section>

<section
    id="related-section"
    class="pdp-section pdp-recommendation-section">

    <h2 class="pdp-section-title">
        Related Products
    </h2>

    <p class="pdp-section-intro">
        Other products from the same category, with matching subcategory products shown first.
    </p>

    <div class="pdp-related-wrapper pdp-recommendation-wrapper">
        <button class="pdp-related-prev pdp-related-prev-btn" type="button" aria-label="Previous related products">‹</button>
        <div class="pdp-related-slider pdp-related-slider-main">
            ${relatedHtml}
        </div>
        <button class="pdp-related-next pdp-related-next-btn" type="button" aria-label="Next related products">›</button>
    </div>

</section>

</div>

</div>

`;

}

/* ==========================================
   PDP RFQ CONTROLS
========================================== */

const qtyInput =
    document.getElementById(
        "pdpQty"
    );

const minusBtn =
    document.querySelector(
        ".pdp-qty-minus"
    );

const plusBtn =
    document.querySelector(
        ".pdp-qty-plus"
    );

const rfqBtn =
    document.querySelector(
        ".pdp-rfq-btn"
    );

const removeBtn =
    document.querySelector(
        ".pdp-remove-btn"
    );


/*
----------------------------------------------------------
LOAD EXISTING RFQ ITEM
----------------------------------------------------------
*/

const rfqItems =
    await RFQ.get();

const rfqItem =
    rfqItems.find(
        item =>
            item.id === product.id
    );


let inRFQ = false;


if (
    rfqItem &&
    qtyInput &&
    rfqBtn &&
    removeBtn
) {

    inRFQ = true;

    qtyInput.value =
        rfqItem.qty;

    rfqBtn.textContent =
        "Added ✓";

    removeBtn.style.display =
        "block";

}


/*
----------------------------------------------------------
PDP QUANTITY — MINUS
----------------------------------------------------------
*/

minusBtn?.addEventListener(

    "click",

    () => {

        qtyInput.value =
            Math.max(

                1,

                Number(
                    qtyInput.value
                ) - 1

            );


        if (inRFQ) {

            rfqBtn.textContent =
                "Update RFQ";

        }

    }

);


/*
----------------------------------------------------------
PDP QUANTITY — PLUS
----------------------------------------------------------
*/

plusBtn?.addEventListener(

    "click",

    () => {

        qtyInput.value =
            Number(
                qtyInput.value
            ) + 1;


        if (inRFQ) {

            rfqBtn.textContent =
                "Update RFQ";

        }

    }

);


/*
----------------------------------------------------------
PDP QUANTITY — MANUAL INPUT
----------------------------------------------------------
*/

qtyInput?.addEventListener(

    "input",

    () => {

        if (inRFQ) {

            rfqBtn.textContent =
                "Update RFQ";

        }

    }

);


/*
----------------------------------------------------------
PDP — ADD / UPDATE RFQ
----------------------------------------------------------
*/

rfqBtn?.addEventListener(

    "click",

    async () => {

        const qty =
            Math.max(

                1,

                Number(
                    qtyInput.value
                ) || 1

            );


        const success =
            await RFQ.setQuantity(

                product.id,

                {

                    partNumber:
                        product.part_number,

                    name:
                        product.product_name,

                    brand:
                        product.brand_name

                },

                qty

            );


        if (!success) {

            return;

        }


        inRFQ = true;

        rfqBtn.textContent =
            "Added ✓";

        removeBtn.style.display =
            "block";

    }

);


/*
----------------------------------------------------------
PDP — REMOVE FROM RFQ
----------------------------------------------------------
*/

removeBtn?.addEventListener(

    "click",

    async () => {

        await RFQ.remove(
            product.id
        );


        inRFQ = false;

        qtyInput.value =
            1;

        rfqBtn.textContent =
            "Add To RFQ";

        removeBtn.style.display =
            "none";

    }

);

this.bindGallery(product);
this.initReviews(product);

const slider =
    document.querySelector(
        ".pdp-related-slider"
    );

const prev =
    document.querySelector(
        ".pdp-related-prev"
    );

const next =
    document.querySelector(
        ".pdp-related-next"
    );

if(
    slider &&
    prev &&
    next
){

    prev.addEventListener(
        "click",
        () => {

            slider.scrollBy({
                left:-600,
                behavior:"smooth"
            });

        }
    );

    next.addEventListener(
        "click",
        () => {

            slider.scrollBy({
                left:600,
                behavior:"smooth"
            });

        }
    );

}

}


    // ======================================================
    // PRODUCT REVIEWS
    // Reviews are stored in Supabase and only approved reviews
    // are publicly rendered. Submission requires a signed-in user.
    // ======================================================

    async initReviews(product) {
        const section = document.querySelector("[data-product-id]");
        if (!section || !product?.id) return;

        const list = section.querySelector("[data-review-list]");
        const summary = section.querySelector("[data-review-summary]");
        const form = section.querySelector("[data-review-form]");
        const signIn = section.querySelector("[data-review-signin]");
        const status = section.querySelector("[data-review-status]");

        const escapeHtml = value => String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const stars = rating => {
            const n = Math.max(0, Math.min(5, Number(rating) || 0));
            return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
        };

        if (typeof supabaseClient === "undefined") {
            if (list) list.innerHTML = '<div class="pdp-review-empty">Reviews are currently unavailable.</div>';
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from("product_reviews")
                .select("id, reviewer_name, rating, title, review, created_at")
                .eq("product_id", String(product.id))
                .eq("status", "approved")
                .order("created_at", { ascending: false });

            if (error) throw error;

            const reviews = Array.isArray(data) ? data : [];
            const average = reviews.length
                ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length
                : 0;

            if (summary) {
                summary.innerHTML = reviews.length
                    ? `<strong>${average.toFixed(1)} <span aria-hidden="true">★</span></strong><span>${reviews.length} review${reviews.length === 1 ? "" : "s"}</span>`
                    : `<strong>—</strong><span>No reviews yet</span>`;
            }

            if (list) {
                list.innerHTML = reviews.length
                    ? reviews.map(item => {
                        const date = item.created_at
                            ? new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : "";
                        return `<article class="pdp-review-card"><div class="pdp-review-card-top"><div><strong>${escapeHtml(item.reviewer_name || "Souviks Customer")}</strong>${date ? `<span>${escapeHtml(date)}</span>` : ""}</div><span class="pdp-review-stars" aria-label="${Number(item.rating) || 0} out of 5 stars">${stars(item.rating)}</span></div>${item.title ? `<h3>${escapeHtml(item.title)}</h3>` : ""}<p>${escapeHtml(item.review || "")}</p></article>`;
                    }).join("")
                    : '<div class="pdp-review-empty">No customer reviews yet. Be the first to share your experience.</div>';
            }
        } catch (error) {
            console.warn("Souviks reviews unavailable:", error);
            if (list) list.innerHTML = '<div class="pdp-review-empty">No customer reviews have been published yet.</div>';
        }

        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                if (form) {
                    form.hidden = false;
                    const nameInput = form.querySelector("[name='reviewer_name']");
                    if (nameInput && !nameInput.value) {
                        nameInput.value = user.user_metadata?.full_name || user.user_metadata?.name || "";
                    }
                }
                if (signIn) signIn.hidden = true;
            } else {
                if (form) form.hidden = true;
                if (signIn) {
                    signIn.hidden = false;
                    const language = window.souviks?.currentLanguage || "en";
                    const loginPath = `/${encodeURIComponent(language)}/login`;
                    signIn.innerHTML = `Please <a href="${loginPath}">sign in</a> to share your experience with this product.`;
                }
            }
        } catch (error) {
            if (form) form.hidden = true;
            if (signIn) signIn.hidden = false;
        }

        form?.addEventListener("submit", async event => {
            event.preventDefault();
            if (status) status.textContent = "";

            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                if (status) status.textContent = "Please sign in before submitting a review.";
                return;
            }

            const formData = new FormData(form);
            const rating = Number(formData.get("rating"));
            const reviewerName = String(formData.get("reviewer_name") || "").trim();
            const title = String(formData.get("title") || "").trim();
            const review = String(formData.get("review") || "").trim();

            if (!reviewerName || !title || !review || rating < 1 || rating > 5) {
                if (status) status.textContent = "Please complete all review fields and select a rating.";
                return;
            }

            const button = form.querySelector("button[type='submit']");
            if (button) {
                button.disabled = true;
                button.textContent = "Submitting…";
            }

            const { error } = await supabaseClient.from("product_reviews").insert({
                product_id: String(product.id),
                user_id: user.id,
                reviewer_name: reviewerName,
                rating,
                title,
                review,
                status: "pending"
            });

            if (button) {
                button.disabled = false;
                button.textContent = "Submit Review";
            }

            if (error) {
                console.error("Souviks review submission failed:", error);
                if (status) status.textContent = "We could not submit your review right now. Please try again.";
                return;
            }

            form.reset();
            const nameInput = form.querySelector("[name='reviewer_name']");
            if (nameInput) nameInput.value = reviewerName;
            if (status) status.textContent = "Thank you. Your review has been submitted and is awaiting moderation.";
        });
    }
}




window.Products = new ProductManager();

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

/* ===== webmcp.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
WEBMCP / BROWSER AGENT TOOLS
Version : 1.1
==========================================================
*/

(function () {

    "use strict";

    function getModelContext() {
        return navigator.modelContext || document.modelContext || null;
    }

    function jsonResponse(data) {
        return {
            content: [{
                type: "text",
                text: JSON.stringify(data)
            }]
        };
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    async function getJson(path, message) {
        const response = await fetch(path, {
            headers: { "Accept": "application/json" }
        });
        if (!response.ok) {
            throw new Error(message);
        }
        return await response.json();
    }

    async function initialiseWebMCP() {
        const modelContext = getModelContext();

        if (!modelContext || typeof modelContext.registerTool !== "function") {
            return;
        }

        const controllers = [];

        async function register(tool) {
            const controller = new AbortController();
            try {
                await modelContext.registerTool(tool, {
                    signal: controller.signal
                });
                controllers.push(controller);
            } catch (error) {
                console.warn(
                    "Souviks WebMCP tool registration failed:",
                    tool.name,
                    error
                );
            }
        }

        const handlers = {
            souviks_search: async ({ query, limit = 10 }) => {
                const index = await getJson("/assets/data/search.json", "Unable to load catalogue search index.");
                const needle = normalize(query);
                if (!needle) return jsonResponse([]);
                const results = index
                    .map((item) => {
                        const fields = [
                            normalize(item.part_number),
                            normalize(item.manufacturer_part_number),
                            normalize(Array.isArray(item.manufacturer_part_numbers) ? item.manufacturer_part_numbers.join(" ") : item.manufacturer_part_numbers),
                            normalize(Array.isArray(item.alternate_part_numbers) ? item.alternate_part_numbers.join(" ") : item.alternate_part_numbers),
                            normalize(Array.isArray(item.oem_numbers) ? item.oem_numbers.join(" ") : item.oem_numbers),
                            normalize(Array.isArray(item.cross_references) ? item.cross_references.join(" ") : item.cross_references),
                            normalize(item.title),
                            normalize(item.subtitle),
                            normalize(item.description),
                            normalize(Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords),
                            normalize(Array.isArray(item.applications) ? item.applications.join(" ") : item.applications),
                            normalize(Array.isArray(item.vehicles) ? item.vehicles.join(" ") : item.vehicles)
                        ];
                        let score = 0;
                        const part = fields[0];
                        if (part === needle) score += 1000;
                        else if (part.includes(needle)) score += 700;
                        if (fields[1].includes(needle)) score += 400;
                        if (fields[2].includes(needle)) score += 150;
                        if (fields.slice(3).some((field) => field.includes(needle))) score += 100;
                        return { item, score };
                    })
                    .filter((entry) => entry.score > 0)
                    .sort((a, b) => (b.score - a.score) || String(a.item.title || "").localeCompare(String(b.item.title || "")))
                    .slice(0, Math.min(Number(limit) || 10, 20))
                    .map((entry) => entry.item);
                return jsonResponse(results);
            },
            souviks_get_product: async ({ partNumber, id, slug }) => {
                const products = await getJson("/assets/data/products.json", "Unable to load product catalogue.");
                const targetPart = normalize(partNumber);
                const targetId = normalize(id);
                const targetSlug = normalize(slug);
                const product = products.find((item) => {
                    if (targetId && normalize(item.id) === targetId) return true;
                    if (targetSlug && normalize(item.slug) === targetSlug) return true;
                    if (targetPart) {
                        const references = [
                            item.part_number,
                            item.partNumber,
                            item.manufacturer_part_number,
                            item.manufacturerPartNumber,
                            ...(Array.isArray(item.manufacturer_part_numbers) ? item.manufacturer_part_numbers : []),
                            ...(Array.isArray(item.alternate_part_numbers) ? item.alternate_part_numbers : []),
                            ...(Array.isArray(item.oem_numbers) ? item.oem_numbers : []),
                            ...(Array.isArray(item.cross_references) ? item.cross_references : [])
                        ];
                        return references.some((value) => normalize(value) === targetPart);
                    }
                    return false;
                });
                return jsonResponse(product ? { found: true, product } : { found: false });
            },
            souviks_get_brand: async ({ id, slug, name }) => {
                const items = await getJson("/assets/data/brands.json", "Unable to load brand index.");
                const a = normalize(id), b = normalize(slug), c = normalize(name);
                const item = items.find((x) => (a && normalize(x.id) === a) || (b && normalize(x.slug) === b) || (c && normalize(x.name) === c));
                return jsonResponse(item ? { found: true, brand: item } : { found: false });
            },
            souviks_get_category: async ({ id, slug, name }) => {
                const items = await getJson("/assets/data/categories.json", "Unable to load category index.");
                const a = normalize(id), b = normalize(slug), c = normalize(name);
                const item = items.find((x) => (a && normalize(x.id) === a) || (b && normalize(x.slug) === b) || (c && normalize(x.name) === c));
                return jsonResponse(item ? { found: true, category: item } : { found: false });
            },
            souviks_get_vehicle: async ({ id, slug, model }) => {
                const items = await getJson("/assets/data/vehicles.json", "Unable to load vehicle index.");
                const a = normalize(id), b = normalize(slug), c = normalize(model);
                const item = items.find((x) => (a && normalize(x.id) === a) || (b && normalize(x.slug) === b) || (c && normalize(x.model) === c));
                return jsonResponse(item ? { found: true, vehicle: item } : { found: false });
            },
            souviks_get_catalogue: async ({ resource }) => {
                const paths = {
                    products: "/assets/data/products.json",
                    brands: "/assets/data/brands.json",
                    categories: "/assets/data/categories.json",
                    vehicles: "/assets/data/vehicles.json",
                    search: "/assets/data/search.json"
                };
                const path = paths[resource];
                if (!path) throw new Error("Unknown catalogue resource.");
                return jsonResponse(await getJson(path, "Unable to load catalogue resource."));
            },
            souviks_navigate: async ({ destination }) => {
                const language = ["en", "hi", "bn"].includes(
                    String(document.documentElement.lang || "").toLowerCase()
                )
                    ? String(document.documentElement.lang).toLowerCase()
                    : "en";
                const destinations = {
                    home: `/${language}/`,
                    products: `/${language}/products`,
                    brands: `/${language}/brands`,
                    categories: `/${language}/categories`,
                    vehicles: `/${language}/vehicles`
                };
                const path = destinations[destination];
                if (!path) throw new Error("Unknown Souviks destination.");
                window.location.assign(path);
                return jsonResponse({ navigatedTo: new URL(path, window.location.origin).href });
            }
        };

        async function loadToolManifest() {
            const manifest = await getJson("/assets/data/agent/tools.json", "Unable to load Souviks agent tool manifest.");
            return Array.isArray(manifest?.tools) ? manifest.tools : [];
        }

        const toolManifest = await loadToolManifest();

        await Promise.all(
            toolManifest.map(async (tool) => {
                const execute = handlers[tool.name];
                if (typeof execute !== "function") {
                    console.warn("Souviks WebMCP tool has no execution handler:", tool.name);
                    return;
                }
                await register({
                    name: tool.name,
                    title: tool.title,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    annotations: tool.annotations,
                    execute
                });
            })
        );

        window.souviksWebMCP = {
            controllers,
            unregister() {
                controllers.forEach((controller) => controller.abort());
                controllers.length = 0;
            }
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialiseWebMCP, { once: true });
    } else {
        initialiseWebMCP();
    }

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
            `/${encodeURIComponent(window.souviks?.currentLanguage || "en")}/login.html`;


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

/* ===== pages/products-page.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
PRODUCTS PAGE CONTROLLER
Version : 2.0

Responsibilities owned here:
- catalogue filtering / facet handshake
- catalogue search
- sorting
- pagination + page size
- catalogue counters / empty state
==========================================================
*/

let allProducts = [];
let currentSort = "featured";
let preserveInitialStaticCatalogue = false;

const FILTER_CONFIGS = [
    {
        id: "brandFilter",
        key: "brand_id",
        labelField: "brand_name",
        emptyLabel: "All Brands"
    },
    {
        id: "categoryFilter",
        key: "category_id",
        labelField: "category_name",
        emptyLabel: "All Categories"
    },
    {
        id: "subCategoryFilter",
        key: "subcategory_id",
        labelField: "subcategory_name",
        emptyLabel: "All Subcategories"
    },
    {
        id: "vehicleFilter",
        key: "vehicles",
        labelField: null,
        emptyLabel: "All Vehicles"
    }
];

const SEARCH_FIELDS = [
    "product_name",
    "name",
    "part_number",
    "partNumber",
    "brand_name",
    "brand",
    "manufacturer_part_number",
    "applications",
    "vehicles",
    "alternate_part_numbers",
    "oem_numbers",
    "cross_references"
];

document.addEventListener("DOMContentLoaded", async () => {
    const searchInput = document.getElementById("searchInput");
    const initialQuery = getSearchQuery();
    if (searchInput && initialQuery) searchInput.value = initialQuery;

    await Products.init("#product-grid", "catalogue-index");

    allProducts = [...Products.products];
    Filters.init(allProducts);
    initialiseUrlFilters();
    populateFilters(allProducts);
    initialisePagination();
    bindFilters();
    bindSearch();
    bindSort();
    bindPageSize();
    bindReset();
    bindNoResultsReset();
});

function getSearchQuery() {
    try {
        return String(new URLSearchParams(window.location.search).get("q") || "").trim();
    } catch (error) {
        return "";
    }
}

function initialiseUrlFilters() {
    let params;
    try {
        params = new URLSearchParams(window.location.search);
    } catch (error) {
        return;
    }

    FILTER_CONFIGS.forEach(config => {
        const value = String(params.get(config.key) || "").trim();
        if (value) Filters.set(config.key, value);
    });
}

function normaliseComparable(value) {
    return String(value ?? "").trim().toLocaleLowerCase();
}

function priceValue(product) {
    const candidates = [product?.selling_price, product?.mrp];
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined || String(candidate).trim() === "") continue;
        const numeric = Number(String(candidate).replace(/[₹,\s]/g, ""));
        if (Number.isFinite(numeric)) return numeric;
    }
    return null;
}

function sortCatalogue(results) {
    const value = String(currentSort || "featured");
    const sorted = [...results];

    if (value === "featured") {
        return sorted.sort((a, b) => {
            const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
            if (featuredDiff) return featuredDiff;
            return normaliseComparable(a.product_name || a.name)
                .localeCompare(normaliseComparable(b.product_name || b.name), undefined, { sensitivity: "base" });
        });
    }

    const [field, direction = "asc"] = value.split("-");
    const fieldMap = {
        name: "product_name",
        brand: "brand_name",
        part: "part_number",
        price: "_price_sort"
    };
    const key = fieldMap[field];
    if (!key) return sorted;

    const multiplier = direction === "desc" ? -1 : 1;
    return sorted.sort((a, b) => {
        if (key === "_price_sort") {
            const first = priceValue(a);
            const second = priceValue(b);
            if (first === null && second === null) return 0;
            if (first === null) return 1;
            if (second === null) return -1;
            if (first !== second) return (first < second ? -1 : 1) * multiplier;
            return normaliseComparable(a.product_name || a.name)
                .localeCompare(normaliseComparable(b.product_name || b.name), undefined, { sensitivity: "base" });
        }

        const first = normaliseComparable(a[key]);
        const second = normaliseComparable(b[key]);
        if (first === second) return 0;
        return (first < second ? -1 : 1) * multiplier;
    });
}

function fieldMatches(product, key, value) {
    if (value === null || value === undefined || value === "") return true;

    const field = product?.[key];
    if (Array.isArray(field)) {
        return field.some(item => String(item) === String(value));
    }

    return String(field ?? "") === String(value);
}

function matchesFilters(product, filters, excludeKey = null) {
    return Object.entries(filters).every(([key, value]) => {
        if (key === excludeKey) return true;
        return fieldMatches(product, key, value);
    });
}

function searchProducts(products, query) {
    const needle = String(query || "").trim();
    if (!needle) return products;

    if (
        window.SouviksSearchEngine &&
        typeof SouviksSearchEngine.filterProducts === "function"
    ) {
        return SouviksSearchEngine.filterProducts(products, needle);
    }

    const compactNeedle = needle.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
    const matchesValue = value => {
        if (Array.isArray(value)) return value.some(item => matchesValue(item));
        const text = String(value ?? "").toLocaleLowerCase();
        if (!text) return false;
        if (text.includes(needle.toLocaleLowerCase())) return true;
        const compact = text.replace(/[^a-z0-9]+/g, "");
        return Boolean(compactNeedle && compact.includes(compactNeedle));
    };

    return products.filter(product =>
        SEARCH_FIELDS.some(field => matchesValue(product?.[field]))
    );
}

/*
 * FACET HANDSHAKE
 *
 * Each dropdown calculates its options from the same product universe,
 * applying every OTHER active facet. The facet being populated is excluded
 * from its own scope so the current selection can remain visible.
 * Search is deliberately excluded from facet calculation; text search is
 * an independent operation applied after the structured filters.
 */
function getFacetScope(excludeKey) {
    const structuredScope = allProducts.filter(product =>
        matchesFilters(product, Filters.filters, excludeKey)
    );

    // Search is part of the same catalogue state. Facet options therefore
    // reflect the current query as well as every other active facet.
    return searchProducts(
        structuredScope,
        document.getElementById("searchInput")?.value || ""
    );
}

function getFacetOptions(config) {
    const scope = getFacetScope(config.key);
    const selected = Filters.filters[config.key];
    const options = new Map();

    if (config.key === "vehicles") {
        scope.forEach(product => {
            const vehicles = Array.isArray(product?.vehicles) ? product.vehicles : [];
            vehicles.forEach(vehicle => {
                const value = String(vehicle ?? "").trim();
                if (value) options.set(value, value);
            });
        });
    } else {
        scope.forEach(product => {
            const value = product?.[config.key];
            if (value === null || value === undefined || value === "") return;
            const stringValue = String(value);
            const rawLabel = product?.[config.labelField] || stringValue;
            options.set(stringValue, sentenceCase(rawLabel));
        });
    }

    // Never make an active selection disappear just because another facet
    // combination currently produces zero matches.
    if (selected !== null && selected !== undefined && selected !== "") {
        const selectedValue = String(selected);
        if (!options.has(selectedValue)) {
            const source = allProducts.find(product => fieldMatches(product, config.key, selectedValue));
            if (source) {
                const label = config.key === "vehicles"
                    ? selectedValue
                    : sentenceCase(source?.[config.labelField] || selectedValue);
                options.set(selectedValue, label);
            }
        }
    }

    return [...options.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" }));
}

function refreshFilterOptions() {
    FILTER_CONFIGS.forEach(config => {
        const select = document.getElementById(config.id);
        if (!select) return;

        const selected = Filters.filters[config.key] || "";
        const options = getFacetOptions(config);
        populateSelect(config.id, options, selected, getFacetScope(config.key));
    });
}

function applyCatalogue() {
    preserveInitialStaticCatalogue = false;

    const searchInput = document.getElementById("searchInput");
    const query = String(searchInput?.value || "").trim();

    // Keep the canonical catalogue state shareable/bookmarkable.
    try {
        const url = new URL(window.location.href);
        FILTER_CONFIGS.forEach(config => {
            const value = String(Filters.filters[config.key] || "").trim();
            if (value) url.searchParams.set(config.key, value);
            else url.searchParams.delete(config.key);
        });
        if (query) url.searchParams.set("q", query);
        else url.searchParams.delete("q");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (error) {
        // Ignore URL API failures in older/embedded environments.
    }

    refreshFilterOptions();

    let results = allProducts.filter(product => matchesFilters(product, Filters.filters));
    results = searchProducts(results, query);
    results = sortCatalogue(results);

    Products.filtered = [...results];
    window.SouviksSearchEngine?.trackSearch?.(query, results.length, "product-catalogue");
    const pageData = Pagination.update(results);
    Products.container.innerHTML = pageData.map(item => Products.card(item)).join("");
    updateCounters(results);
    updateNoResultsState(results.length === 0);
}

function initialisePagination() {
    preserveInitialStaticCatalogue = Products.container?.dataset.staticRendered === "true";

    const initialQuery = getSearchQuery();
    const initialResults = sortCatalogue(
        initialQuery
            ? searchProducts(Filters.results(), initialQuery)
            : Filters.results()
    );

    Pagination.init({
        data: initialResults,
        perPage: 20,
        container: "#pagination",
        onChange: pageData => {
            Products.container.innerHTML = pageData.map(item => Products.card(item)).join("");
            updateCounters(Pagination.data);
        }
    });

    if (!preserveInitialStaticCatalogue || initialQuery) {
        applyCatalogue();
        return;
    }

    Products.filtered = initialResults;
    Pagination.update(initialResults);
    Products.container.innerHTML = Pagination.pageData().map(item => Products.card(item)).join("");
    updateCounters(initialResults);
    preserveInitialStaticCatalogue = false;
}

function bindFilters() {
    FILTER_CONFIGS.forEach(config => {
        document.getElementById(config.id)?.addEventListener("change", event => {
            Filters.set(config.key, event.target.value);
            applyCatalogue();
        });
    });
}

function bindSearch() {
    const input = document.getElementById("searchInput");
    if (!input) return;
    const applySearch = typeof Utils !== "undefined" && typeof Utils.debounce === "function"
        ? Utils.debounce(applyCatalogue, 180)
        : applyCatalogue;
    input.addEventListener("input", applySearch);
}

function bindSort() {
    document.getElementById("sortProducts")?.addEventListener("change", event => {
        currentSort = event.target.value || "featured";
        applyCatalogue();
    });
}

function bindPageSize() {
    const select = document.getElementById("pageSize");
    if (!select) return;

    const configured = Number(select.value);
    if (Number.isFinite(configured) && configured > 0) {
        Pagination.setPerPage(configured, false);
    }

    select.addEventListener("change", event => {
        const value = Number(event.target.value);
        if (!Number.isFinite(value) || value < 1) return;
        Pagination.setPerPage(value, true);
        renderCurrentPage();
    });
}

function bindReset() {
    document.getElementById("resetCatalogueFilters")?.addEventListener("click", () => {
        Filters.clear();
        currentSort = "featured";

        document.querySelectorAll(".catalogue-filter").forEach(select => {
            if (select.id !== "sortProducts" && select.id !== "pageSize") select.value = "";
        });

        const search = document.getElementById("searchInput");
        if (search) search.value = "";

        const sort = document.getElementById("sortProducts");
        if (sort) sort.value = currentSort;

        applyCatalogue();
    });
}

function bindNoResultsReset() {
    document.getElementById("resetNoResultsFilters")?.addEventListener("click", () => {
        document.getElementById("resetCatalogueFilters")?.click();
    });
}

function renderCurrentPage() {
    const pageData = Pagination.pageData();
    Products.container.innerHTML = pageData.map(item => Products.card(item)).join("");
    updateCounters(Pagination.data);
    updateNoResultsState(Pagination.data.length === 0);
}

function sentenceCase(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text === text.toLowerCase()) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
    return text;
}

function populateFilters(products) {
    refreshFilterOptions();
}

function populateSelect(id, options, selectedValue = "", scope = allProducts) {
    const select = document.getElementById(id);
    if (!select) return;

    const first = select.options[0];
    const firstHtml = first ? first.outerHTML : '<option value="">All</option>';
    select.innerHTML = firstHtml;

    options.forEach(option => {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        element.selected = String(option.value) === String(selectedValue);
        element.disabled = !element.selected && !optionExistsInScope(id, option.value, scope);
        select.appendChild(element);
    });
}

function optionExistsInScope(id, value, scope) {
    const config = FILTER_CONFIGS.find(item => item.id === id);
    if (!config) return true;

    if (config.key === "vehicles") {
        return scope.some(product =>
            Array.isArray(product?.vehicles) &&
            product.vehicles.some(vehicle => String(vehicle) === String(value))
        );
    }

    return scope.some(product => String(product?.[config.key] ?? "") === String(value));
}

function updateCounters(results) {
    const info = Pagination.info();
    const start = results.length ? ((info.currentPage - 1) * info.perPage) + 1 : 0;
    const end = results.length ? Math.min(info.currentPage * info.perPage, results.length) : 0;
    const pageVisible = results.length ? Pagination.pageData().length : 0;

    document.getElementById("visibleProducts")?.replaceChildren(document.createTextNode(String(pageVisible)));
    document.getElementById("totalProducts")?.replaceChildren(document.createTextNode(String(results.length)));
    document.getElementById("currentResultStart")?.replaceChildren(document.createTextNode(String(start)));
    document.getElementById("currentResultEnd")?.replaceChildren(document.createTextNode(String(end)));
    document.getElementById("totalResults")?.replaceChildren(document.createTextNode(String(results.length)));
}

function updateNoResultsState(show) {
    const noResults = document.getElementById("noResults");
    const pagination = document.getElementById("pagination");
    const productGrid = document.getElementById("product-grid");

    // A zero-result state is mutually exclusive with the result grid and
    // pagination. This prevents an empty page indicator from appearing under
    // a no-results message and avoids stale static catalogue content.
    if (productGrid) {
        productGrid.setAttribute("aria-busy", "false");
        productGrid.toggleAttribute("data-no-results", show);
    }
    if (pagination) {
        pagination.hidden = show;
        pagination.setAttribute("aria-hidden", String(show));
    }
    if (!noResults) return;
    noResults.hidden = !show;
    noResults.classList.toggle("hidden", !show);
    noResults.setAttribute("aria-hidden", String(!show));

    const suggestionHost = document.getElementById("searchSuggestions");
    if (!suggestionHost) return;

    if (!show) {
        suggestionHost.hidden = true;
        suggestionHost.replaceChildren();
        return;
    }

    const query = String(document.getElementById("searchInput")?.value || "").trim();
    const suggestions = window.SouviksSearchEngine?.suggestQueries
        ? SouviksSearchEngine.suggestQueries(query, allProducts, 5)
        : [];

    suggestionHost.replaceChildren();
    if (!suggestions.length) {
        suggestionHost.hidden = true;
        return;
    }

    const label = document.createElement("span");
    label.className = "search-suggestions-label";
    label.textContent = "Try searching for:";
    suggestionHost.appendChild(label);

    suggestions.forEach(suggestion => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "search-suggestion";
        button.textContent = suggestion;
        button.addEventListener("click", () => {
            const input = document.getElementById("searchInput");
            if (input) input.value = suggestion;
            applyCatalogue();
            input?.focus();
            input?.select?.();
        });
        suggestionHost.appendChild(button);
    });
    suggestionHost.hidden = false;
}



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
