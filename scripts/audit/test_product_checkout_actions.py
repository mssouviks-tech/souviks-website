#!/usr/bin/env python3
"""Contract tests for consistent checkout actions in every product-card context."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from product_card import product_card_html  # noqa: E402
from sync_product_actions import render_actions, replace_actions  # noqa: E402


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

    print("Product checkout action contract passed for priced and unpriced products in en/hi/bn.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
