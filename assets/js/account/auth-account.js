/* Extracted from the former account.js bundle: auth/account.js */

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

        if (typeof supabaseClient === "undefined") {
            console.error("[Souviks Account] Supabase client unavailable; redirecting to sign-in.");
            redirectToLogin();
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
STAFF SALES FUNNEL SHORTCUT
==========================================================

The shortcut is displayed only for trusted Supabase app_metadata roles.
The dashboard's server-side RPCs independently enforce the same authorization.
==========================================================
*/
function initializeSalesFunnelShortcut(user) {
    const navList = document.querySelector(".account-navigation-list");

    if (!navList || !user || typeof user !== "object") {
        return;
    }

    const appMetadata =
        user.app_metadata && typeof user.app_metadata === "object"
            ? user.app_metadata
            : {};
    const allowedRoles = new Set(["admin", "sales", "owner"]);
    const role = String(appMetadata.role || "").trim().toLowerCase();
    const secondaryRoles = Array.isArray(appMetadata.roles)
        ? appMetadata.roles
        : appMetadata.roles && typeof appMetadata.roles === "object"
            ? Object.keys(appMetadata.roles)
            : [];
    const hasStaffRole =
        allowedRoles.has(role) ||
        secondaryRoles.some(value =>
            allowedRoles.has(String(value || "").trim().toLowerCase())
        );

    if (!hasStaffRole || navList.querySelector('[data-account-sales-funnel="true"]')) {
        return;
    }

    const language = String(
        window.souviks?.currentLanguage || document.documentElement.lang || "en"
    ).split("-")[0].toLowerCase();
    const labels = {
        en: "Channel Attribution & Sales Funnel",
        bn: "চ্যানেল অ্যাট্রিবিউশন ও সেলস ফানেল",
        hi: "चैनल एट्रिब्यूशन और सेल्स फ़नल"
    };
    const labelText = labels[language] || labels.en;

    const separator = document.createElement("li");
    separator.className = "account-navigation-divider";
    separator.setAttribute("aria-hidden", "true");

    const item = document.createElement("li");
    item.className = "account-navigation-staff-item";

    const link = document.createElement("a");
    link.href = "/en/admin/channel-attribution";
    link.className = "account-navigation-link";
    link.setAttribute("data-account-sales-funnel", "true");
    link.setAttribute("aria-label", labelText);

    const label = document.createElement("span");
    label.textContent = labelText;
    link.appendChild(label);
    item.appendChild(link);

    navList.appendChild(separator);
    navList.appendChild(item);
}


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

        const { data, error } = await supabaseClient.auth.getUser();

        // Fail closed when the session cannot be verified. Some Supabase
        // auth failures say "No active session" rather than including "auth".
        if (error) {
            SouviksErrors?.log("[Souviks Account] Authentication check failed; redirecting to sign-in.", error, "warn");
            redirectToLogin();
            return;
        }

        const user = data?.user;


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

        initializeSalesFunnelShortcut(user);

        document.addEventListener(
            "souviks:rfq-updated",
            event => {
                syncAccountRFQSummary(
                    event?.detail?.items || []
                );
            }
        );


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

        initializeDashboard();


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
        SECURITY SETTINGS
        ------------------------------------------------------
        */

        initializeSecuritySettings();


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

        SouviksErrors?.log("[Souviks Account] Initialization failed:", error, "error");


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

        const statusCode = Number(error?.status ?? error?.statusCode ?? 0);
        const errorMessage = String(error?.message || "");
        if (
            statusCode === 401 ||
            /auth|session|unauthenticated|jwt|token.*expired/i.test(errorMessage)
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
        "profile",
        "inquiries",
        "saved",
        "vehicles"
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

    /*
    ------------------------------------------------------
    Account views can be opened from the sidebar, dashboard
    cards, recent activity and other account-local links.
    ------------------------------------------------------
    */

    document.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest(
                    "a[data-account-view]"
                );


            if (!link) {
                return;
            }


            const view =
                String(
                    link.dataset.accountView || ""
                )
                    .trim()
                    .toLowerCase();


            if (!view) {
                return;
            }


            if (
                link.classList.contains("is-disabled")
            ) {
                event.preventDefault();
                return;
            }


            /* Only intercept actual account views. */
            const accountViews = [
                "account",
                "rfq",
                "inquiries",
                "privacy",
                "profile",
                "saved",
                "vehicles"
            ];


            if (!accountViews.includes(view)) {
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


/*
==========================================================
ACCOUNT DASHBOARD
==========================================================
*/

function initializeDashboard() {

    const name =
        AccountState.profile?.full_name ||
        "Account";

    const company =
        AccountState.profile?.company ||
        "";

    const accountType =
        AccountState.profile?.is_business
            ? getTranslation(
                "accountBusinessAccountLabel",
                "Business Account"
            )
            : getTranslation(
                "accountIndividualAccount",
                "Individual Account"
            );

    setText(
        "accountDashboardName",
        name
    );

    setText(
        "accountDashboardCompany",
        company ||
        getTranslation(
            "accountDashboardIntro",
            "Manage RFQs, enquiries, saved parts and your profile from one place."
        )
    );

    setText(
        "accountDashboardType",
        accountType
    );

    renderDashboardProfileSummary();

    renderProfileCompletion();

    loadDashboardData();

}


function renderDashboardProfileSummary() {

    const profile =
        AccountState.profile || {};

    setText(
        "accountDashboardProfileName",
        profile.full_name
    );

    setText(
        "accountDashboardProfileEmail",
        AccountState.user?.email
    );

    setText(
        "accountDashboardProfilePhone",
        profile.phone
    );

    setText(
        "accountDashboardProfileCompany",
        profile.company ||
        getTranslation(
            "accountBusinessDetailsNotAdded",
            "Not added"
        )
    );

}


function getProfileCompletion() {

    const profile =
        AccountState.profile || {};

    const isBusiness =
        Boolean(profile.is_business);

    const checks = [
        Boolean(String(profile.full_name || "").trim()),
        Boolean(String(AccountState.user?.email || "").trim()),
        Boolean(String(profile.phone || "").trim())
    ];


    if (isBusiness) {

        checks.push(
            Boolean(String(profile.company || "").trim()),
            Boolean(String(profile.gst_number || "").trim())
        );

    }


    const total = checks.length;
    const completed = checks.filter(Boolean).length;
    const percent = total
        ? Math.round((completed / total) * 100)
        : 0;


    return {
        completed,
        total,
        percent,
        isBusiness
    };

}


function renderProfileCompletion() {

    const completion =
        getProfileCompletion();

    const bar =
        document.getElementById(
            "accountProfileCompletionBar"
        );

    const percent =
        document.getElementById(
            "accountProfileCompletionPercent"
        );

    const text =
        document.getElementById(
            "accountProfileCompletionText"
        );

    const action =
        document.getElementById(
            "accountProfileCompletionAction"
        );

    const emailStatus =
        document.getElementById(
            "accountDashboardEmailStatus"
        );


    if (bar) {
        bar.style.width = `${completion.percent}%`;
        bar.setAttribute(
            "aria-valuenow",
            String(completion.percent)
        );
    }


    if (percent) {
        percent.textContent =
            `${completion.percent}%`;
    }


    const completionText =
        completion.percent >= 100
            ? getTranslation(
                "accountProfileComplete",
                "Your profile is complete."
            )
            : getTranslation(
                "accountProfileNeedsAttention",
                "Complete your profile to keep RFQ and quotation information ready."
            );


    if (text) {
        text.textContent = completionText;
    }


    if (action) {
        action.hidden = completion.percent >= 100;
    }


    if (emailStatus) {

        const verified =
            Boolean(
                AccountState.user?.email_confirmed_at
            );

        emailStatus.textContent =
            verified
                ? getTranslation(
                    "accountEmailVerified",
                    "Email verified"
                )
                : getTranslation(
                    "accountEmailNotVerified",
                    "Email not verified"
                );

        emailStatus.classList.toggle(
            "is-verified",
            verified
        );

    }

}


async function loadDashboardData() {

    const rfqCount =
        document.getElementById(
            "accountDashboardRfqCount"
        );

    const inquiryCount =
        document.getElementById(
            "accountDashboardInquiryCount"
        );

    const savedCount =
        document.getElementById(
            "accountDashboardSavedCount"
        );

    const vehicleCount =
        document.getElementById(
            "accountDashboardVehicleCount"
        );

    try {

        if (typeof RFQ !== "undefined") {

            const items =
                await RFQ.get();

            const totalQuantity =
                (items || []).reduce(
                    (sum, item) =>
                        sum + Number(item?.qty || 0),
                    0
                );

            if (rfqCount) {
                rfqCount.textContent =
                    String(totalQuantity);
            }

        }

    } catch (error) {

        SouviksErrors?.log("[Souviks Account] Unable to load RFQ dashboard count:", error, "error");

    }

    try {

        const userId =
            AccountState.user?.id;

        if (!userId) {
            return;
        }

        const safeRequest = promise =>
            Promise.resolve(promise).catch(error => ({
                data: null,
                error
            }));

        const [
            inquiriesResult,
            savedResult,
            vehiclesResult,
            recentResult
        ] = await Promise.all([
            safeRequest(
                supabaseClient
                    .from("rfqs")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", userId)
            ),
            safeRequest(
                supabaseClient
                    .from("saved_products")
                    .select("product_id", { count: "exact", head: true })
                    .eq("user_id", userId)
            ),
            safeRequest(
                supabaseClient
                    .from("customer_vehicles")
                    .select("id, vehicle_id, vehicle_model, nickname")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false })
            ),
            safeRequest(
                supabaseClient
                    .from("rfqs")
                    .select("id, rfq_number, status, created_at")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false })
                    .limit(3)
            )
        ]);

        [inquiriesResult, savedResult, vehiclesResult, recentResult]
            .forEach((result, index) => {
                if (result?.error) {
                    SouviksErrors?.log(
                        [
                            "[Souviks Account] Dashboard inquiries request failed",
                            "[Souviks Account] Dashboard saved-products request failed",
                            "[Souviks Account] Dashboard vehicles request failed",
                            "[Souviks Account] Dashboard recent-inquiries request failed"
                        ][index],
                        result.error
                    );
                }
            });

        if (inquiryCount) {
            inquiryCount.textContent =
                inquiriesResult?.error
                    ? "—"
                    : String(inquiriesResult.count ?? 0);
        }

        if (savedCount) {
            savedCount.textContent =
                savedResult?.error
                    ? "—"
                    : String(savedResult.count ?? 0);
        }

        if (vehicleCount) {
            vehicleCount.textContent =
                vehiclesResult?.error
                    ? "—"
                    : String((vehiclesResult.data || []).length);
        }

        if (typeof renderAccountVehicleRecommendations === "function") {
            renderAccountVehicleRecommendations(vehiclesResult?.data || []);
        }

        renderRecentInquiries(
            recentResult?.data || [],
            Boolean(recentResult?.error)
        );

    } catch (error) {

        SouviksErrors?.log("[Souviks Account] Unable to load dashboard activity:", error, "error");

        renderRecentInquiries(
            [],
            true
        );

    }

}


