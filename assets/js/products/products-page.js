/* products.js module extracted from legacy section: pages/products-page.js */

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
    "vehicles",
    "alternate_part_numbers",
    "oem_numbers",
    "cross_references"
];

document.addEventListener("DOMContentLoaded", async () => {
    const searchInput = document.getElementById("searchInput");
    const initialQuery = getSearchQuery();
    if (searchInput && initialQuery) searchInput.value = initialQuery;

    await Products.init("#product-grid", "catalogue-index");

    allProducts = [...Products.products];
    Filters.init(allProducts);
    initialiseUrlFilters();
    populateFilters(allProducts);
    updateCatalogueRobotsMeta();
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

function initialiseUrlFilters() {
    let params;
    try {
        params = new URLSearchParams(window.location.search);
    } catch (error) {
        return;
    }

    FILTER_CONFIGS.forEach(config => {
        const value = String(params.get(config.key) || "").trim();
        if (value) Filters.set(config.key, value);
    });

    const urlSort = String(params.get("sort") || "").trim();
    if (urlSort) currentSort = urlSort;
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
    const needle = String(query || "").trim();
    if (!needle) return products;

    const normalizedNeedle = needle.toLocaleLowerCase();
    const compactNeedle = normalizedNeedle.replace(/[^a-z0-9]+/g, "");
    const matchesValue = value => {
        if (Array.isArray(value)) return value.some(item => matchesValue(item));
        const text = String(value ?? "").toLocaleLowerCase();
        if (!text) return false;
        if (text.includes(normalizedNeedle)) return true;
        const compact = text.replace(/[^a-z0-9]+/g, "");
        return Boolean(compactNeedle && compact.includes(compactNeedle));
    };

    // Long, uninterrupted alphanumeric terms are usually part numbers or
    // pasted identifiers. Do not let prose typo-tolerance turn them into
    // unrelated product matches; use exact/compact substring matching only.
    if (/^[a-z0-9]{16,}$/i.test(needle)) {
        return products.filter(product =>
            SEARCH_FIELDS.some(field => matchesValue(product?.[field]))
        );
    }

    if (
        window.SouviksSearchEngine &&
        typeof SouviksSearchEngine.filterProducts === "function"
    ) {
        return SouviksSearchEngine.filterProducts(products, needle);
    }

    return products.filter(product =>
        SEARCH_FIELDS.some(field => matchesValue(product?.[field]))
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

function getFacetOptions(config, scope = getFacetScope(config.key)) {
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
        const scope = getFacetScope(config.key);
        const options = getFacetOptions(config, scope);
        populateSelect(config.id, options, selected, scope);
    });
}

function updateCatalogueRobotsMeta() {
    if (!document.body.classList.contains("products-page")) return;
    const params = new URLSearchParams(window.location.search);
    const hasCatalogueState = [...params.keys()].some(key =>
        ["q", "brand_id", "category_id", "subcategory_id", "vehicles", "page", "sort", "pageSize"].includes(key)
    );
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "robots";
        document.head.appendChild(meta);
    }
    meta.content = hasCatalogueState ? "noindex,follow,max-image-preview:large" : "index,follow,max-image-preview:large";
}

function applyCatalogue({ resetPage = true } = {}) {
    preserveInitialStaticCatalogue = false;

    const searchInput = document.getElementById("searchInput");
    const query = String(searchInput?.value || "").trim();

    // Keep the canonical catalogue state shareable/bookmarkable.
    try {
        const url = new URL(window.location.href);
        FILTER_CONFIGS.forEach(config => {
            const value = String(Filters.filters[config.key] || "").trim();
            if (value) url.searchParams.set(config.key, value);
            else url.searchParams.delete(config.key);
        });
        if (query) url.searchParams.set("q", query);
        else url.searchParams.delete("q");
        if (currentSort && currentSort !== "featured") url.searchParams.set("sort", currentSort);
        else url.searchParams.delete("sort");
        if (resetPage) url.searchParams.delete("page");
        updateCatalogueRobotsMeta();
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (error) {
        // Ignore URL API failures in older/embedded environments.
    }

    refreshFilterOptions();

    let results = allProducts.filter(product => matchesFilters(product, Filters.filters));
    results = searchProducts(results, query);
    results = sortCatalogue(results);

    Products.filtered = [...results];
    window.SouviksSearchEngine?.trackSearch?.(query, results.length, "product-catalogue");
    const requestedPage = !resetPage ? Utils.queryNumber("page", 1, 1, 1000000) : 1;
    const pageData = Pagination.update(results);
    Products.container.innerHTML = pageData.map(item => Products.card(item)).join("");
    if (!resetPage && Number.isFinite(requestedPage) && requestedPage > 1) Pagination.go(requestedPage);
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

    const initialPage = Utils.queryNumber("page", 1, 1, 1000000);
    const initialPageSize = Utils.queryNumber("pageSize", 20, 1, 100);
    Pagination.init({
        data: initialResults,
        perPage: Number.isFinite(initialPageSize) && initialPageSize > 0 ? initialPageSize : 20,
        container: "#pagination",
        onChange: pageData => {
            Products.container.innerHTML = pageData.map(item => Products.card(item)).join("");
            updateCounters(Pagination.data);
        }
    });

    // The build emits one page of product cards in the initial HTML. Keep that
    // markup untouched when it already matches the default first page instead
    // of parsing, hydrating and re-rendering the same cards a second time.
    const isDefaultFirstPage =
        preserveInitialStaticCatalogue &&
        !initialQuery &&
        initialPage === 1 &&
        initialPageSize === 20 &&
        currentSort === "featured" &&
        Object.values(Filters.filters).every(value => !String(value ?? "").trim());

    if (isDefaultFirstPage) {
        const staticIds = Array.from(
            Products.container?.querySelectorAll(".product-card") || []
        ).map(card => String(
            card.querySelector("[data-saved-product-id]")?.getAttribute("data-saved-product-id") || ""
        ).trim());
        const expectedIds = Pagination.pageData().map(product => String(product?.id || "").trim());
        const staticPageMatches =
            staticIds.length === expectedIds.length &&
            staticIds.every((id, index) => id && id === expectedIds[index]);

        if (staticPageMatches) {
            Products.filtered = [...initialResults];
            updateCounters(initialResults);
            updateNoResultsState(initialResults.length === 0);
            preserveInitialStaticCatalogue = false;
            return;
        }
    }

    if (!preserveInitialStaticCatalogue || initialQuery) {
        applyCatalogue({ resetPage: false });
        return;
    }

    Products.filtered = initialResults;
    Pagination.update(initialResults);
    if (Number.isFinite(initialPage) && initialPage > 1) Pagination.go(initialPage);
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
    const input = document.getElementById("searchInput");
    if (!input) return;
    const applySearch = typeof Utils !== "undefined" && typeof Utils.debounce === "function"
        ? Utils.debounce(applyCatalogue, 180)
        : applyCatalogue;
    input.addEventListener("input", applySearch);
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
        try {
            const url = new URL(window.location.href);
            url.searchParams.set("pageSize", String(value));
            url.searchParams.delete("page");
            window.history.replaceState({}, "", url.pathname + url.search + url.hash);
            updateCatalogueRobotsMeta();
        } catch (error) {
            // Ignore URL API failures.
        }
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
    updateCatalogueRobotsMeta();
}

function sentenceCase(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text === text.toLowerCase()) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
    return text;
}

function populateFilters() {
    // Facet construction scans the full catalogue. Populate one select per
    // idle task so the initial product page can paint and respond first.
    let index = 0;
    const schedule = callback => {
        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(callback, { timeout: 500 });
        } else {
            window.setTimeout(callback, 0);
        }
    };

    const populateNext = () => {
        const config = FILTER_CONFIGS[index++];
        if (!config) return;

        const select = document.getElementById(config.id);
        if (select) {
            select.disabled = true;
            const selected = Filters.filters[config.key] || "";
            const scope = getFacetScope(config.key);
            const options = getFacetOptions(config, scope);
            populateSelect(config.id, options, selected, scope);
            select.disabled = false;
        }

        if (index < FILTER_CONFIGS.length) schedule(populateNext);
    };

    schedule(populateNext);
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
    let noResults = document.getElementById("noResults");
    const pagination = document.getElementById("pagination");
    const productGrid = document.getElementById("product-grid");

    // Some generated catalogue pages predate the static empty-state markup.
    // Create the state safely with DOM APIs instead of leaving a blank grid.
    if (!noResults && productGrid) {
        noResults = document.createElement("section");
        noResults.id = "noResults";
        noResults.className = "no-results";
        noResults.hidden = true;
        noResults.setAttribute("role", "status");
        noResults.setAttribute("aria-live", "polite");
        noResults.setAttribute("aria-hidden", "true");

        const title = document.createElement("h2");
        title.dataset.emptyStateTitle = "";
        const message = document.createElement("p");
        message.dataset.emptyStateMessage = "";
        noResults.append(title, message);
        productGrid.insertAdjacentElement("afterend", noResults);
    }

    // A zero-result state is mutually exclusive with the result grid and
    // pagination. This prevents an empty page indicator from appearing under
    // a no-results message and avoids stale static catalogue content.
    if (productGrid) {
        productGrid.setAttribute("aria-busy", "false");
        productGrid.toggleAttribute("data-no-results", show);
    }
    if (pagination) {
        pagination.hidden = show;
        pagination.setAttribute("aria-hidden", String(show));
    }
    if (!noResults) return;

    const lang = String(
        window.souviks?.currentLanguage ||
        document.documentElement.lang ||
        "en"
    ).slice(0, 2);

    const emptyCopy = {
        en: {
            title: "No Matching Products Found",
            message: "We couldn't find any products matching your search criteria. Try changing your keywords or adjusting the selected filters.",
            label: "No Results"
        },
        hi: {
            title: "कोई मेल खाने वाला उत्पाद नहीं मिला",
            message: "आपकी खोज या फ़िल्टर से मेल खाने वाला कोई उत्पाद नहीं मिला। कृपया कीवर्ड बदलें या फ़िल्टर समायोजित करें।",
            label: "कोई परिणाम नहीं मिला"
        },
        bn: {
            title: "কোনো মিলযুক্ত পণ্য পাওয়া যায়নি",
            message: "আপনার অনুসন্ধান বা ফিল্টারের সাথে মিলে এমন কোনো পণ্য পাওয়া যায়নি। অনুগ্রহ করে কীওয়ার্ড বা ফিল্টার পরিবর্তন করুন।",
            label: "কোন ফলাফল পাওয়া যায়নি"
        }
    }[lang] || {
        title: "No Matching Products Found",
        message: "We couldn't find any products matching your search criteria. Try changing your keywords or adjusting the selected filters.",
        label: "No Results"
    };

    noResults.hidden = !show;
    noResults.classList.toggle("hidden", !show);
    noResults.setAttribute("aria-hidden", String(!show));
    noResults.setAttribute("aria-label", emptyCopy.label);

    const title = noResults.querySelector("[data-empty-state-title]");
    const message = noResults.querySelector("[data-empty-state-message]");
    if (show) {
        if (title) title.textContent = emptyCopy.title;
        if (message) message.textContent = emptyCopy.message;
    } else {
        title?.replaceChildren();
        message?.replaceChildren();
    }

    const suggestionHost = document.getElementById("searchSuggestions");
    if (!suggestionHost) return;

    if (!show) {
        suggestionHost.hidden = true;
        suggestionHost.replaceChildren();
        return;
    }

    const query = String(document.getElementById("searchInput")?.value || "").trim();
    const suggestions = window.SouviksSearchEngine?.suggestQueries
        ? SouviksSearchEngine.suggestQueries(query, allProducts, 5)
        : [];

    suggestionHost.replaceChildren();
    if (!suggestions.length) {
        suggestionHost.hidden = true;
        return;
    }

    const label = document.createElement("span");
    label.className = "search-suggestions-label";
    label.textContent = "Try searching for:";
    suggestionHost.appendChild(label);

    suggestions.forEach(suggestion => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "search-suggestion";
        button.textContent = suggestion;
        button.addEventListener("click", () => {
            const input = document.getElementById("searchInput");
            if (input) input.value = suggestion;
            applyCatalogue();
            input?.focus();
            input?.select?.();
        });
        suggestionHost.appendChild(button);
    });
    suggestionHost.hidden = false;
}
