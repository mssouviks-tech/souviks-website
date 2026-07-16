/*
==========================================================
SOUVIKS WEBSITE
BRANDS PAGE
Version : 3.0
==========================================================
*/

let brandsExpanded = false;

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        await Brands.init(

            "#brand-grid"

        );

        bindSearch();

        bindShowMore();

        renderBrands(

            Brands.brands

        );

        updateCounters(

            Brands.brands

        );

    }

);

function renderBrands(
    brands
) {

    if (

        !brands ||

        brands.length === 0

    ) {

        Brands.container.innerHTML =

            Utils.emptyState(

                "No brands found."

            );

        return;

    }

    Brands.container.innerHTML =

        brands
            .map(

                brand =>

                    Brands.card(
                        brand
                    )

            )
            .join("");

}

function bindSearch() {

    document
        .getElementById(
            "searchInput"
        )
        ?.addEventListener(

            "input",

            event => {

                const query =

                    event.target.value
                        .trim()
                        .toLowerCase();

                let results = [

                    ...Brands.brands

                ];

                if (query) {

                    results =

                        results.filter(

                            brand =>

                                brand.name
                                    ?.toLowerCase()
                                    ?.includes(
                                        query
                                    )

                        );

                    expandBrands();

                }

                renderBrands(
                    results
                );

                updateCounters(
                    results
                );

            }

        );

}

function bindShowMore() {

    document
        .getElementById(
            "showMoreBrands"
        )
        ?.addEventListener(

            "click",

            () => {

                expandBrands();

            }

        );

}

function expandBrands() {

    if (

        brandsExpanded

    ) {

        return;

    }

    brandsExpanded = true;

    document.body.classList.add(

        "brands-expanded"

    );

    document
        .getElementById(
            "showMoreBrands"
        )
        ?.remove();

}

function updateCounters(
    results
) {

    document
        .getElementById(
            "visibleBrands"
        )
        ?.replaceChildren(

            document.createTextNode(

                results.length

            )

        );

    document
        .getElementById(
            "totalBrands"
        )
        ?.replaceChildren(

            document.createTextNode(

                Brands.brands.length

            )

        );

}