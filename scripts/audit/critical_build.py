#!/usr/bin/env python3
"""Blocking production contract for the static Souviks site.

This audit is intentionally strict. It is run only after the catalogue/entity
build has completed, so a failing check prevents the generated catalogue
commit from being published by this workflow.
"""

from __future__ import annotations

import hashlib
from collections import Counter
import html.parser
import json
import math
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

# Image assets are strict requirements: no missing-file or placeholder allowlists.


def error_signature(error: str) -> str:
    """Normalize per-file values so CI summarizes root causes, not thousands of near-duplicates."""
    message = re.sub(
        r"^(?:[^:]+\.html|_headers:\d+|sitemaps/[^:]+):\s*",
        "",
        error,
    )
    message = re.sub(r"\bSVKS\d+\b", "<PRODUCT_ID>", message)
    message = re.sub(
        r"https://www\.souviks\.co\.in/[^\s'\"<>]*",
        "<URL>",
        message,
    )
    message = re.sub(
        r"/assets/images/products/[^/'\" ]+/[^/'\" ]+",
        "<PRODUCT_IMAGE>",
        message,
    )
    message = re.sub(r"\b\d+(?:\.\d+)?\b", "<N>", message)
    return message[:200]


def fail(errors: list[str]) -> None:
    if not errors:
        return
    print("[critical build] BLOCKED")
    if len(errors) > 300:
        signatures = Counter(error_signature(error) for error in errors)
        print(
            f"[critical build] {len(errors)} errors across {len(signatures)} normalized categories."
        )
        print("[critical build] Most frequent error categories:")
        for signature, count in signatures.most_common(30):
            print(f"  [{count}] {signature}")
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
        return text(source.get("image_url"))
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
    return value if math.isfinite(value) else None


def validate_price_integrity(products, errors: list[str]) -> None:
    """Enforce valid price pairs while allowing an explicit price-on-request state."""
    for product in products:
        pid = text(product.get("id"))
        raw_mrp = product.get("mrp")
        raw_selling = product.get("selling_price")
        has_mrp = raw_mrp not in (None, "")
        has_selling = raw_selling not in (None, "")

        # Blank/blank is a valid price-on-request state. A partially
        # populated price pair is never valid and blocks publication.
        if has_mrp != has_selling:
            errors.append(
                f"{pid}: MRP and selling_price must either both be present or both be blank"
            )
            continue

        if not has_mrp:
            continue

        mrp = number(raw_mrp)
        selling = number(raw_selling)
        if mrp is None:
            errors.append(f"{pid}: MRP is not numeric/finite: {raw_mrp!r}")
        if selling is None:
            errors.append(f"{pid}: selling_price is not numeric/finite: {raw_selling!r}")
        if mrp is None or selling is None:
            continue

        if mrp <= 0:
            errors.append(f"{pid}: MRP must be greater than zero when present: {mrp}")
        if selling <= 0:
            errors.append(f"{pid}: selling_price must be greater than zero when present: {selling}")
        if selling > mrp + 0.01:
            errors.append(f"{pid}: selling_price {selling} exceeds MRP {mrp}")

        discount = number(product.get("discount_percent"))
        if discount is not None and not 0 <= discount <= 100:
            errors.append(f"{pid}: discount_percent outside 0-100: {discount}")
        if discount is not None:
            expected = round((mrp - selling) / mrp * 100)
            if abs(discount - expected) > 1:
                errors.append(
                    f"{pid}: discount_percent {discount} disagrees with price-derived {expected}"
                )


def is_loadable_image(path: Path) -> bool:
    """Reject missing, empty, or obviously malformed image files by signature."""
    try:
        if not path.is_file() or path.stat().st_size < 16:
            return False
        with path.open("rb") as stream:
            header = stream.read(12)
    except OSError:
        return False

    suffix = path.suffix.casefold()
    if suffix == ".webp":
        return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    if suffix == ".png":
        return header[:8] == b"\x89PNG\r\n\x1a\n"
    if suffix in {".jpg", ".jpeg"}:
        return header[:3] == b"\xff\xd8\xff"
    if suffix == ".gif":
        return header[:6] in {b"GIF87a", b"GIF89a"}
    return False


def validate_images(products, errors: list[str]) -> None:
    for product in products:
        pid = text(product.get("id"))
        folder = text(product.get("image_folder") or pid)
        gallery = product.get("gallery")
        if not folder or Path(folder).name != folder:
            errors.append(f"{pid}: missing or unsafe image_folder")
            continue
        if not isinstance(gallery, list) or not gallery:
            errors.append(f"{pid}: active product has no usable product gallery")
            continue
        if len(gallery) > 4:
            errors.append(f"{pid}: product gallery exceeds the four-angle limit ({len(gallery)} images)")

        seen_names = set()
        seen_fingerprints = set()
        for index, raw_filename in enumerate(gallery, start=1):
            filename = text(raw_filename)
            if not filename:
                errors.append(f"{pid}: gallery image {index} is blank")
                continue
            if Path(filename).name != filename or Path(filename).is_absolute():
                errors.append(f"{pid}: unsafe gallery filename: {filename}")
                continue
            if filename in seen_names:
                errors.append(f"{pid}: duplicate gallery filename: {filename}")
                continue
            seen_names.add(filename)
            if filename.casefold() in {"placeholder.webp", "placeholder.jpg", "placeholder.png"}:
                errors.append(f"{pid}: placeholder image is not allowed in gallery: {filename}")
                continue
            image_path = ROOT / "assets" / "images" / "products" / folder / filename
            if not image_path.is_file():
                errors.append(f"{pid}: missing product image file: assets/images/products/{folder}/{filename}")
                continue
            if not is_loadable_image(image_path):
                errors.append(f"{pid}: product image is empty or has an invalid file signature: assets/images/products/{folder}/{filename}")
                continue
            try:
                fingerprint = hashlib.sha256(image_path.read_bytes()).hexdigest()
            except OSError:
                errors.append(f"{pid}: cannot read product image: assets/images/products/{folder}/{filename}")
                continue
            if fingerprint in seen_fingerprints:
                errors.append(f"{pid}: gallery contains duplicate image content: {filename}")
            seen_fingerprints.add(fingerprint)

        first = text(gallery[0]) if gallery else ""
        expected_url = f"/assets/images/products/{folder}/{first}" if first else ""
        if text(product.get("image_url")) != expected_url:
            errors.append(f"{pid}: image_url does not point to the first gallery image")
        if text(product.get("image")) != first:
            errors.append(f"{pid}: image does not match the first gallery image")
        if text(product.get("primary_image")) != first:
            errors.append(f"{pid}: primary_image does not match the first gallery image")


