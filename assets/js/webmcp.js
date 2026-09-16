/*
==========================================================
SOUVIKS WEBSITE
WEBMCP / BROWSER AGENT TOOLS
Version : 1.0
==========================================================
*/

(function () {

    "use strict";

    function initialiseWebMCP() {

        if (
            !navigator.modelContext ||
            typeof navigator.modelContext.registerTool !== "function"
        ) {
            return;
        }

        const modelContext =
            navigator.modelContext ||
            document.modelContext;

        if (
            !modelContext ||
            typeof modelContext.registerTool !== "function"
        ) {
            return;
        }

        const controllers = [];

        const jsonResponse = (data) => ({
            content: [{
                type: "text",
                text: JSON.stringify(data)
            }]
        });

        const normalise = (value) =>
            String(value ?? "")
                .trim()
                .toLowerCase();

        const getProducts = async () => {
            const response = await fetch(
                "/assets/data/products.json",
                {
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            if (!response.ok) {
                throw new Error("Unable to load product catalogue.");
            }

            return await response.json();
        };

        const register = async (tool) => {
            const controller = new AbortController();

            try {
                if (
                    navigator.modelContext &&
                    typeof navigator.modelContext.registerTool ===
                        "function"
                ) {
                    await navigator.modelContext.registerTool(
                        tool,
                        {
                            signal: controller.signal
                        }
                    );
                } else {
                    await document.modelContext.registerTool(
                        tool,
                        {
                            signal: controller.signal
                        }
                    );
                }

                controllers.push(controller);

            } catch (error) {
                console.warn(
                    "Souviks WebMCP tool registration failed:",
                    tool.name,
                    error
                );
            }
        };

        Promise.all([
            register({
                name: "souviks_search",
                title: "Search Souviks catalogue",
                description:
                    "Search the Souviks commercial vehicle spare-parts catalogue by part number, product name, brand, category, vehicle or keywords.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description:
                                "Part number, product name, brand, category, vehicle or keyword to search for."
                        },
                        limit: {
                            type: "integer",
                            minimum: 1,
                            maximum: 20,
                            default: 10
                        }
                    },
                    required: ["query"],
                    additionalProperties: false
                },
                annotations: {
                    readOnlyHint: true,
                    untrustedContentHint: true
                },
                execute: async ({ query, limit = 10 }) => {

                    const searchIndex = await fetch(
                        "/assets/data/search.json",
                        {
                            headers: {
                                "Accept": "application/json"
                            }
                        }
                    ).then((response) => {

                        if (!response.ok) {
                            throw new Error(
                                "Unable to load catalogue search index."
                            );
                        }

                        return response.json();

                    });

                    const needle = normalise(query);

                    if (!needle) {
                        return jsonResponse([]);
                    }

                    const results = searchIndex
                        .map((item) => {

                            const title = normalise(item.title);
                            const subtitle = normalise(item.subtitle);
                            const partNumber = normalise(
                                item.part_number
                            );
                            const keywords = normalise(
                                Array.isArray(item.keywords)
                                    ? item.keywords.join(" ")
                                    : item.keywords
                            );

                            let score = 0;

                            if (partNumber === needle) {
                                score += 100;
                            } else if (
                                partNumber.includes(needle)
                            ) {
                                score += 70;
                            }

                            if (title.includes(needle)) {
                                score += 50;
                            }

                            if (subtitle.includes(needle)) {
                                score += 25;
                            }

                            if (keywords.includes(needle)) {
                                score += 20;
                            }

                            return {
                                item,
                                score
                            };

                        })
                        .filter(
                            (entry) => entry.score > 0
                        )
                        .sort(
                            (a, b) =>
                                b.score - a.score
                        )
                        .slice(0, Math.min(limit, 20))
                        .map(
                            (entry) => entry.item
                        );

                    return jsonResponse(results);

                }
            }),

            register({
                name: "souviks_get_product",
                title: "Get Souviks product",
                description:
                    "Retrieve a Souviks product by its part number, product ID or catalogue slug.",
                inputSchema: {
                    type: "object",
                    properties: {
                        partNumber: {
                            type: "string"
                        },
                        id: {
                            type: "string"
                        },
                        slug: {
                            type: "string"
                        }
                    },
                    additionalProperties: false
                },
                annotations: {
                    readOnlyHint: true,
                    untrustedContentHint: true
                },
                execute: async ({
                    partNumber,
                    id,
                    slug
                }) => {

                    const products = await getProducts();

                    const targetPartNumber =
                        normalise(partNumber);

                    const targetId =
                        normalise(id);

                    const targetSlug =
                        normalise(slug);

                    const product = products.find(
                        (item) => {

                            if (
                                targetId &&
                                normalise(item.id) === targetId
                            ) {
                                return true;
                            }

                            if (
                                targetSlug &&
                                normalise(item.slug) === targetSlug
                            ) {
                                return true;
                            }

                            const itemPartNumber =
                                item.part_number ??
                                item.partNumber;

                            return (
                                targetPartNumber &&
                                normalise(itemPartNumber) ===
                                targetPartNumber
                            );

                        }
                    );

                    if (!product) {
                        return jsonResponse({
                            found: false
                        });
                    }

                    return jsonResponse({
                        found: true,
                        product
                    });

                }
            }),

            register({
                name: "souviks_get_catalogue",
                title: "Get Souviks catalogue data",
                description:
                    "Retrieve a machine-readable Souviks catalogue resource: products, brands, categories, vehicles or the search index.",
                inputSchema: {
                    type: "object",
                    properties: {
                        resource: {
                            type: "string",
                            enum: [
                                "products",
                                "brands",
                                "categories",
                                "vehicles",
                                "search"
                            ]
                        }
                    },
                    required: ["resource"],
                    additionalProperties: false
                },
                annotations: {
                    readOnlyHint: true,
                    untrustedContentHint: true
                },
                execute: async ({ resource }) => {

                    const files = {
                        products:
                            "/assets/data/products.json",
                        brands:
                            "/assets/data/brands.json",
                        categories:
                            "/assets/data/categories.json",
                        vehicles:
                            "/assets/data/vehicles.json",
                        search:
                            "/assets/data/search.json"
                    };

                    const path = files[resource];

                    if (!path) {
                        throw new Error(
                            "Unknown catalogue resource."
                        );
                    }

                    const response = await fetch(
                        path,
                        {
                            headers: {
                                "Accept": "application/json"
                            }
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            "Unable to load catalogue resource."
                        );
                    }

                    return jsonResponse(
                        await response.json()
                    );

                }
            }),

            register({
                name: "souviks_navigate",
                title: "Navigate Souviks",
                description:
                    "Navigate the current browser page to a Souviks catalogue destination such as products, brands, categories, vehicles or the home page.",
                inputSchema: {
                    type: "object",
                    properties: {
                        destination: {
                            type: "string",
                            enum: [
                                "home",
                                "products",
                                "brands",
                                "categories",
                                "vehicles"
                            ]
                        }
                    },
                    required: ["destination"],
                    additionalProperties: false
                },
                annotations: {
                    readOnlyHint: false,
                    consequentialHint: true
                },
                execute: async ({ destination }) => {

                    const destinations = {
                        home: "/en/",
                        products: "/en/products.html",
                        brands: "/en/brands.html",
                        categories: "/en/categories.html",
                        vehicles: "/en/vehicles.html"
                    };

                    const path =
                        destinations[destination];

                    if (!path) {
                        throw new Error(
                            "Unknown Souviks destination."
                        );
                    }

                    window.location.assign(path);

                    return jsonResponse({
                        navigatedTo:
                            new URL(
                                path,
                                window.location.origin
                            ).href
                    });

                }
            })
        ]).catch((error) => {
            console.warn(
                "Souviks WebMCP initialisation failed:",
                error
            );
        });

        window.souviksWebMCP = {
            controllers,
            unregister() {
                controllers.forEach(
                    (controller) => controller.abort()
                );
                controllers.length = 0;
            }
        };

    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialiseWebMCP,
            { once: true }
        );
    } else {
        initialiseWebMCP();
    }

})();
