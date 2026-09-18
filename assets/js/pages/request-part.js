/*
==========================================================
SOUVIKS REQUEST PART
EMAILJS + WHATSAPP QR
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
                "requestPartForm"
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
                            "name"
                        )?.value || "",

                    company:
                        document.getElementById(
                            "company"
                        )?.value || "",

                    phone:
                        document.getElementById(
                            "phone"
                        )?.value || "",

                    email:
                        document.getElementById(
                            "email"
                        )?.value || "",

                    vehicle:
                        document.getElementById(
                            "vehicle"
                        )?.value || "",

                    urgency:
                        document.getElementById(
                            "urgency"
                        )?.value || "",

                    partnumber:
                        document.getElementById(
                            "partnumber"
                        )?.value || "",

                    requirement:
                        document.getElementById(
                            "requirement"
                        )?.value || ""

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

                    showLeadSuccess(
                        leadId,
                        payload
                    );

                    form.reset();

                }

                catch (error) {

                    console.error(
                        error
                    );

                    alert(

                        "Unable to submit request. Please try again."

                    );

                }

            }

        );

    }

);

function showLeadSuccess(

    leadId,

    payload

) {

    const whatsappMessage =

`Lead ID: ${leadId}

Name: ${payload.name}
Company: ${payload.company}
Phone: ${payload.phone}
Email: ${payload.email}

Vehicle: ${payload.vehicle}
Urgency: ${payload.urgency}

Part Number:
${payload.partnumber}

Requirement:
${payload.requirement}`;

    const whatsappUrl =

        `https://wa.me/917908215701?text=${encodeURIComponent(
            whatsappMessage
        )}`;

    const qrUrl =

        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            whatsappUrl
        )}`;

    const modal = document.createElement(

        "div"

    );

    modal.className =

        "lead-success-modal";

    modal.innerHTML = `

        <div class="lead-success-content">

<h2>
    Request Submitted Successfully
</h2>

<p>
    Your reference number:
</p>

<h3>
    ${leadId}
</h3>

<p>
    We have received your enquiry by email.
    For a faster response, you may also share it on WhatsApp using the QR code below.
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

                    class="btn btn-secondary"

                    id="closeLeadModal"

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
            "closeLeadModal"
        )
        .addEventListener(

            "click",

            () => {

                modal.remove();

            }

        );

}