function renderRecentInquiries(
    inquiries,
    unavailable = false
) {

    const container =
        document.getElementById(
            "accountRecentInquiries"
        );

    if (!container) {
        return;
    }

    if (unavailable) {

        container.innerHTML = `
            <div class="account-dashboard-recent-state">
                ${escapeHTML(
                    getTranslation(
                        "accountRecentUnavailable",
                        "Recent activity could not be loaded."
                    )
                )}
            </div>
        `;

        return;
    }

    if (!inquiries.length) {

        container.innerHTML = `
            <div class="account-dashboard-recent-state">
                ${escapeHTML(
                    getTranslation(
                        "accountRecentInquiriesEmpty",
                        "No inquiries yet. Your submitted quotation requests will appear here."
                    )
                )}
            </div>
        `;

        return;
    }

    container.innerHTML =
        inquiries
            .map(renderRecentInquiry)
            .join("");

}


function renderRecentInquiry(
    inquiry
) {

    const reference =
        inquiry?.rfq_number ||
        "RFQ";

    const date =
        formatDashboardDate(
            inquiry?.created_at
        );

    const status =
        formatDashboardStatus(
            inquiry?.status
        );

    return `
        <a
            class="account-dashboard-recent-item"
            href="${window.location.pathname}?view=inquiries"
            data-account-view="inquiries">

            <span class="account-dashboard-recent-main">
                <span class="account-dashboard-recent-reference">
                    ${escapeHTML(reference)}
                </span>
                <span class="account-dashboard-recent-meta">
                    ${escapeHTML(date)}
                </span>
            </span>

            <span class="account-dashboard-recent-status">
                ${escapeHTML(status)}
            </span>

            <span class="account-dashboard-recent-arrow" aria-hidden="true">
                →
            </span>

        </a>
    `;

}


