#!/usr/bin/env python3
"""Validate Souviks JavaScript bundle boundaries.

The site uses classic scripts: site-core.js owns shared runtime behaviour,
while page bundles own page-specific behaviour. Account pages use the same
shared core; account.js retains only account-specific behaviour.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
JS_ROOT = ROOT / "assets" / "js"
BUNDLES = JS_ROOT / "bundles"

SHARED_MARKERS = {
    "main.js",
    "image-protection.js",
}

SITE_CORE = JS_ROOT / "site-core.js"
ACCOUNT_MODULES = (
    "analytics-account-analytics.js",
    "auth-register.js",
    "rfq.js",
    "rfq-submit.js",
    "auth-inquiries.js",
    "auth-saved.js",
    "auth-vehicles.js",
    "auth-vehicle-recommendations.js",
    "auth-account.js",
)
PAGE_MODULES = {
    "account.js": tuple(f"/assets/js/account/{module}" for module in ACCOUNT_MODULES),
    "products.js": (
        "/assets/js/request-quote/rfq.js",
        "/assets/js/components/product-card.js",
        "/assets/js/products/search-engine.js",
        "/assets/js/products/voice-search.js",
        "/assets/js/products/filters.js",
        "/assets/js/products/pagination.js",
        "/assets/js/products/products.js",
        "/assets/js/products/webmcp.js",
        "/assets/js/products/products-page.js",
        "/assets/js/products/souviks-refresh-static-product-card-images-from-canonical-catalogue.js",
    ),
    "product.js": (
        "/assets/js/request-quote/rfq.js",
        "/assets/js/components/product-card.js",
        "/assets/js/product/products.js",
        "/assets/js/product/product-page.js",
    ),
    "request-quote.js": (
        "/assets/js/request-quote/rfq.js",
        "/assets/js/request-quote/standalone-rfq-submission.js",
    ),
}

CATALOGUE_CORE_MODULES = {
    path
    for name in ("account.js", "products.js", "product.js")
    for path in PAGE_MODULES[name]
}


def expected_page_bundle(html_path: Path, language: str) -> str | None:
    """Return the split page entrypoint applicable to this generated route."""
    if html_path.name == "account.html":
        return "account.js"
    if html_path.name == "products.html" and html_path.parent.name == language:
        return "products.js"
    if html_path.name == "request-quote.html":
        return "request-quote.js"
    if (
        html_path.parent.name == "products"
        and html_path.parent.parent.name == language
    ):
        return "product.js"
    return None

def fail(message: str) -> None:
    print(f"[JS architecture] ERROR: {message}")
    raise SystemExit(1)

def script_sources(html: str) -> list[str]:
    return [
        src.split("?", 1)[0]
        for src in re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html, flags=re.I)
    ]


def validate_auth_ownership(errors: list[str]) -> None:
    """Ensure the shared core is the sole owner of Supabase auth lifecycle."""
    candidates = sorted(set(JS_ROOT.glob("**/*.js")))
    client_defs = []
    auth_listeners = []

    for path in candidates:
        source = path.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"\bsupabase\.createClient\s*\(", source):
            client_defs.append(path.relative_to(ROOT).as_posix())
        if re.search(r"\bsupabaseClient\.auth\.onAuthStateChange\s*\(", source):
            auth_listeners.append(path.relative_to(ROOT).as_posix())

    if client_defs != ["assets/js/site-core.js"]:
        errors.append(
            "Supabase client must be defined only in assets/js/site-core.js; "
            f"found {client_defs}"
        )
    if auth_listeners != ["assets/js/site-core.js"]:
        errors.append(
            "Supabase auth-state subscription must be defined only in "
            f"assets/js/site-core.js; found {auth_listeners}"
        )

def main() -> None:
    if not SITE_CORE.is_file():
        fail("assets/js/site-core.js is missing.")

    errors: list[str] = []
    validate_auth_ownership(errors)

    # All browser JavaScript modules use lowercase kebab-case; numeric utility
    # pages such as 404.js are explicitly permitted.
    js_name_pattern = re.compile(r"^(?:[0-9]+|[a-z0-9]+(?:-[a-z0-9]+)*)\.js$")
    for module in sorted(JS_ROOT.glob("**/*.js")):
        if module.name == "check-syntax.js":
            continue
        if not js_name_pattern.fullmatch(module.name):
            errors.append(f"{module.relative_to(ROOT)} has a non-standard JS module name.")

    css_root = ROOT / "assets" / "css" / "bundles"
    css_name_pattern = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*\.css$")
    for stylesheet in sorted(css_root.glob("**/*.css")):
        if not css_name_pattern.fullmatch(stylesheet.name):
            errors.append(f"{stylesheet.relative_to(ROOT)} has a non-standard CSS module name.")

    compatibility_bundles = {"account.js", "products.js", "product.js", "request-quote.js"}
    for bundle in sorted(BUNDLES.glob("*.js")):
        text = bundle.read_text(encoding="utf-8")
        if bundle.name in compatibility_bundles and len(text.encode("utf-8")) > 4096:
            errors.append(
                f"{bundle.relative_to(ROOT)} has grown beyond compatibility-stub size; "
                "page code must live in explicit modules."
            )
        markers = set(re.findall(r"/\* ===== ([^\n*]+?) ===== \*/", text))
        shared = sorted(markers & SHARED_MARKERS)

        if shared:
            errors.append(
                f"{bundle.relative_to(ROOT)} contains shared modules: {', '.join(shared)}"
            )

    for language in ("en", "bn", "hi"):
        for html_path in sorted((ROOT / language).rglob("*.html")):
            html = html_path.read_text(encoding="utf-8")
            sources = script_sources(html)
            bundle_sources = [src for src in sources if "/assets/js/bundles/" in src]
            page_module_sources = [
                src for src in sources
                if any(src in module_paths for module_paths in PAGE_MODULES.values())
            ]
            if not bundle_sources and not page_module_sources:
                continue

            has_core = "/assets/js/site-core.js" in sources
            if not has_core:
                errors.append(
                    f"{html_path.relative_to(ROOT)} loads a page bundle/module without site-core.js."
                )
            else:
                core_index = sources.index("/assets/js/site-core.js")
                for src in bundle_sources + page_module_sources:
                    if sources.index(src) < core_index:
                        errors.append(
                            f"{html_path.relative_to(ROOT)} loads {src} before site-core.js."
                        )

            if page_module_sources:
                requires_catalogue_core = any(
                    src in CATALOGUE_CORE_MODULES
                    and src != "/assets/js/request-quote/rfq.js"
                    for src in page_module_sources
                )
                if requires_catalogue_core and "/assets/js/catalogue-core.js" not in sources:
                    errors.append(
                        f"{html_path.relative_to(ROOT)} loads catalogue modules without catalogue-core.js."
                    )
                elif "/assets/js/catalogue-core.js" in sources:
                    catalogue_index = sources.index("/assets/js/catalogue-core.js")
                    for src in page_module_sources:
                        if src in CATALOGUE_CORE_MODULES and sources.index(src) < catalogue_index:
                            errors.append(
                                f"{html_path.relative_to(ROOT)} loads {src} before catalogue-core.js."
                            )

            entrypoint = expected_page_bundle(html_path, language)
            if entrypoint:
                legacy_path = f"/assets/js/bundles/{entrypoint}"
                if legacy_path in sources:
                    errors.append(
                        f"{html_path.relative_to(ROOT)} still loads legacy {entrypoint}; "
                        "load its split modules directly."
                    )
                expected = list(PAGE_MODULES[entrypoint])
                loaded = [src for src in sources if src in expected]
                if loaded != expected:
                    errors.append(
                        f"{html_path.relative_to(ROOT)} {entrypoint} module order/parity mismatch: "
                        f"expected {expected}, got {loaded}"
                    )

    if errors:
        for error in errors:
            print(f"[JS architecture] ERROR: {error}")
        raise SystemExit(1)

    print("[JS architecture] OK: shared runtime boundaries and script ordering are valid.")

if __name__ == "__main__":
    main()
