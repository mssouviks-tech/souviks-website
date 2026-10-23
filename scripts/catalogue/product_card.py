#!/usr/bin/env python3
"""Canonical static product-card renderer used by all catalogue page generators."""

from __future__ import annotations

import html
import math
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[2]

LABELS = {
    "en": {"part": "Part No.", "request": "Get current price", "purchase": "Add to Cart", "quantity": "Quantity", "decrease": "Decrease quantity", "increase": "Increase quantity", "request_part": "Request a Part"},
    "hi": {"part": "Part No.", "request": "वर्तमान कीमत प्राप्त करें", "purchase": "कार्ट में जोड़ें", "quantity": "मात्रा", "decrease": "मात्रा घटाएँ", "increase": "मात्रा बढ़ाएँ", "request_part": "पार्ट का अनुरोध"},
    "bn": {"part": "Part No.", "request": "বর্তমান মূল্য জানুন", "purchase": "কার্টে যোগ করুন", "quantity": "পরিমাণ", "decrease": "পরিমাণ কমান", "increase": "পরিমাণ বাড়ান", "request_part": "পার্টের অনুরোধ"},
}


def clean(value) -> str:
    return str(value or "").strip()


def esc(value) -> str:
    return html.escape(clean(value), quote=True)


def format_money(value) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""
    if abs(number - round(number)) < 0.00001:
        return f"₹{int(round(number)):,}"
    return f"₹{number:,.2f}".rstrip("0").rstrip(".")


def first_image(product: dict) -> tuple[str, str, str, str]:
    """Return a real catalogue image, otherwise an explicit shared placeholder."""
    folder = clean(product.get("image_folder") or product.get("id"))
    gallery = product.get("gallery") or []
    dimensions = product.get("gallery_dimensions") or {}

    filename = ""
    if isinstance(gallery, list) and gallery:
        first = gallery[0]
        if isinstance(first, dict):
            filename = clean(first.get("filename") or first.get("file") or first.get("name"))
        else:
            filename = clean(first)

    if not filename:
        raw = clean(product.get("image") or product.get("primary_image"))
        filename = raw.rsplit("/", 1)[-1] if raw else ""

    if filename and folder:
        candidate = ROOT / "assets" / "images" / "products" / folder / filename
        if candidate.is_file():
            dim = dimensions.get(filename) if isinstance(dimensions, dict) else None
            if not dim and filename.rsplit(".", 1)[0] in dimensions:
                dim = dimensions.get(filename.rsplit(".", 1)[0])
            if isinstance(dim, (list, tuple)) and len(dim) >= 2:
                width, height = dim[0], dim[1]
            else:
                width = product.get("image_width") or 400
                height = product.get("image_height") or 400
            thumbnail = (
                ROOT
                / "assets"
                / "images"
                / "product-thumbnails"
                / folder
                / f"{Path(filename).stem}.webp"
            )
            image_url = (
                f"/assets/images/product-thumbnails/{folder}/{Path(filename).stem}.webp"
                if thumbnail.is_file()
                else f"/assets/images/products/{folder}/{filename}"
            )
            return (
                image_url,
                str(width),
                str(height),
                "catalogue",
            )

    return "/assets/images/placeholder.webp", "1200", "1200", "missing"