function formatDashboardDate(
    value
) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        document.documentElement.lang ||
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function formatDashboardStatus(
    value
) {

    const normalized =
        String(value || "submitted")
            .trim()
            .toLowerCase();

    const keyMap = {
        submitted:
            "accountInquiryStatusSubmitted",
        processing:
            "accountInquiryStatusProcessing",
        quoted:
            "accountInquiryStatusQuoted",
        completed:
            "accountInquiryStatusCompleted",
        cancelled:
            "accountInquiryStatusCancelled"
    };

    const key =
        keyMap[normalized];

    if (key) {
        return getTranslation(
            key,
            normalized.charAt(0).toUpperCase() +
            normalized.slice(1)
        );
    }

    return normalized.charAt(0).toUpperCase() +
        normalized.slice(1);

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
        "profile",
        "saved",
        "vehicles"
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
    ------------------------------------------------------
    MY VEHICLES
    ------------------------------------------------------
    */

    if (
        view ===
        "vehicles"
    ) {

        if (
            typeof refreshAccountVehicles ===
            "function"
        ) {

            refreshAccountVehicles();

        } else {

            console.error(
                "[Souviks Account] refreshAccountVehicles() is unavailable."
            );

        }

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
                        "/account"
                    )
                );


            link.classList.toggle(
                "active",
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


    setText(
        "accountBusinessDescription",
        profile.is_business
            ? getTranslation(
                "accountBusinessAccountDescription",
                "Business details are used for quotation and customer records."
            )
            : getTranslation(
                "accountBusinessDetailsNotAdded",
                "Business details have not been added yet."
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

    renderDashboardProfileSummary();

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

        SouviksErrors?.log("[Souviks Account] Profile update failed:", error, "error");


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

    const verification =
        document.getElementById(
            "privacyEmailVerificationStatus"
        );

    if (verification) {

        const verified =
            Boolean(
                AccountState.user?.email_confirmed_at
            );

        verification.textContent =
            getTranslation(
                verified
                    ? "accountEmailVerified"
                    : "accountEmailNotVerified",
                verified
                    ? "Verified"
                    : "Not verified"
            );

        verification.classList.toggle(
            "is-verified",
            verified
        );

    }

}


/*
==========================================================
SECURITY SETTINGS
==========================================================
*/

function initializeSecuritySettings() {

    const changeEmailButton =
        document.getElementById(
            "changeEmailButton"
        );

    const changePasswordButton =
        document.getElementById(
            "changePasswordButton"
        );

    const cancelEmailButton =
        document.getElementById(
            "cancelEmailChange"
        );

    const cancelPasswordButton =
        document.getElementById(
            "cancelPasswordChange"
        );

    const emailForm =
        document.getElementById(
            "account-change-email-form"
        );

    const passwordForm =
        document.getElementById(
            "account-change-password-form"
        );

    if (changeEmailButton) {
        changeEmailButton.addEventListener(
            "click",
            () => toggleSecurityPanel("email")
        );
    }

    if (changePasswordButton) {
        changePasswordButton.addEventListener(
            "click",
            () => toggleSecurityPanel("password")
        );
    }

    if (cancelEmailButton) {
        cancelEmailButton.addEventListener(
            "click",
            () => resetSecurityForm("email")
        );
    }

    if (cancelPasswordButton) {
        cancelPasswordButton.addEventListener(
            "click",
            () => resetSecurityForm("password")
        );
    }

    if (emailForm) {
        emailForm.addEventListener(
            "submit",
            handleEmailChange
        );
    }

    if (passwordForm) {
        passwordForm.addEventListener(
            "submit",
            handlePasswordChange
        );
    }

    document.querySelectorAll(
        "[data-password-toggle]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            () => togglePasswordVisibility(button)
        );
    });

    const passwordInput =
        document.getElementById(
            "account-new-password"
        );

    if (passwordInput) {
        passwordInput.addEventListener(
            "input",
            updatePasswordStrength
        );
    }

    renderPrivacy();

}


