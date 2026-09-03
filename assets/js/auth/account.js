/*
==========================================================
SOUVIKS — ACCOUNT
==========================================================

Responsibilities:

    • Authentication guard
    • Load authenticated user
    • Load profile
    • Display profile
    • Edit profile
    • Business-account handling
    • Account section navigation
    • Embedded RFQ section
    • Privacy section
    • Logout remains handled by logout.js

Dependencies:

    • supabaseClient
    • RFQ
    • RFQSubmission
==========================================================
*/


document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
        ======================================================
        SUPABASE CHECK
        ======================================================
        */

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            console.error(
                "[Souviks Account] Supabase client unavailable."
            );

            return;

        }


        initializeAccount();

    }
);


/*
==========================================================
ACCOUNT STATE
==========================================================
*/

const AccountState = {

    user: null,

    profile: null,

    currentView: "account",

    editing: false,

    rfqSubmitting: false

};


/*
==========================================================
INITIALIZE ACCOUNT
==========================================================
*/

async function initializeAccount() {

    try {

        /*
        ------------------------------------------------------
        AUTHENTICATION
        ------------------------------------------------------
        */

        const {
            data,
            error
        } =
            await supabaseClient.auth.getUser();


        if (error) {

            throw error;

        }


        const user =
            data?.user;


        /*
        ------------------------------------------------------
        NOT AUTHENTICATED
        ------------------------------------------------------
        */

        if (!user) {

            redirectToLogin();

            return;

        }


        AccountState.user =
            user;


        /*
        ------------------------------------------------------
        LOAD PROFILE
        ------------------------------------------------------
        */

        await loadProfile();


        /*
        ------------------------------------------------------
        DISPLAY ACCOUNT
        ------------------------------------------------------
        */

        renderProfile();

        renderEditForm();

        renderPrivacy();


        /*
        ------------------------------------------------------
        ACCOUNT NAVIGATION
        ------------------------------------------------------
        */

        initializeNavigation();


        /*
        ------------------------------------------------------
        PROFILE EDITING
        ------------------------------------------------------
        */

        initializeProfileEditing();


        /*
        ------------------------------------------------------
        RFQ
        ------------------------------------------------------
        */

        initializeAccountRFQ();


        /*
        ------------------------------------------------------
        INITIAL VIEW
        ------------------------------------------------------
        */

        const requestedView =
            getRequestedView();


        showAccountView(
            requestedView
        );


        /*
        ------------------------------------------------------
        AUTHENTICATED
        ------------------------------------------------------
        */

        document.body.classList.remove(
            "account-auth-pending"
        );

        document.body.classList.add(
            "account-authenticated"
        );


    } catch (error) {

        console.error(
            "[Souviks Account] Initialization failed:",
            error
        );


        showAccountStatus(
            getTranslation(
                "accountSessionExpired",
                "Your session has expired. Please sign in again."
            ),
            "error"
        );


        /*
        ------------------------------------------------------
        If authentication itself failed, return to login.
        ------------------------------------------------------
        */

        if (
            error?.message?.toLowerCase()
                .includes("auth")
        ) {

            redirectToLogin();

        }

    }

}


/*
==========================================================
LOAD PROFILE
==========================================================
*/

async function loadProfile() {

    if (
        !AccountState.user
    ) {

        throw new Error(
            "Authenticated user is unavailable."
        );

    }


    const {
        data,
        error
    } =
        await supabaseClient

            .from(
                "profiles"
            )

            .select(
                `
                id,
                full_name,
                phone,
                company,
                is_business,
                gst_number
                `
            )

            .eq(
                "id",
                AccountState.user.id
            )

            .maybeSingle();


    if (error) {

        throw error;

    }


    /*
    ------------------------------------------------------
    PROFILE DOES NOT EXIST
    ------------------------------------------------------
    */

    if (!data) {

        /*
        --------------------------------------------------
        Create an empty profile for the authenticated user.
        --------------------------------------------------
        */

        const {
            data: createdProfile,
            error: createError
        } =
            await supabaseClient

                .from(
                    "profiles"
                )

                .insert({

                    id:
                        AccountState.user.id,

                    full_name:
                        "",

                    phone:
                        "",

                    company:
                        "",

                    is_business:
                        false,

                    gst_number:
                        null

                })

                .select(
                    `
                    id,
                    full_name,
                    phone,
                    company,
                    is_business,
                    gst_number
                    `
                )

                .single();


        if (createError) {

            throw createError;

        }


        AccountState.profile =
            createdProfile;

        return;

    }


    AccountState.profile =
        data;

}


