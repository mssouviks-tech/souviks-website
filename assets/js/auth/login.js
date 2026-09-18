/* ==========================================================
   SOUVIKS — LOGIN
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const form =
        document.getElementById("loginForm");

    if (!form) {

        return;

    }


    /*
    ----------------------------------------------------------
    ELEMENTS
    ----------------------------------------------------------
    */

    const emailInput =
        document.getElementById("email");

    const passwordInput =
        document.getElementById("password");

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
            "loginStatus"
        );


    if (!statusElement) {

        statusElement =
            document.createElement(
                "div"
            );

        statusElement.id =
            "loginStatus";

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

    Translation values are provided by the hidden
    #authTranslations element in login.html.

    Example:

        data-email-required="Please enter..."

    becomes:

        translationElement.dataset.emailRequired

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


        emailInput.disabled =
            isSubmitting;

        passwordInput.disabled =
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


            const email =
                emailInput.value.trim();

            const password =
                passwordInput.value;


            /*
            --------------------------------------------------
            VALIDATION
            --------------------------------------------------
            */

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
                        "passwordRequired",
                        "Please enter your password."
                    ),
                    "error"
                );

                passwordInput.focus();

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
                        .signInWithPassword({

                            email:
                                email,

                            password:
                                password

                        });


                /*
                --------------------------------------------------
                AUTH ERROR
                --------------------------------------------------
                */

                if (error) {

                    console.error(
                        "[Souviks Auth] Login failed:",
                        error
                    );


                    const errorMessage =
                        error.message
                            ? error.message
                                .toLowerCase()
                            : "";


                    let message =
                        getAuthMessage(
                            "invalidCredentials",
                            "Invalid email or password."
                        );


                    if (
                        errorMessage.includes(
                            "email not confirmed"
                        )
                    ) {

                        message =
                            getAuthMessage(
                                "emailNotConfirmed",
                                "Please verify your email address before logging in."
                            );

                    } else if (
                        errorMessage.includes(
                            "too many requests"
                        ) ||
                        errorMessage.includes(
                            "rate limit"
                        )
                    ) {

                        message =
                            getAuthMessage(
                                "tooManyAttempts",
                                "Too many login attempts. Please wait and try again."
                            );

                    } else if (
                        errorMessage.includes(
                            "network"
                        )
                    ) {

                        message =
                            getAuthMessage(
                                "networkError",
                                "Unable to connect to the authentication service. Please try again."
                            );

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
                SESSION VERIFICATION
                --------------------------------------------------
                */

                if (
                    !data.session ||
                    !data.user
                ) {

                    showStatus(
                        getAuthMessage(
                            "loginFailed",
                            "Login could not be completed. Please try again."
                        ),
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
                    "[Souviks Auth] Login successful:",
                    data.user
                );


                /*
                --------------------------------------------------
                LANGUAGE-AWARE REDIRECT
                --------------------------------------------------
                */

                const language =
                    getCurrentLanguage();


                const accountPath =
                    `/${language}/account.html`;


                window.location.replace(
                    accountPath
                );

            } catch (error) {

                console.error(
                    "[Souviks Auth] Unexpected login error:",
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