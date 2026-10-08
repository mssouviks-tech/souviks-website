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

async function contextFor(view) {
  return browser.newContext({
    viewport: { width: VIEWS[view].width, height: VIEWS[view].height },
    isMobile: VIEWS[view].isMobile,
    deviceScaleFactor: VIEWS[view].isMobile ? 2 : 1,
    locale: "en-IN",
    colorScheme: "light",
    ignoreHTTPSErrors: false,
  });
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
          const main = page.locator("main, [role="main"]").first();
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
      const expectedCanonical = "https://www.souviks.co.in/";
      if (canonical !== expectedCanonical) throw new Error(`canonical ${canonical}`);
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

  // 404 matrix
  for (const view of Object.keys(VIEWS)) {
    for (const lang of LANGS) {
      const context = await contextFor(view);
      const page = await context.newPage();
      page.__view = view;
      await check(`${view}/${lang}/404 page`, async () => {
        const response = await goto(page, BASE + langPath(lang, "this-route-does-not-exist-regression-34"));
        const status = response?.status();
        const text = await page.locator("body").innerText();
        if (status !== 404 && !/404|not found|page.*found/i.test(text)) {
          throw new Error(`expected 404, got HTTP ${status}`);
        }
        await assertNoHorizontalOverflow(page);
        return `HTTP ${status}`;
      });
      await context.close();
    }
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
        const itemInputs = page.locator("#rfq-items .rfq-qty input[type=number]");
        if (!(await itemInputs.count())) throw new Error("RFQ quantity input missing");
      });

      await check(`${view}/${lang}/RFQ quantity changes`, async () => {
        const input = page.locator("#rfq-items .rfq-qty input[type=number]").first();
        await input.fill("3");
        await input.press("Tab");
        await page.waitForTimeout(300);
        const value = await input.inputValue();
        if (value !== "3") throw new Error(`quantity is ${value}`);
        const stored = await page.evaluate(() => {
          const raw = localStorage.getItem("souviks_rfq_guest");
          const items = raw ? JSON.parse(raw) : [];
          return Number(items?.[0]?.qty || 0);
        });
        if (stored !== 3) throw new Error(`localStorage quantity is ${stored}`);
        return "quantity=3";
      });

      await check(`${view}/${lang}/RFQ removal`, async () => {
        const row = page.locator("#rfq-items tr").first();
        const remove = row.locator('button[aria-label*="Remove"], button').last();
        if (!(await remove.count())) throw new Error("RFQ remove control missing");
        await remove.click();
        await page.waitForTimeout(300);
        const rows = page.locator("#rfq-items tr");
        const text = await page.locator("#rfq-items").innerText();
        if ((await rows.count()) !== 1 || !/No items|empty|add/i.test(text)) {
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
        await page.route("**/api.emailjs.com/**", route =>
          route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
        );
        await page.locator("#requestPartForm button[type=submit]").click();
        const status = page.locator("#requestPartFormStatus");
        await status.waitFor({ state: "visible", timeout: 5000 });
        const statusText = await status.innerText();
        if (!/success|submitted|received|thank/i.test(statusText)) {
          throw new Error(`request-part status: ${statusText || "missing"}`);
        }
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
        const inputs = form.locator("input[required]");
        if (await inputs.count() >= 1) await inputs.nth(0).fill("Regression Test");
        if (await inputs.count() >= 2) await inputs.nth(1).fill("9000000000");
        await form.locator("button[type=submit]").click();
        const status = page.locator("#contactFormStatus");
        await status.waitFor({ state: "visible", timeout: 5000 });
        const statusText = await status.innerText();
        if (!/success|submitted|received|thank/i.test(statusText)) {
          throw new Error(`contact status: ${statusText || "missing"}`);
        }
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
          await goto(page, BASE + langPath(lang, `account?view=${viewName}`));
          const matching = page.locator(`[data-account-view="${viewName}"]`);
          if (!(await matching.count())) throw new Error("account view marker missing");
          const text = await page.locator("main").innerText();
          if (!text.trim()) throw new Error("account view empty");
          return titleText;
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
