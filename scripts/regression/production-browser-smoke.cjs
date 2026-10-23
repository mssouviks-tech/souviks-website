#!/usr/bin/env node
/* Live production browser smoke test. Never submits forms or sends RFQs. */
const { chromium } = require("playwright");

const BASE = (process.env.PRODUCTION_BASE_URL || "https://www.souviks.co.in").replace(/\/+$/, "");
const LANGS = ["en", "hi", "bn"];
const VIEWS = [
  { name: "desktop", viewport: { width: 1365, height: 900 }, isMobile: false, hasTouch: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const results = [];
const errors = [];

function record(name, error) {
  const result = { name, passed: !error, ...(error ? { error: String(error.message || error) } : {}) };
  results.push(result);
  console.log("[" + (error ? "FAIL" : "PASS") + "] " + name + (error ? ": " + result.error : ""));
}

async function check(name, fn) {
  try {
    await fn();
    record(name, null);
  } catch (error) {
    record(name, error);
    errors.push(name + ": " + String(error.message || error));
  }
}

async function attachPageErrors(page) {
  page.__souviksPageErrors = [];
  page.__souviksConsoleErrors = [];
  page.on("pageerror", error => page.__souviksPageErrors.push(error?.message || String(error)));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/net::ERR_ABORTED|net::ERR_CANCELED|Navigation interrupted/i.test(text)) return;
    page.__souviksConsoleErrors.push(text);
  });
}

function assertNoPageErrors(page) {
  const uncaught = page.__souviksPageErrors.splice(0);
  const consoleErrors = page.__souviksConsoleErrors.splice(0);
  const found = [...uncaught.map(error => "pageerror: " + error), ...consoleErrors.map(error => "console: " + error)];
  if (found.length) throw new Error("browser JavaScript/console error: " + found.slice(0, 6).join(" | "));
}

async function httpFailureDetails(response) {
  if (!response) return "no HTTP response";
  const headers = await response.allHeaders().catch(() => ({}));
  let body = "";
  try {
    body = (await response.text()).replace(/\\s+/g, " ").trim().slice(0, 240);
  } catch (_) {
    body = "response body unavailable";
  }
  const details = {};
  for (const name of ["server", "cf-ray", "cf-mitigated", "cf-cache-status", "content-type", "location"]) {
    if (headers[name]) details[name] = headers[name];
  }
  details.body = body;
  return JSON.stringify(details);
}

async function goto(page, path) {
  const response = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!response) throw new Error("no HTTP response for " + path);
  if (response.status() !== 200) {
    throw new Error(path + " returned HTTP " + response.status() + "; " + await httpFailureDetails(response));
  }
  await page.waitForTimeout(500);
  assertNoPageErrors(page);
  const language = await page.evaluate(() => window.souviks?.currentLanguage || "");
  if (path !== "/" && language && !path.startsWith("/" + language + "/") && path !== "/" + language) {
    throw new Error("page language " + language + " does not match route " + path);
  }
  return response;
}

