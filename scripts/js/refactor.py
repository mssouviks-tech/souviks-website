#!/usr/bin/env python3
"""Deterministically split shared JS runtime from static page bundles."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BUNDLES = ROOT / "assets" / "js" / "bundles"
CORE_PATH = ROOT / "assets" / "js" / "site-core.js"
LANGUAGES = ("en", "bn", "hi")

EXCLUDE_BUNDLES = {"account.js"}
KNOWN_BUNDLES = {
    "404.js", "about.js", "brand.js", "brands.js", "categories.js", "category.js",
    "contact.js", "forgot-password.js", "index.js", "login.js", "privacy-policy.js",
    "product.js", "products.js", "refund.js", "register.js", "request-part.js",
    "request-quote.js", "reset-password.js", "terms.js", "thank-you.js",
    "vehicle.js", "vehicles.js",
}

COMMON_END = "/* ===== main.js ===== */"
SPECIAL_ENTITY_END = "/* ===== static-brand-media-sync.js ===== */"
READY = "window.SOUVIKS_SITE_CORE_READY = true;"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def extract_core() -> str:
    if CORE_PATH.exists():
        core = read(CORE_PATH)
        if READY not in core:
            raise ValueError("Existing site-core.js is missing readiness marker")
        return core

    source = read(BUNDLES / "404.js")
    end = source.index(COMMON_END)
    core = source[:end].rstrip() + f"\n\n{READY}\n"
    return (
        "/* ==========================================================\n"
        "   SOUVIKS — SHARED SITE JAVASCRIPT CORE\n"
        "   Utilities, authentication and language handling.\n"
        "   Page-specific behaviour remains in page bundles.\n"
        "========================================================== */\n\n"
        + core
    )


def request_quote_extra(source: str) -> str:
    start = source.find("const RFQ_TEXT = {")
    if start == -1:
        return ""
    end_marker = "const rfqText = RFQ_TEXT[LANG] || RFQ_TEXT.en;"
    end = source.find(end_marker, start)
    if end == -1:
        raise ValueError("request-quote.js RFQ_TEXT block is incomplete")
    return source[start:end + len(end_marker)].strip() + "\n\n"


def build_page_bundle(filename: str) -> str:
    source = read(BUNDLES / filename)
    if filename in EXCLUDE_BUNDLES:
        return source
    if source.startswith("/* Shared core is loaded by the HTML page before this bundle. */"):
        return source

    if filename == "request-quote.js":
        start = source.find(COMMON_END)
        if start == -1:
            raise ValueError("request-quote.js is missing main.js marker")
        return (
            "/* Shared core is loaded by the HTML page before this bundle. */\n\n"
            + request_quote_extra(source)
            + source[start:].lstrip()
        )

    start = source.find(
        SPECIAL_ENTITY_END if filename == "brand.js" else COMMON_END
    )
    if start == -1:
        raise ValueError(f"{filename} is missing its page-runtime marker")

    return (
        "/* Shared core is loaded by the HTML page before this bundle. */\n\n"
        + source[start:].lstrip()
    )


def migrate_html() -> int:
    changed = 0
    bundle_pattern = re.compile(
        r'<script\s+defer\s+src="(/assets/js/bundles/([^"]+))"></script>'
    )

    for language in LANGUAGES:
        root = ROOT / language
        if not root.exists():
            continue

        for path in root.rglob("*.html"):
            content = read(path)

            def replace(match: re.Match[str]) -> str:
                bundle_name = match.group(2)
                if bundle_name == "account.js":
                    return match.group(0)

                core_tag = '<script defer src="/assets/js/site-core.js"></script>'
                if core_tag in content:
                    return match.group(0)
                return core_tag + "\n\n" + match.group(0)

            new_content, count = bundle_pattern.subn(replace, content)
            if count and new_content != content:
                write(path, new_content)
                changed += 1

    return changed


def validate() -> None:
    core = read(CORE_PATH)
    if READY not in core:
        raise ValueError("site-core.js readiness marker missing")

    for filename in sorted(KNOWN_BUNDLES - EXCLUDE_BUNDLES):
        source = read(BUNDLES / filename)
        if "/* ===== utils.js ===== */" in source:
            raise ValueError(f"{filename} still embeds the shared utilities layer")
        if "/* ===== auth/supabase.js ===== */" in source:
            raise ValueError(f"{filename} still embeds the shared auth layer")
        if "/* Shared core is loaded by the HTML page before this bundle. */" not in source:
            raise ValueError(f"{filename} is missing shared-core declaration")

    for language in LANGUAGES:
        for path in (ROOT / language).rglob("*.html"):
            content = read(path)
            match = re.search(
                r'<script\s+defer\s+src="(/assets/js/bundles/([^"]+))"></script>', content
            )
            if not match:
                continue
            if match.group(2) == "account.js":
                continue
            if '<script defer src="/assets/js/site-core.js"></script>' not in content:
                raise ValueError(f"Missing shared core on {path}")


def main() -> None:
    write(CORE_PATH, extract_core())

    for filename in sorted(KNOWN_BUNDLES):
        write(BUNDLES / filename, build_page_bundle(filename))

    changed = migrate_html()
    validate()

    print(
        f"JavaScript architecture migration complete: "
        f"{len(KNOWN_BUNDLES) - len(EXCLUDE_BUNDLES)} bundles processed; "
        f"{changed} HTML pages updated."
    )
    print("account.js intentionally remains isolated because its dependency order differs.")


if __name__ == "__main__":
    main()
