#!/usr/bin/env python3
"""Audit content quality, duplication, rendering states and site-trust invariants.

This is intentionally report-first: catalogue/content gaps are surfaced without
blocking deployment. Hard rendering/trust regressions can be promoted to CI errors
later once the current catalogue has been cleaned.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "https://www.souviks.co.in"

EXPECTED = {
    "phone_primary": "+919434331896",
    "phone_secondary": "+917908215701",
    "whatsapp": "917908215701",
    "email": "info@souviks.co.in",
    "social": {
        "facebook": "https://www.facebook.com/souviksandal",
        "instagram": "https://www.instagram.com/mssouviks",
        "x": "https://x.com/mssouviks",
    },
    "hours": {
        "monday-saturday": "07:00 AM – 07:30 PM",
        "sunday": "08:00 AM – 07:00 PM",
    },
    "postal_code": "713321",
}


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - diagnostic path
        print(f"[ERROR] Unable to read {path}: {exc}", file=sys.stderr)
        return []


def text(value: Any) -> str:
    return str(value or "").strip()


def normalise(value: Any) -> str:
    value = text(value).lower()
    value = value.replace("&amp;", "&")
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"[^a-z0-9\u0900-\u097f\u0980-\u09ff]+", " ", value)
    return value.strip()


def tokens(value: Any) -> set[str]:
    return {t for t in normalise(value).split() if len(t) > 1}


def listish(value: Any) -> list[str]:
    if isinstance(value, list):
        return [text(v) for v in value if text(v)]
    if not text(value):
        return []
    return [v.strip() for v in re.split(r"[,;]", text(value)) if v.strip()]


def product_slug(product: dict[str, Any]) -> str:
    if text(product.get("slug")):
        return text(product["slug"])
    url = text(product.get("url"))
    return url.rstrip("/").split("/")[-1]


def product_quality_score(product: dict[str, Any]) -> int:
    score = 0
    checks = [
        (20, product.get("product_name") or product.get("name")),
        (20, product.get("part_number") or product.get("partNumber")),
        (10, product.get("manufacturer_part_number") or product.get("manufacturer_part_numbers")),
        (10, product.get("brand_id") or product.get("brand_name") or product.get("brand")),
        (10, product.get("category_id") or product.get("category_name") or product.get("category")),
        (10, product.get("subcategory_id") or product.get("subcategory_name") or product.get("subcategory")),
        (10, product.get("vehicles")),
        (10, product.get("applications")),
        (10, product.get("description")),
    ]
    for points, value in checks:
        if isinstance(value, list):
            present = any(text(v) for v in value)
        else:
            present = bool(text(value))
        if present:
            score += points

    description = text(product.get("description"))
    if description:
        score -= 6 if len(description) < 40 else (3 if len(description) < 80 else 0)

    slug = product_slug(product)
    if len(slug) > 120:
        score -= 4
    elif len(slug) > 90:
        score -= 2

    return max(0, min(100, score))


def directory_quality_score(item: dict[str, Any], kind: str) -> int:
    score = 0
    description = text(item.get("description"))
    short_description = text(item.get("short_description"))

    if description:
        score += 35 if len(description) >= 180 else 20 if len(description) >= 80 else 8
    if short_description:
        score += 15 if len(short_description) >= 80 else 8

    if int(item.get("product_count") or 0) > 0:
        score += 15

    if kind == "brand":
        if item.get("categories"):
            score += 10
        if item.get("subcategories"):
            score += 5
        if item.get("vehicles"):
            score += 5
    elif kind == "category":
        if item.get("subcategories"):
            score += 15
        if item.get("brands"):
            score += 10
        if item.get("vehicles"):
            score += 5
    elif kind == "vehicle":
        if item.get("categories"):
            score += 12
        if item.get("brands"):
            score += 8
        if item.get("featured_products"):
            score += 5

    if item.get("seo"):
        seo = item["seo"]
        if isinstance(seo, dict) and (text(seo.get("title")) or text(seo.get("description"))):
            score += 5

    return max(0, min(100, score))


def detail_page_paragraphs(kind: str, language: str) -> dict[str, list[str]]:
    root = ROOT / language / f"{kind}s"
    out: dict[str, list[str]] = {}
    if not root.exists():
        return out

    ignored = (
        "trusted destination",
        "looking for a specific part",
        "contact souviks for",
        "need assistance",
    )

    for path in sorted(root.glob("*.html")):
        raw = path.read_text(encoding="utf-8", errors="ignore")
        main_match = re.search(r"<main\b[^>]*>([\s\S]*?)</main>", raw, re.I)
        main = main_match.group(1) if main_match else raw
        main = re.sub(r"<script\b[\s\S]*?</script>", " ", main, flags=re.I)
        main = re.sub(r"<style\b[\s\S]*?</style>", " ", main, flags=re.I)
        paragraphs = []
        for value in re.findall(r"<p\b[^>]*>([\s\S]*?)</p>", main, flags=re.I):
            clean = normalise(value)
            if len(clean) >= 35 and not any(fragment in clean for fragment in ignored):
                paragraphs.append(clean)
        out[path.stem] = paragraphs
    return out


def identify_template_similarity(kind: str, language: str) -> list[dict[str, Any]]:
    pages = detail_page_paragraphs(kind, language)
    names = list(pages)
    candidates: list[dict[str, Any]] = []

    for i, left in enumerate(names):
        left_text = " ".join(pages[left])
        if not left_text:
            continue
        for right in names[i + 1 :]:
            right_text = " ".join(pages[right])
            if not right_text:
                continue
            similarity = SequenceMatcher(None, left_text, right_text).ratio()
            if similarity >= 0.84:
                candidates.append({
                    "left": left,
                    "right": right,
                    "similarity": round(similarity, 3),
                })

    candidates.sort(key=lambda item: item["similarity"], reverse=True)
    return candidates[:50]


def duplicate_product_analysis(products: list[dict[str, Any]]) -> dict[str, Any]:
    name_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for product in products:
        key = normalise(product.get("product_name") or product.get("name"))
        if key:
            name_groups[key].append(product)

    name_collisions = [
        {
            "normalized_name": key,
            "products": [
                {
                    "id": text(p.get("id")),
                    "name": text(p.get("product_name") or p.get("name")),
                    "part_number": text(p.get("part_number") or p.get("partNumber")),
                    "brand": text(p.get("brand_name") or p.get("brand")),
                    "category": text(p.get("category_name") or p.get("category")),
                    "subcategory": text(p.get("subcategory_name") or p.get("subcategory")),
                }
                for p in values
            ],
        }
        for key, values in name_groups.items()
        if len(values) > 1
    ]

    formatting_duplicates = []
    for key, values in name_groups.items():
        if len(values) < 2:
            continue
        by_identity: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for p in values:
            identity = "|".join([
                normalise(p.get("part_number") or p.get("partNumber")),
                normalise(p.get("manufacturer_part_number")),
                normalise(p.get("brand_id") or p.get("brand_name") or p.get("brand")),
                normalise(p.get("category_id") or p.get("category_name") or p.get("category")),
                normalise(p.get("subcategory_id") or p.get("subcategory_name") or p.get("subcategory")),
                normalise(listish(p.get("vehicles"))),
                normalise(listish(p.get("applications"))),
            ])
            by_identity[identity].append(p)

        for identity, same in by_identity.items():
            if identity and len(same) > 1:
                formatting_duplicates.append({
                    "normalized_name": key,
                    "products": [
                        {
                            "id": text(p.get("id")),
                            "name": text(p.get("product_name") or p.get("name")),
                            "part_number": text(p.get("part_number") or p.get("partNumber")),
                            "brand": text(p.get("brand_name") or p.get("brand")),
                        }
                        for p in same
                    ],
                })

    return {
        "name_collisions": sorted(name_collisions, key=lambda v: len(v["products"]), reverse=True),
        "formatting_only_duplicates": sorted(formatting_duplicates, key=lambda v: len(v["products"]), reverse=True),
    }


def slug_audit(products: list[dict[str, Any]]) -> dict[str, Any]:
    slugs: dict[str, list[str]] = defaultdict(list)
    poor: list[dict[str, Any]] = []

    for p in products:
        pid = text(p.get("id"))
        slug = product_slug(p)
        slugs[slug].append(pid)

        lowered = slug.lower()
        name = normalise(p.get("product_name") or p.get("name"))
        part = normalise(p.get("part_number") or p.get("partNumber"))
        generic = re.search(r"(?:^|-)(product|item|part|spare|undefined|null)(?:-|$)", lowered)

        reasons = []
        if len(slug) > 120:
            reasons.append("slug > 120 characters")
        elif len(slug) > 90:
            reasons.append("slug > 90 characters")
        if generic:
            reasons.append(f"generic token: {generic.group(1)}")
        if name and not any(token in lowered for token in name.split()[:3]) and (not part or part.replace(" ", "-") not in lowered):
            reasons.append("slug does not preserve obvious product identity")
        if len(slug) < 8 and not part:
            reasons.append("very short slug without part number")

        if reasons:
            poor.append({
                "id": pid,
                "name": text(p.get("product_name") or p.get("name")),
                "slug": slug,
                "reasons": reasons,
            })

    duplicate_slugs = [
        {"slug": slug, "ids": ids}
        for slug, ids in slugs.items()
        if slug and len(ids) > 1
    ]

    return {
        "poor_slug_candidates": sorted(poor, key=lambda v: len(v["slug"]), reverse=True),
        "duplicate_slugs": duplicate_slugs,
    }


def html_state_audit() -> dict[str, Any]:
    states = {
        "static_empty_state_copy": [],
        "loading_elements": [],
        "unscoped_loading_without_failure_handler": [],
    }

    for path in ROOT.glob("**/*.html"):
        if any(part in {".git", "node_modules"} for part in path.parts):
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")

        for match in re.finditer(r'<(?:div|section)[^>]+id=["\']noResults["\'][^>]*>([\s\S]*?)</(?:div|section)>', raw, flags=re.I):
            inner = match.group(1)
            visible_text = re.sub(r"<[^>]+>", " ", inner)
            visible_text = re.sub(r"\s+", " ", visible_text).strip()
            if visible_text:
                states["static_empty_state_copy"].append(str(path))

        if re.search(r'\bid=["\'][^"\']*(loading|loader)[^"\']*["\']|class=["\'][^"\']*\bloading\b[^"\']*["\']|aria-label=["\']Loading', raw, flags=re.I):
            states["loading_elements"].append(str(path))

    return states


def trust_audit() -> dict[str, Any]:
    html_files = [
        path for path in ROOT.glob("**/*.html")
        if ".git" not in path.parts and "node_modules" not in path.parts
    ]

    href_sets: dict[str, set[str]] = defaultdict(set)
    value_locations: dict[str, list[str]] = defaultdict(list)

    for path in html_files:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        for href in re.findall(r'href=["\']([^"\']+)["\']', raw, flags=re.I):
            lower = href.strip().lower()
            if lower.startswith("tel:"):
                href_sets["tel"].add(href.strip())
                if lower not in {f"tel:{EXPECTED['phone_primary']}", f"tel:{EXPECTED['phone_secondary']}"}:
                    value_locations["unexpected_tel"].append(f"{path}: {href.strip()}")
            elif "wa.me/" in lower:
                href_sets["whatsapp"].add(href.strip())
                digits = re.sub(r"\D", "", lower.split("wa.me/", 1)[1])
                if not digits.endswith(EXPECTED["whatsapp"]):
                    value_locations["unexpected_whatsapp"].append(f"{path}: {href.strip()}")
            elif lower.startswith("mailto:"):
                href_sets["mailto"].add(href.strip())
                if lower != f"mailto:{EXPECTED['email']}":
                    value_locations["unexpected_mailto"].append(f"{path}: {href.strip()}")
            elif lower.startswith("https://www.facebook.com/") or lower.startswith("https://facebook.com/"):
                href_sets["facebook"].add(href.strip())
            elif lower.startswith("https://www.instagram.com/") or lower.startswith("https://instagram.com/"):
                href_sets["instagram"].add(href.strip())
            elif lower.startswith("https://x.com/") or lower.startswith("https://twitter.com/"):
                href_sets["x"].add(href.strip())

        if EXPECTED["postal_code"] not in raw and path.name in {"index.html", "contact.html", "terms.html", "privacy-policy.html"}:
            value_locations["missing_postal_code"].append(str(path))

        if "07:00 AM – 07:30 PM" in raw and "08:00 AM – 07:00 PM" in raw:
            continue

    bad_social = {
        key: sorted(values - {EXPECTED["social"][key]})
        for key, values in href_sets.items()
        if key in EXPECTED["social"]
    }

    return {
        "hrefs": {key: sorted(values) for key, values in href_sets.items()},
        "unexpected_values": value_locations,
        "unexpected_social_links": {key: values for key, values in bad_social.items() if values},
        "expected": EXPECTED,
    }


def mobile_responsive_audit() -> dict[str, Any]:
    html_files = sorted(ROOT.glob("**/*.html"))
    missing_viewport = []
    missing_mobile_navigation = []
    missing_mobile_button_contract = []

    for path in html_files:
        content = path.read_text(encoding="utf-8", errors="ignore")

        if not re.search(r'<meta\s+name=["\']viewport["\']', content, flags=re.I):
            missing_viewport.append(str(path))

        nav = re.search(
            r'<nav\b[^>]*id=["\']mainNavigation["\'][^>]*>',
            content,
            flags=re.I,
        )
        if not nav:
            missing_mobile_navigation.append(str(path))
            continue

        button = re.search(
            r'<button\b[^>]*id=["\']mobileMenuButton["\'][^>]*>',
            content,
            flags=re.I,
        )
        if not button:
            missing_mobile_button_contract.append(str(path))
            continue

        markup = button.group(0)
        if not re.search(r'aria-expanded=["\'][^"\']+["\']', markup, flags=re.I):
            missing_mobile_button_contract.append(str(path))
        elif not re.search(r'aria-controls=["\']mainNavigation["\']', markup, flags=re.I):
            missing_mobile_button_contract.append(str(path))

    css_paths = sorted((ROOT / "assets/css/bundles").glob("*.css"))
    css_text = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in css_paths
    )
    base_css = ROOT / "assets/css/site-base.css"
    if base_css.exists():
        css_text += "\n" + base_css.read_text(encoding="utf-8", errors="ignore")

    reduced_motion_navigation = bool(
        re.search(
            r'@media\s*\(prefers-reduced-motion:\s*reduce\).*?\.main-navigation',
            css_text,
            flags=re.I | re.S,
        )
    )

    return {
        "html_pages": len(html_files),
        "missing_viewport": missing_viewport,
        "missing_mobile_navigation": missing_mobile_navigation,
        "missing_mobile_button_contract": missing_mobile_button_contract,
        "reduced_motion_navigation_rule": reduced_motion_navigation,
    }



def _json_contract_audit(paths: list[Path]) -> dict[str, list[str]]:
    missing: list[str] = []
    invalid: list[str] = []
    non_array: list[str] = []

    for path in paths:
        if not path.exists():
            missing.append(str(path))
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            invalid.append(str(path))
            continue
        if not isinstance(payload, list):
            non_array.append(str(path))

    return {
        "missing": missing,
        "invalid": invalid,
        "non_array": non_array,
    }


def _static_entity_route_audit(
    kind: str,
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    active_slugs = {
        text(record.get("slug"))
        for record in records
        if isinstance(record, dict)
        and record.get("active") is not False
        and text(record.get("slug"))
    }

    results: dict[str, Any] = {
        "active_records": len(active_slugs),
        "missing_pages": {},
        "orphan_pages": {},
    }

    folders = {
        "product": "products",
        "brand": "brands",
        "category": "categories",
        "vehicle": "vehicles",
    }
    folder = folders.get(kind, f"{kind}s")

    for language in ("en", "hi", "bn"):
        directory = ROOT / language / folder
        actual = {
            path.stem
            for path in directory.glob("*.html")
        } if directory.exists() else set()

        results["missing_pages"][language] = sorted(active_slugs - actual)
        results["orphan_pages"][language] = sorted(actual - active_slugs)

    return results


def reliability_audit(
    products: list[dict[str, Any]],
    brands: list[dict[str, Any]],
    categories: list[dict[str, Any]],
    vehicles: list[dict[str, Any]],
) -> dict[str, Any]:
    localized_404: dict[str, Any] = {}
    expected_404 = {
        "en": ROOT / "en/404.html",
        "hi": ROOT / "hi/404.html",
        "bn": ROOT / "bn/404.html",
    }

    for language, path in expected_404.items():
        raw = path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""
        localized_404[language] = {
            "exists": path.exists(),
            "lang": re.search(
                rf"<html\b[^>]*\blang=[\"\']{re.escape(language)}[\"\']",
                raw,
                flags=re.I,
            ) is not None,
            "noindex": re.search(
                r'<meta\s+name=["\']robots["\'][^>]*content=["\'][^"\']*noindex',
                raw,
                flags=re.I,
            ) is not None,
            "error_asset": "/assets/images/404.svg" in raw,
            "has_heading": bool(re.search(r"<h[1-3]\b[^>]*>[\s\S]*?</h[1-3]>", raw, flags=re.I)),
            "has_local_home": f'href="/{language}/"' in raw,
            "has_local_products": f'href="/{language}/products"' in raw,
        }

    json_contract = _json_contract_audit([
        ROOT / "assets/data/products.json",
        ROOT / "assets/data/brands.json",
        ROOT / "assets/data/categories.json",
        ROOT / "assets/data/vehicles.json",
        ROOT / "assets/data/search.json",
        ROOT / "assets/data/catalogue-index.json",
    ])

    core = (ROOT / "assets/js/site-core.js").read_text(encoding="utf-8", errors="ignore")
    product_bundle = (ROOT / "assets/js/bundles/product.js").read_text(encoding="utf-8", errors="ignore")
    products_bundle = (ROOT / "assets/js/bundles/products.js").read_text(encoding="utf-8", errors="ignore")
    account_bundle = (ROOT / "assets/js/bundles/account.js").read_text(encoding="utf-8", errors="ignore")

    js_sources = list((ROOT / "assets/js").rglob("*.js"))
    raw_error_logging: list[str] = []
    raw_error_pattern = re.compile(
        r"console\.(?:error|warn)\(\s*(?:[\"'][^\"']*[\"']\s*,\s*)?"
        r"(?:error|findError|createError|insertError|updateError|notificationError|loadError)\b",
        flags=re.I,
    )
    for path in js_sources:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        if raw_error_pattern.search(raw):
            raw_error_logging.append(str(path))

    malformed_query = {
        "safe_numeric_helper": "Utils.queryNumber = function" in core,
        "bounded_page_usage": 'Utils.queryNumber("page", 1, 1, 1000000)' in products_bundle,
        "bounded_page_size_usage": 'Utils.queryNumber("pageSize", 20, 1, 100)' in products_bundle,
    }

    missing_image_metadata = []
    for product in products:
        if product.get("active") is False:
            continue
        image_values = [
            product.get("image_url"),
            product.get("image"),
            product.get("primary_image"),
            product.get("gallery"),
        ]
        has_image = any(
            bool(value) and (not isinstance(value, list) or any(text(item) for item in value))
            for value in image_values
        )
        if not has_image:
            missing_image_metadata.append(text(product.get("id")))

    runtime_boundary = {
        "unhandled_error_listener": 'window.addEventListener("error"' in core,
        "unhandled_rejection_listener": 'window.addEventListener("unhandledrejection"' in core,
        "generic_failure_message": "Something went wrong. Please refresh the page and try again." in core,
        "sanitized_error_logger": "function sanitiseError" in core and "window.SouviksErrors" in core,
        "no_raw_error_objects_in_runtime_ui": "showGlobalFailure" in core and ".message" not in core[core.find("function showGlobalFailure"):core.find("function showGlobalFailure") + 5000],
    }

    partial_api = {
        "account_dashboard_safe_requests": "const safeRequest = promise =>" in account_bundle,
        "account_dashboard_continues_after_individual_failure": "Boolean(recentResult?.error)" in account_bundle,
    }

    catalogue_fallbacks = {
        "product_missing_record_message": "Product unavailable" in product_bundle,
        "products_missing_record_message": "Product unavailable" in products_bundle,
        "image_placeholder_exists": (ROOT / "assets/images/placeholder.webp").exists(),
        "image_error_fallback_listener": bool(
            re.search(r'document\.addEventListener\(["\']error["\'],\s*[\w$]+\s*=>', core)
        ) and "souviksFallbackApplied" in core and "/assets/images/placeholder.webp" in core,
    }

    return {
        "localized_404": localized_404,
        "server_500": {
            "supported_as_static_page": (ROOT / "500.html").exists(),
            "client_runtime_boundary_available": all(runtime_boundary.values()),
            "note": "Static deployment has no repository-level 500 route; unhandled client errors are covered by the runtime boundary.",
        },
        "json_data": json_contract,
        "missing_image_metadata": {
            "active_products_without_image_metadata": missing_image_metadata,
            "count": len(missing_image_metadata),
        },
        "malformed_query_parameters": malformed_query,
        "unavailable_product_pages": _static_entity_route_audit("product", products),
        "deleted_or_disabled_brands": _static_entity_route_audit("brand", brands),
        "deleted_or_disabled_categories": _static_entity_route_audit("category", categories),
        "deleted_or_disabled_vehicles": _static_entity_route_audit("vehicle", vehicles),
        "partial_api_requests": partial_api,
        "fallbacks": catalogue_fallbacks,
        "browser_error_logging": {
            "sanitized_runtime_logger": "window.SouviksErrors = {" in core,
            "raw_error_logging_candidates": sorted(raw_error_logging),
        },
    }


def main() -> int:
    catalogue_path = ROOT / "assets/data/catalogue-index.json"
    products_path = ROOT / "assets/data/products.json"
    brands_path = ROOT / "assets/data/brands.json"
    categories_path = ROOT / "assets/data/categories.json"
    vehicles_path = ROOT / "assets/data/vehicles.json"

    catalogue = load_json(catalogue_path)
    products_projection = load_json(products_path)
    # Product content quality must use the catalogue master. The products.json
    # file is a projection and may legitimately omit editorial fields in older
    # versions; the build reconciles it from catalogue-index.json.
    products = catalogue if isinstance(catalogue, list) else products_projection
    brands = load_json(brands_path)
    categories = load_json(categories_path)
    vehicles = load_json(vehicles_path)

    active_products = [p for p in products if p.get("active") is not False]
    report = {
        "summary": {
            "active_products": len(active_products),
            "active_brands": sum(b.get("active") is not False for b in brands),
            "active_categories": sum(c.get("active") is not False for c in categories),
            "active_vehicles": sum(v.get("active") is not False for v in vehicles),
            "generated_at": "runtime",
        },
        "content_quality": {
            "products": {
                "average_score": round(sum(product_quality_score(p) for p in active_products) / len(active_products), 1) if active_products else 0,
                "scores_below_70": [
                    {
                        "id": text(p.get("id")),
                        "name": text(p.get("product_name") or p.get("name")),
                        "score": product_quality_score(p),
                    }
                    for p in active_products
                    if product_quality_score(p) < 70
                ],
                "descriptions_below_80_chars": sum(len(text(p.get("description"))) < 80 for p in active_products),
                "missing_descriptions": sum(not text(p.get("description")) for p in active_products),
            },
            "brands": {
                "average_score": round(sum(directory_quality_score(b, "brand") for b in brands) / len(brands), 1) if brands else 0,
                "missing_descriptions": sum(not text(b.get("description")) for b in brands),
                "missing_short_descriptions": sum(not text(b.get("short_description")) for b in brands),
                "below_60": [
                    {"id": text(b.get("id")), "name": text(b.get("name")), "score": directory_quality_score(b, "brand")}
                    for b in brands if directory_quality_score(b, "brand") < 60
                ],
            },
            "categories": {
                "average_score": round(sum(directory_quality_score(c, "category") for c in categories) / len(categories), 1) if categories else 0,
                "missing_descriptions": sum(not text(c.get("description")) for c in categories),
                "missing_short_descriptions": sum(not text(c.get("short_description")) for c in categories),
                "below_60": [
                    {"id": text(c.get("id")), "name": text(c.get("name")), "score": directory_quality_score(c, "category")}
                    for c in categories if directory_quality_score(c, "category") < 60
                ],
            },
            "vehicles": {
                "average_score": round(sum(directory_quality_score(v, "vehicle") for v in vehicles) / len(vehicles), 1) if vehicles else 0,
                "missing_descriptions": sum(not text(v.get("description")) for v in vehicles),
                "missing_short_descriptions": sum(not text(v.get("short_description")) for v in vehicles),
                "below_60": [
                    {"id": text(v.get("id")), "name": text(v.get("model") or v.get("name")), "score": directory_quality_score(v, "vehicle")}
                    for v in vehicles if directory_quality_score(v, "vehicle") < 60
                ],
            },
        },
        "duplication": duplicate_product_analysis(active_products),
        "slugs": slug_audit(active_products),
        "template_similarity": {
            kind: {
                lang: {
                    "candidates": identify_template_similarity(kind, lang)
                }
                for lang in ("en", "hi", "bn")
            }
            for kind in ("brand", "category", "vehicle")
        },
        "rendering": html_state_audit(),
        "mobile_responsive": mobile_responsive_audit(),
        "reliability": reliability_audit(products, brands, categories, vehicles),
        "trust": trust_audit(),
    }

    # Avoid unused-variable lint noise while keeping the catalogue master loaded
    # as part of the audit contract.
    report["summary"]["catalogue_records"] = len(catalogue) if isinstance(catalogue, list) else 0

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())