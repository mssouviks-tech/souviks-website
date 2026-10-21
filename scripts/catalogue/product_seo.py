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


def build_product_meta_description(
    product: dict[str, Any],
    language: str = "en",
    max_length: int = MAX_META_DESCRIPTION,
) -> str:
    """Build a factual, useful page-specific search snippet from 70 to 158 chars."""
    limit = max(MIN_META_DESCRIPTION, min(int(max_length), MAX_META_DESCRIPTION))
    suffix = META_SUFFIXES.get(str(language or "en").lower(), META_SUFFIXES["en"])
    detail = build_product_schema_description(product)
    identity = product_identity(product)
    part = product_part_number(product)

    # Put the buyer-searchable product identifier early. This also makes
    # otherwise similar listings more distinguishable when an MPN is known.
    identity_lead = identity
    if part and part.casefold() not in identity_lead.casefold():
        identity_lead = f"{identity_lead} (Part No. {part})" if identity_lead else f"Part No. {part}"

    detail_lower = detail.casefold()
    if identity and detail_lower.startswith(identity.casefold()):
        detail = identity_lead + detail[len(identity):]
    elif identity and identity.casefold() not in detail_lower:
        detail = f"{identity_lead}. {detail}".strip()
    elif part and part.casefold() not in detail_lower:
        detail = f"{identity_lead}. {detail}".strip()
    elif not identity and part and part.casefold() not in detail_lower:
        detail = f"Part No. {part}. {detail}".strip()

    sentences = _first_sentences(detail)
    if not sentences:
        detail = (
            identity_lead
            or clean_text(product.get("category_name") or product.get("category"))
            or "Commercial-vehicle spare parts from Souviks."
        )
        sentences = [detail]

    suffix_budget = limit - len(suffix) - 1
    chosen: list[str] = []
    for sentence in sentences:
        candidate = " ".join([*chosen, sentence])
        if len(candidate) <= suffix_budget:
            chosen.append(sentence)
        else:
            break

    if chosen:
        candidate = " ".join(chosen) + " " + suffix
        if MIN_META_DESCRIPTION <= len(candidate) <= limit:
            return candidate

    # A short first sentence can fit beside the CTA yet still produce a weak
    # sub-70-character snippet. Use more of the catalogue description up to
    # the snippet budget instead of dropping product context.
    lead = _truncate_word_boundary(detail, suffix_budget)
    candidate = lead.rstrip(" .") + " " + suffix
    if MIN_META_DESCRIPTION <= len(candidate) <= limit:
        return candidate

    # Conservative last resort for sparse records: include a catalogue identity
    # and a relevant product-range descriptor before the localized CTA.
    category = clean_text(
        product.get("subcategory_name")
        or product.get("subcategory")
        or product.get("category_name")
        or product.get("category")
    )
    applications = values(product.get("applications"))
    extra_parts = []
    if category and category.casefold() not in identity_lead.casefold():
        extra_parts.append(category)
    if applications:
        extra_parts.append(", ".join(applications[:2]))
    expanded = " ".join(part for part in [identity_lead, *extra_parts] if part).strip()
    if not expanded:
        expanded = "Commercial-vehicle spare parts"
    expanded = _truncate_word_boundary(expanded, suffix_budget)
    candidate = expanded.rstrip(" .") + " " + suffix
    if len(candidate) < MIN_META_DESCRIPTION:
        # Keep the call-to-action language factual and never imply stock status.
        fallback = _truncate_word_boundary(
            (identity_lead + ". " if identity_lead else "")
            + "Commercial-vehicle spare parts. ",
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
