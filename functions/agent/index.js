/*
==========================================================
SOUVIKS AGENT INFRASTRUCTURE
==========================================================

A2A discovery and HTTP+JSON handling
OAuth/OIDC discovery
OAuth Protected Resource Metadata
==========================================================
*/

const MCP_ENDPOINT =
    "https://www.souviks.co.in/mcp";

const MCP_PROTOCOL_VERSION =
    "2026-07-28";

const MCP_SERVER_INFO = {
    name: "Souviks Catalogue MCP Server",
    version: "1.0.0"
};

const MCP_CARD = {
    $schema:
        "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "co.souviks/catalogue",
    version: "1.0.0",
    description:
        "MCP server for discovering Souviks commercial vehicle spare parts and catalogue information.",
    title: "Souviks Catalogue MCP Server",
    websiteUrl:
        "https://www.souviks.co.in/",
    serverInfo: MCP_SERVER_INFO,
    transport: {
        type: "streamable-http",
        endpoint: MCP_ENDPOINT,
        url: MCP_ENDPOINT,
        protocolVersion:
            MCP_PROTOCOL_VERSION
    },
    remotes: [
        {
            type: "streamable-http",
            url: MCP_ENDPOINT,
            supportedProtocolVersions: [
                MCP_PROTOCOL_VERSION
            ]
        }
    ],
    capabilities: {
        tools: {},
        resources: {},
        prompts: {}
    },
    repository: {
        url:
            "https://github.com/mssouviks-tech/souviks-website",
        source: "github"
    }
};

function mcpHeaders(
    contentType = "application/json; charset=utf-8"
) {
    return {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
            "Content-Type, Accept, Authorization, MCP-Protocol-Version, MCP-Session-Id"
    };
}

function mcpJson(
    data,
    status = 200
) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: mcpHeaders()
        }
    );
}

function validMcpOrigin(request) {
    const origin =
        request.headers.get("Origin");

    if (!origin) {
        return true;
    }

    try {
        const parsed =
            new URL(origin);

        return (
            parsed.protocol === "https:" &&
            (
                parsed.hostname ===
                    "souviks.co.in" ||
                parsed.hostname ===
                    "www.souviks.co.in"
            )
        );
    } catch {
        return false;
    }
}

function mcpError(
    id,
    code,
    message
) {
    return mcpJson({
        jsonrpc: "2.0",
        id,
        error: {
            code,
            message
        }
    });
}

const MCP_TOOLS = [
    {
        name: "search_catalogue",
        title: "Search Souviks Catalogue",
        description:
            "Search the public Souviks product catalogue by product name, part number, manufacturer part number, SKU, brand, category, vehicle, or related text. Exact part-number lookups use the compact agent index when available.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description:
                        "Product or catalogue search query."
                },
                limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: 20,
                    default: 10
                }
            },
            required: [
                "query"
            ]
        }
    },
    {
        name: "find_part",
        title: "Find Part by Exact Identifier",
        description:
            "Find Souviks catalogue products by exact internal product ID, part number, or manufacturer part number using the compact part index.",
        inputSchema: {
            type: "object",
            properties: {
                identifier: {
                    type: "string",
                    description:
                        "Exact Souviks product ID, part number, or manufacturer part number."
                }
            },
            required: [
                "identifier"
            ]
        }
    },
    {
        name: "find_vehicle",
        title: "Find Vehicle Applications",
        description:
            "Find Souviks vehicle application records and associated product IDs using the compact vehicle index.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description:
                        "Vehicle slug, model, manufacturer, or related search text."
                },
                limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: 20,
                    default: 10
                }
            },
            required: [
                "query"
            ]
        }
    },
    {
        name: "list_brand_products",
        title: "List Products by Brand",
        description:
            "Return products associated with a Souviks brand using the compact brand index.",
        inputSchema: {
            type: "object",
            properties: {
                brand: {
                    type: "string",
                    description:
                        "Brand ID or brand name."
                },
                limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: 100,
                    default: 50
                }
            },
            required: [
                "brand"
            ]
        }
    },
    {
        name: "list_category_products",
        title: "List Products by Category",
        description:
            "Return products associated with a Souviks category using the compact category index.",
        inputSchema: {
            type: "object",
            properties: {
                category: {
                    type: "string",
                    description:
                        "Category ID or category name."
                },
                limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: 100,
                    default: 50
                }
            },
            required: [
                "category"
            ]
        }
    },
    {
        name: "get_catalogue_resources",
        title: "Get Souviks Catalogue Resources",
        description:
            "Return the public machine-readable Souviks catalogue and compact agent-index URLs.",
        inputSchema: {
            type: "object",
            properties: {}
        }
    }
];

async function fetchJsonWithFallback(paths) {
    for (const path of paths) {
        try {
            const response = await fetch(
                "https://www.souviks.co.in" + path,
                {
                    headers: {
                        Accept: "application/json"
                    }
                }
            );

            if (!response.ok) {
                continue;
            }

            return await response.json();
        } catch {
            continue;
        }
    }

    throw new Error(
        "Catalogue data unavailable"
    );
}