/*
==========================================================
GET REQUESTED ACCOUNT VIEW
==========================================================
*/

function getRequestedView() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const requested =
        (
            params.get(
                "view"
            ) ||
            ""
        )
            .trim()
            .toLowerCase();


    const allowedViews = [
        "account",
        "rfq",
        "privacy",
        "inquiries"
    ];


    if (
        allowedViews.includes(
            requested
        )
    ) {

        return requested;

    }


    return "account";

}


/*
==========================================================
ACCOUNT NAVIGATION
==========================================================
*/

function initializeNavigation() {

    const links =
        document.querySelectorAll(
            ".account-navigation-link[data-account-view]"
        );


    /*
    ------------------------------------------------------
    We support either:

        data-account-view="rfq"

    or ordinary navigation links containing:

        ?view=rfq
    ------------------------------------------------------
    */

    links.forEach(
        link => {

            link.addEventListener(
                "click",
                event => {

                    const view =
                        link.dataset.accountView;


                    if (!view) {

                        return;

                    }


                    event.preventDefault();


                    showAccountView(
                        view
                    );


                    updateUrl(
                        view
                    );

                }
            );

        }
    );


    /*
    ------------------------------------------------------
    Fallback for navigation links that use hrefs.
    ------------------------------------------------------
    */

    document.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest(
                    ".account-navigation-link"
                );


            if (!link) {

                return;

            }


            if (
                link.classList.contains(
                    "is-disabled"
                )
            ) {

                event.preventDefault();

            }

        }
    );

}


/*
==========================================================
SHOW ACCOUNT VIEW
==========================================================
*/

function showAccountView(
    view
) {

    const allowedViews = [
        "account",
        "rfq",
        "inquiries",
        "privacy",
        "saved"
    ];


    if (
        !allowedViews.includes(
            view
        )
    ) {

        view =
            "account";

    }


    AccountState.currentView =
        view;


    /*
    ------------------------------------------------------
    HIDE / SHOW CONTENT VIEWS ONLY
    ------------------------------------------------------
    */

    const views =
        document.querySelectorAll(
            ".account-view[data-account-view]"
        );


    views.forEach(
        element => {

            const isCurrent =
                element.dataset.accountView ===
                view;


            element.hidden =
                !isCurrent;

        }
    );


    /*
    ------------------------------------------------------
    ACTIVE NAVIGATION
    ------------------------------------------------------
    */

    updateNavigationState(
        view
    );


    /*
    ------------------------------------------------------
    RFQ
    ------------------------------------------------------
    */

    if (
        view ===
        "rfq"
    ) {

        refreshAccountRFQ();

    }


    /*
    ------------------------------------------------------
    MY INQUIRIES
    ------------------------------------------------------
    */

    if (
        view ===
        "inquiries"
    ) {

        if (
            typeof refreshAccountInquiries ===
            "function"
        ) {

            refreshAccountInquiries();

        } else {

            console.error(
                "[Souviks Account] refreshAccountInquiries() is unavailable."
            );

        }

    }

}
/*
------------------------------------------------------
MY SAVED
------------------------------------------------------
*/

if (
    view ===
    "saved"
) {

    if (
        typeof refreshAccountSaved ===
        "function"
    ) {

        refreshAccountSaved();

    } else {

        console.error(
            "[Souviks Account] refreshAccountSaved() is unavailable."
        );

    }

}

/*
==========================================================
UPDATE NAVIGATION STATE
==========================================================
*/

function updateNavigationState(
    view
) {

    const links =
        document.querySelectorAll(
            ".account-navigation-link"
        );


    links.forEach(
        link => {

            const href =
                link.getAttribute(
                    "href"
                ) || "";


            const isCurrent =
                href.includes(
                    `view=${view}`
                ) ||
                (
                    view ===
                    "account" &&
                    href.endsWith(
                        "/account.html"
                    )
                );


            link.classList.toggle(
                "is-active",
                isCurrent
            );


            if (isCurrent) {

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.removeAttribute(
                    "aria-current"
                );

            }

        }
    );

}


