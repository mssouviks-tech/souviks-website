#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const siteCore = fs.readFileSync(path.join(ROOT, "assets/js/site-core.js"), "utf8");
const startMarker = '(()=>{"use strict";const GA_MEASUREMENT_ID=';
const start = siteCore.indexOf(startMarker);
const end = siteCore.indexOf("})(),(()=>", start);
assert.ok(start >= 0 && end > start, "shared GA4 runtime must exist as an isolated IIFE");

const analyticsRuntime = siteCore.slice(start, end + 4);
const pageUrl = new URL(
  "https://www.souviks.co.in/en/products?q=customer%40example.com&brand_id=bosch&utm_source=newsletter#results"
);
const referrer = "https://www.souviks.co.in/en/products?q=%2B919876543210&utm_medium=email";
const dispatched = [];
const documentListeners = {};
const windowListeners = {};
const windowStub = {
  dataLayer: [],
  location: pageUrl,
  addEventListener(name, handler) {
    windowListeners[name] = handler;
  },
  dispatchEvent(event) {
    dispatched.push(event);
    return true;
  }
};
const documentStub = {
  scripts: [],
  readyState: "loading",
  title: "Products | Souviks",
  referrer,
  head: { appendChild() {} },
  createElement() { return { async: false, src: "" }; },
  addEventListener(name, handler) {
    documentListeners[name] = handler;
  }
};
class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

vm.runInNewContext(analyticsRuntime, {
  window: windowStub,
  document: documentStub,
  URL,
  URLSearchParams,
  CustomEvent: TestCustomEvent,
  Date,
  Array,
  String,
  Number,
  encodeURIComponent
});

const searchText = "customer@example.com +91 9876543210";
windowStub.souviksAnalytics.trackSearch(searchText, 4, "product-catalogue");
windowStub.souviksAnalytics.trackEvent("catalogue_interaction", { interaction: "filter" });
windowStub.souviksAnalytics.trackLead("contact");

const calls = windowStub.dataLayer.map(args => Array.from(args));
const config = calls.find(args => args[0] === "config");
assert.ok(config, "GA4 config call must remain in place");
assert.equal(config[2].page_location, "https://www.souviks.co.in/en/products?brand_id=bosch&utm_source=newsletter");
assert.equal(config[2].page_referrer, "https://www.souviks.co.in/en/products?utm_medium=email");

const searchEvent = calls.find(args => args[0] === "event" && args[1] === "search");
assert.ok(searchEvent, "search event must still be sent");
assert.equal(searchEvent[2].results_count, 4);
assert.equal(searchEvent[2].search_source, "product-catalogue");
assert.equal(searchEvent[2].search_query_present, true);
assert.ok(!Object.prototype.hasOwnProperty.call(searchEvent[2], "search_term"));

const genericEvent = calls.find(args => args[0] === "event" && args[1] === "catalogue_interaction");
const leadEvent = calls.find(args => args[0] === "event" && args[1] === "generate_lead");
assert.equal(genericEvent[2].page_location, config[2].page_location);
assert.equal(leadEvent[2].page_location, config[2].page_location);

const localSearchEvent = dispatched.find(event => event.type === "souviks:search");
assert.ok(localSearchEvent, "internal search event should remain available");
assert.equal(localSearchEvent.detail.resultCount, 4);
assert.equal(localSearchEvent.detail.source, "product-catalogue");
assert.equal(localSearchEvent.detail.hasQuery, true);
assert.ok(!Object.prototype.hasOwnProperty.call(localSearchEvent.detail, "query"));

const transmitted = JSON.stringify({ calls, events: dispatched.map(event => ({ type: event.type, detail: event.detail })) });
assert.doesNotMatch(transmitted, /customer@example\.com|9876543210|%40|\?q=/i,
  "customer search text must not appear in any GA4 payload or analytics event detail");

console.log("[Analytics privacy contract] PASS — GA4 page location/referrer strip search terms; search events retain only anonymous metrics.");
