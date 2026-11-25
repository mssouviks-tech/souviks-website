#!/usr/bin/env python3
"""Verify every generated product BreadcrumbList links Home to its locale home."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://www.souviks.co.in"
LANGUAGES = ("en", "hi", "bn")
JSON_LD_RE = re.compile(
    r"""<script\b[^>]*type=["']application/ld\+json["'][^>]*>(.*?)</script>""",
    flags=re.I | re.S,
)


def breadcrumb_nodes(value: object) -> list[dict]:
    """Collect BreadcrumbList nodes from standalone JSON-LD and @graph blocks."""
    if not isinstance(value, dict):
        return []
    graph = value.get("@graph")
    nodes = graph if isinstance(graph, list) else [value]
    return [
        node
        for node in nodes
        if isinstance(node, dict) and node.get("@type") == "BreadcrumbList"
    ]


def audit_page(path: Path, language: str) -> list[str]:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    errors: list[str] = []
    found: list[dict] = []
    for block in JSON_LD_RE.findall(raw):
        try:
            value = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        found.extend(breadcrumb_nodes(value))

    if not found:
        return [f"{path.relative_to(ROOT)}: missing BreadcrumbList"]

    expected_home = f"{BASE}/{language}/"
    for index, node in enumerate(found, start=1):
        items = node.get("itemListElement")
        if not isinstance(items, list) or not items or not isinstance(items[0], dict):
            errors.append(
                f"{path.relative_to(ROOT)}: BreadcrumbList #{index} has no first Home item"
            )
            continue
        home = items[0]
        if str(home.get("name") or "").strip().casefold() != "home":
            errors.append(
                f"{path.relative_to(ROOT)}: BreadcrumbList #{index} first item is not Home"
            )
        if home.get("item") != expected_home:
            errors.append(
                f"{path.relative_to(ROOT)}: BreadcrumbList #{index} Home URL "
                f"{home.get('item')!r} != {expected_home!r}"
            )
    return errors


def main() -> int:
    total_pages = 0
    errors: list[str] = []
    for language in LANGUAGES:
        directory = ROOT / language / "products"
        pages = sorted(directory.glob("*.html")) if directory.is_dir() else []
        if not pages:
            errors.append(f"{language}/products: no generated product pages found")
            continue
        total_pages += len(pages)
        for page in pages:
            errors.extend(audit_page(page, language))

    if errors:
        print(f"Product breadcrumb Home contract FAILED: {len(errors)} issue(s)")
        for error in errors[:200]:
            print(f"[FAIL] {error}")
        if len(errors) > 200:
            print(f"... and {len(errors) - 200} additional issues")
        return 1

    print(
        "Product breadcrumb Home contract PASS: "
        f"{total_pages} generated PDPs use their language-prefixed home URL."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
