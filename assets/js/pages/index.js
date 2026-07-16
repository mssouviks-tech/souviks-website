document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await renderFeaturedCategories();

        await renderFeaturedBrands();

        await renderFeaturedVehicles();

        await initializeHomepageSearch();

    }
);


async function renderFeaturedCategories() {

    const categories =
        await API.categories();

    const featured =

        categories
            .sort(
                (a, b) =>
                    (b.product_count || 0) -
                    (a.product_count || 0)
            )
            .slice(0, 4);

    const container =
        document.querySelector(
            "#featuredCategories"
        );

    container.innerHTML =

        featured
            .map(
                category =>
                    Categories.card(
                        category
                    )
            )
            .join("");

}

async function renderFeaturedBrands() {

    const brands =
        await API.brands();

    const featuredNames = [

        "Tata Genuine Parts",
        "Leyparts",
        "TVS Girling",
        "Texspin"
        

    ];

    const featured =

        brands.filter(

            brand =>

                featuredNames.includes(
                    brand.name
                )

        );

    const container =
        document.querySelector(
            "#featuredBrands"
        );

    container.innerHTML =

        featured
            .map(
                brand =>
                    Brands.card(
                        brand
                    )
            )
            .join("");

}


async function renderFeaturedVehicles() {

    const vehicles =
        await API.vehicles();

    const featuredModels = [

        "Tata 1210",
        "Ashok Leyland 2516",
        "Tata Signa",
        "Tata Prima"
      

    ];

    const featured =

        vehicles.filter(

            vehicle =>

                featuredModels.includes(
                    vehicle.model
                )

        );

    const container =
        document.querySelector(
            "#featuredVehicles"
        );

    container.innerHTML =

        featured
            .map(
                vehicle =>
                    Vehicles.card(
                        vehicle
                    )
            )
            .join("");

}

async function initializeHomepageSearch() {

    SEARCH_INDEX =
        await API.searchIndex();

    bindSearchEvents();

}

function searchCatalog(query) {

    if (!query) return [];

    query = query.toLowerCase().trim();

    return SEARCH_INDEX

        .map(item => {

            let score = 0;

            const title =
                (item.title || "")
                    .toLowerCase();

            if (title === query)
                score += 1000;

            else if (title.startsWith(query))
                score += 500;

            else if (title.includes(query))
                score += 250;

            if (item.type === "vehicle")
                score += 300;

            if (item.type === "brand")
                score += 200;

            if (item.type === "category")
                score += 100;

            if (item.type === "product")
                score += 10;

            return {
                ...item,
                score
            };

        })

        .filter(item => item.score > 0)

        .sort((a, b) => b.score - a.score)

        .slice(0, 8);

}

function bindSearchEvents() {

    const input =
        document.querySelector(
            "#searchInput"
        );

    const results =
        document.querySelector(
            "#searchResults"
        );
const searchButton =
    document.querySelector(
        "#searchButton"
    );
searchButton?.addEventListener(
    "click",
    () => {

        const matches =
            searchCatalog(
                input.value
            );

        renderSearchResults(
            matches,
            results
        );

    }
);
input.addEventListener(
    "keydown",
    event => {

        if(event.key === "Enter") {

            const matches =
                searchCatalog(
                    input.value
                );

            renderSearchResults(
                matches,
                results
            );

        }

    }
);
document.addEventListener(
    "click",
    event => {

        if(

            !event.target.closest(
                ".search-wrapper"
            )

        ){

            results.classList.remove(
                "active"
            );

        }

    }
);

    if (!input || !results) {

        return;

    }

    input.addEventListener(
        "input",
        event => {

            const matches =
                searchCatalog(
                    event.target.value
                );

            renderSearchResults(
                matches,
                results
            );

        }
    );

}


function getSearchUrl(item) {

    switch(item.type?.toLowerCase()) {

        case "product":
            return `/products/${item.slug}.html`;

        case "brand":
            return `/brands/${item.slug}.html`;

        case "category":
            return `/categories/${item.slug}.html`;

        case "vehicle":
            return `/vehicles/${item.slug}.html`;

        default:
            return item.url;
    }

}


function renderSearchResults(
    matches,
    container
) {

    if (!matches.length) {

        container.innerHTML = "";

        container.classList.remove(
            "active"
        );

        return;

    }

    container.innerHTML =

        matches.map(item => `

            <a
                href="${getSearchUrl(item)}"
                class="search-result">

                <div class="search-type">

                    ${item.type}

                </div>

                <div class="search-label">

                    ${item.title}

                </div>

                <div class="search-subtitle">

                    ${item.subtitle || ""}

                </div>

            </a>

        `).join("");

    container.classList.add(
        "active"
    );

}

let SEARCH_INDEX = [];