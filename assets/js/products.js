/*
==========================================================
SOUVIKS WEBSITE
PRODUCTS MODULE
Version : 1.0
==========================================================
*/

class ProductManager {

constructor() {

    this.products = [];
    this.filtered = [];

    this.container = null;

    this.currentPage = 1;

    this.pageSize = 12;

}
    // ======================================================
    // INIT
    // ======================================================

    async init(

        selector = "#product-grid"

    ) {

        this.container = Utils.el(

            selector

        );

        if (!this.container) {

            return;

        }

        this.products = await API.products();

        this.filtered = [

            ...this.products

        ];

        this.render();

    }

    // ======================================================
    // PRODUCT CARD
    // ======================================================

   card(product) {

    const cardImage =

        product.gallery &&
        product.gallery.length

        ?

        `/assets/images/products/${product.image_folder}/${product.gallery[0]}`

        :

        '/assets/images/placeholder.webp';

    return `

    <article class="product-card">

        <a href="${Utils.productUrl(product)}">

            <div class="product-image">

                <img
                    src="${cardImage}"
                    alt="${product.product_name}"
                    loading="lazy"
                >

            </div>

            <div class="product-content">

                <div class="product-id">

                    ${product.id}

                </div>

                <h3 class="product-title">

                    ${product.product_name}

                </h3>

                <div class="product-brand">

                    ${product.brand_name || ''}

                </div>

            </div>

        </a>

    </article>

    `;
}

    // ======================================================
    // RENDER GRID
    // ======================================================

render() {

    if (!this.container) {

        return;

    }

    if (

        !this.filtered ||

        this.filtered.length === 0

    ) {

        this.container.innerHTML =

            Utils.emptyState(

                "No products found."

            );

        return;

    }

    const start =

        (this.currentPage - 1) *

        this.pageSize;

    const end =

        start +

        this.pageSize;

    const pageProducts =

        this.filtered.slice(

            start,

            end

        );

    this.container.innerHTML =

        pageProducts

            .map(

                product =>

                    this.card(product)

            )

            .join("");

    this.updateResults();

    this.renderPagination();

}

updateResults() {

document.getElementById(
    "totalProducts"
).textContent =
    this.products.length;
visibleProducts.textContent =
    this.filtered.length;

    const visible =
        document.getElementById(
            "visibleProducts"
        );

    if (visible) {

        visible.textContent =
            this.filtered.length;

    }

    const start =
        document.getElementById(
            "currentResultStart"
        );

    const end =
        document.getElementById(
            "currentResultEnd"
        );

    const total =
        document.getElementById(
            "totalResults"
        );

    if (start) {

        start.textContent =
            ((this.currentPage - 1)
            * this.pageSize) + 1;

    }

    if (end) {

        end.textContent =
            Math.min(
                this.currentPage *
                this.pageSize,
                this.filtered.length
            );

    }

    if (total) {

        total.textContent =
            this.filtered.length;

    }

}

    // ======================================================
    // PAGINATION
    // ======================================================

renderPagination() {

    const container =

        document.getElementById(

            "pagination"

        );

    if (!container) {

        return;

    }

    const pages = Math.ceil(

        this.filtered.length /

        this.pageSize

    );

    let html = "";

    for (

        let i = 1;

        i <= pages;

        i++

    ) {

        html += `

        <button

            class="pagination-page ${

                i === this.currentPage

                    ? "active"

                    : ""

            }"

            data-page="${i}">

            ${i}

        </button>

        `;

    }

    container.innerHTML = html;

    container

        .querySelectorAll(

            "[data-page]"

        )

        .forEach(

            button => {

                button.addEventListener(

                    "click",

                    () => {

                        this.currentPage =

                            Number(

                                button.dataset.page

                            );

                        this.render();

                    }

                );

            }

        );

}

    // ======================================================
    // FILTER BRAND
    // ======================================================

    filterBrand(

        brandId

    ) {

        if (!brandId) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;

            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.brand_id ===

                    brandId

            );

