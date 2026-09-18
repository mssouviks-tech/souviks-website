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