def validate_product_card_images(records_by_kind, errors: list[str]) -> None:
    """Keep every generated product card bound to its active catalogue image."""
    products = {
        text(product.get("id")): product
        for product in records_by_kind.get("products", [])
        if text(product.get("id"))
    }

    checked = 0
    for html_path in ROOT.glob("**/*.html"):
        if any(part in {".git", "node_modules"} for part in html_path.parts):
            continue
        raw = html_path.read_text(encoding="utf-8", errors="ignore")
        for card_match in re.finditer(
            r"<article\b[^>]*class\s*=\s*['\"][^'\"]*\bproduct-card\b[^'\"]*['\"][^>]*>.*?</article>",
            raw,
            flags=re.I | re.S,
        ):
            card = card_match.group(0)
            id_match = re.search(
                r"\bdata-saved-product-id\s*=\s*['\"]([^'\"]+)['\"]|\bdata-id\s*=\s*['\"]([^'\"]+)['\"]",
                card,
                flags=re.I,
            )
            if not id_match:
                errors.append(f"{html_path.relative_to(ROOT)}: product card is missing a product ID")
                continue
            pid = text(id_match.group(1) or id_match.group(2))
            product = products.get(pid)
            if product is None:
                errors.append(
                    f"{html_path.relative_to(ROOT)}: product card references inactive or unknown product {pid}"
                )
                continue

            image_match = re.search(
                r"<img\b(?=[^>]*\bclass\s*=\s*['\"][^'\"]*\bproduct-image-file\b[^'\"]*['\"])[^>]*>",
                card,
                flags=re.I | re.S,
            )
            if not image_match:
                errors.append(f"{html_path.relative_to(ROOT)}: product card {pid} has no product image element")
                continue

            tag = image_match.group(0)
            src_match = re.search(r"\bsrc\s*=\s*['\"]([^'\"]+)['\"]", tag, flags=re.I)
            state_match = re.search(r"\bdata-image-state\s*=\s*['\"]([^'\"]+)['\"]", tag, flags=re.I)
            src = text(src_match.group(1)) if src_match else ""
            state = text(state_match.group(1)) if state_match else ""
            expected_src = text(product.get("image_url"))
            if src != expected_src:
                errors.append(
                    f"{html_path.relative_to(ROOT)}: product card {pid} src {src!r} "
                    f"does not match catalogue image_url {expected_src!r}"
                )
            if state != "catalogue":
                errors.append(
                    f"{html_path.relative_to(ROOT)}: active product card {pid} has "
                    f"data-image-state={state!r}, expected 'catalogue'"
                )
            checked += 1

    print(f"[critical build] checked {checked} generated product-card image references.")


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


def canonical_tags_from_html(raw: str) -> list[str]:
    """Return every canonical URL, so duplicate tags cannot pass unnoticed."""
    values = []
    for tag in re.findall(r"<link\b[^>]*>", raw, flags=re.I):
        rel_match = re.search(r"""\brel\s*=\s*["']([^"']+)["']""", tag, flags=re.I)
        if not rel_match or "canonical" not in rel_match.group(1).lower().split():
            continue
        href_match = re.search(r"""\bhref\s*=\s*["']([^"']+)["']""", tag, flags=re.I)
        values.append(text(href_match.group(1)) if href_match else "")
    return values


def canonical_from_html(raw: str) -> str:
    values = canonical_tags_from_html(raw)
    return values[0] if values else ""


def metadata_values(raw: str, selector_attribute: str, selector_value: str) -> list[str]:
    """Return content values for matching meta property/name attributes."""
    values = []
    selector_pattern = re.compile(
        rf"""\b{re.escape(selector_attribute)}\s*=\s*["']([^"']+)["']""",
        flags=re.I,
    )
    content_pattern = re.compile(r"""\bcontent\s*=\s*["']([^"']*)["']""", flags=re.I)
    for tag in re.findall(r"<meta\b[^>]*>", raw, flags=re.I):
        selector = selector_pattern.search(tag)
        if not selector or selector.group(1).strip().casefold() != selector_value.casefold():
            continue
        content = content_pattern.search(tag)
        values.append(text(content.group(1)) if content else "")
    return values


