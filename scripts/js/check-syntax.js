#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve("assets/js");

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collect(full)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      result.push(full);
    }
  }
  return result.sort();
}

const files = await collect(root);
const failures = [];

for (const file of files) {
  try {
    await execFileAsync(process.execPath, ["--check", file], {
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    failures.push({ file, stderr: error.stderr || error.message });
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`JS syntax error: ${failure.file}`);
    if (failure.stderr) console.error(failure.stderr.trim());
  }
  process.exit(1);
}

console.log(`JS syntax OK: ${files.length} files checked.`);
