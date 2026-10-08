#!/usr/bin/env python3
"""Blocking production contract for the static Souviks site.

This audit is intentionally strict. It is run only after the catalogue/entity
build has completed, so a failing check prevents the generated catalogue
commit from being published by this workflow.
"""

from __future__ import annotations

import html.parser
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://www.souviks.co.in"
LANGUAGES = ("en", "bn", "hi")
ENTITY_KINDS = {
    "products": "products",
    "brands": "brands",
    "categories": "categories",
    "vehicles": "vehicles",
}
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}
SKIP_LINK_PREFIXES = ("#", "mailto:", "tel:", "javascript:", "data:", "blob:")


def fail(errors: list[str]) -> None:
    if not errors:
        return
    print("[critical build] BLOCKED")
    for error in errors[:300]:
        print(error)
    if len(errors) > 300:
        print(f"... and {len(errors) - 300} more errors")
    raise SystemExit(1)


def text(value) -> str:
    return str(value or "").strip()


def load_json(path: Path, errors: list[str]):
    if not path.exists():
        errors.append(f"Missing required JSON file: {path.relative_to(ROOT)}")
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Invalid JSON {path.relative_to(ROOT)}: {exc}")
        return []


def arrayish(value):
    if isinstance(value, list):
        values = value
    elif value in (None, ""):
        values = []
    else:
        values = re.split(r"[,;]", str(value))
    return [text(v) for v in values if text(v)]


def projection_value(source, field: str):
    if field in {"applications", "vehicles"}:
        return arrayish(source.get(field))
    if field == "image_folder":
        return text(source.get("image_folder") or source.get("id"))
    if field == "image_url":
        return text(source.get("image_url") or "/assets/images/placeholder.webp")
    if field == "gallery":
        value = source.get("gallery")
        return [text(v) for v in (value or []) if text(v)] if isinstance(value, list) else []
    if field == "gallery_dimensions":
        value = source.get("gallery_dimensions")
        return value if isinstance(value, dict) else {}
    if field == "featured":
        return bool(source.get("featured"))
    if field == "active":
        return source.get("active") is not False
    if field in {"mrp", "selling_price"}:
        return number(source.get(field))
    return text(source.get(field)) if isinstance(source.get(field), str) else source.get(field)


def unique(records, field: str, label: str, errors: list[str]) -> None:
    seen = {}
    for record in records if isinstance(records, list) else []:
        value = text(record.get(field))
        if value:
            seen.setdefault(value, 0)
            seen[value] += 1
    duplicates = [f"{value} ({count})" for value, count in seen.items() if count > 1]
    if duplicates:
        errors.append(f"{label} has duplicate {field}: {', '.join(duplicates[:20])}")


def number(value):
    if value is None or value == "":
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if value == value else None


def validate_price_integrity(products, errors: list[str]) -> None:
    for product in products:
        pid = text(product.get("id"))
        mrp = number(product.get("mrp"))
        selling = number(product.get("selling_price"))
        raw_mrp = product.get("mrp")
        raw_selling = product.get("selling_price")

        if raw_mrp not in (None, "") and mrp is None:
            errors.append(f"{pid}: MRP is not numeric: {raw_mrp!r}")
        if raw_selling not in (None, "") and selling is None:
            errors.append(f"{pid}: selling_price is not numeric: {raw_selling!r}")

        if mrp is not None and mrp <= 0:
            errors.append(f"{pid}: MRP must be greater than zero when present: {mrp}")
        if selling is not None and selling <= 0:
            errors.append(f"{pid}: selling_price must be greater than zero when present: {selling}")
        if mrp is not None and selling is not None and selling > mrp + 0.01:
            errors.append(f"{pid}: selling_price {selling} exceeds MRP {mrp}")

        discount = number(product.get("discount_percent"))
        if discount is not None and not 0 <= discount <= 100:
            errors.append(f"{pid}: discount_percent outside 0-100: {discount}")
        if mrp and selling is not None and discount is not None:
            expected = round((mrp - selling) / mrp * 100)
            if abs(discount - expected) > 1:
                errors.append(
                    f"{pid}: discount_percent {discount} disagrees with price-derived {expected}"
                )