def validate_homepage_url_contract(errors: list[str]) -> None:
    """Enforce one exact public URL contract for every homepage representation."""
    expected_canonicals = {
        "index.html": BASE + "/",
        "en/index.html": BASE + "/",
        "bn/index.html": BASE + "/bn/",
        "hi/index.html": BASE + "/hi/",
    }
    expected_hreflang = {
        "en": BASE + "/",
        "bn": BASE + "/bn/",
        "hi": BASE + "/hi/",
        "x-default": BASE + "/",
    }

    for relative_path, expected_canonical in expected_canonicals.items():
        path = ROOT / relative_path
        if not path.is_file():
            errors.append(f"Missing homepage file required by canonical contract: {relative_path}")
            continue

        raw = path.read_text(encoding="utf-8", errors="ignore")
        canonicals = canonical_tags_from_html(raw)
        if len(canonicals) != 1:
            errors.append(
                f"{relative_path}: expected exactly one canonical tag, found {len(canonicals)}"
            )
        elif canonicals[0] != expected_canonical:
            errors.append(
                f"{relative_path}: canonical {canonicals[0]!r} != {expected_canonical!r}"
            )

        links = hreflang_links(raw)
        for code, expected_url in expected_hreflang.items():
            values = links.get(code, [])
            if len(values) != 1:
                errors.append(
                    f"{relative_path}: expected exactly one hreflang={code}, found {len(values)}"
                )
            elif values[0] != expected_url:
                errors.append(
                    f"{relative_path}: hreflang={code} {values[0]!r} != {expected_url!r}"
                )

    # The English homepage's share-card URLs must not keep the obsolete /en/ URL.
    english_path = ROOT / "en" / "index.html"
    if english_path.is_file():
        raw = english_path.read_text(encoding="utf-8", errors="ignore")
        for attribute, key in (("property", "og:url"), ("name", "twitter:url")):
            values = metadata_values(raw, attribute, key)
            if len(values) != 1:
                errors.append(
                    f"en/index.html: expected exactly one {key} meta tag, found {len(values)}"
                )
            elif values[0] != BASE + "/":
                errors.append(
                    f"en/index.html: {key} {values[0]!r} != canonical homepage {BASE + '/'}"
                )


def validate_page_config_syntax(errors: list[str]) -> None:
    """Detect a missing comma that makes window.souviks invalid JavaScript."""
    missing_comma = re.compile(
        r'(?m)^[ \t]*currentPage:[ \t]*\r?\n[ \t]*"(?:\\.|[^"\\])*"[ \t]*(?:\r?\n[ \t]*)+currentPageType[ \t]*:'
    )
    paths = list(ROOT.glob("*.html"))
    for language in LANGUAGES:
        paths.extend(sorted((ROOT / language).rglob("*.html")))
    for path in sorted(set(paths)):
        if not path.is_file():
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")
        if missing_comma.search(raw):
            errors.append(
                f"{path.relative_to(ROOT)}: window.souviks currentPage is missing a comma before currentPageType"
            )


def validate_security_headers(errors: list[str]) -> None:
    """Validate headers in the site's root _headers file."""
    path = ROOT / "_headers"
    if not path.is_file():
        errors.append("Missing _headers security-header configuration")
        return

    blocks: dict[str, dict[str, str]] = {}
    current_block = None
    header_pattern = re.compile(r"^\s*([^:]+?)\s*:\s*(.*?)\s*$")

    for lineno, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if not line[0].isspace():
            current_block = stripped
            blocks.setdefault(current_block, {})
            continue

        match = header_pattern.match(line)
        if not match:
            errors.append(f"_headers:{lineno}: malformed header declaration")
            continue
        if current_block is None:
            errors.append(f"_headers:{lineno}: header appears before a path block")
            continue

        name = match.group(1).strip().casefold()
        value = match.group(2).strip()
        if name in blocks[current_block]:
            errors.append(f"_headers:{lineno}: duplicate {name} header in {current_block}")
        blocks[current_block][name] = value

    root_headers = blocks.get("/*", {})
    hsts = root_headers.get("strict-transport-security", "")
    if not hsts:
        errors.append("_headers /* block is missing Strict-Transport-Security")
    else:
        max_age_ok = re.search(
            r"(?:^|;)\s*max-age\s*=\s*31536000(?:\s*;|$)",
            hsts,
            flags=re.I,
        )
        directives = {part.strip().casefold() for part in hsts.split(";")}
        if not max_age_ok or "includesubdomains" not in directives or "preload" not in directives:
            errors.append(
                "_headers /* Strict-Transport-Security must include max-age=31536000, includeSubDomains and preload"
            )

    expected_values = {
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-frame-options": "sameorigin",
        "permissions-policy": (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), "
            "accelerometer=(), gyroscope=(), magnetometer=()"
        ),
    }
    for name, expected_value in expected_values.items():
        actual = root_headers.get(name, "")
        if actual.casefold() != expected_value.casefold():
            errors.append(
                f"_headers /* {name} {actual!r} != required {expected_value!r}"
            )

    # robots.txt is a critical static endpoint; pin its security headers explicitly
    # so edge/static handling cannot silently bypass the global header contract.
    robots_headers = blocks.get("/robots.txt", {})
    for name in (
        "strict-transport-security",
        "x-content-type-options",
        "referrer-policy",
        "x-frame-options",
        "permissions-policy",
        "content-security-policy",
    ):
        if not robots_headers.get(name):
            errors.append(f"_headers /robots.txt is missing {name}")
        elif robots_headers.get(name, "").casefold() != root_headers.get(name, "").casefold():
            errors.append(f"_headers /robots.txt {name} must match the global security policy")

    csp = root_headers.get("content-security-policy", "")
    if not csp:
        errors.append("_headers /* is missing Content-Security-Policy")
    else:
        directives: dict[str, set[str]] = {}
        for section in csp.split(";"):
            tokens = section.strip().split()
            if not tokens:
                continue
            directive = tokens[0].casefold()
            if directive in directives:
                errors.append(f"_headers /* CSP contains duplicate {directive} directive")
            directives[directive] = {token.casefold() for token in tokens[1:]}

        required_sources = {
            "default-src": {"'self'"},
            "base-uri": {"'self'"},
            "object-src": {"'none'"},
            "frame-ancestors": {"'self'"},
            "form-action": {"'self'"},
            "script-src": {
                "'self'", "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://www.googletagmanager.com",
                "https://static.cloudflareinsights.com",
            },
            "script-src-attr": {"'unsafe-inline'"},
            "style-src": {"'self'", "'unsafe-inline'", "https://fonts.googleapis.com"},
            "style-src-attr": {"'unsafe-inline'"},
            "img-src": {"'self'", "data:", "blob:", "https://www.google-analytics.com", "https://stats.g.doubleclick.net", "https://www.googletagmanager.com"},
            "font-src": {"'self'", "data:", "https://fonts.gstatic.com"},
            "connect-src": {
                "'self'",
                "https://kjxrfmujzdxatpgegqcs.supabase.co",
                "https://api.emailjs.com",
                "https://www.google-analytics.com",
                "https://region1.google-analytics.com",
                "https://analytics.google.com",
                "https://stats.g.doubleclick.net",
                "https://www.googletagmanager.com",
                "https://cloudflareinsights.com",
            },
            "frame-src": {"'self'", "https://www.google.com", "https://maps.google.com"},
            "manifest-src": {"'self'"},
            "worker-src": {"'self'", "blob:"},
        }
        for directive, sources in required_sources.items():
            actual_sources = directives.get(directive, set())
            missing = sources - actual_sources
            if missing:
                errors.append(
                    f"_headers /* CSP {directive} is missing required sources: "
                    + ", ".join(sorted(missing))
                )

        # This is a deliberate compatibility trade-off for existing static HTML:
        # pages use inline script blocks, script attributes and inline styles.
        # Keep external script/connect/frame origins explicitly allowlisted and
        # never allow eval(), arbitrary HTTPS hosts, data scripts, or plugins.
        forbidden_sources = {"'unsafe-eval'", "https:", "*", "data:"}
        for directive in ("default-src", "script-src", "style-src", "connect-src", "frame-src"):
            unexpected = directives.get(directive, set()) & forbidden_sources
            if unexpected:
                errors.append(
                    f"_headers /* CSP {directive} contains overly broad source(s): "
                    + ", ".join(sorted(unexpected))
                )