function compactProductSearchRecord(item) {
    return {
        id: item.id ?? "",
        part_number: item.part_number ?? "",
        manufacturer_part_number:
            item.manufacturer_part_number ?? "",
        product_name:
            item.product_name ??
            item.name ??
            item.title ??
            "",
        brand_id:
            item.brand_id ??
            item.brand?.id ??
            "",
        brand_name:
            item.brand_name ??
            item.brand?.name ??
            "",
        category_id:
            item.category_id ??
            item.category?.id ??
            "",
        category_name:
            item.category_name ??
            item.category?.name ??
            "",
        subcategory_id:
            item.subcategory_id ??
            "",
        subcategory_name:
            item.subcategory_name ??
            "",
        vehicles:
            Array.isArray(item.vehicles)
                ? item.vehicles
                : [],
        applications:
            Array.isArray(item.applications)
                ? item.applications
                : [],
        url:
            item.seo?.canonical ??
            item.url ??
            (item.slug
                ? "https://www.souviks.co.in/products/" +
                  item.slug +
                  "/"
                : "")
    };
}

async function mcpSearchCatalogue(query, limit) {
    const normalized = String(query || "").trim();

    if (!normalized) {
        return [];
    }

    const maxResults = Math.max(
        1,
        Math.min(
            20,
            Number.isFinite(limit)
                ? limit
                : 10
        )
    );

    const lower = normalized.toLowerCase();

    try {
        const partIndex =
            await fetchJsonWithFallback([
                "/assets/data/agent/part-index.json"
            ]);

        const exact =
            partIndex[lower];

        if (Array.isArray(exact) && exact.length) {
            return exact
                .slice(0, maxResults)
                .map(compactProductSearchRecord);
        }
    } catch {
        // Fall back to existing search data.
    }

    try {
        const summary =
            await fetchJsonWithFallback([
                "/assets/data/agent/products-summary.json",
                "/assets/data/search.json"
            ]);

        const terms = lower
            .split(/\s+/)
            .filter(
                (term) =>
                    term.length >= 2
            );

        return (Array.isArray(summary)
            ? summary
            : []
        )
            .filter((item) => {
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
            })
            .slice(
                0,
                maxResults
            )
            .map(
                compactProductSearchRecord
            );
    } catch {
        throw new Error(
            "Catalogue data unavailable"
        );
    }
}

