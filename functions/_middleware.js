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
