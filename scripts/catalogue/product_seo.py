"""Product-page SEO text and structured-data helpers.

These helpers use only existing catalogue facts. They do not invent stock
status, ratings, reviews, compatibility, or manufacturer claims.
"""
from __future__ import annotations

import html
import re
from typing import Any

MAX_META_DESCRIPTION = 158
MIN_META_DESCRIPTION = 70

BOILERPLATE_PATTERNS = (
    r"supports the mechanical linkage or assembly identified by the product name",
    r"allowing its connected parts to",
    r"identified by the product name",
    r"confirm the part number and vehicle application before ordering",
)
TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")

META_SUFFIXES = {
    "en": "Check part fitment, current price and availability with Souviks.",
    "hi": "Souviks से सही पार्ट फिटमेंट, वर्तमान कीमत और उपलब्धता की पुष्टि करें।",
    "bn": "Souviks-এ সঠিক পার্ট ফিটমেন্ট, বর্তমান মূল্য ও উপলভ্যতা যাচাই করুন।",
}

AVAILABILITY_MAP = {
    "in stock": "https://schema.org/InStock",
    "in_stock": "https://schema.org/InStock",
    "instock": "https://schema.org/InStock",
    "out of stock": "https://schema.org/OutOfStock",
    "out_of_stock": "https://schema.org/OutOfStock",
    "outofstock": "https://schema.org/OutOfStock",
    "preorder": "https://schema.org/PreOrder",
    "pre_order": "https://schema.org/PreOrder",
    "pre-order": "https://schema.org/PreOrder",
    "backorder": "https://schema.org/BackOrder",
    "back_order": "https://schema.org/BackOrder",
    "back-order": "https://schema.org/BackOrder",
    "limited availability": "https://schema.org/LimitedAvailability",
    "limited_availability": "https://schema.org/LimitedAvailability",
    "limitedavailability": "https://schema.org/LimitedAvailability",
    "sold out": "https://schema.org/SoldOut",
    "sold_out": "https://schema.org/SoldOut",
    "soldout": "https://schema.org/SoldOut",
    "discontinued": "https://schema.org/Discontinued",
}


def clean_text(value: Any) -> str:
    """Decode entities, remove markup, and normalize whitespace."""
    raw = html.unescape(str(value or ""))
    raw = TAG_RE.sub(" ", raw)
    return SPACE_RE.sub(" ", raw).strip()


def values(value: Any) -> list[str]:
    """Return clean values from catalogue arrays or delimited strings."""
    if isinstance(value, (list, tuple, set)):
        candidates = value
    else:
        candidates = re.split(r"[,;]", clean_text(value))
    out: list[str] = []
    seen: set[str] = set()
    for entry in candidates:
        item = clean_text(entry)
        if item and item.casefold() not in seen:
            seen.add(item.casefold())
            out.append(item)
    return out


def product_identity(product: dict[str, Any]) -> str:
    brand = clean_text(product.get("brand_name") or product.get("brand"))
    name = clean_text(product.get("product_name") or product.get("name"))
    if brand and name and not name.casefold().startswith(brand.casefold()):
        return f"{brand} {name}"
    return name or brand


def product_part_number(product: dict[str, Any]) -> str:
    return clean_text(
        product.get("manufacturer_part_number")
        or product.get("part_number")
        or product.get("partNumber")
    )


def is_weak_product_description(description: Any) -> bool:
    """Flag missing/thin text and the known generic description templates."""
    normalized = clean_text(description)
    if len(normalized) < 80:
        return True
    lowered = normalized.casefold()
    if any(re.search(pattern, lowered, flags=re.I) for pattern in BOILERPLATE_PATTERNS):
        return True
    if re.search(r"(?:^|[.!?]\s*)compatible vehicles\.?$", lowered):
        return True
    return False


