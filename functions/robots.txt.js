const ROBOTS = [
  "User-agent: *",
  "",
  "Allow: /",
  "",
  "Disallow: /assets/temp/",
  "Disallow: /drafts/",
  "",
  "Sitemap: https://www.souviks.co.in/sitemap.xml",
  "",
].join("\n");

const SECURITY_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://static.cloudflareinsights.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https://www.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://kjxrfmujzdxatpgegqcs.supabase.co https://api.emailjs.com https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://cloudflareinsights.com; frame-src 'self' https://www.google.com https://maps.google.com; manifest-src 'self'; worker-src 'self' blob:",
};

export function onRequestGet() {
  return new Response(ROBOTS, {
    status: 200,
    headers: SECURITY_HEADERS,
  });
}
