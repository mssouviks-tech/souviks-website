#!/usr/bin/env python3
"""Guard source-level frontend performance regressions.

This does not replace Lighthouse/Core Web Vitals. It prevents accidental growth of
the largest tracked assets and catches obvious script-loading regressions in HTML.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Baseline recorded 2026-10-08 from the current main revision.
# A 12% headroom allows intentional small changes while still blocking drift.
BASELINES = {
    "assets/js/site-core.js": 65_901,
    "assets/js/bundles/index.js": 31_941,
    "assets/js/bundles/products.js": 175_235,
    "assets/js/bundles/product.js": 116_583,
    "assets/js/bundles/account.js": 286_432,
    "assets/css/site-base.css": 93_640,
    "assets/css/bundles/index.css": 34_101,
    "assets/css/bundles/products.css": 26_140,
    "assets/css/bundles/product.css": 44_012,
    "assets/css/bundles/account.css": 75_545,
}

HEADROOM = 1.12


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def check_asset_sizes(errors: list[str]) -> None:
    for relative, baseline in BASELINES.items():
        path = ROOT / relative
        if not path.is_file():
            fail(f"missing performance-budget asset: {relative}", errors)
            continue
        actual = path.stat().st_size
        ceiling = int(baseline * HEADROOM)
        if actual > ceiling:
            growth = ((actual / baseline) - 1) * 100
            fail(
                f"{relative}: {actual:,} bytes exceeds {ceiling:,}-byte ceiling "
                f"({growth:.1f}% above baseline)",
                errors,
            )


def check_script_loading(errors: list[str]) -> None:
    for path in ROOT.glob("**/*.html"):
        if any(part in {".git", "node_modules"} for part in path.parts):
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")

        for match in re.finditer(
            r"<script\b([^>]*?)\bsrc=[\"']([^\"']+)[\"'][^>]*>",
            raw,
            flags=re.I | re.S,
        ):
            attrs = match.group(0)
            src = match.group(2)
            if "assets/js/bundles/" in src or src.endswith("/site-core.js"):
                if not re.search(r"\bdefer(?:\s*=|\s|>)", attrs, re.I):
                    fail(
                        f"{path.relative_to(ROOT)}: page runtime {src} is not deferred",
                        errors,
                    )

        analytics = re.findall(
            r"<script\b[^>]*src=[\"']([^\"']*googletagmanager\.com/gtag/js[^\"']*)[\"'][^>]*>",
            raw,
            flags=re.I | re.S,
        )
        for src in analytics:
            tag = re.search(
                rf"<script\b[^>]*src=[\"']{re.escape(src)}[\"'][^>]*>",
                raw,
                flags=re.I | re.S,
            )
            if tag and not re.search(r"\basync(?:\s*=|\s|>)", tag.group(0), re.I):
                fail(
                    f"{path.relative_to(ROOT)}: Google Analytics loader is not async: {src}",
                    errors,
                )


def main() -> int:
    errors: list[str] = []
    check_asset_sizes(errors)
    check_script_loading(errors)

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        print(f"Performance guard failed: {len(errors)} issue(s).", file=sys.stderr)
        return 1

    print(
        f"Performance guard passed: {len(BASELINES)} asset budgets and "
        "HTML script-loading contracts checked."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