def build_factual_product_description(product: dict[str, Any]) -> str:
    """Create a catalogue-fact fallback without purchase instructions or guesses.

    This is intentionally conservative when a proper component description is
    absent: it reports the product identity and recorded catalogue references,
    rather than inventing a mechanical function or a stock claim.
    """
    identity = product_identity(product)
    part = product_part_number(product)
    category = clean_text(product.get("category_name") or product.get("category"))
    subcategory = clean_text(product.get("subcategory_name") or product.get("subcategory"))
    applications = values(product.get("applications"))
    vehicles = values(product.get("vehicles"))

    scope = subcategory or category or "commercial-vehicle spare-parts"
    lead = identity or "This catalogue item"
    if part and part.casefold() not in lead.casefold():
        lead += f" (Part No. {part})"
    description = f"{lead} is listed in Souviks' {scope} range"
    if category and subcategory and category.casefold() != subcategory.casefold():
        description += f" within {category}"
    description += "."

    facts: list[str] = []
    if part and part.casefold() not in lead.casefold():
        facts.append(f"Catalogue part number: {part}.")
    if applications:
        facts.append("Recorded applications: " + ", ".join(applications[:5]) + ".")
    if vehicles and not (len(vehicles) == 1 and vehicles[0].casefold() == "universal"):
        facts.append("Vehicle references: " + ", ".join(vehicles[:5]) + ".")
    return " ".join([description, *facts]).strip()


def build_product_schema_description(product: dict[str, Any]) -> str:
    """Return the full product description for visible copy and Product JSON-LD."""
    description = clean_text(product.get("description"))
    if is_weak_product_description(description):
        description = build_factual_product_description(product)

    vehicles = values(product.get("vehicles"))
    if vehicles and not (len(vehicles) == 1 and vehicles[0].casefold() == "universal"):
        lowered = description.casefold()
        if not all(vehicle.casefold() in lowered for vehicle in vehicles[:5]):
            description = description.rstrip(" .") + ". Compatible vehicle references: " + ", ".join(vehicles[:5]) + "."
    return SPACE_RE.sub(" ", description).strip()


def _first_sentences(text: str) -> list[str]:
    text = clean_text(text)
    if not text:
        return []
    chunks = [chunk.strip() for chunk in SENTENCE_SPLIT_RE.split(text) if chunk.strip()]
    return chunks or [text]


