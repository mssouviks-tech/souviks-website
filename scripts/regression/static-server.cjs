#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0] || "/");
  const relative = clean.replace(/^\/+/, "");
  const candidate = path.resolve(ROOT, relative);
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) return null;
  return candidate;
}

function resolvePage(urlPath) {
  const clean = urlPath.split("?")[0] || "/";

  if (clean === "/") {
    return { filePath: path.join(ROOT, "index.html"), status: 200 };
  }

  const match = clean.match(/^\/(en|hi|bn)(?:\/|$)/);
  const language = match ? match[1] : "en";

  if (clean === "/" + language || clean === "/" + language + "/") {
    return { filePath: path.join(ROOT, language, "index.html"), status: 200 };
  }

  if (clean.endsWith(".html")) {
    const filePath = safePath(clean);
    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return { filePath, status: 200 };
    }
    return { filePath: path.join(ROOT, language, "404.html"), status: 404 };
  }

  const direct = safePath(clean);
  if (direct && fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return { filePath: direct, status: 200 };
  }

  const withExt = safePath(clean + ".html");
  if (withExt && fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
    return { filePath: withExt, status: 200 };
  }

  return { filePath: path.join(ROOT, language, "404.html"), status: 404 };
}

const server = http.createServer((req, res) => {
  try {
    const parsed = new URL(req.url || "/", "http://127.0.0.1");
    const requested = parsed.pathname;

    const resolved = resolvePage(requested);
    const filePath = resolved.filePath;
    const status = resolved.status;

    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();

    res.writeHead(status, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Static regression server listening on http://127.0.0.1:" + PORT);
});
