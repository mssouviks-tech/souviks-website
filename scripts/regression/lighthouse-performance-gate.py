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
LISTING_LCP_LIMIT_SECONDS = 4.0
MIN_LISTING_IMPROVEMENT = 0.05
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


def load_observed_listing_lcp() -> dict[str, list[float]]:
    """Read final hero LCP events from the real browser CDP diagnostic runs."""
    groups: dict[str, list[float]] = {"main": [], "PR": [], "preview": []}
    if not DIAGNOSTIC_DIR.is_dir():
        raise RuntimeError(f"Missing browser LCP diagnostics directory: {DIAGNOSTIC_DIR}")

    for path in sorted(DIAGNOSTIC_DIR.glob("*.json")):
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Cannot read browser LCP diagnostic {path}: {error}") from error

        label = report.get("label")
        if label not in groups:
            continue
        if report.get("responseStatus") != 200 or report.get("final", {}).get("navigationError"):
            raise RuntimeError(f"{label} listing navigation failed in {path}")

        entries = report.get("final", {}).get("lcpEntries") or []
        if not entries:
            raise RuntimeError(f"No PerformanceObserver LCP entries found in {path}")

        final_entry = max(
            entries,
            key=lambda entry: float(entry.get("startTime") or 0),
        )
        class_name = final_entry.get("className") or ""
        if final_entry.get("tagName") != "IMG" or "products-hero-media" not in class_name:
            raise RuntimeError(
                f"Expected the product hero to be the final LCP element in {path}; "
                f"found {final_entry.get('tagName')} {class_name!r}"
            )

        start_time = final_entry.get("startTime")
        if not isinstance(start_time, (int, float)) or start_time <= 0:
            raise RuntimeError(f"Invalid observed LCP timestamp in {path}")
        groups[label].append(float(start_time) / 1000.0)

    for label, values in groups.items():
        if len(values) != RUNS_REQUIRED:
            raise RuntimeError(
                f"{label} listing diagnostics: expected {RUNS_REQUIRED} observed LCP runs, found {len(values)}"
            )
    return groups


def median(items: list[dict[str, float]], field: str) -> float:
    return statistics.median(item[field] for item in items)


def main() -> int:
    try:
        lighthouse = load_lighthouse_reports()
        observed = load_observed_listing_lcp()
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
    print("## Browser-observed product-listing LCP (CDP 3G / 4× CPU)")
    print("| Group | Runs | Observed LCP values | Median LCP |")
    print("|---|---:|---|---:|")
    for label in ("main", "PR", "preview"):
        values = observed[label]
        rendered = ", ".join(f"{value:.2f} s" for value in values)
        print(f"| {label} | {len(values)} | {rendered} | {statistics.median(values):.2f} s |")

    # Do not interpret incomplete measurements as a successful performance gate.
    if failures:
        for failure in failures:
            print(f"[FAIL] {failure}")
        return 1

    baseline_observed = observed["main"]
    candidate_observed = observed["PR"]
    preview_observed = observed["preview"]

    if any(value >= LISTING_LCP_LIMIT_SECONDS for value in candidate_observed):
        failures.append(
            f"PR browser-observed listing LCP must be below {LISTING_LCP_LIMIT_SECONDS:.1f}s in all three runs"
        )
    if any(value >= LISTING_LCP_LIMIT_SECONDS for value in preview_observed):
        failures.append(
            f"Deployed-preview browser-observed listing LCP must be below {LISTING_LCP_LIMIT_SECONDS:.1f}s in all three runs"
        )

    baseline_median = statistics.median(baseline_observed)
    candidate_median = statistics.median(candidate_observed)
    preview_median = statistics.median(preview_observed)
    if candidate_median > baseline_median * (1 - MIN_LISTING_IMPROVEMENT):
        failures.append(
            f"PR browser-observed listing LCP must improve by at least {MIN_LISTING_IMPROVEMENT * 100:.0f}% "
            f"against main (main {baseline_median:.2f}s, PR {candidate_median:.2f}s)"
        )

    # Lighthouse's standard simulated metrics remain the source for route regressions.
    for route in ("Homepage", "Product detail"):
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

    # Ensure the local Lighthouse PR result still improves against the same local main baseline.
    base_sim = lighthouse[("main", "Product listing")]
    candidate_sim = lighthouse[("PR", "Product listing")]
    base_sim_median = median(base_sim, "lcp")
    candidate_sim_median = median(candidate_sim, "lcp")
    if candidate_sim_median > base_sim_median * (1 - MIN_LISTING_IMPROVEMENT):
        failures.append(
            f"PR simulated listing LCP must improve by at least {MIN_LISTING_IMPROVEMENT * 100:.0f}% "
            f"against main (main {base_sim_median:.2f}s, PR {candidate_sim_median:.2f}s)"
        )

    if failures:
        for failure in failures:
            print(f"[FAIL] {failure}")
        return 1

    print(
        f"[PASS] Browser-observed PR and deployed-preview listing LCP are each below "
        f"{LISTING_LCP_LIMIT_SECONDS:.1f}s in all three runs. Observed medians: "
        f"main {baseline_median:.2f}s, PR {candidate_median:.2f}s, preview {preview_median:.2f}s. "
        "The PR also improves simulated listing LCP and stays within homepage/detail LCP, TBT and performance guardrails."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
