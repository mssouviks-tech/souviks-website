#!/usr/bin/env python3
"""Deterministically split shared JS runtime from static page bundles."""

from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parents[2]
BUNDLES = ROOT / "assets" / "js" / "bundles"
CORE_PATH = ROOT / "assets" / "js" / "site-core.js"
LANGUAGES = ("en", "bn", "hi")

ACCOUNT_BUNDLE = "account.js"
KNOWN_BUNDLES = {
    "404.js", "about.js", "account.js", "brand.js", "brands.js", "categories.js", "category.js",
    "contact.js", "forgot-password.js", "index.js", "login.js", "privacy-policy.js",
    "product.js", "products.js", "refund.js", "register.js", "request-part.js",
    "request-quote.js", "reset-password.js", "terms.js", "thank-you.js",
    "vehicle.js", "vehicles.js",
}

COMMON_END = "/* ===== main.js ===== */"
COMMON_END_LABEL = "/* ===== image-protection.js ===== */"
READY = "window.SOUVIKS_SITE_CORE_READY = true;"
READY_RE = re.compile(r"window\\.SOUVIKS_SITE_CORE_READY\\s*=\\s*(?:true|!0)\\s*;?")
SHARED_CORE_PREFIX = "/* Shared core is loaded by the HTML page before this bundle. */"

CATALOGUE_SHARED_MARKERS = {
    "api.js",
    "breadcrumb.js",
    "saved-products.js",
}

ACCOUNT_SHARED_MARKERS = {
    "accessibility/core-a11y.js",
    "auth/supabase.js",
    "auth/auth-modal.js",
    "auth/auth-state.js",
    "auth/logout.js",
    "utils.js",
    "language-switcher.js",
    "main.js",
}
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
    "account.js": tuple(f"assets/js/account/{module}" for module in ACCOUNT_MODULES),
    "products.js": (
        "assets/js/components/product-card.js",
        "assets/js/products/search-engine.js",
        "assets/js/products/voice-search.js",
        "assets/js/products/filters.js",
        "assets/js/products/pagination.js",
        "assets/js/products/products.js",
        "assets/js/products/webmcp.js",
        "assets/js/products/products-page.js",
        "assets/js/products/souviks-refresh-static-product-card-images-from-canonical-catalogue.js",
    ),
    "product.js": (
        "assets/js/components/product-card.js",
        "assets/js/product/products.js",
        "assets/js/product/product-page.js",
    ),
    "request-quote.js": (
        "assets/js/request-quote/rfq.js",
        "assets/js/request-quote/standalone-rfq-submission.js",
    ),
}




def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def extract_core() -> str:
    if CORE_PATH.exists():
        core = read(CORE_PATH)
        if not READY_RE.search(core):
            raise ValueError("Existing site-core.js is missing readiness marker")
        return core

    source = read(BUNDLES / "404.js")
    end = source.index(COMMON_END)
    core = source[:end].rstrip() + f"\n\n{READY}\n"
    return (
        "/* ==========================================================\n"
        "   SOUVIKS — SHARED SITE JAVASCRIPT CORE\n"
        "   Utilities, authentication and language handling.\n"
        "   Page-specific behaviour remains in page bundles.\n"
        "========================================================== */\n\n"
        + core
    )


def strip_marked_sections(source: str, excluded_markers: set[str]) -> str:
    """Remove historical concatenated module sections that now live in site-core.js."""
    marker_re = re.compile(r"/\* ===== ([^\n*]+?) ===== \*/")
    matches = list(marker_re.finditer(source))
    if not matches:
        return source

    chunks = []
    cursor = 0
    for index, match in enumerate(matches):
        marker = match.group(1).strip()
        if marker not in excluded_markers:
            continue
        chunks.append(source[cursor:match.start()])
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(source)
        cursor = next_start
    chunks.append(source[cursor:])
    return "".join(chunks)