        this.render();

    }

    // ======================================================
    // FILTER CATEGORY
    // ======================================================

    filterCategory(

        categoryId

    ) {

        if (!categoryId) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;
            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.category_id ===

                    categoryId

            );

        this.render();

    }

    // ======================================================
    // FILTER VEHICLE
    // ======================================================

    filterVehicle(

        vehicleName

    ) {

        if (!vehicleName) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;
            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.vehicles.includes(

                        vehicleName

                    )

            );

        this.render();

    }

    // ======================================================
    // FEATURED
    // ======================================================

    featured(

        count = 8

    ) {

        return this.products

            .filter(

                item =>

                    item.featured === true

            )

            .slice(

                0,

                count

            );

    }

    // ======================================================
    // RELATED PRODUCTS
    // ======================================================

related(product, limit = 5) {

    return this.products

        .filter(item => {

            if(item.id === product.id)
                return false;

            return true;

        })

        .map(item => {

            let score = 0;

            const currentVehicles =
                product.vehicles || [];

            const itemVehicles =
                item.vehicles || [];

const sharedVehicle =
    currentVehicles.some(
        v => itemVehicles.includes(v)
    );

if(
    item.subcategory_id ===
    product.subcategory_id
){
    score += 500;
}
else if(
    item.category_id ===
    product.category_id
){
    score += 300;
}
else if(
    sharedVehicle
){
    score += 150;
}

if(
    item.brand_id ===
    product.brand_id
){
    score += 20;
}

            return {
                item,
                score
            };

        })

        .sort(
            (a,b) =>
            b.score - a.score
        )

        .slice(0, limit)

        .map(
            result =>
            result.item
        );

}

    // ======================================================
    // PRODUCT DETAIL
    // ======================================================

