#!/usr/bin/env python3
"""Deterministic replacement for generated product pricing and price-history markup."""
from __future__ import annotations

import re

_HISTORY_SECTION = re.compile(
    r"""<section\b[^>]*class=["'][^"']*\bpdp-price-history\b[^"']*["'][^>]*>.*?</section>""",
    flags=re.IGNORECASE | re.DOTALL,
)

# Match the complete pricing block through its closing div, including nested
# price rows, and stop immediately before the following product metadata block.
# Keep this expression in one place so the build and its regression test share
# the exact same HTML contract.
_PRICING_BLOCK = re.compile(
    r"""<div\b(?=[^>]*class=["'][^"']*\bpdp-pricing\b[^"']*["'])[^>]*>.*?</div>\s*(?=<div\b(?=[^>]*class=["'][^"']*\bpdp-meta\b[^"']*["']))""",
    flags=re.IGNORECASE | re.DOTALL,
)


def replace_pdp_pricing_block(
    document: str,
    *,
    pricing_markup: str,
    price_history_markup: str,
) -> tuple[str, bool]:
    """Replace an existing PDP pricing block and its generated history panel.

    Existing history sections are removed first, making repeated catalogue
    builds idempotent. Returns the updated document and whether a pricing
    block was found. The caller decides whether absence is fatal based on
    whether it had recorded history to publish.
    """
    cleaned = _HISTORY_SECTION.sub("", document)
    match = _PRICING_BLOCK.search(cleaned)
    if match is None:
        return cleaned, False
    updated = cleaned[:match.start()] + pricing_markup + price_history_markup + cleaned[match.end():]
    return updated, True
