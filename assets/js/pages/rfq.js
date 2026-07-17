/*
==========================================================
SOUVIKS RFQ SUBMISSION
==========================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

const formLoadTime = Date.now();

        emailjs.init(
            "HYXrRpK5XSEAGf5s2"
        );

        const form =
            document.getElementById(
                "rfq-form"
            );

        if (!form) {
            return;
        }

        form.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

const secondsOnPage =
    (Date.now() - formLoadTime) / 1000;

if (secondsOnPage < 3) {

    console.warn(
        "Submission blocked: too fast."
    );

    return;

}

                const items =
                    RFQ.get();

                if (!items.length) {

                    alert(
                        "Please add at least one item to your RFQ."
                    );

                    return;
                }

                const leadId =
                    "RFQ-" +
                    Date.now();

                const rfqItems =
                    items.map(item =>

`Part Number: ${item.partNumber}
Product: ${item.name}
Brand: ${item.brand}
Quantity: ${item.qty}

--------------------------------`

                    ).join("\n");

                const payload = {

                    lead_id:
                        leadId,

                    name:
                        form.querySelector(
                            '[name="name"]'
                        )?.value || "",

                    company:
                        form.querySelector(
                            '[name="company"]'
                        )?.value || "",

                    phone:
                        form.querySelector(
                            '[name="phone"]'
                        )?.value || "",

                    email:
                        form.querySelector(
                            '[name="email"]'
                        )?.value || "",

                    gst:
                        form.querySelector(
                            '[name="gst"]'
                        )?.value || "",

                    message:
                        form.querySelector(
                            '[name="message"]'
                        )?.value || "",

                    rfq_items:
                        rfqItems

                };

                try {
const honeypot =
    document.getElementById(
        "website"
    );

if (
    honeypot &&
    honeypot.value.trim() !== ""
) {

    return;

}
                    await emailjs.send(
                        "service_trsy6ll",
                        "template_udttxcf",
                        payload
                    );

                    showRFQSuccess(
                        leadId,
                        payload
                    );

                    RFQ.save([]);

                    RFQ.updateBadge();

                    RFQ.renderPage();

                    form.reset();

                }

                catch (error) {

                    console.error(
                        error
                    );

                    alert(
                        "Unable to submit RFQ. Please try again."
                    );

                }

            }
        );

    }
);

function showRFQSuccess(
    leadId,
    payload
) {

    const whatsappMessage =

`RFQ Reference: ${leadId}

Name: ${payload.name}
Company: ${payload.company}
Phone: ${payload.phone}
Email: ${payload.email}

Notes:
${payload.message}

RFQ Submitted Via Website`;

    const whatsappUrl =
        `https://wa.me/917908215701?text=${encodeURIComponent(
            whatsappMessage
        )}`;

    const qrUrl =
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            whatsappUrl
        )}`;

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
                    class="btn btn-primary"
                >
                    Open WhatsApp
                </a>

                <button
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

    document
        .getElementById(
            "closeRFQModal"
        )
        .addEventListener(
            "click",
            () => {
                modal.remove();
            }
        );
}