async function mcpHandleToolCall(
    name,
    argumentsObject
) {
    switch (name) {
        case "search_catalogue": {
            const matches =
                await mcpSearchCatalogue(
                    argumentsObject?.query,
                    argumentsObject?.limit
                );

            return {
                content: [
                    {
                        type: "text",
                        text:
                            JSON.stringify(
                                {
                                    matches,
                                    catalogue:
                                        "https://www.souviks.co.in/en/products.html"
                                },
                                null,
                                2
                            )
                    }
                ],
                structuredContent: {
                    matches
                }
            };
        }

        case "find_part": {
            const identifier =
                String(
                    argumentsObject?.identifier ||
                    ""
                ).trim().toLowerCase();

            if (!identifier) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "An exact identifier is required."
                        }
                    ]
                };
            }

            const index =
                await fetchJsonWithFallback([
                    "/assets/data/agent/part-index.json"
                ]);

            const matches =
                Array.isArray(index[identifier])
                    ? index[identifier]
                    : [];

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                matches:
                                    matches.map(
                                        compactProductSearchRecord
                                    )
                            },
                            null,
                            2
                        )
                    }
                ],
                structuredContent: {
                    matches
                }
            };
        }

        case "find_vehicle": {
            const query =
                String(
                    argumentsObject?.query || ""
                ).trim().toLowerCase();

            const limit =
                Math.max(
                    1,
                    Math.min(
                        20,
                        Number.isFinite(
                            argumentsObject?.limit
                        )
                            ? argumentsObject.limit
                            : 10
                    )
                );

            const index =
                await fetchJsonWithFallback([
                    "/assets/data/agent/vehicle-index.json",
                    "/assets/data/vehicles.json"
                ]);

            const entries =
                Array.isArray(index)
                    ? index.map(
                        (item) => ({
                            ...(item || {}),
                            __key:
                                String(
                                    item?.id ??
                                    item?.slug ??
                                    ""
                                )
                                    .toLowerCase()
                        })
                    )
                    : Object.entries(
                        index || {}
                    ).map(
                        ([key, value]) => ({
                            ...(value || {}),
                            id:
                                value?.id ??
                                key,
                            slug:
                                value?.slug ??
                                key,
                            __key:
                                key.toLowerCase()
                        })
                    );

            const matches =
                entries
                    .filter(
                        (item) => {
                            if (!query) {
                                return false;
                            }

                            return JSON.stringify(
                                item
                            )
                                .toLowerCase()
                                .includes(
                                    query
                                );
                        }
                    )
                    .slice(
                        0,
                        limit
                    )
                    .map(
                        (item) => {
                            const {
                                __key,
                                ...publicItem
                            } = item;

                            return publicItem;
                        }
                    );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                query,
                                matches
                            },
                            null,
                            2
                        )
                    }
                ],
                structuredContent: {
                    matches
                }
            };
        }

        case "list_brand_products": {
            const requested =
                String(
                    argumentsObject?.brand || ""
                ).trim().toLowerCase();

            const limit =
                Math.max(
                    1,
                    Math.min(
                        100,
                        Number.isFinite(
                            argumentsObject?.limit
                        )
                            ? argumentsObject.limit
                            : 50
                    )
                );

            const index =
                await fetchJsonWithFallback([
                    "/assets/data/agent/brand-index.json"
                ]);

            const matchKey =
                Object.keys(
                    index || {}
                ).find(
                    (key) =>
                        key.toLowerCase() ===
                            requested ||
                        String(
                            index?.[key]?.name || ""
                        )
                            .toLowerCase() ===
                            requested
                );

            const brand =
                matchKey
                    ? index[matchKey]
                    : null;

            const ids =
                Array.isArray(
                    brand?.product_ids
                )
                    ? brand.product_ids
                    : [];

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                brand:
                                    brand
                                        ? {
                                            id:
                                                matchKey,
                                            name:
                                                brand.name,
                                            product_count:
                                                brand.product_count,
                                            product_ids:
                                                ids.slice(
                                                    0,
                                                    limit
                                                ),
                                            url:
                                                brand.url
                                        }
                                        : null
                            },
                            null,
                            2
                        )
                    }
                ],
                structuredContent: {
                    brand:
                        brand
                            ? {
                                id:
                                    matchKey,
                                name:
                                    brand.name,
                                product_count:
                                    brand.product_count,
                                product_ids:
                                    ids.slice(
                                        0,
                                        limit
                                    )
                            }
                            : null
                }
            };
        }

        case "list_category_products": {
            const requested =
                String(
                    argumentsObject?.category || ""
                ).trim().toLowerCase();

            const limit =
                Math.max(
                    1,
                    Math.min(
                        100,
                        Number.isFinite(
                            argumentsObject?.limit
                        )
                            ? argumentsObject.limit
                            : 50
                    )
                );

            const index =
                await fetchJsonWithFallback([
                    "/assets/data/agent/category-index.json"
                ]);

            const matchKey =
                Object.keys(
                    index || {}
                ).find(
                    (key) =>
                        key.toLowerCase() ===
                            requested ||
                        String(
                            index?.[key]?.name || ""
                        )
                            .toLowerCase() ===
                            requested
                );

            const category =
                matchKey
                    ? index[matchKey]
                    : null;

            const ids =
                Array.isArray(
                    category?.product_ids
                )
                    ? category.product_ids
                    : [];

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                category:
                                    category
                                        ? {
                                            id:
                                                matchKey,
                                            name:
                                                category.name,
                                            product_count:
                                                category.product_count,
                                            product_ids:
                                                ids.slice(
                                                    0,
                                                    limit
                                                ),
                                            url:
                                                category.url
                                        }
                                        : null
                            },
                            null,
                            2
                        )
                    }
                ],
                structuredContent: {
                    category:
                        category
                            ? {
                                id:
                                    matchKey,
                                name:
                                    category.name,
                                product_count:
                                    category.product_count,
                                product_ids:
                                    ids.slice(
                                        0,
                                        limit
                                    )
                            }
                            : null
                }
            };
        }

        case "get_catalogue_resources":
            return {
                content: [
                    {
                        type: "text",
                        text:
                            JSON.stringify(
                                {
                                    products:
                                        "https://www.souviks.co.in/assets/data/products.json",
                                    brands:
                                        "https://www.souviks.co.in/assets/data/brands.json",
                                    categories:
                                        "https://www.souviks.co.in/assets/data/categories.json",
                                    vehicles:
                                        "https://www.souviks.co.in/assets/data/vehicles.json",
                                    search:
                                        "https://www.souviks.co.in/assets/data/search.json",
                                    part_index:
                                        "https://www.souviks.co.in/assets/data/agent/part-index.json",
                                    brand_index:
                                        "https://www.souviks.co.in/assets/data/agent/brand-index.json",
                                    category_index:
                                        "https://www.souviks.co.in/assets/data/agent/category-index.json",
                                    vehicle_index:
                                        "https://www.souviks.co.in/assets/data/agent/vehicle-index.json",
                                    products_summary:
                                        "https://www.souviks.co.in/assets/data/agent/products-summary.json",
                                    catalogue:
                                        "https://www.souviks.co.in/en/products.html"
                                },
                                null,
                                2
                            )
                    }
                ]
            };

        default:
            throw new Error(
                "Unknown tool: " + name
            );
    }
}

async function handleMcpRequest(
    request
) {
    if (!validMcpOrigin(request)) {
        return mcpJson(
            {
                error:
                    "Forbidden Origin"
            },
            403
        );
    }

    if (
        request.method === "OPTIONS"
    ) {
        return new Response(
            null,
            {
                status: 204,
                headers: mcpHeaders()
            }
        );
    }

    if (
        request.method === "GET"
    ) {
        return new Response(
            null,
            {
                status: 405,
                headers: {
                    ...mcpHeaders(),
                    Allow: "POST"
                }
            }
        );
    }

    if (
        request.method !== "POST"
    ) {
        return new Response(
            null,
            {
                status: 405,
                headers: {
                    ...mcpHeaders(),
                    Allow: "POST, OPTIONS"
                }
            }
        );
    }

    let payload;

    try {
        payload =
            await request.json();
    } catch {
        return mcpError(
            null,
            -32700,
            "Invalid JSON"
        );
    }

    const isJsonRpcRequest =
        payload?.jsonrpc === "2.0" &&
        typeof payload?.method === "string";

    if (!isJsonRpcRequest) {
        return mcpError(
            payload?.id ?? null,
            -32600,
            "Invalid Request"
        );
    }

    const id =
        Object.prototype.hasOwnProperty.call(
            payload,
            "id"
        )
            ? payload.id
            : null;

    switch (payload.method) {
        case "initialize":
            return mcpJson({
                jsonrpc: "2.0",
                id,
                result: {
                    protocolVersion:
                        MCP_PROTOCOL_VERSION,
                    capabilities: {
                        tools: {}
                    },
                    serverInfo:
                        MCP_SERVER_INFO,
                    instructions:
                        "Use the Souviks catalogue tools to discover public product data, brands, categories, vehicle applications, and catalogue resources."
                }
            });

        case "notifications/initialized":
            return new Response(
                null,
                {
                    status: 202,
                    headers:
                        mcpHeaders()
                }
            );

        case "tools/list":
            return mcpJson({
                jsonrpc: "2.0",
                id,
                result: {
                    tools:
                        MCP_TOOLS
                }
            });

        case "tools/call": {
            const name =
                payload?.params
                    ?.name;

            try {
                const result =
                    await mcpHandleToolCall(
                        name,
                        payload?.params
                            ?.arguments || {}
                    );

                return mcpJson({
                    jsonrpc: "2.0",
                    id,
                    result
                });
            } catch (error) {
                return mcpError(
                    id,
                    -32000,
                    error?.message ||
                        "Tool execution failed"
                );
            }
        }

        default:
            return mcpError(
                id,
                -32601,
                "Method not found"
            );
    }
}

