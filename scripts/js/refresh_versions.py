#!/usr/bin/env python3
"""Refresh deterministic content hashes for locally served JavaScript and CSS assets."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSET_RE = re.compile(
    r'(?P<prefix>/(?:assets/js/(?:site-core|catalogue-core)\.js'
    r'|assets/js/bundles/[^"?]+\.js'
    r'|assets/js/attribution\.js|assets/js/supabase-loader\.js'
    r'|assets/js/(?:account|products|product|request-quote|components|cart)/[^"?]+\.js'
    r'|assets/css/[^"?]+\.css))'
    r'(?:\?[^\'"#\s>]*)?'
)


def version(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def resolve_asset_prefix(prefix: str) -> str:
    """Resolve a stale locale-prefixed bundle URL only to a real shared asset."""
    relative = prefix.lstrip("/")
    requested = ROOT / relative
    if requested.is_file():
        return prefix

    shared_directories = (
        "assets/js/bundles",
        "assets/js/account",
        "assets/js/products",
        "assets/js/product",
        "assets/js/request-quote",
        "assets/js/components",
        "assets/js/cart",
        "assets/css/bundles",
    )
    for shared_directory in shared_directories:
        try:
            remainder = Path(relative).relative_to(shared_directory).parts
        except ValueError:
            continue
        if len(remainder) < 2 or remainder[0] not in {"en", "bn", "hi"}:
            continue
        candidate = Path(shared_directory, *remainder[1:])
        if (ROOT / candidate).is_file():
            return "/" + candidate.as_posix()

    return prefix


def main() -> int:
    changed = 0
    html_paths = [
        *sorted(ROOT.glob("*.html")),
        *sorted((ROOT / "en").rglob("*.html")),
        *sorted((ROOT / "hi").rglob("*.html")),
        *sorted((ROOT / "bn").rglob("*.html")),
    ]

    for html in html_paths:
        source = html.read_text(encoding="utf-8")

        def replace(match: re.Match[str]) -> str:
            requested_prefix = match.group("prefix")
            resolved_prefix = resolve_asset_prefix(requested_prefix)
            asset = ROOT / resolved_prefix.lstrip("/")
            if not asset.is_file():
                raise FileNotFoundError(
                    f"{html.relative_to(ROOT)} references missing asset {requested_prefix}"
                )
            return f'{resolved_prefix}?v={version(asset)}'

        updated = ASSET_RE.sub(replace, source)
        if updated != source:
            html.write_text(updated, encoding="utf-8")
            changed += 1

    print(f"Static asset cache versions refreshed: {changed} HTML files changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