def positive_price(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number > 0 else None


def request_part_url(product: dict, lang: str) -> str:
    params = {
        "product_id": clean(product.get("id")),
        "part_number": clean(product.get("part_number") or product.get("partNumber")),
        "product_name": clean(product.get("product_name") or product.get("name")),
        "brand": clean(product.get("brand_name") or product.get("brand")),
    }
    query = urlencode({key: value for key, value in params.items() if value})
    return f"/{lang}/request-part" + (f"?{query}" if query else "")


def product_card_html(product: dict, lang: str, *, eager: bool = False) -> str:
    if lang not in LABELS:
        raise ValueError(f"Unsupported language: {lang}")

    labels = LABELS[lang]
    slug = clean(product.get("slug"))
    pid = clean(product.get("id"))
    name = clean(product.get("product_name") or product.get("name"))
    brand = clean(product.get("brand_name") or product.get("brand"))
    part = clean(product.get("part_number") or product.get("partNumber"))
    img, width, height, image_state = first_image(product)
    image_alt = name if image_state == "catalogue" else f"Product image unavailable for {name}"

    selling = positive_price(product.get("selling_price"))
    mrp_number = positive_price(product.get("mrp"))
    price = format_money(selling) if selling is not None else ""
    mrp = format_money(mrp_number) if mrp_number is not None else ""
    discount = ""
    if selling is not None and mrp_number is not None and mrp_number > selling:
        discount = str(round((mrp_number - selling) / mrp_number * 100))

    if selling is not None and mrp and discount:
        price_html = (
            '<div class="product-price product-price-sale" aria-label="Sale price">'
            f'<span class="product-price-current">{esc(price)}</span>'
            f'<span class="product-price-mrp">MRP {esc(mrp)}</span>'
            f'<span class="product-price-discount">{esc(discount)}% OFF</span>'
            "</div>"
        )
    elif selling is not None:
        price_html = (
            '<div class="product-price" aria-label="Price">'
            f'<span class="product-price-current">{esc(price)}</span>'
            "</div>"
        )
    elif mrp:
        price_html = (
            '<div class="product-price product-price-on-request" aria-label="Reference MRP; current price on request">'
            f'<span class="product-price-mrp">MRP {esc(mrp)}</span>'
            f'<span class="product-price-request">{esc(labels["request"])}</span>'
            "</div>"
        )
    else:
        price_html = (
            '<div class="product-price product-price-on-request" aria-label="Price">'
            f'{esc(labels["request"])}</div>'
        )

    is_active = product.get("active") is not False
    action_html = ""
    if pid and is_active and selling is not None:
        action_html = (
            '<div class="product-card-purchase-controls">'
            '<div class="product-card-quantity" data-product-quantity-controls '
            f'aria-label="{esc(labels["quantity"])}">'
            f'<button type="button" class="product-card-qty-button" data-product-qty-decrease '
            f'aria-label="{esc(labels["decrease"])}">−</button>'
            f'<input type="number" class="product-card-qty-input" data-product-quantity '
            f'min="1" max="9999" step="1" value="1" inputmode="numeric" '
            f'aria-label="{esc(labels["quantity"])}">'
            f'<button type="button" class="product-card-qty-button" data-product-qty-increase '
            f'aria-label="{esc(labels["increase"])}">+</button>'
            '</div>'
            f'<button type="button" class="btn btn-secondary add-to-purchase-cart" data-id="{esc(pid)}" '
            f'data-part="{esc(part)}" data-name="{esc(name)}" data-brand="{esc(brand)}" '
            f'aria-label="Add {esc(name)} to cart">{esc(labels["purchase"])}</button>'
            '</div>'
        )
    elif pid and is_active:
        action_html = (
            f'<a class="btn btn-primary product-request-part-link" href="{esc(request_part_url(product, lang))}" '
            f'aria-label="Request a part: {esc(name)}">{esc(labels["request_part"])}</a>'
        )

    part_html = (
        f'<div class="product-part-number">Part No. <strong>{esc(part)}</strong></div>'
        if part
        else (
            '<div class="product-part-number product-part-number-empty">'
            f'{esc(labels["part"])} on request</div>'
        )
    )
    aria = esc(f"View {name}")
    loading = "eager" if eager else "lazy"
    priority = ' fetchpriority="high"' if eager else ""

    return (
        f'<article class="product-card"><div class="product-image">'
        f'<a href="/{lang}/products/{esc(slug)}" class="product-link" aria-label="{aria}">'
        f'<img loading="{loading}"{priority} class="product-image-file" '
        f'data-image-state="{esc(image_state)}" src="{esc(img)}" alt="{esc(image_alt)}" '
        f'decoding="async" draggable="false" width="{esc(width)}" height="{esc(height)}"></a>'
        f'<button type="button" class="product-save-button" data-saved-product-id="{esc(pid)}" '
        'data-saved="false" aria-pressed="false" aria-label="Save product">'
        '<span data-saved-icon aria-hidden="true">♡</span></button></div>'
        f'<div class="product-content"><div class="product-brand-label">{esc(brand)}</div>'
        f'{part_html}<h3 class="product-title"><a href="/{lang}/products/{esc(slug)}">'
        f"{esc(name)}</a></h3>{price_html}{action_html}</div></article>"
    )
