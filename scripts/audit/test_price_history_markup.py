#!/usr/bin/env python3
"""Regression tests for injecting recorded price history into PDP pricing markup."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "catalogue"))

from price_history_markup import replace_pdp_pricing_block


PRICING = (
    '<div aria-label="Product pricing" class="pdp-pricing">'
    '<div class="pdp-price-mrp"><span>MRP</span><s>₹1,723.8</s></div>'
    '<span class="pdp-price-discount">23% below MRP</span>'
    '<div class="pdp-price-selling"><span>Selling Price</span><span>₹1,326</span></div>'
    '</div>'
)
META = '<div class="pdp-meta"><div class="pdp-row">Part Number</div></div>'
NEW_PRICING = '<div class="pdp-pricing" aria-label="Product pricing"><span>₹1,326</span></div>'
HISTORY = '<section class="pdp-price-history" aria-label="Recorded price history"><h3>Lowest recorded catalogue price</h3></section>'


def run() -> None:
    source = '<main>' + PRICING + '\n' + META + '</main>'
    updated, found = replace_pdp_pricing_block(
        source,
        pricing_markup=NEW_PRICING,
        price_history_markup=HISTORY,
    )
    assert found, "nested pricing markup should be matched"
    assert updated.count('class="pdp-pricing"') == 1
    assert updated.count('class="pdp-price-history"') == 1
    assert updated.index(NEW_PRICING) < updated.index(HISTORY) < updated.index(META)

    # A second build replaces, rather than duplicates, the generated panel.
    second, found_again = replace_pdp_pricing_block(
        updated,
        pricing_markup=NEW_PRICING,
        price_history_markup=HISTORY,
    )
    assert found_again
    assert second.count('class="pdp-price-history"') == 1

    # A template without a pricing block is reported to the caller, and any
    # stale generated history panel is still removed.
    missing, found_missing = replace_pdp_pricing_block(
        '<main>' + HISTORY + '<div class="pdp-meta"></div></main>',
        pricing_markup=NEW_PRICING,
        price_history_markup=HISTORY,
    )
    assert not found_missing
    assert 'class="pdp-price-history"' not in missing

    print("[Price history markup] PASS — nested pricing block replacement, idempotency and missing-template detection.")


if __name__ == "__main__":
    run()
