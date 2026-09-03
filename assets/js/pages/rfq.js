/*
==========================================================
SOUVIKS — RFQ SUBMISSION
Public RFQ Page
==========================================================
*/


document.addEventListener(
    "DOMContentLoaded",
    () => {


        /*
        --------------------------------------------------
        INITIAL SETUP
        --------------------------------------------------
        */

        const formLoadTime =
            Date.now();


        /*
        --------------------------------------------------
        EMAILJS
        --------------------------------------------------
        */

        if (
            typeof emailjs ===
            "undefined"
        ) {

            console.error(
                "[Souviks RFQ] EmailJS is unavailable."
            );

            return;

        }


        emailjs.init(
            "HYXrRpK5XSEAGf5s2"
        );


        /*
        --------------------------------------------------
        FORM
        --------------------------------------------------
        */

        const form =
            document.getElementById(
                "rfq-form"
            );


        if (!form) {

            return;

        }


        /*
        --------------------------------------------------
        SUBMIT BUTTON
        --------------------------------------------------
        */

        const submitButton =
            form.querySelector(
                'button[type="submit"]'
            );


        /*
        --------------------------------------------------
        SUBMISSION STATE
        --------------------------------------------------
        */

        let isSubmitting =
            false;


        /*
        --------------------------------------------------
        FORM SUBMISSION
        --------------------------------------------------
        */

        form.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();


                /*
                ------------------------------------------
                PREVENT DUPLICATE SUBMISSIONS
                ------------------------------------------
                */

                if (isSubmitting) {

                    return;

                }


                /*
                ------------------------------------------
                BASIC ANTI-BOT DELAY
                ------------------------------------------
                */

                const secondsOnPage =
                    (
                        Date.now() -
                        formLoadTime
                    ) / 1000;


                if (
                    secondsOnPage <
                    3
                ) {

                    console.warn(
                        "[Souviks RFQ] Submission blocked: form completed too quickly."
                    );

                    return;

                }


                /*
                ------------------------------------------
                HONEYPOT
                ------------------------------------------
                */

                const honeypot =
                    document.getElementById(
                        "website"
                    );


                if (
                    honeypot &&
                    honeypot.value.trim() !==
                    ""
                ) {

                    console.warn(
                        "[Souviks RFQ] Honeypot submission blocked."
                    );

                    return;

                }


                /*
                ------------------------------------------
                CHECK RFQ ENGINE
                ------------------------------------------
                */

                if (
                    typeof RFQ ===
                    "undefined"
                ) {

                    console.error(
                        "[Souviks RFQ] RFQ engine unavailable."
                    );

                    alert(
                        "Unable to load your RFQ. Please refresh the page and try again."
                    );

                    return;

                }


                /*
                ------------------------------------------
                LOAD RFQ ITEMS
                ------------------------------------------
                */

                let items;


                try {

                    items =
                        await RFQ.get();

                } catch (error) {

                    console.error(
                        "[Souviks RFQ] Unable to load RFQ items:",
                        error
                    );

                    alert(
                        "Unable to load your RFQ. Please try again."
                    );

                    return;

                }


                /*
                ------------------------------------------
                EMPTY RFQ
                ------------------------------------------
                */

                if (
                    !items ||
                    !items.length
                ) {

                    alert(
                        "Please add at least one item to your RFQ."
                    );

                    return;

                }


                /*
                ------------------------------------------
                GENERATE REFERENCE
                ------------------------------------------
                
                This remains compatible with the
                existing EmailJS workflow.
                
                The permanent database RFQ number will
                be handled separately when we implement
                the shared submission layer.
                
                ------------------------------------------
                */

                const leadId =
                    "RFQ-" +
                    Date.now();


                /*
                ------------------------------------------
                FORMAT RFQ ITEMS
                ------------------------------------------
                */

                const rfqItems =
                    items.map(

                        item =>

`Part Number: ${item.partNumber}
Product: ${item.name}
Brand: ${item.brand}
Quantity: ${item.qty}

--------------------------------`

                    ).join(
                        "\n"
                    );


                /*
                ------------------------------------------
                COLLECT CUSTOMER DATA
                ------------------------------------------
                */

                const payload = {

                    lead_id:
                        leadId,

                    name:
                        form.querySelector(
                            '[name="name"]'
                        )?.value.trim() ||
                        "",

                    company:
                        form.querySelector(
                            '[name="company"]'
                        )?.value.trim() ||
                        "",

                    phone:
                        form.querySelector(
                            '[name="phone"]'
                        )?.value.trim() ||
                        "",

                    email:
                        form.querySelector(
                            '[name="email"]'
                        )?.value.trim() ||
                        "",

                    gst:
                        form.querySelector(
                            '[name="gst"]'
                        )?.value.trim() ||
                        "",

                    message:
                        form.querySelector(
                            '[name="message"]'
                        )?.value.trim() ||
                        "",

                    rfq_items:
                        rfqItems

                };


                /*
                ------------------------------------------
                BASIC CLIENT VALIDATION
                ------------------------------------------
                */

                if (
                    !payload.name
                ) {

                    alert(
                        "Please enter your name."
                    );

                    return;

                }


                if (
                    !payload.phone
                ) {

                    alert(
                        "Please enter your phone number."
                    );

                    return;

                }


                /*
                ------------------------------------------
                START SUBMISSION
                ------------------------------------------
                */

                isSubmitting =
                    true;


                if (submitButton) {

                    submitButton.disabled =
                        true;

                }


                try {

                    /*
                    --------------------------------------
                    EMAILJS
                    --------------------------------------
                    */

                    await emailjs.send(

                        "service_trsy6ll",

                        "template_udttxcf",

                        payload

                    );


                    /*
                    --------------------------------------
                    SUCCESS
                    --------------------------------------
                    */

                    showRFQSuccess(
                        leadId,
                        payload
                    );


                    /*
                    --------------------------------------
                    CLEAR SUPABASE RFQ BASKET
                    --------------------------------------
                    
                    RFQ.save([]) belonged to the
                    previous localStorage implementation.
                    
                    The current RFQ basket is stored in
                    Supabase, so use RFQ.clear() when
                    available.
                    
                    --------------------------------------
                    */

                    if (
                        typeof RFQ.clear ===
                        "function"
                    ) {

                        await RFQ.clear();

                    }


                    /*
                    --------------------------------------
                    REFRESH RFQ UI
                    --------------------------------------
                    */

                    if (
                        typeof RFQ.updateBadge ===
                        "function"
                    ) {

                        await RFQ.updateBadge();

                    }


                    if (
                        typeof RFQ.renderPage ===
                        "function"
                    ) {

                        await RFQ.renderPage();

                    }


                    /*
                    --------------------------------------
                    RESET FORM
                    --------------------------------------
                    */

                    form.reset();


                } catch (error) {

                    console.error(
                        "[Souviks RFQ] Submission failed:",
                        error
                    );


                    alert(
                        "Unable to submit RFQ. Please try again."
                    );


                } finally {

                    isSubmitting =
                        false;


                    if (submitButton) {

                        submitButton.disabled =
                            false;

                    }

                }

            }
        );

    }
);


