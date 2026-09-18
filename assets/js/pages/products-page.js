/*
==========================================================
SOUVIKS WEBSITE
PRODUCTS PAGE CONTROLLER
Version : 2.0

Responsibilities owned here:
- catalogue filtering / facet handshake
- catalogue search
- sorting
- pagination + page size
- catalogue counters / empty state
==========================================================
*/

let allProducts = [];
let currentSort = "featured";
let preserveInitialStaticCatalogue = false;

const FILTER_CONFIGS = [
    {
        id: "brandFilter",
        key: "brand_id",
        labelField: "brand_name",
        emptyLabel: "All Brands"
    },
    {
        id: "categoryFilter",
        key: "category_id",
        labelField: "category_name",
        emptyLabel: "All Categories"
    },
    {
        id: "subCategoryFilter",
        key: "subcategory_id",
        labelField: "subcategory_name",
        emptyLabel: "All Subcategories"
    },
    {
        id: "vehicleFilter",
        key: "vehicles",
        labelField: null,
        emptyLabel: "All Vehicles"
    }
];

const SEARCH_FIELDS = [
    "product_name",
    "name",
    "part_number",
    "partNumber",
    "brand_name",
    "brand",
    "manufacturer_part_number",
    "applications",
    "vehicles"
];

document.addEventListener("DOMContentLoaded", async () => {
    await Products.init("#product-grid");

    const searchInput = document.getElementById("searchInput");
    const initialQuery = getSearchQuery();
    if (searchInput && initialQuery) {
        searchInput.value = initialQuery;
    }

    Breadcrumb.start(
        "Products",
        "/${LANG}/products.html"
    );
    Breadcrumb.render("Products");

    allProducts = [...Products.products];
    Filters.init(allProducts);

    populateFilters(allProducts);
    initialisePagination();
    bindFilters();
    bindSearch();
    bindSort();
    bindPageSize();
    bindReset();
    bindNoResultsReset();
});

function getSearchQuery() {
    try {
        return String(new URLSearchParams(window.location.search).get("q") || "").trim();
    } catch (error) {
        return "";
    }
}

function normaliseComparable(value) {
    return String(value ?? "").trim().toLocaleLowerCase();
}

function priceValue(product) {
    const candidates = [product?.selling_price, product?.mrp];
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined || String(candidate).trim() === "") continue;
        const numeric = Number(String(candidate).replace(/[₹,\s]/g, ""));
        if (Number.isFinite(numeric)) return numeric;
    }
    return null;
}

function sortCatalogue(results) {
    const value = String(currentSort || "featured");
    const sorted = [...results];

    if (value === "featured") {
        return sorted.sort((a, b) => {
            const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
            if (featuredDiff) return featuredDiff;
            return normaliseComparable(a.product_name || a.name)
                .localeCompare(normaliseComparable(b.product_name || b.name), undefined, { sensitivity: "base" });
        });
    }

    const [field, direction = "asc"] = value.split("-");
    const fieldMap = {
        name: "product_name",
        brand: "brand_name",
        part: "part_number",
        price: "_price_sort"
    };
    const key = fieldMap[field];
    if (!key) return sorted;

    const multiplier = direction === "desc" ? -1 : 1;
    return sorted.sort((a, b) => {
        if (key === "_price_sort") {
            const first = priceValue(a);
            const second = priceValue(b);
            if (first === null && second === null) return 0;
            if (first === null) return 1;
            if (second === null) return -1;
            if (first !== second) return (first < second ? -1 : 1) * multiplier;
            return normaliseComparable(a.product_name || a.name)
                .localeCompare(normaliseComparable(b.product_name || b.name), undefined, { sensitivity: "base" });
        }

        const first = normaliseComparable(a[key]);
        const second = normaliseComparable(b[key]);
        if (first === second) return 0;
        return (first < second ? -1 : 1) * multiplier;
    });
}

function fieldMatches(product, key, value) {
    if (value === null || value === undefined || value === "") return true;

    const field = product?.[key];
    if (Array.isArray(field)) {
        return field.some(item => String(item) === String(value));
    }

    return String(field ?? "") === String(value);
}

function matchesFilters(product, filters, excludeKey = null) {
    return Object.entries(filters).every(([key, value]) => {
        if (key === excludeKey) return true;
        return fieldMatches(product, key, value);
    });
}

