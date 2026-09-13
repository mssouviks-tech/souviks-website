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





export async function handleMarkdownResponse(request, response) {
    if (!acceptsMarkdown(request)) {
        return response;
    }

    const contentType =
        (response.headers.get("content-type") || "")
            .toLowerCase();

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
        request.url
    );

    const headers = new Headers(
        response.headers
    );

    headers.set(
        "Content-Type",
        "text/markdown; charset=utf-8"
    );

    const existingVary =
        headers.get("Vary");

    if (!existingVary) {
        headers.set(
            "Vary",
            "Accept"
        );
    } else if (
        !existingVary
            .toLowerCase()
            .split(",")
            .map((part) => part.trim())
            .includes("accept")
    ) {
        headers.set(
            "Vary",
            existingVary + ", Accept"
        );
    }

    headers.set(
        "Content-Length",
        String(
            new TextEncoder()
                .encode(markdown)
                .byteLength
        )
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

function tokenEstimate(value) {
    return Math.max(
        1,
        Math.ceil(value.length / 4)
    );
}