def validate_images(products, errors: list[str]) -> None:
    for product in products:
        pid = text(product.get("id"))
        folder = text(product.get("image_folder") or pid)
        gallery = product.get("gallery")
        if not folder:
            errors.append(f"{pid}: missing image_folder")
            continue
        if not isinstance(gallery, list) or not gallery:
            image_url = text(product.get("image_url"))
            # A product may use a single primary image, but the image must be
            # explicit and real. Missing/placeholder imagery is a blocking defect.
            if not image_url:
                errors.append(f"{pid}: active product has no gallery and no explicit image_url")
            elif image_url.endswith("/placeholder.webp") or image_url == "/assets/images/placeholder.webp":
                errors.append(f"{pid}: active product has no gallery and resolves to placeholder image")
            elif image_url.startswith("/assets/"):
                image_path = ROOT / image_url.lstrip("/")
                if not image_path.is_file():
                    errors.append(f"{pid}: declared primary image file is missing: {image_url}")
            continue

        seen = set()
        for index, filename in enumerate(gallery, start=1):
            filename = text(filename)
            if not filename:
                errors.append(f"{pid}: gallery image {index} is blank")
                continue
            if filename in seen:
                errors.append(f"{pid}: duplicate gallery filename: {filename}")
            seen.add(filename)
            path = ROOT / "assets" / "images" / "products" / folder / filename
            if not path.is_file():
                errors.append(f"{pid}: missing product image file: assets/images/products/{folder}/{filename}")

        image_url = text(product.get("image_url"))
        if image_url.endswith("/placeholder.webp") or image_url == "/assets/images/placeholder.webp":
            errors.append(f"{pid}: active product resolves to placeholder image")


def public_route(kind: str, lang: str, slug: str) -> str:
    return f"/{lang}/{kind}/{slug}"


def html_path_for_route(route: str) -> Path | None:
    clean = urlsplit(route).path.rstrip("/")
    if clean in ("", "/"):
        return ROOT / "index.html"
    if clean in ("/sitemap.xml", "/index.html"):
        return ROOT / clean.lstrip("/")
    parts = [part for part in clean.split("/") if part]
    if len(parts) == 1 and parts[0] in LANGUAGES:
        return ROOT / parts[0] / "index.html"
    if len(parts) == 1:
        return ROOT / f"{parts[0]}.html"
    if len(parts) == 2 and parts[0] in LANGUAGES:
        return ROOT / parts[0] / f"{parts[1]}.html"
    if len(parts) == 3 and parts[0] in LANGUAGES:
        return ROOT / parts[0] / parts[1] / f"{parts[2]}.html"
    return None


