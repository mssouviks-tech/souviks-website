document.addEventListener(
    "DOMContentLoaded",
    async () => {

Breadcrumb.reset();
Breadcrumb.render("Home");

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
            .slice(0, 5);

    const container =
        document.querySelector(
            "#featuredCategories"
        );

    if (container?.dataset.staticRendered !== "true") {
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

}

async function renderFeaturedBrands() {

    const brands =
        await API.brands();

    const featuredNames = [

        "Tata Genuine Parts",
        "Leyparts",
        "TVS Girling",
        "Texspin",
        "Bosch"

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

    if (container?.dataset.staticRendered !== "true") {
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

}


async function renderFeaturedVehicles() {

    const vehicles =
        await API.vehicles();

    const featured = vehicles
        .filter(vehicle => vehicle?.active !== false)
        .sort((a, b) => (b.product_count || 0) - (a.product_count || 0))
        .slice(0, 5);

    const container =
        document.querySelector(
            "#featuredVehicles"
        );

    if (container?.dataset.staticRendered !== "true") {
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

}

async function initializeHomepageSearch() {

    SEARCH_INDEX =
        await API.searchIndex();

    bindSearchEvents();

}

function searchCatalog(query) {

    if (!query) {
        return [];
    }

    if (
        window.SouviksSearchEngine &&
        typeof SouviksSearchEngine.search ===
            "function"
    ) {
        return SouviksSearchEngine.search(
            SEARCH_INDEX,
            query,
            8
        );
    }

    return SEARCH_INDEX
        .filter(item =>
            String(item.title || "")
                .toLowerCase()
                .includes(
                    String(query)
                        .trim()
                        .toLowerCase()
                )
        )
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
const goToCatalogue = () => {
    const query = String(input?.value || "").trim();
    if (!query) {
        input?.focus();
        return;
    }

    const url = new URL(`/${LANG}/products.html`, window.location.origin);
    url.searchParams.set("q", query);
    window.location.assign(url.pathname + url.search);
};

searchButton?.addEventListener("click", goToCatalogue);

input?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        goToCatalogue();
    }
});
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
            return `/${LANG}/products/${item.slug}.html`;

        case "brand":
            return `/${LANG}/brands/${item.slug}.html`;

        case "category":
            return `/${LANG}/categories/${item.slug}.html`;

        case "vehicle":
            return `/${LANG}/vehicles/${item.slug}.html`;

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