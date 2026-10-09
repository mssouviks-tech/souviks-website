/* Extracted from the former account.js bundle: auth/inquiries.js */

/*
==========================================================
SOUVIKS — MY INQUIRIES
==========================================================

Displays authenticated user's previously submitted RFQs.

Data source:

    public.rfqs
    public.rfq_items

Security:

    Supabase RLS limits records to auth.uid().
==========================================================
*/


const InquiryState = {
    rfqs: [],
    itemsByRFQ: {},
    filter: "all",
    repeatSubmitting: false
};


document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeInquiries();

    }
);


/*
==========================================================
INITIALIZE
==========================================================
*/

async function initializeInquiries() {

    /*
    ------------------------------------------------------
    The Account page may load this script before the
    account view is opened.
    ------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks Inquiries] Supabase client unavailable."
        );

        return;

    }


    /*
    ------------------------------------------------------
    If the inquiries container doesn't exist, there is
    nothing to initialize.
    ------------------------------------------------------
    */

    const container =
        document.getElementById(
            "accountInquiries"
        );


    if (!container) {

        return;

    }


    /*
    ------------------------------------------------------
    Expose refresh function for account.js
    ------------------------------------------------------
    */

    window.refreshAccountInquiries =
        loadInquiries;

    initializeInquiryFilters();


    /*
    ------------------------------------------------------
    Load immediately
    ------------------------------------------------------
    */

    await loadInquiries();

}


/*
==========================================================
LOAD INQUIRIES
==========================================================
*/

async function loadInquiries() {

    const loading =
        document.getElementById(
            "accountInquiriesLoading"
        );


    const empty =
        document.getElementById(
            "accountInquiriesEmpty"
        );


    const list =
        document.getElementById(
            "accountInquiriesList"
        );


    if (
        !loading ||
        !empty ||
        !list
    ) {

        return;

    }


    /*
    ------------------------------------------------------
    Initial state
    ------------------------------------------------------
    */

    loading.hidden =
        false;

    empty.hidden =
        true;

    list.hidden =
        true;


    list.innerHTML =
        "";


    try {

        /*
        --------------------------------------------------
        Get authenticated user
        --------------------------------------------------
        */

        const {
            data: authData,
            error: authError
        } =
            await supabaseClient.auth.getUser();


        if (authError) {

            throw authError;

        }


        const user =
            authData?.user;


        if (!user) {

            throw new Error(
                "Authentication required."
            );

        }


        /*
        --------------------------------------------------
        Fetch RFQs
        --------------------------------------------------
        */

        const {
            data: rfqs,
            error: rfqError
        } =
            await supabaseClient

                .from(
                    "rfqs"
                )

                .select(
                    `
                    id,
                    rfq_number,
                    customer_name,
                    customer_email,
                    customer_phone,
                    company,
                    gst_number,
                    is_business,
                    message,
                    status,
                    created_at,
                    updated_at
                    `
                )

                .eq(
                    "user_id",
                    user.id
                )

                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        if (rfqError) {

            throw rfqError;

        }


        /*
        --------------------------------------------------
        No inquiries
        --------------------------------------------------
        */

        if (
            !rfqs ||
            !rfqs.length
        ) {

            loading.hidden =
                true;

            empty.hidden =
                false;

            list.hidden =
                true;

            return;

        }


        /*
        --------------------------------------------------
        Fetch RFQ items
        --------------------------------------------------
        */

        const rfqIds =
            rfqs.map(
                rfq =>
                    rfq.id
            );


        const {
            data: items,
            error: itemsError
        } =
            await supabaseClient

                .from(
                    "rfq_items"
                )

                .select(
                    `
                    id,
                    rfq_id,
                    product_id,
                    part_number,
                    product_name,
                    brand,
                    quantity,
                    created_at
                    `
                )

                .in(
                    "rfq_id",
                    rfqIds
                )

                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                );


        if (itemsError) {

            throw itemsError;

        }


        /*
        --------------------------------------------------
        Group items by RFQ
        --------------------------------------------------
        */

        const itemsByRFQ =
            {};


        (
            items ||
            []
        ).forEach(
            item => {

                if (
                    !itemsByRFQ[
                        item.rfq_id
                    ]
                ) {

                    itemsByRFQ[
                        item.rfq_id
                    ] = [];

                }


                itemsByRFQ[
                    item.rfq_id
                ].push(
                    item
                );

            }
        );


        /*
        --------------------------------------------------
        Render
        --------------------------------------------------
        */

        InquiryState.rfqs = rfqs || [];
        InquiryState.itemsByRFQ = itemsByRFQ;

        loading.hidden = true;
        empty.hidden = true;

        renderInquiryList();


    } catch (error) {

        SouviksErrors?.log("[Souviks Inquiries] Failed to load inquiries:", error, "error");


        loading.hidden =
            true;


        empty.hidden =
            false;


        empty.textContent =
            getInquiryTranslation(
                "inquiriesLoadError",
                "Unable to load your inquiries. Please try again."
            );

    }

}


