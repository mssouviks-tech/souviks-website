#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const root = process.cwd();
const targets = [
  path.join(root, "assets", "js", "site-core.js"),
  path.join(root, "assets", "js", "catalogue-core.js"),
];

// Page bundles remain marker-driven source until their modules are split
// into explicit source files. Minifying them here would erase those markers
// and make future deterministic refactors unsafe.


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

  await writeFile(file, result.code.endsWith("\n") ? result.code : result.code + "\n", "utf8");
  console.log(
    `Minified ${path.relative(root, file)}: ${Buffer.byteLength(source)} -> ${Buffer.byteLength(result.code)} bytes`
  );
}
