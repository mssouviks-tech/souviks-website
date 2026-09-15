
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
                password.length < 6
            ) {

                showStatus(
                    getAuthMessage(
                        "passwordMinLength",
                        "Password must be at least 6 characters."
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
                `https://www.souviks.co.in/${language}/login.html`;


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

                    console.error(
                        "[Souviks Auth] Registration failed:",
                        error
                    );


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

                console.log(
                    "[Souviks Auth] Registration successful:",
                    data
                );


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

                console.error(
                    "[Souviks Auth] Unexpected registration error:",
                    error
                );


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

/* ===== auth/auth-modal.js ===== */
/* ==========================================================
   SOUVIKS — AUTHENTICATION MODAL
   Global login / registration modal
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const modal = document.getElementById("authModal");

    if (!modal) return;

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

        setHidden(
            topSignIn,
            true
        );

        setHidden(
            topUserMenu,
            false
        );

        closeDropdown();

    }


    /*
    ----------------------------------------------------------
    INITIAL SESSION
    ----------------------------------------------------------
    */

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

    return `/${LANG}/products/${product.slug}.html`;

};

// ======================================================
// BRAND URL
// ======================================================

Utils.brandUrl = function(brand) {

    return `/${LANG}/brands/${brand.slug}.html`;

};

// ======================================================
// CATEGORY URL
// ======================================================

Utils.categoryUrl = function(category) {

    return `/${LANG}/categories/${category.slug}.html`;

};

// ======================================================
// VEHICLE URL
// ======================================================

Utils.vehicleUrl = function(vehicle) {

    return `/${LANG}/vehicles/${vehicle.slug}.html`;

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

    const attrs = [
        `loading=\"${loading}\"`,
        `decoding=\"async\"`
    ];

    if (Array.isArray(dimensions) && dimensions.length === 2) {
        attrs.push(`width=\"${Number(dimensions[0])}\"`);
        attrs.push(`height=\"${Number(dimensions[1])}\"`);
    }

    if (src && src.includes("/assets/images/")) {
        const lastSlash = src.lastIndexOf("/");
        const directory = src.slice(0, lastSlash);
        const filename = src.slice(lastSlash + 1);
        const dot = filename.lastIndexOf(".");
        const stem = dot > 0 ? filename.slice(0, dot) : filename;
        const candidates = [160, 320, 640, 960, 1280, 1600];
        const sourceWidth = Array.isArray(dimensions) ? Number(dimensions[0]) : 0;
        const srcset = candidates
            .filter(width => !sourceWidth || width < sourceWidth)
            .map(width => `${directory}/${stem}-${width}.webp ${width}w`)
            .join(", ");

        if (srcset) {
            attrs.push(`srcset=\"${srcset}\"`);
            attrs.push(`sizes=\"${sizes || '100vw'}\"`);
        }
    }

    return attrs.join(" ");
};



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

                `${this.basePath}/${filename}`

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
            "/en/login.html";


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

        SavedProducts.init();

    }
);


/*
==========================================================
GLOBAL API
==========================================================
*/

window.SavedProducts =
    SavedProducts;

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

    this.pageSize = 12;

}
    // ======================================================
    // INIT
    // ======================================================

    async init(

        selector = "#product-grid"

    ) {

        this.container = Utils.el(

            selector

        );

        if (!this.container) {

            return;

        }

        this.products = await API.products();

        this.filtered = [

            ...this.products

        ];

        this.render();

    }

    // ======================================================
    // PRODUCT CARD
    // ======================================================

