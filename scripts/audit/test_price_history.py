#!/usr/bin/env python3
"""Unit tests for evidence-gated 1m, 3m, 6m and since-tracking-start prices."""
from __future__ import annotations

import datetime as dt
import decimal
import importlib.util
import pathlib
import sys
from zoneinfo import ZoneInfo

SCRIPT = pathlib.Path(__file__).with_name("record_price_history.py")
spec = importlib.util.spec_from_file_location("record_price_history", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = module
spec.loader.exec_module(module)

IST = ZoneInfo("Asia/Kolkata")
now = dt.datetime(2026, 12, 10, 0, 30, tzinfo=IST)
PRODUCT_ID = "SVKS000001"


def snapshot(
    at: dt.datetime,
    price: str | None = "1000.00",
    *,
    active: bool = True,
    include_product: bool = True,
) -> dict:
    products = []
    if include_product:
        products.append({
            "id": PRODUCT_ID,
            "active": active,
            "selling_price_inr": price,
            "mrp_inr": "1200.00",
        })
    return {
        "schema": module.SCHEMA,
        "captured_at": at.isoformat(timespec="seconds"),
        "products": products,
    }


def daily_history() -> list[dict]:
    values = []
    for day in range(180, 0, -1):
        price = {
            5: "980.00",
            45: "970.00",
            100: "960.00",
            160: "950.00",
        }.get(day, "1000.00")
        values.append(snapshot(now - dt.timedelta(days=day), price))
    return values


history = daily_history()
expected_since = history[0]["captured_at"]

# Each period returns the lowest observed catalogue selling price within its own window.
assert module.verified_lowest_price(
    PRODUCT_ID, history, now=now, window=dt.timedelta(days=30)
)[0] == decimal.Decimal("980.00")
assert module.verified_lowest_price(
    PRODUCT_ID, history, now=now, window=dt.timedelta(days=90)
)[0] == decimal.Decimal("970.00")
assert module.verified_lowest_price(
    PRODUCT_ID, history, now=now, window=dt.timedelta(days=180)
)[0] == decimal.Decimal("950.00")
all_time = module.verified_lowest_price(PRODUCT_ID, history, now=now, window=None)
assert all_time == (decimal.Decimal("950.00"), expected_since), all_time

# A 30-day history may be complete while 3m and 6m are not yet eligible.
short_history = [item for item in history if module.parse_time(item["captured_at"]) >=
                 (now - dt.timedelta(days=30)).astimezone(dt.timezone.utc)]
short_history.insert(0, snapshot(now - dt.timedelta(days=30), "1000.00"))
assert module.verified_lowest_price(
    PRODUCT_ID, short_history, now=now, window=dt.timedelta(days=30)
) is not None
assert module.verified_lowest_price(
    PRODUCT_ID, short_history, now=now, window=dt.timedelta(days=90)
) is None
assert module.verified_lowest_price(
    PRODUCT_ID, short_history, now=now, window=dt.timedelta(days=180)
) is None

# Missing the required boundary observation invalidates only windows that need it.
without_180_day_boundary = history[1:]
assert module.verified_lowest_price(
    PRODUCT_ID, without_180_day_boundary, now=now, window=dt.timedelta(days=30)
) is not None
assert module.verified_lowest_price(
    PRODUCT_ID, without_180_day_boundary, now=now, window=dt.timedelta(days=90)
) is not None
assert module.verified_lowest_price(
    PRODUCT_ID, without_180_day_boundary, now=now, window=dt.timedelta(days=180)
) is None

# The SKU must be active and priced at the exact boundary for a fixed window.
one_month_boundary = now - dt.timedelta(days=30)
boundary_inactive = [
    snapshot(one_month_boundary, active=False),
    *[item for item in history if module.parse_time(item["captured_at"]) > one_month_boundary.astimezone(dt.timezone.utc)],
]
assert module.verified_lowest_price(
    PRODUCT_ID, boundary_inactive, now=now, window=dt.timedelta(days=30)
) is None
boundary_unpriced = [
    snapshot(one_month_boundary, price=None),
    *[item for item in history if module.parse_time(item["captured_at"]) > one_month_boundary.astimezone(dt.timezone.utc)],
]
assert module.verified_lowest_price(
    PRODUCT_ID, boundary_unpriced, now=now, window=dt.timedelta(days=30)
) is None

# An observation gap above 26 hours invalidates each affected window and all-time history.
gappy = [item for index, item in enumerate(history) if index != len(history) - 10]
for days in (30, 90, 180):
    assert module.verified_lowest_price(
        PRODUCT_ID, gappy, now=now, window=dt.timedelta(days=days)
    ) is None
all_time_after_gap = module.verified_lowest_price(PRODUCT_ID, gappy, now=now, window=None)
assert all_time_after_gap == (
    decimal.Decimal("980.00"),
    (now - dt.timedelta(days=9)).isoformat(timespec="seconds"),
), all_time_after_gap

# Missing, inactive, or unpriced observations inside the period fail closed.
for bad_snapshot in (
    snapshot(now - dt.timedelta(days=10), active=False),
    snapshot(now - dt.timedelta(days=10), price=None),
    snapshot(now - dt.timedelta(days=10), include_product=False),
):
    broken = [
        bad_snapshot if item["captured_at"] == bad_snapshot["captured_at"] else item
        for item in history
    ]
    assert module.verified_lowest_price(
        PRODUCT_ID, broken, now=now, window=dt.timedelta(days=30)
    ) is None
    all_time_after_break = module.verified_lowest_price(PRODUCT_ID, broken, now=now, window=None)
    assert all_time_after_break == (
        decimal.Decimal("980.00"),
        (now - dt.timedelta(days=9)).isoformat(timespec="seconds"),
    ), all_time_after_break

# All-time starts at the first active, priced observation for the SKU, not before it existed.
late_product_history = [
    snapshot(item_time, include_product=False)
    for item_time in (now - dt.timedelta(days=180), now - dt.timedelta(days=179))
] + [
    snapshot(now - dt.timedelta(days=178), "975.00"),
    snapshot(now - dt.timedelta(days=177), "990.00"),
    *[
        snapshot(now - dt.timedelta(days=day), "990.00")
        for day in range(176, 0, -1)
    ],
]
late_all_time = module.verified_lowest_price(
    PRODUCT_ID, late_product_history, now=now, window=None
)
assert late_all_time == (
    decimal.Decimal("975.00"),
    late_product_history[2]["captured_at"],
)
assert module.verified_lowest_price(
    PRODUCT_ID, late_product_history, now=now, window=dt.timedelta(days=180)
) is None

# Derivation stores every available period independently of today's selling price.
catalogue = [{
    "id": PRODUCT_ID,
    "active": True,
    "selling_price": 900.0,
    "mrp": 1200.0,
}]
derived = module.derive_price_history(catalogue, history, now=now)
assert derived[PRODUCT_ID] == {
    "1m": decimal.Decimal("980.00"),
    "3m": decimal.Decimal("970.00"),
    "6m": decimal.Decimal("950.00"),
    "all_time": decimal.Decimal("950.00"),
    "since": expected_since,
}
catalogue[0]["selling_price"] = 990.0
derived_with_higher_current = module.derive_price_history(catalogue, history, now=now)
assert derived_with_higher_current[PRODUCT_ID]["1m"] == decimal.Decimal("980.00")

# Apply the four periods to catalogue data; the 30-day comparison is separate
# and appears only when today's catalogue price is below the historical 1m low.
catalogue[0]["selling_price"] = 900.0
assert module.apply_price_history(catalogue, derived)
assert catalogue[0]["price_history_1m"] == 980.0
assert catalogue[0]["price_history_3m"] == 970.0
assert catalogue[0]["price_history_6m"] == 950.0
assert catalogue[0]["price_history_all_time"] == 950.0
assert catalogue[0]["price_history_since"] == expected_since
assert catalogue[0]["prior_price_30d"] == 980.0

catalogue[0]["selling_price"] = 990.0
assert module.apply_price_history(catalogue, derived_with_higher_current)
assert catalogue[0]["prior_price_30d"] is None
assert catalogue[0]["price_history_1m"] == 980.0

# MRP is never used as a substitute for an unavailable recorded selling price.
assert decimal.Decimal("950.00") != decimal.Decimal("1200.00")

print("[Price history tests] PASS — independent 1m/3m/6m/all-time windows, boundaries, coverage gaps, SKU lifecycle and MRP separation.")
