#!/usr/bin/env python3
"""Smoke-test the deployed Souviks public edge contract.

This is intentionally limited to externally observable HTTP behavior:
redirect normalization, public routes, robots/sitemap availability, 404 behavior,
and required security headers. It does not attempt to prove Cloudflare dashboard
rules or authenticated Supabase state.
"""

from __future__ import annotations

import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from urllib.parse import urljoin


BASE = os.environ.get("SMOKE_BASE_URL", "https://www.souviks.co.in").rstrip("/")

REQUIRED_HEADERS = {
    "strict-transport-security": "max-age=31536000; includesubdomains; preload",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "x-frame-options": "sameorigin",
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect())


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: str


def fetch(path: str, *, retries: int = 2) -> Response:
    url = path if path.startswith("http") else urljoin(BASE + "/", path.lstrip("/"))
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "SouviksProductionSmoke/1.0"},
            )
            with OPENER.open(request, timeout=20) as response:
                return Response(
                    status=int(response.status),
                    headers={k.lower(): v for k, v in response.headers.items()},
                    body=response.read().decode("utf-8", errors="replace"),
                )
        except urllib.error.HTTPError as exc:
            return Response(
                status=int(exc.code),
                headers={k.lower(): v for k, v in exc.headers.items()},
                body=exc.read().decode("utf-8", errors="replace"),
            )
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
            if attempt < retries:
                time.sleep(2)
    raise RuntimeError(f"{url}: {last or 'request failed'}")


def assert_status(path: str, expected: int) -> Response:
    response = fetch(path)
    if response.status != expected:
        raise AssertionError(f"{path}: HTTP {response.status}, expected {expected}")
    return response


def assert_security_headers(path: str, response: Response) -> None:
    for name, expected in REQUIRED_HEADERS.items():
        actual = re.sub(r"\s+", " ", response.headers.get(name, "").strip()).lower()
        if actual != expected:
            raise AssertionError(
                f"{path}: {name}={actual!r}, expected {expected!r}"
            )
    csp = response.headers.get("content-security-policy", "")
    if "frame-ancestors 'self'" not in csp:
        raise AssertionError(
            f"{path}: content-security-policy is missing frame-ancestors 'self'"
        )


def check_public_route(path: str) -> None:
    response = assert_status(path, 200)
    assert_security_headers(path, response)
    if not response.body.strip():
        raise AssertionError(f"{path}: empty response body")


def check_legacy_redirect() -> None:
    response = assert_status("/en/privacy-policy.html", 301)
    location = response.headers.get("location", "").rstrip("/")
    expected = "/en/privacy-policy"
    if location not in {expected, BASE + expected}:
        raise AssertionError(
            f"/en/privacy-policy.html: Location={location!r}, expected {expected!r}"
        )


def check_404() -> None:
    response = assert_status(
        "/production-smoke-this-route-does-not-exist-8f6c7a",
        404,
    )
    assert_security_headers(
        "/production-smoke-this-route-does-not-exist-8f6c7a",
        response,
    )
    if not re.search(r"\b404\b|not found|page.*found", response.body, re.I):
        raise AssertionError("404 page body does not expose recognizable error copy")


def check_robots() -> None:
    response = assert_status("/robots.txt", 200)
    if not re.search(r"^sitemap:\s*https://www\.souviks\.co\.in/sitemap\.xml\s*$", response.body, re.I | re.M):
        raise AssertionError("robots.txt does not expose the canonical sitemap URL")


def check_sitemap() -> None:
    response = assert_status("/sitemap.xml", 200)
    if "<sitemapindex" not in response.body.lower() and "<urlset" not in response.body.lower():
        raise AssertionError("sitemap.xml is not a sitemap XML document")
    try:
        ET.fromstring(response.body)
    except ET.ParseError as exc:
        raise AssertionError(f"sitemap.xml is not well-formed XML: {exc}") from exc
    urls = re.findall(r"<loc>([^<]+)</loc>", response.body)
    if not urls:
        raise AssertionError("sitemap.xml contains no <loc> entries")
    html_urls = [url for url in urls if ".html" in url.lower()]
    if html_urls:
        raise AssertionError(
            "sitemap.xml contains legacy .html URLs: " + ", ".join(html_urls[:5])
        )


def main() -> int:
    checks = [
        ("public English products", lambda: check_public_route("/en/products")),
        ("public Hindi products", lambda: check_public_route("/hi/products")),
        ("public Bengali products", lambda: check_public_route("/bn/products")),
        ("representative PDP", lambda: check_public_route("/en/products/10-x-15-nut")),
        ("legacy route redirect", check_legacy_redirect),
        ("404 response", check_404),
        ("robots.txt", check_robots),
        ("sitemap.xml", check_sitemap),
    ]

    failures = 0
    for label, fn in checks:
        try:
            fn()
            print(f"[PASS] {label}")
        except Exception as exc:
            failures += 1
            print(f"[FAIL] {label}: {exc}")

    if failures:
        print(f"Production smoke failed: {failures} check(s).", file=sys.stderr)
        return 1
    print(f"Production smoke passed against {BASE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
