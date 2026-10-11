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
  } else if (!(await link.isVisible())) {
    throw new Error("desktop navigation link " + destination + " is not visible");
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
            await check(view.name + "/root homepage language redirect and hero", async () => {
              const response = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
              if (!response || response.status() !== 200) {
                throw new Error("root homepage returned HTTP " + (response?.status() || "unknown") + "; " + await httpFailureDetails(response));
              }
              await page.waitForURL(url => ["/en/", "/hi/", "/bn/"].includes(url.pathname), { timeout: 10000 });
              await page.waitForFunction(() => {
                const heading = document.querySelector(".home-hero h1");
                return heading && heading.textContent.trim().length > 0;
              }, null, { timeout: 10000 });
              const heading = (await page.locator(".home-hero h1").innerText()).trim();
              if (!heading || /Still loading|Continue in English/i.test(await page.locator("body").innerText())) {
                throw new Error("homepage remained on the language-loading shell");
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

    // Isolated guest basket checks mutate localStorage only, never the backend.
    await check("desktop/en/guest RFQ add, quantity, remove and PDP controls", async () => {
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
      const page = await context.newPage();
      await attachPageErrors(page);
      try {
        await goto(page, "/en/products");
        await page.evaluate(() => localStorage.removeItem("souviks_rfq_guest"));
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(400);
        assertNoPageErrors(page);

        const addButton = page.locator(".add-to-cart").first();
        if (!(await addButton.count())) throw new Error("product card Add to RFQ button is missing");
        await addButton.click();
        await page.waitForFunction(
          () => Number(document.querySelector(".rfq-badge")?.textContent?.trim()) === 1,
          null,
          { timeout: 8000 }
        );
        const basket = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_rfq_guest");
          return raw ? JSON.parse(raw) : [];
        });
        if (!Array.isArray(basket) || basket.length !== 1) {
          throw new Error("guest basket does not contain exactly one item after add");
        }

        await goto(page, "/en/request-quote");
        const rows = page.locator("#rfq-items tr");
        if ((await rows.count()) !== 1) throw new Error("RFQ basket row count is not one");
        const row = rows.first();
        const plus = row.locator(".rfq-qty .qty-plus");
        const remove = row.locator(".remove-rfq");
        if (!(await plus.count()) || !(await remove.count())) {
          throw new Error("RFQ quantity or remove controls are missing");
        }
        await plus.click();
        await plus.click();
        await page.waitForTimeout(300);
        const qtyText = await row.locator(".rfq-qty").innerText();
        const qty = Number((qtyText.match(/\d+/g) || [])[0] || 0);
        const storedQty = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_rfq_guest");
          return Number((raw ? JSON.parse(raw) : [])[0]?.qty || 0);
        });
        if (qty !== 3 || storedQty !== 3) {
          throw new Error("RFQ quantity mismatch: UI=" + qty + "; stored=" + storedQty);
        }
        await remove.click();
        await page.waitForTimeout(300);
        const afterRemove = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_rfq_guest");
          return raw ? JSON.parse(raw) : [];
        });
        if (afterRemove.length !== 0) throw new Error("RFQ removal did not clear the guest basket");

        await goto(page, "/en/products/10-x-15-nut");
        const heading = (await page.locator(".pdp-title").innerText()).trim();
        if (!heading.toLowerCase().includes("10 x 1.5 nut")) {
          throw new Error("unexpected product detail heading: " + heading);
        }
        const image = page.locator("#pdpMainImage");
        if (!(await image.count())) throw new Error("product detail main image is missing");
        await page.waitForFunction(() => {
          const img = document.querySelector("#pdpMainImage");
          return img && img.complete && img.naturalWidth > 0;
        }, null, { timeout: 10000 });
        const pdpAdd = page.locator(".pdp-rfq-btn");
        if (!(await pdpAdd.count())) throw new Error("product detail Add to RFQ button is missing");
        await pdpAdd.click();
        await page.waitForFunction(() => {
          const raw = localStorage.getItem("souviks_rfq_guest");
          return raw && JSON.parse(raw).length > 0;
        }, null, { timeout: 8000 });
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
