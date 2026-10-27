#!/usr/bin/env python3
"""Synchronize branded delivery estimates onto product pages and checkout."""

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
    r'^[ \t]*<script\b(?=[^>]*\bsrc=["\']/(?:assets/js/product/delivery-estimate|assets/js/cart/delivery-estimate)\.js(?:\?v=[^"\']*)?["\'])[^>]*></script>[ \t]*(?:\r?\n|$)',
    flags=re.I | re.M,
)
STYLE_TAG = re.compile(
    r'^[ \t]*<link\b(?=[^>]*\bhref=["\']/assets/css/delhivery-estimator\.css(?:\?v=[^"\']*)?["\'])[^>]*>[ \t]*(?:\r?\n|$)',
    flags=re.I | re.M,
)
PDP_ACTIONS_TAG = re.compile(
    r'(<div\b[^>]*class=["\'][^"\']*\bpdp-actions\b[^"\']*["\'][^>]*>)',
    flags=re.I,
)

PDP_PANEL = """<section id="product-delivery-estimator" class="delhivery-estimator delhivery-product-estimator" aria-labelledby="product-delivery-estimator-title">
  <h2 id="product-delivery-estimator-title">Check delivery to your PIN code</h2>
  <p id="product-delivery-estimator-intro" class="delhivery-estimator-intro">Enter your 6-digit PIN code to see the estimated delivery date.</p>
  <form id="product-delivery-pin-form" class="delhivery-estimator-form" novalidate>
    <div class="form-group delhivery-estimator-pin-group">
      <label id="product-delivery-pincode-label" for="product-delivery-pincode">Delivery PIN code</label>
      <div class="delhivery-estimator-pin-controls">
        <input id="product-delivery-pincode" name="delivery_pin" type="text" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{6}" minlength="6" maxlength="6" aria-describedby="product-delivery-estimator-intro" required>
        <button id="product-delivery-check-button" class="btn btn-secondary" type="submit">Check availability</button>
      </div>
    </div>
  </form>
  <div id="product-delivery-estimate-result" class="delhivery-estimator-result" role="status" aria-live="polite" hidden></div>
</section>
"""


def asset_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def pages_to_scan():
    for language in LANGUAGES:
        yield from (ROOT / language / "products").glob("*.html")
        yield ROOT / language / "cart.html"


def ensure_product_panel(source: str, path: Path) -> str:
    if 'id="product-delivery-estimator"' in source:
        return source
    updated, count = PDP_ACTIONS_TAG.subn(PDP_PANEL + r"\1", source, count=1)
    if not count:
        raise RuntimeError(
            f"{path.relative_to(ROOT)} is a product page but has no pdp-actions insertion point"
        )
    return updated


def sync_page(path: Path) -> bool:
    source = path.read_text(encoding="utf-8")
    is_product = 'id="product-detail"' in source
    is_cart = path.name == "cart.html" and 'id="purchase-cart-root"' in source
    if not is_product and not is_cart:
        return False

    updated = ensure_product_panel(source, path) if is_product and not is_cart else source

    # Replace old estimator tags and write exactly one correct runtime per page.
    updated, _ = SCRIPT_TAG.subn("", updated)
    updated, _ = STYLE_TAG.subn("", updated)

    script_path = PRODUCT_SCRIPT if is_product and not is_cart else CART_SCRIPT
    script_url = PRODUCT_SCRIPT_URL if is_product and not is_cart else CART_SCRIPT_URL
    script_tag = f'<script defer src="{script_url}?v={asset_hash(script_path)}"></script>'
    body_close = re.search(r"</body\s*>", updated, flags=re.I)
    if not body_close:
        raise RuntimeError(f"{path.relative_to(ROOT)} has no closing body tag")
    updated = updated[:body_close.start()] + "  " + script_tag + "\n" + updated[body_close.start():]

    style_tag = f'<link rel="stylesheet" href="{STYLE_URL}?v={asset_hash(STYLE_PATH)}">'
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
        raise FileNotFoundError("Missing delivery estimator assets: " + ", ".join(missing))
    changed = sum(1 for path in sorted(pages_to_scan()) if path.is_file() and sync_page(path))
    print(f"Delivery estimator assets synchronized: {changed} product/cart pages changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
