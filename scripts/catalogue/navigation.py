#!/usr/bin/env python3
"""Single source of truth for the Souviks primary navigation."""

from __future__ import annotations

from html import escape

LANGUAGES = ("en", "hi", "bn")

LABELS = {
    "en": {
        "aria": "Primary Navigation",
        "close": "Close Navigation",
        "account": "Account",
        "sign_in": "Sign In",
        "account_name": "Account",
        "sign_out": "Sign Out",
        "links": (
            ("home", "Home", ""),
            ("products", "Products", "products"),
            ("cart", "Shopping Cart", "cart"),
            ("brands", "Brands", "brands"),
            ("vehicles", "Vehicles", "vehicles"),
            ("categories", "Categories", "categories"),
            ("about", "About Us", "about"),
            ("business-buyers", "For Businesses", "business-buyers"),
            ("contact", "Contact", "contact"),
        ),
    },
    "hi": {
        "aria": "मुख्य नेविगेशन",
        "close": "Close Navigation",
        "account": "खाता",
        "sign_in": "साइन इन",
        "account_name": "खाता",
        "sign_out": "साइन आउट",
        "links": (
            ("home", "होम", ""),
            ("products", "उत्पाद", "products"),
            ("cart", "कार्ट", "cart"),
            ("brands", "ब्रांड", "brands"),
            ("vehicles", "वाहन", "vehicles"),
            ("categories", "श्रेणियाँ", "categories"),
            ("about", "हमारे बारे में", "about"),
            ("business-buyers", "व्यवसायों के लिए", "business-buyers"),
            ("contact", "संपर्क करें", "contact"),
        ),
    },
    "bn": {
        "aria": "প্রধান নেভিগেশন",
        "close": "Close Navigation",
        "account": "অ্যাকাউন্ট",
        "sign_in": "সাইন ইন",
        "account_name": "অ্যাকাউন্ট",
        "sign_out": "সাইন আউট",
        "links": (
            ("home", "হোম", ""),
            ("products", "পণ্যসমূহ", "products"),
            ("cart", "কার্ট", "cart"),
            ("brands", "ব্র্যান্ডসমূহ", "brands"),
            ("vehicles", "যানবাহন", "vehicles"),
            ("categories", "বিভাগসমূহ", "categories"),
            ("about", "আমাদের সম্পর্কে", "about"),
            ("business-buyers", "ব্যবসার জন্য", "business-buyers"),
            ("contact", "যোগাযোগ", "contact"),
        ),
    },
}


def _section_for_path(path: str) -> str:
    clean = "/" + path.strip("/")
    parts = [part for part in clean.split("/") if part]
    if not parts:
        return "home"
    if len(parts) == 1 and parts[0] in LANGUAGES:
        return "home"
    if len(parts) >= 2 and parts[0] in LANGUAGES:
        return parts[1] if parts[1] in {"products", "cart", "brands", "vehicles", "categories", "about", "business-buyers", "contact"} else ""
    return ""


def render_navigation(lang: str, public_path: str) -> str:
    if lang not in LANGUAGES:
        raise ValueError(f"Unsupported language: {lang}")

    labels = LABELS[lang]
    active = _section_for_path(public_path)
    prefix = f"/{lang}"

    links = []
    for key, label, route in labels["links"]:
        href = f"{prefix}/" if key == "home" else f"{prefix}/{route}"
        active_class = "active" if active == key else ""
        links.append(
            f'''                    <li>
                        <a href="{escape(href, quote=True)}" class="nav-link {active_class}">{escape(label)}</a>
                    </li>'''
        )

    return f'''<nav id="mainNavigation" class="main-navigation" aria-label="{escape(labels["aria"], quote=True)}">
                <div class="mobile-navigation-header">
                    <img src="/assets/logo/souviks-logo-white.png" alt="Souviks" class="mobile-navigation-logo" width="1024" height="1024">
                    <button id="mobileNavigationClose" class="mobile-navigation-close" type="button" aria-label="{escape(labels["close"], quote=True)}">×</button>
                </div>

                <ul class="navigation-menu">
{chr(10).join(links)}
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
