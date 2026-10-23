#!/usr/bin/env python3
"""Production HTTP smoke test for Souviks after a successful Cloudflare Pages deployment."""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "mssouviks-tech/souviks-website")
BASE = os.environ.get("PRODUCTION_BASE_URL", "https://www.souviks.co.in").rstrip("/")
API = "https://api.github.com"
TIMEOUT_SECONDS = 25
DEPLOYMENT_WAIT_SECONDS = 20 * 60
REDIRECTS = {301, 302, 303, 307, 308}

REQUIRED_HEADERS = {
    "strict-transport-security": "hsts",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "x-frame-options": "SAMEORIGIN",
    "content-security-policy": "frame-ancestors 'self'",
}

PAGES = {
    "/": "https://www.souviks.co.in/",
    "/en/": "https://www.souviks.co.in/",
    "/hi/": "https://www.souviks.co.in/hi/",
    "/bn/": "https://www.souviks.co.in/bn/",
    "/en/products": "https://www.souviks.co.in/en/products",
    "/hi/products": "https://www.souviks.co.in/hi/products",
    "/bn/products": "https://www.souviks.co.in/bn/products",
    "/en/brands": "https://www.souviks.co.in/en/brands",
    "/hi/brands": "https://www.souviks.co.in/hi/brands",
    "/bn/brands": "https://www.souviks.co.in/bn/brands",
    "/en/categories": "https://www.souviks.co.in/en/categories",
    "/en/vehicles": "https://www.souviks.co.in/en/vehicles",
    "/en/about": "https://www.souviks.co.in/en/about",
    "/en/business-buyers": "https://www.souviks.co.in/en/business-buyers",
    "/hi/business-buyers": "https://www.souviks.co.in/hi/business-buyers",
    "/bn/business-buyers": "https://www.souviks.co.in/bn/business-buyers",
    "/en/contact": "https://www.souviks.co.in/en/contact",
    "/en/request-part": "https://www.souviks.co.in/en/request-part",
    "/hi/request-part": "https://www.souviks.co.in/hi/request-part",
    "/bn/request-part": "https://www.souviks.co.in/bn/request-part",
    "/en/products/10-x-15-nut": "https://www.souviks.co.in/en/products/10-x-15-nut",
    "/en/brands/abc": "https://www.souviks.co.in/en/brands/abc",
    "/en/terms": "https://www.souviks.co.in/en/terms",
    "/en/privacy-policy": "https://www.souviks.co.in/en/privacy-policy",
    "/en/refund": "https://www.souviks.co.in/en/refund",
}

SITEMAPS = (
    "/sitemaps/pages.xml",
    "/sitemaps/products.xml",
    "/sitemaps/brands.xml",
    "/sitemaps/categories.xml",
    "/sitemaps/vehicles.xml",
)


