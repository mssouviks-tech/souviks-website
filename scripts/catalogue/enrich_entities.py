#!/usr/bin/env python3
"""Enrich static brand, vehicle and category pages from the catalogue master."""

# Entity records are projections of the active catalogue, not hand-maintained counts.
# Regenerate entity pages whenever catalogue mappings change.
# The post-build pass restores entity content after static generation.
# Keep generated output deterministic and bytecode-free.
# Validation treats vehicle model as the canonical display name.

from __future__ import annotations

import html
import json
import re
from collections import Counter
from pathlib import Path

from product_card import product_card_html

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")

OFFICIAL_BRANDS = {
    "bosch": {"website": "https://www.bosch.in/", "country": "Germany"},
    "skf": {"website": "https://www.skf.com/", "country": "Sweden"},
    "timken": {"website": "https://www.timken.com/", "country": "United States"},
    "unominda": {"website": "https://www.unominda.com/", "country": "India"},
    "tata-genuine-parts": {"website": "https://www.customercare-cv.tatamotors.com/tata-genuine-parts/tgp-overview.aspx", "country": "India"},
    "mahle": {"website": "https://www.mahle.com/", "country": "Germany"},
    "lucas-tvs": {"website": "https://lucas-tvs.com/", "country": "India"},
    "texspin": {"website": "https://www.texspin.com/", "country": "India"},
    "setco": {"website": "https://setcoauto.com/", "country": "India"},
}

# Explicit logo overrides for catalogue brands whose asset is intentionally queued separately.
BRAND_LOGO_OVERRIDES = {
    "rxi": "/assets/images/brands/rxi.png",
}

LABELS = {
    "en": {
        "products": "Products", "categories": "Categories", "vehicles": "Vehicle applications",
        "brands": "Brands", "common": "Common replacement areas", "manufacturer": "Manufacturer",
        "country": "Country", "website": "Manufacturer website", "guidance": "Part identification guidance",
        "guidance_text": "Use the part number, vehicle model and application details when requesting a part. If the number is unclear, send a photo and the vehicle details and Souviks can help identify the closest catalogue match.",
        "vehicle_fitment_note": "For vehicle families or listings without a verified variant, year or powertrain in the catalogue, confirm the exact model, year and engine/fuel before ordering.",
        "faq": "Frequently asked questions",
        "intro_brand": "Souviks currently lists {count} active {name} products across {categories}. The catalogue links these products to the vehicle applications and replacement areas shown below.",
        "intro_vehicle": "Souviks currently lists {count} active spare parts for {name}. The catalogue coverage below shows the systems, brands and common replacement areas represented for this vehicle application.",
        "intro_category": "The {name} category currently contains {count} active commercial-vehicle spare parts. Use the category coverage below to narrow the catalogue by vehicle, brand and common replacement area.",
        "faq_brand_1": "Which {name} parts are available?", "faq_brand_2": "Which vehicles are covered by {name} products?",
        "faq_vehicle_1": "Which parts are commonly available for {name}?", "faq_vehicle_2": "Which brands are listed for {name}?",
        "faq_category_1": "What parts are included in {name}?", "faq_category_2": "Which vehicles and brands are represented in {name}?",
    },
    "hi": {
        "products": "उत्पाद", "categories": "श्रेणियाँ", "vehicles": "वाहन अनुप्रयोग", "brands": "ब्रांड",
        "common": "सामान्य रिप्लेसमेंट क्षेत्र", "manufacturer": "निर्माता", "country": "देश", "website": "निर्माता वेबसाइट",
        "guidance": "पार्ट पहचान सहायता",
        "guidance_text": "पार्ट नंबर, वाहन मॉडल और एप्लिकेशन की जानकारी दें। नंबर स्पष्ट न हो तो फोटो और वाहन विवरण भेजें; Souviks उपलब्ध कैटलॉग में सही मिलान खोजने में सहायता कर सकता है।",
        "vehicle_fitment_note": "जिन वाहन परिवारों या लिस्टिंग में सत्यापित वैरिएंट, वर्ष या पावरट्रेन उपलब्ध नहीं है, उनके लिए ऑर्डर से पहले सटीक मॉडल, वर्ष और इंजन/ईंधन की पुष्टि करें।",
        "faq": "अक्सर पूछे जाने वाले प्रश्न",
        "intro_brand": "Souviks के कैटलॉग में अभी {name} के {count} सक्रिय उत्पाद हैं, जो {categories} श्रेणियों में आते हैं। नीचे दिए गए अनुप्रयोग और रिप्लेसमेंट क्षेत्र वास्तविक कैटलॉग मैपिंग पर आधारित हैं।",
        "intro_vehicle": "Souviks के कैटलॉग में {name} के लिए अभी {count} सक्रिय स्पेयर पार्ट्स सूचीबद्ध हैं। नीचे इस वाहन के लिए उपलब्ध सिस्टम, ब्रांड और सामान्य रिप्लेसमेंट क्षेत्रों की जानकारी दी गई है।",
        "intro_category": "{name} श्रेणी में अभी {count} सक्रिय कमर्शियल-व्हीकल स्पेयर पार्ट्स हैं। नीचे वाहन, ब्रांड और सामान्य रिप्लेसमेंट क्षेत्र के अनुसार कैटलॉग कवरेज दिया गया है।",
        "faq_brand_1": "{name} के कौन से पार्ट्स उपलब्ध हैं?", "faq_brand_2": "{name} के पार्ट्स किन वाहनों के लिए सूचीबद्ध हैं?",
        "faq_vehicle_1": "{name} के लिए कौन से पार्ट्स सामान्य रूप से उपलब्ध हैं?", "faq_vehicle_2": "{name} के लिए कौन से ब्रांड सूचीबद्ध हैं?",
        "faq_category_1": "{name} में कौन से पार्ट्स शामिल हैं?", "faq_category_2": "{name} में कौन से वाहन और ब्रांड शामिल हैं?",
    },
    "bn": {
        "products": "পণ্য", "categories": "বিভাগ", "vehicles": "গাড়ির প্রয়োগ", "brands": "ব্র্যান্ড",
        "common": "সাধারণ রিপ্লেসমেন্ট এলাকা", "manufacturer": "প্রস্তুতকারক", "country": "দেশ", "website": "প্রস্তুতকারকের ওয়েবসাইট",
        "guidance": "পার্ট শনাক্তকরণ সহায়তা",
        "guidance_text": "পার্ট নম্বর, গাড়ির মডেল এবং অ্যাপ্লিকেশনের তথ্য দিন। নম্বর পরিষ্কার না হলে ছবি ও গাড়ির তথ্য পাঠান; Souviks ক্যাটালগে উপযুক্ত মিল খুঁজতে সাহায্য করতে পারে।",
        "vehicle_fitment_note": "যেসব গাড়ির পরিবার বা লিস্টিংয়ে যাচাই করা ভ্যারিয়েন্ট, বছর বা পাওয়ারট্রেন দেওয়া নেই, অর্ডারের আগে সঠিক মডেল, বছর এবং ইঞ্জিন/জ্বালানি নিশ্চিত করুন।",
        "faq": "সাধারণ জিজ্ঞাসা",
        "intro_brand": "Souviks-এর ক্যাটালগে বর্তমানে {name}-এর {count}টি সক্রিয় পণ্য রয়েছে, যা {categories} বিভাগে বিস্তৃত। নিচের গাড়ি ও রিপ্লেসমেন্ট তথ্য বাস্তব ক্যাটালগ ম্যাপিং থেকে নেওয়া।",
        "intro_vehicle": "Souviks-এর ক্যাটালগে {name}-এর জন্য বর্তমানে {count}টি সক্রিয় স্পেয়ার পার্ট রয়েছে। নিচে এই গাড়ির জন্য তালিকাভুক্ত সিস্টেম, ব্র্যান্ড ও সাধারণ রিপ্লেসমেন্ট এলাকার তথ্য দেওয়া হয়েছে।",
        "intro_category": "{name} বিভাগে বর্তমানে {count}টি সক্রিয় কমার্শিয়াল-ভেহিকল স্পেয়ার পার্ট রয়েছে। নিচে গাড়ি, ব্র্যান্ড ও সাধারণ রিপ্লেসমেন্ট এলাকার ভিত্তিতে ক্যাটালগ কভারেজ দেওয়া হয়েছে।",
        "faq_brand_1": "{name}-এর কোন পার্টগুলি পাওয়া যায়?", "faq_brand_2": "{name}-এর পার্টগুলি কোন গাড়ির জন্য তালিকাভুক্ত?",
        "faq_vehicle_1": "{name}-এর জন্য কোন পার্টগুলি সাধারণত পাওয়া যায়?", "faq_vehicle_2": "{name}-এর জন্য কোন ব্র্যান্ডগুলি তালিকাভুক্ত?",
        "faq_category_1": "{name} বিভাগে কোন পার্টগুলি রয়েছে?", "faq_category_2": "{name} বিভাগে কোন গাড়ি ও ব্র্যান্ড রয়েছে?",
    },
}

def clean(v):
    return str(v or "").strip()

def esc(v):
    return html.escape(clean(v), quote=True)

def arr_products(products, field):
    values = []
    for p in products:
        vals = p.get(field) or []
        if not isinstance(vals, list):
            vals = [vals]
        values.extend(clean(v) for v in vals if clean(v))
    return values

def top(values, limit=8):
    return [x for x, _ in Counter(values).most_common(limit)]

def list_text(items, limit=7):
    vals = items[:limit]
    if not vals:
        return "—"
    return ", ".join(vals) + (" and more" if len(items) > limit else "")

def card(label, value):
    return f'<div class="entity-context-card"><span>{esc(label)}</span><strong>{esc(value)}</strong></div>'


def entity_product_galleries(kind, item, products, lang):
    product_groups = {}
    for product in products:
        if kind == "brand":
            group_id = clean(product.get("category_id"))
            group_name = clean(product.get("category_name") or product.get("category"))
        elif kind == "category":
            group_id = clean(product.get("subcategory_id"))
            group_name = clean(product.get("subcategory_name") or product.get("subcategory"))
        else:
            group_id = clean(product.get("category_id"))
            group_name = clean(product.get("category_name") or product.get("category"))
        if not group_id:
            continue
        product_groups.setdefault((group_id, group_name), []).append(product)
    labels = {"en": "View All", "hi": "सभी देखें", "bn": "সব দেখুন"}
    sections = []
    item_id = clean(item.get("id"))
    for (group_id, group_name), group_products in sorted(product_groups.items(), key=lambda x: x[0][1].casefold()):
        if not group_products:
            continue
        if kind == "brand":
            query = f"brand_id={item_id}&category_id={group_id}"
            prefix = "brand"
        elif kind == "category":
            query = f"category_id={item_id}&subcategory_id={group_id}"
            prefix = "category"
        else:
            query = f"vehicles={item_id}&category_id={group_id}"
            prefix = "vehicle"
        cards = "".join(product_card_html(product, lang) for product in group_products)
        section_id = f"{prefix}-{item_id}-{group_id}"
        sections.append(
            f'<section class="entity-product-gallery" id="{esc(section_id)}" aria-labelledby="{esc(section_id)}-title">'
            f'<div class="entity-product-gallery__header"><div><h2 id="{esc(section_id)}-title">{esc(group_name)}</h2>'
            f'<span class="entity-product-gallery__count">{len(group_products)} Products</span></div>'
            f'<a class="entity-product-gallery__view-all" href="/{lang}/products?{query}">{labels[lang]}<span aria-hidden="true"> →</span></a></div>'
            f'<div class="entity-product-gallery__viewport" tabindex="0" aria-label="{esc(group_name)} products"><div class="entity-product-gallery__track">{cards}</div></div></section>'
        )
    return "\n".join(sections)