card(product) {

    const cardImage =

        product.gallery &&
        product.gallery.length

        ?

        `/assets/images/products/${product.image_folder}/${product.gallery[0]}`

        :

        '/assets/images/placeholder.webp';


    const productId =
        String(
            product.id
        );


    const isSaved =
        typeof SavedProducts !==
        "undefined" &&

        SavedProducts.isSaved(
            productId
        );


    return `

    <article
        class="product-card">

        <a
            href="${Utils.productUrl(product)}"
            data-breadcrumb="${product.product_name}"
            data-breadcrumb-type="detail"
        >

            <div class="product-image">

                <img
                    src="${cardImage}"
                    alt="${product.product_name}"
                    ${Utils.responsiveImageAttrs(cardImage, product.gallery_dimensions?.[product.gallery?.[0]], '(max-width: 640px) 92vw, (max-width: 1024px) 31vw, 280px', 'lazy')}
                >

                <button
                    type="button"
                    class="product-save-button ${
                        isSaved
                            ? "is-saved"
                            : ""
                    }"
                    data-saved-product-id="${productId}"
                    data-saved="${
                        isSaved
                            ? "true"
                            : "false"
                    }"
                    aria-pressed="${
                        isSaved
                            ? "true"
                            : "false"
                    }"
                    aria-label="${
                        isSaved
                            ? "Remove from saved products"
                            : "Save product"
                    }">

                    <span
                        data-saved-icon
                        aria-hidden="true">

                        ${
                            isSaved
                                ? "♥"
                                : "♡"
                        }

                    </span>

                </button>

            </div>

            <div class="product-content">

                <div class="product-id">

                    ${product.id}

                </div>

                <h3 class="product-title">

                    ${product.product_name}

                </h3>

                <div class="product-brand">

                    ${product.brand_name || ''}

                </div>

            </div>

        </a>

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
    // RELATED PRODUCTS
    // ======================================================

related(product, limit = 5) {

    return this.products

        .filter(item => {

            if(item.id === product.id)
                return false;

            return true;

        })

        .map(item => {

            let score = 0;

            const currentVehicles =
                product.vehicles || [];

            const itemVehicles =
                item.vehicles || [];

const sharedVehicle =
    currentVehicles.some(
        v => itemVehicles.includes(v)
    );

if(
    item.subcategory_id ===
    product.subcategory_id
){
    score += 500;
}
else if(
    item.category_id ===
    product.category_id
){
    score += 300;
}
else if(
    sharedVehicle
){
    score += 150;
}

if(
    item.brand_id ===
    product.brand_id
){
    score += 20;
}

            return {
                item,
                score
            };

        })

        .sort(
            (a,b) =>
            b.score - a.score
        )

        .slice(0, limit)

        .map(
            result =>
            result.item
        );

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
    // PRODUCT DETAIL
    // ======================================================

async hydrateProductPage() {

    const slug = Utils.currentSlug();
    const product = await API.productBySlug(slug);

    if (!product) return;

    const brand = await API.brandById(product.brand_id);
    const category = await API.categoryById(product.category_id);

    const breadcrumbItems = [
        { title: "Products", url: `/${LANG}/products.html` }
    ];

    if (category?.name && category?.slug) {
        breadcrumbItems.push({
            title: category.name,
            url: `/${LANG}/categories/${category.slug}.html`
        });
    }

    if (brand?.name && brand?.slug) {
        breadcrumbItems.push({
            title: brand.name,
            url: `/${LANG}/brands/${brand.slug}.html`
        });
    }

    Breadcrumb.render(product.product_name, breadcrumbItems);


const brandLogo =
    brand?.logo || "";

const imageBase =
    `/assets/images/products/${product.image_folder}`;

const galleryImages =

    product.gallery && product.gallery.length

    ?

    product.gallery.map(
        file => `${imageBase}/${file}`
    )

    :

    [];

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

    const relatedHtml =
        this.related(product, 50)
        .map(item => this.card(item))
        .join("");

const galleryHtml = `

<div class="pdp-gallery">

    ${
        brandLogo ?

        `
        <div class="pdp-brand-badge">

            <img
                src="${brandLogo}"
                alt="${brand.name}"
                loading="lazy"
                decoding="async">

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

    target.innerHTML = `

<div class="container">

<div class="pdp-wrapper">

    <section class="pdp-hero">
${galleryHtml}

        <div class="pdp-summary">

            <div class="pdp-badges">

                <span class="pdp-stock">
                    In Stock
                </span>

                <span class="pdp-genuine">
                    100% Genuine
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
                100% Genuine Products
            </strong>

            <span>
                Original & Authorized
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
    id="related-section"
    class="pdp-section">

    <h2 class="pdp-section-title">

        Related Products

    </h2>

<div class="pdp-related-wrapper">

    <button
        class="pdp-related-prev">

        ‹

    </button>

    <div
        class="pdp-related-slider">

        ${relatedHtml}

    </div>

    <button
        class="pdp-related-next">

        ›

    </button>

</div>

</section>

</div>

</div>

`;

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

const mainImage =
    document.getElementById(
        "pdpMainImage"
    );

document
.querySelectorAll(
    ".pdp-thumb"
)
.forEach(thumb => {

    thumb.addEventListener(
        "click",
        () => {

            const img =
                thumb.querySelector(
                    "img"
                );

            if (
                img &&
                mainImage
            ) {

                mainImage.src =
                    img.src;

            }

        }
    );

});

const thumbContainer =
    document.querySelector(
        ".pdp-thumbnails"
    );

const thumbPrev =
    document.querySelector(
        ".pdp-thumb-prev"
    );

const thumbNext =
    document.querySelector(
        ".pdp-thumb-next"
    );

if(
    thumbContainer &&
    thumbPrev &&
    thumbNext
){

    thumbPrev.addEventListener(
        "click",
        () => {

            thumbContainer.scrollBy({

                left:-300,

                behavior:"smooth"

            });

        }
    );

    thumbNext.addEventListener(
        "click",
        () => {

            thumbContainer.scrollBy({

                left:300,

                behavior:"smooth"

            });

        }
    );

}

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

}



window.Products = new ProductManager();

/* ===== brands.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
BRANDS MODULE
Version : 2.0
==========================================================
*/

class BrandManager {

    constructor() {

        this.brands = [];

        this.filtered = [];

        this.container = null;

    }

    async init(
        selector = "#brand-grid"
    ) {

        this.container =
            Utils.el(selector);

        if (!this.container) {

            return;

        }

        this.brands =
            await API.brands();

        this.filtered =
            [...this.brands];

    }

    card(brand) {

        return `

<article class="brand-card">

    <a
        href="${Utils.brandUrl(brand)}"
        data-name="${brand.name}"
    >
                <div class="brand-image">

                    <img
                        src="${brand.logo}"
                        alt="${brand.name}"
                        ${Utils.responsiveImageAttrs(brand.logo, brand.logo_dimensions, '(max-width: 640px) 92vw, (max-width: 1024px) 31vw, 280px', 'lazy')}
                    >

                </div>

                <div class="brand-content">

                    <h3 class="brand-name">

                        ${brand.name}

                    </h3>

<div class="brand-count">

    <span class="count-number">

        ${brand.product_count || 0}

    </span>

    Products

</div>

                </div>

            </a>

        </article>

        `;

    }


// ======================================================
// BRAND DETAIL PAGE
// ======================================================

async hydrateBrandPage() {

    const slug =

        window.location.pathname
            .split("/")
            .pop()
            .replace(".html", "");

    this.brands =
        await API.brands();

    const brand =

        this.brands.find(

            item =>

                item.slug === slug

        );

    if (!brand) {

        return;

    }

Breadcrumb.visit(
    brand.name,
    window.location.pathname
);

Breadcrumb.render(
    brand.name,
    [
        {
            title: "Brands",
            url: `/${LANG}/brands.html`
        }
    ]
);

    this.renderBrandHero(
        brand
    );

    await this.renderBrandProducts(
        brand
    );

}

renderBrandHero(
    brand
) {

    const container =

        document.getElementById(
            "brand-detail"
        );

    if (!container) {

        return;

    }

    container.innerHTML = `

        <div class="brand-detail">

           <div class="brand-logo">
    <img
        src="${brand.logo}"
        alt="${brand.name}"
        loading="lazy"
        decoding="async"
    >
</div>

            <div class="brand-info">

                <h1>

                    ${brand.name}

                </h1>

                <p>

                    ${brand.product_count}

                    Products Available

                </p>

            </div>

        </div>

    `;

}

async renderBrandProducts(
    brand
) {

    const grid =

        document.getElementById(
            "product-grid"
        );

    if (!grid) {

        return;

    }

    const products =
        await API.products();

    const brandProducts =

        products.filter(

            product =>

                product.brand_id ===
                brand.id

        );

    if (

        brandProducts.length === 0

    ) {

        grid.innerHTML =

            Utils.emptyState(

                "No products found."

            );

        return;

    }

    grid.innerHTML =

        brandProducts
            .map(

                product =>

                    Products.card(
                        product
                    )

            )
            .join("");

}

}

window.Brands =
    new BrandManager();

/* ===== categories.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
CATEGORIES MODULE
Version : 1.0
==========================================================
*/

class CategoryManager {

    constructor() {

        this.categories = [];

        this.filtered = [];

        this.container = null;

    }
    // ======================================================
    // INIT
    // ======================================================

    async init(

        selector = "#category-grid"

    ) {

        this.container = Utils.el(

            selector

        );


        if (!this.container) {

            return;

        }

        this.categories =

            await API.categories();

        this.filtered = [

            ...this.categories

        ];

        this.render();

    }
    // ======================================================
    // CATEGORY CARD
    // ======================================================

    card(category) {

        return `

        <article class="category-card">

          <a
    href="${Utils.categoryUrl(category)}"
    data-breadcrumb="${category.name}"
>

                <div class="category-image">

                    <img
                        src="${category.image || '/assets/images/category-placeholder.webp'}"
                        alt="${category.name}"
                        ${Utils.responsiveImageAttrs(category.image || '/assets/images/category-placeholder.webp', category.image_dimensions, '(max-width: 640px) 92vw, (max-width: 1024px) 31vw, 280px', 'lazy')}
                    >

                </div>

                <div class="category-content">

                    <h3 class="category-title">

                        ${category.name}

                    </h3>

                    <div class="category-count">

                        ${category.product_count || 0}
                        Products

                    </div>

                </div>

            </a>

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

            this.filtered.length === 0

        ) {

            this.container.innerHTML =

                Utils.emptyState(

                    "No categories found."

                );

            return;

        }

        this.container.innerHTML =

    this.filtered

        .map(
            category =>
                this.card(
                    category
                )
        )

        .join("");

const visible =
    document.getElementById(
        "visibleCategories"
    );

if (visible) {

    visible.textContent =
        this.filtered.length;

}

    }
    // ======================================================
    // SEARCH
    // ======================================================

    search(query) {

        if (!query) {

            this.filtered = [

                ...this.categories

            ];

            this.render();

            return;

        }

        query = query.toLowerCase();

        this.filtered =

            this.categories.filter(

                category =>

                    category.name

                        .toLowerCase()

                        .includes(

                            query

                        )

            );

        this.render();

    }
    // ======================================================
    // SORT
    // ======================================================

    sortByName() {

        this.filtered.sort(

            (a, b) =>

                a.name.localeCompare(

                    b.name

                )

        );

        this.render();

    }

    sortByProducts() {

        this.filtered.sort(

            (a, b) =>

                b.product_count -

                a.product_count

        );

        this.render();

    }
    // ======================================================
    // FEATURED
    // ======================================================

    featured(

        limit = 12

    ) {

        return this.categories

            .filter(

                category =>

                    category.featured === true

            )

            .slice(

                0,

                limit

            );

    }
    // ======================================================
    // CATEGORY DETAIL
    // ======================================================

    async hydrateCategoryPage() {

        const slug =

            Utils.currentSlug();

        const category =

            await API.categoryBySlug(

                slug

            );

        if (!category) {

            return;

        }

Breadcrumb.render(
    category.name,
    [
        {
            title: "Categories",
            url: `/${LANG}/categories.html`
        }
    ]
);

        const target =

            Utils.el(

                "#category-detail"

            );

        if (!target) {

            return;

        }

        target.innerHTML = `

            <div class="category-detail">

                <div class="category-image">

                    <img
                        src="${category.image || '/assets/images/category-placeholder.webp'}"
                        alt="${category.name}"
                    >

                </div>

                <div class="category-info">

                    <h1>

                        ${category.name}

                    </h1>

                    <p>

                        ${category.description || ""}

                    </p>

                    <div>

                        Products:
                        ${category.product_count || 0}

                    </div>

                </div>

            </div>

        `;

    const products =
        await API.productsByCategory(
            category.id
        );

    const grid =
        Utils.el(
            "#product-grid"
        );

    if (
        grid &&
        products.length
    ) {

        grid.innerHTML =
            products.map(
                product =>
                    Products.card(
                        product
                    )
            ).join("");

    }

}
    // ======================================================
    // CATEGORY PRODUCTS
    // ======================================================

    async products(

        categoryId

    ) {

        return await API.productsByCategory(

            categoryId

        );

    }
    // ======================================================
    // SUBCATEGORIES
    // ======================================================

    subcategories(

        category

    ) {

        return category.subcategories || [];

    }
}

