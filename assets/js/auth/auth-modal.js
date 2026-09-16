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