/*
==========================================================
INQUIRY FILTERS
==========================================================
*/

function initializeInquiryFilters() {
    const filter = document.getElementById("accountInquiryStatusFilter");
    if (!filter) return;

    filter.value = InquiryState.filter;
    filter.addEventListener("change", () => {
        InquiryState.filter = String(filter.value || "all").toLowerCase();
        renderInquiryList();
    });
}


function renderInquiryList() {
    const loading = document.getElementById("accountInquiriesLoading");
    const empty = document.getElementById("accountInquiriesEmpty");
    const filteredEmpty = document.getElementById("accountInquiriesFilterEmpty");
    const list = document.getElementById("accountInquiriesList");
    const count = document.getElementById("accountInquiriesCount");
    if (!list) return;

    const all = Array.isArray(InquiryState.rfqs) ? InquiryState.rfqs : [];
    const filtered = InquiryState.filter === "all"
        ? all
        : all.filter(rfq => normalizeInquiryStatus(rfq?.status) === InquiryState.filter);

    if (count) {
        count.textContent = getInquiryTranslation("inquiriesShowing", "Showing {shown} of {total}")
            .replace("{shown}", String(filtered.length))
            .replace("{total}", String(all.length));
    }

    if (loading) loading.hidden = true;

    if (!all.length) {
        if (empty) empty.hidden = false;
        if (filteredEmpty) filteredEmpty.hidden = true;
        list.hidden = true;
        list.innerHTML = "";
        return;
    }

    if (!filtered.length) {
        if (empty) empty.hidden = true;
        if (filteredEmpty) filteredEmpty.hidden = false;
        list.hidden = true;
        list.innerHTML = "";
        return;
    }

    if (empty) empty.hidden = true;
    if (filteredEmpty) filteredEmpty.hidden = true;

    list.innerHTML = filtered.map(rfq => renderInquiry(rfq, InquiryState.itemsByRFQ[rfq.id] || [])).join("");
    list.hidden = false;
    initializeInquiryDetails();
    initializeRepeatRFQ();
}


/*
==========================================================
RENDER INQUIRY
==========================================================
*/

function renderInquiry(
    rfq,
    items
) {

    const reference =
        formatRFQNumber(
            rfq.rfq_number
        );


    const date =
        formatInquiryDate(
            rfq.created_at
        );


    const status =
        formatStatus(
            rfq.status
        );

    const normalizedStatus =
        normalizeInquiryStatus(
            rfq.status
        );


    const itemCount =
        items.length;


    const itemLabel =
        itemCount === 1

            ? getInquiryTranslation(
                "inquiryItem",
                "item"
            )

            : getInquiryTranslation(
                "inquiryItems",
                "items"
            );


    return `

        <article
            class="account-inquiry-card"
            data-inquiry-id="${escapeHTML(
                rfq.id
            )}">


            <!-- ==================================
                 SUMMARY
            =================================== -->

            <button
                type="button"
                class="account-inquiry-summary"
                aria-expanded="false">


                <span
                    class="account-inquiry-main">


                    <span
                        class="account-inquiry-reference">

                        ${escapeHTML(
                            reference
                        )}

                    </span>


                    <span
                        class="account-inquiry-meta">

                        ${escapeHTML(
                            date
                        )}

                        ·

                        ${itemCount}

                        ${escapeHTML(
                            itemLabel
                        )}

                    </span>


                </span>


                <span
                    class="account-inquiry-status status-${normalizedStatus}">

                    ${escapeHTML(
                        status
                    )}

                </span>


                <span
                    class="account-inquiry-arrow"
                    aria-hidden="true">

                    ▼

                </span>


            </button>


            <!-- ==================================
                 DETAILS
            =================================== -->

            <div
                class="account-inquiry-details"
                hidden>


                ${renderInquiryDetails(
                    rfq,
                    items
                )}


            </div>


        </article>

    `;

}