function toggleSecurityPanel(type) {

    const emailPanel =
        document.getElementById(
            "changeEmailPanel"
        );

    const passwordPanel =
        document.getElementById(
            "changePasswordPanel"
        );

    const emailButton =
        document.getElementById(
            "changeEmailButton"
        );

    const passwordButton =
        document.getElementById(
            "changePasswordButton"
        );

    const isEmail =
        type === "email";

    const requestedPanel =
        isEmail
            ? emailPanel
            : passwordPanel;

    const shouldOpen =
        Boolean(
            requestedPanel &&
            requestedPanel.hidden
        );

    if (emailPanel) {
        emailPanel.hidden =
            !isEmail || !shouldOpen;
    }

    if (passwordPanel) {
        passwordPanel.hidden =
            isEmail || !shouldOpen;
    }

    if (emailButton) {
        emailButton.setAttribute(
            "aria-expanded",
            String(
                isEmail &&
                shouldOpen
            )
        );
    }

    if (passwordButton) {
        passwordButton.setAttribute(
            "aria-expanded",
            String(
                !isEmail &&
                shouldOpen
            )
        );
    }

    if (isEmail && shouldOpen) {
        document
            .getElementById("account-new-email")
            ?.focus();
    }

    if (!isEmail && shouldOpen) {
        document
            .getElementById("account-new-password")
            ?.focus();
    }

}


