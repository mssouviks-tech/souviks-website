#!/usr/bin/env python3
"""Add the purchase-cart runtime to static product listing and detail pages."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
CART_PATH = ROOT / "assets" / "js" / "cart" / "cart.js"
CART_URL = "/assets/js/cart/cart.js"
CART_TAG = re.compile(
    r'<script\b(?=[^>]*\bsrc=["\']/assets/js/cart/cart\.js(?:\?v=[^"\']*)?["\'])[^>]*></script>',
    flags=re.I,
)


def pages_to_scan():
    yield from ROOT.glob("*.html")
    for language in LANGUAGES:
        yield from (ROOT / language).rglob("*.html")


def needs_cart_runtime(source: str) -> bool:
    return bool(
        re.search(
            r'class=["\'][^"\']*(?:add-to-purchase-cart|add-to-cart|pdp-rfq-btn)',
            source,
            flags=re.I,
        )
        or "/assets/js/components/product-card.js" in source
        or 'id="purchase-cart-root"' in source
        or 'id="payment-status-root"' in source
    )


def sync_page(path: Path, source: str, version: str) -> str:
    tag = f'<script defer src="{CART_URL}?v={version}"></script>'
    if CART_TAG.search(source):
        return CART_TAG.sub(tag, source, count=1)
    if not needs_cart_runtime(source):
        return source
    closing = re.search(r"</body\s*>", source, flags=re.I)
    if not closing:
        raise RuntimeError(
            f"{path.relative_to(ROOT)} needs the cart runtime but has no closing body tag"
        )
    return source[:closing.start()] + "  " + tag + "\n" + source[closing.start():]


def main() -> int:
    if not CART_PATH.is_file():
        raise FileNotFoundError(f"Required purchase-cart runtime is missing: {CART_PATH}")
    version = hashlib.sha256(CART_PATH.read_bytes()).hexdigest()[:12]
    changed = 0
    inserted = 0
    scanned = 0
    for path in sorted(set(pages_to_scan())):
        if not path.is_file():
            continue
        original = path.read_text(encoding="utf-8")
        if not needs_cart_runtime(original) and not CART_TAG.search(original):
            continue
        updated = sync_page(path, original, version)
        scanned += 1
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
            inserted += 1
    print(
        f"Purchase-cart runtime version {version}: "
        f"{inserted} pages updated; {scanned} pages checked."
    )
    return changed


if __name__ == "__main__":
    raise SystemExit(main())