def build_page_bundle(filename: str) -> str:
    source = read(BUNDLES / filename)

    if source.startswith(SHARED_CORE_PREFIX):
        source = source[len(SHARED_CORE_PREFIX):].lstrip()

    # Catalogue-wide modules are loaded once by catalogue-core.js.
    source = strip_marked_sections(source, CATALOGUE_SHARED_MARKERS)

    if filename in PAGE_MODULES:
        # Compatibility entrypoint retained for direct legacy references.
        # Actual page behaviour is loaded from explicit ordered modules.
        return (
            "/* Page runtime modules are loaded directly by the page. "
            "This compatibility bundle is intentionally empty. */\n"
        )

    if source.startswith("/* No page-specific JavaScript. Shared behavior is loaded by /assets/js/site-core.js. */"):
        return source

    start = source.find(COMMON_END)
    if start == -1:
        # Already-migrated entity bundles can legitimately lack the legacy
        # main.js delimiters. Preserve their page-specific modules.
        return SHARED_CORE_PREFIX + "\n\n" + source.lstrip()

    page_marker = source.find(COMMON_END_LABEL, start)
    if page_marker == -1:
        raise ValueError(f"{filename} is missing image-protection marker")
    return (
        SHARED_CORE_PREFIX + "\n\n"
        + source[page_marker + len(COMMON_END_LABEL):].lstrip()
    )


CATALOGUE_CORE_BUNDLES = {
    "account.js",
    "brand.js",
    "brands.js",
    "categories.js",
    "category.js",
    "index.js",
    "product.js",
    "products.js",
    "vehicle.js",
    "vehicles.js",
}


