#!/usr/bin/env python3
"""Synchronize Delhivery estimator assets onto product pages and cart pages."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
PRODUCT_SCRIPT = ROOT / "assets/js/product/delivery-estimate.js"
CART_SCRIPT = ROOT / "assets/js/cart/delivery-estimate.js"
STYLE_PATH = ROOT / "assets/css/delhivery-estimator.css"
PRODUCT_SCRIPT_URL = "/assets/js/product/delivery-estimate.js"
CART_SCRIPT_URL = "/assets/js/cart/delivery-estimate.js"
STYLE_URL = "/assets/css/delhivery-estimator.css"
SCRIPT_TAG = re.compile(
    r'<script\b(?=[^>]*\bsrc=["\']/(?:assets/js/product/delivery-estimate|assets/js/cart/delivery-estimate)\.js(?:\?v=[^"\']*)?["\'])[^>]*></script>',
    flags=re.I,
)
STYLE_TAG = re.compile(
    r'<link\b(?=[^>]*\bhref=["\']\/assets/css/delhivery-estimator\.css(?:\?v=[^"\']*)?["\'])[^>]*>',
    flags=re.I,
)


def asset_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def pages_to_scan():
    for language in LANGUAGES:
        yield from (ROOT / language / "products").glob("*.html")
        yield ROOT / language / "cart.html"


def sync_page(path: Path) -> bool:
    source = path.read_text(encoding="utf-8")
    is_product = 'id="product-detail"' in source
    is_cart = path.name == "cart.html" and 'id="purchase-cart-root"' in source
    if not is_product and not is_cart:
        return False

    script_path = CART_SCRIPT if is_cart else PRODUCT_SCRIPT
    script_url = CART_SCRIPT_URL if is_cart else PRODUCT_SCRIPT_URL
    script_tag = f'<script defer src="{script_url}?v={asset_hash(script_path)}"></script>'
    style_tag = f'<link rel="stylesheet" href="{STYLE_URL}?v={asset_hash(STYLE_PATH)}">'
    updated, script_count = SCRIPT_TAG.subn(script_tag, source, count=1)
    if not script_count:
        body_close = re.search(r"</body\s*>", updated, flags=re.I)
        if not body_close:
            raise RuntimeError(f"{path.relative_to(ROOT)} has no closing body tag")
        updated = updated[:body_close.start()] + "  " + script_tag + "\n" + updated[body_close.start():]

    updated, style_count = STYLE_TAG.subn(style_tag, updated, count=1)
    if not style_count:
        head_close = re.search(r"</head\s*>", updated, flags=re.I)
        if not head_close:
            raise RuntimeError(f"{path.relative_to(ROOT)} has no closing head tag")
        updated = updated[:head_close.start()] + "  " + style_tag + "\n" + updated[head_close.start():]

    if updated != source:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> int:
    required = (PRODUCT_SCRIPT, CART_SCRIPT, STYLE_PATH)
    missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing Delhivery estimator assets: " + ", ".join(missing))
    changed = sum(1 for page in sorted(pages_to_scan()) if page.is_file() and sync_page(page))
    print(f"Delhivery estimator assets synchronized: {changed} product/cart pages changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
