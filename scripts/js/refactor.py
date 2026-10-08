#!/usr/bin/env python3
"""Deterministically split shared JS runtime from static page bundles."""

from pathlib import Path
import hashlib
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
COMMON_END_LABEL = "/* ===== image-protection.js ===== */"
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


def strip_common_ui(source: str) -> str:
    start = source.find(COMMON_END)
    if start == -1:
        raise ValueError("bundle is missing main.js marker")
    return source[start:].lstrip()

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
        page_start = source.find(COMMON_END_LABEL, start)
        if page_start == -1:
            raise ValueError("request-quote.js is missing image-protection marker")
        return (
            "/* Shared core is loaded by the HTML page before this bundle. */\n\n"
            + request_quote_extra(source)
            + source[page_start + len(COMMON_END_LABEL):].lstrip()
        )

    start = source.find(COMMON_END)
    if start == -1:
        raise ValueError(f"{filename} is missing main.js marker")
    page_marker = source.find(COMMON_END_LABEL, start)
    if page_marker == -1:
        raise ValueError(f"{filename} is missing image-protection marker")
    return (
        "/* Shared core is loaded by the HTML page before this bundle. */\n\n"
        + source[page_marker + len(COMMON_END_LABEL):].lstrip()
    )


def asset_version(path: Path) -> str:
    """Return a deterministic content hash used to bust edge caches."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def versioned_asset_url(relative_path: str) -> str:
    path = ROOT / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Cannot version missing asset: {relative_path}")
    return f"/{relative_path}?v={asset_version(path)}"


def migrate_html() -> int:
    changed = 0
    bundle_pattern = re.compile(
        r'<script\s+defer\s+src="/assets/js/bundles/([^"?]+)(?:\?[^"]*)?"></script>'
    )
    core_pattern = re.compile(
        r'<script\s+defer\s+src="/assets/js/site-core\.js(?:\?[^"]*)?"></script>'
    )

    core_tag = f'<script defer src="{versioned_asset_url("assets/js/site-core.js")}"></script>'

    paths = []
    for language in LANGUAGES:
        root = ROOT / language
        if root.exists():
            paths.extend(root.rglob("*.html"))

    root_404 = ROOT / "404.html"
    if root_404.exists():
        paths.append(root_404)

    for path in sorted(set(paths)):
        content = read(path)
        new_content = core_pattern.sub(core_tag, content)

        def replace_bundle(match: re.Match[str]) -> str:
            bundle_name = match.group(1)
            return (
                f'<script defer src="{versioned_asset_url(
                    f"assets/js/bundles/{bundle_name}"
                )}"></script>'
            )

        new_content = bundle_pattern.sub(replace_bundle, new_content)

        if new_content != content:
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
        if COMMON_END in source or COMMON_END_LABEL in source:
            raise ValueError(f"{filename} still embeds the shared navigation/image runtime")
        if "/* Shared core is loaded by the HTML page before this bundle. */" not in source:
            raise ValueError(f"{filename} is missing shared-core declaration")

    core_re = re.compile(
        r'<script\s+defer\s+src="/assets/js/site-core\.js\?v=[0-9a-f]{12}"></script>'
    )
    bundle_re = re.compile(
        r'<script\s+defer\s+src="/assets/js/bundles/([^"?]+)\?v=[0-9a-f]{12}"></script>'
    )

    paths = []
    for language in LANGUAGES:
        paths.extend((ROOT / language).rglob("*.html"))
    if (ROOT / "404.html").exists():
        paths.append(ROOT / "404.html")

    for path in sorted(set(paths)):
        content = read(path)
        matches = bundle_re.findall(content)
        if not matches:
            continue
        if "account.js" in matches:
            continue
        if not core_re.search(content):
            raise ValueError(f"Missing versioned shared core on {path}")


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