const A2A_BASE_URL =
    "https://www.souviks.co.in/a2a";

const A2A_CARD = {
    name: "Souviks Catalogue Agent",
    description:
        "Agent for discovering Souviks commercial vehicle spare parts, brands, categories, vehicle applications, and catalogue information.",
    supportedInterfaces: [
        {
            url: A2A_BASE_URL,
            protocolBinding: "HTTP+JSON",
            protocolVersion: "1.0"
        }
    ],
    provider: {
        organization: "Souviks",
        url: "https://www.souviks.co.in/"
    },
    version: "1.0.0",
    documentationUrl:
        "https://www.souviks.co.in/.well-known/service-documentation.html",
    capabilities: {
        streaming: true,
        pushNotifications: false,
        extendedAgentCard: false
    },
    defaultInputModes: [
        "text/plain",
        "application/json"
    ],
    defaultOutputModes: [
        "text/plain",
        "application/json"
    ],
    skills: [
        {
            id: "catalogue-discovery",
            name: "Catalogue Discovery",
            description:
                "Find and describe Souviks products, brands, categories, and vehicle applications using the public catalogue.",
            tags: [
                "catalogue",
                "products",
                "brands",
                "categories",
                "vehicles"
            ],
            examples: [
                "Find Souviks products for Tata Signa.",
                "Show the available product categories."
            ],
            inputModes: [
                "text/plain"
            ],
            outputModes: [
                "text/plain"
            ]
        },
        {
            id: "part-identification",
            name: "Part Identification",
            description:
                "Help locate catalogue entries by part number, product ID, SKU, product name, brand, or related catalogue text.",
            tags: [
                "part-number",
                "sku",
                "mpn",
                "spare-parts",
                "identification"
            ],
            examples: [
                "Find part 27WH.",
                "Search for SKU SVKS000542."
            ],
            inputModes: [
                "text/plain"
            ],
            outputModes: [
                "text/plain"
            ]
        },
        {
            id: "catalogue-navigation",
            name: "Catalogue Navigation",
            description:
                "Direct agents to the appropriate Souviks product, brand, category, vehicle, and search resources.",
            tags: [
                "navigation",
                "search",
                "catalogue-links"
            ],
            examples: [
                "Where can I search the Souviks product catalogue?"
            ],
            inputModes: [
                "text/plain"
            ],
            outputModes: [
                "text/plain"
            ]
        }
    ]
};

function a2aHeaders(contentType = "application/a2a+json; charset=utf-8") {
    return {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
            "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization, A2A-Version, A2A-Extensions"
    };
}

function a2aJson(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: a2aHeaders()
    });
}

function a2aError(code, message, id = null, data = undefined) {
    const error = {
        jsonrpc: "2.0",
        id,
        error: {
            code,
            message
        }
    };

    if (data !== undefined) {
        error.error.data = data;
    }

    return a2aJson(error, code >= 400 ? 400 : 500);
}

function httpA2aError(status, message) {
    return new Response(
        JSON.stringify({
            error: {
                code: status,
                message
            }
        }),
        {
            status,
            headers: a2aHeaders()
        }
    );
}

function requestA2aVersion(request) {
    return request.headers.get("A2A-Version") || "1.0";
}

function validateA2aVersion(request) {
    const version = requestA2aVersion(request);

    if (version !== "1.0") {
        return httpA2aError(
            400,
            "Protocol Version Not Supported"
        );
    }

    return null;
}

function getRequestMessage(payload) {
    return (
        payload?.message ||
        payload?.params?.message ||
        payload?.params?.request?.message ||
        null
    );
}

function extractMessageText(payload) {
    const message = getRequestMessage(payload);

    if (!message || !Array.isArray(message.parts)) {
        return "";
    }

    return message.parts
        .map((part) => {
            if (typeof part?.text === "string") {
                return part.text;
            }

            if (typeof part?.data === "object" && part.data !== null) {
                return JSON.stringify(part.data);
            }

            return "";
        })
        .filter(Boolean)
        .join("\n")
        .trim();
}

function getContextId(payload) {
    const message = getRequestMessage(payload);

    return (
        message?.contextId ||
        payload?.contextId ||
        payload?.params?.contextId ||
        crypto.randomUUID()
    );
}

function getMessageId(payload) {
    const message = getRequestMessage(payload);

    return message?.messageId || crypto.randomUUID();
}