def context_section(kind, item, products, lang):
    L = LABELS[lang]
    name = clean(item.get("name") or item.get("model"))
    cats = top(arr_products(products, "category_name"), 8)
    subs = top(arr_products(products, "subcategory_name"), 8)
    brands = top(arr_products(products, "brand_name"), 8)
    vehicles = top(arr_products(products, "vehicles"), 8)
    if kind == "brand":
        intro = L["intro_brand"].format(name=name, count=len(products), categories=list_text(cats, 5))
        rows = [card(L["products"], str(len(products))), card(L["categories"], list_text(cats, 5)),
                card(L["vehicles"], list_text(vehicles, 5)), card(L["common"], list_text(subs, 5))]
        if clean(item.get("website")):
            rows.append(f'<div class="entity-context-card"><span>{esc(L["website"])}</span><strong><a href="{esc(item["website"])}" target="_blank" rel="noopener noreferrer">{esc(item["website"])}</a></strong></div>')
        if clean(item.get("country")):
            rows.append(card(L["country"], item["country"]))
        faq = [(L["faq_brand_1"].format(name=name), f"{name} currently has {len(products)} active products in the Souviks catalogue, grouped by the categories shown on this page."),
               (L["faq_brand_2"].format(name=name), f"The current catalogue maps {name} products to {list_text(vehicles, 8)}.")]
    elif kind == "vehicle":
        intro = L["intro_vehicle"].format(name=name, count=len(products))
        manufacturer = clean((item.get("manufacturer") or {}).get("name")) or clean(name.split()[0])
        rows = [card(L["products"], str(len(products))), card(L["manufacturer"], manufacturer),
                card(L["categories"], list_text(cats, 5)), card(L["brands"], list_text(brands, 5)),
                card(L["common"], list_text(subs, 5))]
        faq = [(L["faq_vehicle_1"].format(name=name), f"Common catalogue areas for {name} include {list_text(subs, 8)}."),
               (L["faq_vehicle_2"].format(name=name), f"The current catalogue lists {list_text(brands, 8)} for this vehicle application.")]
    else:
        intro = L["intro_category"].format(name=name, count=len(products))
        rows = [card(L["products"], str(len(products))), card(L["brands"], list_text(brands, 5)),
                card(L["vehicles"], list_text(vehicles, 5)), card(L["common"], list_text(subs, 6))]
        faq = [(L["faq_category_1"].format(name=name), f"The current {name} catalogue includes {list_text(subs, 8)}."),
               (L["faq_category_2"].format(name=name), f"Current catalogue coverage includes {list_text(vehicles, 8)} and brands such as {list_text(brands, 8)}.")]
    faq_html = "".join(f'<details class="entity-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faq)
    return f'''
<section class="entity-context section-spacing">
  <div class="container">
    <div class="section-heading">
      <span class="section-tag">{esc(L["categories"] if kind == "brand" else L["common"])}</span>
      <h2>{esc(name)} catalogue context</h2>
      <p>{esc(intro)}</p>
    </div>
    <div class="entity-context-grid">{"".join(rows)}</div>
    <div class="entity-guidance"><h3>{esc(L["guidance"])}</h3><p>{esc(L["guidance_text"])}</p>{"<p>" + esc(L["vehicle_fitment_note"]) + "</p>" if kind == "vehicle" else ""}</div>
    <div class="entity-faq"><h3>{esc(L["faq"])}</h3>{faq_html}</div>
  </div>
</section>
'''

def update_meta(page, description):
    raw = clean(description)
    d = esc(raw[:155].rsplit(" ", 1)[0].rstrip(" ,;:-") + "." if len(raw) > 158 else raw)
    for pattern in (
        r'(<meta\s+name=["\']description["\']\s+content=["\'])[^"\']*(["\'])',
        r'(<meta\s+property=["\']og:description["\']\s+content=["\'])[^"\']*(["\'])',
        r'(<meta\s+name=["\']twitter:description["\']\s+content=["\'])[^"\']*(["\'])',
    ):
        page = re.sub(pattern, lambda m: m.group(1) + d + m.group(2), page, count=1, flags=re.I)
    return page

def ensure_main_landmark(page):
    """Ensure generated entity pages expose their central content as <main>."""
    if re.search(r"<main\b", page, flags=re.I):
        return page

    header_end = re.search(r"</header\s*>", page, flags=re.I)
    if not header_end:
        raise ValueError("Cannot add main landmark: entity page has no closing header")

    footer = re.search(r"<footer\b", page[header_end.end():], flags=re.I)
    if not footer:
        raise ValueError("Cannot add main landmark: entity page has no footer")

    content_start = header_end.end()
    content_end = content_start + footer.start()
    return (
        page[:content_start]
        + "\n<main id=\"main-content\">\n"
        + page[content_start:content_end]
        + "\n</main>\n\n"
        + page[content_end:]
    )


def replace_static_product_grid(page: str, gallery_html: str) -> str:
    """Replace the full contents of an entity page static product grid."""
    opening = re.search(
        r'<div\\b(?=[^>]*\\bid="product-grid")(?=[^>]*\\bdata-static-rendered="true")[^>]*>',
        page,
        flags=re.I,
    )
    if not opening:
        return page

    depth = 1
    tag_pattern = re.compile(r'</?div\\b[^>]*>', flags=re.I)
    for tag in tag_pattern.finditer(page, opening.end()):
        token = tag.group(0)
        if re.match(r'</div\\b', token, flags=re.I):
            depth -= 1
            if depth == 0:
                inner = "\\n\\n" + gallery_html + "\\n\\n"
                return page[:opening.end()] + inner + page[tag.start():]
        elif not re.search(r'/\\s*>$', token):
            depth += 1

    raise ValueError("Entity page has an unclosed #product-grid container.")


def enrich_entity_pages(kind, data, catalogue):
    for item in data:
        if item.get("active") is False:
            continue
        item_id = clean(item.get("id"))
        if not item_id:
            continue
        if kind == "brand":
            products = [p for p in catalogue if p.get("active") is not False and clean(p.get("brand_id")) == item_id]
            item["product_count"] = len(products)
            item["categories"] = sorted(set(clean(p.get("category_id")) for p in products if clean(p.get("category_id"))))
            item["subcategories"] = sorted(set(clean(p.get("subcategory_id")) for p in products if clean(p.get("subcategory_id"))))
            item["vehicles"] = sorted(set(arr_products(products, "vehicles")))
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            meta = OFFICIAL_BRANDS.get(item_id)
            if meta:
                item["website"], item["country"] = meta["website"], meta["country"]
            logo_override = BRAND_LOGO_OVERRIDES.get(item_id)
            if logo_override:
                item["logo"] = logo_override
            cats = sorted(set(clean(p.get("category_name") or p.get("category")) for p in products if clean(p.get("category_name") or p.get("category"))))
            item.setdefault("seo", {})
            subs = top(arr_products(products, "subcategory_name"), 6)
            vehicles = top(arr_products(products, "vehicles"), 6)
            manufacturer_note = ""
            if meta and clean(meta.get("country")):
                manufacturer_note = f' Manufacturer country: {clean(meta.get("country"))}.'
            example_products = []
            seen_example_ids = set()
            for product in products:
                pid = clean(product.get("id"))
                pname = clean(product.get("product_name") or product.get("name"))
                if pid and pname and pid not in seen_example_ids:
                    example_products.append(pname)
                    seen_example_ids.add(pid)
                if len(example_products) >= 3:
                    break

            item["description"] = (
                f'Souviks currently lists {len(products)} active {clean(item.get("name"))} products across '
                f'{list_text(cats, 5) or "the commercial-vehicle parts catalogue"}. '
                f'The listed range is mapped to applications such as '
                f'{list_text(vehicles, 5) or "commercial vehicle applications"} and common replacement areas including '
                f'{list_text(subs, 5) or "related commercial-vehicle parts"}. '
                f'{manufacturer_note} Current catalogue examples include '
                f'{list_text(example_products, 3) or "multiple commercial-vehicle replacement parts"}. '
                f'Use the part number, application and vehicle details when checking fitment.'
            )
            item["short_description"] = (
                f'{clean(item.get("name"))} products at Souviks cover '
                f'{list_text(cats, 4) or "commercial-vehicle parts"} and applications across '
                f'{list_text(vehicles, 3) or "commercial vehicles"}.'
            )
            item["seo"]["description"] = item["description"]
        elif kind == "vehicle":
            name = clean(item.get("model") or item.get("name"))
            products = [p for p in catalogue if p.get("active") is not False and name in [clean(v) for v in (p.get("vehicles") or [])]]
            prefix = name.split()[0] if name else ""
            manufacturer_map = {"Tata": "Tata Motors", "Ashok": "Ashok Leyland", "Eicher": "Eicher", "Mahindra": "Mahindra", "Universal": "Multi-brand / Universal", "Tractors": "Multiple manufacturers"}
            item.setdefault("manufacturer", {})
            item["manufacturer"]["name"] = manufacturer_map.get(prefix, prefix)
            item["product_count"] = len(products)
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            cat_pairs, brand_pairs = {}, {}
            for p in products:
                if clean(p.get("category_id")):
                    cat_pairs[clean(p.get("category_id"))] = clean(p.get("category_name") or p.get("category"))
                if clean(p.get("brand_id")):
                    brand_pairs[clean(p.get("brand_id"))] = clean(p.get("brand_name") or p.get("brand"))
            item["categories"] = [{"id": k, "name": v} for k, v in sorted(cat_pairs.items())]
            item["brands"] = [{"id": k, "name": v} for k, v in sorted(brand_pairs.items())]
            subs = top(arr_products(products, "subcategory_name"), 8)
            cats = top(arr_products(products, "category_name"), 8)
            item.setdefault("seo", {})
            item["description"] = f'Souviks lists {len(products)} active spare parts for {name}, a {manufacturer_map.get(prefix, prefix) or "commercial-vehicle"} application. Current catalogue coverage includes {list_text(cats, 5)} and common replacement areas such as {list_text(subs, 5)}; listed brands include {list_text(top(arr_products(products, "brand_name"), 5), 5)}.'
            item["short_description"] = f'{name}: {len(products)} active parts mapped across {list_text(cats, 4) or "commercial-vehicle systems"}.'
            item["seo"]["description"] = item["description"]
        else:
            products = [p for p in catalogue if p.get("active") is not False and clean(p.get("category_id")) == item_id]
            item["product_count"] = len(products)
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            sub_pairs, brand_pairs, vehicle_names = {}, {}, set()
            for p in products:
                if clean(p.get("subcategory_id")):
                    sub_pairs[clean(p.get("subcategory_id"))] = clean(p.get("subcategory_name") or p.get("subcategory"))
                if clean(p.get("brand_id")):
                    brand_pairs[clean(p.get("brand_id"))] = clean(p.get("brand_name") or p.get("brand"))
                vehicle_names.update(arr_products([p], "vehicles"))
            item["subcategories"] = [{"id": k, "name": v} for k, v in sorted(sub_pairs.items())]
            item["brands"] = [{"id": k, "name": v} for k, v in sorted(brand_pairs.items())]
            item["vehicles"] = sorted(vehicle_names)
            brands = [v for v in brand_pairs.values() if v]
            item.setdefault("seo", {})
            item["description"] = f'{clean(item.get("name"))} covers {len(products)} active commercial-vehicle spare parts used across {list_text(sorted(vehicle_names), 5) or "truck, bus and commercial-vehicle applications"}. The category includes subcategories such as {list_text(sorted(set(sub_pairs.values())), 5) or "related replacement parts"} and brands including {list_text(sorted(set(brands)), 5) or "multiple suppliers"}.'
            item["short_description"] = f'{clean(item.get("name"))}: {len(products)} active parts across {list_text(sorted(set(sub_pairs.values())), 4) or "related replacement parts"}.'
            item["seo"]["description"] = item["description"]

        for lang in LANGUAGES:
            path = ROOT / lang / (kind + "s") / f'{clean(item.get("slug"))}.html'
            if not path.exists():
                continue
            page = update_meta(path.read_text(encoding="utf-8"), clean(item.get("description")))
            gallery_html = entity_product_galleries(kind, item, products, lang)
            page = replace_static_product_grid(page, gallery_html)
            if kind == "vehicle" and len(products) <= 5:
                robots_pattern = r'(<meta\s+name=["\']robots["\']\s+content=["\'])[^"\']*(["\'])'
                page = re.sub(
                    robots_pattern,
                    lambda m: m.group(1) + "noindex,follow,max-image-preview:large" + m.group(2),
                    page,
                    count=1,
                    flags=re.I,
                )
            if kind == "brand":
                logo = clean(item.get("logo"))
                if logo:
                    page = re.sub(
                        r'(<div class="brand-logo">.*?<img\s+src=")[^"]+"',
                        lambda m: m.group(1) + logo + '"',
                        page,
                        count=1,
                        flags=re.I,
                    )
                selector = r'(<div class="brand-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            elif kind == "vehicle":
                selector = r'(<div class="vehicle-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            else:
                selector = r'(<div class="category-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            page = re.sub(selector, lambda m: m.group(1) + esc(item.get("description")) + m.group(2), page, count=1, flags=re.I)
            marker = f'<!-- ENTITY_CONTEXT_{kind.upper()} -->'
            if marker not in page:
                section = context_section(kind, item, products, lang)
                anchor_pattern = rf'<!--\s*=+\s*{kind.upper()} PRODUCTS\s*=+\s*-->' if kind != "vehicle" else r'<!--\s*=+\s*COMPATIBLE PRODUCTS\s*=+\s*-->'
                anchor_match = re.search(anchor_pattern, page, flags=re.I)
                if anchor_match:
                    page = page[:anchor_match.start()] + marker + "\n" + section + "\n" + page[anchor_match.start():]
                else:
                    page = page.replace("</body>", marker + "\n" + section + "\n</body>", 1)
            page = ensure_main_landmark(page)
            path.write_text(page, encoding="utf-8")

def enrich_about():
    T = {
        "en": {
            "cards": [("Store tour", "A short look at the Souviks premises and stocked inventory.", "inventory-part1.mp4"), ("Inside the store", "Shelving and stock arranged for day-to-day parts trade.", "store-interior.jpg"), ("Parts counter", "The working counter used for customer enquiries and part identification.", "store-counter.jpg")],
            "b2b_title": "Built for B2B parts buyers",
            "b2b": ["Commercial-vehicle focus for workshops, retailers, fleet operators and distributors.", "Part-number, vehicle and application based assistance before you buy.", "Pan-India shipping for stocked parts, with dispatch and availability confirmed against the order.", "Catalogue coverage across filters, bearings, clutch parts, brakes, lubricants, electricals, engine parts and related systems."],
            "position_title": "Genuine OEM and aftermarket — clearly distinguished",
            "position": "Souviks lists genuine/OE-specified products where the catalogue identifies them as genuine, and separately lists branded aftermarket products. An aftermarket product is not presented as an OEM part merely because it fits the same application.",
            "service_title": "Buying and distribution support",
            "service": "We help customers identify parts using part numbers, vehicle models, applications and product photographs. Orders can be supplied across India; availability, pricing and compatibility should be confirmed for the specific requirement before dispatch.",
            "faq_title": "Frequently asked questions",
            "faq": [("Can Souviks help identify a part?", "Yes. Send the part number, vehicle details or a clear photograph and the team can help match the requirement against the catalogue."), ("Do you supply genuine and aftermarket parts?", "Yes. The catalogue contains both genuine/OE-specified and branded aftermarket products. They are not represented as the same thing."), ("Where do you ship?", "Souviks serves customers across India. Delivery timing and freight treatment depend on the order and destination.")],
        },
        "hi": {
            "cards": [("स्टोर टूर", "Souviks परिसर और स्टॉक का एक छोटा वीडियो।", "inventory-part1.mp4"), ("स्टोर के अंदर", "दैनिक पार्ट्स ट्रेड के लिए व्यवस्थित स्टॉक और शेल्फ।", "store-interior.jpg"), ("पार्ट्स काउंटर", "ग्राहक पूछताछ और पार्ट पहचान के लिए उपयोग होने वाला काउंटर।", "store-counter.jpg")],
            "b2b_title": "B2B पार्ट्स खरीदारों के लिए बनाया गया",
            "b2b": ["वर्कशॉप, रिटेलर, फ्लीट ऑपरेटर और डिस्ट्रीब्यूटर के लिए कमर्शियल-व्हीकल फोकस।", "खरीद से पहले पार्ट नंबर, वाहन और एप्लिकेशन आधारित सहायता।", "स्टॉक किए गए पार्ट्स के लिए पूरे भारत में शिपिंग।", "फिल्टर, बेयरिंग, क्लच, ब्रेक, लुब्रिकेंट, इलेक्ट्रिकल और इंजन पार्ट्स सहित व्यापक कैटलॉग।"],
            "position_title": "Genuine OEM और aftermarket को स्पष्ट रूप से अलग रखा गया है",
            "position": "जहाँ कैटलॉग किसी उत्पाद को genuine/OE-specified बताता है, वहीं उसे उसी रूप में सूचीबद्ध किया जाता है। ब्रांडेड aftermarket उत्पाद अलग रूप से सूचीबद्ध हैं और उन्हें केवल फिटमेंट के आधार पर OEM नहीं बताया जाता।",
            "service_title": "खरीद और वितरण सहायता",
            "service": "पार्ट नंबर, वाहन मॉडल, एप्लिकेशन और उत्पाद की फोटो के आधार पर पार्ट पहचान में सहायता दी जाती है। पूरे भारत में ऑर्डर सप्लाई किए जा सकते हैं; उपलब्धता, कीमत और compatibility को dispatch से पहले पुष्टि करना चाहिए।",
            "faq_title": "अक्सर पूछे जाने वाले प्रश्न",
            "faq": [("क्या Souviks पार्ट पहचानने में मदद कर सकता है?", "हाँ। पार्ट नंबर, वाहन विवरण या स्पष्ट फोटो भेजें; कैटलॉग में मिलान खोजने में सहायता की जा सकती है।"), ("क्या genuine और aftermarket दोनों पार्ट मिलते हैं?", "हाँ। दोनों प्रकार के उत्पाद अलग-अलग सूचीबद्ध हैं और उन्हें एक ही श्रेणी के रूप में प्रस्तुत नहीं किया जाता।"), ("कहाँ shipping होती है?", "Souviks पूरे भारत में ग्राहकों को सेवा देता है। डिलीवरी समय और freight ऑर्डर व destination पर निर्भर करते हैं।")],
        },
        "bn": {
            "cards": [("স্টোর ট্যুর", "Souviks স্টোর ও স্টকের একটি ছোট ভিডিও।", "inventory-part1.mp4"), ("স্টোরের ভেতরে", "দৈনন্দিন পার্টস ব্যবসার জন্য সাজানো স্টক ও তাক।", "store-interior.jpg"), ("পার্টস কাউন্টার", "গ্রাহকের জিজ্ঞাসা ও পার্ট শনাক্তকরণের জন্য ব্যবহৃত কাউন্টার।", "store-counter.jpg")],
            "b2b_title": "B2B পার্টস ক্রেতাদের জন্য তৈরি",
            "b2b": ["ওয়ার্কশপ, রিটেলার, ফ্লিট অপারেটর ও ডিস্ট্রিবিউটরদের জন্য কমার্শিয়াল-ভেহিকল ফোকাস।", "কেনার আগে পার্ট নম্বর, গাড়ি ও অ্যাপ্লিকেশন অনুযায়ী সহায়তা।", "স্টক থাকা পণ্যের জন্য সারা ভারতে শিপিং।", "ফিল্টার, বিয়ারিং, ক্লাচ, ব্রেক, লুব্রিক্যান্ট, ইলেকট্রিক্যাল ও ইঞ্জিন পার্টসসহ বিস্তৃত ক্যাটালগ।"],
            "position_title": "Genuine OEM ও aftermarket পরিষ্কারভাবে আলাদা",
            "position": "ক্যাটালগে যে পণ্য genuine/OE-specified হিসেবে চিহ্নিত, সেটিকে সেইভাবেই দেখানো হয়। ব্র্যান্ডেড aftermarket পণ্য আলাদা করে তালিকাভুক্ত এবং শুধু একই অ্যাপ্লিকেশনে ব্যবহারযোগ্য বলেই OEM হিসেবে দেখানো হয় না।",
            "service_title": "কেনাকাটা ও ডিস্ট্রিবিউশন সহায়তা",
            "service": "পার্ট নম্বর, গাড়ির মডেল, অ্যাপ্লিকেশন ও পণ্যের ছবি ব্যবহার করে পার্ট শনাক্ত করতে সাহায্য করা হয়। সারা ভারতে অর্ডার সরবরাহ করা যায়; dispatch-এর আগে availability, price ও compatibility নিশ্চিত করা উচিত।",
            "faq_title": "সাধারণ জিজ্ঞাসা",
            "faq": [("Souviks কি পার্ট শনাক্ত করতে সাহায্য করতে পারে?", "হ্যাঁ। পার্ট নম্বর, গাড়ির তথ্য বা পরিষ্কার ছবি পাঠালে ক্যাটালগে মিল খুঁজতে সাহায্য করা যায়।"), ("Genuine ও aftermarket দু ধরনের পার্ট কি পাওয়া যায়?", "হ্যাঁ। দু ধরনের পণ্য আলাদা ভাবে তালিকাভুক্ত এবং একই জিনিস হিসেবে উপস্থাপন করা হয় না।"), ("কোথায় shipping হয়?", "Souviks সারা ভারতের গ্রাহকদের পরিষেবা দেয়। delivery time ও freight অর্ডার এবং গন্তব্যের উপর নির্ভর করে।")],
        },
    }
    for lang in LANGUAGES:
        path = ROOT / lang / "about.html"
        if not path.exists():
            continue
        page = path.read_text(encoding="utf-8")
        t = T[lang]
        start = page.find('<div class="video-grid">')
        end = page.find('</div>\n\n    </div>\n\n</section>', start)
        if start >= 0 and end >= 0:
            cards = ''.join((f'<div class="video-card about-video-card"><video controls preload="metadata" playsinline width="400" height="400"><source src="/assets/images/about/{fn}" type="video/mp4"></video><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>' if fn.lower().endswith(".mp4") else f'<div class="video-card about-photo-card"><img src="/assets/images/about/{fn}" width="400" height="400" loading="lazy" decoding="async" alt="{esc(title)}"><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>') for title, desc, fn in t["cards"])
            page = page[:start] + '<div class="video-grid">' + cards + '</div>' + page[end+len('</div>\n\n    </div>\n\n</section>'):]
        page = page.replace('<span class="video-coming-soon">Video coming soon</span>', '')
        marker = '<!-- ABOUT_TRUST_CONTEXT -->'
        if marker not in page:
            faq = ''.join(f'<details class="entity-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q,a in t["faq"])
            proof = ''.join(f'<div class="why-card"><p>{esc(x)}</p></div>' for x in t["b2b"])
            section = f'''{marker}
<section class="about-trust-context section-spacing">
  <div class="container">
    <div class="section-heading"><h2>{esc(t["b2b_title"])}</h2></div>
    <div class="about-proof-grid">{proof}</div>
    <div class="about-context-columns"><div><h3>{esc(t["position_title"])}</h3><p>{esc(t["position"])}</p></div><div><h3>{esc(t["service_title"])}</h3><p>{esc(t["service"])}</p></div></div>
    <div class="entity-faq"><h3>{esc(t["faq_title"])}</h3>{faq}</div>
  </div>
</section>
'''
            anchor = '<div class="container">\n\n    <div class="cta-wrapper">'
            page = page.replace(anchor, section + '\n' + anchor, 1)
        path.write_text(page, encoding="utf-8")

def main():
    catalogue = json.loads((ROOT / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
    brands = json.loads((ROOT / "assets/data/brands.json").read_text(encoding="utf-8"))
    categories = json.loads((ROOT / "assets/data/categories.json").read_text(encoding="utf-8"))
    vehicles = json.loads((ROOT / "assets/data/vehicles.json").read_text(encoding="utf-8"))
    enrich_entity_pages("brand", brands, catalogue)
    enrich_entity_pages("category", categories, catalogue)
    enrich_entity_pages("vehicle", vehicles, catalogue)
    (ROOT / "assets/data/brands.json").write_text(json.dumps(brands, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "assets/data/categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "assets/data/vehicles.json").write_text(json.dumps(vehicles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    enrich_about()

if __name__ == "__main__":
    main()
, token):
            depth += 1

    raise ValueError("Entity page has an unclosed #product-grid container.")


def enrich_entity_pages(kind, data, catalogue):
    for item in data:
        if item.get("active") is False:
            continue
        item_id = clean(item.get("id"))
        if not item_id:
            continue
        if kind == "brand":
            products = [p for p in catalogue if p.get("active") is not False and clean(p.get("brand_id")) == item_id]
            item["product_count"] = len(products)
            item["categories"] = sorted(set(clean(p.get("category_id")) for p in products if clean(p.get("category_id"))))
            item["subcategories"] = sorted(set(clean(p.get("subcategory_id")) for p in products if clean(p.get("subcategory_id"))))
            item["vehicles"] = sorted(set(arr_products(products, "vehicles")))
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            meta = OFFICIAL_BRANDS.get(item_id)
            if meta:
                item["website"], item["country"] = meta["website"], meta["country"]
            logo_override = BRAND_LOGO_OVERRIDES.get(item_id)
            if logo_override:
                item["logo"] = logo_override
            cats = sorted(set(clean(p.get("category_name") or p.get("category")) for p in products if clean(p.get("category_name") or p.get("category"))))
            item.setdefault("seo", {})
            subs = top(arr_products(products, "subcategory_name"), 6)
            vehicles = top(arr_products(products, "vehicles"), 6)
            manufacturer_note = ""
            if meta and clean(meta.get("country")):
                manufacturer_note = f' Manufacturer country: {clean(meta.get("country"))}.'
            example_products = []
            seen_example_ids = set()
            for product in products:
                pid = clean(product.get("id"))
                pname = clean(product.get("product_name") or product.get("name"))
                if pid and pname and pid not in seen_example_ids:
                    example_products.append(pname)
                    seen_example_ids.add(pid)
                if len(example_products) >= 3:
                    break

            item["description"] = (
                f'Souviks currently lists {len(products)} active {clean(item.get("name"))} products across '
                f'{list_text(cats, 5) or "the commercial-vehicle parts catalogue"}. '
                f'The listed range is mapped to applications such as '
                f'{list_text(vehicles, 5) or "commercial vehicle applications"} and common replacement areas including '
                f'{list_text(subs, 5) or "related commercial-vehicle parts"}. '
                f'{manufacturer_note} Current catalogue examples include '
                f'{list_text(example_products, 3) or "multiple commercial-vehicle replacement parts"}. '
                f'Use the part number, application and vehicle details when checking fitment.'
            )
            item["short_description"] = (
                f'{clean(item.get("name"))} products at Souviks cover '
                f'{list_text(cats, 4) or "commercial-vehicle parts"} and applications across '
                f'{list_text(vehicles, 3) or "commercial vehicles"}.'
            )
            item["seo"]["description"] = item["description"]
        elif kind == "vehicle":
            name = clean(item.get("model") or item.get("name"))
            products = [p for p in catalogue if p.get("active") is not False and name in [clean(v) for v in (p.get("vehicles") or [])]]
            prefix = name.split()[0] if name else ""
            manufacturer_map = {"Tata": "Tata Motors", "Ashok": "Ashok Leyland", "Eicher": "Eicher", "Mahindra": "Mahindra", "Universal": "Multi-brand / Universal", "Tractors": "Multiple manufacturers"}
            item.setdefault("manufacturer", {})
            item["manufacturer"]["name"] = manufacturer_map.get(prefix, prefix)
            item["product_count"] = len(products)
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            cat_pairs, brand_pairs = {}, {}
            for p in products:
                if clean(p.get("category_id")):
                    cat_pairs[clean(p.get("category_id"))] = clean(p.get("category_name") or p.get("category"))
                if clean(p.get("brand_id")):
                    brand_pairs[clean(p.get("brand_id"))] = clean(p.get("brand_name") or p.get("brand"))
            item["categories"] = [{"id": k, "name": v} for k, v in sorted(cat_pairs.items())]
            item["brands"] = [{"id": k, "name": v} for k, v in sorted(brand_pairs.items())]
            subs = top(arr_products(products, "subcategory_name"), 8)
            cats = top(arr_products(products, "category_name"), 8)
            item.setdefault("seo", {})
            item["description"] = f'Souviks lists {len(products)} active spare parts for {name}, a {manufacturer_map.get(prefix, prefix) or "commercial-vehicle"} application. Current catalogue coverage includes {list_text(cats, 5)} and common replacement areas such as {list_text(subs, 5)}; listed brands include {list_text(top(arr_products(products, "brand_name"), 5), 5)}.'
            item["short_description"] = f'{name}: {len(products)} active parts mapped across {list_text(cats, 4) or "commercial-vehicle systems"}.'
            item["seo"]["description"] = item["description"]
        else:
            products = [p for p in catalogue if p.get("active") is not False and clean(p.get("category_id")) == item_id]
            item["product_count"] = len(products)
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            sub_pairs, brand_pairs, vehicle_names = {}, {}, set()
            for p in products:
                if clean(p.get("subcategory_id")):
                    sub_pairs[clean(p.get("subcategory_id"))] = clean(p.get("subcategory_name") or p.get("subcategory"))
                if clean(p.get("brand_id")):
                    brand_pairs[clean(p.get("brand_id"))] = clean(p.get("brand_name") or p.get("brand"))
                vehicle_names.update(arr_products([p], "vehicles"))
            item["subcategories"] = [{"id": k, "name": v} for k, v in sorted(sub_pairs.items())]
            item["brands"] = [{"id": k, "name": v} for k, v in sorted(brand_pairs.items())]
            item["vehicles"] = sorted(vehicle_names)
            brands = [v for v in brand_pairs.values() if v]
            item.setdefault("seo", {})
            item["description"] = f'{clean(item.get("name"))} covers {len(products)} active commercial-vehicle spare parts used across {list_text(sorted(vehicle_names), 5) or "truck, bus and commercial-vehicle applications"}. The category includes subcategories such as {list_text(sorted(set(sub_pairs.values())), 5) or "related replacement parts"} and brands including {list_text(sorted(set(brands)), 5) or "multiple suppliers"}.'
            item["short_description"] = f'{clean(item.get("name"))}: {len(products)} active parts across {list_text(sorted(set(sub_pairs.values())), 4) or "related replacement parts"}.'
            item["seo"]["description"] = item["description"]

        for lang in LANGUAGES:
            path = ROOT / lang / (kind + "s") / f'{clean(item.get("slug"))}.html'
            if not path.exists():
                continue
            page = update_meta(path.read_text(encoding="utf-8"), clean(item.get("description")))
            gallery_html = entity_product_galleries(kind, item, products, lang)
            grid_pattern = r'(<div\s+id=["\']product-grid["\'][^>]*data-static-rendered=["\']true["\'][^>]*>)[\s\S]*?(\n\s*</div>\s*\n\s*</div>\s*\n\s*</section>)'
            page = re.sub(grid_pattern, lambda m: m.group(1) + "\n\n" + gallery_html + m.group(2), page, count=1, flags=re.I)
            if kind == "vehicle" and len(products) <= 5:
                robots_pattern = r'(<meta\s+name=["\']robots["\']\s+content=["\'])[^"\']*(["\'])'
                page = re.sub(
                    robots_pattern,
                    lambda m: m.group(1) + "noindex,follow,max-image-preview:large" + m.group(2),
                    page,
                    count=1,
                    flags=re.I,
                )
            if kind == "brand":
                logo = clean(item.get("logo"))
                if logo:
                    page = re.sub(
                        r'(<div class="brand-logo">.*?<img\s+src=")[^"]+"',
                        lambda m: m.group(1) + logo + '"',
                        page,
                        count=1,
                        flags=re.I,
                    )
                selector = r'(<div class="brand-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            elif kind == "vehicle":
                selector = r'(<div class="vehicle-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            else:
                selector = r'(<div class="category-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            page = re.sub(selector, lambda m: m.group(1) + esc(item.get("description")) + m.group(2), page, count=1, flags=re.I)
            marker = f'<!-- ENTITY_CONTEXT_{kind.upper()} -->'
            if marker not in page:
                section = context_section(kind, item, products, lang)
                anchor_pattern = rf'<!--\s*=+\s*{kind.upper()} PRODUCTS\s*=+\s*-->' if kind != "vehicle" else r'<!--\s*=+\s*COMPATIBLE PRODUCTS\s*=+\s*-->'
                anchor_match = re.search(anchor_pattern, page, flags=re.I)
                if anchor_match:
                    page = page[:anchor_match.start()] + marker + "\n" + section + "\n" + page[anchor_match.start():]
                else:
                    page = page.replace("</body>", marker + "\n" + section + "\n</body>", 1)
            page = ensure_main_landmark(page)
            path.write_text(page, encoding="utf-8")

def enrich_about():
    T = {
        "en": {
            "cards": [("Store tour", "A short look at the Souviks premises and stocked inventory.", "inventory-part1.mp4"), ("Inside the store", "Shelving and stock arranged for day-to-day parts trade.", "store-interior.jpg"), ("Parts counter", "The working counter used for customer enquiries and part identification.", "store-counter.jpg")],
            "b2b_title": "Built for B2B parts buyers",
            "b2b": ["Commercial-vehicle focus for workshops, retailers, fleet operators and distributors.", "Part-number, vehicle and application based assistance before you buy.", "Pan-India shipping for stocked parts, with dispatch and availability confirmed against the order.", "Catalogue coverage across filters, bearings, clutch parts, brakes, lubricants, electricals, engine parts and related systems."],
            "position_title": "Genuine OEM and aftermarket — clearly distinguished",
            "position": "Souviks lists genuine/OE-specified products where the catalogue identifies them as genuine, and separately lists branded aftermarket products. An aftermarket product is not presented as an OEM part merely because it fits the same application.",
            "service_title": "Buying and distribution support",
            "service": "We help customers identify parts using part numbers, vehicle models, applications and product photographs. Orders can be supplied across India; availability, pricing and compatibility should be confirmed for the specific requirement before dispatch.",
            "faq_title": "Frequently asked questions",
            "faq": [("Can Souviks help identify a part?", "Yes. Send the part number, vehicle details or a clear photograph and the team can help match the requirement against the catalogue."), ("Do you supply genuine and aftermarket parts?", "Yes. The catalogue contains both genuine/OE-specified and branded aftermarket products. They are not represented as the same thing."), ("Where do you ship?", "Souviks serves customers across India. Delivery timing and freight treatment depend on the order and destination.")],
        },
        "hi": {
            "cards": [("स्टोर टूर", "Souviks परिसर और स्टॉक का एक छोटा वीडियो।", "inventory-part1.mp4"), ("स्टोर के अंदर", "दैनिक पार्ट्स ट्रेड के लिए व्यवस्थित स्टॉक और शेल्फ।", "store-interior.jpg"), ("पार्ट्स काउंटर", "ग्राहक पूछताछ और पार्ट पहचान के लिए उपयोग होने वाला काउंटर।", "store-counter.jpg")],
            "b2b_title": "B2B पार्ट्स खरीदारों के लिए बनाया गया",
            "b2b": ["वर्कशॉप, रिटेलर, फ्लीट ऑपरेटर और डिस्ट्रीब्यूटर के लिए कमर्शियल-व्हीकल फोकस।", "खरीद से पहले पार्ट नंबर, वाहन और एप्लिकेशन आधारित सहायता।", "स्टॉक किए गए पार्ट्स के लिए पूरे भारत में शिपिंग।", "फिल्टर, बेयरिंग, क्लच, ब्रेक, लुब्रिकेंट, इलेक्ट्रिकल और इंजन पार्ट्स सहित व्यापक कैटलॉग।"],
            "position_title": "Genuine OEM और aftermarket को स्पष्ट रूप से अलग रखा गया है",
            "position": "जहाँ कैटलॉग किसी उत्पाद को genuine/OE-specified बताता है, वहीं उसे उसी रूप में सूचीबद्ध किया जाता है। ब्रांडेड aftermarket उत्पाद अलग रूप से सूचीबद्ध हैं और उन्हें केवल फिटमेंट के आधार पर OEM नहीं बताया जाता।",
            "service_title": "खरीद और वितरण सहायता",
            "service": "पार्ट नंबर, वाहन मॉडल, एप्लिकेशन और उत्पाद की फोटो के आधार पर पार्ट पहचान में सहायता दी जाती है। पूरे भारत में ऑर्डर सप्लाई किए जा सकते हैं; उपलब्धता, कीमत और compatibility को dispatch से पहले पुष्टि करना चाहिए।",
            "faq_title": "अक्सर पूछे जाने वाले प्रश्न",
            "faq": [("क्या Souviks पार्ट पहचानने में मदद कर सकता है?", "हाँ। पार्ट नंबर, वाहन विवरण या स्पष्ट फोटो भेजें; कैटलॉग में मिलान खोजने में सहायता की जा सकती है।"), ("क्या genuine और aftermarket दोनों पार्ट मिलते हैं?", "हाँ। दोनों प्रकार के उत्पाद अलग-अलग सूचीबद्ध हैं और उन्हें एक ही श्रेणी के रूप में प्रस्तुत नहीं किया जाता।"), ("कहाँ shipping होती है?", "Souviks पूरे भारत में ग्राहकों को सेवा देता है। डिलीवरी समय और freight ऑर्डर व destination पर निर्भर करते हैं।")],
        },
        "bn": {
            "cards": [("স্টোর ট্যুর", "Souviks স্টোর ও স্টকের একটি ছোট ভিডিও।", "inventory-part1.mp4"), ("স্টোরের ভেতরে", "দৈনন্দিন পার্টস ব্যবসার জন্য সাজানো স্টক ও তাক।", "store-interior.jpg"), ("পার্টস কাউন্টার", "গ্রাহকের জিজ্ঞাসা ও পার্ট শনাক্তকরণের জন্য ব্যবহৃত কাউন্টার।", "store-counter.jpg")],
            "b2b_title": "B2B পার্টস ক্রেতাদের জন্য তৈরি",
            "b2b": ["ওয়ার্কশপ, রিটেলার, ফ্লিট অপারেটর ও ডিস্ট্রিবিউটরদের জন্য কমার্শিয়াল-ভেহিকল ফোকাস।", "কেনার আগে পার্ট নম্বর, গাড়ি ও অ্যাপ্লিকেশন অনুযায়ী সহায়তা।", "স্টক থাকা পণ্যের জন্য সারা ভারতে শিপিং।", "ফিল্টার, বিয়ারিং, ক্লাচ, ব্রেক, লুব্রিক্যান্ট, ইলেকট্রিক্যাল ও ইঞ্জিন পার্টসসহ বিস্তৃত ক্যাটালগ।"],
            "position_title": "Genuine OEM ও aftermarket পরিষ্কারভাবে আলাদা",
            "position": "ক্যাটালগে যে পণ্য genuine/OE-specified হিসেবে চিহ্নিত, সেটিকে সেইভাবেই দেখানো হয়। ব্র্যান্ডেড aftermarket পণ্য আলাদা করে তালিকাভুক্ত এবং শুধু একই অ্যাপ্লিকেশনে ব্যবহারযোগ্য বলেই OEM হিসেবে দেখানো হয় না।",
            "service_title": "কেনাকাটা ও ডিস্ট্রিবিউশন সহায়তা",
            "service": "পার্ট নম্বর, গাড়ির মডেল, অ্যাপ্লিকেশন ও পণ্যের ছবি ব্যবহার করে পার্ট শনাক্ত করতে সাহায্য করা হয়। সারা ভারতে অর্ডার সরবরাহ করা যায়; dispatch-এর আগে availability, price ও compatibility নিশ্চিত করা উচিত।",
            "faq_title": "সাধারণ জিজ্ঞাসা",
            "faq": [("Souviks কি পার্ট শনাক্ত করতে সাহায্য করতে পারে?", "হ্যাঁ। পার্ট নম্বর, গাড়ির তথ্য বা পরিষ্কার ছবি পাঠালে ক্যাটালগে মিল খুঁজতে সাহায্য করা যায়।"), ("Genuine ও aftermarket দু ধরনের পার্ট কি পাওয়া যায়?", "হ্যাঁ। দু ধরনের পণ্য আলাদা ভাবে তালিকাভুক্ত এবং একই জিনিস হিসেবে উপস্থাপন করা হয় না।"), ("কোথায় shipping হয়?", "Souviks সারা ভারতের গ্রাহকদের পরিষেবা দেয়। delivery time ও freight অর্ডার এবং গন্তব্যের উপর নির্ভর করে।")],
        },
    }
    for lang in LANGUAGES:
        path = ROOT / lang / "about.html"
        if not path.exists():
            continue
        page = path.read_text(encoding="utf-8")
        t = T[lang]
        start = page.find('<div class="video-grid">')
        end = page.find('</div>\n\n    </div>\n\n</section>', start)
        if start >= 0 and end >= 0:
            cards = ''.join((f'<div class="video-card about-video-card"><video controls preload="metadata" playsinline width="400" height="400"><source src="/assets/images/about/{fn}" type="video/mp4"></video><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>' if fn.lower().endswith(".mp4") else f'<div class="video-card about-photo-card"><img src="/assets/images/about/{fn}" width="400" height="400" loading="lazy" decoding="async" alt="{esc(title)}"><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>') for title, desc, fn in t["cards"])
            page = page[:start] + '<div class="video-grid">' + cards + '</div>' + page[end+len('</div>\n\n    </div>\n\n</section>'):]
        page = page.replace('<span class="video-coming-soon">Video coming soon</span>', '')
        marker = '<!-- ABOUT_TRUST_CONTEXT -->'
        if marker not in page:
            faq = ''.join(f'<details class="entity-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q,a in t["faq"])
            proof = ''.join(f'<div class="why-card"><p>{esc(x)}</p></div>' for x in t["b2b"])
            section = f'''{marker}
<section class="about-trust-context section-spacing">
  <div class="container">
    <div class="section-heading"><h2>{esc(t["b2b_title"])}</h2></div>
    <div class="about-proof-grid">{proof}</div>
    <div class="about-context-columns"><div><h3>{esc(t["position_title"])}</h3><p>{esc(t["position"])}</p></div><div><h3>{esc(t["service_title"])}</h3><p>{esc(t["service"])}</p></div></div>
    <div class="entity-faq"><h3>{esc(t["faq_title"])}</h3>{faq}</div>
  </div>
</section>
'''
            anchor = '<div class="container">\n\n    <div class="cta-wrapper">'
            page = page.replace(anchor, section + '\n' + anchor, 1)
        path.write_text(page, encoding="utf-8")

def main():
    catalogue = json.loads((ROOT / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
    brands = json.loads((ROOT / "assets/data/brands.json").read_text(encoding="utf-8"))
    categories = json.loads((ROOT / "assets/data/categories.json").read_text(encoding="utf-8"))
    vehicles = json.loads((ROOT / "assets/data/vehicles.json").read_text(encoding="utf-8"))
    enrich_entity_pages("brand", brands, catalogue)
    enrich_entity_pages("category", categories, catalogue)
    enrich_entity_pages("vehicle", vehicles, catalogue)
    (ROOT / "assets/data/brands.json").write_text(json.dumps(brands, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "assets/data/categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "assets/data/vehicles.json").write_text(json.dumps(vehicles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    enrich_about()

if __name__ == "__main__":
    main()
, token):
            depth += 1

    raise ValueError("Entity page has an unclosed #product-grid container.")


def enrich_entity_pages(kind, data, catalogue):
    for item in data:
        if item.get("active") is False:
            continue
        item_id = clean(item.get("id"))
        if not item_id:
            continue
        if kind == "brand":
            products = [p for p in catalogue if p.get("active") is not False and clean(p.get("brand_id")) == item_id]
            item["product_count"] = len(products)
            item["categories"] = sorted(set(clean(p.get("category_id")) for p in products if clean(p.get("category_id"))))
            item["subcategories"] = sorted(set(clean(p.get("subcategory_id")) for p in products if clean(p.get("subcategory_id"))))
            item["vehicles"] = sorted(set(arr_products(products, "vehicles")))
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            meta = OFFICIAL_BRANDS.get(item_id)
            if meta:
                item["website"], item["country"] = meta["website"], meta["country"]
            logo_override = BRAND_LOGO_OVERRIDES.get(item_id)
            if logo_override:
                item["logo"] = logo_override
            cats = sorted(set(clean(p.get("category_name") or p.get("category")) for p in products if clean(p.get("category_name") or p.get("category"))))
            item.setdefault("seo", {})
            subs = top(arr_products(products, "subcategory_name"), 6)
            vehicles = top(arr_products(products, "vehicles"), 6)
            manufacturer_note = ""
            if meta and clean(meta.get("country")):
                manufacturer_note = f' Manufacturer country: {clean(meta.get("country"))}.'
            example_products = []
            seen_example_ids = set()
            for product in products:
                pid = clean(product.get("id"))
                pname = clean(product.get("product_name") or product.get("name"))
                if pid and pname and pid not in seen_example_ids:
                    example_products.append(pname)
                    seen_example_ids.add(pid)
                if len(example_products) >= 3:
                    break

            item["description"] = (
                f'Souviks currently lists {len(products)} active {clean(item.get("name"))} products across '
                f'{list_text(cats, 5) or "the commercial-vehicle parts catalogue"}. '
                f'The listed range is mapped to applications such as '
                f'{list_text(vehicles, 5) or "commercial vehicle applications"} and common replacement areas including '
                f'{list_text(subs, 5) or "related commercial-vehicle parts"}. '
                f'{manufacturer_note} Current catalogue examples include '
                f'{list_text(example_products, 3) or "multiple commercial-vehicle replacement parts"}. '
                f'Use the part number, application and vehicle details when checking fitment.'
            )
            item["short_description"] = (
                f'{clean(item.get("name"))} products at Souviks cover '
                f'{list_text(cats, 4) or "commercial-vehicle parts"} and applications across '
                f'{list_text(vehicles, 3) or "commercial vehicles"}.'
            )
            item["seo"]["description"] = item["description"]
        elif kind == "vehicle":
            name = clean(item.get("model") or item.get("name"))
            products = [p for p in catalogue if p.get("active") is not False and name in [clean(v) for v in (p.get("vehicles") or [])]]
            prefix = name.split()[0] if name else ""
            manufacturer_map = {"Tata": "Tata Motors", "Ashok": "Ashok Leyland", "Eicher": "Eicher", "Mahindra": "Mahindra", "Universal": "Multi-brand / Universal", "Tractors": "Multiple manufacturers"}
            item.setdefault("manufacturer", {})
            item["manufacturer"]["name"] = manufacturer_map.get(prefix, prefix)
            item["product_count"] = len(products)
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            cat_pairs, brand_pairs = {}, {}
            for p in products:
                if clean(p.get("category_id")):
                    cat_pairs[clean(p.get("category_id"))] = clean(p.get("category_name") or p.get("category"))
                if clean(p.get("brand_id")):
                    brand_pairs[clean(p.get("brand_id"))] = clean(p.get("brand_name") or p.get("brand"))
            item["categories"] = [{"id": k, "name": v} for k, v in sorted(cat_pairs.items())]
            item["brands"] = [{"id": k, "name": v} for k, v in sorted(brand_pairs.items())]
            subs = top(arr_products(products, "subcategory_name"), 8)
            cats = top(arr_products(products, "category_name"), 8)
            item.setdefault("seo", {})
            item["description"] = f'Souviks lists {len(products)} active spare parts for {name}, a {manufacturer_map.get(prefix, prefix) or "commercial-vehicle"} application. Current catalogue coverage includes {list_text(cats, 5)} and common replacement areas such as {list_text(subs, 5)}; listed brands include {list_text(top(arr_products(products, "brand_name"), 5), 5)}.'
            item["short_description"] = f'{name}: {len(products)} active parts mapped across {list_text(cats, 4) or "commercial-vehicle systems"}.'
            item["seo"]["description"] = item["description"]
        else:
            products = [p for p in catalogue if p.get("active") is not False and clean(p.get("category_id")) == item_id]
            item["product_count"] = len(products)
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            sub_pairs, brand_pairs, vehicle_names = {}, {}, set()
            for p in products:
                if clean(p.get("subcategory_id")):
                    sub_pairs[clean(p.get("subcategory_id"))] = clean(p.get("subcategory_name") or p.get("subcategory"))
                if clean(p.get("brand_id")):
                    brand_pairs[clean(p.get("brand_id"))] = clean(p.get("brand_name") or p.get("brand"))
                vehicle_names.update(arr_products([p], "vehicles"))
            item["subcategories"] = [{"id": k, "name": v} for k, v in sorted(sub_pairs.items())]
            item["brands"] = [{"id": k, "name": v} for k, v in sorted(brand_pairs.items())]
            item["vehicles"] = sorted(vehicle_names)
            brands = [v for v in brand_pairs.values() if v]
            item.setdefault("seo", {})
            item["description"] = f'{clean(item.get("name"))} covers {len(products)} active commercial-vehicle spare parts used across {list_text(sorted(vehicle_names), 5) or "truck, bus and commercial-vehicle applications"}. The category includes subcategories such as {list_text(sorted(set(sub_pairs.values())), 5) or "related replacement parts"} and brands including {list_text(sorted(set(brands)), 5) or "multiple suppliers"}.'
            item["short_description"] = f'{clean(item.get("name"))}: {len(products)} active parts across {list_text(sorted(set(sub_pairs.values())), 4) or "related replacement parts"}.'
            item["seo"]["description"] = item["description"]

        for lang in LANGUAGES:
            path = ROOT / lang / (kind + "s") / f'{clean(item.get("slug"))}.html'
            if not path.exists():
                continue
            page = update_meta(path.read_text(encoding="utf-8"), clean(item.get("description")))
            gallery_html = entity_product_galleries(kind, item, products, lang)
            page = replace_static_product_grid(page, gallery_html)
            if kind == "vehicle" and len(products) <= 5:
                robots_pattern = r'(<meta\s+name=["\']robots["\']\s+content=["\'])[^"\']*(["\'])'
                page = re.sub(
                    robots_pattern,
                    lambda m: m.group(1) + "noindex,follow,max-image-preview:large" + m.group(2),
                    page,
                    count=1,
                    flags=re.I,
                )
            if kind == "brand":
                logo = clean(item.get("logo"))
                if logo:
                    page = re.sub(
                        r'(<div class="brand-logo">.*?<img\s+src=")[^"]+"',
                        lambda m: m.group(1) + logo + '"',
                        page,
                        count=1,
                        flags=re.I,
                    )
                selector = r'(<div class="brand-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            elif kind == "vehicle":
                selector = r'(<div class="vehicle-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            else:
                selector = r'(<div class="category-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            page = re.sub(selector, lambda m: m.group(1) + esc(item.get("description")) + m.group(2), page, count=1, flags=re.I)
            marker = f'<!-- ENTITY_CONTEXT_{kind.upper()} -->'
            if marker not in page:
                section = context_section(kind, item, products, lang)
                anchor_pattern = rf'<!--\s*=+\s*{kind.upper()} PRODUCTS\s*=+\s*-->' if kind != "vehicle" else r'<!--\s*=+\s*COMPATIBLE PRODUCTS\s*=+\s*-->'
                anchor_match = re.search(anchor_pattern, page, flags=re.I)
                if anchor_match:
                    page = page[:anchor_match.start()] + marker + "\n" + section + "\n" + page[anchor_match.start():]
                else:
                    page = page.replace("</body>", marker + "\n" + section + "\n</body>", 1)
            page = ensure_main_landmark(page)
            path.write_text(page, encoding="utf-8")

def enrich_about():
    T = {
        "en": {
            "cards": [("Store tour", "A short look at the Souviks premises and stocked inventory.", "inventory-part1.mp4"), ("Inside the store", "Shelving and stock arranged for day-to-day parts trade.", "store-interior.jpg"), ("Parts counter", "The working counter used for customer enquiries and part identification.", "store-counter.jpg")],
            "b2b_title": "Built for B2B parts buyers",
            "b2b": ["Commercial-vehicle focus for workshops, retailers, fleet operators and distributors.", "Part-number, vehicle and application based assistance before you buy.", "Pan-India shipping for stocked parts, with dispatch and availability confirmed against the order.", "Catalogue coverage across filters, bearings, clutch parts, brakes, lubricants, electricals, engine parts and related systems."],
            "position_title": "Genuine OEM and aftermarket — clearly distinguished",
            "position": "Souviks lists genuine/OE-specified products where the catalogue identifies them as genuine, and separately lists branded aftermarket products. An aftermarket product is not presented as an OEM part merely because it fits the same application.",
            "service_title": "Buying and distribution support",
            "service": "We help customers identify parts using part numbers, vehicle models, applications and product photographs. Orders can be supplied across India; availability, pricing and compatibility should be confirmed for the specific requirement before dispatch.",
            "faq_title": "Frequently asked questions",
            "faq": [("Can Souviks help identify a part?", "Yes. Send the part number, vehicle details or a clear photograph and the team can help match the requirement against the catalogue."), ("Do you supply genuine and aftermarket parts?", "Yes. The catalogue contains both genuine/OE-specified and branded aftermarket products. They are not represented as the same thing."), ("Where do you ship?", "Souviks serves customers across India. Delivery timing and freight treatment depend on the order and destination.")],
        },
        "hi": {
            "cards": [("स्टोर टूर", "Souviks परिसर और स्टॉक का एक छोटा वीडियो।", "inventory-part1.mp4"), ("स्टोर के अंदर", "दैनिक पार्ट्स ट्रेड के लिए व्यवस्थित स्टॉक और शेल्फ।", "store-interior.jpg"), ("पार्ट्स काउंटर", "ग्राहक पूछताछ और पार्ट पहचान के लिए उपयोग होने वाला काउंटर।", "store-counter.jpg")],
            "b2b_title": "B2B पार्ट्स खरीदारों के लिए बनाया गया",
            "b2b": ["वर्कशॉप, रिटेलर, फ्लीट ऑपरेटर और डिस्ट्रीब्यूटर के लिए कमर्शियल-व्हीकल फोकस।", "खरीद से पहले पार्ट नंबर, वाहन और एप्लिकेशन आधारित सहायता।", "स्टॉक किए गए पार्ट्स के लिए पूरे भारत में शिपिंग।", "फिल्टर, बेयरिंग, क्लच, ब्रेक, लुब्रिकेंट, इलेक्ट्रिकल और इंजन पार्ट्स सहित व्यापक कैटलॉग।"],
            "position_title": "Genuine OEM और aftermarket को स्पष्ट रूप से अलग रखा गया है",
            "position": "जहाँ कैटलॉग किसी उत्पाद को genuine/OE-specified बताता है, वहीं उसे उसी रूप में सूचीबद्ध किया जाता है। ब्रांडेड aftermarket उत्पाद अलग रूप से सूचीबद्ध हैं और उन्हें केवल फिटमेंट के आधार पर OEM नहीं बताया जाता।",
            "service_title": "खरीद और वितरण सहायता",
            "service": "पार्ट नंबर, वाहन मॉडल, एप्लिकेशन और उत्पाद की फोटो के आधार पर पार्ट पहचान में सहायता दी जाती है। पूरे भारत में ऑर्डर सप्लाई किए जा सकते हैं; उपलब्धता, कीमत और compatibility को dispatch से पहले पुष्टि करना चाहिए।",
            "faq_title": "अक्सर पूछे जाने वाले प्रश्न",
            "faq": [("क्या Souviks पार्ट पहचानने में मदद कर सकता है?", "हाँ। पार्ट नंबर, वाहन विवरण या स्पष्ट फोटो भेजें; कैटलॉग में मिलान खोजने में सहायता की जा सकती है।"), ("क्या genuine और aftermarket दोनों पार्ट मिलते हैं?", "हाँ। दोनों प्रकार के उत्पाद अलग-अलग सूचीबद्ध हैं और उन्हें एक ही श्रेणी के रूप में प्रस्तुत नहीं किया जाता।"), ("कहाँ shipping होती है?", "Souviks पूरे भारत में ग्राहकों को सेवा देता है। डिलीवरी समय और freight ऑर्डर व destination पर निर्भर करते हैं।")],
        },
        "bn": {
            "cards": [("স্টোর ট্যুর", "Souviks স্টোর ও স্টকের একটি ছোট ভিডিও।", "inventory-part1.mp4"), ("স্টোরের ভেতরে", "দৈনন্দিন পার্টস ব্যবসার জন্য সাজানো স্টক ও তাক।", "store-interior.jpg"), ("পার্টস কাউন্টার", "গ্রাহকের জিজ্ঞাসা ও পার্ট শনাক্তকরণের জন্য ব্যবহৃত কাউন্টার।", "store-counter.jpg")],
            "b2b_title": "B2B পার্টস ক্রেতাদের জন্য তৈরি",
            "b2b": ["ওয়ার্কশপ, রিটেলার, ফ্লিট অপারেটর ও ডিস্ট্রিবিউটরদের জন্য কমার্শিয়াল-ভেহিকল ফোকাস।", "কেনার আগে পার্ট নম্বর, গাড়ি ও অ্যাপ্লিকেশন অনুযায়ী সহায়তা।", "স্টক থাকা পণ্যের জন্য সারা ভারতে শিপিং।", "ফিল্টার, বিয়ারিং, ক্লাচ, ব্রেক, লুব্রিক্যান্ট, ইলেকট্রিক্যাল ও ইঞ্জিন পার্টসসহ বিস্তৃত ক্যাটালগ।"],
            "position_title": "Genuine OEM ও aftermarket পরিষ্কারভাবে আলাদা",
            "position": "ক্যাটালগে যে পণ্য genuine/OE-specified হিসেবে চিহ্নিত, সেটিকে সেইভাবেই দেখানো হয়। ব্র্যান্ডেড aftermarket পণ্য আলাদা করে তালিকাভুক্ত এবং শুধু একই অ্যাপ্লিকেশনে ব্যবহারযোগ্য বলেই OEM হিসেবে দেখানো হয় না।",
            "service_title": "কেনাকাটা ও ডিস্ট্রিবিউশন সহায়তা",
            "service": "পার্ট নম্বর, গাড়ির মডেল, অ্যাপ্লিকেশন ও পণ্যের ছবি ব্যবহার করে পার্ট শনাক্ত করতে সাহায্য করা হয়। সারা ভারতে অর্ডার সরবরাহ করা যায়; dispatch-এর আগে availability, price ও compatibility নিশ্চিত করা উচিত।",
            "faq_title": "সাধারণ জিজ্ঞাসা",
            "faq": [("Souviks কি পার্ট শনাক্ত করতে সাহায্য করতে পারে?", "হ্যাঁ। পার্ট নম্বর, গাড়ির তথ্য বা পরিষ্কার ছবি পাঠালে ক্যাটালগে মিল খুঁজতে সাহায্য করা যায়।"), ("Genuine ও aftermarket দু ধরনের পার্ট কি পাওয়া যায়?", "হ্যাঁ। দু ধরনের পণ্য আলাদা ভাবে তালিকাভুক্ত এবং একই জিনিস হিসেবে উপস্থাপন করা হয় না।"), ("কোথায় shipping হয়?", "Souviks সারা ভারতের গ্রাহকদের পরিষেবা দেয়। delivery time ও freight অর্ডার এবং গন্তব্যের উপর নির্ভর করে।")],
        },
    }
    for lang in LANGUAGES:
        path = ROOT / lang / "about.html"
        if not path.exists():
            continue
        page = path.read_text(encoding="utf-8")
        t = T[lang]
        start = page.find('<div class="video-grid">')
        end = page.find('</div>\n\n    </div>\n\n</section>', start)
        if start >= 0 and end >= 0:
            cards = ''.join((f'<div class="video-card about-video-card"><video controls preload="metadata" playsinline width="400" height="400"><source src="/assets/images/about/{fn}" type="video/mp4"></video><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>' if fn.lower().endswith(".mp4") else f'<div class="video-card about-photo-card"><img src="/assets/images/about/{fn}" width="400" height="400" loading="lazy" decoding="async" alt="{esc(title)}"><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>') for title, desc, fn in t["cards"])
            page = page[:start] + '<div class="video-grid">' + cards + '</div>' + page[end+len('</div>\n\n    </div>\n\n</section>'):]
        page = page.replace('<span class="video-coming-soon">Video coming soon</span>', '')
        marker = '<!-- ABOUT_TRUST_CONTEXT -->'
        if marker not in page:
            faq = ''.join(f'<details class="entity-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q,a in t["faq"])
            proof = ''.join(f'<div class="why-card"><p>{esc(x)}</p></div>' for x in t["b2b"])
            section = f'''{marker}
<section class="about-trust-context section-spacing">
  <div class="container">
    <div class="section-heading"><h2>{esc(t["b2b_title"])}</h2></div>
    <div class="about-proof-grid">{proof}</div>
    <div class="about-context-columns"><div><h3>{esc(t["position_title"])}</h3><p>{esc(t["position"])}</p></div><div><h3>{esc(t["service_title"])}</h3><p>{esc(t["service"])}</p></div></div>
    <div class="entity-faq"><h3>{esc(t["faq_title"])}</h3>{faq}</div>
  </div>
</section>
'''
            anchor = '<div class="container">\n\n    <div class="cta-wrapper">'
            page = page.replace(anchor, section + '\n' + anchor, 1)
        path.write_text(page, encoding="utf-8")

def main():
    catalogue = json.loads((ROOT / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
    brands = json.loads((ROOT / "assets/data/brands.json").read_text(encoding="utf-8"))
    categories = json.loads((ROOT / "assets/data/categories.json").read_text(encoding="utf-8"))
    vehicles = json.loads((ROOT / "assets/data/vehicles.json").read_text(encoding="utf-8"))
    enrich_entity_pages("brand", brands, catalogue)
    enrich_entity_pages("category", categories, catalogue)
    enrich_entity_pages("vehicle", vehicles, catalogue)
    (ROOT / "assets/data/brands.json").write_text(json.dumps(brands, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "assets/data/categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "assets/data/vehicles.json").write_text(json.dumps(vehicles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    enrich_about()

if __name__ == "__main__":
    main()
, token):
            depth += 1

    raise ValueError("Entity page has an unclosed #product-grid container.")


def enrich_entity_pages(kind, data, catalogue):
    for item in data:
        if item.get("active") is False:
            continue
        item_id = clean(item.get("id"))
        if not item_id:
            continue
        if kind == "brand":
            products = [p for p in catalogue if p.get("active") is not False and clean(p.get("brand_id")) == item_id]
            item["product_count"] = len(products)
            item["categories"] = sorted(set(clean(p.get("category_id")) for p in products if clean(p.get("category_id"))))
            item["subcategories"] = sorted(set(clean(p.get("subcategory_id")) for p in products if clean(p.get("subcategory_id"))))
            item["vehicles"] = sorted(set(arr_products(products, "vehicles")))
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            meta = OFFICIAL_BRANDS.get(item_id)
            if meta:
                item["website"], item["country"] = meta["website"], meta["country"]
            logo_override = BRAND_LOGO_OVERRIDES.get(item_id)
            if logo_override:
                item["logo"] = logo_override
            cats = sorted(set(clean(p.get("category_name") or p.get("category")) for p in products if clean(p.get("category_name") or p.get("category"))))
            item.setdefault("seo", {})
            subs = top(arr_products(products, "subcategory_name"), 6)
            vehicles = top(arr_products(products, "vehicles"), 6)
            manufacturer_note = ""
            if meta and clean(meta.get("country")):
                manufacturer_note = f' Manufacturer country: {clean(meta.get("country"))}.'
            example_products = []
            seen_example_ids = set()
            for product in products:
                pid = clean(product.get("id"))
                pname = clean(product.get("product_name") or product.get("name"))
                if pid and pname and pid not in seen_example_ids:
                    example_products.append(pname)
                    seen_example_ids.add(pid)
                if len(example_products) >= 3:
                    break

            item["description"] = (
                f'Souviks currently lists {len(products)} active {clean(item.get("name"))} products across '
                f'{list_text(cats, 5) or "the commercial-vehicle parts catalogue"}. '
                f'The listed range is mapped to applications such as '
                f'{list_text(vehicles, 5) or "commercial vehicle applications"} and common replacement areas including '
                f'{list_text(subs, 5) or "related commercial-vehicle parts"}. '
                f'{manufacturer_note} Current catalogue examples include '
                f'{list_text(example_products, 3) or "multiple commercial-vehicle replacement parts"}. '
                f'Use the part number, application and vehicle details when checking fitment.'
            )
            item["short_description"] = (
                f'{clean(item.get("name"))} products at Souviks cover '
                f'{list_text(cats, 4) or "commercial-vehicle parts"} and applications across '
                f'{list_text(vehicles, 3) or "commercial vehicles"}.'
            )
            item["seo"]["description"] = item["description"]
        elif kind == "vehicle":
            name = clean(item.get("model") or item.get("name"))
            products = [p for p in catalogue if p.get("active") is not False and name in [clean(v) for v in (p.get("vehicles") or [])]]
            prefix = name.split()[0] if name else ""
            manufacturer_map = {"Tata": "Tata Motors", "Ashok": "Ashok Leyland", "Eicher": "Eicher", "Mahindra": "Mahindra", "Universal": "Multi-brand / Universal", "Tractors": "Multiple manufacturers"}
            item.setdefault("manufacturer", {})
            item["manufacturer"]["name"] = manufacturer_map.get(prefix, prefix)
            item["product_count"] = len(products)
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            cat_pairs, brand_pairs = {}, {}
            for p in products:
                if clean(p.get("category_id")):
                    cat_pairs[clean(p.get("category_id"))] = clean(p.get("category_name") or p.get("category"))
                if clean(p.get("brand_id")):
                    brand_pairs[clean(p.get("brand_id"))] = clean(p.get("brand_name") or p.get("brand"))
            item["categories"] = [{"id": k, "name": v} for k, v in sorted(cat_pairs.items())]
            item["brands"] = [{"id": k, "name": v} for k, v in sorted(brand_pairs.items())]
            subs = top(arr_products(products, "subcategory_name"), 8)
            cats = top(arr_products(products, "category_name"), 8)
            item.setdefault("seo", {})
            item["description"] = f'Souviks lists {len(products)} active spare parts for {name}, a {manufacturer_map.get(prefix, prefix) or "commercial-vehicle"} application. Current catalogue coverage includes {list_text(cats, 5)} and common replacement areas such as {list_text(subs, 5)}; listed brands include {list_text(top(arr_products(products, "brand_name"), 5), 5)}.'
            item["short_description"] = f'{name}: {len(products)} active parts mapped across {list_text(cats, 4) or "commercial-vehicle systems"}.'
            item["seo"]["description"] = item["description"]
        else:
            products = [p for p in catalogue if p.get("active") is not False and clean(p.get("category_id")) == item_id]
            item["product_count"] = len(products)
            item["products"] = [clean(p.get("id")) for p in products if clean(p.get("id"))]
            sub_pairs, brand_pairs, vehicle_names = {}, {}, set()
            for p in products:
                if clean(p.get("subcategory_id")):
                    sub_pairs[clean(p.get("subcategory_id"))] = clean(p.get("subcategory_name") or p.get("subcategory"))
                if clean(p.get("brand_id")):
                    brand_pairs[clean(p.get("brand_id"))] = clean(p.get("brand_name") or p.get("brand"))
                vehicle_names.update(arr_products([p], "vehicles"))
            item["subcategories"] = [{"id": k, "name": v} for k, v in sorted(sub_pairs.items())]
            item["brands"] = [{"id": k, "name": v} for k, v in sorted(brand_pairs.items())]
            item["vehicles"] = sorted(vehicle_names)
            brands = [v for v in brand_pairs.values() if v]
            item.setdefault("seo", {})
            item["description"] = f'{clean(item.get("name"))} covers {len(products)} active commercial-vehicle spare parts used across {list_text(sorted(vehicle_names), 5) or "truck, bus and commercial-vehicle applications"}. The category includes subcategories such as {list_text(sorted(set(sub_pairs.values())), 5) or "related replacement parts"} and brands including {list_text(sorted(set(brands)), 5) or "multiple suppliers"}.'
            item["short_description"] = f'{clean(item.get("name"))}: {len(products)} active parts across {list_text(sorted(set(sub_pairs.values())), 4) or "related replacement parts"}.'
            item["seo"]["description"] = item["description"]

        for lang in LANGUAGES:
            path = ROOT / lang / (kind + "s") / f'{clean(item.get("slug"))}.html'
            if not path.exists():
                continue
            page = update_meta(path.read_text(encoding="utf-8"), clean(item.get("description")))
            gallery_html = entity_product_galleries(kind, item, products, lang)
            grid_pattern = r'(<div\s+id=["\']product-grid["\'][^>]*data-static-rendered=["\']true["\'][^>]*>)[\s\S]*?(\n\s*</div>\s*\n\s*</div>\s*\n\s*</section>)'
            page = re.sub(grid_pattern, lambda m: m.group(1) + "\n\n" + gallery_html + m.group(2), page, count=1, flags=re.I)
            if kind == "vehicle" and len(products) <= 5:
                robots_pattern = r'(<meta\s+name=["\']robots["\']\s+content=["\'])[^"\']*(["\'])'
                page = re.sub(
                    robots_pattern,
                    lambda m: m.group(1) + "noindex,follow,max-image-preview:large" + m.group(2),
                    page,
                    count=1,
                    flags=re.I,
                )
            if kind == "brand":
                logo = clean(item.get("logo"))
                if logo:
                    page = re.sub(
                        r'(<div class="brand-logo">.*?<img\s+src=")[^"]+"',
                        lambda m: m.group(1) + logo + '"',
                        page,
                        count=1,
                        flags=re.I,
                    )
                selector = r'(<div class="brand-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            elif kind == "vehicle":
                selector = r'(<div class="vehicle-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            else:
                selector = r'(<div class="category-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            page = re.sub(selector, lambda m: m.group(1) + esc(item.get("description")) + m.group(2), page, count=1, flags=re.I)
            marker = f'<!-- ENTITY_CONTEXT_{kind.upper()} -->'
            if marker not in page:
                section = context_section(kind, item, products, lang)
                anchor_pattern = rf'<!--\s*=+\s*{kind.upper()} PRODUCTS\s*=+\s*-->' if kind != "vehicle" else r'<!--\s*=+\s*COMPATIBLE PRODUCTS\s*=+\s*-->'
                anchor_match = re.search(anchor_pattern, page, flags=re.I)
                if anchor_match:
                    page = page[:anchor_match.start()] + marker + "\n" + section + "\n" + page[anchor_match.start():]
                else:
                    page = page.replace("</body>", marker + "\n" + section + "\n</body>", 1)
            page = ensure_main_landmark(page)
            path.write_text(page, encoding="utf-8")

def enrich_about():
    T = {
        "en": {
            "cards": [("Store tour", "A short look at the Souviks premises and stocked inventory.", "inventory-part1.mp4"), ("Inside the store", "Shelving and stock arranged for day-to-day parts trade.", "store-interior.jpg"), ("Parts counter", "The working counter used for customer enquiries and part identification.", "store-counter.jpg")],
            "b2b_title": "Built for B2B parts buyers",
            "b2b": ["Commercial-vehicle focus for workshops, retailers, fleet operators and distributors.", "Part-number, vehicle and application based assistance before you buy.", "Pan-India shipping for stocked parts, with dispatch and availability confirmed against the order.", "Catalogue coverage across filters, bearings, clutch parts, brakes, lubricants, electricals, engine parts and related systems."],
            "position_title": "Genuine OEM and aftermarket — clearly distinguished",
            "position": "Souviks lists genuine/OE-specified products where the catalogue identifies them as genuine, and separately lists branded aftermarket products. An aftermarket product is not presented as an OEM part merely because it fits the same application.",
            "service_title": "Buying and distribution support",
            "service": "We help customers identify parts using part numbers, vehicle models, applications and product photographs. Orders can be supplied across India; availability, pricing and compatibility should be confirmed for the specific requirement before dispatch.",
            "faq_title": "Frequently asked questions",
            "faq": [("Can Souviks help identify a part?", "Yes. Send the part number, vehicle details or a clear photograph and the team can help match the requirement against the catalogue."), ("Do you supply genuine and aftermarket parts?", "Yes. The catalogue contains both genuine/OE-specified and branded aftermarket products. They are not represented as the same thing."), ("Where do you ship?", "Souviks serves customers across India. Delivery timing and freight treatment depend on the order and destination.")],
        },
        "hi": {
            "cards": [("स्टोर टूर", "Souviks परिसर और स्टॉक का एक छोटा वीडियो।", "inventory-part1.mp4"), ("स्टोर के अंदर", "दैनिक पार्ट्स ट्रेड के लिए व्यवस्थित स्टॉक और शेल्फ।", "store-interior.jpg"), ("पार्ट्स काउंटर", "ग्राहक पूछताछ और पार्ट पहचान के लिए उपयोग होने वाला काउंटर।", "store-counter.jpg")],
            "b2b_title": "B2B पार्ट्स खरीदारों के लिए बनाया गया",
            "b2b": ["वर्कशॉप, रिटेलर, फ्लीट ऑपरेटर और डिस्ट्रीब्यूटर के लिए कमर्शियल-व्हीकल फोकस।", "खरीद से पहले पार्ट नंबर, वाहन और एप्लिकेशन आधारित सहायता।", "स्टॉक किए गए पार्ट्स के लिए पूरे भारत में शिपिंग।", "फिल्टर, बेयरिंग, क्लच, ब्रेक, लुब्रिकेंट, इलेक्ट्रिकल और इंजन पार्ट्स सहित व्यापक कैटलॉग।"],
            "position_title": "Genuine OEM और aftermarket को स्पष्ट रूप से अलग रखा गया है",
            "position": "जहाँ कैटलॉग किसी उत्पाद को genuine/OE-specified बताता है, वहीं उसे उसी रूप में सूचीबद्ध किया जाता है। ब्रांडेड aftermarket उत्पाद अलग रूप से सूचीबद्ध हैं और उन्हें केवल फिटमेंट के आधार पर OEM नहीं बताया जाता।",
            "service_title": "खरीद और वितरण सहायता",
            "service": "पार्ट नंबर, वाहन मॉडल, एप्लिकेशन और उत्पाद की फोटो के आधार पर पार्ट पहचान में सहायता दी जाती है। पूरे भारत में ऑर्डर सप्लाई किए जा सकते हैं; उपलब्धता, कीमत और compatibility को dispatch से पहले पुष्टि करना चाहिए।",
            "faq_title": "अक्सर पूछे जाने वाले प्रश्न",
            "faq": [("क्या Souviks पार्ट पहचानने में मदद कर सकता है?", "हाँ। पार्ट नंबर, वाहन विवरण या स्पष्ट फोटो भेजें; कैटलॉग में मिलान खोजने में सहायता की जा सकती है।"), ("क्या genuine और aftermarket दोनों पार्ट मिलते हैं?", "हाँ। दोनों प्रकार के उत्पाद अलग-अलग सूचीबद्ध हैं और उन्हें एक ही श्रेणी के रूप में प्रस्तुत नहीं किया जाता।"), ("कहाँ shipping होती है?", "Souviks पूरे भारत में ग्राहकों को सेवा देता है। डिलीवरी समय और freight ऑर्डर व destination पर निर्भर करते हैं।")],
        },
        "bn": {
            "cards": [("স্টোর ট্যুর", "Souviks স্টোর ও স্টকের একটি ছোট ভিডিও।", "inventory-part1.mp4"), ("স্টোরের ভেতরে", "দৈনন্দিন পার্টস ব্যবসার জন্য সাজানো স্টক ও তাক।", "store-interior.jpg"), ("পার্টস কাউন্টার", "গ্রাহকের জিজ্ঞাসা ও পার্ট শনাক্তকরণের জন্য ব্যবহৃত কাউন্টার।", "store-counter.jpg")],
            "b2b_title": "B2B পার্টস ক্রেতাদের জন্য তৈরি",
            "b2b": ["ওয়ার্কশপ, রিটেলার, ফ্লিট অপারেটর ও ডিস্ট্রিবিউটরদের জন্য কমার্শিয়াল-ভেহিকল ফোকাস।", "কেনার আগে পার্ট নম্বর, গাড়ি ও অ্যাপ্লিকেশন অনুযায়ী সহায়তা।", "স্টক থাকা পণ্যের জন্য সারা ভারতে শিপিং।", "ফিল্টার, বিয়ারিং, ক্লাচ, ব্রেক, লুব্রিক্যান্ট, ইলেকট্রিক্যাল ও ইঞ্জিন পার্টসসহ বিস্তৃত ক্যাটালগ।"],
            "position_title": "Genuine OEM ও aftermarket পরিষ্কারভাবে আলাদা",
            "position": "ক্যাটালগে যে পণ্য genuine/OE-specified হিসেবে চিহ্নিত, সেটিকে সেইভাবেই দেখানো হয়। ব্র্যান্ডেড aftermarket পণ্য আলাদা করে তালিকাভুক্ত এবং শুধু একই অ্যাপ্লিকেশনে ব্যবহারযোগ্য বলেই OEM হিসেবে দেখানো হয় না।",
            "service_title": "কেনাকাটা ও ডিস্ট্রিবিউশন সহায়তা",
            "service": "পার্ট নম্বর, গাড়ির মডেল, অ্যাপ্লিকেশন ও পণ্যের ছবি ব্যবহার করে পার্ট শনাক্ত করতে সাহায্য করা হয়। সারা ভারতে অর্ডার সরবরাহ করা যায়; dispatch-এর আগে availability, price ও compatibility নিশ্চিত করা উচিত।",
            "faq_title": "সাধারণ জিজ্ঞাসা",
            "faq": [("Souviks কি পার্ট শনাক্ত করতে সাহায্য করতে পারে?", "হ্যাঁ। পার্ট নম্বর, গাড়ির তথ্য বা পরিষ্কার ছবি পাঠালে ক্যাটালগে মিল খুঁজতে সাহায্য করা যায়।"), ("Genuine ও aftermarket দু ধরনের পার্ট কি পাওয়া যায়?", "হ্যাঁ। দু ধরনের পণ্য আলাদা ভাবে তালিকাভুক্ত এবং একই জিনিস হিসেবে উপস্থাপন করা হয় না।"), ("কোথায় shipping হয়?", "Souviks সারা ভারতের গ্রাহকদের পরিষেবা দেয়। delivery time ও freight অর্ডার এবং গন্তব্যের উপর নির্ভর করে।")],
        },
    }
    for lang in LANGUAGES:
        path = ROOT / lang / "about.html"
        if not path.exists():
            continue
        page = path.read_text(encoding="utf-8")
        t = T[lang]
        start = page.find('<div class="video-grid">')
        end = page.find('</div>\n\n    </div>\n\n</section>', start)
        if start >= 0 and end >= 0:
            cards = ''.join((f'<div class="video-card about-video-card"><video controls preload="metadata" playsinline width="400" height="400"><source src="/assets/images/about/{fn}" type="video/mp4"></video><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>' if fn.lower().endswith(".mp4") else f'<div class="video-card about-photo-card"><img src="/assets/images/about/{fn}" width="400" height="400" loading="lazy" decoding="async" alt="{esc(title)}"><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>') for title, desc, fn in t["cards"])
            page = page[:start] + '<div class="video-grid">' + cards + '</div>' + page[end+len('</div>\n\n    </div>\n\n</section>'):]
        page = page.replace('<span class="video-coming-soon">Video coming soon</span>', '')
        marker = '<!-- ABOUT_TRUST_CONTEXT -->'
        if marker not in page:
            faq = ''.join(f'<details class="entity-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q,a in t["faq"])
            proof = ''.join(f'<div class="why-card"><p>{esc(x)}</p></div>' for x in t["b2b"])
            section = f'''{marker}
<section class="about-trust-context section-spacing">
  <div class="container">
    <div class="section-heading"><h2>{esc(t["b2b_title"])}</h2></div>
    <div class="about-proof-grid">{proof}</div>
    <div class="about-context-columns"><div><h3>{esc(t["position_title"])}</h3><p>{esc(t["position"])}</p></div><div><h3>{esc(t["service_title"])}</h3><p>{esc(t["service"])}</p></div></div>
    <div class="entity-faq"><h3>{esc(t["faq_title"])}</h3>{faq}</div>
  </div>
</section>
'''
            anchor = '<div class="container">\n\n    <div class="cta-wrapper">'
            page = page.replace(anchor, section + '\n' + anchor, 1)
        path.write_text(page, encoding="utf-8")

def main():
    catalogue = json.loads((ROOT / "assets/data/catalogue-index.json").read_text(encoding="utf-8"))
    brands = json.loads((ROOT / "assets/data/brands.json").read_text(encoding="utf-8"))
    categories = json.loads((ROOT / "assets/data/categories.json").read_text(encoding="utf-8"))
    vehicles = json.loads((ROOT / "assets/data/vehicles.json").read_text(encoding="utf-8"))
    enrich_entity_pages("brand", brands, catalogue)
    enrich_entity_pages("category", categories, catalogue)
    enrich_entity_pages("vehicle", vehicles, catalogue)
    (ROOT / "assets/data/brands.json").write_text(json.dumps(brands, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "assets/data/categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "assets/data/vehicles.json").write_text(json.dumps(vehicles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    enrich_about()

if __name__ == "__main__":
    main()
