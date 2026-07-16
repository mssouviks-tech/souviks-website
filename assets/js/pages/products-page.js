document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await Products.init("#product-grid");

        const allProducts = [
            ...Products.products
        ];

        Filters.init(allProducts);

        populateFilters(allProducts);

        initialisePagination();

        bindFilters();

        bindSearch();

        bindPageSize();

        bindReset();

    }
);

function applyCatalogue() {

    let results =
        Filters.results();

    const searchValue =
        document
            .getElementById(
                "searchInput"
            )
            ?.value
            ?.trim();

    if (searchValue) {

        results =
            Filters.search(
                searchValue,
                [
                    "product_name",
                    "part_number",
                    "brand_name"
                ]
            );

    }

    Products.filtered =
        [...results];

    const pageData =
        Pagination.update(
            results
        );

    Products.container.innerHTML =
        pageData
            .map(
                item =>
                    Products.card(item)
            )
            .join("");

    updateCounters(results);
}

function initialisePagination() {

    Pagination.init({

        data:
            Filters.results(),

        perPage: 12,

        container:
            "#pagination",

        onChange:
            pageData => {

                Products.container.innerHTML =
                    pageData
                        .map(
                            item =>
                                Products.card(item)
                        )
                        .join("");

                updateCounters(
                    Filters.results()
                );

            }

    });

    applyCatalogue();
}

function bindFilters() {

    document
        .getElementById(
            "brandFilter"
        )
        ?.addEventListener(
            "change",
            e => {

                Filters.set(
                    "brand_id",
                    e.target.value
                );

                applyCatalogue();

            }
        );

    document
        .getElementById(
            "categoryFilter"
        )
        ?.addEventListener(
            "change",
            e => {

                Filters.set(
                    "category_id",
                    e.target.value
                );

                applyCatalogue();

            }
        );

    document
        .getElementById(
            "vehicleFilter"
        )
        ?.addEventListener(
            "change",
            e => {

                Filters.set(
                    "vehicles",
                    e.target.value
                );

                applyCatalogue();

            }
        );

}

function bindSearch() {

    document
        .getElementById(
            "searchInput"
        )
        ?.addEventListener(
            "input",
            () => {

                applyCatalogue();

            }
        );

}

function bindPageSize() {

    document
        .getElementById(
            "pageSize"
        )
        ?.addEventListener(
            "change",
            e => {

                Pagination.perPage =
                    parseInt(
                        e.target.value
                    );

                Pagination.calculate();

                Pagination.refresh();

            }
        );

}

function bindReset() {

    document
        .getElementById(
            "resetFilters"
        )
        ?.addEventListener(
            "click",
            () => {

                Filters.clear();

                document
                    .querySelectorAll(
                        ".catalogue-filter"
                    )
                    .forEach(
                        select =>
                            select.value = ""
                    );

                const search =
                    document.getElementById(
                        "searchInput"
                    );

                if (search) {

                    search.value = "";

                }

                applyCatalogue();

            }
        );

}

function populateFilters(products) {

    populateSelect(
        "brandFilter",
        [
            ...new Set(
                products.map(
                    p =>
                        p.brand_id
                )
            )
        ]
    );

    populateSelect(
        "categoryFilter",
        [
            ...new Set(
                products.map(
                    p =>
                        p.category_id
                )
            )
        ]
    );

    populateSelect(
        "vehicleFilter",
        [
            ...new Set(
                products.flatMap(
                    p =>
                        p.vehicles || []
                )
            )
        ]
    );

}

function populateSelect(
    id,
    values
) {

    const select =
        document.getElementById(
            id
        );

    if (!select) {

        return;

    }

    values
        .filter(Boolean)
        .sort()
        .forEach(
            value => {

                select.innerHTML += `
                    <option value="${value}">
                        ${value}
                    </option>
                `;

            }
        );

}

function updateCounters(
    results
) {

    const info =
        Pagination.info();

    const start =
        ((info.currentPage - 1)
        * info.perPage) + 1;

    const end =
        Math.min(
            info.currentPage
            * info.perPage,
            results.length
        );

    const visible =
        document.getElementById(
            "visibleProducts"
        );

    if (visible) {

        visible.textContent =
            results.length;

    }

    document
        .getElementById(
            "currentResultStart"
        )
        ?.replaceChildren(
            document.createTextNode(
                results.length
                    ? start
                    : 0
            )
        );

    document
        .getElementById(
            "currentResultEnd"
        )
        ?.replaceChildren(
            document.createTextNode(
                end
            )
        );

    document
        .getElementById(
            "totalResults"
        )
        ?.replaceChildren(
            document.createTextNode(
                results.length
            )
        );

}