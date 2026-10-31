"""Product title shortening and deterministic variant disambiguation."""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

# A few trailing suffixes distinguish otherwise identical commercial-vehicle
# parts. Keep these when fitting a title into the site's 70-character cap.
DISTINGUISHING_SUFFIX_RE = re.compile(
    r"(?P<suffix>\s+(?:"
    r"\d+(?:\.\d+)?\s*mm\s+THICKNESS|"
    r"\d+(?:st|nd|rd|th)\s+(?:O/S|U/S)|"
    r"STANDARD|STD|"
    r"P\d+\s+(?:LH|RH)|"
    r"HYWA\s+(?:LH|RH)|"
    r"(?:[A-Z][A-Z-]*\s+){1,2}TYPE\s+[A-Z0-9]+|"
    r"(?:MAIN|AUX)\s+LEAF\s+AUX-[A-Z0-9]+|"
    r"TYPE\s+[A-Z0-9]+|"
    r"AUX-[A-Z0-9]+|"
    r"(?:LH|RH|LHS|RHS|L/H|R/H|LEFT(?:-HAND)?|RIGHT(?:-HAND)?|N/S|O/S)"
    r")\s*[.)]?)$",
    flags=re.IGNORECASE,
)


def shorten_product_name_for_title(name: str, max_length: int) -> str:
    """Shorten a product name at word boundaries, retaining a terminal variant."""
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


def unique_vehicle_title_variants(products: list[dict[str, Any]]) -> dict[str, str]:
    """Return recorded single-vehicle qualifiers for otherwise identical SKUs.

    Only groups sharing brand, manufacturer part number and normalized product
    name qualify. Every member must have exactly one non-Universal vehicle, and
    those vehicle values must be distinct. This changes titles only; it does not
    alter fitment, product data, URLs or canonical records.
    """
    groups: dict[tuple[str, str, str], list[tuple[str, str]]] = defaultdict(list)
    for product in products:
        product_id = re.sub(r"\s+", " ", str(product.get("id") or "")).strip()
        brand = re.sub(
            r"\s+", " ", str(product.get("brand_name") or product.get("brand") or "")
        ).strip()
        part = re.sub(
            r"\s+",
            " ",
            str(
                product.get("manufacturer_part_number")
                or product.get("part_number")
                or product.get("partNumber")
                or ""
            ),
        ).strip()
        name = re.sub(
            r"\s+", " ", str(product.get("product_name") or product.get("name") or "")
        ).strip()
        raw_vehicles = product.get("vehicles") or []
        if isinstance(raw_vehicles, str):
            vehicles = [value.strip() for value in re.split(r"[,;]", raw_vehicles) if value.strip()]
        elif isinstance(raw_vehicles, (list, tuple, set)):
            vehicles = [str(value).strip() for value in raw_vehicles if str(value).strip()]
        else:
            vehicles = []
        vehicles = [value for value in vehicles if value.casefold() != "universal"]
        if not product_id or not brand or not part or not name or len(vehicles) != 1:
            continue
        key = (brand.casefold(), part.casefold(), name.casefold())
        groups[key].append((product_id, vehicles[0]))

    variants: dict[str, str] = {}
    for members in groups.values():
        vehicle_keys = [vehicle.casefold() for _, vehicle in members]
        if len(members) < 2 or len(set(vehicle_keys)) != len(members):
            continue
        variants.update(members)
    return variants


def build_product_page_title(
    brand: str,
    part_number: str,
    product_name: str,
    vehicle_qualifier: str | None = None,
    max_length: int = 70,
) -> str:
    """Build a bounded product title, adding verified vehicle fitment if useful."""
    suffix = " | Souviks"
    brand = re.sub(r"\s+", " ", str(brand or "")).strip()
    part = re.sub(r"\s+", " ", str(part_number or "")).strip()
    name = re.sub(r"\s+", " ", str(product_name or "")).strip()
    vehicle = re.sub(r"\s+", " ", str(vehicle_qualifier or "")).strip()
    has_part_identity = bool(part and part.casefold() not in name.casefold())
    lead_parts = [value for value in (brand, part if has_part_identity else "") if value]
    lead = " - ".join(lead_parts)

    if vehicle and lead:
        joiner = " - " if name else ""
        vehicle_suffix = f" for {vehicle}"
        available_name = max_length - len(suffix) - len(lead) - len(joiner) - len(vehicle_suffix)
        if available_name > 0:
            name_part = shorten_product_name_for_title(name, available_name)
            candidate = f"{lead}{joiner}{name_part}{vehicle_suffix}{suffix}"
            if name_part and len(candidate) <= max_length:
                return candidate

    if lead:
        joiner = " - " if name else ""
        available_name = max_length - len(suffix) - len(lead) - len(joiner)
        if available_name > 0:
            name_part = shorten_product_name_for_title(name, available_name)
            title_prefix = f"{lead}{joiner}{name_part}".rstrip(" -")
        else:
            title_prefix = lead[: max_length - len(suffix)].rstrip(" -")
        return title_prefix + suffix

    name_part = shorten_product_name_for_title(name, max_length - len(suffix))
    return name_part + suffix
