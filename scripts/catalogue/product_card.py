#!/usr/bin/env python3
"""Canonical static product-card renderer used by all catalogue page generators."""

from __future__ import annotations

import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

LABELS = {
    "en": {"part": "Part No.", "request": "Get current price", "add": "Add To RFQ"},
    "hi": {"part": "Part No.", "request": "वर्तमान कीमत प्राप्त करें", "add": "RFQ में जोड़ें"},
    "bn": {"part": "Part No.", "request": "বর্তমান মূল্য জানুন", "add": "RFQ-তে যোগ করুন"},
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

    price = format_money(product.get("selling_price"))
    mrp = format_money(product.get("mrp"))
    discount = ""
    try:
        selling = float(product.get("selling_price"))
        mrp_number = float(product.get("mrp"))
        if selling > 0 and mrp_number > selling:
            discount = str(round((mrp_number - selling) / mrp_number * 100))
    except (TypeError, ValueError, ZeroDivisionError):
        pass

    if price and mrp and discount:
        price_html = (
            '<div class="product-price product-price-sale" aria-label="Sale price">'
            f'<span class="product-price-current">{esc(price)}</span>'
            f'<span class="product-price-mrp">MRP {esc(mrp)}</span>'
            f'<span class="product-price-discount">{esc(discount)}% OFF</span>'
            "</div>"
        )
    elif price:
        price_html = (
            '<div class="product-price product-price-current" aria-label="Price">'
            f"{esc(price)}</div>"
        )
    else:
        price_html = (
            '<div class="product-price product-price-on-request" aria-label="Price">'
            f"{esc(labels['request'])}</div>"
        )

    part_html = (
        f'<div class="product-part-number">Part No. <strong>{esc(part)}</strong></div>'
        if part
        else (
            f'<div class="product-part-number product-part-number-empty">'
            f"{esc(labels['part'])} on request</div>"
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
        f"{esc(name)}</a></h3>{price_html}"
        f'<button type="button" class="btn btn-primary add-to-cart" data-id="{esc(pid)}" '
        f'data-part="{esc(part)}" data-name="{esc(name)}" data-brand="{esc(brand)}" '
        f'aria-label="Add {aria} to RFQ">{labels["add"]}</button></div></article>'
    )