function pickProductFields(item) {
    return {
        id: item.id ?? null,
        sku: item.sku ?? null,
        mpn: item.mpn ?? item.part_number ?? null,
        name:
            item.name ??
            item.title ??
            item.product_name ??
            null,
        brand:
            item.brand?.name ??
            item.brand ??
            item.brand_name ??
            null,
        category:
            item.category?.name ??
            item.category ??
            item.category_name ??
            null,
        url: item.slug
            ? "https://www.souviks.co.in/en/products/" +
              item.slug
            : null
    };
}

async function catalogueAgentMessage(query) {
    const normalized = query.trim();

    if (!normalized) {
        return [
            "I can help discover Souviks catalogue information.",
            "",
            "Public catalogue resources:",
            "Products: https://www.souviks.co.in/assets/data/products.json",
            "Brands: https://www.souviks.co.in/assets/data/brands.json",
            "Categories: https://www.souviks.co.in/assets/data/categories.json",
            "Vehicles: https://www.souviks.co.in/assets/data/vehicles.json",
            "Search index: https://www.souviks.co.in/assets/data/search.json"
        ].join("\n");
    }

    try {
        let products;

        try {
            products =
                await fetchJsonWithFallback([
                    "/assets/data/agent/products-summary.json",
                    "/assets/data/search.json",
                    "/assets/data/products.json"
                ]);
        } catch {
            throw new Error(
                "Catalogue data unavailable"
            );
        }

        const terms = normalized
            .toLowerCase()
            .split(/\s+/)
            .filter((term) => term.length >= 2);

        const matches = Array.isArray(products)
            ? products
                .filter((item) => {
                    const haystack =
                        JSON.stringify(item).toLowerCase();

                    return terms.every(
                        (term) =>
                            haystack.includes(term)
                    );
                })
                .slice(0, 10)
            : [];

        if (!matches.length) {
            return [
                "No exact catalogue match was found for: " +
                    normalized,
                "",
                "Search the full catalogue:",
                "https://www.souviks.co.in/en/products.html",
                "https://www.souviks.co.in/assets/data/search.json"
            ].join("\n");
        }

        return [
            "Catalogue matches for: " + normalized,
            "",
            ...matches.map((item, index) => {
                const p =
                    pickProductFields(item);

                return [
                    (index + 1) +
                        ". " +
                        (p.name ||
                            "Unnamed product"),
                    p.sku
                        ? "   SKU: " +
                          p.sku
                        : "",
                    p.mpn
                        ? "   Part number: " +
                          p.mpn
                        : "",
                    p.brand
                        ? "   Brand: " +
                          p.brand
                        : "",
                    p.category
                        ? "   Category: " +
                          p.category
                        : "",
                    p.url
                        ? "   URL: " +
                          p.url
                        : ""
                ]
                    .filter(Boolean)
                    .join("\n");
            }),
            "",
            "Catalogue: https://www.souviks.co.in/en/products.html"
        ].join("\n");
    } catch {
        return [
            "The Souviks catalogue search service is temporarily unavailable.",
            "",
            "Public catalogue:",
            "https://www.souviks.co.in/en/products.html",
            "Product data:",
            "https://www.souviks.co.in/assets/data/products.json"
        ].join("\n");
    }
}

function makeAgentMessage(text, contextId, referenceTaskIds = []) {
    const message = {
        messageId: crypto.randomUUID(),
        role: "ROLE_AGENT",
        parts: [
            {
                text
            }
        ],
        contextId
    };

    if (referenceTaskIds.length) {
        message.referenceTaskIds =
            referenceTaskIds;
    }

    return message;
}

function makeTask(
    taskId,
    contextId,
    text,
    history = []
) {
    const now =
        new Date().toISOString();

    return {
        id: taskId,
        contextId,
        status: {
            state: "TASK_STATE_COMPLETED",
            message: makeAgentMessage(
                text,
                contextId
            ),
            timestamp: now
        },
        artifacts: [
            {
                artifactId:
                    crypto.randomUUID(),
                name:
                    "Souviks Catalogue Result",
                description:
                    "Catalogue search result produced by the Souviks Catalogue Agent.",
                parts: [
                    {
                        text
                    }
                ]
            }
        ],
        history
    };
}

function taskCacheKey(taskId) {
    return new Request(
        "https://www.souviks.co.in/__a2a/tasks/" +
            encodeURIComponent(taskId),
        {
            method: "GET"
        }
    );
}

async function saveTask(task) {
    const cache = caches.default;

    await cache.put(
        taskCacheKey(task.id),
        new Response(JSON.stringify(task), {
            status: 200,
            headers: {
                "Content-Type":
                    "application/a2a+json; charset=utf-8",
                "Cache-Control":
                    "public, max-age=3600"
            }
        })
    );
}

