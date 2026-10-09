/* Extracted from the former account.js bundle: auth/saved.js */

/*
==========================================================
SOUVIKS — ACCOUNT SAVED PRODUCTS
==========================================================
*/


const AccountSavedState = {
    catalogue: null,
    cataloguePromise: null
};


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
            await getAccountSavedProducts();

        const productById = new Map(
            products.map(product => [String(product.id), product])
        );

        const savedProducts = savedRows
            .map(row => productById.get(String(row.product_id)))
            .filter(Boolean);


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

        SouviksErrors?.log("[Souviks Account] Failed to load saved products:", error, "error");


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

async function getAccountSavedProducts() {
    if (Array.isArray(AccountSavedState.catalogue)) {
        return AccountSavedState.catalogue;
    }

    if (AccountSavedState.cataloguePromise) {
        return AccountSavedState.cataloguePromise;
    }

    AccountSavedState.cataloguePromise = fetch("/assets/data/products.json", {
        credentials: "same-origin",
        cache: "no-store"
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Catalogue request failed (${response.status})`);
            }
            return response.json();
        })
        .then(payload => {
            const products = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.products)
                    ? payload.products
                    : [];
            AccountSavedState.catalogue = products;
            return products;
        })
        .catch(error => {
            AccountSavedState.cataloguePromise = null;
            throw error;
        });

    return AccountSavedState.cataloguePromise;
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
        String(
            product.image_url ||
            ""
        ).trim() ||
        (product.gallery && product.gallery.length
            ? `/assets/images/products/${product.image_folder}/${product.gallery[0]}`
            : product.primary_image && product.image_folder
                ? `/assets/images/products/${product.image_folder}/${product.primary_image}`
                : "/assets/images/placeholder.webp");


    return `

        <article
            class="account-saved-card">

            <a
                href="${Utils.productUrl(product)}"
                class="account-saved-image">

                <img
                    src="${image}"
                    alt="${product.product_name}"
                    ${Utils.responsiveImageAttrs(image, product.gallery_dimensions?.[product.gallery?.[0]], '(max-width: 640px) 92vw, 280px', 'lazy')}
                >

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
                        class="btn btn-secondary">
                        View Product
                    </a>

                    <button
                        type="button"
                        class="btn btn-primary account-saved-add-rfq"
                        data-account-saved-add-rfq="${productId}"
                        data-id="${productId}"
                        data-part="${escapeSavedHTML(product.part_number || product.partNumber || "")}"
                        data-name="${escapeSavedHTML(product.product_name || product.name || "")}"
                        data-brand="${escapeSavedHTML(product.brand_name || product.brand || "")}">
                        Add to RFQ
                    </button>

                    <button
                        type="button"
                        class="btn btn-link account-saved-remove"
                        data-account-saved-remove="${productId}">
                        Remove
                    </button>

                </div>

            </div>

        </article>

    `;

}


function escapeSavedHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


document.addEventListener("click", async event => {

    const addButton = event.target.closest(".account-saved-add-rfq");
    if (addButton) {
        event.preventDefault();
        if (typeof RFQ === "undefined" || addButton.disabled) return;
        addButton.disabled = true;
        try {
            const added = await RFQ.add({
                id: addButton.dataset.id,
                partNumber: addButton.dataset.part || "",
                name: addButton.dataset.name || "",
                brand: addButton.dataset.brand || ""
            });
            if (added) {
                const original = addButton.textContent;
                addButton.textContent = "Added to RFQ";
                window.setTimeout(() => {
                    addButton.textContent = original;
                    addButton.disabled = false;
                }, 1400);
                return;
            }
        } catch (error) {
            SouviksErrors?.log("[Souviks Account] Unable to add saved product to RFQ:", error, "error");
        }
        addButton.disabled = false;
        return;
    }

    const removeButton = event.target.closest(".account-saved-remove");
    if (!removeButton) return;
    event.preventDefault();
    if (removeButton.disabled) return;
    const productId = removeButton.dataset.accountSavedRemove;
    if (!productId) return;
    removeButton.disabled = true;
    try {
        if (typeof SavedProducts !== "undefined") {
            const removed = await SavedProducts.remove(productId);
            if (removed) {
                return;
            }
        }
    } catch (error) {
        SouviksErrors?.log("[Souviks Account] Unable to remove saved product:", error, "error");
    }
    removeButton.disabled = false;
});


window.refreshAccountSaved =
    refreshAccountSaved;
