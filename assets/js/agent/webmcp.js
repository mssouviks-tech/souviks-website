/*
==========================================================
SOUVIKS WEBMCP
==========================================================

Registers browser-native tools for WebMCP-capable agents.

Current WebMCP uses:
    document.modelContext.registerTool()

Older experimental WebMCP builds used:
    navigator.modelContext.provideContext()

This file supports both where available.
==========================================================
*/

(() => {
    "use strict";

    const MODEL_CONTEXT =
        document.modelContext ||
        window.navigator.modelContext;

    if (!MODEL_CONTEXT) {
        return;
    }

    const CATALOGUE_URL =
        "/assets/data/search.json";

    const AGENT_PART_INDEX_URL =
        "/assets/data/agent/part-index.json";

    const AGENT_BRAND_INDEX_URL =
        "/assets/data/agent/brand-index.json";

    const AGENT_CATEGORY_INDEX_URL =
        "/assets/data/agent/category-index.json";

    const AGENT_VEHICLE_INDEX_URL =
        "/assets/data/agent/vehicle-index.json";

    const AGENT_PRODUCTS_SUMMARY_URL =
        "/assets/data/agent/products-summary.json";

    const VEHICLES_URL =
        "/assets/data/vehicles.json";

    const BRANDS_URL =
        "/assets/data/brands.json";

    const CATEGORIES_URL =
        "/assets/data/categories.json";

    const PRODUCTS_URL =
        "/assets/data/products.json";

    const CATALOGUE_PAGE =
        "/en/products.html";

    async function fetchJson(path, signal) {
        const response =
            await fetch(path, {
                headers: {
                    Accept:
                        "application/json"
                },
                signal
            });

        if (!response.ok) {
            throw new Error(
                "Unable to load catalogue data"
            );
        }

        return response.json();
    }

    function normalize(value) {
        return String(value || "")
            .trim()
            .toLowerCase();
    }

    function safeLimit(value, fallback = 10) {
        const numeric =
            Number.parseInt(
                value,
                10
            );

        if (!Number.isFinite(numeric)) {
            return fallback;
        }

        return Math.max(
            1,
            Math.min(
                20,
                numeric
            )
        );
    }

    function pickSearchProduct(item) {
        return {
            id:
                item.id ?? null,
            title:
                item.title ?? null,
            part_number:
                item.part_number ??
                null,
            brand:
                item.brand?.name ??
                null,
            category:
                item.category?.name ??
                null,
            vehicle_count:
                item.vehicle_count ??
                null,
            url:
                item.url
                    ? new URL(
                        item.url,
                        location.origin
                    ).href
                    : null,
            image:
                item.image
                    ? new URL(
                        "/assets/images/products/" +
                            item.image,
                        location.origin
                    ).href
                    : null
        };
    }

    async function searchCatalogue(
        input,
        signal
    ) {
        const query =
            normalize(
                input?.query
            );

        if (!query) {
            return {
                results: [],
                message:
                    "Provide a product name, part number, SKU, brand, category, vehicle, or keyword."
            };
        }

        let search;

        try {
            const summary =
                await fetchJson(
                    AGENT_PRODUCTS_SUMMARY_URL,
                    signal
                );

            search =
                Array.isArray(summary)
                    ? summary
                    : [];
        } catch {
            search =
                await fetchJson(
                    CATALOGUE_URL,
                    signal
                );
        }

        const terms =
            query
                .split(/\s+/)
                .filter(
                    (term) =>
                        term.length >= 2
                );

        const matches =
            Array.isArray(search)
                ? search
                    .filter(
                        (item) => {
                            const haystack =
                                JSON.stringify(
                                    item
                                ).toLowerCase();

                            return terms.every(
                                (term) =>
                                    haystack.includes(
                                        term
                                    )
                            );
                        }
                    )
                    .slice(
                        0,
                        safeLimit(
                            input?.limit
                        )
                    )
                    .map(
                        pickSearchProduct
                    )
                : [];

        return {
            query:
                input.query,
            count:
                matches.length,
            results:
                matches,
            catalogue:
                new URL(
                    CATALOGUE_PAGE,
                    location.origin
                ).href
        };
    }

    async function findVehicle(
        input,
        signal
    ) {
        const query =
            normalize(
                input?.query
            );

        if (!query) {
            return {
                results: [],
                message:
                    "Provide a vehicle name, model, manufacturer, or slug."
            };
        }

        let vehicles;

        try {
            const index =
                await fetchJson(
                    AGENT_VEHICLE_INDEX_URL,
                    signal
                );

            vehicles =
                Object.entries(
                    index || {}
                ).map(
                    ([id, value]) => ({
                        id,
                        slug:
                            value?.slug ||
                            id,
                        model:
                            value?.model ||
                            "",
                        manufacturer:
                            value?.manufacturer ||
                            "",
                        variant:
                            value?.variant ||
                            "",
                        vehicle_type:
                            value?.vehicle_type ||
                            "",
                        product_count:
                            value?.product_count ||
                            0,
                        product_ids:
                            Array.isArray(
                                value?.product_ids
                            )
                                ? value.product_ids
                                : [],
                        brand_ids:
                            Array.isArray(
                                value?.brand_ids
                            )
                                ? value.brand_ids
                                : [],
                        category_ids:
                            Array.isArray(
                                value?.category_ids
                            )
                                ? value.category_ids
                                : [],
                        url:
                            value?.url ||
                            null
                    })
                );
        } catch {
            vehicles =
                await fetchJson(
                    VEHICLES_URL,
                    signal
                );
        }

        const matches =
            Array.isArray(
                vehicles
            )
                ? vehicles
                    .filter(
                        (vehicle) => {
                            const searchable =
                                JSON.stringify(
                                    vehicle
                                ).toLowerCase();

                            return searchable.includes(
                                query
                            );
                        }
                    )
                    .slice(
                        0,
                        safeLimit(
                            input?.limit
                        )
                    )
                    .map(
                        (vehicle) => ({
                            id:
                                vehicle.id ??
                                null,
                            slug:
                                vehicle.slug ??
                                null,
                            model:
                                vehicle.model ??
                                null,
                            manufacturer:
                                vehicle.manufacturer?.name ??
                                null,
                            variant:
                                vehicle.variant ??
                                null,
                            year_from:
                                vehicle.year_from ??
                                null,
                            year_to:
                                vehicle.year_to ??
                                null,
                            vehicle_type:
                                vehicle.vehicle_type ??
                                null,
                            description:
                                vehicle.description ||
                                vehicle.short_description ||
                                null,
                            url:
                                vehicle.slug
                                    ? new URL(
                                        "/en/vehicles/" +
                                            vehicle.slug +
                                            ".html",
                                        location.origin
                                    ).href
                                    : null
                        })
                    )
                : [];

        return {
            query:
                input.query,
            count:
                matches.length,
            results:
                matches
        };
    }

    async function listBrands(
        input,
        signal
    ) {
        const query =
            normalize(
                input?.query
            );

        let brands;

        try {
            const index =
                await fetchJson(
                    AGENT_BRAND_INDEX_URL,
                    signal
                );

            brands =
                Object.entries(
                    index || {}
                ).map(
                    ([id, value]) => ({
                        id,
                        name:
                            value?.name ||
                            id,
                        product_count:
                            value?.product_count ||
                            0,
                        product_ids:
                            Array.isArray(
                                value?.product_ids
                            )
                                ? value.product_ids
                                : [],
                        vehicle_names:
                            Array.isArray(
                                value?.vehicle_names
                            )
                                ? value.vehicle_names
                                : [],
                        category_ids:
                            Array.isArray(
                                value?.category_ids
                            )
                                ? value.category_ids
                                : [],
                        url:
                            value?.url ||
                            null
                    })
                );
        } catch {
            brands =
                await fetchJson(
                    BRANDS_URL,
                    signal
                );
        }

        const matches =
            Array.isArray(
                brands
            )
                ? brands
                    .filter(
                        (brand) => {
                            if (!query) {
                                return true;
                            }

                            return JSON.stringify(
                                brand
                            )
                                .toLowerCase()
                                .includes(
                                    query
                                );
                        }
                    )
                    .slice(
                        0,
                        safeLimit(
                            input?.limit,
                            20
                        )
                    )
                : [];

        return {
            query:
                input?.query ||
                "",
            count:
                matches.length,
            results:
                matches
        };
    }

    async function listCategories(
        input,
        signal
    ) {
        const query =
            normalize(
                input?.query
            );

        let categories;

        try {
            const index =
                await fetchJson(
                    AGENT_CATEGORY_INDEX_URL,
                    signal
                );

            categories =
                Object.entries(
                    index || {}
                ).map(
                    ([id, value]) => ({
                        id,
                        name:
                            value?.name ||
                            id,
                        product_count:
                            value?.product_count ||
                            0,
                        product_ids:
                            Array.isArray(
                                value?.product_ids
                            )
                                ? value.product_ids
                                : [],
                        brand_ids:
                            Array.isArray(
                                value?.brand_ids
                            )
                                ? value.brand_ids
                                : [],
                        vehicle_names:
                            Array.isArray(
                                value?.vehicle_names
                            )
                                ? value.vehicle_names
                                : [],
                        subcategory_ids:
                            Array.isArray(
                                value?.subcategory_ids
                            )
                                ? value.subcategory_ids
                                : [],
                        url:
                            value?.url ||
                            null
                    })
                );
        } catch {
            categories =
                await fetchJson(
                    CATEGORIES_URL,
                    signal
                );
        }

        const matches =
            Array.isArray(
                categories
            )
                ? categories
                    .filter(
                        (category) => {
                            if (!query) {
                                return true;
                            }

                            return JSON.stringify(
                                category
                            )
                                .toLowerCase()
                                .includes(
                                    query
                                );
                        }
                    )
                    .slice(
                        0,
                        safeLimit(
                            input?.limit,
                            20
                        )
                    )
                : [];

        return {
            query:
                input?.query ||
                "",
            count:
                matches.length,
            results:
                matches
        };
    }

    async function getCatalogueResources() {
        return {
            products:
                new URL(
                    PRODUCTS_URL,
                    location.origin
                ).href,
            search:
                new URL(
                    CATALOGUE_URL,
                    location.origin
                ).href,
            part_index:
                new URL(
                    AGENT_PART_INDEX_URL,
                    location.origin
                ).href,
            brand_index:
                new URL(
                    AGENT_BRAND_INDEX_URL,
                    location.origin
                ).href,
            category_index:
                new URL(
                    AGENT_CATEGORY_INDEX_URL,
                    location.origin
                ).href,
            vehicle_index:
                new URL(
                    AGENT_VEHICLE_INDEX_URL,
                    location.origin
                ).href,
            products_summary:
                new URL(
                    AGENT_PRODUCTS_SUMMARY_URL,
                    location.origin
                ).href,
            vehicles:
                new URL(
                    VEHICLES_URL,
                    location.origin
                ).href,
            brands:
                new URL(
                    BRANDS_URL,
                    location.origin
                ).href,
            categories:
                new URL(
                    CATEGORIES_URL,
                    location.origin
                ).href,
            catalogue:
                new URL(
                    CATALOGUE_PAGE,
                    location.origin
                ).href
        };
    }

    async function openCatalogueSection(
        input
    ) {
        const target =
            normalize(
                input?.section
            );

        const routes = {
            products:
                "/en/products.html",
            catalogue:
                "/en/products.html",
            brands:
                "/en/brands.html",
            categories:
                "/en/categories.html",
            vehicles:
                "/en/vehicles.html"
        };

        const path =
            routes[target];

        if (!path) {
            return {
                error:
                    "Unknown section",
                available_sections:
                    Object.keys(
                        routes
                    )
            };
        }

        return {
            section:
                target,
            url:
                new URL(
                    path,
                    location.origin
                ).href
        };
    }

    const tools = [
        {
            name:
                "search_catalogue",
            title:
                "Search Souviks Catalogue",
            description:
                "Search the Souviks catalogue by product name, part number, SKU, brand, category, vehicle, or related text.",
            inputSchema: {
                type:
                    "object",
                properties: {
                    query: {
                        type:
                            "string",
                        description:
                            "The product, part number, SKU, brand, category, vehicle, or keyword to search for."
                    },
                    limit: {
                        type:
                            "integer",
                        minimum:
                            1,
                        maximum:
                            20,
                        default:
                            10,
                        description:
                            "Maximum number of matching catalogue records to return."
                    }
                },
                required: [
                    "query"
                ]
            },
            annotations: {
                readOnlyHint:
                    true,
                untrustedContentHint:
                    true,
                consequentialHint:
                    false
            },
            execute:
                async (
                    input,
                    { signal }
                ) =>
                    JSON.stringify(
                        await searchCatalogue(
                            input,
                            signal
                        ),
                        null,
                        2
                    )
        },
        {
            name:
                "find_vehicle",
            title:
                "Find Vehicle Applications",
            description:
                "Find Souviks vehicle records and vehicle application information by model, manufacturer, variant, or related text.",
            inputSchema: {
                type:
                    "object",
                properties: {
                    query: {
                        type:
                            "string",
                        description:
                            "Vehicle model, manufacturer, variant, or keyword."
                    },
                    limit: {
                        type:
                            "integer",
                        minimum:
                            1,
                        maximum:
                            20,
                        default:
                            10
                    }
                },
                required: [
                    "query"
                ]
            },
            annotations: {
                readOnlyHint:
                    true,
                untrustedContentHint:
                    true,
                consequentialHint:
                    false
            },
            execute:
                async (
                    input,
                    { signal }
                ) =>
                    JSON.stringify(
                        await findVehicle(
                            input,
                            signal
                        ),
                        null,
                        2
                    )
        },
        {
            name:
                "list_brands",
            title:
                "List Souviks Brands",
            description:
                "List or search brands represented in the Souviks catalogue.",
            inputSchema: {
                type:
                    "object",
                properties: {
                    query: {
                        type:
                            "string",
                        description:
                            "Optional brand search term."
                    },
                    limit: {
                        type:
                            "integer",
                        minimum:
                            1,
                        maximum:
                            20,
                        default:
                            20
                    }
                }
            },
            annotations: {
                readOnlyHint:
                    true,
                untrustedContentHint:
                    true,
                consequentialHint:
                    false
            },
            execute:
                async (
                    input,
                    { signal }
                ) =>
                    JSON.stringify(
                        await listBrands(
                            input,
                            signal
                        ),
                        null,
                        2
                    )
        },
        {
            name:
                "list_categories",
            title:
                "List Souviks Categories",
            description:
                "List or search product categories represented in the Souviks catalogue.",
            inputSchema: {
                type:
                    "object",
                properties: {
                    query: {
                        type:
                            "string",
                        description:
                            "Optional category search term."
                    },
                    limit: {
                        type:
                            "integer",
                        minimum:
                            1,
                        maximum:
                            20,
                        default:
                            20
                    }
                }
            },
            annotations: {
                readOnlyHint:
                    true,
                untrustedContentHint:
                    true,
                consequentialHint:
                    false
            },
            execute:
                async (
                    input,
                    { signal }
                ) =>
                    JSON.stringify(
                        await listCategories(
                            input,
                            signal
                        ),
                        null,
                        2
                    )
        },
        {
            name:
                "get_catalogue_resources",
            title:
                "Get Catalogue Resources",
            description:
                "Return the Souviks machine-readable products, search, vehicles, brands, categories, and human catalogue URLs.",
            inputSchema: {
                type:
                    "object",
                properties: {}
            },
            annotations: {
                readOnlyHint:
                    true,
                untrustedContentHint:
                    false,
                consequentialHint:
                    false
            },
            execute:
                async () =>
                    JSON.stringify(
                        await getCatalogueResources(),
                        null,
                        2
                    )
        },
        {
            name:
                "open_catalogue_section",
            title:
                "Open Souviks Catalogue Section",
            description:
                "Return the URL for a Souviks catalogue section such as products, brands, categories, or vehicles.",
            inputSchema: {
                type:
                    "object",
                properties: {
                    section: {
                        type:
                            "string",
                        enum: [
                            "products",
                            "catalogue",
                            "brands",
                            "categories",
                            "vehicles"
                        ],
                        description:
                            "Catalogue section to open."
                    }
                },
                required: [
                    "section"
                ]
            },
            annotations: {
                readOnlyHint:
                    true,
                untrustedContentHint:
                    false,
                consequentialHint:
                    false
            },
            execute:
                async (
                    input
                ) =>
                    JSON.stringify(
                        await openCatalogueSection(
                            input
                        ),
                        null,
                        2
                    )
        }
    ];

    async function registerTools() {
        if (
            typeof MODEL_CONTEXT
                .registerTool ===
                "function"
        ) {
            for (
                const tool of tools
            ) {
                try {
                    await MODEL_CONTEXT.registerTool(
                        tool
                    );
                } catch (
                    error
                ) {
                    if (
                        !String(
                            error?.message ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                "already"
                            )
                    ) {
                        console.warn(
                            "[Souviks WebMCP]",
                            "Unable to register",
                            tool.name,
                            error
                        );
                    }
                }
            }

            return;
        }

        if (
            window.navigator.modelContext &&
            typeof window.navigator
                .modelContext
                .provideContext ===
                "function"
        ) {
            await window.navigator.modelContext.provideContext(
                {
                    tools
                }
            );
        }
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            registerTools,
            {
                once: true
            }
        );
    } else {
        registerTools();
    }
})();
