#!/usr/bin/env python3
"""Validate Souviks JavaScript bundle boundaries.

The site uses classic scripts: site-core.js owns shared runtime behaviour,
while page bundles own page-specific behaviour. Account pages are the one
intentional exception because account.js is self-contained.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
JS_ROOT = ROOT / "assets" / "js"
BUNDLES = JS_ROOT / "bundles"

SHARED_MARKERS = {
    "main.js",
    "image-protection.js",
}

ACCOUNT_BUNDLE = "account.js"
SITE_CORE = JS_ROOT / "site-core.js"

def fail(message: str) -> None:
    print(f"[JS architecture] ERROR: {message}")
    raise SystemExit(1)

def script_sources(html: str) -> list[str]:
    return re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html, flags=re.I)

def main() -> None:
    if not SITE_CORE.is_file():
        fail("assets/js/site-core.js is missing.")

    errors: list[str] = []

    for bundle in sorted(BUNDLES.glob("*.js")):
        text = bundle.read_text(encoding="utf-8")
        markers = set(re.findall(r"/\* ===== ([^\n*]+?) ===== \*/", text))
        shared = sorted(markers & SHARED_MARKERS)

        if shared and bundle.name != ACCOUNT_BUNDLE:
            errors.append(
                f"{bundle.relative_to(ROOT)} contains shared modules: {', '.join(shared)}"
            )

    for language in ("en", "bn", "hi"):
        for html_path in sorted((ROOT / language).rglob("*.html")):
            html = html_path.read_text(encoding="utf-8")
            sources = script_sources(html)
            bundle_sources = [src for src in sources if "/assets/js/bundles/" in src]
            if not bundle_sources:
                continue

            is_account = any(src.endswith("/account.js") for src in bundle_sources)
            has_core = "/assets/js/site-core.js" in sources

            if is_account:
                if has_core:
                    errors.append(
                        f"{html_path.relative_to(ROOT)} loads both site-core.js and account.js; "
                        "account.js is intentionally self-contained."
                    )
            elif not has_core:
                errors.append(
                    f"{html_path.relative_to(ROOT)} loads a page bundle without site-core.js."
                )
            else:
                core_index = sources.index("/assets/js/site-core.js")
                for src in bundle_sources:
                    if sources.index(src) < core_index:
                        errors.append(
                            f"{html_path.relative_to(ROOT)} loads {src} before site-core.js."
                        )

    if errors:
        for error in errors:
            print(f"[JS architecture] ERROR: {error}")
        raise SystemExit(1)

    print("[JS architecture] OK: shared runtime boundaries and script ordering are valid.")

if __name__ == "__main__":
    main()
