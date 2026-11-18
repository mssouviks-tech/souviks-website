#!/usr/bin/env python3
"""Replace eager Supabase CDN tags with the shared local lazy-loader."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "bn", "hi")
LOADER_PATH = ROOT / "assets" / "js" / "supabase-loader.js"
LOADER_URL = "/assets/js/supabase-loader.js"

# Legacy thank-you pages have no shared site runtime and no authenticated actions.
NO_SITE_CORE_SUPABASE_PAGES = {
    "en/thank-you.html",
    "bn/thank-you.html",
    "hi/thank-you.html",
}

SUPABASE_SDK_TAG = re.compile(
    r'<script\b(?=[^>]*\bsrc=["\'][^"\']*supabase-js[^"\']*["\'])[^>]*>\s*</script>',
    flags=re.I | re.S,
)
LOADER_TAG = re.compile(
    # Match the whole script line, including its indentation and newline.
    # Removing only the tag leaves progressively accumulating blank lines
    # each time the synchronizer is run, breaking idempotency.
    r'(?m)^[ \t]*<script\b(?=[^>]*\bsrc=["\']/assets/js/supabase-loader\.js(?:\?v=[^"\']*)?["\'])[^>]*>\s*</script>[ \t]*(?:\r?\n|$)',
    flags=re.I | re.S,
)
SITE_CORE_TAG = re.compile(
    r'<script\b[^>]*\bsrc=["\']/assets/js/site-core\.js(?:\?v=[^"\']*)?["\'][^>]*></script>',
    flags=re.I,
)


def pages_to_scan():
    yield from ROOT.glob("*.html")
    for language in LANGUAGES:
        root = ROOT / language
        if root.exists():
            yield from root.rglob("*.html")


def sync_page(path: Path, source: str, version: str) -> str:
    # Remove every eager SDK script, including the non-defer cart-page variant.
    updated = SUPABASE_SDK_TAG.sub("", source)
    # Removing an indented script tag can leave its original indentation on
    # an otherwise blank line; strip whitespace-only lines so git diff --check
    # remains clean on generated HTML.
    updated = re.sub(r"(?m)^[ \t]+$", "", updated)
    tag = f'<script defer src="{LOADER_URL}?v={version}"></script>'

    # Normalize any existing loader tags first, then remove indentation
    # left on an otherwise empty line by the tag replacement. Insert exactly
    # one versioned reference immediately before site-core.js.
    updated = LOADER_TAG.sub("", updated)
    updated = re.sub(r"(?m)^[ \t]+$", "", updated)
    core = SITE_CORE_TAG.search(updated)
    if not core:
        if source != updated and path.relative_to(ROOT).as_posix() not in NO_SITE_CORE_SUPABASE_PAGES:
            raise RuntimeError(
                f"{path.relative_to(ROOT)} had the Supabase CDN script but no site-core.js anchor."
            )
        return updated

    return updated[:core.start()] + tag + "\n" + updated[core.start():]


def main() -> int:
    if not LOADER_PATH.is_file():
        raise FileNotFoundError(f"Required lazy loader is missing: {LOADER_PATH}")

    version = hashlib.sha256(LOADER_PATH.read_bytes()).hexdigest()[:12]
    changed = 0

    for path in sorted(set(pages_to_scan())):
        if not path.is_file():
            continue
        source = path.read_text(encoding="utf-8")
        updated = sync_page(path, source, version)
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            changed += 1

    print(
        f"Supabase lazy-loader version {version}: "
        f"{changed} HTML files updated; eager SDK tags removed."
    )
    return changed


if __name__ == "__main__":
    main()
