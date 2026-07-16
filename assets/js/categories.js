/*
==========================================================
SOUVIKS WEBSITE
CATEGORIES MODULE
Version : 1.0
==========================================================
*/

class CategoryManager {

    constructor() {

        this.categories = [];

        this.filtered = [];

        this.container = null;

    }
    // ======================================================
    // INIT
    // ======================================================

    async init(

        selector = "#category-grid"

    ) {

        this.container = Utils.el(

            selector

        );

        if (!this.container) {

            return;

        }

        this.categories =

            await API.categories();

        this.filtered = [

            ...this.categories

        ];

        this.render();

    }
    // ======================================================
    // CATEGORY CARD
    // ======================================================

    card(category) {

        return `

        <article class="category-card">

            <a href="${Utils.categoryUrl(category)}">

                <div class="category-image">

                    <img
                        src="${category.image || '/assets/images/category-placeholder.webp'}"
                        alt="${category.name}"
                        loading="lazy"
                    >

                </div>

                <div class="category-content">

                    <h3 class="category-title">

                        ${category.name}

                    </h3>

                    <div class="category-count">

                        ${category.product_count || 0}
                        Products

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

            this.filtered.length === 0

        ) {

            this.container.innerHTML =

                Utils.emptyState(

                    "No categories found."

                );

            return;

        }

        this.container.innerHTML =

    this.filtered

        .map(
            category =>
                this.card(
                    category
                )
        )

        .join("");

const visible =
    document.getElementById(
        "visibleCategories"
    );

if (visible) {

    visible.textContent =
        this.filtered.length;

}

    }
    // ======================================================
    // SEARCH
    // ======================================================

    search(query) {

        if (!query) {

            this.filtered = [

                ...this.categories

            ];

            this.render();

            return;

        }

        query = query.toLowerCase();

        this.filtered =

            this.categories.filter(

                category =>

                    category.name

                        .toLowerCase()

                        .includes(

                            query

                        )

            );

        this.render();

    }
    // ======================================================
    // SORT
    // ======================================================

    sortByName() {

        this.filtered.sort(

            (a, b) =>

                a.name.localeCompare(

                    b.name

                )

        );

        this.render();

    }

    sortByProducts() {

        this.filtered.sort(

            (a, b) =>

                b.product_count -

                a.product_count

        );

        this.render();

    }
    // ======================================================
    // FEATURED
    // ======================================================

    featured(

        limit = 12

    ) {

        return this.categories

            .filter(

                category =>

                    category.featured === true

            )

            .slice(

                0,

                limit

            );

    }
    // ======================================================
    // CATEGORY DETAIL
    // ======================================================

    async hydrateCategoryPage() {

        const slug =

            Utils.currentSlug();

        const category =

            await API.categoryBySlug(

                slug

            );

        if (!category) {

            return;

        }

        const target =

            Utils.el(

                "#category-detail"

            );

        if (!target) {

            return;

        }

        target.innerHTML = `

            <div class="category-detail">

                <div class="category-image">

                    <img
                        src="${category.image || '/assets/images/category-placeholder.webp'}"
                        alt="${category.name}"
                    >

                </div>

                <div class="category-info">

                    <h1>

                        ${category.name}

                    </h1>

                    <p>

                        ${category.description || ""}

                    </p>

                    <div>

                        Products:
                        ${category.product_count || 0}

                    </div>

                </div>

            </div>

        `;

    const products =
        await API.productsByCategory(
            category.id
        );

    const grid =
        Utils.el(
            "#product-grid"
        );

    if (
        grid &&
        products.length
    ) {

        grid.innerHTML =
            products.map(
                product =>
                    Products.card(
                        product
                    )
            ).join("");

    }

}
    // ======================================================
    // CATEGORY PRODUCTS
    // ======================================================

    async products(

        categoryId

    ) {

        return await API.productsByCategory(

            categoryId

        );

    }
    // ======================================================
    // SUBCATEGORIES
    // ======================================================

    subcategories(

        category

    ) {

        return category.subcategories || [];

    }
}

window.Categories = new CategoryManager();