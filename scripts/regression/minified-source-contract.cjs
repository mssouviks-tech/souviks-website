#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const mappings = [
  ["assets/js/source/account/rfq.js", "assets/js/account/rfq.js"],
  ["assets/js/source/cart/cart.js", "assets/js/cart/cart.js"],
  ["assets/js/source/bundles/index.js", "assets/js/bundles/index.js"],
  ["assets/js/source/supabase-loader.js", "assets/js/supabase-loader.js"],
];

const minifier = fs.readFileSync(path.join(ROOT, "scripts/js/minify.js"), "utf8");
const refactor = fs.readFileSync(path.join(ROOT, "scripts/js/refactor.py"), "utf8");

for (const [sourcePath, runtimePath] of mappings) {
  const source = fs.readFileSync(path.join(ROOT, sourcePath), "utf8");
  const runtime = fs.readFileSync(path.join(ROOT, runtimePath), "utf8");
  assert.ok(source.includes("\n"), sourcePath + " must remain human-readable.");
  assert.ok(source.length > runtime.length * 1.2, runtimePath + " must be materially smaller than its readable source.");
  assert.ok(
    minifier.includes(sourcePath) && minifier.includes(runtimePath),
    "Minifier must map " + sourcePath + " to " + runtimePath,
  );
  assert.ok(!runtimePath.includes(".source."), "Runtime URL must remain stable.");
}

assert.ok(
  refactor.includes("INDEX_SOURCE_PATH") && refactor.includes("SOURCE_BUNDLES"),
  "The catalogue refactor must regenerate the readable index bundle source, not overwrite the minified runtime as its input.",
);

function walkHtml(directory) {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}
const htmlFiles = [
  ...fs.readdirSync(ROOT).filter(name => name.endsWith(".html")).map(name => path.join(ROOT, name)),
  ...walkHtml(path.join(ROOT, "en")),
  ...walkHtml(path.join(ROOT, "hi")),
  ...walkHtml(path.join(ROOT, "bn")),
];
for (const htmlPath of htmlFiles) {
  const html = fs.readFileSync(htmlPath, "utf8");
  assert.doesNotMatch(html, /\/assets\/js\/source\//, htmlPath + " must not load readable source files as browser scripts.");
}

for (const homepage of ["index.html", "en/index.html", "hi/index.html", "bn/index.html"]) {
  const html = fs.readFileSync(path.join(ROOT, homepage), "utf8");
  assert.doesNotMatch(html, /\/assets\/js\/account\/rfq\.js(?:\?v=|["'])/, homepage + " must not load the RFQ engine globally.");
}

console.log("[Minified source contract] PASS — readable Phase 1 sources are retained, runtime outputs are generated separately, public script URLs are stable, and the homepage does not load the RFQ engine.");