def robots_from_html(raw: str) -> str:
    for tag in re.findall(r"<meta\b[^>]*>", raw, flags=re.I):
        if re.search(r"\bname\s*=\s*[\"']robots[\"']", tag, flags=re.I):
            match = re.search(r"\bcontent\s*=\s*[\"']([^\"']+)[\"']", tag, flags=re.I)
            return text(match.group(1)).lower() if match else ""
    return ""


def hreflang_links(raw: str) -> dict[str, list[str]]:
    """Return alternate-language URLs grouped by hreflang code."""
    found: dict[str, list[str]] = {}
    for tag in re.findall(r"<link\b[^>]*>", raw, flags=re.I):
        rel_match = re.search(r"\brel\s*=\s*[\"']([^\"']+)[\"']", tag, flags=re.I)
        lang_match = re.search(r"\bhreflang\s*=\s*[\"']([^\"']+)[\"']", tag, flags=re.I)
        href_match = re.search(r"\bhref\s*=\s*[\"']([^\"']+)[\"']", tag, flags=re.I)
        if not (rel_match and lang_match and href_match):
            continue
        if "alternate" not in {item.strip().lower() for item in rel_match.group(1).split()}:
            continue
        code = lang_match.group(1).strip().lower()
        found.setdefault(code, []).append(href_match.group(1).strip())
    return found


