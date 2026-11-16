#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const root = process.cwd();
const targets = [
  path.join(root, "assets", "js", "site-core.js"),
  path.join(root, "assets", "js", "catalogue-core.js"),
  // Lighthouse-flagged first-party page/runtime modules. Keep classic-script
  // APIs stable by minifying syntax and whitespace without renaming symbols.
  path.join(root, "assets", "js", "account", "rfq.js"),
  path.join(root, "assets", "js", "cart", "cart.js"),
  path.join(root, "assets", "js", "bundles", "index.js"),
];

// Page-specific modules remain separate classic scripts so their global APIs
// and dependency ordering stay stable. All targets receive safe syntax and
// whitespace minification; identifiers are deliberately not renamed.
for (const file of targets.sort()) {
  const source = await readFile(file, "utf8");
  const result = await transform(source, {
    loader: "js",
    target: "es2022",
    minifySyntax: true,
    minifyWhitespace: true,
    minifyIdentifiers: false,
    legalComments: "inline",
    charset: "utf8",
  });
  const output = result.code.endsWith("\n") ? result.code : `${result.code}\n`;

  await writeFile(file, output, "utf8");
  console.log(
    `Minified ${path.relative(root, file)}: ${Buffer.byteLength(source)} -> ${Buffer.byteLength(result.code)} bytes`,
  );
}
