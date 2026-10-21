#!/usr/bin/env python3
"""Keep the Delhivery estimator loaded on every generated product-detail page."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
SCRIPT_PATH = ROOT / "assets/js/product/delivery-estimate.js"
STYLE_PATH = ROOT / "assets/css/delhivery-estimator.css"
SCRIPT_URL = "/assets/js/product/delivery-estimate.js"
STYLE_URL = "/assets/css/delhivery-estimator.css"
SCRIPT_TAG = re.compile(
    r'<script\b(?=[^>]*\bsrc=["\']/assets/js/product/delivery-estimate\.js(?:\?v=[^"\']*)?["\'])[^>]*></script>',
    flags=re.I,
)
STYLE_TAG = re.compile(
    r'<link\b(?=[^>]*\bhref=["\']/assets/css/delhivery-estimator\.css(?:\?v=[^"\']*)?["\'])[^>]*>',
    flags=re.I,
)


def asset_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def product_pages():
    for language in LANGUAGES:
        yield from (ROOT / language / "products").glob("*.html")


def sync_page(path: Path) -> bool:
    source = path.read_text(encoding="utf-8")
    if 'id="product-detail"' not in source:
        return False

    script_tag = f'<script defer src="{SCRIPT_URL}?v={asset_hash(SCRIPT_PATH)}"></script>'
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
    if not SCRIPT_PATH.is_file() or not STYLE_PATH.is_file():
        raise FileNotFoundError("Delhivery estimator script or stylesheet is missing")
    changed = sum(1 for page in sorted(product_pages()) if page.is_file() and sync_page(page))
    print(f"Delhivery estimator assets synchronized: {changed} product pages changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