/*
==========================================================
RENDER DETAILS
==========================================================
*/

function renderInquiryDetails(
    rfq,
    items
) {

    const products =
        items.length

            ? items
                .map(
                    item =>
                        `
                        <tr>

                            <td>
                                ${escapeHTML(
                                    item.part_number ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.product_name ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.brand ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    String(
                                        item.quantity ||
                                        0
                                    )
                                )}
                            </td>

                        </tr>
                        `
                )
                .join(
                    ""
                )

            : `
                <tr>

                    <td colspan="4">

                        ${escapeHTML(
                            getInquiryTranslation(
                                "inquiriesNoItems",
                                "No products were recorded for this inquiry."
                            )
                        )}

                    </td>

                </tr>
            `;


    return `

        <div
            class="account-inquiry-content">


            <!-- ==================================
                 PRODUCTS
            =================================== -->

            <section
                class="account-inquiry-products">


                <h3>

                    ${escapeHTML(
                        getInquiryTranslation(
                            "inquiriesProducts",
                            "Products"
                        )
                    )}

                </h3>


                <div
                    class="account-inquiry-table-wrapper">


                    <table
                        class="account-inquiry-table">


                        <thead>

                            <tr>

                                <th>

                                    ${escapeHTML(
                                        getInquiryTranslation(
                                            "inquiriesPartNumber",
                                            "Part Number"
                                        )
                                    )}

                                </th>

                                <th>

                                    ${escapeHTML(
                                        getInquiryTranslation(
                                            "inquiriesProduct",
                                            "Product"
                                        )
                                    )}

                                </th>

                                <th>

                                    ${escapeHTML(
                                        getInquiryTranslation(
                                            "inquiriesBrand",
                                            "Brand"
                                        )
                                    )}

                                </th>

                                <th>

                                    ${escapeHTML(
                                        getInquiryTranslation(
                                            "inquiriesQuantity",
                                            "Quantity"
                                        )
                                    )}

                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            ${products}

                        </tbody>


                    </table>


                </div>


            </section>


            <!-- ==================================
                 CUSTOMER
            =================================== -->

            <section
                class="account-inquiry-customer">


                <h3>

                    ${escapeHTML(
                        getInquiryTranslation(
                            "inquiriesCustomer",
                            "Customer Information"
                        )
                    )}

                </h3>


                <dl>

                    <div>

                        <dt>
                            ${escapeHTML(
                                getInquiryTranslation(
                                    "inquiriesName",
                                    "Name"
                                )
                            )}
                        </dt>

                        <dd>
                            ${escapeHTML(
                                rfq.customer_name ||
                                "—"
                            )}
                        </dd>

                    </div>


                    <div>

                        <dt>
                            ${escapeHTML(
                                getInquiryTranslation(
                                    "inquiriesEmail",
                                    "Email"
                                )
                            )}
                        </dt>

                        <dd>
                            ${escapeHTML(
                                rfq.customer_email ||
                                "—"
                            )}
                        </dd>

                    </div>


                    <div>

                        <dt>
                            ${escapeHTML(
                                getInquiryTranslation(
                                    "inquiriesPhone",
                                    "Phone"
                                )
                            )}
                        </dt>

                        <dd>
                            ${escapeHTML(
                                rfq.customer_phone ||
                                "—"
                            )}
                        </dd>

                    </div>


                    <div>

                        <dt>
                            ${escapeHTML(
                                getInquiryTranslation(
                                    "inquiriesCompany",
                                    "Company"
                                )
                            )}
                        </dt>

                        <dd>
                            ${escapeHTML(
                                rfq.company ||
                                "—"
                            )}
                        </dd>

                    </div>


                    ${
                        rfq.is_business
                            ? `

                                <div>

                                    <dt>
                                        ${escapeHTML(
                                            getInquiryTranslation(
                                                "inquiriesGst",
                                                "GST Number"
                                            )
                                        )}
                                    </dt>

                                    <dd>
                                        ${escapeHTML(
                                            rfq.gst_number ||
                                            "—"
                                        )}
                                    </dd>

                                </div>

                            `
                            : ""
                    }


                </dl>


            </section>


            <!-- ==================================
                 MESSAGE
            =================================== -->

            ${
                rfq.message
                    ? `

                        <section
                            class="account-inquiry-message">


                            <h3>

                                ${escapeHTML(
                                    getInquiryTranslation(
                                        "inquiriesMessage",
                                        "Additional Notes"
                                    )
                                )}

                            </h3>


                            <p>

                                ${escapeHTML(
                                    rfq.message
                                )}

                            </p>


                        </section>

                    `
                    : ""
            }


            <!-- ==================================
                 STATUS + ACTIONS
            =================================== -->

            <section
                class="account-inquiry-actions">

                <div
                    class="account-inquiry-progress-wrap">

                    <h3>

                        ${escapeHTML(
                            getInquiryTranslation(
                                "inquiryStatusTimeline",
                                "RFQ Status"
                            )
                        )}

                    </h3>

                    ${renderInquiryProgress(rfq.status)}

                </div>

                <div
                    class="account-inquiry-action-row">

                    <button
                        type="button"
                        class="btn btn-primary account-repeat-rfq"
                        data-repeat-rfq-id="${escapeHTML(rfq.id)}">

                        ${escapeHTML(
                            getInquiryTranslation(
                                "inquiryRepeatRFQ",
                                "Repeat this RFQ"
                            )
                        )}

                    </button>

                    <a
                        href="?view=rfq"
                        class="btn btn-secondary"
                        data-account-view="rfq">

                        ${escapeHTML(
                            getInquiryTranslation(
                                "inquiryOpenRFQ",
                                "Open RFQ Basket"
                            )
                        )}

                    </a>

                </div>

                <div
                    class="account-inquiry-repeat-status form-status"
                    role="status"
                    aria-live="polite"
                    hidden>
                </div>

            </section>


        </div>

    `;

}


