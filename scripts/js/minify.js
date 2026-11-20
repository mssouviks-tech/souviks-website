#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const root = process.cwd();

// These established shared-runtime outputs retain their existing pipeline.
// Phase 1 page modules use separate, checked-in readable source files.
const inPlaceTargets = [
  path.join(root, "assets", "js", "site-core.js"),
  path.join(root, "assets", "js", "catalogue-core.js"),
];

const sourceTargets = [
  {
    source: path.join(root, "assets", "js", "source", "account", "rfq.js"),
    output: path.join(root, "assets", "js", "account", "rfq.js"),
  },
  {
    source: path.join(root, "assets", "js", "source", "cart", "cart.js"),
    output: path.join(root, "assets", "js", "cart", "cart.js"),
  },
  {
    source: path.join(root, "assets", "js", "source", "bundles", "index.js"),
    output: path.join(root, "assets", "js", "bundles", "index.js"),
  },
  {
    source: path.join(root, "assets", "js", "source", "supabase-loader.js"),
    output: path.join(root, "assets", "js", "supabase-loader.js"),
  },
];

async function minify(sourceFile, outputFile) {
  const source = await readFile(sourceFile, "utf8");
  const result = await transform(source, {
    loader: "js",
    target: "es2022",
    minifySyntax: true,
    minifyWhitespace: true,
    minifyIdentifiers: false,
    legalComments: "inline",
    charset: "utf8",
  });
  const output = result.code.endsWith("\n") ? result.code : result.code + "\n";
  await writeFile(outputFile, output, "utf8");
  console.log(
    "Minified " +
      path.relative(root, sourceFile) +
      " -> " +
      path.relative(root, outputFile) +
      ": " +
      Buffer.byteLength(source) +
      " -> " +
      Buffer.byteLength(result.code) +
      " bytes",
  );
}

for (const file of inPlaceTargets.sort()) {
  await minify(file, file);
}

for (const target of sourceTargets.sort((a, b) => a.output.localeCompare(b.output))) {
  await minify(target.source, target.output);
}
