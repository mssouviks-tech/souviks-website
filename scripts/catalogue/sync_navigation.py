#!/usr/bin/env python3
"""Synchronize primary navigation and site-wide header actions from one source."""

from __future__ import annotations

import re
from pathlib import Path

from navigation import LANGUAGES, render_header_actions, render_navigation

ROOT = Path(__file__).resolve().parents[2]
NAV_RE = re.compile(
    r'''(?P<indent>^[ \t]*)<nav\b[^>]*\bid=["']mainNavigation["'][^>]*>[\s\S]*?</nav>''',
    flags=re.I | re.M,
)
HEADER_ACTIONS_RE = re.compile(
    r'''(?P<indent>^[ \t]*)<div\b(?=[^>]*\bclass=["'][^"']*\bheader-buttons\b[^"']*["'])[^>]*>[\s\S]*?</div>''',
    flags=re.I | re.M,
)
REDUCED_HEADER_PAGES = {
    "account.html",
    "login.html",
    "register.html",
    "forgot-password.html",
    "reset-password.html",
}


def public_path(language: str, path: Path) -> str:
    if path.parent == ROOT:
        return f"/{language}/" if path.name == "index.html" else f"/{language}/not-found"
    relative = path.relative_to(ROOT / language)
    if relative.as_posix() == "index.html":
        return f"/{language}/"
    return f"/{language}/{relative.with_suffix('').as_posix()}"


def indent_markup(markup: str, indent: str) -> str:
    return "\n".join(indent + line if line else "" for line in markup.split("\n"))


def sync_file(path: Path, language: str) -> bool:
    source = path.read_text(encoding="utf-8")
    updated = source

    nav_match = NAV_RE.search(updated)
    if nav_match:
        expected = render_navigation(language, public_path(language, path))
        replacement = indent_markup(expected, nav_match.group("indent"))
        updated = updated[:nav_match.start()] + replacement + updated[nav_match.end():]
    elif path.name not in REDUCED_HEADER_PAGES:
        raise ValueError(f"{path.relative_to(ROOT)}: missing #mainNavigation")

    header_match = HEADER_ACTIONS_RE.search(updated)
    if header_match:
        expected_actions = render_header_actions(language)
        replacement = indent_markup(expected_actions, header_match.group("indent"))
        updated = updated[:header_match.start()] + replacement + updated[header_match.end():]

    if updated != source:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> int:
    changed = 0
    checked = 0

    for language in LANGUAGES:
        root = ROOT / language
        if not root.is_dir():
            raise SystemExit(f"Missing language directory: {language}")

        for path in sorted(root.rglob("*.html")):
            changed += sync_file(path, language)
            checked += 1

    # Keep the root homepage and fallback page synchronized too. The root
    # homepage is regenerated from en/index.html later in the publish workflow.
    for name in ("index.html", "404.html"):
        path = ROOT / name
        if path.is_file():
            changed += sync_file(path, "en")
            checked += 1

    print(
        "Navigation and header actions synchronized from scripts/catalogue/navigation.py: "
        f"{changed} files changed; {checked} checked."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