/*
==========================================================
INQUIRY STATUS PROGRESS
==========================================================
*/

function renderInquiryProgress(status) {

    const normalized =
        normalizeInquiryStatus(status);

    const steps = [
        "submitted",
        "processing",
        "quoted",
        "completed"
    ];

    const cancelled =
        normalized === "cancelled";

    const currentIndex =
        steps.indexOf(normalized);

    const items = steps.map(
        (step, index) => {

            const state =
                cancelled
                    ? ""
                    : index < currentIndex
                        ? "is-complete"
                        : index === currentIndex
                            ? "is-current"
                            : "";

            return `
                <li class="account-inquiry-progress-step ${state}">
                    <span class="account-inquiry-progress-dot" aria-hidden="true"></span>
                    <span class="account-inquiry-progress-label">
                        ${escapeHTML(formatStatus(step))}
                    </span>
                </li>
            `;

        }
    ).join("");

    return `
        <ol class="account-inquiry-progress" aria-label="${escapeHTML(
            getInquiryTranslation(
                "inquiryStatusTimeline",
                "RFQ Status"
            )
        )}">
            ${items}
            ${cancelled ? `
                <li class="account-inquiry-progress-step is-cancelled">
                    <span class="account-inquiry-progress-dot" aria-hidden="true"></span>
                    <span class="account-inquiry-progress-label">
                        ${escapeHTML(formatStatus("cancelled"))}
                    </span>
                </li>
            ` : ""}
        </ol>
    `;
}


/*
==========================================================
REPEAT RFQ
==========================================================
*/