def validate_hreflang(path: Path, language: str, errors: list[str]) -> None:
    """Require one exact alternate URL for every public language plus x-default."""
    parts = path.relative_to(ROOT).parts
    stem = path.stem

    # All language homepages alternate to the root English homepage and
    # the language-prefixed Bengali/Hindi routes. /en/ is not the canonical
    # English homepage; the root domain is.
    if len(parts) == 2 and parts[0] in LANGUAGES and stem == "index":
        expected = {
            "en": BASE + "/",
            "bn": BASE + "/bn/",
            "hi": BASE + "/hi/",
            "x-default": BASE + "/",
        }
    elif len(parts) == 2 and parts[0] in LANGUAGES:
        suffix = "/" if stem == "index" else f"/{stem}"
        expected = {lang: BASE + f"/{lang}{suffix}" for lang in LANGUAGES}
        expected["x-default"] = expected["en"]
    elif len(parts) == 3 and parts[0] in LANGUAGES:
        suffix = f"/{parts[1]}/{stem}"
        expected = {lang: BASE + f"/{lang}{suffix}" for lang in LANGUAGES}
        expected["x-default"] = BASE + f"/en{suffix}"
    else:
        return

    links = hreflang_links(path.read_text(encoding="utf-8", errors="ignore"))
    for code, expected_url in expected.items():
        values = links.get(code, [])
        if len(values) != 1:
            errors.append(
                f"{path.relative_to(ROOT)}: expected exactly one hreflang={code}, found {len(values)}"
            )
            continue
        if values[0].rstrip("/") != expected_url.rstrip("/"):
            errors.append(
                f"{path.relative_to(ROOT)}: hreflang={code} {values[0]!r} != {expected_url!r}"
            )
            continue

        target_path = html_path_for_route(urlsplit(expected_url).path)
        if target_path is None or not target_path.is_file():
            errors.append(
                f"{path.relative_to(ROOT)}: hreflang={code} points to a non-generated route: {expected_url}"
            )


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
    products_by_slug = {
        text(record.get("slug")): record
        for record in records_by_kind.get("products", [])
        if text(record.get("slug"))
    }
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
                # The root canonical belongs only to the English homepage, not entity pages.
                expected_canonical = BASE + expected_route
                canonical = canonical_from_html(raw)
                if canonical.rstrip("/") != expected_canonical.rstrip("/"):
                    errors.append(
                        f"{path.relative_to(ROOT)}: canonical {canonical!r} != {expected_canonical!r}"
                    )
                validate_hreflang(path, language, errors)

                if '<meta charset=' not in raw.lower():
                    errors.append(f"{path.relative_to(ROOT)}: missing charset declaration")
                if '<meta name="viewport"' not in raw.lower():
                    errors.append(f"{path.relative_to(ROOT)}: missing viewport declaration")

                if kind == "products":
                    page_label = str(path.relative_to(ROOT))
                    data_match = re.search(
                        r"window\.SOUVIKS_PRODUCT_PAGE_DATA\s*=\s*(\{.*?\});",
                        raw,
                        flags=re.S,
                    )
                    if not data_match:
                        errors.append(f"{page_label}: missing embedded product data")
                    else:
                        try:
                            embedded = json.loads(data_match.group(1))
                        except json.JSONDecodeError as exc:
                            errors.append(f"{page_label}: invalid embedded product JSON: {exc}")
                            embedded = None

                        source = products_by_slug.get(path.stem)
                        if source is None:
                            errors.append(f"{page_label}: no active master product maps to this page")
                        elif embedded is not None:
                            expected_gallery = [
                                text(name) for name in (source.get("gallery") or [])
                                if text(name)
                            ]
                            expected_folder = text(source.get("image_folder") or source.get("id"))
                            expected_image = expected_gallery[0] if expected_gallery else ""
                            expected_url = (
                                f"/assets/images/products/{expected_folder}/{expected_image}"
                                if expected_folder and expected_image else ""
                            )
                            for field, expected in (
                                ("image_folder", expected_folder),
                                ("gallery", expected_gallery),
                                ("image", expected_image),
                                ("primary_image", expected_image),
                                ("image_url", expected_url),
                            ):
                                actual = embedded.get(field)
                                if field == "gallery":
                                    actual = [text(name) for name in actual if text(name)] if isinstance(actual, list) else []
                                else:
                                    actual = text(actual)
                                if actual != expected:
                                    errors.append(
                                        f"{page_label}: embedded {field} {actual!r} does not match "
                                        f"catalogue value {expected!r}"
                                    )

                            main_image_match = re.search(
                                r"<img\b(?=[^>]*\bid\s*=\s*['\"]pdpMainImage['\"])[^>]*>",
                                raw,
                                flags=re.I | re.S,
                            )
                            if not main_image_match:
                                errors.append(f"{page_label}: missing PDP main image element")
                            else:
                                main_src_match = re.search(
                                    r"\bsrc\s*=\s*['\"]([^'\"]+)['\"]",
                                    main_image_match.group(0),
                                    flags=re.I,
                                )
                                main_src = text(main_src_match.group(1)) if main_src_match else ""
                                if main_src != expected_url:
                                    errors.append(
                                        f"{page_label}: PDP main image src {main_src!r} does not "
                                        f"match catalogue primary image {expected_url!r}"
                                    )

                            thumbs_match = re.search(
                                r"(<div\b[^>]*class\s*=\s*['\"][^'\"]*\bpdp-thumbnails\b[^'\"]*['\"][^>]*>)"
                                r"(.*?)</div>",
                                raw,
                                flags=re.I | re.S,
                            )
                            if not thumbs_match:
                                errors.append(f"{page_label}: missing PDP thumbnail gallery")
                            else:
                                actual_thumbs = re.findall(
                                    r"<img\b[^>]*\bsrc\s*=\s*['\"]([^'\"]+)['\"][^>]*>",
                                    thumbs_match.group(2),
                                    flags=re.I | re.S,
                                )
                                expected_thumbs = [
                                    f"/assets/images/products/{expected_folder}/{name}"
                                    for name in expected_gallery
                                ]
                                if actual_thumbs != expected_thumbs:
                                    errors.append(
                                        f"{page_label}: thumbnail URLs do not match catalogue gallery "
                                        f"(expected {expected_thumbs!r}, found {actual_thumbs!r})"
                                    )

    # Canonical parity also applies to top-level language/static pages.
    static_pages = []
    for language in LANGUAGES:
        for path in sorted((ROOT / language).glob("*.html")):
            if path.name == "404.html":
                continue
            static_pages.append((language, path))
    for language, path in static_pages:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        parser = HTMLContractParser(path, errors)
        try:
            parser.feed(raw)
            parser.close()
        except Exception as exc:
            errors.append(f"{path.relative_to(ROOT)}: HTML parser failure: {exc}")
        parser.finish()

        expected_route = f"/{language}/" if path.stem == "index" else f"/{language}/{path.stem}"
        # English homepage owns the root canonical URL; localized homepages
        # retain their localized canonical route.
        expected_canonical = (
            BASE + "/"
            if path.stem == "index" and language == "en"
            else BASE + expected_route
        )
        canonical = canonical_from_html(raw)
        if canonical.rstrip("/") != expected_canonical.rstrip("/"):
            errors.append(
                f"{path.relative_to(ROOT)}: canonical {canonical!r} != {expected_canonical!r}"
            )
        validate_hreflang(path, language, errors)

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

    concrete_sources: dict[str, str] = {}
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

        if source == "https://souviks.co.in/" and status == "200":
            errors.append(
                f"_redirects:{lineno}: host-based root 200 rules are unsupported; use functions/_middleware.js"
            )
        source_url_for_host_rule = urlsplit(source)
        if source_url_for_host_rule.scheme and source_url_for_host_rule.netloc.lower() != "www.souviks.co.in":
            errors.append(
                f"_redirects:{lineno}: host-based source rules are unsupported by Pages _redirects; use functions/_middleware.js"
            )

        if not any(token in source for token in (":splat", ":lang", ":slug", "*")):
            previous_destination = concrete_sources.get(source)
            if previous_destination and previous_destination != destination:
                errors.append(
                    f"_redirects:{lineno}: duplicate concrete source has conflicting destinations: "
                    f"{source} -> {previous_destination!r} and {destination!r}"
                )
            concrete_sources[source] = destination

        source_url = urlsplit(source)
        source_path = source_url.path if source_url.scheme else source
        if source_path.rstrip("/") in expected_routes and (
            not source_url.netloc or source_url.netloc.lower() == "www.souviks.co.in"
        ):
            errors.append(
                f"_redirects:{lineno}: canonical public URL is configured as a redirect source: {source}"
            )

        if destination.endswith(".html"):
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

