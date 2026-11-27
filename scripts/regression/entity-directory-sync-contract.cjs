#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const readText = relative => fs.readFileSync(path.join(root, relative), "utf8");
const active = rows => rows.filter(row => row && row.active !== false && row.id && row.slug);
const numberById = (html, id) => {
    const pattern = new RegExp(
        '<(?:span|div|strong)\\\\b(?=[^>]*\\\\bid=[\\\\x22\\\\x27]' + id +
        '[\\\\x22\\\\x27])[^>]*>\\\\s*([\\\\d,]+)\\\\s*</(?:span|div|strong)>',
        "i"
    );
    const match = html.match(pattern);
    assert.ok(match, "Missing numeric counter #" + id);
    return Number(match[1].replace(/,/g, ""));
};
const divBlock = (source, openIndex) => {
    const openingEnd = source.indexOf(">", openIndex);
    assert.ok(openingEnd >= 0, "Malformed div opening tag");
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = openingEnd + 1;
    let depth = 1;
    let match;
    while ((match = tags.exec(source))) {
        if (/^<\/div/i.test(match[0])) {
            depth -= 1;
            if (depth === 0) return source.slice(openIndex, tags.lastIndex);
        } else if (!/\/\s*>$/.test(match[0])) {
            depth += 1;
        }
    }
    throw new Error("Unclosed div in static page");
};
const heroValue = (html, icon) => {
    const openers = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bhero-stat\b[^"']*["'][^>]*>/gi)];
    for (const match of openers) {
        const block = divBlock(html, match.index);
        const iconPattern = new RegExp(
            '<img\\\\b(?=[^>]*\\\\bsrc=[\\\\x22\\\\x27][^\\\\x22\\\\x27]*/' + icon +
            '(?:[?#][^\\\\x22\\\\x27]*)?[\\\\x22\\\\x27])',
            "i"
        );
        if (!iconPattern.test(block)) continue;
        const number = block.match(/<(?:span|div)\b[^>]*class=["'][^"']*\bstat-number\b[^"']*["'][^>]*>\s*([\d,]+)\s*<\/(?:span|div)>/i);
        assert.ok(number, "Hero stat " + icon + " has no numeric value");
        return Number(number[1].replace(/,/g, ""));
    }
    throw new Error("Missing hero stat " + icon);
};
const heroTrust = (html, icon) => {
    const openers = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bhome-trust-item\b[^"']*["'][^>]*>/gi)];
    for (const match of openers) {
        const block = divBlock(html, match.index);
        const iconPattern = new RegExp(
            '<img\\\\b(?=[^>]*\\\\bsrc=[\\\\x22\\\\x27][^\\\\x22\\\\x27]*/' + icon +
            '(?:[?#][^\\\\x22\\\\x27]*)?[\\\\x22\\\\x27])',
            "i"
        );
        if (!iconPattern.test(block)) continue;
        const number = block.match(/<strong\b[^>]*>\s*([\d,]+)\+\s*<\/strong>/i);
        assert.ok(number, "Homepage trust stat " + icon + " has no numeric value");
        return Number(number[1].replace(/,/g, ""));
    }
    throw new Error("Homepage missing trust stat " + icon);
};
const cardBlocks = (html, className, tagName) => {
    const expression = new RegExp(
        "<" + tagName + "\\\\b(?=[^>]*class=[\\\\x22\\\\x27][^\\\\x22\\\\x27]*\\\\b" +
        className + "\\\\b[^\\\\x22\\\\x27]*[\\\\x22\\\\x27])[^>]*>[\\\\s\\\\S]*?</" +
        tagName + ">",
        "gi"
    );
    return [...html.matchAll(expression)].map(match => match[0]);
};
const cards = (html, className, tagName, href) =>
    cardBlocks(html, className, tagName).find(card => card.includes(href));
const cardNumber = (card, className) => {
    assert.ok(card, "Missing directory card");
    const pattern = new RegExp(
        '<(?:span|div)\\\\b[^>]*class=[\\\\x22\\\\x27][^\\\\x22\\\\x27]*\\\\b' +
        className + '\\\\b[^\\\\x22\\\\x27]*[\\\\x22\\\\x27][^>]*>\\\\s*(?:<span\\\\b[^>]*class=[\\\\x22\\\\x27][^\\\\x22\\\\x27]*\\\\bcount-number\\\\b[^>]*>)?\\\\s*([\\\\d,]+)',
        "i"
    );
    const match = card.match(pattern);
    assert.ok(match, "Missing numeric count in " + className);
    return Number(match[1].replace(/,/g, ""));
};

const catalogue = readJson("assets/data/catalogue-index.json");
const brands = active(readJson("assets/data/brands.json"));
const categories = active(readJson("assets/data/categories.json"));
const vehicles = active(readJson("assets/data/vehicles.json"));
const products = catalogue.filter(row => row && row.id && row.active !== false);
const productCount = products.length;
const categoryCount = categories.length;
const productCategoryCount = new Set(products.map(row => String(row.category_id || "").trim()).filter(Boolean)).size;
const brandCount = brands.length;
const vehicleCount = vehicles.length;
const subcategoryCount = new Set(products.map(row => String(row.subcategory_id || "").trim()).filter(Boolean)).size;

assert.ok(productCount > 0 && brandCount > 0 && categoryCount > 0 && vehicleCount > 0,
    "Catalogue and entity masters must not be empty");

for (const language of ["en", "hi", "bn"]) {
    const brandHtml = readText(language + "/brands.html");
    assert.equal(numberById(brandHtml, "visibleBrands"), brandCount, language + " visible brand counter");
    assert.equal(numberById(brandHtml, "totalBrands"), brandCount, language + " total brand counter");
    assert.equal(heroValue(brandHtml, "brands.svg"), brandCount, language + " brand hero counter");
    assert.equal(heroValue(brandHtml, "products.svg"), productCount, language + " brand-page product counter");
    assert.equal(heroValue(brandHtml, "category.svg"), productCategoryCount, language + " brand-page categories with products");
    const brandCards = cardBlocks(brandHtml, "brand-card", "article");
    assert.equal(brandCards.length, brandCount, language + " brand card count");
    for (const brand of brands) {
        const card = cards(brandHtml, "brand-card", "article", "/" + language + "/brands/" + brand.slug);
        assert.ok(card, language + " brand listing omits " + brand.name);
        assert.equal(cardNumber(card, "brand-count"), Number(brand.product_count || (brand.products || []).length),
            language + " brand product count for " + brand.name);

        const detailPath = language + "/brands/" + brand.slug + ".html";
        const detailHtml = readText(detailPath);
        const expectedUrl = "https://www.souviks.co.in/" + language + "/brands/" + brand.slug;
        const escapedName = String(brand.name).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        assert.ok(detailHtml.includes("<h1>" + escapedName + "</h1>"),
            detailPath + " must render the canonical brand name");
        const linkTags = [...detailHtml.matchAll(/<link\\b[^>]*>/gi)].map(match => match[0]);
        assert.ok(linkTags.some(tag => /\\brel=["']canonical["']/i.test(tag) && tag.includes(expectedUrl)),
            detailPath + " canonical must match the brand slug");
        for (const code of ["en", "hi", "bn"]) {
            const alternateUrl = "https://www.souviks.co.in/" + code + "/brands/" + brand.slug;
            assert.ok(linkTags.some(tag => new RegExp('\\\\bhreflang=["']' + code + '["']', "i").test(tag) && tag.includes(alternateUrl)),
                detailPath + " missing correct hreflang=" + code);
        }
        const defaultUrl = "https://www.souviks.co.in/en/brands/" + brand.slug;
        assert.ok(linkTags.some(tag => /\\bhreflang=["']x-default["']/i.test(tag) && tag.includes(defaultUrl)),
            detailPath + " missing correct x-default hreflang");

        const schemaMatch = detailHtml.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
        assert.ok(schemaMatch, detailPath + " missing JSON-LD");
        const schema = JSON.parse(schemaMatch[1]);
        assert.equal(schema["@type"], "CollectionPage", detailPath + " JSON-LD type");
        assert.equal(schema.url, expectedUrl, detailPath + " JSON-LD canonical URL");
        assert.equal(schema.about?.name, brand.name, detailPath + " JSON-LD brand identity");
        assert.equal(Number(schema.mainEntity?.numberOfItems), Number(brand.product_count || (brand.products || []).length),
            detailPath + " JSON-LD active-product count");
        if (brand.logo) {
            const expectedLogo = brand.logo.startsWith("/") ? "https://www.souviks.co.in" + brand.logo : brand.logo;
            assert.equal(schema.about?.logo?.url, expectedLogo, detailPath + " JSON-LD brand logo");
        } else {
            assert.ok(!schema.about?.logo, detailPath + " must not inherit a logo from its page shell");
        }
    }

    const vehicleHtml = readText(language + "/vehicles.html");
    assert.equal(numberById(vehicleHtml, "visibleVehicles"), vehicleCount, language + " visible vehicle counter");
    assert.equal(heroValue(vehicleHtml, "vehicle.svg"), vehicleCount, language + " vehicle hero counter");
    assert.equal(heroValue(vehicleHtml, "products.svg"), productCount, language + " vehicle-page product counter");
    assert.equal(heroValue(vehicleHtml, "brands.svg"), brandCount, language + " vehicle-page brand counter");
    const vehicleCards = cardBlocks(vehicleHtml, "vehicle-card", "article");
    assert.equal(vehicleCards.length, vehicleCount + 1, language + " vehicle card count including Every Vehicle");
    const universal = vehicles.find(vehicle => vehicle.id === "universal");
    assert.ok(universal, language + " Universal vehicle entry");
    const everyVehicleCard = vehicleCards.find(card => card.includes("vehicle-card--every"));
    assert.ok(everyVehicleCard && everyVehicleCard.includes("/" + language + "/vehicles/" + universal.slug), language + " Every Vehicle card");
    assert.equal(cardNumber(everyVehicleCard, "vehicle-count"), Number(universal.product_count || (universal.products || []).length), language + " Every Vehicle product count");
    for (const vehicle of vehicles) {
        const vehicleName = vehicle.model || vehicle.name;
        const card = cards(vehicleHtml, "vehicle-card", "article", "/" + language + "/vehicles/" + vehicle.slug);
        assert.ok(card, language + " vehicle listing omits " + vehicleName);
        assert.equal(cardNumber(card, "vehicle-count"), Number(vehicle.product_count || (vehicle.products || []).length),
            language + " vehicle product count for " + vehicleName);
    }

    const productsHtml = readText(language + "/products.html");
    assert.equal(numberById(productsHtml, "totalProducts"), productCount, language + " totalProducts");
    assert.equal(numberById(productsHtml, "totalResults"), productCount, language + " totalResults");
    assert.equal(heroValue(productsHtml, "products.svg"), productCount, language + " products hero");
    assert.equal(heroValue(productsHtml, "brands.svg"), brandCount, language + " products-page brand hero");
    assert.equal(heroValue(productsHtml, "category.svg"), productCategoryCount, language + " products-page categories with products");
    assert.equal(heroValue(productsHtml, "vehicle.svg"), vehicleCount, language + " products-page vehicle hero");

    const categoriesHtml = readText(language + "/categories.html");
    assert.equal(heroValue(categoriesHtml, "category.svg"), categoryCount, language + " category hero");
    const categoryCards = cardBlocks(categoriesHtml, "category-card", "article");
    assert.equal(categoryCards.length, categoryCount, language + " category card count");
    assert.equal(numberById(categoriesHtml, "visibleCategories"), categoryCount, language + " visible category counter");
    for (const category of categories) {
        const card = cards(categoriesHtml, "category-card", "article", "/" + language + "/categories/" + category.slug);
        assert.ok(card, language + " category listing omits " + category.name);
        assert.equal(cardNumber(card, "category-count"), Number(category.product_count || (category.products || []).length),
            language + " category product count for " + category.name);
    }
    assert.equal(heroValue(categoriesHtml, "subcategories.svg"), subcategoryCount, language + " subcategory hero");
    assert.equal(heroValue(categoriesHtml, "products.svg"), productCount, language + " category-page product hero");

    const aboutHtml = readText(language + "/about.html");
    assert.equal(heroValue(aboutHtml, "products.svg"), productCount, language + " About product counter");
    assert.equal(heroValue(aboutHtml, "brands.svg"), brandCount, language + " About brand counter");
    assert.equal(heroValue(aboutHtml, "vehicle.svg"), vehicleCount, language + " About application counter");

    const homeHtml = readText(language + "/index.html");
    const homeCategoryCards = cardBlocks(homeHtml, "category-card", "article");
    for (const card of homeCategoryCards) {
        const href = card.match(new RegExp("/" + language + "/categories/([^\\\\x22\\\\x27/?#]+)"));
        assert.ok(href, language + " homepage category card link");
        const category = categories.find(item => item.slug === href[1]);
        assert.ok(category, language + " homepage category card master reference " + href[1]);
        assert.equal(cardNumber(card, "category-count"), Number(category.product_count || (category.products || []).length),
            language + " homepage category count for " + category.name);
    }
    assert.equal(heroTrust(homeHtml, "products.svg"), productCount, language + " homepage product trust counter");
    assert.equal(heroTrust(homeHtml, "brands.svg"), brandCount, language + " homepage brand trust counter");

    for (const page of [brandHtml, vehicleHtml, productsHtml, categoriesHtml]) {
        assert.ok(!page.includes("04 October 2026"),
            language + " directory page still has the obsolete 4 October 2026 update date");
    }
}

console.log("Static entity directory and counter contract passed", {
    active_products: productCount,
    active_brands: brandCount,
    active_categories: categoryCount,
    active_subcategories: subcategoryCount,
    active_vehicles: vehicleCount
});
