/* Extracted from the former account.js bundle: rfq-submit.js */

/*
==========================================================
SOUVIKS — AUTHENTICATED RFQ SUBMISSION
==========================================================

Purpose:
    Submit an authenticated user's RFQ.

Used by:
    Account → RFQ

This module does NOT:
    - render the RFQ UI
    - manage the RFQ basket
    - handle anonymous RFQs
    - handle Account section navigation

Dependencies:
    - supabaseClient
    - RFQ
    - EmailJS
==========================================================
*/


window.RFQSubmission = {


    /*
    ======================================================
    EMAILJS CONFIGURATION
    ======================================================
    */

    emailService:
        "service_trsy6ll",

    emailTemplate:
        "template_udttxcf",

    emailPublicKey:
        "HYXrRpK5XSEAGf5s2",


    /*
    ======================================================
    INITIALIZE EMAILJS
    ======================================================
    */

    initializeEmailJS() {

        if (
            typeof emailjs ===
            "undefined"
        ) {

            console.error(
                "[Souviks RFQ] EmailJS is unavailable."
            );

            return false;

        }


        try {

            emailjs.init(
                this.emailPublicKey
            );


            return true;


        } catch (error) {

            SouviksErrors?.log("[Souviks RFQ] Unable to initialize EmailJS:", error, "error");

            return false;

        }

    },


    /*
    ======================================================
    GET AUTHENTICATED USER
    ======================================================
    */

    async getUser() {

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            throw new Error(
                "Supabase client is unavailable."
            );

        }


        const {
            data,
            error
        } =
            await supabaseClient.auth.getUser();


        if (error) {

            throw error;

        }


        if (
            !data ||
            !data.user
        ) {

            throw new Error(
                "No authenticated user found."
            );

        }


        return data.user;

    },


    /*
    ======================================================
    GET USER PROFILE
    ======================================================
    */

    async getProfile(
        userId
    ) {

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
                    userId
                )

                .maybeSingle();


        if (error) {

            throw error;

        }


        if (!data) {

            throw new Error(
                "Your account profile could not be found."
            );

        }


        return data;

    },


    /*
    ======================================================
    VALIDATE PROFILE
    ======================================================
    */

    validateProfile(
        profile,
        user
    ) {

        const name =
            (
                profile.full_name ||
                ""
            ).trim();


        const phone =
            (
                profile.phone ||
                ""
            ).trim();


        const email =
            (
                user.email ||
                ""
            ).trim();


        if (!name) {

            throw new Error(
                "Your account profile does not contain your full name."
            );

        }


        if (!phone) {

            throw new Error(
                "Your account profile does not contain your phone number."
            );

        }


        if (!email) {

            throw new Error(
                "Your account does not contain an email address."
            );

        }


        return true;

    },


    /*
    ======================================================
    GET CURRENT RFQ ITEMS
    ======================================================
    */

    async getItems() {

        if (
            typeof RFQ ===
            "undefined"
        ) {

            throw new Error(
                "RFQ basket engine is unavailable."
            );

        }


        const items =
            await RFQ.get();


        if (
            !Array.isArray(
                items
            ) ||
            !items.length
        ) {

            throw new Error(
                "Your RFQ basket is empty."
            );

        }


        return items;

    },


    /*
    ======================================================
    FORMAT RFQ ITEMS FOR EMAIL
    ======================================================
    */

    formatEmailItems(
        items
    ) {

        return items.map(

            item =>

`Part Number: ${item.partNumber}
Product: ${item.name}
Brand: ${item.brand}
Quantity: ${item.qty}

--------------------------------`

        ).join(
            "\n"
        );

    },


    /*
    ======================================================
    FORMAT RFQ NUMBER
    ======================================================

    Database:
        1

    Customer-facing:
        RFQ000001
    ======================================================
    */

    formatReference(
        number
    ) {

        return (
            "RFQ" +
            String(
                number
            ).padStart(
                6,
                "0"
            )
        );

    },


    /*
    ======================================================
    CREATE RFQ
    ======================================================
    */

    async createRFQ(
        user,
        profile,
        items,
        message = ""
    ) {
        if (typeof RFQ === "undefined" || typeof supabaseClient === "undefined") {
            throw new Error("RFQ submission services are unavailable.");
        }

        const normalizedItems = items
            .map(item => RFQ.normalizeItem(item))
            .filter(Boolean);
        if (!normalizedItems.length || normalizedItems.length !== items.length) {
            throw new Error("One or more RFQ items are invalid.");
        }
        if (normalizedItems.length > RFQ.MAX_ITEMS) {
            throw new Error(
                "Your RFQ contains too many items. Please submit no more than " +
                RFQ.MAX_ITEMS +
                " items at a time."
            );
        }

        const { data: databaseResult, error } = await supabaseClient.rpc("submit_rfq", {
            p_customer_name: RFQ.normalizeText(profile.full_name, 120),
            p_customer_phone: RFQ.normalizeText(profile.phone, 40),
            p_company: RFQ.normalizeText(profile.company, 160) || null,
            p_gst_number: RFQ.normalizeText(profile.gst_number, 15).toUpperCase() || null,
            p_message: RFQ.normalizeText(message, 2000) || null,
            p_items: normalizedItems.map(item => ({
                id: item.id,
                partNumber: item.partNumber,
                name: item.name,
                brand: item.brand,
                quantity: RFQ.normalizeQuantity(item.qty)
            }))
        });

        if (error || !databaseResult?.rfq_number) {
            SouviksErrors?.log("[Souviks RFQ] Atomic account RFQ creation failed:", error, "error");
            throw error || new Error("The RFQ could not be created.");
        }

        return {
            id: databaseResult.id,
            rfq_number: databaseResult.rfq_number,
            user_id: user.id,
            item_count: databaseResult.item_count
        };
    },


    async sendEmail(
        reference,
        user,
        profile,
        items,
        message
    ) {

        const initialized =
            this.initializeEmailJS();


        if (!initialized) {

            throw new Error(
                "Email notification service is unavailable."
            );

        }


        const rfqItems =
            this.formatEmailItems(
                items
            );


        const payload = {

            lead_id:
                reference,

            name:
                profile.full_name
                    ?.trim() ||
                "",

            company:
                profile.company
                    ?.trim() ||
                "",

            phone:
                profile.phone
                    ?.trim() ||
                "",

            email:
                user.email
                    ?.trim() ||
                "",

            gst:
                profile.gst_number
                    ?.trim() ||
                "",

            message:
                (
                    message ||
                    ""
                ).trim(),

            rfq_items:
                rfqItems

        };


        await emailjs.send(

            this.emailService,

            this.emailTemplate,

            payload

        );


        return payload;

    },


    /*
    ======================================================
    CLEAR USER RFQ BASKET
    ======================================================
    */

    async clearBasket() {

        if (
            typeof RFQ ===
            "undefined"
        ) {

            throw new Error(
                "RFQ basket engine is unavailable."
            );

        }


        const cleared =
            await RFQ.clear();


        if (!cleared) {

            throw new Error(
                "The RFQ basket could not be cleared."
            );

        }


        return true;

    },


    /*
    ======================================================
    SUBMIT
    ======================================================

    Options:

        {
            message: "Optional customer message"
        }

    Returns:

        {
            rfq,
            items,
            reference,
            emailPayload
        }
    ======================================================
    */

    async submit(
        options = {}
    ) {

        /*
        --------------------------------------------------
        VALIDATE SUPABASE
        --------------------------------------------------
        */

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            throw new Error(
                "Supabase client is unavailable."
            );

        }


        /*
        --------------------------------------------------
        AUTHENTICATED USER
        --------------------------------------------------
        */

        const user =
            await this.getUser();


        /*
        --------------------------------------------------
        PROFILE
        --------------------------------------------------
        */

        const profile =
            await this.getProfile(
                user.id
            );


        this.validateProfile(
            profile,
            user
        );


        /*
        --------------------------------------------------
        RFQ BASKET
        --------------------------------------------------
        */

        const items =
            await this.getItems();


        /*
        --------------------------------------------------
        CUSTOMER MESSAGE
        --------------------------------------------------
        */

        const message =
            (
                options.message ||
                ""
            ).trim();


        /*
        --------------------------------------------------
        CREATE RFQ
        --------------------------------------------------
        */

        const rfq =
            await this.createRFQ(

                user,

                profile,

                items,

                message

            );


        /*
        --------------------------------------------------
        CUSTOMER-FACING REFERENCE
        --------------------------------------------------
        */

        const reference =
            this.formatReference(
                rfq.rfq_number
            );


        // submit_rfq atomically creates the RFQ and all of its items.
        const createdItems = items;

        /*
        --------------------------------------------------
        SEND EMAIL
        --------------------------------------------------
        */

        window.souviksAnalytics?.trackLead("rfq_account");

        let emailPayload;


        try {

            emailPayload =
                await this.sendEmail(

                    reference,

                    user,

                    profile,

                    items,

                    message

                );


        } catch (error) {

            SouviksErrors?.log("[Souviks RFQ] Email notification failed:", error, "error");


            /*
            --------------------------------------------------
            IMPORTANT

            The RFQ already exists in Supabase.

            Do NOT clear the basket here.

            This prevents the customer from losing their
            RFQ basket if the notification service fails.
            --------------------------------------------------
            */

            throw new Error(
                "Your RFQ was recorded successfully as " +
                reference +
                ", but the notification could not be sent. Please contact Souviks with this reference."
            );

        }


        /*
        --------------------------------------------------
        CLEAR BASKET
        --------------------------------------------------
        */

        try {

            await this.clearBasket();


        } catch (error) {

            SouviksErrors?.log("[Souviks RFQ] Basket clearing failed:", error, "error");


            /*
            --------------------------------------------------
            The RFQ itself was successful.

            We don't turn a successful submission into
            a failure merely because the basket cleanup
            failed.
            --------------------------------------------------
            */

        }


        /*
        --------------------------------------------------
        RETURN RESULT
        --------------------------------------------------
        */

        return {

            rfq,

            items:
                createdItems,

            reference,

            emailPayload

        };

    }

};