/*
==========================================================
RFQ SUCCESS MODAL
==========================================================
*/


function showRFQSuccess(
    leadId,
    payload
) {


    /*
    ------------------------------------------------------
    WHATSAPP MESSAGE
    ------------------------------------------------------
    */

    const whatsappMessage =

`RFQ Reference: ${leadId}

Name: ${payload.name}
Company: ${payload.company}
Phone: ${payload.phone}
Email: ${payload.email}

Notes:
${payload.message}

RFQ Submitted Via Website`;


    /*
    ------------------------------------------------------
    WHATSAPP URL
    ------------------------------------------------------
    */

    const whatsappUrl =
        `https://wa.me/917908215701?text=${encodeURIComponent(
            whatsappMessage
        )}`;


    /*
    ------------------------------------------------------
    QR CODE
    ------------------------------------------------------
    */

    const qrUrl =
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            whatsappUrl
        )}`;


    /*
    ------------------------------------------------------
    CREATE MODAL
    ------------------------------------------------------
    */

    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "lead-success-modal";


    modal.innerHTML = `

        <div class="lead-success-content">

            <h2>
                RFQ Submitted Successfully
            </h2>

            <p>
                Reference Number
            </p>

            <h3>
                ${leadId}
            </h3>

            <p>
                Your quotation request has been received.
            </p>

            <img
                src="${qrUrl}"
                alt="WhatsApp QR"
                style="
                    max-width:250px;
                    margin:20px auto;
                    display:block;
                "
            >

            <div
                style="
                    display:flex;
                    gap:12px;
                    justify-content:center;
                    margin-top:20px;
                "
            >

                <a
                    href="${whatsappUrl}"
                    target="_blank"
                    rel="noopener"
                    class="btn btn-primary"
                >

                    Open WhatsApp

                </a>


                <button
                    type="button"
                    id="closeRFQModal"
                    class="btn btn-secondary"
                >

                    Close

                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    /*
    ------------------------------------------------------
    CLOSE MODAL
    ------------------------------------------------------
    */

    const closeButton =
        document.getElementById(
            "closeRFQModal"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                modal.remove();

            }
        );

    }

}