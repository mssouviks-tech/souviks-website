/* ==========================================================
   SOUVIKS — RESET PASSWORD
   ========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const form =
            document.getElementById(
                "resetPasswordForm"
            );

        if (!form) {

            return;

        }


        /*
        ----------------------------------------------------------
        ELEMENTS
        ----------------------------------------------------------
        */

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
                "resetPasswordStatus"
            );


        if (!statusElement) {

            statusElement =
                document.createElement(
                    "div"
                );

            statusElement.id =
                "resetPasswordStatus";

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
        #authTranslations element in reset-password.html.

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


            passwordInput.disabled =
                isSubmitting;

            confirmPasswordInput.disabled =
                isSubmitting;

        }


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
        ----------------------------------------------------------
        CHECK RECOVERY SESSION
        ----------------------------------------------------------
        */

        try {

            const {
                data: {
                    session
                },
                error
            } =
                await supabaseClient.auth
                    .getSession();


            if (error) {

                console.error(
                    "[Souviks Auth] Recovery session check failed:",
                    error
                );

                showStatus(
                    getAuthMessage(
                        "resetSessionError",
                        "The password reset link could not be verified. Please request a new reset link."
                    ),
                    "error"
                );

                return;

            }


            /*
            ------------------------------------------------------
            NO RECOVERY SESSION
            ------------------------------------------------------
            */

            if (!session) {

                showStatus(
                    getAuthMessage(
                        "resetSessionInvalid",
                        "This password reset link is invalid or has expired. Please request a new one."
                    ),
                    "error"
                );


                if (submitButton) {

                    submitButton.disabled =
                        true;

                }


                return;

            }

        } catch (error) {

            console.error(
                "[Souviks Auth] Unexpected recovery session error:",
                error
            );

            showStatus(
                getAuthMessage(
                    "resetSessionUnavailable",
                    "Unable to verify the password reset session."
                ),
                "error"
            );

            return;

        }


        /*
        ----------------------------------------------------------
        SUBMIT NEW PASSWORD
        ----------------------------------------------------------
        */

        form.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();


                showStatus("");


                const password =
                    passwordInput.value;

                const confirmPassword =
                    confirmPasswordInput.value;


                /*
                --------------------------------------------------
                VALIDATION
                --------------------------------------------------
                */

                if (!password) {

                    showStatus(
                        getAuthMessage(
                            "newPasswordRequired",
                            "Please enter a new password."
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
                SUBMIT
                --------------------------------------------------
                */

                setSubmitting(true);


                try {

                    const {
                        error
                    } =
                        await supabaseClient.auth
                            .updateUser({

                                password:
                                    password

                            });


                    /*
                    --------------------------------------------------
                    UPDATE ERROR
                    --------------------------------------------------
                    */

                    if (error) {

                        console.error(
                            "[Souviks Auth] Password update failed:",
                            error
                        );

                        showStatus(
                            getAuthMessage(
                                "passwordUpdateFailed",
                                "Unable to update your password. Please request a new reset link."
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

                    showStatus(
                        getAuthMessage(
                            "passwordUpdateSuccess",
                            "Your password has been updated successfully. Redirecting to login..."
                        ),
                        "success"
                    );


                    /*
                    --------------------------------------------------
                    SIGN OUT RECOVERY SESSION
                    --------------------------------------------------

                    The recovery session should not remain active
                    after the password has been changed.
                    --------------------------------------------------
                    */

                    const {
                        error: signOutError
                    } =
                        await supabaseClient.auth
                            .signOut();


                    if (signOutError) {

                        console.error(
                            "[Souviks Auth] Recovery session sign-out failed:",
                            signOutError
                        );

                    }


                    /*
                    --------------------------------------------------
                    LANGUAGE-AWARE LOGIN REDIRECT
                    --------------------------------------------------
                    */

                    const language =
                        getCurrentLanguage();


                    const loginPath =
                        `/${language}/login.html`;


                    setTimeout(
                        () => {

                            window.location.replace(
                                loginPath
                            );

                        },
                        1500
                    );

                } catch (error) {

                    console.error(
                        "[Souviks Auth] Unexpected password update error:",
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

    }
);