function searchProducts(products, query) {
    const needle = String(query || "").trim().toLocaleLowerCase();
    if (!needle) return products;

    return products.filter(product =>
        SEARCH_FIELDS.some(field => {
            const value = product?.[field];
            if (Array.isArray(value)) {
                return value.some(item => String(item).toLocaleLowerCase().includes(needle));
            }
            return String(value ?? "").toLocaleLowerCase().includes(needle);
        })
    );
}

/*
 * FACET HANDSHAKE
 *
 * Each dropdown calculates its options from the same product universe,
 * applying every OTHER active facet. The facet being populated is excluded
 * from its own scope so the current selection can remain visible.
 * Search is deliberately excluded from facet calculation; text search is
 * an independent operation applied after the structured filters.
 */
function getFacetScope(excludeKey) {
    const structuredScope = allProducts.filter(product =>
        matchesFilters(product, Filters.filters, excludeKey)
    );

    // Search is part of the same catalogue state. Facet options therefore
    // reflect the current query as well as every other active facet.
    return searchProducts(
        structuredScope,
        document.getElementById("searchInput")?.value || ""
    );
}

function getFacetOptions(config) {
    const scope = getFacetScope(config.key);
    const selected = Filters.filters[config.key];
    const options = new Map();

    if (config.key === "vehicles") {
        scope.forEach(product => {
            const vehicles = Array.isArray(product?.vehicles) ? product.vehicles : [];
            vehicles.forEach(vehicle => {
                const value = String(vehicle ?? "").trim();
                if (value) options.set(value, value);
            });
        });
    } else {
        scope.forEach(product => {
            const value = product?.[config.key];
            if (value === null || value === undefined || value === "") return;
            const stringValue = String(value);
            const rawLabel = product?.[config.labelField] || stringValue;
            options.set(stringValue, sentenceCase(rawLabel));
        });
    }

    // Never make an active selection disappear just because another facet
    // combination currently produces zero matches.
    if (selected !== null && selected !== undefined && selected !== "") {
        const selectedValue = String(selected);
        if (!options.has(selectedValue)) {
            const source = allProducts.find(product => fieldMatches(product, config.key, selectedValue));
            if (source) {
                const label = config.key === "vehicles"
                    ? selectedValue
                    : sentenceCase(source?.[config.labelField] || selectedValue);
                options.set(selectedValue, label);
            }
        }
    }

    return [...options.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" }));
}

function refreshFilterOptions() {
    FILTER_CONFIGS.forEach(config => {
        const select = document.getElementById(config.id);
        if (!select) return;

        const selected = Filters.filters[config.key] || "";
        const options = getFacetOptions(config);
        populateSelect(config.id, options, selected, getFacetScope(config.key));
    });
}

function applyCatalogue() {
    preserveInitialStaticCatalogue = false;

    const searchInput = document.getElementById("searchInput");
    const query = String(searchInput?.value || "").trim();

    // Keep the canonical catalogue state shareable/bookmarkable.
    try {
        const url = new URL(window.location.href);
        if (query) {
            url.searchParams.set("q", query);
        } else {
            url.searchParams.delete("q");
        }
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (error) {
        // Ignore URL API failures in older/embedded environments.
    }

    refreshFilterOptions();

    let results = allProducts.filter(product => matchesFilters(product, Filters.filters));
    results = searchProducts(results, query);
    results = sortCatalogue(results);

    Products.filtered = [...results];
    const pageData = Pagination.update(results);
    Products.container.innerHTML = pageData.map(item => Products.card(item)).join("");
    updateCounters(results);
    updateNoResultsState(results.length === 0);
}

function initialisePagination() {
    preserveInitialStaticCatalogue = Products.container?.dataset.staticRendered === "true";

    const initialQuery = getSearchQuery();
    const initialResults = sortCatalogue(
        initialQuery
            ? searchProducts(Filters.results(), initialQuery)
            : Filters.results()
    );

    Pagination.init({
        data: initialResults,
        perPage: 20,
        container: "#pagination",
        onChange: pageData => {
            Products.container.innerHTML = pageData.map(item => Products.card(item)).join("");
            updateCounters(Pagination.data);
        }
    });

    if (!preserveInitialStaticCatalogue || initialQuery) {
        applyCatalogue();
        return;
    }

    Products.filtered = initialResults;
    Pagination.update(initialResults);
    Products.container.innerHTML = Pagination.pageData().map(item => Products.card(item)).join("");
    updateCounters(initialResults);
    preserveInitialStaticCatalogue = false;
}

function bindFilters() {
    FILTER_CONFIGS.forEach(config => {
        document.getElementById(config.id)?.addEventListener("change", event => {
            Filters.set(config.key, event.target.value);
            applyCatalogue();
        });
    });
}

function bindSearch() {
    document.getElementById("searchInput")?.addEventListener("input", applyCatalogue);
}

function bindSort() {
    document.getElementById("sortProducts")?.addEventListener("change", event => {
        currentSort = event.target.value || "featured";
        applyCatalogue();
    });
}

function bindPageSize() {
    const select = document.getElementById("pageSize");
    if (!select) return;

    const configured = Number(select.value);
    if (Number.isFinite(configured) && configured > 0) {
        Pagination.setPerPage(configured, false);
    }

    select.addEventListener("change", event => {
        const value = Number(event.target.value);
        if (!Number.isFinite(value) || value < 1) return;
        Pagination.setPerPage(value, true);
        renderCurrentPage();
    });
}

function bindReset() {
    document.getElementById("resetCatalogueFilters")?.addEventListener("click", () => {
        Filters.clear();
        currentSort = "featured";

        document.querySelectorAll(".catalogue-filter").forEach(select => {
            if (select.id !== "sortProducts" && select.id !== "pageSize") select.value = "";
        });

        const search = document.getElementById("searchInput");
        if (search) search.value = "";

        const sort = document.getElementById("sortProducts");
        if (sort) sort.value = currentSort;

        applyCatalogue();
    });
}

function bindNoResultsReset() {
    document.getElementById("resetNoResultsFilters")?.addEventListener("click", () => {
        document.getElementById("resetCatalogueFilters")?.click();
    });
}

function renderCurrentPage() {
    const pageData = Pagination.pageData();
    Products.container.innerHTML = pageData.map(item => Products.card(item)).join("");
    updateCounters(Pagination.data);
    updateNoResultsState(Pagination.data.length === 0);
}

function sentenceCase(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text === text.toLowerCase()) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
    return text;
}

function populateFilters(products) {
    refreshFilterOptions();
}

function populateSelect(id, options, selectedValue = "", scope = allProducts) {
    const select = document.getElementById(id);
    if (!select) return;

    const first = select.options[0];
    const firstHtml = first ? first.outerHTML : '<option value="">All</option>';
    select.innerHTML = firstHtml;

    options.forEach(option => {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        element.selected = String(option.value) === String(selectedValue);
        element.disabled = !element.selected && !optionExistsInScope(id, option.value, scope);
        select.appendChild(element);
    });
}

function optionExistsInScope(id, value, scope) {
    const config = FILTER_CONFIGS.find(item => item.id === id);
    if (!config) return true;

    if (config.key === "vehicles") {
        return scope.some(product =>
            Array.isArray(product?.vehicles) &&
            product.vehicles.some(vehicle => String(vehicle) === String(value))
        );
    }

    return scope.some(product => String(product?.[config.key] ?? "") === String(value));
}

function updateCounters(results) {
    const info = Pagination.info();
    const start = results.length ? ((info.currentPage - 1) * info.perPage) + 1 : 0;
    const end = results.length ? Math.min(info.currentPage * info.perPage, results.length) : 0;
    const pageVisible = results.length ? Pagination.pageData().length : 0;

    document.getElementById("visibleProducts")?.replaceChildren(document.createTextNode(String(pageVisible)));
    document.getElementById("totalProducts")?.replaceChildren(document.createTextNode(String(results.length)));
    document.getElementById("currentResultStart")?.replaceChildren(document.createTextNode(String(start)));
    document.getElementById("currentResultEnd")?.replaceChildren(document.createTextNode(String(end)));
    document.getElementById("totalResults")?.replaceChildren(document.createTextNode(String(results.length)));
}

function updateNoResultsState(show) {
    const noResults = document.getElementById("noResults");
    if (!noResults) return;
    noResults.hidden = !show;
    noResults.classList.toggle("hidden", !show);
}
