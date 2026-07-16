/*
==========================================================
SOUVIKS WEBSITE
BRANDS MODULE
Version : 2.0
==========================================================
*/

class BrandManager {

    constructor() {

        this.brands = [];

        this.filtered = [];

        this.container = null;

    }

    async init(
        selector = "#brand-grid"
    ) {

        this.container =
            Utils.el(selector);

        if (!this.container) {

            return;

        }

        this.brands =
            await API.brands();

        this.filtered =
            [...this.brands];

    }

    card(brand) {

        return `

        <article class="brand-card">

            <a href="${Utils.brandUrl(brand)}">

                <div class="brand-image">

                    <img
                        src="${brand.logo}"
                        alt="${brand.name}"
                        loading="lazy"
                    >

                </div>

                <div class="brand-content">

                    <h3 class="brand-name">

                        ${brand.name}

                    </h3>

<div class="brand-count">

    <span class="count-number">

        ${brand.product_count || 0}

    </span>

    Products

</div>

                </div>

            </a>

        </article>

        `;

    }


// ======================================================
// BRAND DETAIL PAGE
// ======================================================

async hydrateBrandPage() {

    const slug =

        window.location.pathname
            .split("/")
            .pop()
            .replace(".html", "");

    this.brands =
        await API.brands();

    const brand =

        this.brands.find(

            item =>

                item.slug === slug

        );

    if (!brand) {

        return;

    }

    this.renderBrandHero(
        brand
    );

    await this.renderBrandProducts(
        brand
    );

}

renderBrandHero(
    brand
) {

    const container =

        document.getElementById(
            "brand-detail"
        );

    if (!container) {

        return;

    }

    container.innerHTML = `

        <div class="brand-detail">

            <div class="brand-logo">

                <img
                    src="${brand.logo}"
                    alt="${brand.name}"
                >

            </div>

            <div class="brand-info">

                <h1>

                    ${brand.name}

                </h1>

                <p>

                    ${brand.product_count}

                    Products Available

                </p>

            </div>

        </div>

    `;

}

async renderBrandProducts(
    brand
) {

    const grid =

        document.getElementById(
            "product-grid"
        );

    if (!grid) {

        return;

    }

    const products =
        await API.products();

    const brandProducts =

        products.filter(

            product =>

                product.brand_id ===
                brand.id

        );

    if (

        brandProducts.length === 0

    ) {

        grid.innerHTML =

            Utils.emptyState(

                "No products found."

            );

        return;

    }

    grid.innerHTML =

        brandProducts
            .map(

                product =>

                    Products.card(
                        product
                    )

            )
            .join("");

}

}

window.Brands =
    new BrandManager();