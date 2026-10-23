#!/usr/bin/env python3
"""Render product-detail actions from canonical selling-price availability.

Priced products use the same checkout-cart controls as all product cards.
Unpriced products link to Request a Part with their catalogue identity prefilled.
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
DATA_RE = re.compile(
    r"window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});",
    flags=re.S,
)
ACTIONS_RE = re.compile(
    r"""<div\b(?=[^>]*\bclass=["'][^"']*\bpdp-actions\b[^"']*["'])[^>]*>""",
    flags=re.I | re.S,
)
DIV_RE = re.compile(r"</?div\b[^>]*>", flags=re.I)
REQUEST_LABELS = {
    "en": "Request a Part",
    "hi": "पार्ट का अनुरोध",
    "bn": "পার্টের অনুরোধ",
}
CART_LABELS = {
    "en": "Add to Cart",
    "hi": "कार्ट में जोड़ें",
    "bn": "কার্টে যোগ করুন",
}
QUANTITY_LABELS = {
    "en": ("Quantity", "Decrease quantity", "Increase quantity"),
    "hi": ("मात्रा", "मात्रा घटाएँ", "मात्रा बढ़ाएँ"),
    "bn": ("পরিমাণ", "পরিমাণ কমান", "পরিমাণ বাড়ান"),
}


def clean(value) -> str:
    return str(value or "").strip()


def esc(value) -> str:
    return html.escape(clean(value), quote=True)


def positive_price(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 and number < float("inf") else None


def request_part_url(product: dict, language: str) -> str:
    fields = {
        "product_id": clean(product.get("id")),
        "part_number": clean(product.get("part_number") or product.get("partNumber")),
        "product_name": clean(product.get("product_name") or product.get("name")),
        "brand": clean(product.get("brand_name") or product.get("brand")),
    }
    query = urlencode({key: value for key, value in fields.items() if value})
    return f"/{language}/request-part" + (f"?{query}" if query else "")


def render_actions(product: dict, language: str) -> str:
    product_id = clean(product.get("id"))
    part = clean(product.get("part_number") or product.get("partNumber"))
    name = clean(product.get("product_name") or product.get("name"))
    brand = clean(product.get("brand_name") or product.get("brand"))
    selling_price = positive_price(product.get("selling_price"))

    if product_id and product.get("active") is not False and selling_price is not None:
        quantity, decrease, increase = QUANTITY_LABELS[language]
        return (
            '<div class="pdp-qty" data-product-quantity-controls>'
            f'<button type="button" class="pdp-qty-minus" data-product-qty-decrease aria-label="{esc(decrease)}">−</button>'
            f'<label class="sr-only" for="pdpQty">{esc(quantity)}</label>'
            '<input id="pdpQty" data-product-quantity type="number" min="1" max="9999" step="1" '
            f'value="1" inputmode="numeric" aria-label="{esc(quantity)}">'
            f'<button type="button" class="pdp-qty-plus" data-product-qty-increase aria-label="{esc(increase)}">+</button>'
            '</div>'
            f'<button type="button" class="btn btn-secondary add-to-purchase-cart pdp-add-to-purchase-cart" '
            f'data-id="{esc(product_id)}" data-part="{esc(part)}" data-name="{esc(name)}" data-brand="{esc(brand)}" '
            f'aria-label="Add {esc(name)} to cart">{esc(CART_LABELS[language])}</button>'
        )

    if product_id and product.get("active") is not False:
        label = REQUEST_LABELS[language]
        return (
            f'<a class="btn btn-primary product-request-part-link pdp-request-part-link" '
            f'href="{esc(request_part_url(product, language))}" '
            f'aria-label="Request a part: {esc(name)}">{esc(label)}</a>'
        )
    return '<span class="pdp-price-label">Product currently unavailable</span>'


def replace_actions(source: str, actions: str) -> str:
    opening = ACTIONS_RE.search(source)
    if not opening:
        raise ValueError("Missing .pdp-actions container")

    depth = 1
    closing_start = None
    for match in DIV_RE.finditer(source, opening.end()):
        token = match.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                closing_start = match.start()
                break
        elif not token.rstrip().endswith("/>"):
            depth += 1

    if closing_start is None:
        raise ValueError("Unclosed .pdp-actions container")

    return source[:opening.end()] + actions + source[closing_start:]


def main() -> int:
    catalogue_path = ROOT / "assets" / "data" / "catalogue-index.json"
    records = json.loads(catalogue_path.read_text(encoding="utf-8"))
    products_by_id = {
        clean(item.get("id")): item
        for item in records
        if isinstance(item, dict) and item.get("id")
    }

    updated = 0
    checked = 0
    for language in LANGUAGES:
        directory = ROOT / language / "products"
        if not directory.is_dir():
            raise FileNotFoundError(f"Missing language product directory: {directory}")

        for path in sorted(directory.glob("*.html")):
            source = path.read_text(encoding="utf-8")
            match = DATA_RE.search(source)
            if not match:
                continue
            try:
                embedded = json.loads(match.group(1))
            except json.JSONDecodeError as error:
                raise ValueError(f"{path.relative_to(ROOT)}: invalid embedded product data") from error

            product_id = clean(embedded.get("id"))
            product = products_by_id.get(product_id)
            if not product:
                continue

            actions = render_actions(product, language)
            result = replace_actions(source, actions)
            checked += 1
            if result != source:
                path.write_text(result, encoding="utf-8")
                updated += 1

    print(
        "Product-detail actions synchronized from the canonical catalogue: "
        f"{updated} pages updated; {checked} checked across en/hi/bn."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
