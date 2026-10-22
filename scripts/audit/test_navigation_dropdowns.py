#!/usr/bin/env python3
"""Regression checks for the grouped primary navigation across all locales."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from navigation import LABELS, LANGUAGES, render_navigation  # noqa: E402

EXPECTED_ROUTES = {
    "home": "",
    "products": "products",
    "categories": "categories",
    "brands": "brands",
    "vehicles": "vehicles",
    "business-buyers": "business-buyers",
    "request-part": "request-part",
    "request-quote": "request-quote",
    "about": "about",
    "contact": "contact",
    "cart": "cart",
}
EXPECTED_TOP_LEVEL_ITEMS = 5
EXPECTED_DROPDOWNS = 3


def fail(message: str) -> None:
    raise SystemExit(f"[navigation dropdowns] ERROR: {message}")


def main() -> int:
    for language in LANGUAGES:
        page = render_navigation(language, f"/{language}/products/example-product")

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

        for dropdown_key in ("shop", "business", "about-group"):
            menu_id = f"navDropdown-{dropdown_key}"
            toggle_id = f"navDropdownToggle-{dropdown_key}"
            if f'id="{menu_id}" class="nav-dropdown-menu"' not in page:
                fail(f"{language}: missing submenu {menu_id}")
            if (
                f'id="{toggle_id}" class="nav-link nav-dropdown-toggle' not in page
                or f'aria-expanded="false" aria-controls="{menu_id}"' not in page
            ):
                fail(f"{language}: missing accessible disclosure control for {menu_id}")

        for key, route in EXPECTED_ROUTES.items():
            href = f'/{language}/' if key == "home" else f'/{language}/{route}'
            occurrences = page.count(f'href="{href}"')
            if occurrences != 1:
                fail(f"{language}: expected exactly one navigation destination {href}, got {occurrences}")

        # Every child route should activate its child link and its containing dropdown.
        active_cases = (
            ("products", "shop"),
            ("categories", "shop"),
            ("brands", "shop"),
            ("vehicles", "shop"),
            ("business-buyers", "business"),
            ("request-part", "business"),
            ("request-quote", "business"),
            ("about", "about-group"),
            ("contact", "about-group"),
        )
        for route, group in active_cases:
            rendered = render_navigation(language, f"/{language}/{route}")
            expected = f'href="/{language}/{route}" class="nav-link active" aria-current="page"'
            if expected not in rendered:
                fail(f"{language}: route {route} does not mark its child link active")
            if f'class="nav-menu-item nav-dropdown is-active"' not in rendered:
                fail(f"{language}: route {route} does not activate a dropdown group")
            if f'id="navDropdownToggle-{group}" class="nav-link nav-dropdown-toggle active"' not in rendered:
                fail(f"{language}: route {route} does not activate its {group} parent")

    if tuple(entry[1] for entry in LABELS["en"]["items"] if entry[0] == "link") != ("home", "cart"):
        fail("English top-level direct links should remain Home and Shopping Cart")

    print(
        "Navigation dropdown regression passed: 5 top-level items, 3 dropdowns, "
        "all 11 routes preserved and active states checked for en/hi/bn."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
