#!/usr/bin/env python3
"""Ensure pages with product RFQ controls load the shared RFQ basket engine."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
RFQ_PATH = ROOT / "assets/js/account/rfq.js"
RFQ_URL = "/assets/js/account/rfq.js"

CATALOGUE_CORE_TAG = re.compile(
    r'(?mi)^[ \t]*<script\b[^>]*\bsrc=["\']/assets/js/catalogue-core\.js(?:\?v=[^"\']*)?["\'][^>]*></script>[ \t]*$'
)
SITE_CORE_TAG = re.compile(
    r'(?mi)^[ \t]*<script\b[^>]*\bsrc=["\']/assets/js/site-core\.js(?:\?v=[^"\']*)?["\'][^>]*></script>[ \t]*$'
)
PRODUCT_CARD_TAG = re.compile(
    r'(?mi)^[ \t]*<script\b[^>]*\bsrc=["\']/assets/js/components/product-card\.js(?:\?v=[^"\']*)?["\'][^>]*></script>[ \t]*$'
)


def pages_to_scan():
    yield from ROOT.glob("*.html")
    for language in LANGUAGES:
        yield from (ROOT / language).rglob("*.html")


def needs_rfq_engine(html: str) -> bool:
    if RFQ_URL in html or "/assets/js/request-quote/rfq.js" in html:
        return False
    return bool(
        re.search(r'class=["\'][^"\']*(?:add-to-cart|pdp-rfq-btn)', html, flags=re.I)
        or "/assets/js/components/product-card.js" in html
    )


def add_shared_rfq_script(path: Path, html: str, version: str) -> str:
    if not needs_rfq_engine(html):
        return html

    tag = f'<script defer src="{RFQ_URL}?v={version}"></script>'
    for pattern in (CATALOGUE_CORE_TAG, SITE_CORE_TAG, PRODUCT_CARD_TAG):
        match = pattern.search(html)
        if match:
            insertion = match.end()
            return html[:insertion] + "\n" + tag + html[insertion:]

    # Explicit scripts are preferable to silently leaving visible controls inert.
    raise RuntimeError(
        f"{path.relative_to(ROOT)} contains RFQ/product-card controls but has no "
        "site-core, catalogue-core or product-card script anchor"
    )


def main() -> int:
    if not RFQ_PATH.is_file():
        raise FileNotFoundError(f"Required shared RFQ module is missing: {RFQ_PATH}")
    version = hashlib.sha256(RFQ_PATH.read_bytes()).hexdigest()[:12]
    changed = 0
    inserted = 0
    for path in sorted(set(pages_to_scan())):
        if not path.is_file():
            continue
        original = path.read_text(encoding="utf-8")
        if not needs_rfq_engine(original):
            continue
        updated = add_shared_rfq_script(path, original, version)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
            inserted += 1

    print(f"Shared RFQ engine version {version}: inserted on {inserted} pages.")
    return changed


if __name__ == "__main__":
    main()
