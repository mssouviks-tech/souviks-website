#!/usr/bin/env python3
"""Keep the shared RFQ basket engine only on pages that need RFQ controls."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
RFQ_PATH = ROOT / "assets/js/account/rfq.js"
RFQ_URL = "/assets/js/account/rfq.js"

RFQ_SCRIPT_TAG = re.compile(
    r'(?mi)^[ \t]*<script\b[^>]*\bsrc=["\']/assets/js/account/rfq\.js(?:\?v=[^"\']*)?["\'][^>]*></script>[ \t]*(?:\r?\n|$)'
)
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


def needs_rfq_engine(path: Path, html: str) -> bool:
    """Return whether this route's markup or modules require the RFQ engine."""
    # The account route hosts the authenticated RFQ basket itself.
    if path.name == "account.html":
        return True
    if "/assets/js/request-quote/rfq.js" in html:
        return False
    return bool(
        re.search(r'class=["\'][^"\']*(?:add-to-cart|pdp-rfq-btn)', html, flags=re.I)
        or "/assets/js/components/product-card.js" in html
    )


def sync_shared_rfq_script(path: Path, html: str, version: str) -> str:
    """Add, refresh or remove the RFQ engine based on actual page requirements."""
    # Remove any stale or duplicate include first. Required pages get one
    # correctly versioned include reinserted after their shared runtime.
    updated = RFQ_SCRIPT_TAG.sub("", html)
    if not needs_rfq_engine(path, updated):
        return updated

    tag = f'<script defer src="{RFQ_URL}?v={version}"></script>'
    for pattern in (CATALOGUE_CORE_TAG, SITE_CORE_TAG, PRODUCT_CARD_TAG):
        match = pattern.search(updated)
        if match:
            insertion = match.end()
            return updated[:insertion] + "\n" + tag + "\n" + updated[insertion:].lstrip("\r\n")

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
    added = 0
    removed = 0
    for path in sorted(set(pages_to_scan())):
        if not path.is_file():
            continue
        original = path.read_text(encoding="utf-8")
        updated = sync_shared_rfq_script(path, original, version)
        if updated != original:
            had_script = bool(RFQ_SCRIPT_TAG.search(original))
            needs_script = needs_rfq_engine(path, updated)
            path.write_text(updated, encoding="utf-8")
            changed += 1
            if needs_script and not had_script:
                added += 1
            elif had_script and not needs_script:
                removed += 1

    print(
        f"Shared RFQ engine version {version}: "
        f"{added} added, {removed} stale includes removed, {changed} pages changed."
    )
    return changed


if __name__ == "__main__":
    main()
