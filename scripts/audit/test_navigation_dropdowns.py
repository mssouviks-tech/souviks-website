#!/usr/bin/env python3
"""Regression checks for the slim primary menu and checkout Cart action."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from navigation import LABELS, LANGUAGES, render_header_actions, render_navigation  # noqa: E402

EXPECTED_NAV_ROUTES = {
    "home": "",
    "products": "products",
    "categories": "categories",
    "brands": "brands",
    "vehicles": "vehicles",
    "business-buyers": "business-buyers",
    "about": "about",
    "contact": "contact",
}
EXPECTED_TOP_LEVEL_ITEMS = 4
EXPECTED_DROPDOWNS = 2


def fail(message: str) -> None:
    raise SystemExit(f"[navigation/header actions] ERROR: {message}")


def main() -> int:
    for language in LANGUAGES:
        page = render_navigation(language, f"/{language}/products/example-product")
        header = render_header_actions(language)

        top_level_count = page.count('class="nav-menu-item')
        if top_level_count != EXPECTED_TOP_LEVEL_ITEMS:
            fail(f"{language}: expected {EXPECTED_TOP_LEVEL_ITEMS} top-level items, got {top_level_count}")

        dropdown_count = page.count('class="nav-menu-item nav-dropdown')
        if dropdown_count != EXPECTED_DROPDOWNS:
            fail(f"{language}: expected {EXPECTED_DROPDOWNS} dropdown groups, got {dropdown_count}")

        if page.count('class="nav-link nav-dropdown-toggle active"') != 1:
            fail(f"{language}: the Shop group is not marked active on product routes")
        if 'href="/' + language + '/products" class="nav-link active" aria-current="page"' in page:
            fail(f"{language}: a product detail page incorrectly marks the Products index as the current page")

        for dropdown_key in ("shop", "about-group"):
            menu_id = f"navDropdown-{dropdown_key}"
            toggle_id = f"navDropdownToggle-{dropdown_key}"
            if f'id="{menu_id}" class="nav-dropdown-menu"' not in page:
                fail(f"{language}: missing submenu {menu_id}")
            if (
                f'id="{toggle_id}" class="nav-link nav-dropdown-toggle' not in page
                or f'aria-expanded="false" aria-controls="{menu_id}"' not in page
            ):
                fail(f"{language}: missing accessible disclosure control for {menu_id}")

        for key, route in EXPECTED_NAV_ROUTES.items():
            href = f'/{language}/' if key == "home" else f'/{language}/{route}'
            if page.count(f'href="{href}"') != 1:
                fail(f"{language}: expected exactly one navigation destination {href}")

        for route in ("request-part", "request-quote", "cart"):
            if f'href="/{language}/{route}"' in page:
                fail(f"{language}: {route} should not add clutter to the primary navigation")

        business = render_navigation(language, f"/{language}/business-buyers")
        if f'href="/{language}/business-buyers" class="nav-link active" aria-current="page"' not in business:
            fail(f"{language}: For Businesses should remain a direct, current-page link")

        for route, group in (
            ("products", "shop"),
            ("categories", "shop"),
            ("brands", "shop"),
            ("vehicles", "shop"),
            ("about", "about-group"),
            ("contact", "about-group"),
        ):
            rendered = render_navigation(language, f"/{language}/{route}")
            expected = f'href="/{language}/{route}" class="nav-link active" aria-current="page"'
            if expected not in rendered:
                fail(f"{language}: route {route} does not mark its child link active")
            if 'class="nav-menu-item nav-dropdown is-active"' not in rendered:
                fail(f"{language}: route {route} does not activate a dropdown group")
            if f'id="navDropdownToggle-{group}" class="nav-link nav-dropdown-toggle active"' not in rendered:
                fail(f"{language}: route {route} does not activate its {group} parent")

        if f'href="/{language}/cart"' not in header or 'purchase-cart-count' not in header:
            fail(f"{language}: checkout Cart or its live item count is missing")
        if f'>{LABELS[language]["header_cart"]} ' not in header:
            fail(f"{language}: checkout Cart label is not localized correctly")
        if "RFQ Basket" in header or "Request a Part" in header or f'href="/{language}/request-part"' in header:
            fail(f"{language}: header still exposes the removed Request a Part or RFQ basket buttons")

    print(
        "Navigation/header regression passed: four top-level items, two dropdowns, "
        "and one checkout Cart header action in en/hi/bn."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