async function loadTask(taskId) {
    const response =
        await caches.default.match(
            taskCacheKey(taskId)
        );

    if (!response) {
        return null;
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
}

async function createCompletedTask(payload) {
    const query =
        extractMessageText(payload);
    const contextId =
        getContextId(payload);
    const messageId =
        getMessageId(payload);
    const taskId =
        crypto.randomUUID();

    const text =
        await catalogueAgentMessage(
            query
        );

    const userMessage =
        getRequestMessage(payload);

    const history = [];

    if (userMessage) {
        history.push(
            userMessage
        );
    }

    const task =
        makeTask(
            taskId,
            contextId,
            text,
            history
        );

    await saveTask(task);

    return task;
}

function successResponse(id, result) {
    return a2aJson({
        jsonrpc: "2.0",
        id,
        result
    });
}

function parseJsonRpcRequest(payload) {
    return (
        payload &&
        payload.jsonrpc === "2.0" &&
        Object.prototype.hasOwnProperty.call(
            payload,
            "id"
        ) &&
        typeof payload.method === "string"
    );
}

async function handleJsonRpc(request) {
    let payload;

    try {
        payload = await request.json();
    } catch {
        return a2aError(
            -32700,
            "Invalid JSON payload"
        );
    }

    if (!parseJsonRpcRequest(payload)) {
        return a2aError(
            -32600,
            "Request payload validation error",
            payload?.id ?? null
        );
    }

    const {
        method,
        id,
        params = {}
    } = payload;

    switch (method) {
        case "SendMessage": {
            const task =
                await createCompletedTask(
                    {
                        ...params,
                        message:
                            params.message
                    }
                );

            return successResponse(
                id,
                {
                    task
                }
            );
        }

        case "GetTask": {
            const task =
                await loadTask(
                    params.id
                );

            if (!task) {
                return a2aError(
                    -32001,
                    "Task not found",
                    id
                );
            }

            return successResponse(
                id,
                {
                    task
                }
            );
        }

        case "ListTasks": {
            return successResponse(
                id,
                {
                    tasks: [],
                    nextPageToken: "",
                    pageSize:
                        Number.isInteger(
                            params.pageSize
                        )
                            ? Math.max(
                                1,
                                Math.min(
                                    100,
                                    params.pageSize
                                )
                            )
                            : 100,
                    totalSize: 0
                }
            );
        }

        case "CancelTask":
            return a2aError(
                -32002,
                "Task is already in a terminal state",
                id
            );

        case "SubscribeToTask":
            return a2aError(
                -32003,
                "Unsupported operation: task subscriptions are not available for completed tasks",
                id
            );

        case "GetExtendedAgentCard":
            return a2aError(
                -32601,
                "Method not found",
                id
            );

        case "CreateTaskPushNotificationConfig":
        case "GetTaskPushNotificationConfig":
        case "ListTaskPushNotificationConfigs":
        case "DeleteTaskPushNotificationConfig":
            return a2aError(
                -32601,
                "Method not found",
                id
            );

        default:
            return a2aError(
                -32601,
                "Method not found",
                id
            );
    }
}

async function handleA2ASend(request) {
    const versionError =
        validateA2aVersion(request);

    if (versionError) {
        return versionError;
    }

    if (
        request.method !== "POST"
    ) {
        return httpA2aError(
            405,
            "Method Not Allowed"
        );
    }

    let payload;

    try {
        payload =
            await request.json();
    } catch {
        return httpA2aError(
            400,
            "Request body must be valid JSON"
        );
    }

    const message =
        getRequestMessage(payload);

    if (
        !message ||
        !Array.isArray(
            message.parts
        ) ||
        message.parts.length === 0
    ) {
        return httpA2aError(
            400,
            "The message must contain at least one part"
        );
    }

    const task =
        await createCompletedTask(
            payload
        );

    return new Response(
        JSON.stringify({
            task
        }),
        {
            status: 200,
            headers: a2aHeaders()
        }
    );
}

async function handleA2AStream(request) {
    const versionError =
        validateA2aVersion(request);

    if (versionError) {
        return versionError;
    }

    if (
        request.method !== "POST"
    ) {
        return httpA2aError(
            405,
            "Method Not Allowed"
        );
    }

    let payload;

    try {
        payload =
            await request.json();
    } catch {
        return httpA2aError(
            400,
            "Request body must be valid JSON"
        );
    }

    const message =
        getRequestMessage(payload);

    if (
        !message ||
        !Array.isArray(
            message.parts
        ) ||
        message.parts.length === 0
    ) {
        return httpA2aError(
            400,
            "The message must contain at least one part"
        );
    }

    const task =
        await createCompletedTask(
            payload
        );

    const encoder =
        new TextEncoder();

    const stream =
        new ReadableStream({
            start(controller) {
                const first =
                    JSON.stringify({
                        task
                    });

                const second =
                    JSON.stringify({
                        statusUpdate: {
                            taskId:
                                task.id,
                            status: {
                                state:
                                    "TASK_STATE_COMPLETED",
                                timestamp:
                                    task.status.timestamp
                            },
                            final:
                                true
                        }
                    });

                controller.enqueue(
                    encoder.encode(
                        "data: " +
                            first +
                            "\\n\\n"
                    )
                );

                controller.enqueue(
                    encoder.encode(
                        "data: " +
                            second +
                            "\\n\\n"
                    )
                );

                controller.close();
            }
        });

    return new Response(
        stream,
        {
            status: 200,
            headers: {
                "Content-Type":
                    "text/event-stream",
                "Cache-Control":
                    "no-store",
                "Connection":
                    "keep-alive",
                "Access-Control-Allow-Origin":
                    "*",
                "Access-Control-Allow-Headers":
                    "Content-Type, Authorization, A2A-Version, A2A-Extensions"
            }
        }
    );
}

async function handleA2ATasks(request) {
    const pathname =
        new URL(request.url).pathname;

    if (
        pathname === "/a2a/tasks" &&
        request.method === "GET"
    ) {
        return a2aJson({
            tasks: [],
            nextPageToken: "",
            pageSize: 100,
            totalSize: 0
        });
    }

    const getMatch =
        pathname.match(
            /^\/a2a\/tasks\/([^/:]+)$/
        );

    const cancelMatch =
        pathname.match(
            /^\/a2a\/tasks\/([^/:]+):cancel$/
        );

    if (getMatch && request.method === "GET") {
        const taskId =
            decodeURIComponent(
                getMatch[1]
            );

        const task =
            await loadTask(
                taskId
            );

        if (!task) {
            return httpA2aError(
                404,
                "Task not found"
            );
        }

        return a2aJson(task);
    }

    if (
        cancelMatch &&
        request.method === "POST"
    ) {
        const taskId =
            decodeURIComponent(
                cancelMatch[1]
            );

        const task =
            await loadTask(
                taskId
            );

        if (!task) {
            return httpA2aError(
                404,
                "Task not found"
            );
        }

        return a2aJson(
            {
                error: {
                    code:
                        "TASK_ALREADY_TERMINAL",
                    message:
                        "Task is already completed"
                }
            },
            409
        );
    }

    return httpA2aError(
        405,
        "Method Not Allowed"
    );
}

async function handleA2A(request) {
    if (
        request.method === "OPTIONS"
    ) {
        return new Response(
            null,
            {
                status: 204,
                headers: a2aHeaders()
            }
        );
    }

    if (
        request.method === "POST" &&
        request.url.includes(
            "/a2a/message:send"
        )
    ) {
        return handleA2ASend(
            request
        );
    }

    if (
        request.method === "POST" &&
        request.url.includes(
            "/a2a/message:stream"
        )
    ) {
        return handleA2AStream(
            request
        );
    }

    if (
        request.method === "POST" &&
        request.url.endsWith(
            "/a2a/rpc"
        )
    ) {
        const versionError =
            validateA2aVersion(request);

        if (versionError) {
            return versionError;
        }

        return handleJsonRpc(
            request
        );
    }

    const pathname =
        new URL(request.url).pathname;

    if (
        pathname === "/a2a/tasks" ||
        pathname.startsWith("/a2a/tasks/")
    ) {
        return await handleA2ATasks(
            request
        );
    }

    if (
        request.method === "GET" &&
        request.url.endsWith(
            "/a2a"
        )
    ) {
        return new Response(
            JSON.stringify(A2A_CARD),
            {
                status: 200,
                headers: a2aHeaders()
            }
        );
    }

    if (
        request.method === "GET" &&
        request.url.endsWith(
            "/a2a/extendedAgentCard"
        )
    ) {
        return httpA2aError(
            404,
            "Extended Agent Card is not available"
        );
    }

    return null;
}


const OAUTH_DISCOVERY_UPSTREAM =
    "https://kjxrfmujzdxatpgegqcs.supabase.co/auth/v1/.well-known/openid-configuration";

async function oauthDiscoveryResponse() {
    try {
        const upstreamResponse = await fetch(
            OAUTH_DISCOVERY_UPSTREAM,
            {
                headers: {
                    Accept: "application/json"
                }
            }
        );

        if (!upstreamResponse.ok) {
            return new Response(
                JSON.stringify({
                    error: "OAuth discovery upstream unavailable"
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Cache-Control": "no-store"
                    }
                }
            );
        }

        const data = await upstreamResponse.json();

        const requiredFields = [
            "issuer",
            "authorization_endpoint",
            "token_endpoint",
            "jwks_uri",
            "grant_types_supported",
            "response_types_supported"
        ];

        const missing = requiredFields.filter(
            (field) =>
                data[field] === undefined ||
                data[field] === null ||
                data[field] === ""
        );

        if (missing.length) {
            return new Response(
                JSON.stringify({
                    error: "OAuth discovery metadata incomplete",
                    missing
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Cache-Control": "no-store"
                    }
                }
            );
        }

        return new Response(
            JSON.stringify(data),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "public, max-age=300, s-maxage=300",
                    "Access-Control-Allow-Origin": "*"
                }
            }
        );
    } catch (error) {
        console.error("[Souviks OAuth Discovery]", error);

        return new Response(
            JSON.stringify({
                error: "Unable to retrieve OAuth discovery metadata"
            }),
            {
                status: 502,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store"
                }
            }
        );
    }
}



