#!/usr/bin/env python3
"""Validate generated JSON-LD, canonical alignment and Product data parity."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://www.souviks.co.in"
CANONICAL_RE = re.compile(r'<link\b[^>]*\brel=["\']canonical["\'][^>]*\bhref=["\']([^"\']+)["\']', re.I | re.S)
JSONLD_RE = re.compile(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.I | re.S)
PRODUCT_DATA_RE = re.compile(r'window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});', re.I | re.S)


def fail(errors: list[str]) -> None:
    if not errors:
        return
    print("\n".join(errors[:300]))
    if len(errors) > 300:
        print(f"... and {len(errors) - 300} more errors")
    raise SystemExit(1)


def load_catalogue() -> dict[str, dict]:
    path = ROOT / "assets/data/catalogue-index.json"
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        raise SystemExit(f"Empty catalogue file: {path}")
    rows = json.loads(raw)
    return {str(row.get("id")).strip(): row for row in rows if row.get("id") and row.get("active") is not False}


def schema_nodes(obj):
    graph = obj.get("@graph") if isinstance(obj, dict) else None
    if isinstance(graph, list):
        return [node for node in graph if isinstance(node, dict)]
    return [obj] if isinstance(obj, dict) else []


def schema_types(node: dict) -> set[str]:
    value = node.get("@type")
    if isinstance(value, list):
        return {str(item) for item in value}
    return {str(value)} if value else set()


def normalize_url(value: str) -> str:
    value = value.strip()
    if value.endswith("/") and value != f"{BASE}/":
        return value.rstrip("/")
    return value


def page_path_info(path: Path):
    parts = path.relative_to(ROOT).parts
    if len(parts) == 3 and parts[0] in {"en", "hi", "bn"} and parts[1] == "products":
        return parts[0], Path(parts[2]).stem
    return None, None


def expected_image(product: dict) -> str:
    image_url = str(product.get("image_url") or "").strip()
    if image_url and not image_url.endswith("/placeholder.webp"):
        return BASE + image_url if image_url.startswith("/") else image_url
    folder = str(product.get("image_folder") or product.get("id") or "").strip()
    gallery = product.get("gallery") or []
    if folder and gallery:
        return f"{BASE}/assets/images/products/{folder}/{gallery[0]}"
    return ""


def validate_breadcrumb_node(path: Path, node: dict, canonical: str, errors: list[str]) -> None:
    items = node.get("itemListElement")
    if not isinstance(items, list) or not items:
        errors.append(f"{path}: BreadcrumbList.itemListElement must be a non-empty array")
        return

    for expected_position, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            errors.append(f"{path}: BreadcrumbList item {expected_position} is not an object")
            continue
        if item.get("@type") != "ListItem":
            errors.append(f"{path}: BreadcrumbList item {expected_position} is not a ListItem")
        if item.get("position") != expected_position:
            errors.append(
                f"{path}: BreadcrumbList position {item.get('position')!r} != {expected_position}"
            )
        if not str(item.get("name") or "").strip():
            errors.append(f"{path}: BreadcrumbList item {expected_position} has no name")
        item_url = item.get("item")
        if item_url is not None:
            if not isinstance(item_url, str) or not item_url.startswith(BASE):
                errors.append(
                    f"{path}: BreadcrumbList item {expected_position} has invalid item URL: {item_url!r}"
                )

    last_item = items[-1] if isinstance(items[-1], dict) else {}
    last_url = last_item.get("item")
    if canonical and isinstance(last_url, str) and normalize_url(last_url) != normalize_url(canonical):
        errors.append(f"{path}: BreadcrumbList last item {last_url!r} != canonical {canonical!r}")


def walk_schema_images(value):
    found: list[str] = []
    if isinstance(value, dict):
        image = value.get("image")
        if isinstance(image, str):
            found.append(image)
        elif isinstance(image, list):
            found.extend(str(item) for item in image if item)
        for child in value.values():
            if isinstance(child, (dict, list)):
                found.extend(walk_schema_images(child))
    elif isinstance(value, list):
        for child in value:
            if isinstance(child, (dict, list)):
                found.extend(walk_schema_images(child))
    return found


def validate_html(path: Path, catalogue: dict[str, dict], errors: list[str], images: set[str]):
    html = path.read_text(encoding="utf-8", errors="ignore")
    blocks = JSONLD_RE.findall(html)
    if not blocks:
        return

    canonical_match = CANONICAL_RE.search(html)
    canonical = canonical_match.group(1).strip() if canonical_match else ""

    page_lang, slug = page_path_info(path)
    expected_product = None
    if page_lang and slug:
        expected_product = next((p for p in catalogue.values() if str(p.get("slug") or "").strip() == slug), None)

    product_nodes = []
    breadcrumb_nodes = []

    for index, block in enumerate(blocks, start=1):
        try:
            obj = json.loads(block.strip())
        except json.JSONDecodeError as exc:
            errors.append(f"{path}: invalid JSON-LD block {index}: {exc}")
            continue

        images.update(
            url for url in walk_schema_images(obj)
            if isinstance(url, str) and url.startswith(("http://", "https://"))
        )

        for node in schema_nodes(obj):
            types = schema_types(node)
            if "Product" in types:
                product_nodes.append(node)
            if "BreadcrumbList" in types:
                breadcrumb_nodes.append(node)

            if types.intersection({"Product", "WebPage", "CollectionPage", "AboutPage", "ContactPage", "SearchResultsPage"}):
                for field in ("url", "mainEntityOfPage"):
                    value = node.get(field)
                    if isinstance(value, str) and value.startswith(BASE):
                        if not canonical:
                            errors.append(f"{path}: schema {field} has no canonical to compare against")
                        elif normalize_url(value) != normalize_url(canonical):
                            errors.append(f"{path}: schema {field} {value!r} != canonical {canonical!r}")
                node_id = node.get("@id")
                if isinstance(node_id, str) and node_id.startswith(BASE):
                    id_base = node_id.split("#", 1)[0]
                    if canonical and normalize_url(id_base) != normalize_url(canonical):
                        errors.append(f"{path}: schema @id {node_id!r} does not resolve to canonical {canonical!r}")

    if not expected_product:
        return

    if not breadcrumb_nodes:
        errors.append(f"{path}: missing BreadcrumbList schema")
    else:
        for breadcrumb_node in breadcrumb_nodes:
            validate_breadcrumb_node(path, breadcrumb_node, canonical, errors)

    if len(product_nodes) != 1:
        errors.append(f"{path}: expected exactly one Product schema node, found {len(product_nodes)}")
        if not product_nodes:
            return

    product_node = product_nodes[0]
    expected_name = str(expected_product.get("product_name") or expected_product.get("name") or "").strip()
    schema_name = str(product_node.get("name") or "").strip()
    if not schema_name:
        errors.append(f"{path}: Product.name is missing")
    if expected_name and schema_name != expected_name:
        errors.append(f"{path}: Product schema name {schema_name!r} != catalogue {expected_name!r}")

    product_images = product_node.get("image")
    if not product_images or (isinstance(product_images, list) and not any(str(item).strip() for item in product_images)):
        errors.append(f"{path}: Product.image is missing or empty")

    sku = str(product_node.get("sku") or "").strip()
    if not sku:
        errors.append(f"{path}: Product.sku is missing")

    brand = product_node.get("brand")
    if not isinstance(brand, dict) or not str(brand.get("name") or "").strip():
        errors.append(f"{path}: Product.brand.name is missing")

    expected_offer_price = expected_product.get("selling_price")
    offers = product_node.get("offers")
    if offers is None and expected_offer_price not in (None, ""):
        errors.append(f"{path}: catalogue has selling_price but Product offers is missing")
    if isinstance(offers, dict):
        schema_price = offers.get("price")
        if offers.get("priceCurrency") != "INR":
            errors.append(f"{path}: Offer.priceCurrency must be INR")
        if expected_offer_price is None or str(expected_offer_price).strip() == "":
            errors.append(f"{path}: Offer exists without a current selling price in catalogue")
        else:
            try:
                if abs(float(schema_price) - float(expected_offer_price)) > 0.01:
                    errors.append(f"{path}: Offer price {schema_price!r} != catalogue selling_price {expected_offer_price!r}")
            except (TypeError, ValueError):
                errors.append(f"{path}: Offer price is not numeric: {schema_price!r}")

        if "availability" in offers and not expected_product.get("availability"):
            errors.append(f"{path}: Offer declares availability without a catalogue availability field")

        offer_url = offers.get("url")
        if isinstance(offer_url, str) and canonical and normalize_url(offer_url) != normalize_url(canonical):
            errors.append(f"{path}: Offer.url {offer_url!r} != canonical {canonical!r}")

    node_url = product_node.get("url")
    if isinstance(node_url, str) and canonical and normalize_url(node_url) != normalize_url(canonical):
        errors.append(f"{path}: Product.url {node_url!r} != canonical {canonical!r}")

    expected_img = expected_image(expected_product)
    schema_images = product_node.get("image")
    schema_image_values = [schema_images] if isinstance(schema_images, str) else [str(item) for item in (schema_images or []) if item] if isinstance(schema_images, list) else []
    if expected_img and schema_image_values and normalize_url(schema_image_values[0]) != normalize_url(expected_img):
        errors.append(f"{path}: Product.image {schema_image_values[0]!r} != catalogue image {expected_img!r}")


def check_remote_images(images: set[str], errors: list[str]):
    """Verify public JSON-LD images with bounded concurrency and transient-failure retries."""
    def check_one(url: str) -> str | None:
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.netloc != "www.souviks.co.in":
            return f"Schema image is not a public Souviks HTTPS URL: {url}"

        request = urllib.request.Request(
            url,
            method="GET",
            headers={
                "User-Agent": "Souviks-Structured-Data-Audit/1.0",
                "Range": "bytes=0-0",
            },
        )

        last_error = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=12) as response:
                    if 200 <= response.status < 400:
                        return None
                    last_error = f"Schema image returned HTTP {response.status}: {url}"
                    if response.status not in {408, 425, 429} and response.status < 500:
                        return last_error
            except urllib.error.HTTPError as exc:
                last_error = f"Schema image returned HTTP {exc.code}: {url}"
                if exc.code not in {408, 425, 429} and exc.code < 500:
                    return last_error
            except Exception as exc:
                last_error = f"Schema image check failed for {url}: {exc}"

            if attempt < 2:
                time.sleep(0.35 * (attempt + 1))

        return last_error or f"Schema image check failed after retries: {url}"

    urls = sorted(images)
    if not urls:
        return

    image_errors = []
    worker_count = min(12, len(urls))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {executor.submit(check_one, url): url for url in urls}
        for future in as_completed(futures):
            try:
                error = future.result()
            except Exception as exc:
                error = f"Schema image checker crashed for {futures[future]}: {exc}"
            if error:
                image_errors.append(error)
                if len(image_errors) >= 50:
                    for pending in futures:
                        if not pending.done():
                            pending.cancel()
                    break

    errors.extend(image_errors[:50])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-images", action="store_true", help="Verify every distinct JSON-LD image URL resolves publicly.")
    args = parser.parse_args()

    catalogue = load_catalogue()
    errors: list[str] = []
    images: set[str] = set()

    html_files = sorted(ROOT.rglob("*.html"))
    for path in html_files:
        if path == ROOT / "index.html":
            continue
        validate_html(path, catalogue, errors, images)

    if args.check_images:
        check_remote_images(images, errors)

    print(f"Structured-data audit scanned {len(html_files) - 1} generated HTML files and {len(images)} distinct JSON-LD images.")
    fail(errors)
    print("Structured-data syntax, canonical alignment and product parity OK.")


if __name__ == "__main__":
    main()
