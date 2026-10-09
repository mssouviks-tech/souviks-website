#!/usr/bin/env node

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.REGRESSION_BASE_URL || "https://www.souviks.co.in";
const LANGS = ["en", "hi", "bn"];
const VIEWS = {
  desktop: { width: 1440, height: 900, isMobile: false },
  mobile: { width: 390, height: 844, isMobile: true },
};

const PRODUCT_SLUG = "10-x-15-nut";
const BRAND_SLUG = "abc";
const CATEGORY_SLUG = "cooling-system";
const VEHICLE_SLUG = "eicher-1110";

const results = [];
let browser;

function record(name, status, detail = "") {
  results.push({
    name,
    status,
    detail: String(detail || "").replace(/\s+/g, " ").trim().slice(0, 500),
  });
  console.log(`[${status}] ${name}${detail ? " — " + detail : ""}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, "PASS", detail || "");
  } catch (error) {
    record(name, "FAIL", error?.message || String(error));
  }
}

async function contextFor(view, authenticated = false) {
  const context = await browser.newContext({
    viewport: { width: VIEWS[view].width, height: VIEWS[view].height },
    isMobile: VIEWS[view].isMobile,
    deviceScaleFactor: VIEWS[view].isMobile ? 2 : 1,
    locale: "en-IN",
    colorScheme: "light",
    ignoreHTTPSErrors: false,
  });

  await context.route("**/@emailjs/browser@4/dist/email.min.js", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* deterministic regression stub */"
    });
  });

  if (authenticated) {
    await context.addInitScript(() => {
      const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
      const payload = btoa(JSON.stringify({ sub: "regression-test-user", role: "authenticated", aud: "authenticated", email: "regression@example.invalid", exp: Math.floor(Date.now() / 1000) + 3600 }));
      const token = header + "." + payload + ".regression-signature";
      const session = { access_token: token, refresh_token: "regression-refresh-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "regression-test-user", aud: "authenticated", role: "authenticated", email: "regression@example.invalid", email_confirmed_at: new Date().toISOString(), user_metadata: { full_name: "Regression Test" } } };
      localStorage.setItem("sb-kjxrfmujzdxatpgegqcs-auth-token", JSON.stringify(session));
    });
  }

  // Keep the matrix deterministic: anonymous auth/account checks must not wait
  // on the live Supabase edge or mutate real data.
  await context.route("**cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.emailjs={init:function(){},send:async function(){return {status:200,text:'OK'}}};"
    });
  });

  await context.route("**supabase.co/**", async route => {
    const request = route.request();
    const url = request.url();

    if (authenticated && /\/auth\/v1\/user$/i.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "regression-test-user",
          aud: "authenticated",
          role: "authenticated",
          email: "regression@example.invalid",
          email_confirmed_at: new Date().toISOString(),
          user_metadata: { full_name: "Regression Test" }
        })
      });
      return;
    }

    if (authenticated && /\/auth\/v1\/session$/i.test(url)) {
      const token = "regression-token";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "regression-refresh-token",
          user: {
            id: "regression-test-user",
            aud: "authenticated",
            role: "authenticated",
            email: "regression@example.invalid",
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { full_name: "Regression Test" }
          }
        })
      });
      return;
    }

    if (authenticated && /\/rest\/v1\/profiles/i.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: "regression-test-user",
          full_name: "Regression Test",
          phone: "9000000000",
          company: "Regression Co.",
          is_business: true,
          gst_number: null
        }])
      });
      return;
    }

    if (/\/auth\/v1\/(user|session)/i.test(url)) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_authenticated", message: "No active session" })
      });
      return;
    }

    if (/\/rest\/v1\//i.test(url)) {
      const method = request.method();
      const status = method === "POST" ? 201 : method === "DELETE" ? 204 : 200;
      await route.fulfill({
        status,
        contentType: "application/json",
        body: status === 204 ? "" : "[]"
      });
      return;
    }

    if (/\/auth\/v1\//i.test(url)) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_authenticated" })
      });
      return;
    }

    await route.continue();
  });

  return context;
}

async function goto(page, url) {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error?.message || String(error)));
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(700);
  if (pageErrors.length) {
    throw new Error("pageerror: " + pageErrors.slice(0, 3).join(" | "));
  }
  return response;
}

async function assertNoHorizontalOverflow(page) {
  if (!VIEWS[page.__view].isMobile) return;
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );
  if (overflow) throw new Error("horizontal overflow detected");
}

function langPath(lang, suffix) {
  return `/${lang}/${suffix}`;
}

async function main() {
  browser = await chromium.launch({ headless: true });

  // 1. Route matrix
  for (const view of Object.keys(VIEWS)) {
    for (const lang of LANGS) {
      const context = await contextFor(view);
      const page = await context.newPage();
      page.__view = view;

      const routes = [
        ["Homepage", `/${lang}/`],
        ["Products listing", langPath(lang, "products")],
        ["Brand directory", langPath(lang, "brands")],
        ["Brand detail", langPath(lang, `brands/${BRAND_SLUG}`)],
        ["Category directory", langPath(lang, "categories")],
        ["Category detail", langPath(lang, `categories/${CATEGORY_SLUG}`)],
        ["Vehicle directory", langPath(lang, "vehicles")],
        ["Vehicle detail", langPath(lang, `vehicles/${VEHICLE_SLUG}`)],
        ["Request a Part", langPath(lang, "request-part")],
        ["Contact", langPath(lang, "contact")],
        ["About", langPath(lang, "about")],
        ["Login", langPath(lang, "login")],
        ["Registration", langPath(lang, "register")],
        ["Forgot Password", langPath(lang, "forgot-password")],
        ["Reset Password", langPath(lang, "reset-password")],
        ["Account dashboard", langPath(lang, "account")],
        ["RFQ basket", langPath(lang, "request-quote")],
        ["Privacy Policy", langPath(lang, "privacy-policy")],
        ["Terms & Conditions", langPath(lang, "terms")],
        ["Refund Policy", langPath(lang, "refund")],
      ];

      for (const [label, route] of routes) {
        await check(`${view}/${lang}/${label}`, async () => {
          const response = await goto(page, BASE + route);
          const status = response?.status();
          if (!status || status >= 400) throw new Error(`HTTP ${status || "unknown"}`);
          const htmlLang = await page.locator("html").getAttribute("lang");
          if (htmlLang !== lang) throw new Error(`html lang is ${htmlLang}`);
          const main = page.locator("main").first();
          if (!(await main.count())) throw new Error("main landmark missing");
          const bodyText = await page.locator("body").innerText();
          if (!bodyText.trim()) throw new Error("empty body");
          await assertNoHorizontalOverflow(page);
          return `HTTP ${status}`;
        });
      }

      await context.close();
    }
  }

  // Root homepage is the canonical English homepage.
  for (const view of Object.keys(VIEWS)) {
    const context = await contextFor(view);
    const page = await context.newPage();
    page.__view = view;
    await check(`${view}/en/root homepage canonical route`, async () => {
      const response = await goto(page, BASE + "/");
      if ((response?.status() || 500) >= 400) throw new Error(`HTTP ${response?.status()}`);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      if (canonical !== "https://www.souviks.co.in/") throw new Error(`canonical ${canonical}`);
    });
    await context.close();
  }

  // Host-level resources
  for (const resource of ["/robots.txt", "/sitemap.xml"]) {
    for (const view of Object.keys(VIEWS)) {
      const context = await contextFor(view);
      const page = await context.newPage();
      page.__view = view;
      await check(`${view}/global/${resource}`, async () => {
        const response = await goto(page, BASE + resource);
        const status = response?.status();
        if (!status || status >= 400) throw new Error(`HTTP ${status || "unknown"}`);
        const text = await response.text();
        if (!text.trim()) throw new Error("empty response");
        if (resource === "/robots.txt" && !/Sitemap:/i.test(text)) {
          throw new Error("robots.txt has no Sitemap directive");
        }
        if (resource === "/sitemap.xml" && !/<sitemap|<urlset/i.test(text)) {
          throw new Error("not a sitemap XML document");
        }
        return `HTTP ${status}`;
      });
      await context.close();
    }
  }

  // 404 matrix: require an actual HTTP 404 and the correct translated page.
  const expected404Headings = {
    en: "Page Not Found",
    hi: "पृष्ठ नहीं मिला",
    bn: "পৃষ্ঠা পাওয়া যায়নি",
  };
  for (const view of Object.keys(VIEWS)) {
    for (const lang of LANGS) {
      const context = await contextFor(view);
      const page = await context.newPage();
      page.__view = view;
      await check(view + "/" + lang + "/404 page", async () => {
        const response = await goto(page, BASE + langPath(lang, "this-route-does-not-exist-regression-34"));
        const status = response?.status();
        if (status !== 404) throw new Error("expected HTTP 404, got " + (status || "unknown"));
        const htmlLang = await page.locator("html").getAttribute("lang");
        if (htmlLang !== lang) throw new Error("404 page language was " + htmlLang + ", expected " + lang);
        const heading = (await page.locator("main h1").first().innerText()).trim();
        if (!heading.includes(expected404Headings[lang])) throw new Error("unexpected translated 404 heading: " + heading);
        if (!(await page.locator('main a[href^="/' + lang + '/"]').count())) throw new Error("404 page has no language-local navigation links");
        await assertNoHorizontalOverflow(page);
        return "HTTP 404; translated heading confirmed";
      });
      await context.close();
    }
  }

  // Reliability fault-injection tests. These use disposable contexts and do not weaken
  // or skip any of the standard feature regression checks.
  await check("reliability/malformed URL parameters fail safely", async () => {
    const context = await contextFor("desktop");
    try {
      const page = await context.newPage();
      page.__view = "desktop";
      const response = await goto(page, BASE + "/en/products?page=not-a-number&pageSize=-1&sort=unexpected&brand_id=%3Cscript%3Ealert(1)%3C%2Fscript%3E&q=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
      if (!response || response.status() >= 400) throw new Error("malformed query parameters returned an HTTP error");
      if (!(await page.locator("main").count()) || !(await page.locator("#product-grid").count())) {
        throw new Error("catalogue landmarks disappeared after malformed parameters");
      }
      if (await page.locator("#product-grid script, #noResults script, #noResults img[onerror], #noResults svg[onload]").count()) {
        throw new Error("query content was interpreted as executable markup");
      }
      return "catalogue rendered without executing or injecting query markup";
    } finally {
      await context.close();
    }
  });

  await check("reliability/empty and unexpected searches recover", async () => {
    const context = await contextFor("desktop");
    try {
      const page = await context.newPage();
      page.__view = "desktop";
      await goto(page, BASE + "/en/products");
      const input = page.locator("#searchInput");
      const grid = page.locator("#product-grid .product-card");
      await input.fill("   ");
      await page.waitForTimeout(350);
      if ((await grid.count()) < 1) throw new Error("whitespace-only search did not restore the catalogue");

      const hostileQuery = 'no-match-probe <img src=x onerror=alert(1)> 💥';
      await input.fill(hostileQuery);
      await page.waitForTimeout(350);
      if (!(await page.locator("#noResults").isVisible())) {
        throw new Error("unexpected search did not show the no-results message");
      }
      if (await page.locator("#noResults img, #noResults script, #noResults svg").count()) {
        throw new Error("unexpected search input was inserted as HTML");
      }

      await input.fill("");
      await page.waitForTimeout(350);
      if ((await grid.count()) < 1) throw new Error("catalogue did not recover after clearing search");
      return "blank input restores products; unexpected input gives a safe empty state; clearing recovers";
    } finally {
      await context.close();
    }
  });

  await check("reliability/missing JSON resource returns 404", async () => {
    const context = await browser.newContext();
    try {
      const response = await context.request.get(BASE + "/assets/data/regression-missing-file.json", { timeout: 10000 });
      if (response.status() !== 404) throw new Error("missing JSON resource returned HTTP " + response.status() + " instead of 404");
      if (!(await response.text()).trim()) throw new Error("missing JSON response body was empty");
      return "HTTP 404 response confirmed";
    } finally {
      await context.close();
    }
  });

  await check("reliability/malformed JSON data does not break the catalogue", async () => {
    const context = await contextFor("desktop");
    try {
      const page = await context.newPage();
      page.__view = "desktop";
      let intercepted = 0;
      await page.route("**/assets/data/products.json", async route => {
        intercepted += 1;
        await route.fulfill({ status: 200, contentType: "application/json", body: "{ malformed JSON" });
      });
      await goto(page, BASE + "/en/products");
      const probe = await page.evaluate(async () => {
        try {
          const response = await fetch("/assets/data/products.json", { cache: "no-store" });
          await response.json();
          return { rejected: false };
        } catch (error) {
          return { rejected: true, message: String(error?.message || error) };
        }
      });
      if (!probe.rejected || !intercepted) throw new Error("malformed JSON was not rejected as expected");
      if ((await page.locator("#product-grid .product-card").count()) < 1) {
        throw new Error("static product cards disappeared after a malformed JSON response");
      }
      await page.locator("#searchInput").fill("69050050");
      await page.waitForTimeout(350);
      if (!(await page.locator("#product-grid").innerText()).includes("69050050")) {
        throw new Error("client-side search became unusable after malformed JSON");
      }
      return "malformed data rejected; pre-rendered products and search remain usable";
    } finally {
      await context.close();
    }
  });

  await check("reliability/unavailable catalogue API does not break the page", async () => {
    const context = await contextFor("desktop");
    try {
      const page = await context.newPage();
      page.__view = "desktop";
      let intercepted = 0;
      await page.route("**/assets/data/products.json", async route => {
        intercepted += 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "service_unavailable", message: "Temporarily unavailable" })
        });
      });
      await goto(page, BASE + "/en/products");
      const status = await page.evaluate(async () => {
        const response = await fetch("/assets/data/products.json", { cache: "no-store" });
        return response.status;
      });
      if (status !== 503 || !intercepted) throw new Error("could not verify injected HTTP 503 response");
      if ((await page.locator("#product-grid .product-card").count()) < 1) {
        throw new Error("static products disappeared when the data endpoint returned 503");
      }
      await page.locator("#searchInput").fill("69050050");
      await page.waitForTimeout(350);
      if (!(await page.locator("#product-grid").innerText()).includes("69050050")) {
        throw new Error("catalogue search stopped working during an API outage");
      }
      return "HTTP 503 confirmed; static catalogue and client-side search remain usable";
    } finally {
      await context.close();
    }
  });

  await check("reliability/broken product images fall back without disabling RFQ", async () => {
    const context = await contextFor("desktop");
    try {
      const page = await context.newPage();
      page.__view = "desktop";
      await page.route("**/assets/images/products/**", async route => {
        await route.fulfill({ status: 404, contentType: "image/webp", body: "missing image fixture" });
      });
      await goto(page, BASE + "/en/products/10-x-15-nut");
      await page.waitForFunction(() => {
        const image = document.querySelector("#pdpMainImage");
        return image && (image.getAttribute("src") || "").endsWith("/assets/images/placeholder.webp");
      }, null, { timeout: 8000 });
      await page.waitForFunction(() => {
        const image = document.querySelector("#pdpMainImage");
        return image && image.complete && image.naturalWidth > 0;
      }, null, { timeout: 8000 });
      const fallback = await page.locator("#pdpMainImage").evaluate(image => ({
        src: image.getAttribute("src") || "", width: image.naturalWidth, complete: image.complete
      }));
      if (!fallback.src.endsWith("/assets/images/placeholder.webp") || !fallback.complete || fallback.width < 1) {
        throw new Error("failed product image did not load the valid placeholder");
      }
      if (!(await page.locator("main h1").innerText()).includes("10 x 1.5 Nut")) {
        throw new Error("product content disappeared when its image failed");
      }
      await page.evaluate(() => localStorage.removeItem("souviks_rfq_guest"));
      await page.locator(".pdp-rfq-btn").click();
      const saved = await page.evaluate(() => {
        const raw = localStorage.getItem("souviks_rfq_guest");
        return raw ? JSON.parse(raw) : [];
      });
      if (!Array.isArray(saved) || !saved.length) throw new Error("Add to RFQ stopped working after image failures");
      return "placeholder loaded; product details and Add to RFQ remain functional";
    } finally {
      await context.close();
    }
  });

  await check("reliability/missing brand logo leaves brand content usable", async () => {
    const context = await contextFor("desktop");
    try {
      const page = await context.newPage();
      page.__view = "desktop";
      let intercepted = false;
      await page.route("**/assets/images/brands/abc.png", async route => {
        intercepted = true;
        await route.fulfill({ status: 404, contentType: "image/png", body: "missing brand logo fixture" });
      });
      await goto(page, BASE + "/en/brands/abc");
      await page.locator("#brand-detail .brand-logo img").scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      if (!intercepted) throw new Error("brand logo 404 was not injected");
      if (!(await page.locator("#brand-detail h1").innerText()).includes("ABC")) {
        throw new Error("brand heading disappeared when the logo failed");
      }
      if ((await page.locator(".entity-product-galleries .product-card").count()) < 1) {
        throw new Error("brand product gallery disappeared when the logo failed");
      }
      return "brand logo failed; brand name and product gallery remain available";
    } finally {
      await context.close();
    }
  });

  await check("reliability/authentication HTTP 503 shows service-unavailable feedback", async () => {
    const context = await contextFor("desktop");
    try {
      const page = await context.newPage();
      page.__view = "desktop";
      const runtimeErrors = [];
      page.on("pageerror", error => runtimeErrors.push(error?.message || String(error)));
      await goto(page, BASE + "/en/login");
      await page.route("**/auth/v1/token*", async route => {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Authentication service temporarily unavailable" })
        });
      });
      await page.locator("#email").fill("regression@example.invalid");
      await page.locator("#password").fill("not-a-real-password");
      await page.locator('#loginForm button[type="submit"]').click();
      await page.waitForFunction(() => /authentication service is unavailable/i.test(
        document.querySelector("#loginStatus")?.textContent || ""
      ), null, { timeout: 8000 });
      const message = (await page.locator("#loginStatus").innerText()).trim();
      if (/invalid email or password/i.test(message)) throw new Error("service outage was reported as invalid credentials");
      if (runtimeErrors.length) throw new Error("uncaught browser error: " + runtimeErrors[0]);
      if (await page.locator('#loginForm button[type="submit"]').isDisabled()) {
        throw new Error("login submit button remained disabled after service failure");
      }
      return message;
    } finally {
      await context.close();
    }
  });

  await check("reliability/authentication network failure gives retry guidance", async () => {
    const context = await contextFor("desktop");
    try {
      const page = await context.newPage();
      page.__view = "desktop";
      await goto(page, BASE + "/en/login");
      await page.route("**/auth/v1/token*", async route => route.abort("failed"));
      await page.locator("#email").fill("regression@example.invalid");
      await page.locator("#password").fill("not-a-real-password");
      await page.locator('#loginForm button[type="submit"]').click();
      await page.waitForFunction(() => /unable to connect to the authentication service/i.test(
        document.querySelector("#loginStatus")?.textContent || ""
      ), null, { timeout: 8000 });
      const message = (await page.locator("#loginStatus").innerText()).trim();
      if (await page.locator('#loginForm button[type="submit"]').isDisabled()) {
        throw new Error("login submit button remained disabled after network failure");
      }
      return message;
    } finally {
      await context.close();
    }
  });

  if (["127.0.0.1", "localhost"].includes(new URL(BASE).hostname)) {
    await check("reliability/static server 500 response is understandable", async () => {
      const context = await browser.newContext();
      try {
        const response = await context.request.get(BASE + "/en/%E0%A4%A", { timeout: 10000 });
        if (response.status() !== 500) {
          throw new Error("malformed percent-encoding returned HTTP " + response.status() + " instead of 500");
        }
        if (!/internal server error/i.test(await response.text())) {
          throw new Error("500 response did not return a safe failure message");
        }
        return "HTTP 500 and generic error message confirmed on the local static regression server";
      } finally {
        await context.close();
      }
    });
  } else {
    record("reliability/static server 500 response", "SKIP", "Production static hosting does not expose the local Node error handler.");
  }

  // Feature matrix: product catalogue, PDP, and guest RFQ in every language + viewport.
  for (const view of Object.keys(VIEWS)) {
    for (const lang of LANGS) {
      const context = await contextFor(view);
      const page = await context.newPage();
      page.__view = view;

      // Product listing + filters + pagination + search + save gate + add to RFQ
      await check(`${view}/${lang}/product listing cards`, async () => {
        await goto(page, BASE + langPath(lang, "products"));
        const cards = page.locator("#product-grid .product-card");
        const count = await cards.count();
        if (count < 1) throw new Error("no product cards");
        return `${count} cards`;
      });

      await check(`${view}/${lang}/product listing images load`, async () => {
        const images = page.locator("#product-grid .product-card img");
        const count = await images.count();
        if (count < 1) throw new Error("product listing images missing");
        const sampleCount = Math.min(count, 5);
        for (let i = 0; i < sampleCount; i++) {
          const image = images.nth(i);
          await image.scrollIntoViewIfNeeded();
          const state = await image.evaluate(async element => {
            if (!element.complete) {
              await new Promise(resolve => {
                element.addEventListener("load", resolve, { once: true });
                element.addEventListener("error", resolve, { once: true });
                setTimeout(resolve, 4000);
              });
            }
            return {
              src: element.getAttribute("src") || "",
              width: element.naturalWidth,
              complete: element.complete
            };
          });
          if (!state.complete || state.width < 1) {
            throw new Error(`image ${i + 1} failed to load: ${state.src}`);
          }
        }
        return `${sampleCount} product images loaded`;
      });

      await check(`${view}/${lang}/product filters`, async () => {
        for (const selector of ["#brandFilter", "#categoryFilter"]) {
          const select = page.locator(selector);
          if (!(await select.count())) throw new Error(`${selector} missing`);
          const options = await select.locator("option").count();
          if (options < 2) throw new Error(`${selector} has <2 options`);
          const value = await select.locator("option").nth(1).getAttribute("value");
          if (!value) throw new Error(`${selector} first real option empty`);
          await select.selectOption(value);
          await page.waitForTimeout(350);
          if ((await page.locator("#product-grid .product-card").count()) < 1) {
            throw new Error(`${selector} produced no cards`);
          }
          await select.selectOption("");
          await page.waitForTimeout(250);
        }
      });

      await check(`${view}/${lang}/product pagination`, async () => {
        const next = page.locator("#pagination .pagination-next");
        const status = page.locator("#pagination .pagination-status");
        if (!(await next.count()) || !(await status.count())) throw new Error("pagination controls missing");
        const before = await status.innerText();
        await next.click();
        await page.waitForTimeout(250);
        const after = await status.innerText();
        if (before === after) throw new Error("next page did not change");
        await page.locator("#pagination .pagination-prev").click();
        await page.waitForTimeout(250);
        return `${before} -> ${after}`;
      });

      await check(`${view}/${lang}/product search`, async () => {
        const input = page.locator("#searchInput");
        await input.fill("69050050");
        await page.waitForTimeout(300);
        const cards = page.locator("#product-grid .product-card");
        const text = await page.locator("#product-grid").innerText();
        if ((await cards.count()) < 1 || !text.includes("69050050")) {
          throw new Error("part-number search did not find 69050050");
        }
        await input.fill("");
        return "69050050 found";
      });

      await check(`${view}/${lang}/save product auth gate`, async () => {
        const button = page.locator("[data-saved-product-id]").first();
        if (!(await button.count())) throw new Error("save product control missing");
        await button.click();
        await page.waitForTimeout(400);
        const url = page.url();
        const modalVisible = await page.locator("#authModal").isVisible().catch(() => false);
        if (!modalVisible && !/\/login(?:\?|$)/.test(url)) {
          throw new Error(`anonymous save did not open auth gate: ${url}`);
        }
        return modalVisible ? "auth modal opened" : "login route opened";
      });

      await page.goto(BASE + langPath(lang, "products"), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      await page.evaluate(() => localStorage.removeItem("souviks_rfq_guest"));

      await check(`${view}/${lang}/add to RFQ`, async () => {
        const button = page.locator(".add-to-cart").first();
        if (!(await button.count())) throw new Error("Add To RFQ control missing");
        await button.click();
        await page.waitForTimeout(400);
        const badge = await page.locator(".rfq-badge").first().innerText();
        if (Number(badge) !== 1) throw new Error(`RFQ badge is ${badge}`);
        return "badge=1";
      });

      // RFQ basket: item presence, quantity, removal, submission.
      await check(`${view}/${lang}/RFQ basket`, async () => {
        await goto(page, BASE + langPath(lang, "request-quote"));
        const rows = page.locator("#rfq-items tr");
        if ((await rows.count()) !== 1) throw new Error(`expected 1 RFQ row, got ${await rows.count()}`);
        const quantityControls = page.locator("#rfq-items .rfq-qty .qty-plus, #rfq-items .rfq-qty .qty-minus");
        if ((await quantityControls.count()) < 2) throw new Error("RFQ quantity controls missing");
        const removeControl = page.locator("#rfq-items .remove-rfq");
        if (!(await removeControl.count())) throw new Error("RFQ remove control missing");
      });

      await check(`${view}/${lang}/RFQ quantity changes`, async () => {
        const row = page.locator("#rfq-items tr").first();
        const plus = row.locator(".rfq-qty .qty-plus");
        if (!(await plus.count())) throw new Error("RFQ quantity increase control missing");
        await plus.click();
        await page.waitForTimeout(250);
        await plus.click();
        await page.waitForTimeout(250);
        const qtyText = await row.locator(".rfq-qty").innerText();
        const values = qtyText.match(/\d+/g) || [];
        const quantity = Number(values[0] || 0);
        const stored = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_rfq_guest");
          const items = raw ? JSON.parse(raw) : [];
          return Number(items?.[0]?.qty || 0);
        });
        if (quantity !== 3 || stored !== 3) throw new Error(`quantity UI=${quantity}; localStorage=${stored}`);
        return "quantity=3";
      });

      await check(`${view}/${lang}/RFQ removal`, async () => {
        const row = page.locator("#rfq-items tr").first();
        const remove = row.locator(".remove-rfq");
        if (!(await remove.count())) throw new Error("RFQ remove control missing");
        await remove.click();
        await page.waitForTimeout(300);
        const rows = page.locator("#rfq-items tr");
        const removeControls = page.locator("#rfq-items .remove-rfq");
        const plusControls = page.locator("#rfq-items .qty-plus");
        const stored = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_rfq_guest");
          return raw ? JSON.parse(raw) : [];
        });
        if ((await rows.count()) !== 1 || (await removeControls.count()) !== 0 || (await plusControls.count()) !== 0 || stored.length !== 0) {
          throw new Error("RFQ row was not removed");
        }
      });

      // Re-add and submit with EmailJS intercepted so no real email is sent.
      await page.goto(BASE + langPath(lang, "products"), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      await page.locator(".add-to-cart").first().click();
      await page.waitForTimeout(250);
      await page.goto(BASE + langPath(lang, "request-quote"), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      await check(`${view}/${lang}/RFQ submission`, async () => {
        await page.route("**/api.emailjs.com/**", route =>
          route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
        );
        await page.locator("#rfq-name").fill("Regression Test");
        await page.locator("#rfq-phone").fill("9000000000");
        await page.locator("#rfq-form button[type=submit]").click();
        await page.waitForTimeout(600);
        const status = page.locator("#rfqFormStatus");
        const text = await status.innerText().catch(() => "");
        if (!/success|submitted|RFQ/i.test(text)) {
          throw new Error(`submission status: ${text || "missing"}`);
        }
        await page.unroute("**/api.emailjs.com/**");
        return "client submission path completed";
      });

      // PDP
      await check(`${view}/${lang}/product detail`, async () => {
        await goto(page, BASE + langPath(lang, `products/${PRODUCT_SLUG}`));
        if (!(await page.locator("#product-detail").count())) throw new Error("product detail root missing");
        if (!(await page.locator(".pdp-title").count())) throw new Error("PDP title missing");
      });

      await check(`${view}/${lang}/product gallery`, async () => {
        const thumbs = page.locator(".pdp-thumbnails .pdp-thumb");
        const count = await thumbs.count();
        if (count < 4) throw new Error(`gallery has ${count} thumbnails`);
        const main = page.locator("#pdpMainImage");
        const before = await main.getAttribute("src");
        await thumbs.nth(1).click();
        await page.waitForTimeout(250);
        const after = await main.getAttribute("src");
        if (before === after) throw new Error("main image did not change");
        return `4+ thumbnails; main image changed`;
      });

      await check(`${view}/${lang}/related products`, async () => {
        const count = await page.locator(".pdp-related-slider-main .product-card").count();
        if (count < 1) throw new Error("related products empty");
        return `${count} related`;
      });

      await check(`${view}/${lang}/frequently used products`, async () => {
        const count = await page.locator(".pdp-frequent-slider .product-card").count();
        if (count < 1) throw new Error("frequently used products empty");
        return `${count} frequently used`;
      });

      await check(`${view}/${lang}/entity gallery missing-image fallback loads`, async () => {
        await goto(page, BASE + langPath(lang, "brands/bapi"));
        const missingImages = page.locator('.entity-product-galleries img[data-image-state="missing"]');
        const count = await missingImages.count();
        if (count < 1) throw new Error("fixture no longer contains a missing-image product");
        const image = missingImages.first();
        await image.scrollIntoViewIfNeeded();
        const state = await image.evaluate(async element => {
          if (!element.complete) {
            await new Promise(resolve => {
              element.addEventListener("load", resolve, { once: true });
              element.addEventListener("error", resolve, { once: true });
              setTimeout(resolve, 4000);
            });
          }
          return {
            src: element.getAttribute("src") || "",
            width: element.naturalWidth,
            complete: element.complete
          };
        });
        if (!state.src.endsWith("/assets/images/placeholder.webp")) {
          throw new Error(`missing-image fallback URL was ${state.src}`);
        }
        if (!state.complete || state.width < 1) {
          throw new Error(`fallback image failed to load: ${state.src}`);
        }
        return "explicit placeholder loaded; no broken product image URL";
      });

      await check(`${view}/${lang}/PDP quantity + Add to RFQ`, async () => {
        await page.evaluate(() => localStorage.removeItem("souviks_rfq_guest"));
        const qty = page.locator("#pdpQty");
        await qty.fill("2");
        await page.locator(".pdp-qty-plus").click();
        const value = await qty.inputValue();
        if (value !== "3") throw new Error(`PDP qty is ${value}`);
        await page.locator(".pdp-rfq-btn").click();
        await page.waitForTimeout(300);
        const stored = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_rfq_guest");
          const items = raw ? JSON.parse(raw) : [];
          return items?.[0]?.qty;
        });
        if (Number(stored) !== 3) throw new Error(`RFQ stored qty is ${stored}`);
      });

      // Forms
      await check(`${view}/${lang}/Request a Part form`, async () => {
        await goto(page, BASE + langPath(lang, "request-part"));
        await page.locator("#requestPartForm").locator("#name").fill("Regression Test");
        await page.locator("#requestPartForm").locator("#phone").fill("9000000000");
        await page.locator("#requestPartForm").locator("#requirement").fill("Regression test request");
        await page.route("**/api.emailjs.com/**", route =>
          route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
        );
        await page.locator("#requestPartForm button[type=submit]").click();
        await page.waitForTimeout(500);
        const body = await page.locator("body").innerText();
        if (!/success|submitted|received|thank/i.test(body)) throw new Error("request-part success feedback missing");
        await page.unroute("**/api.emailjs.com/**");
      });

      await check(`${view}/${lang}/Contact form`, async () => {
        await goto(page, BASE + langPath(lang, "contact"));
        const form = page.locator("form").first();
        if (!(await form.count())) throw new Error("contact form missing");
        const required = await form.locator("[required]").count();
        if (required < 1) throw new Error("contact form has no required fields");
        await page.route("**/api.emailjs.com/**", route =>
          route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
        );
        await form.locator("#contactName").fill("Regression Test");
        await form.locator("#contactPhone").fill("9000000000");
        await form.locator("#contactMessage").fill("Regression test enquiry");
        await form.locator("button[type=submit]").click();
        await page.waitForTimeout(500);
        const body = await page.locator("body").innerText();
        if (!/success|submitted|received|thank/i.test(body)) throw new Error("contact success feedback missing");
        await page.unroute("**/api.emailjs.com/**");
      });

      // Auth forms: exercise form presence + native required constraints without logging in.
      for (const [label, route, formSelector] of [
        ["Login form", "login", "form"],
        ["Registration form", "register", "form"],
        ["Forgot Password form", "forgot-password", "form"],
        ["Reset Password form", "reset-password", "form"],
      ]) {
        await check(`${view}/${lang}/${label}`, async () => {
          await goto(page, BASE + langPath(lang, route));
          const form = page.locator(formSelector).first();
          if (!(await form.count())) throw new Error("form missing");
          const required = await form.locator("[required]").count();
          if (required < 1) throw new Error("no required fields");
          const valid = await form.evaluate(node => node.checkValidity());
          if (valid) throw new Error("empty auth form unexpectedly valid");
        });
      }

      // Account sub-views and anonymous auth gate/state surfaces.
      for (const [viewName, titleText] of [
        ["account", "My Account"],
        ["rfq", "RFQ"],
        ["inquiries", "Inquiries"],
        ["saved", "Saved"],
        ["vehicles", "Vehicle"],
      ]) {
        await check(`${view}/${lang}/account ${viewName} view`, async () => {
          const response = await page.request.get(
            BASE + langPath(lang, `account?view=${viewName}`),
            { timeout: 30000 }
          );
          const status = response.status();
          if (!status || status >= 400) throw new Error(`HTTP ${status || "unknown"}`);

          const source = await response.text();
          const marker = `data-account-view="${viewName}"`;
          const section = new RegExp("<div\\s+class=\"account-view\"[\\s\\S]*?" + marker, "i");
          if (!section.test(source)) {
            throw new Error("account view section missing from template");
          }
          if (!source.toLowerCase().includes(titleText.toLowerCase())) {
            throw new Error("requested account view text missing from template");
          }
          return `${titleText} template present; HTTP ${status}`;
        });
      }

      await check(`${view}/${lang}/Sign Out anonymous state`, async () => {
        const session = await page.evaluate(async () => {
          if (typeof supabaseClient === "undefined") return null;
          const result = await supabaseClient.auth.getUser();
          return result?.data?.user || null;
        }).catch(() => null);
        if (session) throw new Error("unexpected authenticated session in fresh context");
        const logout = page.locator("[data-auth-logout]");
        if (!(await logout.count())) throw new Error("logout control missing");
        return "no authenticated session; logout control present";
      });

      await context.close();
    }
  }

  const outputDir = path.join(process.cwd(), "regression-results");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "final-regression-results.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    environments: Object.keys(VIEWS).length * LANGS.length,
    passed: results.filter(r => r.status === "PASS").length,
    failed: results.filter(r => r.status === "FAIL").length,
    results,
  }, null, 2));

  const failed = results.filter(r => r.status === "FAIL");
  console.log(`SUMMARY: ${results.length} checks, ${results.length - failed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length ? 1 : 0;

  await browser.close();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
  if (browser) browser.close().catch(() => {});
});