/*
==========================================================
UPDATE URL
==========================================================
*/

function updateUrl(
    view
) {

    const url =
        new URL(
            window.location.href
        );


    if (
        view ===
        "account"
    ) {

        url.searchParams.delete(
            "view"
        );

    } else {

        url.searchParams.set(
            "view",
            view
        );

    }


    window.history.pushState(
        {
            accountView:
                view
        },
        "",
        url
    );

}


/*
==========================================================
PROFILE DISPLAY
==========================================================
*/

function renderProfile() {

    const profile =
        AccountState.profile;


    if (!profile) {

        return;

    }


    setText(
        "accountFullName",
        profile.full_name
    );


    setText(
        "accountEmail",
        AccountState.user?.email
    );


    setText(
        "accountPhone",
        profile.phone
    );


    setText(
        "accountCompany",
        profile.company
    );


    setText(
        "accountBusiness",
        profile.is_business
            ? getTranslation(
                "accountBusinessYes",
                "Yes"
            )
            : getTranslation(
                "accountBusinessNo",
                "No"
            )
    );


    const gstDetail =
        document.getElementById(
            "accountGstDetail"
        );


    setText(
        "accountGst",
        profile.gst_number
    );


    if (gstDetail) {

        gstDetail.hidden =
            !profile.is_business;

    }

}


/*
==========================================================
EDIT FORM
==========================================================
*/

function renderEditForm() {

    const profile =
        AccountState.profile;


    if (!profile) {

        return;

    }


    setInputValue(
        "account-full-name",
        profile.full_name
    );


    setInputValue(
        "account-email-input",
        AccountState.user?.email
    );


    setInputValue(
        "account-phone-input",
        profile.phone
    );


    setInputValue(
        "account-company-input",
        profile.company
    );


    setInputValue(
        "account-gst-input",
        profile.gst_number
    );


    const businessCheckbox =
        document.getElementById(
            "account-is-business"
        );


    if (businessCheckbox) {

        businessCheckbox.checked =
            Boolean(
                profile.is_business
            );

    }


    updateBusinessFields();

}


/*
==========================================================
PROFILE EDITING
==========================================================
*/

function initializeProfileEditing() {

    const editButton =
        document.getElementById(
            "editAccountProfile"
        );


    const cancelButton =
        document.getElementById(
            "cancelAccountEdit"
        );


    const form =
        document.getElementById(
            "account-profile-form"
        );


    const businessCheckbox =
        document.getElementById(
            "account-is-business"
        );


    if (editButton) {

        editButton.addEventListener(
            "click",
            () => {

                showEditSection();

            }
        );

    }


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            () => {

                hideEditSection();

            }
        );

    }


    if (businessCheckbox) {

        businessCheckbox.addEventListener(
            "change",
            () => {

                updateBusinessFields();

            }
        );

    }


    if (form) {

        form.addEventListener(
            "submit",
            handleProfileSubmit
        );

    }

}


/*
==========================================================
SHOW EDIT SECTION
==========================================================
*/

