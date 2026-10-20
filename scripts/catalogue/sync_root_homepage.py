#!/usr/bin/env python3
"""Keep the canonical root homepage synchronized with the English homepage.

The public root URL is the canonical English homepage. Localized visitors with
Hindi or Bengali as their saved/preferred language are routed to that locale.
This runs after page/asset generation so root markup and cache hashes match the
current English source instead of a one-time copied page drifting over time.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "en" / "index.html"
TARGET = ROOT / "index.html"
ROUTING_MARKER = "SOUVIKS ROOT HOMEPAGE LANGUAGE ROUTING"

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
        raise SystemExit(f"English homepage must have exactly one canonical link; found {len(canonicals)}")
    return canonicals[0]


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

    if canonical_url(updated) != expected_canonical:
        raise SystemExit("Synchronized root homepage lost the canonical root URL")

    if not updated.lstrip().lower().startswith("<!doctype html>"):
        raise SystemExit("Synchronized root homepage must retain the HTML document type")

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
