export function onRequest(context) {
    const requestUrl = new URL(context.request.url);
    const slug = String(context.params.slug || "").trim().replace(/^\/+|\/+$/g, "");

    if (!slug || slug.includes(".")) {
        return context.next();
    }

    const target = new URL(requestUrl);
    target.pathname = `/hi/products/${encodeURIComponent(slug)}.html`;

    return Response.redirect(target.toString(), 301);
}