def validate_pages_routes(errors: list[str]) -> None:
    """Keep required HTML/SEO responses on middleware while avoiding function calls for heavy assets."""
    path = ROOT / "_routes.json"
    if not path.is_file():
        errors.append("Missing _routes.json for explicit Pages Function routing")
        return

    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"_routes.json: invalid JSON: {exc}")
        return

    include = config.get("include", [])
    exclude = config.get("exclude", [])
    if config.get("version") != 1:
        errors.append("_routes.json: expected schema version 1")
    if not isinstance(include, list) or "/*" not in include:
        errors.append('_routes.json: include must contain "/*" so middleware covers app routes')
        return
    if not isinstance(exclude, list):
        errors.append("_routes.json: exclude must be an array")
        return
    if "/assets/*" not in exclude:
        errors.append('_routes.json: exclude must contain "/assets/*" to avoid invoking Functions for product images, scripts and data')

    def matches(pattern: str, route: str) -> bool:
        if not isinstance(pattern, str):
            return False
        return re.fullmatch(re.escape(pattern).replace(r"\*", ".*"), route) is not None

    for route in ("/", "/robots.txt", "/sitemap.xml", "/sitemaps/pages.xml", "/en/products"):
        included = any(matches(pattern, route) for pattern in include)
        excluded = any(matches(pattern, route) for pattern in exclude)
        if not included or excluded:
            errors.append(f"_routes.json: {route} must pass through Pages middleware")

    for route in ("/assets/data/products.json", "/assets/js/site-core.js"):
        if not any(matches(pattern, route) for pattern in exclude):
            errors.append(f"_routes.json: {route} should bypass middleware as a static asset")


def validate_pages_middleware(errors: list[str]) -> None:
    """Guard hostname redirects and hardening that Pages _redirects/_headers cannot guarantee."""
    path = ROOT / "functions" / "_middleware.js"
    if not path.is_file():
        errors.append("Missing functions/_middleware.js for canonical hostname redirects and response headers")
        return

    source = path.read_text(encoding="utf-8", errors="ignore")
    required_hosts = (
        "souviks.co.in",
        "w.souviks.co.in",
        "ww.souviks.co.in",
        "ww2.souviks.co.in",
        "wwe.souviks.co.in",
        "wwww.souviks.co.in",
        "qqq.souviks.co.in",
    )
    for host in required_hosts:
        if f'"{host}"' not in source:
            errors.append(f"functions/_middleware.js: missing legacy host {host}")

    required_fragments = (
        "new URL(request.url)",
        'url.hostname = CANONICAL_HOST',
        "Response.redirect(url.toString(), 301)",
        "const response = await next()",
        '"Strict-Transport-Security"',
        '"X-Content-Type-Options"',
        '"Referrer-Policy"',
        '"X-Frame-Options"',
        '"Permissions-Policy"',
        '"Content-Security-Policy"',
        "headers.set(name, value)",
    )
    for fragment in required_fragments:
        if fragment not in source:
            errors.append(f"functions/_middleware.js: missing required behavior {fragment!r}")


def sitemap_urls(path: Path, errors: list[str]) -> set[str]:
    if not path.is_file():
        errors.append(f"Missing sitemap: {path.relative_to(ROOT)}")
        return set()
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if "<urlset" not in raw and "<sitemapindex" not in raw:
        errors.append(f"{path.relative_to(ROOT)}: malformed sitemap root")
    return set(re.findall(r"<loc>([^<]+)</loc>", raw))


def validate_robots_and_sitemap_index(errors: list[str]) -> None:
    robots_path = ROOT / "robots.txt"
    if not robots_path.is_file():
        errors.append("Missing robots.txt")
    else:
        robots = robots_path.read_text(encoding="utf-8", errors="ignore")
        sitemap_lines = [
            text(line.split(":", 1)[1])
            for line in robots.splitlines()
            if line.strip().lower().startswith("sitemap:")
            and ":" in line
        ]
        expected_robots_sitemap = BASE + "/sitemap.xml"
        if sitemap_lines != [expected_robots_sitemap]:
            errors.append(
                "robots.txt must expose exactly one canonical sitemap: "
                + ", ".join(sitemap_lines or ["<none>"])
            )

    index_path = ROOT / "sitemap.xml"
    if not index_path.is_file():
        errors.append("Missing sitemap.xml")
        return
    index_urls = sitemap_urls(index_path, errors)
    expected_index_urls = {
        BASE + "/sitemaps/pages.xml",
        BASE + "/sitemaps/products.xml",
        BASE + "/sitemaps/brands.xml",
        BASE + "/sitemaps/categories.xml",
        BASE + "/sitemaps/vehicles.xml",
    }
    missing = sorted(expected_index_urls - index_urls)
    extra = sorted(index_urls - expected_index_urls)
    for url in missing:
        errors.append(f"sitemap.xml missing indexed sitemap: {url}")
    for url in extra:
        errors.append(f"sitemap.xml contains unexpected sitemap: {url}")
    for url in index_urls:
        path = ROOT / urlsplit(url).path.lstrip("/")
        if not path.is_file():
            errors.append(f"sitemap.xml points to missing sitemap file: {url}")