window.Categories = new CategoryManager();

/* ===== vehicles.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
VEHICLES MODULE
Version : 1.0
==========================================================
*/

class VehicleManager {

    constructor() {

        this.vehicles = [];

        this.filtered = [];

        this.container = null;

    }
    // ======================================================
    // INIT
    // ======================================================

    async init(

        selector = "#vehicle-grid"

    ) {

        this.container = Utils.el(

            selector

        );

        if (!this.container) {

            return;

        }

        this.vehicles =

            await API.vehicles();

        this.filtered = [

            ...this.vehicles

        ];

        this.render();

    }
    // ======================================================
    // VEHICLE CARD
    // ======================================================

    card(vehicle) {

        return `

        <article class="vehicle-card">

           <a
    href="${Utils.vehicleUrl(vehicle)}"
    data-breadcrumb="${vehicle.model}"
>

                <div class="vehicle-image">

                    <img
                        src="${vehicle.image || '/assets/images/vehicle-placeholder.webp'}"
                        alt="${vehicle.model}"
                        ${Utils.responsiveImageAttrs(vehicle.image || '/assets/images/vehicle-placeholder.webp', vehicle.image_dimensions, '(max-width: 640px) 92vw, (max-width: 1024px) 31vw, 280px', 'lazy')}
                    >

                </div>

                <div class="vehicle-content">

                    <h3 class="vehicle-title">

                        ${vehicle.model}

                    </h3>

                    <div class="vehicle-count">

                        ${vehicle.product_count || 0}
                        Products

                    </div>

                </div>

            </a>

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

            this.filtered.length === 0

        ) {

            this.container.innerHTML =

                Utils.emptyState(

                    "No vehicles found."

                );

            return;

        }

        this.container.innerHTML =

            this.filtered

                .map(

                    vehicle =>

                        this.card(

                            vehicle

                        )

                )

                .join("");

    }
    // ======================================================
    // SEARCH
    // ======================================================

    search(query) {

        if (!query) {

            this.filtered = [

                ...this.vehicles

            ];

            this.render();

            return;

        }

        query = query.toLowerCase();

        this.filtered =

            this.vehicles.filter(

                vehicle =>

                    vehicle.model

                        .toLowerCase()

                        .includes(

                            query

                        )

            );

        this.render();

    }
    // ======================================================
    // SORT
    // ======================================================

    sortByName() {

        this.filtered.sort(

            (a, b) =>

                a.model.localeCompare(

                    b.model

                )

        );

        this.render();

    }

    sortByProducts() {

        this.filtered.sort(

            (a, b) =>

                b.product_count -

                a.product_count

        );

        this.render();

    }
    // ======================================================
    // FEATURED
    // ======================================================

    featured(

        limit = 12

    ) {

        return this.vehicles

            .filter(

                vehicle =>

                    vehicle.featured === true

            )

            .slice(

                0,

                limit

            );

    }
    // ======================================================
    // VEHICLE DETAIL
    // ======================================================

    async hydrateVehiclePage() {

        const slug =

            Utils.currentSlug();

        const vehicle =

            await API.vehicleBySlug(

                slug

            );
Breadcrumb.visit(
    vehicle.model,
    window.location.pathname
);

Breadcrumb.render(
    vehicle.model,
    [
        {
            title: "Vehicles",
            url: `/${LANG}/vehicles.html`
        }
    ]
);
        const target =

            Utils.el(

                "#vehicle-detail"

            );

        if (!target) {

            return;

        }

        target.innerHTML = `

            <div class="vehicle-detail">

                <div class="vehicle-image">

                    <img
                        src="${vehicle.image || '/assets/images/vehicle-placeholder.webp'}"
                        alt="${vehicle.model}"
                    >

                </div>

                <div class="vehicle-info">

                    <h1>

                        ${vehicle.model}

                    </h1>

                    <p>

                        ${vehicle.description || ""}

                    </p>

                    <div>

                        Products:
                        ${vehicle.product_count || 0}

                    </div>

                </div>

            </div>

        `;

const products =
    await API.productsByVehicle(
        vehicle.model
    );

const grid =
    Utils.el(
        "#product-grid"
    );
    if (
        grid &&
        products.length
    ) {

        grid.innerHTML =
            products.map(
                product =>
                    Products.card(
                        product
                    )
            ).join("");

    }

}

// ======================================================
// VEHICLE PRODUCTS
// ======================================================

async products(

    vehicleName

) {

    return await API.productsByVehicle(

        vehicleName

    );

}

    // ======================================================
    // VEHICLE META
    // ======================================================

    meta(vehicle) {

        return {

            manufacturer:

                vehicle.manufacturer ||

                {},

            variant:

                vehicle.variant ||

                "",

            generation:

                vehicle.generation ||

                "",

            fuel_type:

                vehicle.fuel_type ||

                "",

            vehicle_type:

                vehicle.vehicle_type ||

                ""

        };

    }
}

window.Vehicles = new VehicleManager();

/* ===== search.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
SEARCH MODULE
Version : 1.0
==========================================================
*/

class SearchManager {

    constructor() {

        this.index = [];

        this.results = [];

        this.input = null;

        this.resultsContainer = null;

        this.activeIndex = -1;

    }
    // ======================================================
    // INIT
    // ======================================================

    async init(

        inputSelector = "#search-input",

        resultsSelector = "#search-results"

    ) {

        this.input = Utils.el(

            inputSelector

        );

        this.resultsContainer = Utils.el(

            resultsSelector

        );

        if (

            !this.input ||

            !this.resultsContainer

        ) {

            return;

        }

        this.index = await API.searchIndex();

        this.bindEvents();

    }
    // ======================================================
    // EVENTS
    // ======================================================

    bindEvents() {

        this.input.addEventListener(

            "input",

            Utils.debounce(

                event => {

                    this.search(

                        event.target.value

                    );

                },

                250

            )

        );

        this.input.addEventListener(

            "keydown",

            event =>

                this.handleKeyboard(

                    event

                )

        );

        document.addEventListener(

            "click",

            event => {

                if (

                    !this.resultsContainer.contains(

                        event.target

                    ) &&

                    event.target !== this.input

                ) {

                    this.clear();

                }

            }

        );

    }
    // ======================================================
    // SEARCH
    // ======================================================

    search(query) {

        query = query

            .trim()

            .toLowerCase();

        if (!query) {

            this.clear();

            return;

        }

        this.results =

            this.index

                .filter(item => {

                    const titleMatch =

                        item.title

                            ?.toLowerCase()

                            .includes(query);

                    const keywordMatch =

                        item.keywords

                            ?.join(" ")

                            .toLowerCase()

                            .includes(query);

                    const partMatch =

                        item.part_number

                            ?.toLowerCase()

                            .includes(query);

                    return (

                        titleMatch ||

                        keywordMatch ||

                        partMatch

                    );

                })

                .sort(

                    (

                        a,

                        b

                    ) =>

                        b.weight -

                        a.weight

                )

                .slice(

                    0,

                    20

                );

        this.render();

    }
    // ======================================================
    // RESULT CARD
    // ======================================================

    resultCard(item) {

        return `

        <a

            href="${item.url}"

            class="search-result"

        >

            <div class="search-type">

                ${item.type}

            </div>

            <div class="search-content">

                <div class="search-title">

                    ${item.title}

                </div>

                <div class="search-subtitle">

                    ${item.subtitle || ""}

                </div>

            </div>

        </a>

        `;

    }

    // ======================================================
    // RENDER
    // ======================================================

    render() {

        if (

            !this.results ||

            this.results.length === 0

        ) {

            this.resultsContainer.innerHTML =

                Utils.emptyState(

                    "No results found."

                );

            return;

        }

        this.resultsContainer.innerHTML =

            this.results

                .map(

                    item =>

                        this.resultCard(

                            item

                        )

                )

                .join("");

    }

    // ======================================================
    // KEYBOARD
    // ======================================================

    handleKeyboard(event) {

        const items =

            Utils.els(

                ".search-result"

            );

        if (

            items.length === 0

        ) {

            return;

        }

        if (

            event.key ===

            "ArrowDown"

        ) {

            event.preventDefault();

            this.activeIndex++;

        }

        if (

            event.key ===

            "ArrowUp"

        ) {

            event.preventDefault();

            this.activeIndex--;

        }

        if (

            this.activeIndex < 0

        ) {

            this.activeIndex = 0;

        }

        if (

            this.activeIndex >=

            items.length

        ) {

            this.activeIndex =

                items.length - 1;

        }

        items.forEach(

            item =>

                item.classList.remove(

                    "active"

                )

        );

        items[

            this.activeIndex

        ].classList.add(

            "active"

        );

        if (

            event.key ===

            "Enter"

        ) {

            items[

                this.activeIndex

            ].click();

        }

    }

    // ======================================================
    // CLEAR
    // ======================================================

    clear() {

        this.results = [];

        this.activeIndex = -1;

        if (

            this.resultsContainer

        ) {

            this.resultsContainer.innerHTML = "";

        }

    }

}

const Search = new SearchManager();

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
Version : 1.0
==========================================================
*/

class PaginationManager {

    constructor() {

        this.data = [];

        this.currentPage = 1;

        this.perPage = 12;

        this.totalPages = 0;

        this.container = null;

        this.onChange = null;

    }
    // ======================================================
    // INIT
    // ======================================================

    init({

        data = [],

        perPage = 12,

        container = "#pagination",

        onChange = null

    } = {}) {

        this.data = [...data];

        this.perPage = perPage;

        this.currentPage = 1;

        this.container = Utils.el(

            container

        );

        this.onChange = onChange;

        this.calculate();

        this.render();

        return this.pageData();

    }
    // ======================================================
    // CALCULATE
    // ======================================================

    calculate() {

        this.totalPages = Math.max(

            1,

            Math.ceil(

                this.data.length /

                this.perPage

            )

        );

    }
    // ======================================================
    // PAGE DATA
    // ======================================================

    pageData() {

        const start =

            (this.currentPage - 1)

            * this.perPage;

        const end =

            start +

            this.perPage;

        return this.data.slice(

            start,

            end

        );

    }
    // ======================================================
    // UPDATE DATA
    // ======================================================

    update(data = []) {

        this.data = [...data];

        this.currentPage = 1;

        this.calculate();

        this.render();

        return this.pageData();

    }
    // ======================================================
    // PREVIOUS
    // ======================================================

    previous() {

        if (

            this.currentPage <= 1

        ) {

            return;

        }

        this.currentPage--;

        this.refresh();

    }

    // ======================================================
    // NEXT
    // ======================================================

    next() {

        if (

            this.currentPage >=

            this.totalPages

        ) {

            return;

        }

        this.currentPage++;

        this.refresh();

    }
    // ======================================================
    // GOTO
    // ======================================================

    go(page) {

        page = Number(page);

        if (

            page < 1 ||

            page > this.totalPages

        ) {

            return;

        }

        this.currentPage = page;

        this.refresh();

    }
    // ======================================================
    // REFRESH
    // ======================================================

    refresh() {

        this.render();

        if (

            typeof this.onChange ===

            "function"

        ) {

            this.onChange(

                this.pageData()

            );

        }

    }
    // ======================================================
    // RENDER
    // ======================================================

render() {

    if (!this.container) return;

    const info = this.info();

    this.container.innerHTML = `

        <button
            class="pagination-prev"
            data-page="prev"
            ${info.currentPage === 1 ? "disabled" : ""}
        >
            Previous
        </button>

        <span class="pagination-status">

            Page ${info.currentPage}
            of
            ${info.totalPages}

        </span>

        <button
            class="pagination-next"
            data-page="next"
            ${info.currentPage === info.totalPages ? "disabled" : ""}
        >
            Next
        </button>

    `;

    this.bind();

}
    // ======================================================
    // EVENTS
    // ======================================================

    bind() {

        Utils.els(

            "[data-page]"

        ).forEach(

            button => {

                button.onclick = () => {

                    const value =

                        button.dataset.page;

                    if (

                        value === "prev"

                    ) {

                        this.previous();

                        return;

                    }

                    if (

                        value === "next"

                    ) {

                        this.next();

                        return;

                    }

                    this.go(

                        value

                    );

                };

            }

        );

    }
    // ======================================================
    // INFO
    // ======================================================

    info() {

        return {

            currentPage:

                this.currentPage,

            totalPages:

                this.totalPages,

            perPage:

                this.perPage,

            totalRecords:

                this.data.length

        };

    }
}

const Pagination = new PaginationManager();

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

    reset() {},
    start() {},
    visit() {},
    replace() {},
    current() { return []; },

    render(currentPage, items = []) {
        const list = document.getElementById("breadcrumb-list");
        if (!list) return;

        const path = [{ title: "Home", url: this.homeUrl() }];
        for (const item of (Array.isArray(items) ? items : [])) {
            if (!item?.title || !item?.url) continue;
            if (item.title === "Home" || item.url === path[0].url) continue;
            path.push({ title: item.title, url: item.url });
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
    "#language-menu a"
).forEach(
    link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const language =
                    event.currentTarget.dataset.language;

                const supported = [
                    "en",
                    "bn",
                    "hi"
                ];

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

        menu.classList.toggle(
            "open"
        );

        toggle.querySelector(
            ".language-arrow"
        ).textContent =
            menu.classList.contains(
                "open"
            )
            ? "▲"
            : "▼";

    }
);

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

/* ===== main.js ===== */
document.addEventListener(
    "DOMContentLoaded",
    () => {

        const button =
            document.getElementById(
                "mobileMenuButton"
            );

        const navigation =
            document.getElementById(
                "mobileNavigation"
            );

        if (
            !button ||
            !navigation
        ) {
            return;
        }

        button.setAttribute(
            "aria-expanded",
            "false"
        );

        button.addEventListener(
            "click",
            () => {

                const isOpen =
                    navigation.classList.toggle(
                        "active"
                    );

                button.setAttribute(
                    "aria-expanded",
                    isOpen
                );

            }
        );

    }
);
