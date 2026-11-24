const CANONICAL_HOST = "www.souviks.co.in";

const LEGACY_HOSTS = new Set([
  "souviks.co.in",
  "w.souviks.co.in",
  "ww.souviks.co.in",
  "ww2.souviks.co.in",
  "wwe.souviks.co.in",
  "wwww.souviks.co.in",
  "qqq.souviks.co.in",
]);

const ROOT_LEGACY_PAGE_PATHS = new Map([
  ["/products", "/en/products"], ["/products.html", "/en/products"],
  ["/brands", "/en/brands"], ["/brands.html", "/en/brands"],
  ["/categories", "/en/categories"], ["/categories.html", "/en/categories"],
  ["/vehicles", "/en/vehicles"], ["/vehicles.html", "/en/vehicles"],
  ["/about", "/en/about"], ["/about.html", "/en/about"],
  ["/contact", "/en/contact"], ["/contact.html", "/en/contact"],
  ["/terms", "/en/terms"], ["/terms.html", "/en/terms"],
  ["/privacy-policy", "/en/privacy-policy"], ["/privacy-policy.html", "/en/privacy-policy"],
  ["/refund", "/en/refund"], ["/refund.html", "/en/refund"],
  ["/shipping", "/en/shipping"], ["/shipping.html", "/en/shipping"],
  ["/request-part", "/en/request-part"], ["/request-part.html", "/en/request-part"],
  ["/request-quote", "/en/cart"], ["/request-quote.html", "/en/cart"],
  ["/thank-you", "/en/thank-you"], ["/thank-you.html", "/en/thank-you"],
  ["/${LANG}/brands.html", "/en/brands"],
]);

const LEGACY_LANGUAGE_PAGE_NAMES = new Set([
  "products", "brands", "categories", "vehicles", "about", "contact",
  "shipping", "account", "login", "register", "forgot-password",
  "reset-password", "request-part", "thank-you", "privacy-policy",
  "terms", "refund",
]);

function normalizeLegacyAliasPath(pathname) {
  const rootTarget = ROOT_LEGACY_PAGE_PATHS.get(pathname);
  if (rootTarget) return rootTarget;

  const requestQuote = pathname.match(/^\/(en|bn|hi)\/request-quote(?:\.html)?$/);
  if (requestQuote) return "/" + requestQuote[1] + "/cart";

  // Root-level legacy entity details need the same language normalization
  // in the apex-host redirect. Otherwise the browser receives a host redirect
  // followed by a second Pages _redirects hop from /products/:slug to /en/...
  const rootEntityHtmlPage = pathname.match(/^\/(products|brands|categories|vehicles)\/([^/]+)\.html$/);
  if (rootEntityHtmlPage) {
    return "/en/" + rootEntityHtmlPage[1] + "/" + rootEntityHtmlPage[2];
  }

  const rootEntityPage = pathname.match(/^\/(products|brands|categories|vehicles)\/([^/]+)$/);
  if (rootEntityPage) {
    return "/en/" + rootEntityPage[1] + "/" + rootEntityPage[2];
  }

  const entityPage = pathname.match(/^\/(en|bn|hi)\/(products|brands|categories|vehicles)\/(.+)\.html$/);
  if (entityPage) return "/" + entityPage[1] + "/" + entityPage[2] + "/" + entityPage[3];

  const languagePage = pathname.match(/^\/(en|bn|hi)\/([a-z0-9-]+)\.html$/i);
  if (languagePage && LEGACY_LANGUAGE_PAGE_NAMES.has(languagePage[2].toLowerCase())) {
    return "/" + languagePage[1] + "/" + languagePage[2].toLowerCase();
  }

  return pathname;
}

const SECURITY_HEADERS = Object.freeze({
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://sandbox.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://static.cloudflareinsights.com https://sdk.cashfree.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https://www.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://sdk.cashfree.com https://kjxrfmujzdxatpgegqcs.supabase.co https://api.emailjs.com https://api.cashfree.com https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://cloudflareinsights.com; frame-src 'self' https://www.google.com https://maps.google.com https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com; manifest-src 'self'; worker-src 'self' blob:",
});

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  if (LEGACY_HOSTS.has(url.hostname.toLowerCase())) {
    url.protocol = "https:";
    url.hostname = CANONICAL_HOST;
    url.port = "";
    // Normalize legacy page paths in the same response as the host redirect.
    // This avoids host -> .html -> clean-route redirect chains.
    url.pathname = normalizeLegacyAliasPath(url.pathname);
    return Response.redirect(url.toString(), 301);
  }

  const response = await next();
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
