#!/usr/bin/env python3
"""Regenerate entity sitemaps from the active catalogue projections."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://www.souviks.co.in"
LANGUAGES = ("en", "bn", "hi")


def load(name: str):
    return json.loads((ROOT / "assets" / "data" / name).read_text(encoding="utf-8"))


def clean(value) -> str:
    return str(value or "").strip()


def write_sitemap(filename: str, routes: list[str]) -> None:
    body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for route in routes:
        body.extend(["  <url>", f"    <loc>{BASE}{route}</loc>", "  </url>"])
    body.append("</urlset>")
    (ROOT / "sitemaps" / filename).write_text("\n".join(body) + "\n", encoding="utf-8")


def main() -> None:
    brands = [b for b in load("brands.json") if b.get("active") is not False and clean(b.get("slug"))]
    categories = [c for c in load("categories.json") if c.get("active") is not False and clean(c.get("slug"))]
    vehicles = [v for v in load("vehicles.json") if v.get("active") is not False and clean(v.get("slug"))]
    products = [p for p in load("catalogue-index.json") if p.get("active") is not False and clean(p.get("slug"))]

    entity_sets = {
        "brands.xml": ("brands", brands),
        "categories.xml": ("categories", categories),
        # Vehicle pages with <=5 catalogue products are intentionally noindex.
        "vehicles.xml": ("vehicles", [v for v in vehicles if len(v.get("products") or []) > 5]),
    }

    for filename, (kind, records) in entity_sets.items():
        routes = [
            f"/{lang}/{kind}/{clean(record.get('slug'))}"
            for lang in LANGUAGES
            for record in records
        ]
        write_sitemap(filename, routes)

    print(
        "Entity sitemaps synchronized: "
        f"{len(brands)} brands, {len(categories)} categories, "
        f"{len(vehicles)} vehicles ({len([v for v in vehicles if len(v.get('products') or []) > 5])} indexable), "
        f"{len(products)} products."
    )


if __name__ == "__main__":
    main()
