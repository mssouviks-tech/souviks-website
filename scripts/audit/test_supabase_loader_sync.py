#!/usr/bin/env python3
"""Regression test for whitespace-safe Supabase lazy-loader synchronization."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from sync_supabase_module import LOADER_URL, sync_page


def run() -> None:
    page = ROOT / "en" / "admin" / "channel-attribution.html"
    version = "0123456789ab"
    source = (
        '<!-- staff page runtime -->\n'
        '  <script defer src="/assets/js/supabase-loader.js?v=old"></script>\n'
        '<script defer src="/assets/js/site-core.js?v=old"></script>\n'
        '</body>\n'
    )

    updated = sync_page(page, source, version)
    assert len(re.findall(r"(?m)^[ \t]+$", updated)) == 0, (
        "removing the existing loader must not leave an indentation-only line"
    )
    loader = f'<script defer src="{LOADER_URL}?v={version}"></script>'
    assert updated.count(loader) == 1
    assert updated.index(loader) < updated.index("/assets/js/site-core.js")
    assert "supabase-js" not in updated

    # Re-running the synchronizer must keep exactly one loader and stay clean.
    repeated = sync_page(page, updated, version)
    assert repeated == updated
    assert len(re.findall(r"(?m)^[ \t]+$", repeated)) == 0

    print("[Supabase loader sync] PASS — no orphaned indentation, correct script order and idempotent output.")


if __name__ == "__main__":
    run()
