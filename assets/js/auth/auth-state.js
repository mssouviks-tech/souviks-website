/* ==========================================================
   SOUVIKS — GLOBAL AUTH STATE
   Top-bar authentication control
   ========================================================== */

document.addEventListener("DOMContentLoaded", async () => {

    /*
    ----------------------------------------------------------
    ELEMENTS
    ----------------------------------------------------------
    */

    const topSignIn =
        document.getElementById("topSignIn");

    const topUserMenu =
        document.getElementById("topUserMenu");

    const topUserButton =
        document.getElementById("topUserButton");

    const topUserName =
        document.getElementById("topUserName");

    const topUserDropdown =
        document.getElementById("topUserDropdown");


    /*
    ----------------------------------------------------------
    SUPABASE CHECK
    ----------------------------------------------------------
    */

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        console.error(
            "[Souviks Auth] Supabase client unavailable."
        );

        return;
    }


    /*
    ----------------------------------------------------------
    HELPERS
    ----------------------------------------------------------
    */

    function setHidden(element, hidden) {

        if (!element) {
            return;
        }

        element.hidden = hidden;

    }



/* ----------------------------------------------------------
   COMPACT ACCOUNT AVATAR HELPERS
   ---------------------------------------------------------- */

function getAccountInitial(fullName, user) {

    const preferredName =
        String(fullName || "").trim();

    const metadataName =
        String(
            user?.user_metadata?.full_name ||
            ""
        ).trim();

    const emailName =
        String(
            user?.email ||
            ""
        ).trim()
        .split("@")[0]
        .replace(/[^A-Za-z0-9]/g, " ")
        .trim();

    const source =
        preferredName &&
        preferredName.toLowerCase() !== "account"

            ? preferredName

            : (
                metadataName ||
                emailName ||
                "A"
            );

    return (
        source
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "A"
    );

}



function ensureUserDropdownProfile(fullName, user) {

    if (!topUserDropdown) {
        return;
    }

    let profile =
        topUserDropdown.querySelector(
            ".top-user-profile"
        );

    if (!profile) {

        profile =
            document.createElement(
                "div"
            );

        profile.className =
            "top-user-profile";

        profile.innerHTML = `
            <div class="top-user-profile-avatar" aria-hidden="true"></div>
            <div class="top-user-profile-copy">
                <div class="top-user-profile-name"></div>
                <div class="top-user-profile-email"></div>
            </div>
        `;

        topUserDropdown.prepend(
            profile
        );

    }

    const avatar =
        profile.querySelector(
            ".top-user-profile-avatar"
        );

    const name =
        profile.querySelector(
            ".top-user-profile-name"
        );

    const email =
        profile.querySelector(
            ".top-user-profile-email"
        );

    const initial =
        getAccountInitial(
            fullName,
            user
        );

    if (avatar) {
        avatar.textContent =
            initial;
    }

    if (name) {
        name.textContent =
            fullName;
    }

    if (email) {
        email.textContent =
            user?.email ||
            "";
    }

}


function setAnonymousAccountIcon() {

    if (!topSignIn) {
        return;
    }

    topSignIn.innerHTML = `
        <span
            class="top-auth-avatar top-auth-avatar-anonymous"
            aria-hidden="true">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <circle
                    cx="12"
                    cy="8"
                    r="3.25"
                    stroke="currentColor"
                    stroke-width="1.8"/>
                <path
                    d="M5.5 20c.65-3.35 2.85-5.4 6.5-5.4s5.85 2.05 6.5 5.4"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"/>
            </svg>
        </span>
        <span class="sr-only">Sign In</span>
    `;

    topSignIn.setAttribute(
        "aria-label",
        "Sign In"
    );

    topSignIn.title =
        "Sign In";

}


function setAccountAvatar(fullName, user) {

    if (!topUserButton || !topUserName) {
        return;
    }

    const initial =
        getAccountInitial(
            fullName,
            user
        );

    topUserName.className =
        "top-user-avatar";

    topUserName.innerHTML = `
        <span aria-hidden="true">
            ${initial}
        </span>
    `;

    topUserButton.setAttribute(
        "aria-label",
        `Account: ${fullName}`
    );

    topUserButton.title =
        fullName;

}


    function closeDropdown() {

        if (!topUserDropdown) {
            return;
        }

        topUserDropdown.hidden = true;

        if (topUserButton) {

            topUserButton.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    }


    function openDropdown() {

        if (!topUserDropdown) {
            return;
        }

        topUserDropdown.hidden = false;

        if (topUserButton) {

            topUserButton.setAttribute(
                "aria-expanded",
                "true"
            );

        }

    }


    /*
    ----------------------------------------------------------
    USER MENU TOGGLE
    ----------------------------------------------------------
    */

    if (
        topUserButton &&
        topUserDropdown
    ) {

        topUserButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                const isOpen =
                    topUserButton.getAttribute(
                        "aria-expanded"
                    ) === "true";

                if (isOpen) {

                    closeDropdown();

                } else {

                    openDropdown();

                }

            }
        );

    }


    /*
    ----------------------------------------------------------
    CLOSE WHEN CLICKING OUTSIDE
    ----------------------------------------------------------
    */

    document.addEventListener(
        "click",
        (event) => {

            if (
                !topUserMenu ||
                !topUserMenu.contains(event.target)
            ) {

                closeDropdown();

            }

        }
    );


    /*
    ----------------------------------------------------------
    ESCAPE KEY
    ----------------------------------------------------------
    */

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {

                closeDropdown();

            }

        }
    );


    /*
    ----------------------------------------------------------
    APPLY AUTH STATE
    ----------------------------------------------------------
    */

    async function applyAuthState(session) {

        /*
        ----------------------------------------------
        LOGGED OUT
        ----------------------------------------------
        */

        if (!session || !session.user) {

            setAnonymousAccountIcon();

            setHidden(
                topSignIn,
                false
            );

            setHidden(
                topUserMenu,
                true
            );

            closeDropdown();

            return;
        }


        /*
        ----------------------------------------------
        LOGGED IN
        ----------------------------------------------
        */

        const user =
            session.user;

        let fullName = "";


        /*
        ----------------------------------------------
        LOAD PROFILE NAME
        ----------------------------------------------
        */

        try {

            const {
                data: profile,
                error
            } =
                await supabaseClient
                    .from("profiles")
                    .select("full_name")
                    .eq("id", user.id)
                    .single();

            if (!error && profile) {

                fullName =
                    profile.full_name || "";

            }

        } catch (error) {

            console.error(
                "[Souviks Auth] Unable to load profile name:",
                error
            );

        }


        /*
        ----------------------------------------------
        FALLBACK TO AUTH METADATA
        ----------------------------------------------
        */

        if (!fullName) {

            fullName =
                user.user_metadata?.full_name ||
                "";

        }


        /*
        ----------------------------------------------
        FINAL FALLBACK
        ----------------------------------------------
        */

        if (!fullName) {

            fullName =
                "Account";

        }


        /*
        ----------------------------------------------
        UPDATE TOP BAR
        ----------------------------------------------
        */

        setAccountAvatar(
            fullName,
            user
        );

        ensureUserDropdownProfile(
            fullName,
            user
        );

        setHidden(
            topSignIn,
            true
        );

        setHidden(
            topUserMenu,
            false
        );

        closeDropdown();

    }


    /*
    ----------------------------------------------------------
    INITIAL SESSION
    ----------------------------------------------------------
    */

    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();

        if (error) {

            console.error(
                "[Souviks Auth] Unable to retrieve session:",
                error
            );

            return;

        }

        await applyAuthState(
            data.session
        );

    } catch (error) {

        console.error(
            "[Souviks Auth] Unexpected auth-state error:",
            error
        );

    }


    /*
    ----------------------------------------------------------
    AUTH STATE CHANGES
    ----------------------------------------------------------
    */

/*
----------------------------------------------------------
AUTH STATE CHANGES
----------------------------------------------------------
*/

supabaseClient.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        console.log(
            "[Souviks Auth] Auth event:",
            event
        );

        /*
        * Do not perform Supabase operations directly
        * inside the auth-state callback.
        */

        setTimeout(
            async () => {

                await applyAuthState(
                    session
                );

            },
            0
        );

    }
);

});