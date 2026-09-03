/*
==========================================================
SOUVIKS — ACCOUNT SAVED PRODUCTS
==========================================================
*/


async function refreshAccountSaved() {

    const loading =
        document.getElementById(
            "accountSavedLoading"
        );

    const empty =
        document.getElementById(
            "accountSavedEmpty"
        );

    const list =
        document.getElementById(
            "accountSavedList"
        );


    if (
        !loading ||
        !empty ||
        !list
    ) {

        return;

    }


    loading.hidden =
        false;

    empty.hidden =
        true;

    list.hidden =
        true;

    list.innerHTML =
        "";


    try {

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            throw new Error(
                "Supabase client unavailable."
            );

        }


        const {
            data: userData,
            error: userError
        } =
            await supabaseClient.auth.getUser();


        if (userError) {

            throw userError;

        }


        const user =
            userData?.user;


        if (!user) {

            throw new Error(
                "User is not authenticated."
            );

        }


        const {
            data,
            error
        } =
            await supabaseClient

                .from(
                    "saved_products"
                )

                .select(
                    "product_id, created_at"
                )

                .eq(
                    "user_id",
                    user.id
                )

                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            throw error;

        }


        const savedRows =
            data || [];


        loading.hidden =
            true;


        if (!savedRows.length) {

            empty.hidden =
                false;

            return;

        }


        /*
        --------------------------------------------------
        Resolve saved IDs against existing catalogue.
        --------------------------------------------------
        */

        const savedIds =
            new Set(
                savedRows.map(
                    row =>
                        String(
                            row.product_id
                        )
                )
            );


        const products =
            getAccountSavedProducts();


        const savedProducts =
            products.filter(
                product =>
                    savedIds.has(
                        String(
                            product.id
                        )
                    )
            );


        /*
        --------------------------------------------------
        Handle products that no longer exist.
        --------------------------------------------------
        */

        if (!savedProducts.length) {

            empty.hidden =
                false;

            return;

        }


        list.innerHTML =
            savedProducts
                .map(
                    renderAccountSavedProduct
                )
                .join(
                    ""
                );


        list.hidden =
            false;


        /*
        --------------------------------------------------
        Make sure the current saved state is reflected.
        --------------------------------------------------
        */

        if (
            typeof SavedProducts !==
            "undefined"
        ) {

            SavedProducts.updateButtons();

        }

    }

    catch (error) {

        console.error(
            "[Souviks Account] Failed to load saved products:",
            error
        );


        loading.hidden =
            true;


        empty.hidden =
            false;


        empty.innerHTML = `

            <p>
                Unable to load your saved products.
                Please try again.
            </p>

        `;

    }

}


/*
==========================================================
GET CATALOGUE
==========================================================
*/

function getAccountSavedProducts() {

    /*
    ------------------------------------------------------
    Use the existing Products catalogue.
    ------------------------------------------------------
    */

    if (
        typeof PRODUCTS !==
        "undefined" &&
        Array.isArray(
            PRODUCTS
        )
    ) {

        return PRODUCTS;

    }


    if (
        typeof products !==
        "undefined" &&
        Array.isArray(
            products
        )
    ) {

        return products;

    }


    /*
    ------------------------------------------------------
    Fall back to the existing product state if available.
    ------------------------------------------------------
    */

    if (
        typeof Products !==
        "undefined"
    ) {

        if (
            Array.isArray(
                Products.products
            )
        ) {

            return Products.products;

        }

    }


    console.error(
        "[Souviks Account] Product catalogue unavailable."
    );


    return [];

}


/*
==========================================================
RENDER SAVED PRODUCT
==========================================================
*/

function renderAccountSavedProduct(
    product
) {

    const productId =
        String(
            product.id
        );


    const image =
        product.gallery &&
        product.gallery.length

            ?

        `/assets/images/products/${product.image_folder}/${product.gallery[0]}`

            :

        "/assets/images/placeholder.webp";


    return `

        <article
            class="account-saved-card">

            <a
                href="${Utils.productUrl(product)}"
                class="account-saved-image">

                <img
                    src="${image}"
                    alt="${product.product_name}"
                    loading="lazy">

            </a>


            <div
                class="account-saved-content">

                <div
                    class="account-saved-id">

                    ${product.id}

                </div>


                <h3>

                    <a
                        href="${Utils.productUrl(product)}">

                        ${product.product_name}

                    </a>

                </h3>


                <p
                    class="account-saved-brand">

                    ${product.brand_name || ""}

                </p>


                <div
                    class="account-saved-actions">

                    <a
                        href="${Utils.productUrl(product)}"
                        class="btn btn-primary">

                        View Product

                    </a>


                    <button
                        type="button"
                        class="btn btn-secondary"
                        data-saved-product-id="${productId}">

                        Remove

                    </button>

                </div>

            </div>

        </article>

    `;

}


window.refreshAccountSaved =
    refreshAccountSaved;