async function clickPrimaryLink(page, view, lang, destination) {
  await goto(page, "/" + lang + "/products");
  const navigation = page.locator("#mainNavigation");
  const link = navigation.locator('.navigation-menu a[href="' + destination + '"]').first();
  if (!(await link.count())) throw new Error("primary navigation link " + destination + " is missing");

  if (view.isMobile) {
    await page.locator("#mobileMenuButton").click();
    await page.waitForFunction(
      () => document.querySelector("#mainNavigation")?.classList.contains("active"),
      null,
      { timeout: 8000 }
    );
  }

  // Products, Brands, Categories and Vehicles are now nested in the Shop
  // disclosure. Open that group before checking visibility or clicking a link.
  const shopRoutes = new Set([
    "/" + lang + "/products",
    "/" + lang + "/brands",
    "/" + lang + "/categories",
    "/" + lang + "/vehicles",
  ]);
  if (shopRoutes.has(destination)) {
    const shopToggle = navigation.locator("#navDropdownToggle-shop");
    if (!(await shopToggle.count())) throw new Error("primary navigation Shop dropdown is missing");
    await shopToggle.click();
    await page.waitForFunction(
      () => {
        const toggle = document.querySelector("#navDropdownToggle-shop");
        const menu = document.querySelector("#navDropdown-shop");
        return toggle?.getAttribute("aria-expanded") === "true"
          && menu?.closest(".nav-dropdown")?.classList.contains("is-open");
      },
      null,
      { timeout: 8000 }
    );
  }

  if (view.isMobile) {
    try {
      await link.scrollIntoViewIfNeeded();
      await link.waitFor({ state: "visible", timeout: 8000 });
    } catch {
      const visibility = await link.evaluate(el => {
        const chain = [];
        let node = el;
        while (node && chain.length < 6) {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          chain.push({
            tag: node.tagName,
            id: node.id || "",
            className: typeof node.className === "string" ? node.className : "",
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            ariaHidden: node.getAttribute("aria-hidden"),
            hidden: Boolean(node.hidden)
          });
          node = node.parentElement;
        }
        const nav = document.querySelector("#mainNavigation");
        return {
          navigationActive: Boolean(nav?.classList.contains("active")),
          navigationVisibility: nav ? getComputedStyle(nav).visibility : "missing",
          navigationAriaHidden: nav?.getAttribute("aria-hidden") || "",
          ancestorChain: chain
        };
      }).catch(error => ({ diagnosticError: String(error) }));
      throw new Error(
        "mobile navigation link " + destination +
        " is not visible after opening its navigation group; visibility=" +
        JSON.stringify(visibility)
      );
    }
  } else if (!(await link.isVisible())) {
    throw new Error("desktop navigation link " + destination + " is not visible after opening its navigation group");
  }

  // The mobile navigation is allowed to use the History API. In that case
  // Playwright resolves waitForNavigation with null even though route changes.
  // Assert the destination URL and rendered page, and validate HTTP status only
  // when a full document navigation actually produced a response.
  const navigationPromise = page
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 })
    .catch(() => null);
  const destinationPromise = page.waitForURL(
    url => url.pathname === destination,
    { timeout: 10000 }
  );
  await link.click();
  await destinationPromise;
  const response = await navigationPromise;
  if (response && response.status() !== 200) {
    throw new Error(destination + " click returned HTTP " + response.status() + "; " + await httpFailureDetails(response));
  }
  if (new URL(page.url()).pathname !== destination) {
    throw new Error("clicked " + destination + ", landed at " + new URL(page.url()).pathname);
  }
  await page.waitForTimeout(350);
  assertNoPageErrors(page);
  if (!(await page.locator("main h1, main [role='heading']").count())) {
    throw new Error(destination + " did not render a page heading");
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const view of VIEWS) {
      for (const lang of LANGS) {
        const context = await browser.newContext({
          viewport: view.viewport,
          isMobile: view.isMobile,
          hasTouch: view.hasTouch,
        });
        const page = await context.newPage();
        await attachPageErrors(page);
        try {
          if (lang === "en") {
            await check(view.name + "/root canonical English homepage and hero", async () => {
              const response = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
              if (!response || response.status() !== 200) {
                throw new Error("root homepage returned HTTP " + (response?.status() || "unknown") + "; " + await httpFailureDetails(response));
              }
              const current = new URL(page.url());
              if (current.pathname !== "/" || current.search || current.hash) {
                throw new Error("English-preference root request did not stay at the canonical root: " + current.pathname + current.search + current.hash);
              }
              const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
              if (canonical !== "https://www.souviks.co.in/") {
                throw new Error("root homepage canonical URL is " + (canonical || "missing"));
              }
              await page.waitForFunction(() => {
                const heading = document.querySelector(".home-hero h1");
                return heading && heading.textContent.trim().length > 0;
              }, null, { timeout: 10000 });
              const heading = (await page.locator(".home-hero h1").innerText()).trim();
              if (!heading || /Still loading|Continue in English/i.test(await page.locator("body").innerText())) {
                throw new Error("homepage did not render its English hero content");
              }
              assertNoPageErrors(page);
            });
          }

          await check(view.name + "/" + lang + "/page runtime and product listing", async () => {
            await goto(page, "/" + lang + "/products");
            const configLanguage = await page.evaluate(() => window.souviks?.currentLanguage || "");
            if (configLanguage !== lang) {
              throw new Error("window.souviks.currentLanguage=" + (configLanguage || "undefined") + ", expected " + lang);
            }
            const cards = await page.locator("#product-grid .product-card").count();
            if (cards < 1) throw new Error("product listing has no rendered product cards");
          });

          for (const target of [
            { label: "Home", path: "/" + lang + "/" },
            { label: "Products", path: "/" + lang + "/products" },
            { label: "Brands", path: "/" + lang + "/brands" },
          ]) {
            await check(view.name + "/" + lang + "/primary toolbar " + target.label + " click", async () => {
              await clickPrimaryLink(page, view, lang, target.path);
            });
          }
        } finally {
          await context.close();
        }
      }
    }

    // Checkout-cart browser checks mutate localStorage only and never submit an order.
    await check("desktop/en/priced product card adds to checkout Cart", async () => {
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
      const page = await context.newPage();
      await attachPageErrors(page);
      try {
        await goto(page, "/en/products");
        await page.evaluate(() => {
          localStorage.removeItem("souviks_rfq_guest");
          localStorage.removeItem("souviks_purchase_cart_v1");
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(400);
        assertNoPageErrors(page);

        const addButton = page.locator("#product-grid .product-card .add-to-purchase-cart").first();
        if (!(await addButton.count())) throw new Error("no priced product card exposes Add to Cart");
        const productId = await addButton.getAttribute("data-id");
        if (!productId) throw new Error("priced card has no product ID");
        await addButton.click();
        const state = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_purchase_cart_v1");
          const items = raw ? JSON.parse(raw) : [];
          const rfqRaw = localStorage.getItem("souviks_rfq_guest");
          return {
            items,
            rfqItems: rfqRaw ? JSON.parse(rfqRaw) : [],
            badge: document.querySelector("a[href$='/cart'] .purchase-cart-count")?.textContent?.trim()
          };
        });
        if (state.items.length !== 1 || state.items[0].productId !== productId || Number(state.items[0].quantity) !== 1) {
          throw new Error("priced card did not add the expected product to the checkout cart");
        }
        if (state.rfqItems.length) throw new Error("priced card unexpectedly populated the discontinued RFQ cart");
        if (state.badge !== "1") throw new Error("checkout Cart badge did not reflect one item");
      } finally {
        await context.close();
      }
    });

    await check("desktop/en/priced product detail quantity adds to checkout Cart", async () => {
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
      const page = await context.newPage();
      await attachPageErrors(page);
      try {
        await page.evaluate(() => {
          localStorage.removeItem("souviks_rfq_guest");
          localStorage.removeItem("souviks_purchase_cart_v1");
        }).catch(() => {});
        await goto(page, "/en/products/10-x-15-nut");
        const heading = (await page.locator(".pdp-title").innerText()).trim();
        if (!heading.toLowerCase().includes("10 x 1.5 nut")) {
          throw new Error("unexpected product detail heading: " + heading);
        }
        await page.waitForFunction(() => {
          const img = document.querySelector("#pdpMainImage");
          return img && img.complete && img.naturalWidth > 0;
        }, null, { timeout: 10000 });

        const qty = page.locator("#pdpQty");
        await qty.fill("2");
        await page.locator(".pdp-qty-plus").click();
        if ((await qty.inputValue()) !== "3") throw new Error("PDP quantity selector did not retain quantity 3");
        const addButton = page.locator(".pdp-add-to-purchase-cart");
        if (!(await addButton.count())) throw new Error("priced product detail lacks Add to Cart");
        if (await page.locator(".pdp-rfq-btn, .pdp-remove-btn").count()) {
          throw new Error("product detail still exposes legacy RFQ-cart controls");
        }
        await addButton.click();
        const result = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_purchase_cart_v1");
          const items = raw ? JSON.parse(raw) : [];
          const rfqRaw = localStorage.getItem("souviks_rfq_guest");
          return {
            count: items.length,
            quantity: Number(items?.[0]?.quantity || 0),
            rfqCount: rfqRaw ? JSON.parse(rfqRaw).length : 0
          };
        });
        if (result.count !== 1 || result.quantity !== 3) {
          throw new Error("PDP purchase quantity was not stored correctly: " + JSON.stringify(result));
        }
        if (result.rfqCount) throw new Error("product detail added to the discontinued RFQ cart");
        await goto(page, "/en/cart");
        if (!(await page.locator("#purchase-cart-root").count())) throw new Error("checkout Cart page is missing");
        const title = (await page.locator("main h1").first().innerText()).trim();
        if (!/cart/i.test(title)) throw new Error("checkout Cart page does not identify itself as Cart");
        assertNoPageErrors(page);
      } finally {
        await context.close();
      }
    });
  } finally {
    await browser.close();
  }

  console.log("\nProduction browser smoke: " + results.filter(result => result.passed).length + "/" + results.length + " passed.");
  if (errors.length) {
    console.error("\nFailures:\n" + errors.map(error => " - " + error).join("\n"));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