function showEditSection() {

    const editSection =
        document.getElementById(
            "accountEditSection"
        );


    if (!editSection) {

        return;

    }


    editSection.hidden =
        false;


    AccountState.editing =
        true;


    editSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/*
==========================================================
HIDE EDIT SECTION
==========================================================
*/

function hideEditSection() {

    const editSection =
        document.getElementById(
            "accountEditSection"
        );


    if (!editSection) {

        return;

    }


    editSection.hidden =
        true;


    AccountState.editing =
        false;


    renderEditForm();

    showAccountStatus(
        ""
    );

}


/*
==========================================================
BUSINESS FIELDS
==========================================================
*/

function updateBusinessFields() {

    const checkbox =
        document.getElementById(
            "account-is-business"
        );


    const fields =
        document.getElementById(
            "account-business-fields"
        );


    const companyInput =
        document.getElementById(
            "account-company-input"
        );


    const gstInput =
        document.getElementById(
            "account-gst-input"
        );


    if (
        !checkbox ||
        !fields
    ) {

        return;

    }


    const isBusiness =
        checkbox.checked;


    fields.hidden =
        !isBusiness;


    if (companyInput) {

        companyInput.required =
            isBusiness;

    }


    if (gstInput) {

        gstInput.required =
            isBusiness;

    }


    if (!isBusiness) {

        if (companyInput) {

            companyInput.value =
                "";

        }


        if (gstInput) {

            gstInput.value =
                "";

        }

    }

}


/*
==========================================================
PROFILE SUBMISSION
==========================================================
*/

async function handleProfileSubmit(
    event
) {

    event.preventDefault();


    const form =
        event.currentTarget;


    const saveButton =
        document.getElementById(
            "saveAccountProfile"
        );


    const fullNameInput =
        document.getElementById(
            "account-full-name"
        );


    const phoneInput =
        document.getElementById(
            "account-phone-input"
        );


    const companyInput =
        document.getElementById(
            "account-company-input"
        );


    const gstInput =
        document.getElementById(
            "account-gst-input"
        );


    const businessCheckbox =
        document.getElementById(
            "account-is-business"
        );


    const fullName =
        fullNameInput?.value
            .trim() ||
        "";


    const phone =
        phoneInput?.value
            .trim() ||
        "";


    const company =
        companyInput?.value
            .trim() ||
        "";


    const gstNumber =
        gstInput?.value
            .trim()
            .toUpperCase() ||
        "";


    const isBusiness =
        Boolean(
            businessCheckbox?.checked
        );


    /*
    ------------------------------------------------------
    VALIDATION
    ------------------------------------------------------
    */

    if (!fullName) {

        showProfileStatus(
            getTranslation(
                "accountNameRequired",
                "Please enter your full name."
            ),
            "error"
        );

        fullNameInput?.focus();

        return;

    }


    if (
        isBusiness &&
        !company
    ) {

        showProfileStatus(
            getTranslation(
                "accountCompanyRequired",
                "Please enter your company name."
            ),
            "error"
        );

        companyInput?.focus();

        return;

    }


    if (
        isBusiness &&
        !gstNumber
    ) {

        showProfileStatus(
            getTranslation(
                "accountGstRequired",
                "Please enter your GST number."
            ),
            "error"
        );

        gstInput?.focus();

        return;

    }


    if (
        isBusiness &&
        !isValidGSTIN(
            gstNumber
        )
    ) {

        showProfileStatus(
            getTranslation(
                "accountGstInvalid",
                "Please enter a valid GST number."
            ),
            "error"
        );

        gstInput?.focus();

        return;

    }


    /*
    ------------------------------------------------------
    SUBMITTING
    ------------------------------------------------------
    */

    setProfileSaving(
        true
    );


    showProfileStatus(
        getTranslation(
            "accountSaving",
            "Saving..."
        )
    );


    try {

        const {
            error
        } =
            await supabaseClient

                .from(
                    "profiles"
                )

                .update({

                    full_name:
                        fullName,

                    phone:
                        phone,

                    company:
                        isBusiness
                            ? company
                            : null,

                    is_business:
                        isBusiness,

                    gst_number:
                        isBusiness
                            ? gstNumber
                            : null,

                    updated_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "id",
                    AccountState.user.id
                );


        if (error) {

            throw error;

        }


        /*
        --------------------------------------------------
        RELOAD PROFILE
        --------------------------------------------------
        */

        await loadProfile();


        renderProfile();

        renderEditForm();

        renderPrivacy();

        hideEditSection();


        showProfileStatus(
            getTranslation(
                "accountSaved",
                "Your profile has been updated."
            ),
            "success"
        );


    } catch (error) {

        console.error(
            "[Souviks Account] Profile update failed:",
            error
        );


        showProfileStatus(
            getTranslation(
                "accountSaveError",
                "Unable to save your profile. Please try again."
            ),
            "error"
        );


    } finally {

        setProfileSaving(
            false
        );

    }

}


/*
==========================================================
GSTIN FORMAT VALIDATION
==========================================================

This validates the structure only.

It does NOT verify that the GSTIN exists.

GST verification was deliberately deferred.
==========================================================
*/

function isValidGSTIN(
    value
) {

    const gstin =
        String(
            value || ""
        )
            .trim()
            .toUpperCase();


    /*
    ------------------------------------------------------
    Standard GSTIN structural pattern
    ------------------------------------------------------
    */

    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
        .test(
            gstin
        );

}


/*
==========================================================
PROFILE SAVING STATE
==========================================================
*/

function setProfileSaving(
    saving
) {

    const form =
        document.getElementById(
            "account-profile-form"
        );


    if (!form) {

        return;

    }


    const controls =
        form.querySelectorAll(
            "input, button, textarea, select"
        );


    controls.forEach(
        control => {

            /*
            --------------------------------------------------
            Email is always readonly anyway.
            --------------------------------------------------
            */

            control.disabled =
                saving;

        }
    );


    const saveButton =
        document.getElementById(
            "saveAccountProfile"
        );


    if (saveButton) {

        saveButton.disabled =
            saving;

    }

}


/*
==========================================================
PRIVACY
==========================================================
*/

function renderPrivacy() {

    const email =
        AccountState.user?.email ||
        "";


    setText(
        "privacyEmail",
        email
    );

}


/*
==========================================================
ACCOUNT RFQ
==========================================================
*/

function initializeAccountRFQ() {

    const submitButton =
        document.getElementById(
            "accountRfqSubmit"
        );


    if (submitButton) {

        submitButton.addEventListener(
            "click",
            handleAccountRFQSubmit
        );

    }


    /*
    ------------------------------------------------------
    Initial basket render
    ------------------------------------------------------
    */

    refreshAccountRFQ();

}


/*
==========================================================
REFRESH ACCOUNT RFQ
==========================================================
*/

async function refreshAccountRFQ() {

    /*
    ------------------------------------------------------
    PROFILE DATA
    ------------------------------------------------------
    */

    populateAccountRFQCustomer();


    /*
    ------------------------------------------------------
    RFQ BASKET
    ------------------------------------------------------
    */

    if (
        typeof RFQ ===
        "undefined"
    ) {

        console.error(
            "[Souviks Account] RFQ engine unavailable."
        );

        return;

    }


    try {

        await RFQ.updateBadge();

        await RFQ.renderPage();

    } catch (error) {

        console.error(
            "[Souviks Account] RFQ render failed:",
            error
        );

    }

}


/*
==========================================================
ACCOUNT RFQ CUSTOMER INFORMATION
==========================================================
*/

function populateAccountRFQCustomer() {

    const profile =
        AccountState.profile;


    const user =
        AccountState.user;


    if (!profile) {

        return;

    }


    setText(
        "accountRfqName",
        profile.full_name
    );


    setText(
        "accountRfqEmail",
        user?.email
    );


    setText(
        "accountRfqPhone",
        profile.phone
    );


    setText(
        "accountRfqCompany",
        profile.company
    );


    const gstDetail =
        document.getElementById(
            "accountRfqGstDetail"
        );


    setText(
        "accountRfqGst",
        profile.gst_number
    );


    if (gstDetail) {

        gstDetail.hidden =
            !profile.is_business;

    }

}


/*
==========================================================
ACCOUNT RFQ SUBMISSION
==========================================================
*/

async function handleAccountRFQSubmit() {

    if (
        AccountState.rfqSubmitting
    ) {

        return;

    }


    const status =
        document.getElementById(
            "accountRfqStatus"
        );


    const submitButton =
        document.getElementById(
            "accountRfqSubmit"
        );


    /*
    ------------------------------------------------------
    CHECK SUBMISSION MODULE
    ------------------------------------------------------
    */

    if (
        typeof RFQSubmission ===
        "undefined"
    ) {

        console.error(
            "[Souviks Account] RFQSubmission unavailable."
        );


        showRFQStatus(
            "RFQ submission service is unavailable. Please try again later.",
            "error"
        );


        return;

    }


    /*
    ------------------------------------------------------
    MESSAGE
    ------------------------------------------------------
    */

    const messageInput =
        document.getElementById(
            "accountRfqMessage"
        );


    const message =
        messageInput?.value
            .trim() ||
        "";


    /*
    ------------------------------------------------------
    BASKET CHECK
    ------------------------------------------------------
    */

    try {

        const items =
            await RFQ.get();


        if (
            !Array.isArray(
                items
            ) ||
            !items.length
        ) {

            showRFQStatus(
                getTranslation(
                    "rfqEmpty",
                    "Please add at least one item to your RFQ."
                ),
                "error"
            );


            return;

        }


    } catch (error) {

        console.error(
            "[Souviks Account] Unable to read RFQ basket:",
            error
        );


        showRFQStatus(
            "Unable to read your RFQ basket. Please try again.",
            "error"
        );


        return;

    }


    /*
    ------------------------------------------------------
    START SUBMISSION
    ------------------------------------------------------
    */

    AccountState.rfqSubmitting =
        true;


    if (submitButton) {

        submitButton.disabled =
            true;

    }


    showRFQStatus(
        getTranslation(
            "accountSaving",
            "Submitting..."
        )
    );


    try {

        const result =
            await RFQSubmission.submit({

                message

            });


        /*
        --------------------------------------------------
        SUCCESS
        --------------------------------------------------
        */

        showRFQSuccess(
            result
        );


        if (messageInput) {

            messageInput.value =
                "";

        }


        /*
        --------------------------------------------------
        Refresh basket.
        --------------------------------------------------
        */

        await refreshAccountRFQ();


    } catch (error) {

        console.error(
            "[Souviks Account] RFQ submission failed:",
            error
        );


        showRFQStatus(
            error?.message ||
            "Unable to submit RFQ. Please try again.",
            "error"
        );


    } finally {

        AccountState.rfqSubmitting =
            false;


        if (submitButton) {

            submitButton.disabled =
                false;

        }

    }

}


/*
==========================================================
RFQ SUCCESS
==========================================================
*/

function showRFQSuccess(
    result
) {

    const reference =
        result?.reference ||
        "";


    const submitButton =
        document.getElementById(
            "accountRfqSubmit"
        );


    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.textContent =
            getTranslation(
                "rfqSubmitted",
                "RFQ Submitted"
            );

    }


    if (!reference) {

        showRFQStatus(
            getTranslation(
                "rfqSubmittedSuccessfully",
                "Your quotation request has been submitted successfully.",
            ),
            "success"
        );


        return;

    }


    showRFQStatus(

        `${getTranslation(
            "rfqSubmittedSuccessfully",
            "Your quotation request has been submitted successfully."
        )} ${getTranslation(
            "rfqReference",
            "Reference:"
        )} ${reference}`,

        "success"

    );

}


/*
==========================================================
STATUS HELPERS
==========================================================
*/

function showProfileStatus(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "accountProfileStatus"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message || "";


    element.className =
        "form-status";


    if (type) {

        element.classList.add(
            type
        );

    }


    element.hidden =
        !message;

}


function showAccountStatus(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "accountStatus"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message || "";


    element.className =
        "form-status";


    if (type) {

        element.classList.add(
            type
        );

    }


    element.hidden =
        !message;

}


function showRFQStatus(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "accountRfqStatus"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message || "";


    element.className =
        "form-status";


    if (type) {

        element.classList.add(
            type
        );

    }


    element.hidden =
        !message;

}


/*
==========================================================
GENERIC TEXT HELPER
==========================================================
*/

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;

    }


    const text =
        (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        )

            ? "—"

            : String(
                value
            );


    element.textContent =
        text;

}


/*
==========================================================
GENERIC INPUT HELPER
==========================================================
*/

function setInputValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;

    }


    element.value =
        value || "";

}


/*
==========================================================
TRANSLATION HELPER
==========================================================
*/

function getTranslation(
    key,
    fallback
) {

    const html =
        document.documentElement;


    /*
    ------------------------------------------------------
    The builder can expose translated values through
    data attributes if present.
    ------------------------------------------------------
    */

    const datasetKey =
        key
            .replace(
                /[A-Z]/g,
                letter =>
                    `-${letter.toLowerCase()}`
            );


    const value =
        html.dataset[
            datasetKey
        ];


    return (
        value ||
        fallback
    );

}


/*
==========================================================
LOGIN REDIRECT
==========================================================
*/

function redirectToLogin() {

    const language =
        document.documentElement
            .lang
            ?.trim()
            .toLowerCase() ||
        "en";


    window.location.href =
        `/${language}/login.html?redirect=${encodeURIComponent(
            window.location.pathname +
            window.location.search
        )}`;

}


/*
==========================================================
BROWSER HISTORY
==========================================================
*/

window.addEventListener(
    "popstate",
    () => {

        const view =
            getRequestedView();


        showAccountView(
            view
        );

    }
);