class Result:
    def __init__(self, status: int, headers, body: bytes, url: str):
        self.status = status
        self.headers = {str(k).lower(): str(v).strip() for k, v in headers.items()}
        self.body = body
        self.url = url
        self.text = body.decode("utf-8", errors="replace")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch(url: str) -> Result:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xml,text/plain,*/*",
            "Cache-Control": "no-cache",
        },
    )
    opener = urllib.request.build_opener(NoRedirect())
    try:
        with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
            return Result(response.status, response.headers, response.read(), response.geturl())
    except urllib.error.HTTPError as response:
        return Result(response.code, response.headers, response.read(), url)


def github_get(path: str):
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        raise RuntimeError("GITHUB_TOKEN is required to verify the deployed main revision.")
    request = urllib.request.Request(
        API + path,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Souviks-Production-Smoke/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_for_latest_main_deployment() -> str:
    """Wait until Cloudflare Pages has a successful check for the current main SHA."""
    deadline = time.monotonic() + DEPLOYMENT_WAIT_SECONDS
    last_note = None
    while time.monotonic() < deadline:
        commit = github_get(f"/repos/{REPOSITORY}/commits/main")
        sha = commit["sha"]
        checks_doc = github_get(f"/repos/{REPOSITORY}/commits/{sha}/check-runs?per_page=100")
        checks = [
            check for check in checks_doc.get("check_runs", [])
            if str(check.get("name", "")).strip().casefold() == "cloudflare pages"
        ]
        checks.sort(key=lambda check: str(check.get("started_at") or check.get("created_at") or ""))

        if checks:
            latest = checks[-1]
            status = latest.get("status")
            conclusion = latest.get("conclusion")
            note = (sha, status, conclusion)
            if note != last_note:
                print(
                    f"[DEPLOY] main={sha} Cloudflare Pages status={status} "
                    f"conclusion={conclusion or 'pending'}"
                )
                last_note = note
            if status == "completed":
                if conclusion != "success":
                    raise RuntimeError(
                        f"Cloudflare Pages check failed for main {sha}: {conclusion}"
                    )
                # Do not claim the branch revision is stable if main moved during the check.
                latest_sha = github_get(f"/repos/{REPOSITORY}/commits/main")["sha"]
                if latest_sha == sha:
                    return sha
        else:
            note = (sha, "no-check", None)
            if note != last_note:
                print(f"[DEPLOY] waiting for Cloudflare Pages check on main={sha}")
                last_note = note
        time.sleep(10)

    raise TimeoutError(
        "Cloudflare Pages did not report a successful deployment for the latest main revision "
        f"within {DEPLOYMENT_WAIT_SECONDS // 60} minutes."
    )


def validate_headers(result: Result, label: str, errors: list[str]) -> None:
    headers = result.headers
    missing = []
    for name, expected in REQUIRED_HEADERS.items():
        actual = headers.get(name, "")
        if expected == "hsts":
            normalized = actual.casefold().replace(" ", "")
            valid = (
                "max-age=31536000" in normalized
                and "includesubdomains" in normalized
                and "preload" in normalized
            )
        elif name == "content-security-policy":
            valid = "frame-ancestors 'self'" in actual.casefold()
        elif name == "permissions-policy":
            normalized = actual.casefold().replace(" ", "")
            valid = all(directive + "=()" in normalized for directive in ("camera", "microphone", "geolocation"))
        else:
            valid = actual.casefold() == expected.casefold()
        if not valid:
            shown = actual if actual else "MISSING"
            missing.append(f"{name}={shown!r}")
    if missing:
        errors.append(f"{label}: security response header contract failed: " + "; ".join(missing))


class CanonicalParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonical = None

    def handle_starttag(self, tag, attrs):
        if tag.casefold() != "link":
            return
        values = {key.casefold(): value for key, value in attrs if key}
        rel = set((values.get("rel") or "").casefold().split())
        if "canonical" in rel and values.get("href"):
            self.canonical = values["href"]


def canonical_of(html: str) -> str | None:
    parser = CanonicalParser()
    parser.feed(html)
    return parser.canonical


def read_xml(result: Result, label: str, errors: list[str]):
    try:
        return ET.fromstring(result.body)
    except ET.ParseError as exc:
        errors.append(f"{label}: malformed XML: {exc}")
        return None


def locs(root) -> list[str]:
    if root is None:
        return []
    return [
        (element.text or "").strip()
        for element in root.iter()
        if element.tag.rsplit("}", 1)[-1] == "loc" and (element.text or "").strip()
    ]


def run_smoke() -> int:
    errors: list[str] = []
    try:
        main_sha = wait_for_latest_main_deployment()
        print(f"[REVISION] Cloudflare Pages reports success for main {main_sha}")
    except Exception as exc:
        print(f"[FAIL] deployment revision: {exc}")
        return 1

    # Public HTML routes: exact 200 status, canonical contract, and required headers.
    route_results: dict[str, Result] = {}
    for path, expected_canonical in PAGES.items():
        label = f"GET {path}"
        try:
            result = fetch(BASE + path)
            if result.status != 200:
                errors.append(f"{label}: expected HTTP 200, got {result.status}")
                print(f"[FAIL] {label}: HTTP {result.status}")
                continue
            validate_headers(result, label, errors)
            actual = canonical_of(result.text)
            if actual != expected_canonical:
                errors.append(f"{label}: canonical {actual!r} != expected {expected_canonical!r}")
            if not result.text.strip():
                errors.append(f"{label}: empty response body")
            route_results[path] = result
            if path in ("/en/products/504635-all-fleet-tc-genuine-15w40-43-ltr", "/hi/products/504635-all-fleet-tc-genuine-15w40-43-ltr", "/bn/products/504635-all-fleet-tc-genuine-15w40-43-ltr"):
                if "Lubricants" not in result.text or "Engine Oil" not in result.text:
                    errors.append(f"{label}: Valvoline 504635 has incorrect category/subcategory labels")
                breadcrumb = re.search(
                    r'<nav\b(?=[^>]*\bclass=["\'][^"\']*\bbreadcrumb\b[^"\']*["\'])[^>]*>(.*?)</nav>',
                    result.text,
                    flags=re.I | re.S,
                )
                crumb_html = breadcrumb.group(1) if breadcrumb else ""
                if not re.search(
                    r'<a\b[^>]*href=["\'][^"\']*/categories/lubricants["\'][^>]*>\s*Lubricants\s*</a>',
                    crumb_html,
                    flags=re.I | re.S,
                ):
                    errors.append(f"{label}: Valvoline 504635 category breadcrumb is not Lubricants")
                related = re.search(
                    r'<section\b(?=[^>]*\bid=["\']related-section["\'])[\s\S]*?</section>',
                    result.text,
                    flags=re.I,
                )
                if related and re.search(r"Cross Joint|Suspension\s*&(?:amp;)?\s*Steering", related.group(0), re.I):
                    errors.append(f"{label}: Valvoline 504635 related products still contain suspension items")
            if path == "/":
                if not re.search(r"<body\b[^>]*class=[\"'][^\"']*page-home", result.text, flags=re.I):
                    errors.append("GET /: response is missing full homepage body class")
                if "SOUVIKS ROOT HOMEPAGE LANGUAGE ROUTING" not in result.text:
                    errors.append("GET /: response lacks root language-routing marker")
                body = re.search(r"<body\b[^>]*>(.*?)</body\s*>", result.text, flags=re.I | re.S)
                body_text = re.sub(r"<script\b.*?</script\s*>|<style\b.*?</style\s*>", " ", body.group(1), flags=re.I | re.S) if body else ""
                visible = re.sub(r"<[^>]+>", " ", body_text)
                visible = re.sub(r"\s+", " ", visible).strip()
                if len(visible) < 500:
                    errors.append(f"GET /: only {len(visible)} visible body-text characters ({len(visible)} minimum required)")
            print(f"[{'PASS' if actual == expected_canonical else 'FAIL'}] {label}: HTTP 200; canonical={actual!r}")
        except Exception as exc:
            errors.append(f"{label}: request failed: {exc}")
            print(f"[FAIL] {label}: {exc}")

    # Core text endpoints and XML sitemap contract.
    for path in ("/robots.txt", "/sitemap.xml", *SITEMAPS):
        label = f"GET {path}"
        try:
            result = fetch(BASE + path)
            if result.status != 200:
                errors.append(f"{label}: expected HTTP 200, got {result.status}")
                print(f"[FAIL] {label}: HTTP {result.status}")
                continue
            validate_headers(result, label, errors)
            if path.endswith(".xml"):
                root = read_xml(result, label, errors)
                if root is not None and path == "/sitemap.xml":
                    if root.tag.rsplit("}", 1)[-1] != "sitemapindex":
                        errors.append("GET /sitemap.xml: root element is not sitemapindex")
                    discovered = {urllib.parse.urlsplit(loc).path for loc in locs(root)}
                    required = {"/" + entry.lstrip("/") for entry in SITEMAPS}
                    missing = sorted(required - discovered)
                    if missing:
                        errors.append("GET /sitemap.xml: missing sitemap references: " + ", ".join(missing))
                elif root is not None and path in SITEMAPS:
                    if root.tag.rsplit("}", 1)[-1] != "urlset":
                        errors.append(f"{label}: root element is not urlset")
                    if not locs(root):
                        errors.append(f"{label}: sitemap contains no loc entries")
                    if path == "/sitemaps/pages.xml":
                        urls = set(locs(root))
                        required_urls = {
                            "https://www.souviks.co.in/",
                            "https://www.souviks.co.in/hi/",
                            "https://www.souviks.co.in/bn/",
                        }
                        if not required_urls.issubset(urls):
                            errors.append(
                                "GET /sitemaps/pages.xml: missing canonical homepage URLs: "
                                + ", ".join(sorted(required_urls - urls))
                            )
                        if "https://www.souviks.co.in/en/" in urls:
                            errors.append("GET /sitemaps/pages.xml: non-canonical /en/ homepage is listed")
            elif path == "/robots.txt":
                if "https://www.souviks.co.in/sitemap.xml" not in result.text:
                    errors.append("GET /robots.txt: canonical sitemap URL is missing")
            print(f"[PASS] {label}: HTTP 200")
        except Exception as exc:
            errors.append(f"{label}: request failed: {exc}")
            print(f"[FAIL] {label}: {exc}")

    # Redirect targets must resolve to the clean public routes; no extension loops.
    redirects = {
        "/en/products.html": "/en/products",
        "/en/brands.html": "/en/brands",
        "/en/terms.html": "/en/terms",
        "/en/request-quote": "/en/cart",
        "/hi/request-quote": "/hi/cart",
        "/bn/request-quote": "/bn/cart",
        "/en/request-quote.html": "/en/cart",
        "/hi/request-quote.html": "/hi/cart",
        "/bn/request-quote.html": "/bn/cart",
    }
    for source, target in redirects.items():
        label = f"redirect {source}"
        try:
            result = fetch(BASE + source)
            location = result.headers.get("location", "")
            destination = urllib.parse.urlsplit(urllib.parse.urljoin(BASE + source, location))
            if result.status not in REDIRECTS:
                errors.append(f"{label}: expected redirect status, got HTTP {result.status}")
            if destination.path != target or destination.query or destination.fragment:
                errors.append(f"{label}: Location {location!r} does not point cleanly to {target!r}")
            if destination.hostname not in (None, "www.souviks.co.in"):
                errors.append(f"{label}: unexpected redirect host {destination.hostname!r}")
            if result.status in REDIRECTS and destination.path == target and not destination.query and not destination.fragment:
                print(f"[PASS] {label}: HTTP {result.status} -> {destination.path}")
            else:
                print(f"[FAIL] {label}: HTTP {result.status} Location={location!r}")
        except Exception as exc:
            errors.append(f"{label}: request failed: {exc}")
            print(f"[FAIL] {label}: {exc}")

    # Canonical host + HTTPS behavior, following at most five redirects.
    for start in ("http://souviks.co.in/", "https://souviks.co.in/", "http://www.souviks.co.in/"):
        label = f"host redirect {start}"
        current = start
        chain = []
        try:
            result = None
            for _ in range(6):
                result = fetch(current)
                chain.append((result.status, current, result.headers.get("location", "")))
                if result.status not in REDIRECTS:
                    break
                location = result.headers.get("location")
                if not location:
                    break
                current = urllib.parse.urljoin(current, location)
            parsed = urllib.parse.urlsplit(current)
            ok = (
                result is not None and result.status == 200
                and parsed.scheme == "https"
                and parsed.hostname == "www.souviks.co.in"
                and parsed.path in ("", "/")
            )
            if not ok:
                errors.append(f"{label}: did not resolve to HTTPS www homepage; chain={chain!r}")
                print(f"[FAIL] {label}: chain={chain!r}")
            else:
                print(f"[PASS] {label}: resolved to {current}")
        except Exception as exc:
            errors.append(f"{label}: {exc}")
            print(f"[FAIL] {label}: {exc}")

    # A unique nonexistent path must remain a real 404, not a homepage fallback.
    missing_path = f"/__production-smoke-404-{uuid.uuid4().hex}__"
    label = f"404 {missing_path}"
    try:
        result = fetch(BASE + missing_path)
        validate_headers(result, label, errors)
        body = result.text.casefold()
        if result.status != 404:
            errors.append(f"{label}: expected HTTP 404, got {result.status}")
        if "404" not in body and "page not found" not in body and "not found" not in body:
            errors.append(f"{label}: body does not look like the site's 404 page")
        if result.status == 404:
            print(f"[PASS] {label}: HTTP 404")
        else:
            print(f"[FAIL] {label}: HTTP {result.status}")
    except Exception as exc:
        errors.append(f"{label}: request failed: {exc}")
        print(f"[FAIL] {label}: {exc}")

    # Guard against a new main commit arriving while the smoke test was running.
    try:
        final_sha = github_get(f"/repos/{REPOSITORY}/commits/main")["sha"]
        if final_sha != main_sha:
            errors.append(
                f"main advanced during smoke test from {main_sha} to {final_sha}; "
                "rerun against the newest deployment."
            )
    except Exception as exc:
        errors.append(f"could not re-check main revision after smoke: {exc}")

    if errors:
        print(f"\n[FAIL] Production smoke: {len(errors)} issue(s) across {len(PAGES)} public HTML routes.")
        for item in errors:
            print(" - " + item)
        return 1

    print(f"\n[PASS] Production HTTP smoke: all public routes, six headers, redirects, sitemap, 404 and main revision verified ({main_sha}).")
    return 0


if __name__ == "__main__":
    if "--wait-only" in sys.argv[1:]:
        try:
            deployed_sha = wait_for_latest_main_deployment()
            print(f"[PASS] Cloudflare Pages deployed latest main revision: {deployed_sha}")
            sys.exit(0)
        except Exception as exc:
            print(f"[FAIL] deployment revision: {exc}", file=sys.stderr)
            sys.exit(1)
    sys.exit(run_smoke())