function resetSecurityForm(type) {

    if (type === "email") {
        const form = document.getElementById("account-change-email-form");
        form?.reset();
        showSecurityFormStatus("email", "");
        const panel = document.getElementById("changeEmailPanel");
        const button = document.getElementById("changeEmailButton");
        if (panel) panel.hidden = true;
        if (button) button.setAttribute("aria-expanded", "false");
        return;
    }

    const form = document.getElementById("account-change-password-form");
    form?.reset();
    showSecurityFormStatus("password", "");
    updatePasswordStrength();
    document.querySelectorAll("[data-password-toggle]").forEach(button => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (input) input.type = "password";
        button.textContent = getTranslation("accountShowPassword", "Show");
        button.setAttribute("aria-label", getTranslation("accountShowPassword", "Show"));
        button.setAttribute("aria-pressed", "false");
    });
    const panel = document.getElementById("changePasswordPanel");
    const button = document.getElementById("changePasswordButton");
    if (panel) panel.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");

}


async function handleEmailChange(event) {

    event.preventDefault();

    const input = document.getElementById("account-new-email");
    const button = document.getElementById("updateEmailButton");
    const newEmail = input?.value.trim().toLowerCase() || "";
    const currentEmail = String(AccountState.user?.email || "").trim().toLowerCase();

    if (!newEmail) {
        showSecurityFormStatus("email", getTranslation("accountEmailInvalid", "Please enter a valid email address."), "error");
        input?.focus();
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        showSecurityFormStatus("email", getTranslation("accountEmailInvalid", "Please enter a valid email address."), "error");
        input?.focus();
        return;
    }

    if (newEmail === currentEmail) {
        showSecurityFormStatus("email", getTranslation("accountEmailSame", "Please enter a different email address."), "error");
        input?.focus();
        return;
    }

    if (button) button.disabled = true;
    showSecurityFormStatus("email", getTranslation("accountSaving", "Saving..."));

    try {
        const { error } =
            await supabaseClient.auth.updateUser({
                email: newEmail
            });

        if (error) throw error;

        showSecurityFormStatus(
            "email",
            getTranslation(
                "accountEmailChangeSuccess",
                "A confirmation email has been sent to your new email address."
            ),
            "success"
        );

        input.value = "";

    } catch (error) {
        SouviksErrors?.log("[Souviks Account] Email update failed:", error, "error");
        showSecurityFormStatus(
            "email",
            getTranslation(
                "accountSecurityUpdateError",
                "Unable to update your security settings. Please try again."
            ),
            "error"
        );
    } finally {
        if (button) button.disabled = false;
    }

}


