"""Product title shortening that preserves high-value variant qualifiers."""
from __future__ import annotations

import re

# A few trailing suffixes distinguish otherwise identical commercial-vehicle
# parts. Keep these when fitting a title into the site's 70-character cap.
DISTINGUISHING_SUFFIX_RE = re.compile(
    r"(?P<suffix>\s+(?:"
    r"P\d+\s+(?:LH|RH)|"
    r"HYWA\s+(?:LH|RH)|"
    r"TYPE\s+[A-Z0-9]+|"
    r"AUX-[A-Z0-9]+|"
    r"(?:LH|RH|LHS|RHS|L/H|R/H|LEFT(?:-HAND)?|RIGHT(?:-HAND)?|N/S|O/S)"
    r")\s*[.)]?)$",
    flags=re.IGNORECASE,
)


def shorten_product_name_for_title(name: str, max_length: int) -> str:
    """Shorten a product name at word boundaries, retaining a terminal variant.

    If the name ends in a known distinguishing qualifier (for example P43 LH,
    P43 RH, Type 2 or AUX-A), reserve space for that qualifier before trimming
    the descriptive stem. This prevents side/variant-specific product pages
    from receiving identical titles simply because the suffix was truncated.
    """
    value = re.sub(r"\s+", " ", str(name or "")).strip()
    limit = max(0, int(max_length))
    if len(value) <= limit:
        return value
    if limit == 0:
        return ""

    match = DISTINGUISHING_SUFFIX_RE.search(value)
    if match:
        suffix = match.group("suffix")
        stem = value[:match.start()].rstrip(" ,;:-")
        stem_budget = limit - len(suffix)
        if stem_budget >= 3:
            fragment = stem[:stem_budget].rsplit(" ", 1)[0].rstrip(" ,;:-")
            if not fragment:
                fragment = stem[:stem_budget].rstrip(" ,;:-")
            candidate = fragment + suffix
            if candidate and len(candidate) <= limit:
                return candidate

    fragment = value[:limit].rsplit(" ", 1)[0].rstrip(" ,;:-")
    if not fragment:
        fragment = value[:limit].rstrip(" ,;:-")
    return fragment or value[:limit]
