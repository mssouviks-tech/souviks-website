#!/usr/bin/env python3
"""Regenerate the main catalogue grid from the canonical product-card renderer."""

from __future__ import annotations

import json
import re
from pathlib import Path

from product_card import product_card_html

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
INITIAL_PAGE_SIZE = 20

GRID_OPEN_RE = re.compile(
    r'''<div\b[^>]*\bid=["']product-grid["'][^>]*>''',
    flags=re.I,
)
DIV_RE = re.compile(r'''</?div\b[^>]*>''', flags=re.I)


def load_products() -> list[dict]:
    path = ROOT / "assets/data/catalogue-index.json"
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("catalogue-index.json must contain an array")

    products = [
        item
        for item in records
        if isinstance(item, dict)
        and item.get("active") is not False
        and item.get("id")
    ]
    if not products:
        raise ValueError("No active catalogue products found")
    return products


def replace_grid(source: str, cards: str) -> str:
    match = GRID_OPEN_RE.search(source)
    if not match:
        raise ValueError("Missing #product-grid element")

    depth = 1
    close_start = None
    close_end = None

    for div_match in DIV_RE.finditer(source, match.end()):
        token = div_match.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                close_start = div_match.start()
                close_end = div_match.end()
                break
        elif not token.rstrip().endswith("/>"):
            depth += 1

    if close_start is None or close_end is None:
        raise ValueError("Unclosed #product-grid element")

    opening = match.group(0)
    static_attr = re.compile(r"""\\bdata-static-rendered\\s*=\\s*(["']).*?\\1""", flags=re.I)
    if static_attr.search(opening):
        opening = static_attr.sub('data-static-rendered="true"', opening, count=1)
    else:
        opening = opening[:-1] + ' data-static-rendered="true">'
    rendered = f"{opening}\n{cards}\n</div>"
    return source[:match.start()] + rendered + source[close_end:]


def sync_listing(language: str, products: list[dict]) -> bool:
    path = ROOT / language / "products.html"
    if not path.is_file():
        raise ValueError(f"Missing products listing: {path.relative_to(ROOT)}")

    cards = "".join(
        product_card_html(product, language, eager=index < 4)
        for index, product in enumerate(products[:INITIAL_PAGE_SIZE])
    )
    source = path.read_text(encoding="utf-8")
    updated = replace_grid(source, cards)

    if updated != source:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> int:
    products = load_products()
    changed = sum(
        sync_listing(language, products)
        for language in LANGUAGES
    )

    print(
        "Product-card source synchronized from "
        "scripts/catalogue/product_card.py: "
        f"{min(INITIAL_PAGE_SIZE, len(products))} initial cards per language "
        f"from {len(products)} active products; {changed} listing pages changed."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
