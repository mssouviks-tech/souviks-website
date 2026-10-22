#!/usr/bin/env python3
"""Single source of truth for the Souviks primary navigation."""

from __future__ import annotations

from html import escape

LANGUAGES = ("en", "hi", "bn")

# Each navigation entry is either:
#   ("link", key, label, route)
#   ("dropdown", key, label, ((child_key, child_label, child_route), ...))
# Keep this compact structure as the source for every generated static page.
LABELS = {
    "en": {
        "aria": "Primary Navigation",
        "close": "Close Navigation",
        "account": "Account",
        "sign_in": "Sign In",
        "account_name": "Account",
        "sign_out": "Sign Out",
        "items": (
            ("link", "home", "Home", ""),
            ("dropdown", "shop", "Shop", (
                ("products", "Products", "products"),
                ("categories", "Categories", "categories"),
                ("brands", "Brands", "brands"),
                ("vehicles", "Vehicles", "vehicles"),
            )),
            ("dropdown", "business", "Business", (
                ("business-buyers", "For Businesses", "business-buyers"),
                ("request-part", "Request a Part", "request-part"),
                ("request-quote", "Request a Quote", "request-quote"),
            )),
            ("dropdown", "about-group", "About", (
                ("about", "About Us", "about"),
                ("contact", "Contact", "contact"),
            )),
            ("link", "cart", "Shopping Cart", "cart"),
        ),
    },
    "hi": {
        "aria": "मुख्य नेविगेशन",
        "close": "नेविगेशन बंद करें",
        "account": "खाता",
        "sign_in": "साइन इन",
        "account_name": "खाता",
        "sign_out": "साइन आउट",
        "items": (
            ("link", "home", "होम", ""),
            ("dropdown", "shop", "खरीदें", (
                ("products", "उत्पाद", "products"),
                ("categories", "श्रेणियाँ", "categories"),
                ("brands", "ब्रांड", "brands"),
                ("vehicles", "वाहन", "vehicles"),
            )),
            ("dropdown", "business", "व्यवसाय", (
                ("business-buyers", "व्यवसायों के लिए", "business-buyers"),
                ("request-part", "पार्ट का अनुरोध", "request-part"),
                ("request-quote", "कोटेशन माँगें", "request-quote"),
            )),
            ("dropdown", "about-group", "जानकारी", (
                ("about", "हमारे बारे में", "about"),
                ("contact", "संपर्क करें", "contact"),
            )),
            ("link", "cart", "कार्ट", "cart"),
        ),
    },
    "bn": {
        "aria": "প্রধান নেভিগেশন",
        "close": "নেভিগেশন বন্ধ করুন",
        "account": "অ্যাকাউন্ট",
        "sign_in": "সাইন ইন",
        "account_name": "অ্যাকাউন্ট",
        "sign_out": "সাইন আউট",
        "items": (
            ("link", "home", "হোম", ""),
            ("dropdown", "shop", "পণ্য কিনুন", (
                ("products", "পণ্যসমূহ", "products"),
                ("categories", "বিভাগসমূহ", "categories"),
                ("brands", "ব্র্যান্ডসমূহ", "brands"),
                ("vehicles", "যানবাহন", "vehicles"),
            )),
            ("dropdown", "business", "ব্যবসা", (
                ("business-buyers", "ব্যবসার জন্য", "business-buyers"),
                ("request-part", "পার্টের অনুরোধ", "request-part"),
                ("request-quote", "দরপত্রের অনুরোধ", "request-quote"),
            )),
            ("dropdown", "about-group", "পরিচিতি", (
                ("about", "আমাদের সম্পর্কে", "about"),
                ("contact", "যোগাযোগ", "contact"),
            )),
            ("link", "cart", "কার্ট", "cart"),
        ),
    },
}

KNOWN_ROUTES = {
    "products",
    "cart",
    "brands",
    "vehicles",
    "categories",
    "about",
    "business-buyers",
    "contact",
    "request-part",
    "request-quote",
}


def _section_for_path(path: str) -> str:
    parts = [part for part in ("/" + path.strip("/")).split("/") if part]
    if not parts or (len(parts) == 1 and parts[0] in LANGUAGES):
        return "home"
    if len(parts) >= 2 and parts[0] in LANGUAGES and parts[1] in KNOWN_ROUTES:
        return parts[1]
    return ""


