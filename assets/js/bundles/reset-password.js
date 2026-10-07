/* Shared core is loaded by the HTML page before this bundle. */

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


/* ===== auth/reset-password.js ===== */
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
                        `/${language}/login`;


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