function initializeRepeatRFQ() {

    document
        .querySelectorAll(".account-repeat-rfq")
        .forEach(button => {

            if (button.dataset.repeatBound === "true") {
                return;
            }

            button.dataset.repeatBound = "true";

            button.addEventListener("click", async () => {

                if (InquiryState.repeatSubmitting) {
                    return;
                }

                const rfqId =
                    String(button.dataset.repeatRfqId || "").trim();

                if (!rfqId) {
                    return;
                }

                const card =
                    button.closest(".account-inquiry-card");

                const statusElement =
                    card?.querySelector(
                        ".account-inquiry-repeat-status"
                    );

                const items =
                    InquiryState.itemsByRFQ[rfqId] || [];

                if (!items.length) {

                    showRepeatStatus(
                        statusElement,
                        getInquiryTranslation(
                            "inquiryRepeatNoItems",
                            "This RFQ has no recorded items to repeat."
                        ),
                        "error"
                    );

                    return;
                }

                InquiryState.repeatSubmitting = true;
                button.disabled = true;
                button.textContent = getInquiryTranslation(
                    "inquiryRepeatingRFQ",
                    "Adding to RFQ..."
                );
                showRepeatStatus(
                    statusElement,
                    "",
                    ""
                );

                try {

                    if (
                        typeof RFQ === "undefined" ||
                        typeof RFQ.get !== "function" ||
                        typeof RFQ.setQuantity !== "function"
                    ) {
                        throw new Error("RFQ basket unavailable.");
                    }

                    const existingItems =
                        await RFQ.get();

                    const existingById = new Map(
                        existingItems.map(item => [
                            String(item.id),
                            item
                        ])
                    );

                    const grouped = new Map();

                    items.forEach(item => {

                        const productId =
                            String(item.product_id || "").trim();

                        if (!productId) {
                            return;
                        }

                        const quantity = Math.max(
                            1,
                            Number(item.quantity) || 1
                        );

                        const current =
                            grouped.get(productId);

                        if (current) {
                            current.qty += quantity;
                            return;
                        }

                        grouped.set(productId, {
                            id: productId,
                            partNumber: item.part_number || "",
                            name: item.product_name || "",
                            brand: item.brand || "",
                            qty: quantity
                        });
                    });

                    let addedParts = 0;
                    let addedUnits = 0;
                    let failedParts = 0;

                    for (const item of grouped.values()) {

                        const existing =
                            existingById.get(item.id);

                        const targetQuantity =
                            (existing?.qty || 0) + item.qty;

                        const added =
                            await RFQ.setQuantity(
                                item.id,
                                item,
                                targetQuantity
                            );

                        if (added) {
                            addedParts += 1;
                            addedUnits += item.qty;
                        } else {
                            failedParts += 1;
                        }
                    }

                    if (!addedParts) {
                        throw new Error(
                            getInquiryTranslation(
                                "inquiryRepeatFailed",
                                "The RFQ could not be added to your basket. Please try again."
                            )
                        );
                    }

                    const successMessage =
                        getInquiryTranslation(
                            failedParts
                                ? "inquiryRepeatPartial"
                                : "inquiryRepeatSuccess",
                            failedParts
                                ? "Added {parts} parts ({units} units). Some items could not be added."
                                : "Added {parts} parts ({units} units) to your RFQ basket."
                        )
                            .replace("{parts}", String(addedParts))
                            .replace("{units}", String(addedUnits));

                    showRepeatStatus(
                        statusElement,
                        successMessage,
                        failedParts ? "warning" : "success"
                    );

                    button.textContent = getInquiryTranslation(
                        "inquiryRepeatedRFQ",
                        "Added to RFQ"
                    );

                    const actionRow =
                        card?.querySelector(
                            ".account-inquiry-action-row"
                        );

                    if (actionRow) {

                        actionRow
                            .querySelectorAll(
                                ".account-repeat-rfq"
                            )
                            .forEach(
                                element => {
                                    element.disabled = true;
                                }
                            );
                    }

                } catch (error) {

                    SouviksErrors?.log("[Souviks Inquiries] Repeat RFQ failed:", error, "error");

                    showRepeatStatus(
                        statusElement,
                        error?.message ||
                            getInquiryTranslation(
                                "inquiryRepeatFailed",
                                "The RFQ could not be added to your basket. Please try again."
                            ),
                        "error"
                    );

                    button.disabled = false;
                    button.textContent = getInquiryTranslation(
                        "inquiryRepeatRFQ",
                        "Repeat this RFQ"
                    );

                } finally {
                    InquiryState.repeatSubmitting = false;
                }

            });

        });

}