def _is_current_path(lang: str, key: str, route: str, public_path: str) -> bool:
    current_path = "/" + public_path.strip("/")
    expected_path = f"/{lang}/" if key == "home" else f"/{lang}/{route}"
    return current_path in {f"/{lang}", f"/{lang}/"} if key == "home" else current_path == expected_path


def _render_link(
    lang: str, key: str, label: str, route: str, active: str, public_path: str
) -> str:
    prefix = f"/{lang}"
    href = f"{prefix}/" if key == "home" else f"{prefix}/{route}"
    is_active = active == key
    active_class = " active" if is_active else ""
    aria_current = ' aria-current="page"' if _is_current_path(lang, key, route, public_path) else ""
    return (
        f'<li class="nav-menu-item">'
        f'<a href="{escape(href, quote=True)}" class="nav-link{active_class}"{aria_current}>'
        f'{escape(label)}</a></li>'
    )


def render_navigation(lang: str, public_path: str) -> str:
    if lang not in LANGUAGES:
        raise ValueError(f"Unsupported language: {lang}")

    labels = LABELS[lang]
    active = _section_for_path(public_path)
    prefix = f"/{lang}"
    entries = []

    for kind, key, label, payload in labels["items"]:
        if kind == "link":
            entries.append(_render_link(lang, key, label, payload, active, public_path))
            continue

        children = payload
        child_keys = {child_key for child_key, _, _ in children}
        group_active = active in child_keys
        group_class = " is-active" if group_active else ""
        button_active = " active" if group_active else ""
        menu_id = f"navDropdown-{key}"
        toggle_id = f"navDropdownToggle-{key}"
        child_links = []
        for child_key, child_label, route in children:
            child_active = active == child_key
            href = f"{prefix}/{route}"
            child_class = " active" if child_active else ""
            aria_current = ' aria-current="page"' if _is_current_path(lang, child_key, route, public_path) else ""
            child_links.append(
                f'<li class="nav-dropdown-item">'
                f'<a href="{escape(href, quote=True)}" class="nav-link{child_class}"{aria_current}>'
                f'{escape(child_label)}</a></li>'
            )

        entries.append(
            f'<li class="nav-menu-item nav-dropdown{group_class}">'
            f'<button id="{escape(toggle_id, quote=True)}" class="nav-link nav-dropdown-toggle{button_active}" '
            f'type="button" aria-expanded="false" aria-controls="{escape(menu_id, quote=True)}">'
            f'<span>{escape(label)}</span>'
            '<span class="nav-dropdown-chevron" aria-hidden="true">⌄</span>'
            '</button>'
            f'<ul id="{escape(menu_id, quote=True)}" class="nav-dropdown-menu" '
            f'aria-labelledby="{escape(toggle_id, quote=True)}">'
            f'{"".join(child_links)}</ul></li>'
        )

    return f'''<nav id="mainNavigation" class="main-navigation" aria-label="{escape(labels["aria"], quote=True)}">
                <div class="mobile-navigation-header">
                    <img src="/assets/logo/souviks-logo-white.png" alt="Souviks" class="mobile-navigation-logo" width="1024" height="1024">
                    <button id="mobileNavigationClose" class="mobile-navigation-close" type="button" aria-label="{escape(labels["close"], quote=True)}">×</button>
                </div>

                <ul class="navigation-menu">
{chr(10).join(entries)}
                </ul>

                <div class="mobile-nav-auth" aria-label="{escape(labels["account"], quote=True)}">
                    <a id="mobileNavSignIn" class="mobile-nav-auth-link" href="{prefix}/login">
                        {escape(labels["sign_in"])}
                    </a>

                    <div id="mobileNavUserMenu" class="mobile-nav-user" hidden>
                        <a class="mobile-nav-auth-link" href="{prefix}/account">
                            <span aria-hidden="true">◉</span>
                            <span id="mobileNavUserName">{escape(labels["account_name"])}</span>
                        </a>
                        <button type="button" id="mobileNavSignOut" class="mobile-nav-auth-link mobile-nav-signout" data-auth-logout>
                            {escape(labels["sign_out"])}
                        </button>
                    </div>
                </div>
            </nav>'''


if __name__ == "__main__":
    # Lightweight smoke-test output for local review.
    for language in LANGUAGES:
        print(f"{language}: {len(LABELS[language]['items'])} top-level items")