async function handlePasswordChange(event) {

    event.preventDefault();

    const input = document.getElementById("account-new-password");
    const confirmInput = document.getElementById("account-confirm-new-password");
    const button = document.getElementById("updatePasswordButton");

    const password = input?.value || "";
    const confirmPassword = confirmInput?.value || "";

    if (!password) {
        showSecurityFormStatus("password", getTranslation("accountPasswordRequired", "Please enter a new password."), "error");
        input?.focus();
        return;
    }

    if (password.length < 8) {
        showSecurityFormStatus("password", getTranslation("accountPasswordMinLength", "Password must be at least 8 characters."), "error");
        input?.focus();
        return;
    }

    if (password !== confirmPassword) {
        showSecurityFormStatus("password", getTranslation("accountPasswordMismatch", "Passwords do not match."), "error");
        confirmInput?.focus();
        return;
    }

    if (button) button.disabled = true;
    showSecurityFormStatus("password", getTranslation("accountSaving", "Saving..."));

    try {
        const { error } =
            await supabaseClient.auth.updateUser({
                password
            });

        if (error) throw error;

        showSecurityFormStatus(
            "password",
            getTranslation(
                "accountPasswordChangeSuccess",
                "Your password has been updated successfully."
            ),
            "success"
        );

        resetPasswordInputsOnly();

    } catch (error) {
        SouviksErrors?.log("[Souviks Account] Password update failed:", error, "error");
        showSecurityFormStatus(
            "password",
            getTranslation(
                "accountSecurityUpdateError",
                "Unable to update your security settings. Please try again."
            ),
            "error"
        );
    } finally {
        if (button) button.disabled = false;
    }

}


function resetPasswordInputsOnly() {
    const input = document.getElementById("account-new-password");
    const confirmInput = document.getElementById("account-confirm-new-password");
    if (input) input.value = "";
    if (confirmInput) confirmInput.value = "";
    updatePasswordStrength();
}


function updatePasswordStrength() {
    const input = document.getElementById("account-new-password");
    const bar = document.getElementById("accountPasswordStrengthBar");
    const text = document.getElementById("accountPasswordStrengthText");
    if (!input || !bar || !text) return;

    const value = input.value || "";
    bar.className = "";

    if (!value) {
        text.textContent = getTranslation("accountPasswordStrengthEmpty", "Enter a password");
        return;
    }

    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    const state = score <= 2 ? "weak" : score <= 3 ? "fair" : "strong";
    bar.classList.add(state);
    text.textContent =
        state === "weak"
            ? getTranslation("accountPasswordStrengthWeak", "Weak")
            : state === "fair"
                ? getTranslation("accountPasswordStrengthFair", "Fair")
                : getTranslation("accountPasswordStrengthStrong", "Strong");
}


