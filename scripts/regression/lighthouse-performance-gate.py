#!/usr/bin/env python3
"""Gate browser-observed LCP while retaining Lighthouse regression comparisons."""

from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path
from urllib.parse import urlsplit

REPORT_DIR = Path(".lighthouseci")
DIAGNOSTIC_DIR = Path("lcp-diagnostic")
RUNS_REQUIRED = 3
HOMEPAGE_LCP_LIMIT_SECONDS = 4.0
LISTING_LCP_LIMIT_SECONDS = 4.0
MAX_BROWSER_LCP_REGRESSION = 0.05
MAX_ROUTE_LCP_REGRESSION = 0.10
MAX_TBT_REGRESSION_SECONDS = 0.05
MAX_PERFORMANCE_SCORE_DROP = 5.0

ROUTES = ("Homepage", "Product listing", "Product detail")
GROUPS = ("main", "PR", "deployed preview")


def classify(url: str) -> tuple[str | None, str | None]:
    parsed = urlsplit(url)
    if parsed.port == 4173:
        group = "main"
    elif parsed.port == 4174:
        group = "PR"
    elif parsed.hostname and parsed.hostname.endswith(".souviks-website.pages.dev"):
        group = "deployed preview"
    else:
        return None, None

    path = parsed.path.rstrip("/")
    if path in ("", "/"):
        route = "Homepage"
    elif path.endswith("/en/products.html") or path.endswith("/en/products"):
        route = "Product listing"
    elif path.endswith("/en/products/10-x-15-nut.html") or path.endswith("/en/products/10-x-15-nut"):
        route = "Product detail"
    else:
        return None, None
    return group, route


def load_lighthouse_reports() -> dict[tuple[str, str], list[dict[str, float]]]:
    groups: dict[tuple[str, str], list[dict[str, float]]] = {}
    if not REPORT_DIR.is_dir():
        raise RuntimeError(f"Missing Lighthouse report directory: {REPORT_DIR}")

    for path in sorted(REPORT_DIR.glob("*.report.json")):
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Cannot read Lighthouse report {path}: {error}") from error

        url = report.get("requestedUrl") or report.get("finalUrl") or ""
        group, route = classify(url)
        if not group or not route:
            continue

        audits = report.get("audits") or {}
        performance = (report.get("categories") or {}).get("performance") or {}
        lcp = (audits.get("largest-contentful-paint") or {}).get("numericValue")
        tbt = (audits.get("total-blocking-time") or {}).get("numericValue")
        score = performance.get("score")
        if not all(isinstance(value, (int, float)) for value in (lcp, tbt, score)):
            raise RuntimeError(f"Incomplete LCP/TBT/performance data in {path}")

        groups.setdefault((group, route), []).append({
            "lcp": float(lcp) / 1000.0,
            "tbt": float(tbt) / 1000.0,
            "score": float(score) * 100.0,
        })
    return groups


def load_observed_lcp() -> dict[str, dict[str, list[float]]]:
    """Read final homepage and listing hero LCP events from browser CDP runs."""
    routes = ("Homepage", "Product listing")
    groups = {
        route: {"main": [], "PR": [], "preview": []}
        for route in routes
    }
    if not DIAGNOSTIC_DIR.is_dir():
        raise RuntimeError(f"Missing browser LCP diagnostics directory: {DIAGNOSTIC_DIR}")

    for path in sorted(DIAGNOSTIC_DIR.glob("*.json")):
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Cannot read browser LCP diagnostic {path}: {error}") from error

        label = report.get("label")
        if label not in {"main", "PR", "preview"}:
            continue
        if report.get("responseStatus") != 200 or report.get("final", {}).get("navigationError"):
            raise RuntimeError(f"{label} navigation failed in {path}")

        requested_url = report.get("requestedUrl") or ""
        path_part = urlsplit(requested_url).path.rstrip("/")
        is_homepage = path_part in {"", "/index.html"}
        route = "Homepage" if is_homepage else "Product listing"
        entries = report.get("final", {}).get("lcpEntries") or []
        if not entries:
            raise RuntimeError(f"No PerformanceObserver LCP entries found in {path}")

        final_entry = max(
            entries,
            key=lambda entry: float(entry.get("startTime") or 0),
        )
        class_name = final_entry.get("className") or ""
        expected_class = "home-hero-image" if is_homepage else "products-hero-media"
        if final_entry.get("tagName") != "IMG" or expected_class not in class_name:
            raise RuntimeError(
                f"Expected {route} hero to be the final LCP element in {path}; "
                f"found {final_entry.get('tagName')} {class_name!r}"
            )

        start_time = final_entry.get("startTime")
        if not isinstance(start_time, (int, float)) or start_time <= 0:
            raise RuntimeError(f"Invalid observed LCP timestamp in {path}")
        groups[route][label].append(float(start_time) / 1000.0)

    for route in routes:
        for label, values in groups[route].items():
            if len(values) != RUNS_REQUIRED:
                raise RuntimeError(
                    f"{label} {route.lower()} diagnostics: expected {RUNS_REQUIRED} observed LCP runs, found {len(values)}"
                )
    return groups


