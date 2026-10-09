#!/usr/bin/env python3
"""Synchronize primary navigation from the single source renderer."""

from __future__ import annotations

import re
from pathlib import Path

from navigation import LANGUAGES, render_navigation

ROOT = Path(__file__).resolve().parents[2]
NAV_RE = re.compile(
    r'''(?P<indent>^[ \t]*)<nav\b[^>]*\bid=["']mainNavigation["'][^>]*>[\s\S]*?</nav>''',
    flags=re.I | re.M,
)


def public_path(language: str, path: Path) -> str:
    relative = path.relative_to(ROOT / language)
    if relative.as_posix() == "index.html":
        return f"/{language}/"
    return f"/{language}/{relative.with_suffix('').as_posix()}"


def sync_file(path: Path, language: str) -> bool:
    source = path.read_text(encoding="utf-8")
    expected = render_navigation(language, public_path(language, path))
    match = NAV_RE.search(source)

    if not match:
        # Account/auth surfaces have a deliberately reduced header and do not
        # render the public primary-navigation component.
        if path.name == "account.html" or path.name in {
            "login.html", "register.html", "forgot-password.html",
            "reset-password.html",
        }:
            return False
        raise ValueError(f"{path.relative_to(ROOT)}: missing #mainNavigation")

    indent = match.group("indent")
    replacement = indent + expected.replace("\n", "\n" + indent)
    updated = source[:match.start()] + replacement + source[match.end():]

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

    print(
        "Navigation synchronized from scripts/catalogue/navigation.py: "
        f"{changed} files changed; {checked} checked."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