function base64UrlEncode(bytes) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function base64Encode(bytes) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function pemToDer(pem) {
    const base64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s+/g, "");

    const binary = atob(base64);

    return Uint8Array.from(
        binary,
        (char) => char.charCodeAt(0)
    );
}

function randomNonce() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

function unsignedDirectoryHeaders() {
    return {
        "Content-Type":
            "application/http-message-signatures-directory+json",
        "Cache-Control":
            "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin":
            "*"
    };
}

async function jwkThumbprint(jwk) {
    const canonical = JSON.stringify({
        crv: jwk.crv,
        kty: jwk.kty,
        x: jwk.x
    });

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical)
    );

    return base64UrlEncode(
        new Uint8Array(digest)
    );
}

async function loadWebBotSigningMaterial(env) {
    const privateKeyPem =
        env?.WEB_BOT_AUTH_PRIVATE_KEY;

    if (
        !privateKeyPem ||
        typeof privateKeyPem !== "string"
    ) {
        return null;
    }

    const privateKey =
        await crypto.subtle.importKey(
            "pkcs8",
            pemToDer(privateKeyPem),
            { name: "Ed25519" },
            true,
            ["sign"]
        );

    const privateJwk =
        await crypto.subtle.exportKey(
            "jwk",
            privateKey
        );

    if (
        privateJwk.kty !== "OKP" ||
        privateJwk.crv !== "Ed25519" ||
        !privateJwk.x
    ) {
        throw new Error(
            "WEB_BOT_AUTH_PRIVATE_KEY is not an Ed25519 private key"
        );
    }

    const publicJwk = {
        kty: "OKP",
        crv: "Ed25519",
        x: privateJwk.x,
        use: "sig"
    };

    const kid =
        await jwkThumbprint(publicJwk);

    return {
        privateKey,
        publicJwk: {
            ...publicJwk,
            kid
        },
        kid
    };
}

