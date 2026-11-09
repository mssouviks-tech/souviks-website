"""Customer-safe projection of product application notes.

Internal provenance, research, qualification and reconciliation notes belong in
the audit records, not on customer-facing product pages or public catalogue APIs.
The canonical catalogue remains unchanged; this helper filters only its public
application projection.
"""
from __future__ import annotations

import re
from typing import Any

_INTERNAL_APPLICATION_NOTE_RE = re.compile(
    r"https?://"
    r"|\bsource\s*:"
    r"|\bsource[- ](?:linked|cited|backed|confirmed|reconciliation|reference)\b"
    r"|\b(?:fitment qualification|catalogue[- ]only audit|audit note|internal note|worklist)\b"
    r"|\b(?:supplier\s*/\s*product[- ]code conflict|exact[- ]code source reconciliation)\b"
    r"|\b(?:application evidence|vehicle fitment evidence|fitment evidence|cross[- ]reference reconciliation)\b"
    r"|\b(?:evidence|reconciliation|reconcile|conflict(?:ing)?|discrepancy|unverified|unconfirmed)\b"
    r"|\b(?:not substantiated|does not support|does not establish|not established|not independently|do not infer)\b"
    r"|\b(?:verify|verification|pending|before supply|before ordering|physical pack|physical marking|pack marking)\b"
    r"|\b(?:scribd|price list\s+w\.?e\.?f\.?|reviewed copy|authorised dealer|authorized dealer)\b",
    flags=re.IGNORECASE,
)


def is_internal_application_note(value: Any) -> bool:
    """Return True for provenance/audit/qualification prose, not fitment facts."""
    text = str(value or "").strip()
    return bool(text and _INTERNAL_APPLICATION_NOTE_RE.search(text))


def public_applications(value: Any) -> list[str]:
    """Return de-duplicated customer-facing application values only."""
    if isinstance(value, (list, tuple)):
        candidates = value
    elif value in (None, ""):
        candidates = []
    else:
        candidates = [value]

    result: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        item = str(candidate or "").strip()
        key = item.casefold()
        if not item or key in seen or is_internal_application_note(item):
            continue
        seen.add(key)
        result.append(item)
    return result
