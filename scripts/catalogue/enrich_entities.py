#!/usr/bin/env python3
"""Enrich static brand, vehicle and category pages from the catalogue master."""

# Entity records are projections of the active catalogue, not hand-maintained counts.
# Regenerate entity pages whenever catalogue mappings change.
# The post-build pass restores entity content after static generation.

from __future__ import annotations

import html
import json
import re
from collections import Counter
from pathlib import Path

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

LABELS = {
    "en": {
        "products": "Products", "categories": "Categories", "vehicles": "Vehicle applications",
        "brands": "Brands", "common": "Common replacement areas", "manufacturer": "Manufacturer",
        "country": "Country", "website": "Manufacturer website", "guidance": "Part identification guidance",
        "guidance_text": "Use the part number, vehicle model and application details when requesting a part. If the number is unclear, send a photo and the vehicle details and Souviks can help identify the closest catalogue match.",
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
    <div class="entity-guidance"><h3>{esc(L["guidance"])}</h3><p>{esc(L["guidance_text"])}</p></div>
    <div class="entity-faq"><h3>{esc(L["faq"])}</h3>{faq_html}</div>
  </div>
</section>
'''

def update_meta(page, description):
    d = esc(description)
    for pattern in (
        r'(<meta\s+name=["\']description["\']\s+content=["\'])[^"\']*(["\'])',
        r'(<meta\s+property=["\']og:description["\']\s+content=["\'])[^"\']*(["\'])',
        r'(<meta\s+name=["\']twitter:description["\']\s+content=["\'])[^"\']*(["\'])',
    ):
        page = re.sub(pattern, lambda m: m.group(1) + d + m.group(2), page, count=1, flags=re.I)
    return page

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
            cats = sorted(set(clean(p.get("category_name") or p.get("category")) for p in products if clean(p.get("category_name") or p.get("category"))))
            item.setdefault("seo", {})
            item["description"] = f'Souviks lists {len(products)} active {clean(item.get("name"))} products across {list_text(cats, 5) or "the commercial-vehicle parts catalogue"}.'
            item["short_description"] = f'{len(products)} active {clean(item.get("name"))} products across {list_text(cats, 5) or "commercial-vehicle parts"}.'
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
            item["description"] = f'Souviks lists {len(products)} active spare parts for {name}, covering {list_text(cats, 5)} and common replacement areas such as {list_text(subs, 5)}.'
            item["short_description"] = f'{len(products)} active spare parts are currently mapped to {name}.'
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
            item["description"] = f'The {clean(item.get("name"))} category contains {len(products)} active commercial-vehicle spare parts, with coverage from brands such as {list_text(sorted(set(brands)), 5)}.'
            item["short_description"] = f'{len(products)} active commercial-vehicle spare parts in {clean(item.get("name"))}.'
            item["seo"]["description"] = item["description"]

        for lang in LANGUAGES:
            path = ROOT / lang / (kind + "s") / f'{clean(item.get("slug"))}.html'
            if not path.exists():
                continue
            page = update_meta(path.read_text(encoding="utf-8"), clean(item.get("description")))
            if kind == "brand":
                selector = r'(<div class="brand-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            elif kind == "vehicle":
                selector = r'(<div class="vehicle-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            else:
                selector = r'(<div class="category-info">\s*<h1>.*?</h1>\s*<p>)[\s\S]*?(</p>)'
            page = re.sub(selector, lambda m: m.group(1) + esc(item.get("description")) + m.group(2), page, count=1, flags=re.I)
            marker = f'<!-- ENTITY_CONTEXT_{kind.upper()} -->'
            if marker not in page:
                section = context_section(kind, item, products, lang)
                anchor = f'<!-- {kind.upper()} PRODUCTS -->' if kind != "vehicle" else "<!-- COMPATIBLE PRODUCTS -->"
                page = page.replace(anchor, marker + "\n" + section + "\n" + anchor, 1) if anchor in page else page.replace("</body>", marker + "\n" + section + "\n</body>", 1)
            path.write_text(page, encoding="utf-8")

def enrich_about():
    T = {
        "en": {
            "cards": [("Store front", "A look at the Souviks storefront and customer-facing counter.", "store-front.jpg"), ("Inside the store", "Shelving and stock arranged for day-to-day parts trade.", "store-interior.jpg"), ("Parts counter", "The working counter used for customer enquiries and part identification.", "store-counter.jpg")],
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
            "cards": [("स्टोर फ्रंट", "Souviks के स्टोर और ग्राहक काउंटर की झलक।", "store-front.jpg"), ("स्टोर के अंदर", "दैनिक पार्ट्स ट्रेड के लिए व्यवस्थित स्टॉक और शेल्फ।", "store-interior.jpg"), ("पार्ट्स काउंटर", "ग्राहक पूछताछ और पार्ट पहचान के लिए उपयोग होने वाला काउंटर।", "store-counter.jpg")],
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
            "cards": [("স্টোরের সামনের অংশ", "Souviks স্টোর ও গ্রাহক কাউন্টারের একটি বাস্তব ছবি।", "store-front.jpg"), ("স্টোরের ভেতরে", "দৈনন্দিন পার্টস ব্যবসার জন্য সাজানো স্টক ও তাক।", "store-interior.jpg"), ("পার্টস কাউন্টার", "গ্রাহকের জিজ্ঞাসা ও পার্ট শনাক্তকরণের জন্য ব্যবহৃত কাউন্টার।", "store-counter.jpg")],
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
            cards = ''.join(f'<div class="video-card about-photo-card"><img src="/assets/images/about/{fn}" width="400" height="400" loading="lazy" decoding="async" alt="{esc(title)}"><h3>{esc(title)}</h3><p>{esc(desc)}</p></div>' for title, desc, fn in t["cards"])
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
