#!/usr/bin/env python3
"""Enforce the PR mobile Lighthouse A/B and deployed-preview performance gate."""

from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path
from urllib.parse import urlsplit

REPORT_DIR = Path(".lighthouseci")
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


def load_reports() -> dict[tuple[str, str], list[dict[str, float]]]:
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
        values = (lcp, tbt, score)
        if not all(isinstance(value, (int, float)) for value in values):
            raise RuntimeError(f"Incomplete LCP/TBT/performance data in {path}")

        groups.setdefault((group, route), []).append({
            "lcp": float(lcp) / 1000.0,
            "tbt": float(tbt) / 1000.0,
            "score": float(score) * 100.0,
        })
    return groups


def median(items: list[dict[str, float]], field: str) -> float:
    return statistics.median(item[field] for item in items)


def main() -> int:
    try:
        groups = load_reports()
    except RuntimeError as error:
        print(f"[FAIL] {error}", file=sys.stderr)
        return 1

    failures: list[str] = []
    print("| Group | Route | Runs | Median LCP | Median TBT | Median performance |")
    print("|---|---|---:|---:|---:|---:|")
    for group in GROUPS:
        for route in ROUTES:
            runs = groups.get((group, route), [])
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

    # Do not interpret incomplete measurements as a successful performance gate.
    if failures:
        for failure in failures:
            print(f"[FAIL] {failure}")
        return 1

    baseline_listing = groups[("main", "Product listing")]
    candidate_listing = groups[("PR", "Product listing")]
    preview_listing = groups[("deployed preview", "Product listing")]

    candidate_listing_median = median(candidate_listing, "lcp")
    baseline_listing_median = median(baseline_listing, "lcp")
    preview_listing_median = median(preview_listing, "lcp")

    if any(item["lcp"] >= LISTING_LCP_LIMIT_SECONDS for item in candidate_listing):
        failures.append(
            f"PR product-listing LCP must be below {LISTING_LCP_LIMIT_SECONDS:.1f}s in all three runs"
        )
    if any(item["lcp"] >= LISTING_LCP_LIMIT_SECONDS for item in preview_listing):
        failures.append(
            f"Deployed-preview product-listing LCP must be below {LISTING_LCP_LIMIT_SECONDS:.1f}s in all three runs"
        )
    if candidate_listing_median > baseline_listing_median * (1 - MIN_LISTING_IMPROVEMENT):
        failures.append(
            f"PR listing median LCP must improve by at least {MIN_LISTING_IMPROVEMENT * 100:.0f}% "
            f"against main (main {baseline_listing_median:.2f}s, PR {candidate_listing_median:.2f}s)"
        )

    # Guard homepage and product-detail LCP, TBT, and performance score against regressions.
    for route in ("Homepage", "Product detail"):
        base = groups[("main", route)]
        candidate = groups[("PR", route)]
        base_lcp = median(base, "lcp")
        candidate_lcp = median(candidate, "lcp")
        base_tbt = median(base, "tbt")
        candidate_tbt = median(candidate, "tbt")
        base_score = median(base, "score")
        candidate_score = median(candidate, "score")

        if candidate_lcp > base_lcp * (1 + MAX_ROUTE_LCP_REGRESSION):
            failures.append(
                f"{route} median LCP regressed by more than {MAX_ROUTE_LCP_REGRESSION * 100:.0f}% "
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
        f"[PASS] All three PR and deployed-preview listing runs are below "
        f"{LISTING_LCP_LIMIT_SECONDS:.1f}s. Listing median: main {baseline_listing_median:.2f}s, "
        f"PR {candidate_listing_median:.2f}s, preview {preview_listing_median:.2f}s. "
        "Homepage and product-detail LCP/TBT/performance regressions are within guardrails."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
