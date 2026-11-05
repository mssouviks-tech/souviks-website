#!/usr/bin/env python3
"""Hard-gate real browser-observed production LCP across core catalogue routes."""

from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path
from urllib.parse import urlsplit

DIAGNOSTIC_DIR = Path("lcp-diagnostic")
RUNS_REQUIRED = 3
LCP_LIMIT_SECONDS = 4.0
ROUTES = ("Homepage", "Product listing", "Product detail")


def classify(pathname: str) -> str | None:
    path = pathname.rstrip("/") or "/"
    if path in {"/", "/index.html"}:
        return "Homepage"
    if path.endswith("/products/10-x-15-nut.html") or path.endswith("/products/10-x-15-nut"):
        return "Product detail"
    if path.endswith("/products.html") or path.endswith("/products"):
        return "Product listing"
    return None


def expected_lcp_element(route: str, entry: dict) -> bool:
    if entry.get("tagName") != "IMG":
        return False
    if route == "Homepage":
        return "home-hero-image" in (entry.get("className") or "")
    if route == "Product listing":
        return "products-hero-media" in (entry.get("className") or "")
    return route == "Product detail" and entry.get("id") == "pdpMainImage"


def main() -> int:
    if not DIAGNOSTIC_DIR.is_dir():
        print(f"[FAIL] Missing browser LCP diagnostics directory: {DIAGNOSTIC_DIR}", file=sys.stderr)
        return 1

    values: dict[str, list[float]] = {route: [] for route in ROUTES}
    failures: list[str] = []

    for path in sorted(DIAGNOSTIC_DIR.glob("*.json")):
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            failures.append(f"Cannot read diagnostic {path}: {error}")
            continue

        if report.get("label") != "production":
            continue

        requested_url = report.get("requestedUrl") or ""
        route = classify(urlsplit(requested_url).path)
        if route is None:
            failures.append(f"Unexpected production route in {path}: {requested_url!r}")
            continue
        if report.get("responseStatus") != 200 or report.get("final", {}).get("navigationError"):
            failures.append(f"Production navigation failed for {route} in {path}")
            continue

        entries = report.get("final", {}).get("lcpEntries") or []
        if not entries:
            failures.append(f"No browser-observed LCP entry for {route} in {path}")
            continue

        final_entry = max(entries, key=lambda entry: float(entry.get("startTime") or 0))
        if not expected_lcp_element(route, final_entry):
            failures.append(
                f"Unexpected final LCP element for {route} in {path}: "
                f"tag={final_entry.get('tagName')!r}, "
                f"id={final_entry.get('id')!r}, "
                f"class={final_entry.get('className')!r}"
            )
            continue

        start_time = final_entry.get("startTime")
        if not isinstance(start_time, (int, float)) or start_time <= 0:
            failures.append(f"Invalid LCP timestamp for {route} in {path}: {start_time!r}")
            continue
        values[route].append(float(start_time) / 1000.0)

    print("## Production browser-observed LCP (CDP 3G / 4× CPU)")
    print("| Route | Runs | Measurements | Median | Maximum | Budget |")
    print("|---|---:|---|---:|---:|---:|")
    for route in ROUTES:
        measurements = values[route]
        rendered = ", ".join(f"{value:.2f}s" for value in measurements) if measurements else "—"
        median = statistics.median(measurements) if measurements else None
        maximum = max(measurements) if measurements else None
        print(
            f"| {route} | {len(measurements)} | {rendered} | "
            f"{f'{median:.2f}s' if median is not None else '—'} | "
            f"{f'{maximum:.2f}s' if maximum is not None else '—'} | "
            f"< {LCP_LIMIT_SECONDS:.1f}s |"
        )

        if len(measurements) != RUNS_REQUIRED:
            failures.append(
                f"{route}: expected {RUNS_REQUIRED} production browser runs, found {len(measurements)}"
            )
        if any(value >= LCP_LIMIT_SECONDS for value in measurements):
            failures.append(
                f"{route}: every production browser-observed LCP must be below {LCP_LIMIT_SECONDS:.1f}s"
            )

    if failures:
        for failure in failures:
            print(f"[FAIL] {failure}", file=sys.stderr)
        return 1

    print(
        "[PASS] Homepage, product listing and product detail LCP are each below "
        "4.0s in all three production browser runs."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