def canonical_from_html(raw: str) -> str:
    for tag in re.findall(r"<link\b[^>]*>", raw, flags=re.I):
        if re.search(r'\brel\s*=\s*["\'][^"\']*\bcanonical\b[^"\']*["\']', tag, flags=re.I):
            match = re.search(r'\bhref\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
            return text(match.group(1)) if match else ""
    return ""


def robots_from_html(raw: str) -> str:
    for tag in re.findall(r"<meta\b[^>]*>", raw, flags=re.I):
        if re.search(r'\bname\s*=\s*["\']robots["\']', tag, flags=re.I):
            match = re.search(r'\bcontent\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
            return text(match.group(1)).lower() if match else ""
    return ""


class HTMLContractParser(html.parser.HTMLParser):
    def __init__(self, path: Path, errors: list[str]):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.errors = errors
        self.stack: list[tuple[str, int]] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        line, col = self.getpos()
        attributes = dict(attrs)
        element_id = text(attributes.get("id"))
        if element_id:
            if element_id in self.ids:
                self.errors.append(f"{self.path.relative_to(ROOT)}:{line}: duplicate id {element_id!r}")
            self.ids.add(element_id)
        if tag not in VOID_TAGS:
            self.stack.append((tag, line))

    def handle_startendtag(self, tag, attrs):
        element_id = text(dict(attrs).get("id"))
        if element_id:
            if element_id in self.ids:
                self.errors.append(f"{self.path.relative_to(ROOT)}: duplicate id {element_id!r}")
            self.ids.add(element_id)

    def handle_endtag(self, tag):
        tag = tag.lower()
        line, col = self.getpos()
        if tag in VOID_TAGS:
            return
        if not self.stack:
            self.errors.append(f"{self.path.relative_to(ROOT)}:{line}: unexpected closing </{tag}>")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return

        # Recover so a single malformed branch does not hide later errors.
        open_tags = [item[0] for item in self.stack]
        if tag in open_tags:
            self.errors.append(
                f"{self.path.relative_to(ROOT)}:{line}: mismatched closing </{tag}>; "
                f"open element is <{self.stack[-1][0]}>"
            )
            while self.stack and self.stack[-1][0] != tag:
                self.stack.pop()
            if self.stack:
                self.stack.pop()
        else:
            self.errors.append(f"{self.path.relative_to(ROOT)}:{line}: unexpected closing </{tag}>")

    def finish(self):
        for tag, line in self.stack:
            self.errors.append(
                f"{self.path.relative_to(ROOT)}:{line}: unclosed <{tag}>"
            )


def validate_generated_html_and_routes(records_by_kind, errors: list[str]) -> dict[str, Path]:
    expected_routes: dict[str, Path] = {}
    for kind, records in records_by_kind.items():
        for record in records:
            slug = text(record.get("slug"))
            if not slug:
                continue
            for lang in LANGUAGES:
                route = public_route(kind, lang, slug)
                expected_routes[route] = html_path_for_route(route)

    for route, path in expected_routes.items():
        if path is None or not path.is_file():
            errors.append(f"Missing generated route: {route}")

    # Top-level language pages must exist as a matched set.  The default
    # root 404 page is intentionally outside this parity contract.
    top_level = []
    for language in LANGUAGES:
        language_dir = ROOT / language
        top_level.append({
            p.name for p in language_dir.glob("*.html")
            if p.name != "404.html"
        })
    if top_level:
        baseline = top_level[0]
        for language, names in zip(LANGUAGES, top_level):
            missing = sorted(baseline - names)
            extra = sorted(names - baseline)
            if missing:
                errors.append(f"{language}: missing top-level multilingual pages: {', '.join(missing[:30])}")
            if extra:
                errors.append(f"{language}: unexpected top-level multilingual pages: {', '.join(extra[:30])}")

    for language in LANGUAGES:
        for kind in ENTITY_KINDS.values():
            directory = ROOT / language / kind
            if not directory.is_dir():
                errors.append(f"Missing generated directory: {language}/{kind}")
                continue
            expected_slugs = {
                text(record.get("slug"))
                for record in records_by_kind[kind]
                if text(record.get("slug"))
            }
            actual_slugs = {path.stem for path in directory.glob("*.html")}
            for slug in sorted(expected_slugs - actual_slugs):
                errors.append(f"{language}/{kind}: missing generated page {slug}")
            for slug in sorted(actual_slugs - expected_slugs):
                errors.append(f"{language}/{kind}: orphan generated page {slug}")

            for path in sorted(directory.glob("*.html")):
                raw = path.read_text(encoding="utf-8", errors="ignore")
                parser = HTMLContractParser(path, errors)
                try:
                    parser.feed(raw)
                    parser.close()
                except Exception as exc:
                    errors.append(f"{path.relative_to(ROOT)}: HTML parser failure: {exc}")
                parser.finish()

                expected_route = f"/{language}/{kind}/{path.stem}"
                expected_canonical = BASE + expected_route
                canonical = canonical_from_html(raw)
                if canonical.rstrip("/") != expected_canonical.rstrip("/"):
                    errors.append(
                        f"{path.relative_to(ROOT)}: canonical {canonical!r} != {expected_canonical!r}"
                    )

                if '<meta charset=' not in raw.lower():
                    errors.append(f"{path.relative_to(ROOT)}: missing charset declaration")
                if '<meta name="viewport"' not in raw.lower():
                    errors.append(f"{path.relative_to(ROOT)}: missing viewport declaration")

                if kind == "products":
                    if "window.SOUVIKS_PRODUCT_PAGE_DATA" not in raw:
                        errors.append(f"{path.relative_to(ROOT)}: missing embedded product data")

    # Full multilingual parity: each language must expose the same entity
    # product-set and the same indexability state for the same canonical slug.
    for kind, records in records_by_kind.items():
        for record in records:
            slug = text(record.get("slug"))
            if not slug:
                continue
            signatures = {}
            for language in LANGUAGES:
                path = ROOT / language / kind / f"{slug}.html"
                raw = path.read_text(encoding="utf-8", errors="ignore")
                ids = sorted(set(re.findall(r"""data-saved-product-id=["']([^"']+)["']""", raw, flags=re.I)))
                signatures[language] = {
                    "ids": ids,
                    "robots": "noindex" in robots_from_html(raw),
                }
            baseline = signatures["en"]
            for language, signature in signatures.items():
                if signature["ids"] != baseline["ids"]:
                    errors.append(
                        f"{language}/{kind}/{slug}.html: multilingual product-set mismatch with en/{kind}/{slug}.html"
                    )
                if signature["robots"] != baseline["robots"]:
                    errors.append(
                        f"{language}/{kind}/{slug}.html: multilingual robots/noindex mismatch with en/{kind}/{slug}.html"
                    )

    return expected_routes


def validate_redirects(expected_routes, errors: list[str]) -> None:
    path = ROOT / "_redirects"
    if not path.is_file():
        errors.append("Missing _redirects file")
        return

    for lineno, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = stripped.split()
        if len(parts) < 2:
            errors.append(f"_redirects:{lineno}: malformed rule")
            continue
        source, destination = parts[:2]
        status = parts[2] if len(parts) >= 3 else ""
        if destination.endswith(".html") and not (
            status == "200" and destination == "/index.html" and source == "https://souviks.co.in/"
        ):
            errors.append(f"_redirects:{lineno}: redirect target contains .html: {destination}")
        if ":splat" not in destination and ":lang" not in destination and ":slug" not in destination:
            dest_path = urlsplit(destination).path or destination
            if dest_path in expected_routes:
                continue
            target = html_path_for_route(dest_path)
            if target is None or not target.is_file():
                errors.append(
                    f"_redirects:{lineno}: redirect target has no generated/public route: {destination}"
                )
        if source == destination:
            errors.append(f"_redirects:{lineno}: self-redirect: {source}")


def sitemap_urls(path: Path, errors: list[str]) -> set[str]:
    if not path.is_file():
        errors.append(f"Missing sitemap: {path.relative_to(ROOT)}")
        return set()
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if "<urlset" not in raw and "<sitemapindex" not in raw:
        errors.append(f"{path.relative_to(ROOT)}: malformed sitemap root")
    return set(re.findall(r"<loc>([^<]+)</loc>", raw))


def validate_sitemaps(records_by_kind, errors: list[str]) -> None:
    expected = {
        "products.xml": {
            BASE + public_route("products", lang, text(p.get("slug")))
            for lang in LANGUAGES for p in records_by_kind["products"] if text(p.get("slug"))
        },
        "brands.xml": {
            BASE + public_route("brands", lang, text(b.get("slug")))
            for lang in LANGUAGES for b in records_by_kind["brands"] if text(b.get("slug"))
        },
        "categories.xml": {
            BASE + public_route("categories", lang, text(c.get("slug")))
            for lang in LANGUAGES for c in records_by_kind["categories"] if text(c.get("slug"))
        },
        "vehicles.xml": {
            BASE + public_route("vehicles", lang, text(v.get("slug")))
            for lang in LANGUAGES
            for v in records_by_kind["vehicles"]
            if text(v.get("slug")) and len(v.get("products") or []) > 5
        },
    }

    for filename, expected_urls in expected.items():
        path = ROOT / "sitemaps" / filename
        actual = sitemap_urls(path, errors)
        missing = sorted(expected_urls - actual)
        orphan = sorted(actual - expected_urls)
        if missing:
            errors.append(
                f"{filename}: missing {len(missing)} expected URLs: {', '.join(missing[:15])}"
            )
        if orphan:
            errors.append(
                f"{filename}: contains {len(orphan)} unexpected URLs: {', '.join(orphan[:15])}"
            )

        for url in sorted(actual):
            route = urlsplit(url).path
            html_path = html_path_for_route(route)
            if html_path and html_path.is_file():
                robots = robots_from_html(html_path.read_text(encoding="utf-8", errors="ignore"))
                if "noindex" in robots:
                    errors.append(
                        f"{filename}: URL is in sitemap but generated page is noindex: {url}"
                    )


def validate_internal_links(errors: list[str]) -> None:
    for html_path in ROOT.glob("**/*.html"):
        if any(part in {".git", "node_modules"} for part in html_path.parts):
            continue
        raw = html_path.read_text(encoding="utf-8", errors="ignore")
        link_values = re.findall(
            r'\b(?:href|src|poster)\s*=\s*["\']([^"\']+)["\']',
            raw,
            flags=re.I,
        )
        for href in link_values:
            href = text(href)
            lower = href.lower()
            if not href or lower.startswith(SKIP_LINK_PREFIXES) or href.startswith("//"):
                continue
            parsed = urlsplit(href)
            if parsed.scheme in {"http", "https"}:
                if parsed.netloc and parsed.netloc != "www.souviks.co.in":
                    continue
                path = parsed.path
            elif href.startswith("/"):
                path = parsed.path
            else:
                # Relative links are resolved against the HTML file's directory.
                path = (html_path.parent / parsed.path).resolve().relative_to(ROOT).as_posix()
                path = "/" + path
            if path.startswith("/assets/"):
                target = ROOT / path.lstrip("/")
                if not target.is_file():
                    errors.append(f"{html_path.relative_to(ROOT)}: broken asset link {href}")
                continue
            if path.startswith("/sitemaps/"):
                target = ROOT / path.lstrip("/")
                if not target.is_file():
                    errors.append(f"{html_path.relative_to(ROOT)}: broken sitemap link {href}")
                continue
            if not path.startswith("/"):
                continue
            target = html_path_for_route(path)
            if target is not None and target.is_file():
                continue
            # Clean catalogue/public route with an unresolved file is a hard failure.
            errors.append(f"{html_path.relative_to(ROOT)}: broken internal link {href}")


def validate_critical_catalogue_contract(errors: list[str]) -> dict[str, list]:
    catalogue = load_json(ROOT / "assets/data/catalogue-index.json", errors)
    products = load_json(ROOT / "assets/data/products.json", errors)
    brands = load_json(ROOT / "assets/data/brands.json", errors)
    categories = load_json(ROOT / "assets/data/categories.json", errors)
    vehicles = load_json(ROOT / "assets/data/vehicles.json", errors)

    active_catalogue = [p for p in catalogue if isinstance(p, dict) and p.get("active") is not False]
    active_products = [p for p in products if isinstance(p, dict) and p.get("active") is not False]
    active_brands = [b for b in brands if isinstance(b, dict) and b.get("active") is not False]
    active_categories = [c for c in categories if isinstance(c, dict) and c.get("active") is not False]
    active_vehicles = [v for v in vehicles if isinstance(v, dict) and v.get("active") is not False]

    for records, field, label in (
        (active_catalogue, "id", "catalogue"),
        (active_catalogue, "slug", "catalogue"),
        (active_products, "id", "products projection"),
        (active_products, "slug", "products projection"),
        (active_brands, "id", "brands"),
        (active_brands, "slug", "brands"),
        (active_categories, "id", "categories"),
        (active_categories, "slug", "categories"),
        (active_vehicles, "id", "vehicles"),
        (active_vehicles, "slug", "vehicles"),
    ):
        unique(records, field, label, errors)

    records_by_kind = {
        "products": active_catalogue,
        "brands": active_brands,
        "categories": active_categories,
        "vehicles": active_vehicles,
    }

    catalogue_by_id = {text(p.get("id")): p for p in active_catalogue if text(p.get("id"))}
    product_by_id = {text(p.get("id")): p for p in active_products if text(p.get("id"))}

    for pid, source in catalogue_by_id.items():
        projection = product_by_id.get(pid)
        if projection is None:
            errors.append(f"products.json missing active product {pid}")
            continue
        for field in (
            "slug", "mrp", "selling_price", "product_name", "name",
            "brand_id", "brand_name", "category_id", "category_name",
            "subcategory_id", "subcategory_name", "image", "primary_image",
            "image_url", "vehicles", "applications", "featured", "active",
            "description", "image_folder", "gallery", "gallery_dimensions",
        ):
            expected = projection_value(source, field)
            actual = projection.get(field)
            if field in {"mrp", "selling_price"}:
                actual = number(actual)
            elif field in {"applications", "vehicles"}:
                actual = arrayish(actual)
            elif field == "image_folder":
                actual = text(actual)
            elif field == "image_url":
                actual = text(actual or "/assets/images/placeholder.webp")
            elif field == "gallery":
                actual = [text(v) for v in (actual or []) if text(v)] if isinstance(actual, list) else []
            elif field == "gallery_dimensions":
                actual = actual if isinstance(actual, dict) else {}
            elif field in {"featured", "active"}:
                actual = bool(actual) if field == "featured" else actual is not False
            if actual != expected:
                errors.append(f"products.json parity failure {pid}: {field}")

    validate_price_integrity(active_catalogue, errors)
    validate_images(active_catalogue, errors)
    return records_by_kind


def main() -> None:
    errors: list[str] = []
    records_by_kind = validate_critical_catalogue_contract(errors)
    expected_routes = validate_generated_html_and_routes(records_by_kind, errors)
    validate_redirects(expected_routes, errors)
    validate_sitemaps(records_by_kind, errors)
    validate_internal_links(errors)

    # The existing structured-data audit remains the detailed JSON-LD checker;
    # this script only enforces the critical page-level contract.
    print(
        "[critical build] checked "
        f"{len(records_by_kind['products'])} products, "
        f"{len(records_by_kind['brands'])} brands, "
        f"{len(records_by_kind['categories'])} categories, "
        f"{len(records_by_kind['vehicles'])} vehicles."
    )
    fail(errors)
    print("[critical build] PASS")


if __name__ == "__main__":
    main()

# Build gate revision: 2026-10-08 multilingual/redirect/image contract.
