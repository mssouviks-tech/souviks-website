#!/usr/bin/env python3
"""Contract tests for consistent checkout actions in every product-card context."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from product_card import product_card_html  # noqa: E402
from sync_product_actions import render_actions, replace_actions  # noqa: E402

HOME_TRACK_OPEN_RE = re.compile(
    r'''<div\b(?=[^>]*\bclass=["'][^"']*\bhome-product-track\b[^"']*["'])[^>]*>''',
    flags=re.I,
)
DIV_RE = re.compile(r'''</?div\b[^>]*>''', flags=re.I)
CARD_ID_RE = re.compile(r'''data-saved-product-id=["']([^"']+)["']''', flags=re.I)


def extract_div_content(source: str, opening: re.Match[str], label: str) -> str:
    depth = 1
    for match in DIV_RE.finditer(source, opening.end()):
        token = match.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                return source[opening.end():match.start()]
        elif not token.rstrip().endswith("/>"):
            depth += 1
    raise AssertionError(f"{label}: unclosed container")


def has_selling_price(product: dict) -> bool:
    try:
        return float(product.get("selling_price")) > 0
    except (TypeError, ValueError):
        return False


def verify_homepage_cards() -> None:
    catalogue = json.loads(
        (ROOT / "assets" / "data" / "catalogue-index.json").read_text(encoding="utf-8")
    )
    products_by_id = {
        str(product.get("id") or "").strip(): product
        for product in catalogue
        if isinstance(product, dict) and str(product.get("id") or "").strip()
    }
    paths = [
        ("en", ROOT / "en" / "index.html"),
        ("hi", ROOT / "hi" / "index.html"),
        ("bn", ROOT / "bn" / "index.html"),
        ("root", ROOT / "index.html"),
    ]
    reference_ids = None

    for language, path in paths:
        require(path.is_file(), f"{language}: homepage file is missing")
        source = path.read_text(encoding="utf-8")
        opening = HOME_TRACK_OPEN_RE.search(source)
        require(opening is not None, f"{language}: homepage has no featured-product track")
        track = extract_div_content(source, opening, f"{language} homepage featured-product track")
        ids = CARD_ID_RE.findall(track)
        require(bool(ids), f"{language}: homepage has no featured product cards")
        require(len(ids) == len(set(ids)), f"{language}: featured product IDs are duplicated")

        if reference_ids is None:
            reference_ids = ids
        else:
            require(ids == reference_ids, f"{language}: featured products differ from the English homepage")

        featured = []
        for product_id in ids:
            product = products_by_id.get(product_id)
            require(product is not None, f"{language}: featured product {product_id} is missing from catalogue")
            require(product.get("active") is not False, f"{language}: inactive product {product_id} is featured")
            featured.append(product)

        priced_count = sum(has_selling_price(product) for product in featured)
        unpriced_count = len(featured) - priced_count
        cart_count = len(re.findall(r'''class=["'][^"']*\badd-to-purchase-cart\b[^"']*["']''', track, re.I))
        quantity_count = len(re.findall(r'''class=["'][^"']*\bproduct-card-quantity\b[^"']*["']''', track, re.I))
        request_count = len(re.findall(r'''class=["'][^"']*\bproduct-request-part-link\b[^"']*["']''', track, re.I))
        legacy_count = len(re.findall(r'''class=["'][^"']*\badd-to-cart\b[^"']*["']''', track, re.I))

        require(cart_count == priced_count, f"{language}: expected {priced_count} checkout Cart actions, found {cart_count}")
        require(quantity_count == priced_count, f"{language}: every priced card must expose quantity controls")
        require(request_count == unpriced_count, f"{language}: expected {unpriced_count} Request a Part actions, found {request_count}")
        require(legacy_count == 0, f"{language}: homepage still exposes legacy RFQ action(s)")





def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


BASE_PRODUCT = {
    "id": "SVKS_TEST_001",
    "slug": "test-product",
    "product_name": "Test Product",
    "brand_name": "Test Brand",
    "part_number": "TEST-001",
    "active": True,
    "mrp": 120,
    "selling_price": 100,
}



def main() -> int:
    dynamic_pdp = (ROOT / "assets" / "js" / "product" / "products.js").read_text(encoding="utf-8")
    require("pdp-rfq-btn" not in dynamic_pdp, "dynamic product detail script still creates an RFQ action")
    require("pdp-remove-btn" not in dynamic_pdp, "dynamic product detail script still creates the legacy RFQ remove control")
    require("RFQ.setQuantity(product.id" not in dynamic_pdp, "dynamic product detail still writes to the RFQ basket")
    require("pdp-add-to-purchase-cart" in dynamic_pdp, "dynamic priced PDP does not expose checkout Cart")
    require("pdp-request-part-link" in dynamic_pdp, "dynamic unpriced PDP does not request a part directly")

    for language in ("en", "hi", "bn"):
        card = product_card_html(BASE_PRODUCT, language)
        require('add-to-purchase-cart"' in card, f"{language}: priced card is missing Add to Cart")
        require("product-card-purchase-controls" in card, f"{language}: priced card is missing quantity controls")
        require('class="add-to-cart"' not in card, f"{language}: priced card still exposes RFQ")
        require("product-request-part-link" not in card, f"{language}: priced card incorrectly requests a quote")

        detail = render_actions(BASE_PRODUCT, language)
        require("pdp-add-to-purchase-cart" in detail, f"{language}: priced product detail lacks Add to Cart")
        require('class="pdp-qty-minus"' in detail, f"{language}: detail quantity selector is missing")
        require("pdp-rfq-btn" not in detail, f"{language}: detail still exposes its legacy RFQ action")

        skeleton = (
            'window.SOUVIKS_PRODUCT_PAGE_DATA = {"id":"SVKS_TEST_001"};'
            '<div class="pdp-actions"><div class="pdp-qty"><input id="pdpQty"></div>'
            '<button class="pdp-rfq-btn">Add To RFQ</button></div>'
        )
        page = replace_actions(skeleton, detail)
        require("pdp-rfq-btn" not in page, f"{language}: page rewrite retained the RFQ control")
        require(page.count("pdp-add-to-purchase-cart") == 1, f"{language}: page rewrite did not add exactly one cart control")

        unpriced = dict(BASE_PRODUCT)
        unpriced.pop("selling_price")
        request_card = product_card_html(unpriced, language)
        require("product-request-part-link" in request_card, f"{language}: unpriced card lacks Request a Part")
        require("/" + language + "/request-part?" in request_card, f"{language}: request link does not lead to Request a Part")
        require("product-card-purchase-controls" not in request_card, f"{language}: unpriced product can be purchased without a selling price")
        require('class="add-to-cart"' not in request_card, f"{language}: unpriced product still enters the RFQ basket")

        request_detail = render_actions(unpriced, language)
        require("pdp-request-part-link" in request_detail, f"{language}: unpriced PDP lacks Request a Part")
        require("pdp-add-to-purchase-cart" not in request_detail, f"{language}: unpriced PDP can enter checkout")

    verify_homepage_cards()

    print("Product checkout action contract passed for priced and unpriced products in en/hi/bn.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