def _truncate_word_boundary(text: str, limit: int) -> str:
    """Truncate with an ellipsis, never cutting a word or leaving punctuation dangling."""
    if len(text) <= limit:
        return text
    if limit < 2:
        return "…"[:limit]
    fragment = text[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:-")
    if not fragment:
        fragment = text[: limit - 1].rstrip(" ,;:-")
    return fragment.rstrip(" .") + "…"


def _meta_context_candidates(
    product: dict[str, Any],
    language: str,
    existing_text: str,
) -> list[str]:
    """Build short, factual fitment/application qualifiers absent from the snippet."""
    existing = clean_text(existing_text).casefold()
    language = str(language or "en").lower()
    labels = {
        "en": {"vehicles": "For", "applications": "Application"},
        "hi": {"vehicles": "वाहन अनुप्रयोग", "applications": "अनुप्रयोग"},
        "bn": {"vehicles": "গাড়ির প্রয়োগ", "applications": "প্রয়োগ"},
    }.get(language, {"vehicles": "For", "applications": "Application"})

    contexts: list[str] = []
    vehicle_values = values(product.get("vehicles"))
    universal = any(value.casefold() == "universal" for value in vehicle_values)
    vehicles = [
        value for value in vehicle_values
        if value.casefold() != "universal" and value.casefold() not in existing
    ]
    if vehicles:
        for count in range(min(3, len(vehicles)), 0, -1):
            listed = ", ".join(vehicles[:count])
            if universal and "universal" not in existing:
                contexts.append(f"Universal fitment; also for {listed}")
            else:
                contexts.append(f"{labels['vehicles']}: {listed}")
    elif universal and "universal" not in existing:
        contexts.append("Universal fitment")

    applications = [
        value for value in values(product.get("applications"))
        if value.casefold() not in existing
    ]
    for count in range(min(2, len(applications)), 0, -1):
        contexts.append(f"{labels['applications']}: {', '.join(applications[:count])}")
    return contexts


def _append_meta_context(
    lead: str,
    contexts: list[str],
    suffix: str,
    limit: int,
) -> str | None:
    """Append a factual qualifier while preserving punctuation and the length cap."""
    base = clean_text(lead)
    for context in contexts:
        qualifier = clean_text(context).rstrip(".")
        if not base or not qualifier:
            continue
        separator = " " if base.endswith("…") else ". "
        candidate = base.rstrip(" .") + separator + qualifier + ". " + suffix
        if MIN_META_DESCRIPTION <= len(candidate) <= limit:
            return candidate
    return None


META_VARIANT_SUFFIX_RE = re.compile(
    r"\\s+(?P<suffix>(?:"
    r"(?:P\\d+|HYWA)\\s+(?:LH|RH)|"
    r"(?:[A-Z][A-Z-]*\\s+){1,2}TYPE\\s+[A-Z0-9]+|"
    r"(?:MAIN|AUX)\\s+LEAF\\s+AUX-[A-Z0-9]+|"
    r"TYPE\\s+[A-Z0-9]+|"
    r"AUX-[A-Z0-9]+|"
    r"\\d+(?:ST|ND|RD|TH)\\s+O/S|"
    r"(?:LEFT|RIGHT)(?:-HAND)?(?:\\s+SIDE)?|"
    r"(?:LH|RH|LHS|RHS|L/H|R/H|N/S|O/S)|"
    r"\\d+(?:\\.\\d+)?\\s*MM\\s+THICKNESS|"
    r"STANDARD"
    r")\\s*[.)]?$",
    flags=re.IGNORECASE,
)


def _shorten_meta_name(value: Any, max_length: int) -> str:
    """Shorten a long catalogue name without discarding a known variant suffix."""
    name = clean_text(value)
    limit = max(0, int(max_length))
    if not name or limit == 0:
        return ""
    if len(name) <= limit:
        return name
    if limit < 8:
        return _truncate_word_boundary(name, limit)

    variant = META_VARIANT_SUFFIX_RE.search(name)
    if variant:
        suffix = clean_text(variant.group("suffix")).rstrip(" .")
        stem = name[:variant.start()].rstrip(" ,;:-")
        stem_budget = limit - len(suffix) - 1
        if suffix and stem_budget >= 6:
            shortened_stem = _truncate_word_boundary(stem, stem_budget)
            candidate = f"{shortened_stem} {suffix}".strip()
            if len(candidate) <= limit:
                return candidate

    words = name.split()
    for tail_count in (3, 2, 1):
        if len(words) <= tail_count:
            continue
        tail = " ".join(words[-tail_count:])
        prefix_budget = limit - len(tail) - 1
        if prefix_budget < 6:
            continue
        prefix = _truncate_word_boundary(" ".join(words[:-tail_count]), prefix_budget)
        candidate = f"{prefix} {tail}".strip()
        if prefix and len(candidate) <= limit:
            return candidate

    return _truncate_word_boundary(name, limit)


def _build_meta_product_lead(product: dict[str, Any], max_length: int) -> str:
    """Build a compact, factual label that never truncates the available part IDs."""
    limit = max(0, int(max_length))
    if limit == 0:
        return ""

    identity = product_identity(product)
    brand = clean_text(product.get("brand_name") or product.get("brand"))
    name = clean_text(product.get("product_name") or product.get("name"))
    if brand and name.casefold().startswith(brand.casefold()):
        name = name[len(brand):].lstrip(" -–—")

    catalogue_part = clean_text(product.get("part_number") or product.get("partNumber"))
    manufacturer_part = clean_text(product.get("manufacturer_part_number"))
    identifiers: list[str] = []
    if catalogue_part and catalogue_part.casefold() not in identity.casefold():
        identifiers.append(f"Part No. {catalogue_part}")
    if (
        manufacturer_part
        and manufacturer_part.casefold() not in identity.casefold()
        and manufacturer_part.casefold() != catalogue_part.casefold()
    ):
        identifiers.append(f"MPN {manufacturer_part}")

    full_label = identity or brand or name
    if identifiers:
        full_label = f"{full_label} ({'; '.join(identifiers)})".strip()
    if full_label and len(full_label) <= limit:
        return full_label

    # When the long display name cannot fit, move identifiers in front of the
    # shortened name. This prevents snippets like "(Part No. Check part fitment..."
    # and ensures the buyer-searchable part number survives the length cap.
    primary_part = catalogue_part or manufacturer_part
    prefix_parts = [brand] if brand else []
    if primary_part and primary_part.casefold() not in " ".join(prefix_parts).casefold():
        prefix_parts.append(primary_part)
    if manufacturer_part and catalogue_part and manufacturer_part.casefold() != catalogue_part.casefold():
        prefix_parts.append(f"MPN {manufacturer_part}")
    prefix = " ".join(part for part in prefix_parts if part).strip()

    for identifier in (catalogue_part, manufacturer_part):
        if identifier and identifier.casefold() in name.casefold():
            name = re.sub(re.escape(identifier), "", name, count=1, flags=re.IGNORECASE).strip(" -–—,;:")
    if brand and name.casefold().startswith(brand.casefold()):
        name = name[len(brand):].lstrip(" -–—")

    if prefix and name:
        name_budget = limit - len(prefix) - 3
        if name_budget >= 1:
            shortened_name = _shorten_meta_name(name, name_budget)
            candidate = f"{prefix} - {shortened_name}".strip(" -")
            if candidate and len(candidate) <= limit:
                return candidate
    if prefix:
        return _shorten_meta_name(prefix, limit)

    fallback = (
        identity
        or clean_text(product.get("subcategory_name") or product.get("subcategory"))
        or clean_text(product.get("category_name") or product.get("category"))
        or "Commercial-vehicle spare parts"
    )
    return _shorten_meta_name(fallback, limit)


def build_product_meta_description(
    product: dict[str, Any],
    language: str = "en",
    max_length: int = MAX_META_DESCRIPTION,
) -> str:
    """Build a factual, page-specific snippet within the 70–158 character contract."""
    limit = max(MIN_META_DESCRIPTION, min(int(max_length), MAX_META_DESCRIPTION))
    suffix = META_SUFFIXES.get(str(language or "en").lower(), META_SUFFIXES["en"])
    suffix_budget = limit - len(suffix) - 1

    # Reserve space for recorded fitment/application context only after making
    # sure the primary identifier and product name can be represented intact.
    lead = _build_meta_product_lead(product, suffix_budget)
    contexts = _meta_context_candidates(product, language, lead)
    contextual = _append_meta_context(lead, contexts, suffix, limit)
    if contextual and MIN_META_DESCRIPTION <= len(contextual) <= limit:
        return contextual

    candidate = lead.rstrip(" .") + " " + suffix
    if MIN_META_DESCRIPTION <= len(candidate) <= limit:
        return candidate

    # Sparse records still need a useful, factual snippet. Prefer the catalogue
    # identity plus its subcategory over generic boilerplate or stock claims.
    category = clean_text(
        product.get("subcategory_name")
        or product.get("subcategory")
        or product.get("category_name")
        or product.get("category")
    )
    brand = clean_text(product.get("brand_name") or product.get("brand"))
    part = clean_text(product.get("part_number") or product.get("partNumber") or product.get("manufacturer_part_number"))
    fallback_parts = [part for part in [brand, part, category] if part]
    fallback = _shorten_meta_name(" - ".join(fallback_parts) or "Commercial-vehicle spare parts", suffix_budget)
    candidate = fallback.rstrip(" .") + " " + suffix
    if len(candidate) < MIN_META_DESCRIPTION:
        fallback = _shorten_meta_name(
            (brand + " " if brand else "") + (part + " " if part else "")
            + (category or "Commercial-vehicle parts"),
            max(1, suffix_budget),
        ).rstrip(" .")
        candidate = fallback + " " + suffix
    return _truncate_word_boundary(candidate, limit)

def schema_availability_url(product: dict[str, Any]) -> str | None:
    """Map only an explicit, recognized stock state to Schema.org availability."""
    for field in ("availability", "availability_status", "stock_status"):
        raw = clean_text(product.get(field))
        if not raw:
            continue
        if raw in AVAILABILITY_MAP:
            return AVAILABILITY_MAP[raw]
        if raw.casefold() in {key.casefold() for key in AVAILABILITY_MAP}:
            return AVAILABILITY_MAP[next(key for key in AVAILABILITY_MAP if key.casefold() == raw.casefold())]
        normalized = raw.rstrip("/").casefold()
        prefix = "https://schema.org/"
        if normalized.startswith(prefix.casefold()):
            value = raw.rstrip("/").rsplit("/", 1)[-1]
            mapped = AVAILABILITY_MAP.get(value.casefold())
            if mapped:
                return mapped
    return None
