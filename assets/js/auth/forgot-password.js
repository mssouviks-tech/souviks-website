/* ==========================================================
   SOUVIKS — FORGOT PASSWORD
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const form =
        document.getElementById(
            "forgotPasswordForm"
        );

    if (!form) {

        return;

    }


    /*
    ----------------------------------------------------------
    ELEMENTS
    ----------------------------------------------------------
    */

    const emailInput =
        document.getElementById(
            "email"
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
            "forgotPasswordStatus"
        );


    if (!statusElement) {

        statusElement =
            document.createElement(
                "div"
            );

        statusElement.id =
            "forgotPasswordStatus";

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
    #authTranslations element in forgot-password.html.

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
            LANGUAGE-AWARE RESET URL
            --------------------------------------------------
            */

            const language =
                getCurrentLanguage();


            const resetPasswordUrl =
                `https://www.souviks.co.in/${language}/reset-password.html`;


            /*
            --------------------------------------------------
            SUBMIT
            --------------------------------------------------
            */

            setSubmitting(true);


            try {

                const {
                    error
                } =
                    await supabaseClient.auth
                        .resetPasswordForEmail(
                            email,
                            {

                                redirectTo:
                                    resetPasswordUrl

                            }
                        );


                /*
                --------------------------------------------------
                ERROR
                --------------------------------------------------
                */

                if (error) {

                    console.error(
                        "[Souviks Auth] Password reset request failed:",
                        error
                    );

                    showStatus(
                        getAuthMessage(
                            "resetEmailFailed",
                            "Unable to process your request. Please try again later."
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

                Keep the message generic. Do not reveal whether
                an email address is registered.
                --------------------------------------------------
                */

                showStatus(
                    getAuthMessage(
                        "resetEmailSuccess",
                        "If an account exists for this email address, a password reset email has been sent."
                    ),
                    "success"
                );


                emailInput.value =
                    "";


                setSubmitting(false);

            } catch (error) {

                console.error(
                    "[Souviks Auth] Unexpected password reset error:",
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