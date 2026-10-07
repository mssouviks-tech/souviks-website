/* Shared core is loaded by the HTML page before this bundle. */

/* ===== pages/contact.js ===== */
/*
==========================================================
SOUVIKS CONTACT FORM
==========================================================
*/

document.addEventListener(

    "DOMContentLoaded",

    () => {

const formLoadTime =
    Date.now();

        emailjs.init(
            "HYXrRpK5XSEAGf5s2"
        );

        const form =

            document.getElementById(
                "contactForm"
            );

        if (!form) {

            return;

        }

        form.addEventListener(

            "submit",

            async event => {

                event.preventDefault();

const secondsOnPage =
    (Date.now() - formLoadTime) / 1000;

if (secondsOnPage < 3) {

    console.warn(
        "Submission blocked: too fast."
    );

    return;

}

                const leadId =

                    "ENQ-" +

                    Date.now();

                const payload = {

                    lead_id:
                        leadId,

                    name:
                        document.getElementById(
                            "contactName"
                        ).value,

                    phone:
                        document.getElementById(
                            "contactPhone"
                        ).value,

                    email:
                        document.getElementById(
                            "contactEmail"
                        ).value,

                    vehicle:
                        document.getElementById(
                            "contactVehicle"
                        ).value,

                    message:
                        document.getElementById(
                            "contactMessage"
                        ).value

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

                        "template_gpvlrc8",

                        payload

                    );

                    showContactSuccess(
                        leadId,
                        payload
                    );

                    form.reset();

                }

                catch(error) {

                    console.error(
                        error
                    );

                    alert(
                        "Unable to submit inquiry."
                    );

                }

            }

        );

    }

);

function showContactSuccess(
    leadId,
    payload
){

    const whatsappMessage =

`Lead ID: ${leadId}

Name: ${payload.name}
Phone: ${payload.phone}
Email: ${payload.email}
Vehicle: ${payload.vehicle}

Message:
${payload.message}`;

    const whatsappUrl =
        `https://wa.me/917908215701?text=${encodeURIComponent(
            whatsappMessage
        )}`;

    const qrMessage = `Please help me with enquiry ${leadId}.`;
    const qrWhatsAppUrl =
        `https://wa.me/917908215701?text=${encodeURIComponent(qrMessage)}`;
    const qrUrl =
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            qrWhatsAppUrl
        )}`;

    const modal =
        document.createElement("div");

    modal.className =
        "lead-success-modal";

    modal.innerHTML = `

        <div class="lead-success-content">

            <h2>
                Enquiry Submitted Successfully
            </h2>

            <p>
                Reference Number
            </p>

            <h3>
                ${leadId}
            </h3>

            <p>
                We have received your enquiry.
                For a faster response, you may also share it via WhatsApp.
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
                    id="closeContactModal"
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
            "closeContactModal"
        )
        .addEventListener(
            "click",
            () => modal.remove()
        );
}