async function signDirectoryResponse(
    authority,
    material
) {
    if (!material) {
        return null;
    }

    const created =
        Math.floor(Date.now() / 1000);
    const expires = created + 60;
    const nonce = randomNonce();

    const signatureParams =
        '("@authority";req);alg="ed25519";keyid="' +
        material.kid +
        '";nonce="' +
        nonce +
        '";tag="http-message-signatures-directory";created=' +
        created +
        ";expires=" +
        expires;

    const signatureBase =
        '"@authority": "' +
        authority +
        '"\n' +
        '"@signature-params": ' +
        signatureParams;

    const signatureBytes =
        await crypto.subtle.sign(
            { name: "Ed25519" },
            material.privateKey,
            new TextEncoder().encode(
                signatureBase
            )
        );

    return {
        "Signature-Input":
            "sig1=" + signatureParams,
        "Signature":
            "sig1=:" +
            base64Encode(
                new Uint8Array(signatureBytes)
            ) +
            ":"
    };
}

async function httpMessageSignaturesDirectory(
    request,
    env
) {
    if (
        request.method !== "GET" &&
        request.method !== "HEAD"
    ) {
        return new Response(
            null,
            {
                status: 405,
                headers: {
                    ...unsignedDirectoryHeaders(),
                    Allow: "GET, HEAD"
                }
            }
        );
    }

    let material;

    try {
        material =
            await loadWebBotSigningMaterial(
                env
            );
    } catch (error) {
        console.error(
            "[Souviks Web Bot Auth]",
            error
        );

        return new Response(
            JSON.stringify({
                error:
                    "WEB_BOT_AUTH_PRIVATE_KEY must be a valid Ed25519 PKCS#8 PEM private key"
            }),
            {
                status: 503,
                headers: {
                    "Content-Type":
                        "application/json; charset=utf-8",
                    "Cache-Control":
                        "no-store"
                }
            }
        );
    }

    if (!material) {
        return new Response(
            JSON.stringify({
                error:
                    "Web Bot Auth signing key is not configured"
            }),
            {
                status: 503,
                headers: {
                    "Content-Type":
                        "application/json; charset=utf-8",
                    "Cache-Control":
                        "no-store"
                }
            }
        );
    }

    const jwks = {
        keys: [
            material.publicJwk
        ]
    };

    const signatureHeaders =
        await signDirectoryResponse(
            request.headers.get("Host") ||
                new URL(request.url).host,
            material
        );

    const headers = {
        ...unsignedDirectoryHeaders(),
        ...signatureHeaders
    };

    const body = JSON.stringify(jwks);

    if (request.method === "HEAD") {
        headers["Content-Length"] =
            String(
                new TextEncoder()
                    .encode(body)
                    .byteLength
            );

        return new Response(
            null,
            {
                status: 200,
                headers
            }
        );
    }

    return new Response(
        body,
        {
            status: 200,
            headers
        }
    );
}

export async function handleAgentRequest(
    request,
    env
) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/.well-known/mcp/server-card.json") {
        return mcpJson(
            MCP_CARD,
            200
        );
    }

    if (
        pathname === "/mcp"
    ) {
        return await handleMcpRequest(
            request
        );
    }

    if (
        pathname ===
        "/.well-known/http-message-signatures-directory"
    ) {
        return await httpMessageSignaturesDirectory(
            request,
            env
        );
    }

    if (pathname === "/.well-known/agent-card.json") {
        return new Response(
            JSON.stringify(A2A_CARD),
            {
                status: 200,
                headers: {
                    "Content-Type":
                        "application/json; charset=utf-8",
                    "Cache-Control":
                        "public, max-age=300, s-maxage=300",
                    "Access-Control-Allow-Origin": "*"
                }
            }
        );
    }

    if (pathname === "/.well-known/openid-configuration") {
        return await oauthDiscoveryResponse();
    }

    if (
        pathname ===
        "/.well-known/oauth-authorization-server"
    ) {
        return await oauthDiscoveryResponse();
    }

    if (
        pathname ===
        "/.well-known/oauth-protected-resource"
    ) {
        return new Response(
            JSON.stringify({
                resource:
                    "https://souviks.co.in",
                authorization_servers: [
                    "https://kjxrfmujzdxatpgegqcs.supabase.co/auth/v1"
                ],
                bearer_methods_supported: [
                    "header"
                ],
                resource_name: "Souviks",
                resource_documentation:
                    "https://souviks.co.in/en/about.html"
            }),
            {
                status: 200,
                headers: {
                    "Content-Type":
                        "application/json; charset=utf-8",
                    "Cache-Control":
                        "public, max-age=300, s-maxage=300",
                    "Access-Control-Allow-Origin": "*"
                }
            }
        );
    }

    if (
        pathname === "/a2a" ||
        pathname === "/a2a/"
    ) {
        return new Response(
            JSON.stringify(A2A_CARD),
            {
                status: 200,
                headers: a2aHeaders()
            }
        );
    }

    if (
        pathname === "/a2a/message:send" ||
        pathname === "/a2a/message:stream" ||
        pathname === "/a2a/rpc" ||
        pathname === "/a2a/tasks" ||
        pathname.startsWith("/a2a/tasks/") ||
        pathname === "/a2a/extendedAgentCard"
    ) {
        return await handleA2A(request);
    }

    return null;
}
