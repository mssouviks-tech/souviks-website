/*
==========================================================
SOUVIKS CONTACT FORM
==========================================================
*/

document.addEventListener(

    "DOMContentLoaded",

    () => {

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

                const leadId =

                    "CT-" +

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

                    await emailjs.send(

                        "service_trsy6ll",

                        "template_udttxcf",

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

    const modal = document.createElement(
        "div"
    );

    modal.className =
        "lead-success-modal";

    modal.innerHTML = `

        <div class="lead-success-content">

            <h2>

                Inquiry Submitted

            </h2>

            <p>

                Reference Number

            </p>

            <h3>

                ${leadId}

            </h3>

            <p>

                Our team will contact you shortly.

            </p>

            <button

                class="btn btn-primary"

                id="closeContactModal"

            >

                Close

            </button>

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

            () => {

                modal.remove();

            }

        );

}