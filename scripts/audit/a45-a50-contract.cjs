#!/usr/bin/env node
/**
 * A45-A50 release contract.
 *
 * These are deterministic repository checks, not a substitute for source-price
 * reconciliation, mailbox delivery confirmation, legal advice, stock checks,
 * or a manual WCAG audit.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.resolve(file), "utf8");
const json = file => JSON.parse(read(file));
const fail = (message) => {
    throw new Error(message);
};

const products = json("assets/data/products.json");
const brands = json("assets/data/brands.json");
assert.ok(Array.isArray(products), "products.json must be an array");
assert.ok(Array.isArray(brands), "brands.json must be an array");

const activeProducts = products.filter(product => product.active !== false);
const activeBrands = brands.filter(brand => brand.active !== false);
const brandIds = new Set(activeBrands.map(brand => String(brand.id || "").trim()).filter(Boolean));
const productBrandIds = new Set(activeProducts.map(product => String(product.brand_id || "").trim()).filter(Boolean));

assert.ok(activeProducts.length > 0, "Active catalogue must not be empty");
assert.equal(productBrandIds.size, activeBrands.length,
    "Distinct active product brand IDs must match the active brand directory count");

const missingBrandRefs = activeProducts.filter(product => !brandIds.has(String(product.brand_id || "").trim()));
assert.equal(missingBrandRefs.length, 0,
    "Every active product must reference a brand in brands.json: " +
    missingBrandRefs.slice(0, 10).map(product => product.id).join(", "));

let priced = 0;
let unpriced = 0;
const pricingErrors = [];
for (const product of activeProducts) {
    const mrp = Number(product.mrp);
    const selling = Number(product.selling_price);
    const hasMrp = product.mrp !== null && product.mrp !== "" && Number.isFinite(mrp) && mrp > 0;
    const hasSelling = product.selling_price !== null && product.selling_price !== "" &&
        Number.isFinite(selling) && selling > 0;

    if (!hasMrp || !hasSelling) {
        unpriced += 1;
        continue;
    }

    priced += 1;
    if (selling > mrp + 0.01) {
        pricingErrors.push(`${product.id}: selling price ${selling} exceeds MRP ${mrp}`);
        continue;
    }

    if (product.discount_percent !== null && product.discount_percent !== undefined && product.discount_percent !== "") {
        const expected = Math.round(((mrp - selling) / mrp) * 100);
        if (Math.abs(Number(product.discount_percent) - expected) > 1) {
            pricingErrors.push(`${product.id}: discount ${product.discount_percent}% does not match price arithmetic (${expected}%)`);
        }
    }
}
assert.equal(pricingErrors.length, 0, "Catalogue pricing arithmetic errors:\n" + pricingErrors.slice(0, 20).join("\n"));

const languages = ["en", "hi", "bn"];
for (const language of languages) {
    const about = read(`${language}/about.html`);
    const brandPage = read(`${language}/brands.html`);
    const translations = json(`assets/data/languages/${language}.json`);

    const metricRegex = new RegExp('<div class="stat-number">\\s*([^<\\s]+)\\s*</div>\\s*<div class="stat-label">\\s*([^<]+)\\s*</div>', "g");
    const metricMatches = [...about.matchAll(metricRegex)];
    assert.ok(metricMatches.length >= 3, `${language}/about.html must publish catalogue metrics`);
    assert.equal(Number(metricMatches[1][1]), activeProducts.length,
        `${language}/about.html product count must match active products`);
    assert.equal(Number(metricMatches[2][1]), activeBrands.length,
        `${language}/about.html brand count must match the brand directory`);

    for (const id of ["visibleBrands", "totalBrands"]) {
        const match = brandPage.match(new RegExp(`<span id="${id}">\\s*(\\d+)\\s*<\\/span>`));
        assert.ok(match, `${language}/brands.html must expose ${id}`);
        assert.equal(Number(match[1]), activeBrands.length,
            `${language}/brands.html ${id} must match brands.json`);
    }

    const story = String(translations.about?.story_p3 || "");
    assert.ok(story.length > 0, `${language} About story copy must exist`);
    assert.ok(!/thousands of related products|हजारों संबंधित उत्पाद|হাজার হাজার সংশ্লিষ্ট পণ্য/i.test(story),
        `${language} About copy must not overstate catalogue size`);
    assert.ok(/1,000|১,০০০/.test(story),
        `${language} About copy should describe the verified catalogue as 1,000+ listings`);
}

for (const language of languages) {
    for (const page of ["terms.html", "refund.html", "privacy-policy.html"]) {
        const html = read(`${language}/${page}`);
        assert.ok(html.length > 0, `${language}/${page} must exist`);
        assert.ok(/2026/.test(html), `${language}/${page} must retain the 2026 effective date`);
    }
}

for (const file of ["assets/js/bundles/contact.js", "assets/js/bundles/request-part.js"]) {
    const js = read(file);
    assert.ok(js.includes('aria-live'), `${file} must announce form status changes`);
    assert.ok(js.includes("focusableSelector") && js.includes('"Tab"') && js.includes("focusable[focusable.length - 1]"),
        `${file} success dialog must keep keyboard focus within the dialog`);
    assert.ok(js.includes('event.key === "Escape"'), `${file} success dialog must support Escape`);
}

for (const file of ["assets/css/bundles/brands.css", "assets/css/bundles/vehicles.css"]) {
    const css = read(file);
    assert.ok(css.includes(".search-suggestion:focus-visible") && /outline:\s*2px solid/.test(css),
        `${file} search suggestions must have a visible keyboard focus indicator`);
    assert.ok(css.includes(".catalogue-search .search-input:focus-visible"),
        `${file} catalogue search input must have a visible keyboard focus indicator`);
}

console.log(
    `A45-A50 contract passed: ${activeProducts.length} active products, ${activeBrands.length} active brands, ${priced} priced products, ${unpriced} requiring price/availability confirmation.\n` +
    "Note: this validates repository consistency only; it does not establish supplier-price accuracy, email delivery, stock-on-hand, legal compliance, or WCAG conformance."
);