function togglePasswordVisibility(button) {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    const label = getTranslation(
        showing ? "accountShowPassword" : "accountHidePassword",
        showing ? "Show" : "Hide"
    );
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(!showing));
}


function showSecurityFormStatus(type, message, statusType = "") {
    const id =
        type === "email"
            ? "accountEmailChangeStatus"
            : "accountPasswordChangeStatus";

    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = message || "";
    element.className = "form-status";
    if (statusType) element.classList.add(statusType);
    element.hidden = !message;

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

        const items =
            await RFQ.get();

        syncAccountRFQSummary(items);

        await RFQ.updateBadge();

        await RFQ.renderPage();

    } catch (error) {

        SouviksErrors?.log("[Souviks Account] RFQ render failed:", error, "error");

    }

}


/*
==========================================================
RFQ SUMMARY
==========================================================
*/

function syncAccountRFQSummary(
    items
) {

    const list =
        Array.isArray(items)
            ? items
            : [];

    const parts = list.length;

    const units =
        list.reduce(
            (sum, item) =>
                sum + Math.max(0, Number(item?.qty || 0)),
            0
        );

    const summary =
        document.getElementById(
            "accountRfqSummary"
        );

    if (summary) {
        const template =
            parts
                ? getTranslation("accountRfqSummary", "{parts} parts · {units} units")
                : getTranslation("accountRfqSummaryEmpty", "Your RFQ basket is empty. Add parts to request a quotation.");
        summary.textContent = template
            .replace("{parts}", String(parts))
            .replace("{units}", String(units));
    }

    const submitButton =
        document.getElementById(
            "accountRfqSubmit"
        );

    if (submitButton) {
        submitButton.disabled =
            !parts ||
            AccountState.rfqSubmitting;

        if (parts) {
            submitButton.textContent =
                getTranslation("rfqSubmit", "Submit for Quote");

            const success = document.getElementById("accountRfqSuccess");
            if (success) success.hidden = true;
        }
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

        SouviksErrors?.log("[Souviks Account] Unable to read RFQ basket:", error, "error");


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

        SouviksErrors?.log("[Souviks Account] RFQ submission failed:", error, "error");


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

    const submitButton = document.getElementById("accountRfqSubmit");
    const success = document.getElementById("accountRfqSuccess");
    const successMessage = document.getElementById("accountRfqSuccessMessage");
    const status = document.getElementById("accountRfqStatus");

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = getTranslation("rfqSubmitted", "RFQ Submitted");
    }

    if (status) {
        status.hidden = true;
        status.textContent = "";
        status.className = "form-status";
    }

    const message = reference
        ? `${getTranslation("rfqSubmittedSuccessfully", "Your quotation request has been submitted successfully.")} ${getTranslation("rfqReference", "Reference:")} ${reference}`
        : getTranslation("rfqSubmittedSuccessfully", "Your quotation request has been submitted successfully.");

    if (success && successMessage) {
        successMessage.textContent = message;
        success.hidden = false;
        return;
    }

    showRFQStatus(message, "success");
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

    const html = document.documentElement;
    const messages = document.getElementById("accountMessages");
    const candidates = [key];

    // Existing account messages use both account-prefixed keys and their
    // shorter equivalents (for example data-name-required).
    if (key.startsWith("account") && key.length > 7) {
        candidates.push(key.charAt(7).toLowerCase() + key.slice(8));
    }

    for (const candidate of candidates) {
        const value = messages?.dataset?.[candidate] || html.dataset?.[candidate];
        if (value) return value;
    }

    return fallback;

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
        `/${language}/login?redirect=${encodeURIComponent(
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