def median(items: list[dict[str, float]], field: str) -> float:
    return statistics.median(item[field] for item in items)


def main() -> int:
    try:
        lighthouse = load_lighthouse_reports()
        observed = load_observed_lcp()
    except RuntimeError as error:
        print(f"[FAIL] {error}", file=sys.stderr)
        return 1

    failures: list[str] = []
    print("## Lighthouse simulated-mobile comparison")
    print("| Group | Route | Runs | Median LCP | Median TBT | Median performance |")
    print("|---|---|---:|---:|---:|---:|")
    for group in GROUPS:
        for route in ROUTES:
            runs = lighthouse.get((group, route), [])
            if runs:
                print(
                    f"| {group} | {route} | {len(runs)} | "
                    f"{median(runs, 'lcp'):.2f} s | {median(runs, 'tbt'):.3f} s | "
                    f"{median(runs, 'score'):.0f} |"
                )
            else:
                print(f"| {group} | {route} | 0 | — | — | — |")
            if len(runs) != RUNS_REQUIRED:
                failures.append(
                    f"{group} / {route}: expected {RUNS_REQUIRED} Lighthouse runs, found {len(runs)}"
                )

    print("")
    print("## Browser-observed homepage and product-listing LCP (CDP 3G / 4× CPU)")
    print("| Route | Group | Runs | Observed LCP values | Median LCP |")
    print("|---|---|---:|---|---:|")
    for route in ("Homepage", "Product listing"):
        for label in ("main", "PR", "preview"):
            values = observed[route][label]
            rendered = ", ".join(f"{value:.2f} s" for value in values)
            print(f"| {route} | {label} | {len(values)} | {rendered} | {statistics.median(values):.2f} s |")

    if failures:
        for failure in failures:
            print(f"[FAIL] {failure}")
        return 1

    for route, limit in (
        ("Homepage", HOMEPAGE_LCP_LIMIT_SECONDS),
        ("Product listing", LISTING_LCP_LIMIT_SECONDS),
    ):
        for label in ("PR", "preview"):
            values = observed[route][label]
            if any(value >= limit for value in values):
                failures.append(
                    f"{label} browser-observed {route.lower()} LCP must be below {limit:.1f}s in all three runs"
                )

    for route in ("Homepage", "Product listing"):
        baseline_values = observed[route]["main"]
        candidate_values = observed[route]["PR"]
        baseline_median = statistics.median(baseline_values)
        candidate_median = statistics.median(candidate_values)
        if candidate_median > baseline_median * (1 + MAX_BROWSER_LCP_REGRESSION):
            failures.append(
                f"PR browser-observed {route.lower()} LCP must not regress by more than {MAX_BROWSER_LCP_REGRESSION * 100:.0f}% "
                f"against main (main {baseline_median:.2f}s, PR {candidate_median:.2f}s)"
            )


    if failures:
        for failure in failures:
            print(f"[FAIL] {failure}")
        return 1

    # Lighthouse's standard simulated metrics remain the source for route regressions.
    for route in ("Product listing", "Product detail"):
        base = lighthouse[("main", route)]
        candidate = lighthouse[("PR", route)]
        base_lcp = median(base, "lcp")
        candidate_lcp = median(candidate, "lcp")
        base_tbt = median(base, "tbt")
        candidate_tbt = median(candidate, "tbt")
        base_score = median(base, "score")
        candidate_score = median(candidate, "score")

        if candidate_lcp > base_lcp * (1 + MAX_ROUTE_LCP_REGRESSION):
            failures.append(
                f"{route} simulated median LCP regressed by more than {MAX_ROUTE_LCP_REGRESSION * 100:.0f}% "
                f"(main {base_lcp:.2f}s, PR {candidate_lcp:.2f}s)"
            )
        if candidate_tbt > base_tbt + MAX_TBT_REGRESSION_SECONDS:
            failures.append(
                f"{route} median TBT regressed by more than {MAX_TBT_REGRESSION_SECONDS * 1000:.0f}ms "
                f"(main {base_tbt:.3f}s, PR {candidate_tbt:.3f}s)"
            )
        if candidate_score < base_score - MAX_PERFORMANCE_SCORE_DROP:
            failures.append(
                f"{route} median performance score dropped by more than {MAX_PERFORMANCE_SCORE_DROP:.0f} points "
                f"(main {base_score:.0f}, PR {candidate_score:.0f})"
            )

    if failures:
        for failure in failures:
            print(f"[FAIL] {failure}")
        return 1

    print(
        "[PASS] Browser-observed homepage and listing LCP are below 4.0s in all "
        "three PR and deployed-preview runs. PR browser-observed medians stay within 5% "
        "of main; simulated listing/detail LCP and TBT/performance regressions remain within guardrails."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