def asset_version(path: Path) -> str:
    """Return a deterministic content hash used to bust edge caches."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def versioned_asset_url(relative_path: str) -> str:
    path = ROOT / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Cannot version missing asset: {relative_path}")
    return f"/{relative_path}?v={asset_version(path)}"


def migrate_html() -> int:
    changed = 0
    bundle_pattern = re.compile(
        r'<script\s+defer\s+src="/assets/js/bundles/([^"?]+)(?:\?[^"]*)?"></script>'
    )
    core_pattern = re.compile(
        r'<script\s+defer\s+src="/assets/js/site-core\.js(?:\?[^"]*)?"></script>'
    )
    catalogue_core_pattern = re.compile(
        r'<script\s+defer\s+src="/assets/js/catalogue-core\.js(?:\?[^"]*)?"></script>'
    )
    css_pattern = re.compile(
        r'(<link\s+[^>]*href="/assets/css/)([^"?]+)(?:\?[^"]*)?(")',
        re.IGNORECASE
    )

    core_tag = f'<script defer src="{versioned_asset_url("assets/js/site-core.js")}"></script>'
    catalogue_core_tag = f'<script defer src="{versioned_asset_url("assets/js/catalogue-core.js")}"></script>'

    paths = []
    for language in LANGUAGES:
        root = ROOT / language
        if root.exists():
            paths.extend(root.rglob("*.html"))

    root_404 = ROOT / "404.html"
    if root_404.exists():
        paths.append(root_404)

    for path in sorted(set(paths)):
        content = read(path)
        new_content = core_pattern.sub(core_tag, content)

        account_pattern = re.compile(
            r'<script\s+defer\s+src="/assets/js/bundles/account\.js(?:\?[^"]*)?"></script>'
        )
        if account_pattern.search(new_content) and not core_pattern.search(new_content):
            new_content = account_pattern.sub(
                lambda m: core_tag + "\n" + m.group(0),
                new_content,
                count=1,
            )

        bundle_names = bundle_pattern.findall(new_content)
        if any(name in CATALOGUE_CORE_BUNDLES for name in bundle_names) and not catalogue_core_pattern.search(new_content):
            first_bundle = bundle_pattern.search(new_content)
            if first_bundle:
                new_content = (
                    new_content[:first_bundle.start()]
                    + catalogue_core_tag + "\n"
                    + first_bundle.group(0)
                    + new_content[first_bundle.end():]
                )

        for bundle_name, module_paths in PAGE_MODULES.items():
            bundle_re_for_page = re.compile(
                rf'<script\s+defer\s+src="/assets/js/bundles/{re.escape(bundle_name)}(?:\?[^"]*)?"></script>'
            )
            if bundle_re_for_page.search(new_content):
                tags = "\n".join(
                    f'<script defer src="{versioned_asset_url(module_path)}"></script>'
                    for module_path in module_paths
                )
                new_content = bundle_re_for_page.sub(tags, new_content, count=1)

            module_present = any(
                re.search(
                    rf'<script\s+defer\s+src="{re.escape(module_path)}\?v=[0-9a-f]{{12}}"></script>',
                    new_content
                )
                for module_path in module_paths
            )
            if module_present and not catalogue_core_pattern.search(new_content):
                first_module_pattern = re.compile(
                    rf'<script\s+defer\s+src="{re.escape(module_paths[0])}\?v=[0-9a-f]{{12}}"></script>'
                )
                first_module = first_module_pattern.search(new_content)
                if first_module:
                    new_content = (
                        new_content[:first_module.start()]
                        + catalogue_core_tag + "\n"
                        + first_module.group(0)
                        + new_content[first_module.end():]
                    )

        def replace_bundle(match: re.Match[str]) -> str:
            bundle_name = match.group(1)
            return (
                f'<script defer src="{versioned_asset_url(
                    f"assets/js/bundles/{bundle_name}"
                )}"></script>'
            )

        new_content = bundle_pattern.sub(replace_bundle, new_content)

        def replace_css(match: re.Match[str]) -> str:
            relative_path = f"assets/css/{match.group(2)}"
            return (
                f'{match.group(1)}{match.group(2).split("?")[0]}'
                f'?v={asset_version(ROOT / relative_path)}{match.group(3)}'
            )

        new_content = css_pattern.sub(replace_css, new_content)

        if new_content != content:
            write(path, new_content)
            changed += 1

    return changed


def validate() -> None:
    core = read(CORE_PATH)
    if not READY_RE.search(core):
        raise ValueError("site-core.js readiness marker missing")
    catalogue_core = ROOT / "assets" / "js" / "catalogue-core.js"
    if not catalogue_core.is_file():
        raise ValueError("catalogue-core.js is missing")

    for bundle_name, module_paths in PAGE_MODULES.items():
        for module_path in module_paths:
            full_path = ROOT / module_path
            if not full_path.is_file():
                raise ValueError(f"Missing page module: {full_path}")

    for filename in sorted(KNOWN_BUNDLES):
        source = read(BUNDLES / filename)
        if "/* ===== utils.js ===== */" in source:
            raise ValueError(f"{filename} still embeds the shared utilities layer")
        if "/* ===== auth/supabase.js ===== */" in source:
            raise ValueError(f"{filename} still embeds the shared auth layer")
        if any(f"/* ===== {marker} ===== */" in source for marker in CATALOGUE_SHARED_MARKERS):
            raise ValueError(f"{filename} still embeds catalogue-shared modules")
        if filename == ACCOUNT_BUNDLE:
            for marker in ACCOUNT_SHARED_MARKERS:
                if f"/* ===== {marker} ===== */" in source:
                    raise ValueError(f"{filename} still embeds shared account module {marker}")
        if filename in PAGE_MODULES and source.startswith("/* Page runtime modules are loaded directly by the page."):
            continue
        if source.startswith("/* No page-specific JavaScript. Shared behavior is loaded by /assets/js/site-core.js. */"):
            continue
        if COMMON_END in source or COMMON_END_LABEL in source:
            raise ValueError(f"{filename} still embeds the shared navigation/image runtime")
        if "/* Shared core is loaded by the HTML page before this bundle. */" not in source:
            raise ValueError(f"{filename} is missing shared-core declaration")

    core_re = re.compile(
        r'<script\s+defer\s+src="/assets/js/site-core\.js\?v=[0-9a-f]{12}"></script>'
    )
    catalogue_core_re = re.compile(
        r'<script\s+defer\s+src="/assets/js/catalogue-core\.js\?v=[0-9a-f]{12}"></script>'
    )
    bundle_re = re.compile(
        r'<script\s+defer\s+src="/assets/js/bundles/([^"?]+)\?v=[0-9a-f]{12}"></script>'
    )
    css_re = re.compile(
        r'<link\s+[^>]*href="/assets/css/[^"?]+\?v=[0-9a-f]{12}"',
        re.IGNORECASE
    )

    paths = []
    for language in LANGUAGES:
        paths.extend((ROOT / language).rglob("*.html"))
    if (ROOT / "404.html").exists():
        paths.append(ROOT / "404.html")

    for path in sorted(set(paths)):
        content = read(path)
        sources = [
            src.split("?", 1)[0]
            for src in re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', content, flags=re.I)
        ]
        matches = bundle_re.findall(content)

        for bundle_name, module_paths in PAGE_MODULES.items():
            if bundle_name in matches:
                raise ValueError(
                    f"{path} still loads legacy compatibility bundle {bundle_name}; "
                    "page modules must be loaded directly."
                )
            page_sources = [src for src in sources if src in module_paths]
            if not page_sources:
                continue
            if page_sources != list(module_paths):
                raise ValueError(
                    f"{path} {bundle_name} module order mismatch: {page_sources}"
                )
            if not core_re.search(content):
                raise ValueError(f"Missing versioned shared core on {path}")
            core_index = sources.index("/assets/js/site-core.js")
            first_page_index = sources.index(page_sources[0])
            if first_page_index < core_index:
                raise ValueError(f"{path} loads {bundle_name} modules before site-core.js")
            if not css_re.search(content):
                raise ValueError(f"Missing versioned CSS on {path}")
        if not matches:
            continue
        if not core_re.search(content):
            raise ValueError(f"Missing versioned shared core on {path}")
        needs_catalogue_core = any(name in CATALOGUE_CORE_BUNDLES for name in matches)
        if needs_catalogue_core and not catalogue_core_re.search(content):
            raise ValueError(f"Missing versioned catalogue core on {path}")
        if not css_re.search(content):
            raise ValueError(f"Missing versioned CSS on {path}")

        core_index = sources.index("/assets/js/site-core.js") if "/assets/js/site-core.js" in sources else -1
        catalogue_core_index = sources.index("/assets/js/catalogue-core.js") if "/assets/js/catalogue-core.js" in sources else -1
        for src in [f"/assets/js/bundles/{name}" for name in matches]:
            if core_index >= 0 and sources.index(src) < core_index:
                raise ValueError(f"{path} loads {src} before site-core.js")
            bundle_name = src.rsplit("/", 1)[-1]
            if needs_catalogue_core and bundle_name in CATALOGUE_CORE_BUNDLES and (
                catalogue_core_index < 0 or sources.index(src) < catalogue_core_index
            ):
                raise ValueError(f"{path} loads {src} before catalogue-core.js")


def main() -> None:
    write(CORE_PATH, extract_core())

    for filename in sorted(KNOWN_BUNDLES):
        write(BUNDLES / filename, build_page_bundle(filename))

    changed = migrate_html()
    validate()

    print(
        f"JavaScript architecture migration complete: "
        f"{len(KNOWN_BUNDLES)} compatibility bundles processed; "
        f"{sum(len(modules) for modules in PAGE_MODULES.values())} page modules managed; "
        f"{changed} HTML pages updated."
    )
    print("Shared runtime is centralized; account, products, and product page runtimes are split into ordered modules.")


if __name__ == "__main__":
    main()
