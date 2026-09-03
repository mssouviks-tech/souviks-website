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

        list.innerHTML =
            rfqs
                .map(
                    rfq =>
                        renderInquiry(
                            rfq,
                            itemsByRFQ[
                                rfq.id
                            ] || []
                        )
                )
                .join(
                    ""
                );


        loading.hidden =
            true;

        empty.hidden =
            true;

        list.hidden =
            false;


        initializeInquiryDetails();


    } catch (error) {

        console.error(
            "[Souviks Inquiries] Failed to load inquiries:",
            error
        );


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
                    class="account-inquiry-status">

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


        </div>

    `;

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