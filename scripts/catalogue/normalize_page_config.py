#!/usr/bin/env python3
"""Repair malformed generated window.souviks page configuration objects.

A missing comma between currentPage and currentPageType causes a SyntaxError,
which prevents the shared page runtime (navigation, catalogue and RFQ handlers)
from initializing. This pass is deliberately narrow and idempotent.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")
MISSING_COMMA = re.compile(
    r'(?m)(^[ \t]*currentPage:[ \t]*\r?\n[ \t]*"(?:\\.|[^"\\])*")(?P<separator>[ \t]*(?:\r?\n[ \t]*)+(?=currentPageType[ \t]*:))'
)


def normalize_page_config() -> int:
    paths = list(ROOT.glob("*.html"))
    for language in LANGUAGES:
        paths.extend(sorted((ROOT / language).rglob("*.html")))

    changed = 0
    repaired_properties = 0
    for path in sorted(set(paths)):
        if not path.is_file():
            continue
        original = path.read_text(encoding="utf-8")
        updated, count = MISSING_COMMA.subn(r"\1,\g<separator>", original)
        if updated == original:
            continue
        path.write_text(updated, encoding="utf-8")
        changed += 1
        repaired_properties += count

    print(
        f"Page config syntax normalized: {repaired_properties} properties "
        f"across {changed} HTML files."
    )
    return repaired_properties


if __name__ == "__main__":
    normalize_page_config()
