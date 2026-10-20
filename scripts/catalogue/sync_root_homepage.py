#!/usr/bin/env python3
"""Keep the canonical root homepage synchronized with the English homepage.

The root URL is the crawlable English homepage; browser language routing only
applies to preferred/saved Hindi and Bengali visitors. This script copies the
complete English page and refuses to publish a loader-only or metadata-only
root page.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "en" / "index.html"
TARGET = ROOT / "index.html"
ROUTING_MARKER = "SOUVIKS ROOT HOMEPAGE LANGUAGE ROUTING"
LOADER_MARKERS = ("souviks-loading-logo", "id=\"loading-screen\"", "class=\"loading-screen\"")

ROUTING_SCRIPT = """<script>
/* SOUVIKS ROOT HOMEPAGE LANGUAGE ROUTING
   Keep English at the canonical root; route preferred Hindi/Bengali visitors. */
(function () {
    "use strict";
    const localized = new Set(["bn", "hi"]);
    let saved = "";
    try {
        saved = String(localStorage.getItem("svks_language") || "").trim().toLowerCase();
    } catch (error) {
        saved = "";
    }

    if (localized.has(saved)) {
        window.location.replace("/" + saved + "/");
        return;
    }
    if (saved === "en") return;

    const candidates = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
    for (const value of candidates) {
        const language = String(value || "").toLowerCase().split("-")[0];
        if (["en", "bn", "hi"].includes(language)) {
            if (localized.has(language)) window.location.replace("/" + language + "/");
            return;
        }
    }
})();
</script>"""


def canonical_url(source: str) -> str:
    links = re.findall(r"<link\b[^>]*>", source, flags=re.IGNORECASE | re.DOTALL)
    canonicals = []
    for tag in links:
        rel = re.search(r"\brel\s*=\s*(['\"])(.*?)\1", tag, flags=re.IGNORECASE | re.DOTALL)
        href = re.search(r"\bhref\s*=\s*(['\"])(.*?)\1", tag, flags=re.IGNORECASE | re.DOTALL)
        if rel and "canonical" in rel.group(2).lower().split() and href:
            canonicals.append(href.group(2).strip())
    if len(canonicals) != 1:
        raise SystemExit(f"Homepage must have exactly one canonical link; found {len(canonicals)}")
    return canonicals[0]


def validate_root_document(source: str) -> None:
    """Protect core SEO and renderable content from loader-screen regressions."""
    if not source.lstrip().lower().startswith("<!doctype html>"):
        raise SystemExit("Root homepage must retain the HTML doctype")
    if canonical_url(source) != "https://www.souviks.co.in/":
        raise SystemExit("Root homepage canonical must be https://www.souviks.co.in/")
    title = re.search(r"<title\b[^>]*>(.*?)</title>", source, flags=re.IGNORECASE | re.DOTALL)
    if not title or not re.sub(r"<[^>]+>", "", title.group(1)).strip():
        raise SystemExit("Root homepage must contain a non-empty title")
    if not re.search(r'<meta\b(?=[^>]*\bname\s*=\s*["\']description["\'])[^>]*\bcontent\s*=\s*["\'][^"\']{40,}["\']', source, re.I | re.S):
        raise SystemExit("Root homepage must contain a meaningful meta description")
    body = re.search(r"<body\b[^>]*>(.*?)</body\s*>", source, flags=re.IGNORECASE | re.DOTALL)
    if not body:
        raise SystemExit("Root homepage is missing a body")
    body_text = re.sub(r"<script\b.*?</script\s*>", " ", body.group(1), flags=re.I | re.S)
    body_text = re.sub(r"<style\b.*?</style\s*>", " ", body_text, flags=re.I | re.S)
    visible_text = re.sub(r"<[^>]+>", " ", body_text)
    visible_text = re.sub(r"\s+", " ", visible_text).strip()
    if len(visible_text) < 500:
        raise SystemExit(f"Root homepage has only {len(visible_text)} visible text characters; expected full homepage content")
    if not re.search(r"<main\b|\bclass\s*=\s*['\"][^'\"]*\b(hero|page-home)\b", body.group(1), re.I):
        raise SystemExit("Root homepage is missing its main/homepage content container")
    for marker in LOADER_MARKERS:
        if marker.casefold() in source.casefold():
            raise SystemExit(f"Root homepage must not contain obsolete loading-screen marker: {marker}")
    if re.search(r"setTimeout\s*\([^)]*(?:location|window\.location)", source, re.I | re.S):
        raise SystemExit("Root homepage must not use a timed JavaScript redirect as its primary content")
    for locale_url in ("/bn/", "/hi/"):
        if locale_url not in source:
            raise SystemExit(f"Root homepage is missing localized routing support for {locale_url}")


def synchronize() -> bool:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing English homepage source: {SOURCE.relative_to(ROOT)}")
    source = SOURCE.read_text(encoding="utf-8")

    expected_canonical = "https://www.souviks.co.in/"
    actual_canonical = canonical_url(source)
    if actual_canonical != expected_canonical:
        raise SystemExit(
            f"English homepage canonical must be {expected_canonical!r}, got {actual_canonical!r}"
        )

    updated, page_count = re.subn(
        r'(?m)(\bcurrentPageUrl\s*:\s*)(["\'])[^"\']*\2',
        lambda match: f'{match.group(1)}"/"',
        source,
        count=1,
    )
    if page_count != 1:
        raise SystemExit(f"Expected exactly one currentPageUrl in English homepage; found {page_count}")

    # Keep all home/logo links on the canonical root, not the duplicate /en/ route.
    updated = updated.replace('href="/en/"', 'href="/"').replace("href='/en/'", "href='/'")

    if ROUTING_MARKER not in updated:
        title = re.search(r"<title\b[^>]*>", updated, flags=re.IGNORECASE)
        if not title:
            raise SystemExit("English homepage is missing its title element")
        updated = updated[:title.start()] + ROUTING_SCRIPT + "\n\n    " + updated[title.start():]

    if re.search(r'\bhref\s*=\s*["\']/en/["\']', updated, flags=re.IGNORECASE):
        raise SystemExit("Root homepage still contains a home link to /en/")

    validate_root_document(updated)
    if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != updated:
        TARGET.write_text(updated, encoding="utf-8", newline="")
        return True
    return False


if __name__ == "__main__":
    changed = synchronize()
    print(
        "Root homepage synchronized from en/index.html: "
        + ("updated." if changed else "already current.")
    )
