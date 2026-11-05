#!/usr/bin/env python3
"""Capture deployed Souviks catalogue prices and derive evidence-backed 30-day prior prices.

Snapshots contain only public catalogue data. A comparison is emitted only when the
product was active with a valid price throughout a fully observed rolling 30-day
window. Missing coverage, inactive/missing products, or invalid prices fail closed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import decimal
import hashlib
import json
import pathlib
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOGUE_PATH = ROOT / "assets" / "data" / "catalogue-index.json"
SNAPSHOT_DIR = ROOT / "docs" / "audit" / "price-history" / "snapshots"
TIME_ZONE = ZoneInfo("Asia/Kolkata")
MAX_OBSERVATION_GAP = dt.timedelta(hours=26)
SCHEMA = "souviks-price-history/v1"


def as_decimal(value: object) -> decimal.Decimal | None:
    if value is None or value == "":
        return None
    try:
        result = decimal.Decimal(str(value))
    except (decimal.InvalidOperation, ValueError, TypeError):
        return None
    if not result.is_finite() or result <= 0:
        return None
    return result.quantize(decimal.Decimal("0.01"), rounding=decimal.ROUND_HALF_UP)


def parse_time(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError(f"Snapshot timestamp must include a timezone: {value}")
    return parsed.astimezone(dt.timezone.utc)


def product_entries(catalogue: object) -> list[dict]:
    if not isinstance(catalogue, list) or not catalogue:
        raise ValueError("The catalogue must be a non-empty JSON array")
    seen: set[str] = set()
    entries: list[dict] = []
    for product in catalogue:
        if not isinstance(product, dict):
            raise ValueError("Catalogue contains a non-object product record")
        product_id = str(product.get("id") or "").strip()
        if not product_id:
            raise ValueError("Every catalogue record must have a stable id")
        if product_id in seen:
            raise ValueError(f"Duplicate catalogue product id: {product_id}")
        seen.add(product_id)
        selling = as_decimal(product.get("selling_price"))
        mrp = as_decimal(product.get("mrp"))
        entries.append({
            "id": product_id,
            "part_number": str(product.get("part_number") or product.get("partNumber") or "").strip() or None,
            "name": str(product.get("product_name") or product.get("name") or "").strip() or None,
            "active": product.get("active") is not False,
            "selling_price_inr": str(selling) if selling is not None else None,
            "mrp_inr": str(mrp) if mrp is not None else None,
        })
    return entries


def read_snapshot(path: pathlib.Path) -> dict:
    obj = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(obj, dict) or obj.get("schema") != SCHEMA:
        raise ValueError(f"Unsupported price-history snapshot: {path}")
    parse_time(str(obj.get("captured_at") or ""))
    products = obj.get("products")
    if not isinstance(products, list) or not products:
        raise ValueError(f"Snapshot has no products array: {path}")
    if obj.get("product_count") != len(products):
        raise ValueError(f"Snapshot product_count does not match its product rows: {path}")
    digest = str(obj.get("catalogue_sha256") or "")
    if len(digest) != 64 or any(character not in "0123456789abcdef" for character in digest.lower()):
        raise ValueError(f"Snapshot has an invalid catalogue SHA-256 digest: {path}")
    seen: set[str] = set()
    for product in products:
        if not isinstance(product, dict):
            raise ValueError(f"Snapshot contains a non-object product row: {path}")
        product_id = str(product.get("id") or "").strip()
        if not product_id or product_id in seen:
            raise ValueError(f"Snapshot contains a missing or duplicate product id: {path}")
        seen.add(product_id)
        if not isinstance(product.get("active"), bool):
            raise ValueError(f"Snapshot product {product_id} has no boolean active status: {path}")
        if product.get("selling_price_inr") is not None and as_decimal(product.get("selling_price_inr")) is None:
            raise ValueError(f"Snapshot product {product_id} has an invalid selling price: {path}")
    return obj


def load_snapshots(directory: pathlib.Path) -> list[dict]:
    snapshots = [read_snapshot(path) for path in sorted(directory.rglob("*.json"))] if directory.exists() else []
    snapshots.sort(key=lambda item: parse_time(item["captured_at"]))
    # Keep one deterministic observation for a timestamp if a workflow was retried.
    unique: dict[str, dict] = {}
    for snapshot in snapshots:
        unique[snapshot["captured_at"]] = snapshot
    return sorted(unique.values(), key=lambda item: parse_time(item["captured_at"]))


def build_snapshot(
    raw_catalogue: bytes,
    *,
    captured_at: dt.datetime,
    source_url: str,
    source_commit: str,
    capture_id: str,
) -> dict:
    if captured_at.tzinfo is None:
        raise ValueError("captured_at must be timezone-aware")
    try:
        catalogue = json.loads(raw_catalogue.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Live catalogue is not valid UTF-8 JSON: {exc}") from exc
    entries = product_entries(catalogue)
    return {
        "schema": SCHEMA,
        "captured_at": captured_at.astimezone(TIME_ZONE).isoformat(timespec="seconds"),
        "capture_id": capture_id,
        "source_url": source_url,
        "source_commit": source_commit,
        "catalogue_sha256": hashlib.sha256(raw_catalogue).hexdigest(),
        "product_count": len(entries),
        "products": entries,
    }


def _history_product(snapshot: dict, product_id: str) -> dict | None:
    return next(
        (product for product in snapshot["products"] if product.get("id") == product_id),
        None,
    )


def _active_recorded_price(snapshot: dict, product_id: str) -> decimal.Decimal | None:
    product = _history_product(snapshot, product_id)
    if not product or product.get("active") is not True:
        return None
    return as_decimal(product.get("selling_price_inr"))


def verified_lowest_price(
    product_id: str,
    snapshots: list[dict],
    *,
    now: dt.datetime,
    window: dt.timedelta | None,
) -> tuple[decimal.Decimal, str] | None:
    """Return the lowest observed catalogue price and coverage start, or None.

    Fixed windows require a priced, active boundary observation no more than
    26 hours before the window, then continuous active/priced observations
    through the latest capture. All-time uses the latest uninterrupted active,
    priced tracking run for this SKU and returns that run's start timestamp.
    It is not a claim about prices before this recorder began tracking.
    """
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    now_utc = now.astimezone(dt.timezone.utc)
    history = [
        snapshot for snapshot in snapshots
        if parse_time(snapshot["captured_at"]) <= now_utc
    ]
    history.sort(key=lambda item: parse_time(item["captured_at"]))
    if not history:
        return None

    if window is not None:
        start = now_utc - window
        boundary_candidates = [
            snapshot for snapshot in history
            if parse_time(snapshot["captured_at"]) <= start
        ]
        if not boundary_candidates:
            return None
        boundary = boundary_candidates[-1]
        boundary_time = parse_time(boundary["captured_at"])
        if start - boundary_time > MAX_OBSERVATION_GAP:
            return None
        if _active_recorded_price(boundary, product_id) is None:
            return None
        observations = [
            snapshot for snapshot in history
            if start <= parse_time(snapshot["captured_at"]) < now_utc
        ]
        if not observations:
            return None
        coverage = [boundary] + observations
        coverage_times = [parse_time(item["captured_at"]) for item in coverage]
        prices = []
        for snapshot in observations:
            price = _active_recorded_price(snapshot, product_id)
            if price is None:
                return None
            prices.append(price)
        coverage_start = start.isoformat()
    else:
        # All-time means the latest uninterrupted active/priced tracking run.
        # A missing, inactive, unpriced, or stale observation starts a new run
        # at the next valid capture instead of permanently poisoning all-time.
        observations = []
        previous_time = None
        for snapshot in history:
            captured = parse_time(snapshot["captured_at"])
            price = _active_recorded_price(snapshot, product_id)
            if price is None:
                observations = []
                previous_time = None
                continue
            if previous_time is not None and captured - previous_time > MAX_OBSERVATION_GAP:
                observations = []
            observations.append(snapshot)
            previous_time = captured
        # One sample is not meaningful price history. Require at least two captures.
        if len(observations) < 2:
            return None
        coverage_times = [parse_time(item["captured_at"]) for item in observations]
        prices = [
            _active_recorded_price(snapshot, product_id)
            for snapshot in observations
        ]
        if any(price is None for price in prices):
            return None
        coverage_start = observations[0]["captured_at"]

    if not prices:
        return None
    if any(
        (later - earlier) > MAX_OBSERVATION_GAP
        for earlier, later in zip(coverage_times, coverage_times[1:])
    ):
        return None
    if now_utc - coverage_times[-1] > MAX_OBSERVATION_GAP:
        return None
    return min(prices), coverage_start


def derive_price_history(
    catalogue: object,
    snapshots: list[dict],
    *,
    now: dt.datetime,
) -> dict[str, dict[str, decimal.Decimal | str | None]]:
    entries = product_entries(catalogue)
    derived: dict[str, dict[str, decimal.Decimal | str | None]] = {}
    windows = {
        "1m": dt.timedelta(days=30),
        "3m": dt.timedelta(days=90),
        "6m": dt.timedelta(days=180),
        "all_time": None,
    }
    for entry in entries:
        product_id = entry["id"]
        values: dict[str, decimal.Decimal | str | None] = {}
        if entry["active"]:
            for period, window in windows.items():
                result = verified_lowest_price(
                    product_id, snapshots, now=now, window=window
                )
                values[period] = result[0] if result else None
                if period == "all_time":
                    values["since"] = result[1] if result else None
        else:
            values = {period: None for period in windows}
            values["since"] = None
        derived[product_id] = values
    return derived


def apply_price_history(
    catalogue: list[dict],
    derived: dict[str, dict[str, decimal.Decimal | str | None]],
) -> bool:
    changed = False
    fields = {
        "1m": "price_history_1m",
        "3m": "price_history_3m",
        "6m": "price_history_6m",
        "all_time": "price_history_all_time",
    }
    for product in catalogue:
        if not isinstance(product, dict) or not product.get("id"):
            continue
        product_id = str(product["id"])
        values = derived.get(product_id, {})
        current = as_decimal(product.get("selling_price"))
        for period, field in fields.items():
            value = values.get(period)
            normalized = float(value) if isinstance(value, decimal.Decimal) else None
            existing = as_decimal(product.get(field))
            target = as_decimal(normalized)
            if existing != target or (normalized is None and product.get(field) is not None):
                product[field] = normalized
                changed = True
        since_value = values.get("since")
        since = str(since_value) if since_value else None
        if product.get("price_history_since") != since:
            product["price_history_since"] = since
            changed = True

        one_month = values.get("1m")
        prior = (
            float(one_month)
            if current is not None
            and isinstance(one_month, decimal.Decimal)
            and one_month > current
            else None
        )
        existing_prior = as_decimal(product.get("prior_price_30d"))
        target_prior = as_decimal(prior)
        if existing_prior != target_prior or (prior is None and product.get("prior_price_30d") is not None):
            product["prior_price_30d"] = prior
            changed = True
    return changed


def fetch_live_catalogue(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache, no-store, max-age=0",
            "Pragma": "no-cache",
            "User-Agent": "Souviks-Price-History-Audit/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            if response.status != 200:
                raise RuntimeError(f"Live catalogue returned HTTP {response.status}")
            body = response.read(50 * 1024 * 1024 + 1)
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not fetch production catalogue: {exc}") from exc
    if len(body) > 50 * 1024 * 1024:
        raise RuntimeError("Live catalogue exceeds the 50 MiB safety limit")
    return body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-url", required=True, help="Deployed production catalogue JSON URL")
    parser.add_argument("--source-commit", required=True, help="Main commit known to be deployed")
    parser.add_argument("--capture-id", required=True, help="Unique GitHub Actions run identifier")
    parser.add_argument("--catalogue", type=pathlib.Path, default=CATALOGUE_PATH)
    parser.add_argument("--snapshot-dir", type=pathlib.Path, default=SNAPSHOT_DIR)
    args = parser.parse_args()

    local_bytes = args.catalogue.read_bytes()
    live_bytes = fetch_live_catalogue(args.source_url)
    local_hash = hashlib.sha256(local_bytes).hexdigest()
    live_hash = hashlib.sha256(live_bytes).hexdigest()
    if live_hash != local_hash:
        raise RuntimeError(
            "Production catalogue does not match the checked-out main revision; "
            "refusing to record an unverified or stale deployment. "
            f"local_sha256={local_hash}, live_sha256={live_hash}"
        )

    captured_at = dt.datetime.now(TIME_ZONE).replace(microsecond=0)
    snapshot = build_snapshot(
        live_bytes,
        captured_at=captured_at,
        source_url=args.source_url,
        source_commit=args.source_commit,
        capture_id=args.capture_id,
    )
    args.snapshot_dir.mkdir(parents=True, exist_ok=True)
    folder = args.snapshot_dir / captured_at.strftime("%Y-%m-%d")
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{captured_at.strftime('%H%M%S%z')}-{args.capture_id}.json"
    destination = folder / filename
    if destination.exists():
        raise FileExistsError(f"Snapshot already exists: {destination}")
    destination.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    catalogue = json.loads(local_bytes.decode("utf-8-sig"))
    snapshots_for_derivation = load_snapshots(args.snapshot_dir)
    derived = derive_price_history(catalogue, snapshots_for_derivation, now=captured_at)
    catalogue_changed = apply_price_history(catalogue, derived)
    if catalogue_changed:
        args.catalogue.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    eligible = {
        period: sum(values.get(period) is not None for values in derived.values())
        for period in ("1m", "3m", "6m", "all_time")
    }
    print(f"Recorded {snapshot['product_count']} catalogue products in {destination.relative_to(ROOT)}")
    print("Verified lowest recorded catalogue prices available: " + ", ".join(
        f"{period}={count}" for period, count in eligible.items()
    ))
    print("Comparisons were withheld independently for each period wherever observation coverage or product history was incomplete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[price-history] ERROR: {exc}", file=sys.stderr)
        raise
