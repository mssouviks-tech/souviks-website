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




const A2A_CARD = {
    name: "Souviks Catalogue Agent",
    description:
        "Agent for discovering Souviks commercial vehicle spare parts, brands, categories, vehicle applications, and catalogue information.",
    supportedInterfaces: [
        {
            url: "https://www.souviks.co.in/a2a",
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
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false
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
                "Find and describe Souviks products, brands, categories, and vehicle applications using the public catalogue."
        },
        {
            id: "part-identification",
            name: "Part Identification",
            description:
                "Help locate catalogue entries by part number, product ID, SKU, product name, brand, or related catalogue text."
        },
        {
            id: "catalogue-navigation",
            name: "Catalogue Navigation",
            description:
                "Direct agents to the appropriate Souviks product, brand, category, vehicle, and search resources."
        }
    ]
};

function jsonResponse(data, status = 200, contentType = "application/json; charset=utf-8") {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": contentType,
            "Cache-Control": status === 200
                ? "public, max-age=300, s-maxage=300"
                : "no-store",
            "Access-Control-Allow-Origin": "*"
        }
    });
}

function extractMessageText(payload) {
    const message =
        payload?.message ||
        payload?.params?.message ||
        payload?.params?.request?.message;

    if (!message || !Array.isArray(message.parts)) {
        return "";
    }

    return message.parts
        .map((part) => part?.text || "")
        .filter(Boolean)
        .join("\n")
        .trim();
}

function pickProductFields(item) {
    return {
        id: item.id ?? null,
        sku: item.sku ?? null,
        mpn: item.mpn ?? item.part_number ?? null,
        name: item.name ?? item.title ?? item.product_name ?? null,
        brand: item.brand?.name ?? item.brand ?? item.brand_name ?? null,
        category: item.category?.name ?? item.category ?? item.category_name ?? null,
        url: item.slug
            ? "https://www.souviks.co.in/en/products/" + item.slug
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
            throw new Error("Catalogue data unavailable");
        }

        const products = await response.json();
        const terms = normalized
            .toLowerCase()
            .split(/\s+/)
            .filter((term) => term.length >= 2);

        const matches = Array.isArray(products)
            ? products
                .filter((item) => {
                    const haystack = JSON.stringify(item).toLowerCase();
                    return terms.every((term) => haystack.includes(term));
                })
                .slice(0, 10)
            : [];

        if (!matches.length) {
            return [
                "No exact catalogue match was found for: " + normalized,
                "",
                "You can search the full public catalogue here:",
                "https://www.souviks.co.in/assets/data/search.json",
                "https://www.souviks.co.in/en/products.html"
            ].join("\n");
        }

        return [
            "Catalogue matches for: " + normalized,
            "",
            ...matches.map((item, index) => {
                const p = pickProductFields(item);
                return [
                    (index + 1) + ". " + (p.name || "Unnamed product"),
                    p.sku ? "   SKU: " + p.sku : "",
                    p.mpn ? "   Part number: " + p.mpn : "",
                    p.brand ? "   Brand: " + p.brand : "",
                    p.category ? "   Category: " + p.category : "",
                    p.url ? "   URL: " + p.url : ""
                ].filter(Boolean).join("\n");
            }),
            "",
            "Catalogue: https://www.souviks.co.in/en/products.html"
        ].join("\n");
    } catch (error) {
        return [
            "The Souviks catalogue search service is temporarily unavailable.",
            "",
            "Public catalogue: https://www.souviks.co.in/en/products.html",
            "Product data: https://www.souviks.co.in/assets/data/products.json"
        ].join("\n");
    }
}

async function a2aMessageSend(request) {
    if (request.method !== "POST") {
        return jsonResponse(
            {
                error: {
                    code: 405,
                    message: "Method Not Allowed"
                }
            },
            405
        );
    }

    let payload;

    try {
        payload = await request.json();
    } catch {
        return jsonResponse(
            {
                error: {
                    code: 400,
                    message: "Request body must be valid JSON"
                }
            },
            400
        );
    }

    const query = extractMessageText(payload);
    const text = await catalogueAgentMessage(query);
    const messageId =
        crypto.randomUUID();

    const result = {
        message: {
            messageId,
            contextId:
                payload?.message?.contextId ||
                payload?.params?.message?.contextId ||
                crypto.randomUUID(),
            role: "ROLE_AGENT",
            parts: [
                {
                    text
                }
            ]
        }
    };

    const isJsonRpc =
        payload?.jsonrpc === "2.0" &&
        Object.prototype.hasOwnProperty.call(payload, "id");

    if (isJsonRpc) {
        return jsonResponse({
            jsonrpc: "2.0",
            id: payload.id,
            result
        });
    }

    return jsonResponse(result, 200, "application/a2a+json");
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