def validate_sitemaps(records_by_kind, errors: list[str]) -> None:
    static_names = {
        "index", "products", "brands", "categories", "vehicles",
        "about", "contact", "privacy-policy", "terms", "refund",
    }
    expected = {
        "pages.xml": {
            BASE + (
                "/" if name == "index" and lang == "en"
                else f"/{lang}/" if name == "index"
                else f"/{lang}/{name}"
            )
            for lang in LANGUAGES
            for name in static_names
        },
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
        if filename == "pages.xml" and BASE + "/en/" in actual:
            errors.append(
                f"pages.xml: English homepage must use {BASE + '/'}; {BASE + '/en/'} is not its canonical URL"
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
                relative_asset = path.lstrip("/")
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
                actual = text(actual)
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




def validate_catalogue_reference_integrity(
    products: list[dict],
    brands: list[dict],
    categories: list[dict],
    vehicles: list[dict],
    errors: list[str],
    warnings: list[str],
) -> None:
    """Check catalogue foreign keys against the approved entity masters.

    Product vehicle applications are currently stored as display labels rather
    than consistently-normalized IDs, so unresolved vehicle labels are reported
    for review instead of blocking publication until the source data is curated.
    """
    def key(value) -> str:
        return re.sub(r"\s+", " ", text(value)).casefold()

    brand_by_id = {
        text(item.get("id")): item for item in brands
        if text(item.get("id"))
    }
    category_by_id = {
        text(item.get("id")): item for item in categories
        if text(item.get("id"))
    }
    subcategories_by_category = {}
    for category_id, category in category_by_id.items():
        subcategories_by_category[category_id] = {
            text(sub.get("id")): sub
            for sub in category.get("subcategories", [])
            if isinstance(sub, dict) and text(sub.get("id"))
        }

    vehicle_aliases = set()
    for vehicle in vehicles:
        for field in ("id", "slug", "model", "name"):
            alias = key(vehicle.get(field))
            if alias:
                vehicle_aliases.add(alias)
        model = text(vehicle.get("model"))
        variant = text(vehicle.get("variant"))
        if model and variant:
            vehicle_aliases.add(key(f"{model} {variant}"))

    for product in products:
        pid = text(product.get("id")) or "<missing-id>"
        brand_id = text(product.get("brand_id"))
        category_id = text(product.get("category_id"))
        subcategory_id = text(product.get("subcategory_id"))

        if brand_id and brand_id not in brand_by_id:
            errors.append(f"{pid}: brand_id {brand_id!r} is absent from active brands.json")
        elif brand_id:
            expected_name = key(brand_by_id[brand_id].get("name"))
            actual_name = key(product.get("brand_name") or product.get("brand"))
            if expected_name and actual_name and expected_name != actual_name:
                warnings.append(
                    f"{pid}: brand label {product.get('brand_name') or product.get('brand')!r} "
                    f"differs from brands.json label {brand_by_id[brand_id].get('name')!r}"
                )

        if not category_id:
            errors.append(f"{pid}: active product has no category_id")
        elif category_id not in category_by_id:
            errors.append(f"{pid}: category_id {category_id!r} is absent from active categories.json")
        else:
            category = category_by_id[category_id]
            expected_name = key(category.get("name"))
            actual_name = key(product.get("category_name") or product.get("category"))
            if expected_name and actual_name and expected_name != actual_name:
                warnings.append(
                    f"{pid}: category label {product.get('category_name') or product.get('category')!r} "
                    f"differs from categories.json label {category.get('name')!r}"
                )
            if subcategory_id:
                subcategory = subcategories_by_category.get(category_id, {}).get(subcategory_id)
                if subcategory is None:
                    errors.append(
                        f"{pid}: subcategory_id {subcategory_id!r} is not defined under category {category_id!r}"
                    )
                else:
                    expected_subcategory = key(subcategory.get("name"))
                    actual_subcategory = key(product.get("subcategory_name") or product.get("subcategory"))
                    if expected_subcategory and actual_subcategory and expected_subcategory != actual_subcategory:
                        warnings.append(
                            f"{pid}: subcategory label {product.get('subcategory_name') or product.get('subcategory')!r} "
                            f"differs from categories.json label {subcategory.get('name')!r}"
                        )

        for vehicle_value in arrayish(product.get("vehicles")):
            if key(vehicle_value) not in vehicle_aliases:
                warnings.append(
                    f"{pid}: vehicle application {vehicle_value!r} does not exactly resolve to vehicles.json"
                )



def validate_category_counter_parity(categories: list[dict], errors: list[str]) -> None:
    """Keep the active category master, visible listing counters and category sitemap in parity."""
    active = [
        category for category in categories
        if isinstance(category, dict) and category.get("active") is not False
    ]
    expected_count = len(active)
    expected_slugs = {
        text(category.get("slug"))
        for category in active
        if text(category.get("slug"))
    }
    if len(expected_slugs) != expected_count:
        errors.append(
            "categories master: every active category must have a unique non-empty slug "
            "for the visible counter and sitemap to remain in parity"
        )

    for language in ("en", "hi", "bn"):
        listing = ROOT / language / "categories.html"
        if not listing.is_file():
            errors.append(f"{listing.relative_to(ROOT)}: missing category listing for A51 counter check")
            continue
        raw = listing.read_text(encoding="utf-8", errors="ignore")
        counters = re.findall(
            r"""<span\b(?=[^>]*\bid=["']visibleCategories["'])[^>]*>([\s\S]*?)</span>""",
            raw,
            flags=re.I,
        )
        if len(counters) != 1:
            errors.append(
                f"{listing.relative_to(ROOT)}: expected exactly one #visibleCategories counter, found {len(counters)}"
            )
        else:
            counter_text = re.sub(r"<[^>]+>", "", counters[0]).strip()
            counter_text = re.sub(r"[,\s]", "", counter_text)
            if not counter_text.isdigit() or int(counter_text) != expected_count:
                errors.append(
                    f"{listing.relative_to(ROOT)}: #visibleCategories is {counter_text!r}; "
                    f"active categories master requires {expected_count}"
                )

        if not re.search(r"""<[^>]+\bid=["']categoryGrid["']""", raw, flags=re.I):
            errors.append(f"{listing.relative_to(ROOT)}: missing #categoryGrid for A51 counter check")
        cards = re.findall(
            r"""<article\b(?=[^>]*\bclass=["'][^"']*\bcategory-card\b[^"']*["'])""",
            raw,
            flags=re.I,
        )
        if len(cards) != expected_count:
            errors.append(
                f"{listing.relative_to(ROOT)}: found {len(cards)} category cards; "
                f"active categories master requires {expected_count}"
            )

        # Check the hero statistic and both sides of the "shown of total" counter.
        hero_blocks = re.findall(
            r'<div\\b[^>]*class=["\\'][^"\\']*\\bhero-stat\\b[^"\\']*["\\'][^>]*>[\\s\\S]*?</div>',
            raw,
            flags=re.I,
        )
        category_labels = {
            "en": ("Categories",),
            "hi": ("श्रेणियाँ", "श्रेणियां"),
            "bn": ("বিভাগসমূহ", "বিভাগ"),
        }[language]
        category_stat_values = []
        for block in hero_blocks:
            label_match = re.search(
                r'<span\\b[^>]*class=["\\'][^"\\']*\\bstat-label\\b[^"\\']*["\\'][^>]*>([\\s\\S]*?)</span>',
                block,
                flags=re.I,
            )
            label = re.sub(r"<[^>]+>", "", label_match.group(1)).strip() if label_match else ""
            if any(token in label for token in category_labels):
                value_match = re.search(
                    r'<span\\b[^>]*class=["\\'][^"\\']*\\bstat-number\\b[^"\\']*["\\'][^>]*>([\\s\\S]*?)</span>',
                    block,
                    flags=re.I,
                )
                if value_match:
                    category_stat_values.append(re.sub(r"<[^>]+>", "", value_match.group(1)).strip())
        if len(category_stat_values) != 1 or not category_stat_values[0].isdigit() or int(category_stat_values[0]) != expected_count:
            errors.append(
                f"{listing.relative_to(ROOT)}: category hero statistic is {category_stat_values!r}; "
                f"active categories master requires {expected_count}"
            )

        after_counter = re.search(
            r'<span\\b(?=[^>]*\\bid=["\\']visibleCategories["\\'])[^>]*>[\\s\\S]*?</span>([\\s\\S]{0,160}?<span\\b[^>]*>)([\\s\\S]*?)(</span>)',
            raw,
            flags=re.I,
        )
        if not after_counter:
            errors.append(f"{listing.relative_to(ROOT)}: missing category total denominator after #visibleCategories")
        else:
            denominator = re.sub(r"<[^>]+>", "", after_counter.group(2)).strip()
            denominator = re.sub(r"[,\\s]", "", denominator)
            if not denominator.isdigit() or int(denominator) != expected_count:
                errors.append(
                    f"{listing.relative_to(ROOT)}: category total denominator is {denominator!r}; "
                    f"active categories master requires {expected_count}"
                )

    sitemap_path = ROOT / "sitemaps" / "categories.xml"
    sitemap = sitemap_urls(sitemap_path, errors)
    for language in ("en", "hi", "bn"):
        prefix = BASE + f"/{language}/categories/"
        actual_urls = {url for url in sitemap if url.startswith(prefix)}
        expected_urls = {
            BASE + f"/{language}/categories/{slug}"
            for slug in expected_slugs
        }
        if len(actual_urls) != expected_count:
            errors.append(
                f"sitemaps/categories.xml: {language} has {len(actual_urls)} category URLs; "
                f"active categories master requires {expected_count}"
            )
        missing = sorted(expected_urls - actual_urls)
        extra = sorted(actual_urls - expected_urls)
        if missing:
            errors.append(
                f"sitemaps/categories.xml: {language} is missing active category URLs: "
                + ", ".join(missing[:10])
            )
        if extra:
            errors.append(
                f"sitemaps/categories.xml: {language} has URLs absent from the active category master: "
                + ", ".join(extra[:10])
            )

    total_expected = expected_count * 3
    if len(sitemap) != total_expected:
        errors.append(
            f"sitemaps/categories.xml: has {len(sitemap)} unique URLs; "
            f"active categories master requires {total_expected} across en/hi/bn"
        )

def main() -> None:
    errors: list[str] = []
    validate_homepage_url_contract(errors)
    validate_security_headers(errors)
    validate_page_config_syntax(errors)
    records_by_kind = validate_critical_catalogue_contract(errors)
    reference_warnings: list[str] = []
    validate_catalogue_reference_integrity(
        records_by_kind["products"], records_by_kind["brands"],
        records_by_kind["categories"], records_by_kind["vehicles"],
        errors, reference_warnings,
    )
    if reference_warnings:
        print(f"[critical build] catalogue reference warnings: {len(reference_warnings)}")
        for warning in reference_warnings[:30]:
            print(f"[catalogue reference warning] {warning}")
        if len(reference_warnings) > 30:
            print(f"[catalogue reference warning] ... and {len(reference_warnings) - 30} more")
    expected_routes = validate_generated_html_and_routes(records_by_kind, errors)
    validate_product_card_images(records_by_kind, errors)
    validate_redirects(expected_routes, errors)
    validate_pages_middleware(errors)
    validate_pages_routes(errors)
    validate_robots_and_sitemap_index(errors)
    validate_sitemaps(records_by_kind, errors)
    validate_category_counter_parity(records_by_kind["categories"], errors)
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
