/*
==========================================================
SOUVIKS WEBSITE
AGENT MARKDOWN NEGOTIATION
==========================================================

Cloudflare Pages middleware for clients that request:
    Accept: text/markdown

Normal browser requests continue to receive the original HTML.
==========================================================
*/

function acceptsMarkdown(request) {
    const accept = request.headers.get("Accept") || "";

    return accept.split(",").some((part) => {
        const mediaType = part.trim().split(";")[0].toLowerCase();
        return mediaType === "text/markdown";
    });
}

function decodeEntities(value) {
    return value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&#x27;/gi, "'");
}

function stripInline(value) {
    return decodeEntities(
        value
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
    )
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function yamlQuote(value) {
    return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function htmlToMarkdown(html, url) {
    let source = html;

    source = source
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
        .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, "")
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
        .replace(/<(header|footer|nav|form|button|select|option)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

    const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const descriptionMatch = source.match(
        /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
    );

    const title = titleMatch
        ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, " ").trim())
        : "";

    const description = descriptionMatch
        ? decodeEntities(descriptionMatch[1].trim())
        : "";

    source = source
        .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
        .replace(/<\/?html\b[^>]*>/gi, "")
        .replace(/<body\b[^>]*>/gi, "")
        .replace(/<\/body>/gi, "");

    source = source
        .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_, text) => "\n\n# " + stripInline(text) + "\n\n")
        .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_, text) => "\n\n## " + stripInline(text) + "\n\n")
        .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_, text) => "\n\n### " + stripInline(text) + "\n\n")
        .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, (_, text) => "\n\n#### " + stripInline(text) + "\n\n")
        .replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, (_, text) => "\n\n##### " + stripInline(text) + "\n\n")
        .replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, (_, text) => "\n\n###### " + stripInline(text) + "\n\n")
        .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => "\n- " + stripInline(text) + "\n")
        .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, text) => {
            const href = (attrs.match(/href=["']([^"']+)["']/i) || [])[1];
            const label = stripInline(text);

            if (!href) return label;

            try {
                const absolute = new URL(href, url).href;
                return label ? "[" + label + "](" + absolute + ")" : absolute;
            } catch {
                return label;
            }
        })
        .replace(/<img\b([^>]*)>/gi, (_, attrs) => {
            const src = (attrs.match(/src=["']([^"']+)["']/i) || [])[1];
            const alt = (attrs.match(/alt=["']([^"']*)["']/i) || [])[1] || "Image";

            if (!src) return "";

            try {
                const absolute = new URL(src, url).href;
                return "![" + alt.replace(/\]/g, "\\]") + "](" + absolute + ")";
            } catch {
                return "";
            }
        })
        .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text) => "**" + stripInline(text) + "**")
        .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text) => "*" + stripInline(text) + "*")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
        .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => "\n\n" + stripInline(text) + "\n\n")
        .replace(/<div\b[^>]*>([\s\S]*?)<\/div>/gi, (_, text) => "\n\n" + stripInline(text) + "\n\n")
        .replace(/<section\b[^>]*>([\s\S]*?)<\/section>/gi, (_, text) => "\n\n" + stripInline(text) + "\n\n")
        .replace(/<article\b[^>]*>([\s\S]*?)<\/article>/gi, (_, text) => "\n\n" + stripInline(text) + "\n\n")
        .replace(/<main\b[^>]*>([\s\S]*?)<\/main>/gi, (_, text) => "\n\n" + stripInline(text) + "\n\n")
        .replace(/<ul\b[^>]*>/gi, "\n")
        .replace(/<\/ul>/gi, "\n")
        .replace(/<ol\b[^>]*>/gi, "\n")
        .replace(/<\/ol>/gi, "\n")
        .replace(/<[^>]+>/g, " ");

    const body = decodeEntities(source)
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const frontmatter = [];

    if (title) frontmatter.push("title: " + yamlQuote(title));
    if (description) frontmatter.push("description: " + yamlQuote(description));

    let output = frontmatter.length
        ? "---\n" + frontmatter.join("\n") + "\n---\n\n"
        : "";

    output += body;

    return output.replace(/\n{3,}/g, "\n\n").trim() + "\n";
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
        const response = await fetch(
            "https://www.souviks.co.in/assets/data/products.json",
            {
                headers: {
                    Accept: "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                "Catalogue data unavailable"
            );
        }

        const products = await response.json();

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

    const match =
        pathname.match(
            /^\/a2a\/tasks\/([^/:]+)$/
        );

    if (!match) {
        return null;
    }

    const taskId =
        decodeURIComponent(
            match[1]
        );

    if (
        request.method === "GET"
    ) {
        const task =
            await loadTask(
                taskId
            );

        if (!task) {
            return a2aJson(
                {
                    error: {
                        code: "TASK_NOT_FOUND",
                        message:
                            "Task not found"
                    }
                },
                404
            );
        }

        return a2aJson(task);
    }

    if (
        request.method === "POST" &&
        pathname.endsWith(":cancel")
    ) {
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

    const taskResponse =
        await handleA2ATasks(
            request
        );

    if (taskResponse) {
        return taskResponse;
    }

    if (
        request.method === "GET" &&
        request.url.endsWith(
            "/a2a"
        )
    ) {
        return jsonResponse(
            A2A_CARD
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

function tokenEstimate(value) {
    return Math.max(1, Math.ceil(value.length / 4));
}

export async function onRequest(context) {
    const pathname = new URL(context.request.url).pathname;

    if (pathname === "/.well-known/agent-card.json") {
        return jsonResponse(
            A2A_CARD,
            200,
            "application/json; charset=utf-8"
        );
    }

    if (pathname === "/a2a/message:send") {
        return await a2aMessageSend(context.request);
    }

    if (
        pathname === "/.well-known/openid-configuration" ||
        pathname === "/.well-known/oauth-authorization-server"
    ) {
        return await oauthDiscoveryResponse();
    }

    if (pathname === "/.well-known/oauth-protected-resource") {
        return new Response(
            JSON.stringify({
                resource: "https://souviks.co.in",
                authorization_servers: [
                    "https://kjxrfmujzdxatpgegqcs.supabase.co/auth/v1"
                ],
                bearer_methods_supported: [
                    "header"
                ],
                resource_name: "Souviks",
                resource_documentation: "https://souviks.co.in/en/about.html"
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "public, max-age=300, s-maxage=300",
                    "Access-Control-Allow-Origin": "*"
                }
            }
        );
    }

    const response = await context.next();

    if (!acceptsMarkdown(context.request)) {
        return response;
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();

    if (
        response.status < 200 ||
        response.status >= 300 ||
        !contentType.includes("text/html")
    ) {
        return response;
    }

    const originalHtml = await response.text();
    const markdown = htmlToMarkdown(
        originalHtml,
        context.request.url
    );

    const headers = new Headers(response.headers);

    headers.set(
        "Content-Type",
        "text/markdown; charset=utf-8"
    );

    const existingVary = headers.get("Vary");

    if (!existingVary) {
        headers.set("Vary", "Accept");
    } else if (
        !existingVary
            .toLowerCase()
            .split(",")
            .map((part) => part.trim())
            .includes("accept")
    ) {
        headers.set("Vary", existingVary + ", Accept");
    }

    headers.set(
        "Content-Length",
        String(new TextEncoder().encode(markdown).byteLength)
    );

    headers.delete("Content-Encoding");
    headers.delete("Content-Range");
    headers.delete("Transfer-Encoding");
    headers.delete("ETag");
    headers.delete("Last-Modified");

    headers.set(
        "x-markdown-tokens",
        String(tokenEstimate(markdown))
    );

    headers.set(
        "x-original-tokens",
        String(tokenEstimate(originalHtml))
    );

    return new Response(markdown, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}
