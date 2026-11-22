#!/usr/bin/env node
/**
 * Verify the Cache-Control policies currently served by the Souviks production
 * site. This runs in GitHub Actions so it can test the public edge response,
 * rather than merely checking the repository's _headers file.
 */

const baseUrl = (process.env.SOUVIKS_PRODUCTION_BASE_URL || "https://www.souviks.co.in").replace(/\/+$/, "");

const checks = [
  {
    name: "Homepage HTML",
    path: "/",
    expected: { public: null, "no-cache": null, "must-revalidate": null },
    forbidden: ["private", "no-store"],
  },
  {
    name: "English homepage HTML",
    path: "/en/",
    expected: { public: null, "no-cache": null, "must-revalidate": null },
    forbidden: ["private", "no-store"],
  },
  {
    name: "Bengali homepage HTML",
    path: "/bn/",
    expected: { public: null, "no-cache": null, "must-revalidate": null },
    forbidden: ["private", "no-store"],
  },
  {
    name: "Hindi homepage HTML",
    path: "/hi/",
    expected: { public: null, "no-cache": null, "must-revalidate": null },
    forbidden: ["private", "no-store"],
  },
  {
    name: "Versioned JavaScript",
    path: "/assets/js/site-core.js?v=ff4590626c55",
    expected: { public: null, "max-age": "31536000", immutable: null },
    forbidden: ["private", "no-store"],
  },
  {
    name: "Versioned CSS",
    path: "/assets/css/site-base.css?v=64fc7dc83f79",
    expected: { public: null, "max-age": "31536000", immutable: null },
    forbidden: ["private", "no-store"],
  },
  {
    name: "Product catalogue data",
    path: "/assets/data/catalogue-index.json",
    expected: { public: null, "max-age": "0", "must-revalidate": null },
    forbidden: ["private", "no-store"],
  },
  {
    name: "Homepage hero image",
    path: "/assets/images/hero/index-hero.webp?v=c5d57ca84209",
    expected: { public: null, "max-age": "86400", "stale-while-revalidate": "604800" },
    forbidden: ["private", "no-store"],
  },
  {
    name: "robots.txt",
    path: "/robots.txt",
    expected: { "no-store": null },
    forbidden: ["public", "private", "max-age"],
  },
  {
    name: "ads.txt",
    path: "/ads.txt",
    expected: { public: null, "max-age": "86400" },
    forbidden: ["private", "no-store"],
  },
];

function parseCacheControl(value) {
  const directives = new Map();
  for (const rawPart of (value || "").split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const separator = part.indexOf("=");
    const key = (separator === -1 ? part : part.slice(0, separator)).trim().toLowerCase();
    const rawValue = separator === -1 ? null : part.slice(separator + 1).trim().replace(/^["']|["']$/g, "").toLowerCase();
    directives.set(key, rawValue);
  }
  return directives;
}

async function inspect(check) {
  const url = new URL(check.path, baseUrl);
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: check.path.endsWith("/")
          ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
          : check.path.endsWith(".json")
            ? "application/json,*/*;q=0.8"
            : "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
      },
    });
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: `request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const cacheControl = response.headers.get("cache-control");
  const directives = parseCacheControl(cacheControl);
  const issues = [];

  if (!response.ok) {
    issues.push(`HTTP status ${response.status}`);
  }
  if (!cacheControl) {
    issues.push("Cache-Control header is missing");
  }

  for (const [key, expectedValue] of Object.entries(check.expected)) {
    if (!directives.has(key)) {
      issues.push(`missing directive ${key}`);
      continue;
    }
    if (expectedValue !== null && directives.get(key) !== expectedValue) {
      issues.push(`${key} expected ${expectedValue}, received ${directives.get(key) ?? "(no value)"}`);
    }
  }

  for (const key of check.forbidden) {
    if (directives.has(key)) {
      issues.push(`unexpected directive ${key}`);
    }
  }

  let bodyExcerpt = '';
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    bodyExcerpt = body.replace(/\s+/g, " ").trim().slice(0, 400);
  } else {
    // The audit needs headers only; do not download the full asset payload.
    await response.body?.cancel().catch(() => {});
  }

  const cloudflareChallenge =
    response.status === 403 &&
    (response.headers.get("server") || "").toLowerCase() === "cloudflare" &&
    /just a moment|cf-chl|challenge-platform/i.test(bodyExcerpt);
  const challengeAllowed = process.env.SOUVIKS_CACHE_AUDIT_ALLOW_CHALLENGE === "true";
  const blocked = cloudflareChallenge && challengeAllowed;

  const result = {
    name: check.name,
    ok: issues.length === 0 || blocked,
    blocked,
    status: response.status,
    url: response.url,
    cacheControl: cacheControl || "(missing)",
    cfCacheStatus: response.headers.get("cf-cache-status") || "(not exposed)",
    age: response.headers.get("age") || "(not exposed)",
    server: response.headers.get("server") || "(not exposed)",
    cfRay: response.headers.get("cf-ray") || "(not exposed)",
    contentType: response.headers.get("content-type") || "(not exposed)",
    bodyExcerpt,
    detail: blocked
      ? "Cloudflare bot challenge prevented inspection; this route is inconclusive."
      : issues.join("; "),
  };

  return result;
}

const results = [];
for (const check of checks) {
  results.push(await inspect(check));
}

console.log(`Production cache-header audit: ${baseUrl}`);
for (const result of results) {
  const status = result.status === undefined ? "ERR" : String(result.status);
  const label = result.blocked ? "BLOCKED" : result.ok ? "PASS" : "FAIL";
  console.log(`${label} [${status}] ${result.name}`);
  console.log(`  URL: ${result.url || "not reached"}`);
  console.log(`  Cache-Control: ${result.cacheControl || result.detail}`);
  if (result.cfCacheStatus) console.log(`  CF-Cache-Status: ${result.cfCacheStatus}`);
  if (result.age) console.log(`  Age: ${result.age}`);
  if (result.server) console.log(`  Server: ${result.server}`);
  if (result.cfRay) console.log(`  CF-Ray: ${result.cfRay}`);
  if (result.contentType) console.log(`  Content-Type: ${result.contentType}`);
  if (result.bodyExcerpt) console.log(`  Response body: ${result.bodyExcerpt}`);
  if (!result.ok) console.log(`  Issue: ${result.detail}`);
}

const passed = results.filter((result) => result.ok && !result.blocked).length;
const blocked = results.filter((result) => result.blocked).length;
const failed = results.filter((result) => !result.ok);
console.log(`\nSummary: ${passed}/${results.length} passed; ${blocked} blocked by Cloudflare challenge; ${failed.length} failed.`);
if (failed.length > 0) {
  process.exitCode = 1;
}
