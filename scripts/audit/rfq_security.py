"""Static contract checks for the authenticated RFQ security boundary."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

JS_BUNDLES = (
    ROOT / "assets/js/bundles/request-quote.js",
    ROOT / "assets/js/bundles/account.js",
)

MIGRATION = ROOT / "supabase/migrations/20261008_rfq_rls.sql"


def fail(errors: list[str]) -> None:
    if errors:
        print("[rfq security] FAIL")
        for error in errors:
            print(f"  - {error}")
        raise SystemExit(1)


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value)


def main() -> None:
    errors: list[str] = []

    if not MIGRATION.is_file():
        errors.append(f"missing security migration: {MIGRATION.relative_to(ROOT)}")
    else:
        sql = MIGRATION.read_text(encoding="utf-8", errors="ignore").lower()
        required_sql = (
            "enable row level security",
            "security definer",
            "auth.uid()",
            "create or replace function public.submit_rfq",
            "revoke all on function public.submit_rfq",
            "grant execute on function public.submit_rfq",
            'drop policy if exists "rfqs_insert_own"',
            'drop policy if exists "rfq_items_insert_own"',
            "check (quantity between 1 and 9999)",
        )
        for token in required_sql:
            if token not in sql:
                errors.append(f"security migration missing required contract: {token}")

        if re.search(
            r"grant\s+execute\s+on\s+function\s+public\.submit_rfq[^;]*\bto\s+(?:public|anon)\b",
            sql,
            flags=re.I,
        ):
            errors.append("submit_rfq must not be executable by public/anon roles")

    for path in JS_BUNDLES:
        if not path.is_file():
            errors.append(f"missing RFQ bundle: {path.relative_to(ROOT)}")
            continue

        raw = path.read_text(encoding="utf-8", errors="ignore")
        flat = normalized(raw)

        required_js = (
            "MAX_QUANTITY:",
            "MAX_ITEMS:",
            "RFQ.normalizeQuantity = function",
            "RFQ.normalizeItem = function",
        )
        for token in required_js:
            if token not in raw:
                errors.append(
                    f"{path.relative_to(ROOT)} missing RFQ security contract: {token}"
                )

        if not re.search(
            r'\.rpc\(\s*["\']submit_rfq["\']',
            raw,
            flags=re.I,
        ):
            errors.append(
                f"{path.relative_to(ROOT)} missing RFQ security contract: rpc submit_rfq"
            )

        direct_parent_insert = re.search(
            r'''\.from\(\s*["']rfqs["']\s*\)\s*\.insert\s*\(''',
            raw,
            flags=re.I,
        )
        if direct_parent_insert:
            errors.append(
                f"{path.relative_to(ROOT)} still performs direct rfqs INSERT from browser code"
            )

        direct_item_insert = re.search(
            r'''\.from\(\s*["']rfq_items["']\s*\)\s*\.insert\s*\(''',
            raw,
            flags=re.I,
        )
        if direct_item_insert:
            errors.append(
                f"{path.relative_to(ROOT)} still performs direct rfq_items INSERT from browser code"
            )

    fail(errors)
    print("[rfq security] PASS")


if __name__ == "__main__":
    main()