async hydrateProductPage() {

    const slug = Utils.currentSlug();

const product =
    await API.productBySlug(slug);

if (!product) return;

const brand =
    await API.brandById(
        product.brand_id
    );

const brandLogo =
    brand?.logo || "";

const imageBase =
    `/assets/images/products/${product.image_folder}`;

const galleryImages =

    product.gallery && product.gallery.length

    ?

    product.gallery.map(
        file => `${imageBase}/${file}`
    )

    :

    [];

this.products =
    await API.products();



    const target =
        Utils.el("#product-detail");

    if (!target) return;
const allVehicles =
    await API.vehicles();
   
const vehiclesHtml =
    (product.vehicles || [])
        .map(vehicleName => {

            const vehicle =
                allVehicles.find(
                    v => v.model === vehicleName
                );

            return `
                <div class="pdp-vehicle-card">

                    <div class="pdp-vehicle-image">

                        <img
                            src="${
                                vehicle?.image ||
                                '/assets/images/vehicle-placeholder.webp'
                            }"
                            alt="${vehicleName}">

                    </div>

                    <div class="pdp-vehicle-content">

                        <h4>${vehicleName}</h4>

                    </div>

                </div>
            `;
        })
        .join("");

    const relatedHtml =
        this.related(product, 50)
        .map(item => this.card(item))
        .join("");

const galleryHtml = `

<div class="pdp-gallery">

    ${
        brandLogo ?

        `
        <div class="pdp-brand-badge">

            <img
                src="${brandLogo}"
                alt="${brand.name}">

        </div>
        `

        :

        ""
    }

    <div class="pdp-main-image">

        <img
            id="pdpMainImage"
            src="${galleryImages[0]}"
            alt="${product.product_name}">

    </div>

<div class="pdp-thumb-wrapper">

    <button
        class="pdp-thumb-prev">

        ‹

    </button>

    <div class="pdp-thumbnails">

        ${galleryImages.map(img => `

            <button class="pdp-thumb">

                <img
                    src="${img}"
                    alt="${product.product_name}">

            </button>

        `).join("")}

    </div>

    <button
        class="pdp-thumb-next">

        ›

    </button>

</div>

</div>

`;

    target.innerHTML = `

<div class="container">

<div class="pdp-wrapper">

    <section class="pdp-hero">
${galleryHtml}

        <div class="pdp-summary">

            <div class="pdp-badges">

                <span class="pdp-stock">
                    In Stock
                </span>

                <span class="pdp-genuine">
                    100% Genuine
                </span>

            </div>

            <h1 class="pdp-title">

                ${product.product_name}

            </h1>

            <div class="pdp-part">

                PART ID:
                ${product.id || ""}

            </div>

            <div class="pdp-meta">

                <div class="pdp-row">

                    <strong>Brand</strong>

                    <span>
                        ${product.brand_name || ""}
                    </span>

                </div>

                <div class="pdp-row">

                    <strong>Category</strong>

                    <span>
                        ${product.category_name || ""}
                    </span>

                </div>

                <div class="pdp-row">

                    <strong>Sub Category</strong>

                    <span>
                        ${product.subcategory_name || ""}
                    </span>

                </div>

            </div>
<div class="pdp-actions">

    <div class="pdp-qty">

        <button
            type="button"
            class="pdp-qty-minus">

            −

        </button>

        <input
            id="pdpQty"
            type="number"
            min="1"
            value="1">

        <button
            type="button"
            class="pdp-qty-plus">

            +

        </button>

    </div>

    <button
        class="btn btn-primary pdp-rfq-btn">

        Add To RFQ

    </button>

    <button
        class="pdp-remove-btn"
        style="display:none">

        🗑

    </button>

</div>

        </div>

        <aside class="pdp-inquiry">

            <h3>Request This Part</h3>

            <form>

                <input
                    type="text"
                    placeholder="Name">

                <input
                    type="text"
                    placeholder="Phone">

                <input
                    type="text"
                    placeholder="Vehicle">

                <input
                    type="text"
                    value="${product.part_number || ""}"
                    placeholder="Part Number">

                <textarea
                    placeholder="Requirement"></textarea>

                <button
                    class="btn btn-primary">

                    Request Quote

                </button>

            </form>

        </aside>

</section>

<section class="pdp-trust">

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/genuine.svg"
            alt="Genuine Parts">

        <div>

            <strong>
                100% Genuine Products
            </strong>

            <span>
                Original & Authorized
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/trusted.svg"
            alt="Trusted">

        <div>

            <strong>
                Trusted Since 1986
            </strong>

            <span>
                Serving Workshops & Fleets
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/inventory.svg"
            alt="Inventory">

        <div>

            <strong>
                Wide Range Available
            </strong>

            <span>
                5000+ Products
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/delivery.svg"
            alt="Delivery">

        <div>

            <strong>
                Pan India Delivery
            </strong>

            <span>
                Fast & Reliable
            </span>

        </div>

    </div>

</section>

<section class="pdp-section-nav">

    <a
        href="#description-section"
        class="pdp-tab-btn">

        Description

    </a>

    <a
        href="#vehicles-section"
        class="pdp-tab-btn">

        Compatible Vehicles

    </a>

    <a
        href="#related-section"
        class="pdp-tab-btn">

        Related Products

    </a>

</section>

<section
    id="description-section"
    class="pdp-section">

    <h2 class="pdp-section-title">

        Description

    </h2>

    <div class="pdp-description-grid">

        <div class="pdp-description-card">

            <h3>Description</h3>

            <p>

                ${product.description || ""}

            </p>

        </div>

        <div class="pdp-description-card">

            <h3>Applications</h3>

            <ul>

                ${(product.applications || [])
                    .map(
                        app =>
                        `<li>${app}</li>`
                    )
                    .join("")}

            </ul>

        </div>

    </div>

</section>

<section
    id="vehicles-section"
    class="pdp-section">

    <h2 class="pdp-section-title">

        Compatible Vehicles

    </h2>

    <div class="pdp-vehicle-grid">

        ${vehiclesHtml}

    </div>

</section>

<section
    id="related-section"
    class="pdp-section">

    <h2 class="pdp-section-title">

        Related Products

    </h2>

<div class="pdp-related-wrapper">

    <button
        class="pdp-related-prev">

        ‹

    </button>

    <div
        class="pdp-related-slider">

        ${relatedHtml}

    </div>

    <button
        class="pdp-related-next">

        ›

    </button>

</div>

</section>

</div>

</div>

`;

/* ==========================================
   PDP RFQ CONTROLS
========================================== */

const qtyInput =
    document.getElementById(
        "pdpQty"
    );

const minusBtn =
    document.querySelector(
        ".pdp-qty-minus"
    );

const plusBtn =
    document.querySelector(
        ".pdp-qty-plus"
    );

const rfqBtn =
    document.querySelector(
        ".pdp-rfq-btn"
    );

const removeBtn =
    document.querySelector(
        ".pdp-remove-btn"
    );

const rfqItem =
    RFQ.get().find(
        item =>
        item.id === product.id
    );

let inRFQ = false;

if(
    rfqItem &&
    qtyInput &&
    rfqBtn &&
    removeBtn
){

    inRFQ = true;

    qtyInput.value =
        rfqItem.qty;

    rfqBtn.textContent =
        "Added ✓";

    removeBtn.style.display =
        "block";

}

minusBtn?.addEventListener(
    "click",
    () => {

        qtyInput.value =
            Math.max(
                1,
                Number(
                    qtyInput.value
                ) - 1
            );

        if(inRFQ){

            rfqBtn.textContent =
                "Update RFQ";

        }

    }
);

plusBtn?.addEventListener(
    "click",
    () => {

        qtyInput.value =
            Number(
                qtyInput.value
            ) + 1;

        if(inRFQ){

            rfqBtn.textContent =
                "Update RFQ";

        }

    }
);

qtyInput?.addEventListener(
    "input",
    () => {

        if(inRFQ){

            rfqBtn.textContent =
                "Update RFQ";

        }

    }
);

rfqBtn?.addEventListener(
    "click",
    () => {

        const qty =
            Number(
                qtyInput.value
            );

        const items =
            RFQ.get();

        const existing =
            items.find(
                item =>
                item.id === product.id
            );

        if(existing){

            existing.qty =
                qty;

        }
        else{

            items.push({

                id:
                    product.id,

                partNumber:
                    product.part_number,

                name:
                    product.product_name,

                brand:
                    product.brand_name,

                qty:
                    qty

            });

        }

        RFQ.save(
            items
        );

        RFQ.updateBadge();

        inRFQ = true;

        rfqBtn.textContent =
            "Added ✓";

        removeBtn.style.display =
            "block";

    }
);

removeBtn?.addEventListener(
    "click",
    () => {

        RFQ.remove(
            product.id
        );

        inRFQ = false;

        qtyInput.value = 1;

        rfqBtn.textContent =
            "Add To RFQ";

        removeBtn.style.display =
            "none";

    }
);

const mainImage =
    document.getElementById(
        "pdpMainImage"
    );

document
.querySelectorAll(
    ".pdp-thumb"
)
.forEach(thumb => {

    thumb.addEventListener(
        "click",
        () => {

            const img =
                thumb.querySelector(
                    "img"
                );

            if (
                img &&
                mainImage
            ) {

                mainImage.src =
                    img.src;

            }

        }
    );

});

const thumbContainer =
    document.querySelector(
        ".pdp-thumbnails"
    );

const thumbPrev =
    document.querySelector(
        ".pdp-thumb-prev"
    );

const thumbNext =
    document.querySelector(
        ".pdp-thumb-next"
    );

if(
    thumbContainer &&
    thumbPrev &&
    thumbNext
){

    thumbPrev.addEventListener(
        "click",
        () => {

            thumbContainer.scrollBy({

                left:-300,

                behavior:"smooth"

            });

        }
    );

    thumbNext.addEventListener(
        "click",
        () => {

            thumbContainer.scrollBy({

                left:300,

                behavior:"smooth"

            });

        }
    );

}

const slider =
    document.querySelector(
        ".pdp-related-slider"
    );

const prev =
    document.querySelector(
        ".pdp-related-prev"
    );

const next =
    document.querySelector(
        ".pdp-related-next"
    );

if(
    slider &&
    prev &&
    next
){

    prev.addEventListener(
        "click",
        () => {

            slider.scrollBy({
                left:-600,
                behavior:"smooth"
            });

        }
    );

    next.addEventListener(
        "click",
        () => {

            slider.scrollBy({
                left:600,
                behavior:"smooth"
            });

        }
    );

}

}

}



window.Products = new ProductManager();