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
      headers: { Accept: "*/*" },
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

  const result = {
    name: check.name,
    ok: issues.length === 0,
    status: response.status,
    url: response.url,
    cacheControl: cacheControl || "(missing)",
    cfCacheStatus: response.headers.get("cf-cache-status") || "(not exposed)",
    age: response.headers.get("age") || "(not exposed)",
    detail: issues.join("; "),
  };

  // The audit needs response headers only; do not download full catalogue or
  // image payloads after the headers have arrived.
  await response.body?.cancel().catch(() => {});
  return result;
}

const results = [];
for (const check of checks) {
  results.push(await inspect(check));
}

console.log(`Production cache-header audit: ${baseUrl}`);
for (const result of results) {
  const status = result.status === undefined ? "ERR" : String(result.status);
  console.log(`${result.ok ? "PASS" : "FAIL"} [${status}] ${result.name}`);
  console.log(`  URL: ${result.url || "not reached"}`);
  console.log(`  Cache-Control: ${result.cacheControl || result.detail}`);
  if (result.cfCacheStatus) console.log(`  CF-Cache-Status: ${result.cfCacheStatus}`);
  if (result.age) console.log(`  Age: ${result.age}`);
  if (!result.ok) console.log(`  Issue: ${result.detail}`);
}

const failed = results.filter((result) => !result.ok);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  process.exitCode = 1;
}
