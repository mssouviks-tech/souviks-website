export async function onRequest(context) {
    const requestUrl = new URL(context.request.url);
    const slug = String(context.params.slug || "").trim().replace(/^\/+|\/+$/g, "");

    // Physical .html product pages are static assets.
    // They must never be redirected or rewritten back into this route.
    if (requestUrl.pathname.endsWith(".html")) {
        return context.next();
    }

    if (!slug || slug.includes(".")) {
        return context.next();
    }

    // Keep the clean product URL in the browser and internally serve
    // the generated static HTML file.
    const target = new URL(requestUrl);
    target.pathname = `/hi/products/${encodeURIComponent(slug)}.html`;

    return context.next(new Request(target, context.request));
}