function showRepeatStatus(element, message, type = "") {

    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.className = "account-inquiry-repeat-status form-status";

    if (type) {
        element.classList.add(type);
    }

    element.hidden = !message;
}


/*
==========================================================
DETAIL TOGGLE
==========================================================
*/

function initializeInquiryDetails() {

    const cards =
        document.querySelectorAll(
            ".account-inquiry-card"
        );


    cards.forEach(
        card => {

            const button =
                card.querySelector(
                    ".account-inquiry-summary"
                );


            const details =
                card.querySelector(
                    ".account-inquiry-details"
                );


            if (
                !button ||
                !details
            ) {

                return;

            }


            button.addEventListener(
                "click",
                () => {

                    const expanded =
                        button.getAttribute(
                            "aria-expanded"
                        ) ===
                        "true";


                    button.setAttribute(
                        "aria-expanded",
                        String(
                            !expanded
                        )
                    );


                    details.hidden =
                        expanded;

                }
            );

        }
    );

}


/*
==========================================================
RFQ NUMBER
==========================================================
*/

function formatRFQNumber(
    number
) {

    if (
        number === null ||
        number === undefined ||
        number === ""
    ) {

        return getInquiryTranslation(
            "inquiryReferenceUnavailable",
            "RFQ"
        );

    }


    /*
    ------------------------------------------------------
    Database rfq_number is numeric.
    Display consistently as RFQ000001.
    ------------------------------------------------------
    */

    const numeric =
        Number(
            number
        );


    if (
        Number.isFinite(
            numeric
        )
    ) {

        return (
            "RFQ" +
            String(
                numeric
            ).padStart(
                6,
                "0"
            )
        );

    }


    return String(
        number
    );

}


/*
==========================================================
DATE
==========================================================
*/

function formatInquiryDate(
    value
) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        document.documentElement.lang ||
        "en",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"
        }
    ).format(
        date
    );

}


function normalizeInquiryStatus(
    status
) {
    const value = String(status || "submitted").trim().toLowerCase();
    const allowed = ["submitted", "processing", "quoted", "completed", "cancelled"];
    return allowed.includes(value) ? value : "submitted";
}


/*
==========================================================
STATUS
==========================================================
*/

function formatStatus(
    status
) {

    const value =
        String(
            status ||
            "submitted"
        )
            .trim()
            .toLowerCase();


    const translations = {

        submitted:
            getInquiryTranslation(
                "inquiryStatusSubmitted",
                "Submitted"
            ),

        processing:
            getInquiryTranslation(
                "inquiryStatusProcessing",
                "Processing"
            ),

        quoted:
            getInquiryTranslation(
                "inquiryStatusQuoted",
                "Quoted"
            ),

        completed:
            getInquiryTranslation(
                "inquiryStatusCompleted",
                "Completed"
            ),

        cancelled:
            getInquiryTranslation(
                "inquiryStatusCancelled",
                "Cancelled"
            )

    };


    return (
        translations[value] ||
        status ||
        "Submitted"
    );

}


/*
==========================================================
ESCAPE HTML
==========================================================
*/

function escapeHTML(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/*
==========================================================
TRANSLATION HELPER
==========================================================
*/

function getInquiryTranslation(
    key,
    fallback
) {

    /*
    ------------------------------------------------------
    The account page can expose translations through
    data attributes in the future.

    Until then, fallback text keeps the component
    functional.
    ------------------------------------------------------
    */

    const html =
        document.documentElement;


    const datasetKey =
        key.replace(
            /[A-Z]/g,
            letter =>
                `-${letter.toLowerCase()}`
        );


    return (
        html.dataset[
            datasetKey
        ] ||
        fallback
    );

}
