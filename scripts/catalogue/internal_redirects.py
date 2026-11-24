"""Exact URL-path rewriting for internal legacy redirects.

Redirect sources are full URL paths, not arbitrary substrings. In particular,
a root alias such as /products must never rewrite /en/products or
/assets/images/products.
"""
from __future__ import annotations

import re


def _replace_bounded_reference(value: str, source: str, destination: str) -> str:
    """Replace a URL reference only when it is not embedded in a larger path."""
    if not source:
        return value
    pattern = re.compile(
        r"(?<![A-Za-z0-9._~%/-])"
        + re.escape(source)
        + r"(?![A-Za-z0-9._~%/-])"
    )
    return pattern.sub(lambda _match: destination, value)


def replace_exact_redirect_reference(
    value: str,
    source_path: str,
    destination_path: str,
    base_url: str,
) -> str:
    """Rewrite exact absolute or root-relative URL paths, preserving query/hash.

    The path-component boundaries prevent /products from matching
    /en/products, /products/example, or /assets/images/products.
    """
    if not source_path.startswith("/") or not destination_path.startswith("/"):
        return value

    base = base_url.rstrip("/")
    if base:
        value = _replace_bounded_reference(
            value,
            base + source_path,
            base + destination_path,
        )
    return _replace_bounded_reference(value, source_path, destination_path)
