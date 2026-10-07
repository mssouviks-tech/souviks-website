/* Shared core is loaded by the HTML page before this bundle. */

/* Shared core is loaded by the HTML page before this bundle. */

/* ==========================================================
   SOUVIKS — PRODUCT IMAGE ZOOM + BEST-EFFORT PROTECTION
========================================================== */

(function initialiseSouviksImageProtection() {
    "use strict";

    if (window.__SOUVIKS_IMAGE_PROTECTION_BOUND__) {
        return;
    }
    window.__SOUVIKS_IMAGE_PROTECTION_BOUND__ = true;

    const VIEWER_SELECTOR = ".pdp-main-image img";
    const PROTECTED_SELECTOR = [
        ".product-image img",
        ".pdp-main-image img",
        ".pdp-thumbnails img",
        ".souviks-image-zoom-image"
    ].join(", ");

    let layer = null;
    let preview = null;
    let closeButton = null;
    let activeSource = null;

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOriginX = 0;
    let dragOriginY = 0;
    let dragging = false;

    const pointers = new Map();
    let pinchStartDistance = 0;
    let pinchStartScale = 1;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function constrainedPan(x, y) {
        if (!preview || !layer || scale <= 1.02) return { x: 0, y: 0 };

        const baseWidth = preview.offsetWidth || preview.getBoundingClientRect().width;
        const baseHeight = preview.offsetHeight || preview.getBoundingClientRect().height;
        const viewportWidth = layer.clientWidth;
        const viewportHeight = layer.clientHeight;

        const overflowX = Math.max(0, (baseWidth * scale - viewportWidth) / 2);
        const overflowY = Math.max(0, (baseHeight * scale - viewportHeight) / 2);

        return {
            x: clamp(x, -overflowX, overflowX),
            y: clamp(y, -overflowY, overflowY)
        };
    }

    function applyTransform(animate = false) {
        if (!preview) return;

        const constrained = constrainedPan(panX, panY);
        panX = constrained.x;
        panY = constrained.y;

        preview.style.transition = animate
            ? "transform 0.18s ease"
            : "none";

        preview.style.transform =
            `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;

        layer?.classList.toggle("is-zoomed", scale > 1.02);
    }

    function resetTransform() {
        scale = 1;
        panX = 0;
        panY = 0;
        applyTransform(true);
    }

    function setScale(nextScale, animate = false) {
        scale = clamp(nextScale, 1, 4);

        if (scale === 1) {
            panX = 0;
            panY = 0;
        }

        applyTransform(animate);
    }

    function createViewer() {
        if (layer) return;

        layer = document.createElement("div");
        layer.className = "souviks-image-zoom-layer";
        layer.id = "souviksImageZoomLayer";
        layer.setAttribute("aria-hidden", "true");
        layer.setAttribute("role", "dialog");
        layer.setAttribute("aria-modal", "true");

        layer.innerHTML = `
            <h2 id="souviksImageZoomTitle" class="souviks-image-zoom-title" aria-live="polite">Product image preview</h2>
            <button
                type="button"
                class="souviks-image-zoom-close"
                aria-label="Close image preview">×</button>
            <img
                class="souviks-image-zoom-image"
                alt=""
                tabindex="0"
                draggable="false">
        `;

        preview = layer.querySelector(".souviks-image-zoom-image");
        closeButton = layer.querySelector(".souviks-image-zoom-close");

        document.body.appendChild(layer);

        layer.addEventListener("click", event => {
            if (event.target === layer || event.target === closeButton) {
                closeViewer();
            }
        });

        preview.addEventListener("wheel", event => {
            if (!layer.classList.contains("is-visible")) return;

            event.preventDefault();

            const direction = event.deltaY < 0 ? 1 : -1;
            const factor = direction > 0 ? 1.18 : 0.85;

            setScale(scale * factor, false);
        }, { passive: false });

        preview.addEventListener("dblclick", event => {
            event.preventDefault();
            setScale(scale > 1.02 ? 1 : 2.5, true);
        });

        preview.addEventListener("pointerdown", event => {
            if (!layer.classList.contains("is-visible")) return;

            pointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY
            });

            preview.setPointerCapture?.(event.pointerId);

            if (pointers.size === 1 && scale > 1.02) {
                dragging = true;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                dragOriginX = panX;
                dragOriginY = panY;
            }

            if (pointers.size === 2) {
                dragging = false;
                const [a, b] = [...pointers.values()];
                pinchStartDistance = Math.hypot(
                    b.x - a.x,
                    b.y - a.y
                );
                pinchStartScale = scale;
            }
        });

        preview.addEventListener("pointermove", event => {
            if (!pointers.has(event.pointerId)) return;

            pointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY
            });

            if (pointers.size === 2 && pinchStartDistance > 0) {
                const [a, b] = [...pointers.values()];
                const currentDistance = Math.hypot(
                    b.x - a.x,
                    b.y - a.y
                );

                if (currentDistance > 0) {
                    setScale(
                        pinchStartScale *
                        (currentDistance / pinchStartDistance),
                        false
                    );
                }
                return;
            }

            if (dragging && scale > 1.02) {
                panX = dragOriginX + (event.clientX - dragStartX);
                panY = dragOriginY + (event.clientY - dragStartY);
                applyTransform(false);
            }
        });

        const endPointer = event => {
            pointers.delete(event.pointerId);

            if (pointers.size < 2) {
                pinchStartDistance = 0;
            }

            if (pointers.size === 0) {
                dragging = false;
            }
        };

        preview.addEventListener("pointerup", endPointer);
        preview.addEventListener("pointercancel", endPointer);
        preview.addEventListener("pointerleave", event => {
            if (!event.buttons) endPointer(event);
        });
    }

    function openViewer(img) {
        if (!img || !img.currentSrc && !img.src) return;

        createViewer();

        const source = img.currentSrc || img.src;
        if (!source) return;

        preview.src = source;
        preview.alt = img.alt || "Product image";
        const title = layer.querySelector("#souviksImageZoomTitle");
        if (title) title.textContent = img.alt ? `${img.alt} preview` : "Product image preview";

        activeSource = img;
        resetTransform();
        layer.setAttribute("aria-labelledby", "souviksImageZoomTitle");

        layer.classList.add("is-visible");
        layer.setAttribute("aria-hidden", "false");
        document.body.classList.add("souviks-image-viewer-open");

        closeButton?.focus({ preventScroll: true });
    }

    function closeViewer() {
        if (!layer) return;

        layer.classList.remove("is-visible", "is-zoomed");
        layer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("souviks-image-viewer-open");

        pointers.clear();
        dragging = false;
        pinchStartDistance = 0;

        if (preview) {
            preview.removeAttribute("src");
            preview.alt = "";
            preview.style.transform = "";
        }

        const returnTarget = activeSource;
        activeSource = null;
        returnTarget?.focus?.({ preventScroll: true });
    }

    function isProtectedImage(target) {
        return target instanceof Element &&
            !!target.closest(PROTECTED_SELECTOR);
    }

    // Product assets can fail independently of the product record being valid
    // (for example a stale CDN edge or a legacy filename). Replace the failed
    // request immediately with the known-good global placeholder and remove
    // responsive URL attributes so no second broken request is attempted.
    document.addEventListener("error", event => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement)) return;
        if (!image.closest(".product-image, .pdp-main-image, .pdp-thumbnails")) return;

        const placeholder = "/assets/images/placeholder.webp";
        if (image.dataset.souviksImageFallback === "done") return;

        image.dataset.souviksImageFallback = "done";
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");

        // Hide the failed element while the known-good placeholder loads so
        // the browser cannot leave its native broken-image glyph visible.
        image.style.visibility = "hidden";
        const revealFallback = () => {
            image.style.visibility = "visible";
            image.hidden = false;
        };

        image.addEventListener("load", revealFallback, { once: true });

        if (image.getAttribute("src") !== placeholder) {
            image.src = placeholder;
            return;
        }

        // Even the placeholder must not leave a native broken-image glyph.
        image.hidden = true;
    }, true);

    // Use capture-phase delegation so later catalogue/PDP handlers cannot
    // swallow the click before the viewer sees it.
    document.addEventListener("click", event => {
        const img = event.target instanceof Element
            ? event.target.closest(VIEWER_SELECTOR)
            : null;

        if (!img || !img.complete || !img.naturalWidth) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        openViewer(img);
    }, true);

    document.addEventListener("keydown", event => {
        if (!layer?.classList.contains("is-visible")) {
            return;
        }

        if (event.key === "Tab") {
            const focusable = [closeButton, preview].filter(Boolean);
            if (focusable.length) {
                const current = document.activeElement;
                const index = focusable.indexOf(current);
                if (event.shiftKey) {
                    event.preventDefault();
                    focusable[index <= 0 ? focusable.length - 1 : index - 1].focus({ preventScroll: true });
                } else {
                    event.preventDefault();
                    focusable[index >= focusable.length - 1 ? 0 : index + 1].focus({ preventScroll: true });
                }
            }
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closeViewer();
            return;
        }

        if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            setScale(scale + 0.25, true);
            return;
        }

        if (event.key === "-" || event.key === "_") {
            event.preventDefault();
            setScale(scale - 0.25, true);
            return;
        }

        if (event.key === "0") {
            event.preventDefault();
            setScale(1, true);
        }
    });

    /*
     * Best-effort casual-download deterrence.
     * A browser must receive the image bytes in order to display them, so this
     * cannot prevent screenshots, DevTools, network retrieval, or other capture.
     */
    document.addEventListener("contextmenu", event => {
        if (isProtectedImage(event.target)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);

    document.addEventListener("dragstart", event => {
        if (isProtectedImage(event.target)) {
            event.preventDefault();
        }
    }, true);

    // Prevent accidental selection/copy gestures on the viewer itself.
    document.addEventListener("selectstart", event => {
        if (isProtectedImage(event.target)) {
            event.preventDefault();
        }
    }, true);
})();


/* ===== search-engine.js ===== */
/*
==========================================================
SOUVIKS WEBSITE
SMART SEARCH ENGINE
Version : 2.0
==========================================================

Features:
- Part-number punctuation tolerance
- Hindi / Bengali query expansion
- Automotive synonyms and common search variants
- Lightweight typo tolerance
- Generic text matching for directory pages
- Product-record filtering for catalogue pages
==========================================================
*/

(function () {

    "use strict";

    const TYPE_BONUS = {
        product: 10,
        category: 100,
        brand: 200,
        vehicle: 300
    };

    const INDIC_DIGIT_MAP = {
        "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
        "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
        "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
        "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9"
    };

    // Local query expansion. This deliberately stays in the browser so
    // Hindi/Bengali search does not require an external translation API.
    const QUERY_ALIASES = [
        ["air filter", ["air filter", "एयर फ़िल्टर", "एयर फिल्टर", "এয়ার ফিল্টার", "এয়ার ফিল্টার"]],
        ["fuel filter", ["fuel filter", "fuel फ़िल्टर", "फ्यूल फ़िल्टर", "फ्यूल फिल्टर", "ফুয়েল ফিল্টার", "ফুয়েল ফিল্টার"]],
        ["oil filter", ["oil filter", "ऑयल फ़िल्टर", "ऑयल फिल्टर", "তেল ফিল্টার"]],
        ["brake lining", ["brake lining", "ब्रेक लाइनिंग", "ब्रेक लाइनिंग्स", "ব্রেক লাইনিং", "ব্রেক লাইনিংস"]],
        ["brake pad", ["brake pad", "ब्रेक पैड", "ब्रेक पॅड", "ব্রেক প্যাড"]],
        ["release bearing", ["release bearing", "क्लच रिलीज़ बेयरिंग", "क्लच रिलीज बेयरिंग", "রিলিজ বেয়ারিং", "রিলিজ বিয়ারিং"]],
        ["clutch plate", ["clutch plate", "clutch disc", "क्लच प्लेट", "ক্লাচ প্লেট"]],
        ["clutch cover", ["clutch cover", "क्लच कवर", "ক্লাচ কভার"]],
        ["water pump", ["water pump", "वॉटर पंप", "वाटर पंप", "ওয়াটার পাম্প", "ওয়াটার পাম্প"]],
        ["universal joint", ["universal joint", "uj cross", "यूनिवर्सल जॉइंट", "यूनिवर्सल जॉइंट क्रॉस", "ইউনিভার্সাল জয়েন্ট", "ইউনিভার্সাল জয়েন্ট"]],
        ["center support bearing", ["center support bearing", "centre support bearing", "center bearing", "सेंटर सपोर्ट बेयरिंग", "সেন্টার সাপোর্ট বেয়ারিং", "সেন্টার সাপোর্ট বিয়ারিং"]],
        ["torque rod bush", ["torque rod bush", "torque rod bushes", "टॉर्क रॉड बुश", "টর্ক রড বুশ"]],
        ["tail lamp", ["tail lamp", "tail light", "टेल लैंप", "टेल लैम्प", "পিছনের ল্যাম্প", "টেল ল্যাম্প"]],
        ["head lamp", ["head lamp", "head light", "हेड लैंप", "হেড ল্যাম্প"]],
        ["flywheel", ["flywheel", "फ्लाईव्हील", "फ्लाई व्हील", "ফ্লাইহুইল", "ফ্লাই হুইল"]],
        ["propeller shaft", ["propeller shaft", "propshaft", "प्रोपेलर शाफ्ट", "প্রপেলার শ্যাফ্ট"]],
        ["starter motor", ["starter motor", "starter", "स्टार्टर मोटर", "স্টার্টার মোটর"]],
        ["alternator", ["alternator", "अल्टरनेटर", "অল্টারনেটর"]],
        ["radiator", ["radiator", "रेडिएटर", "রেডিয়েটর", "রেডিয়েটর"]],
        ["fan belt", ["fan belt", "fan belt", "फैन बेल्ट", "ফ্যান বেল্ট"]],
        ["wheel bearing", ["wheel bearing", "व्हील बेयरिंग", "व्हील बियरिंग", "হুইল বেয়ারিং", "হুইল বিয়ারিং"]],
        ["oil seal", ["oil seal", "ऑयल सील", "অয়েল সিল", "অয়েল সিল"]],
        ["king pin", ["king pin", "किंग पिन", "কিং পিন"]],
        ["leaf spring", ["leaf spring", "leaf springs", "लीफ स्प्रिंग", "लीफ स्प्रिंग्स", "লিফ স্প্রিং", "লিফ স্প্রিংস"]],
        ["shock absorber", ["shock absorber", "शॉक एब्जॉर्बर", "শক অ্যাবজর্বার"]],
        ["air brake", ["air brake", "एयर ब्रेक", "এয়ার ব্রেক", "এয়ার ব্রেক"]],
        ["brake chamber", ["brake chamber", "ब्रेक चैंबर", "ब्रेक चैम्बर", "ব্রেক চেম্বার"]],
        ["slack adjuster", ["slack adjuster", "स्लैक एडजस्टर", "স্ল্যাক অ্যাডজাস্টার"]],
        ["clutch", ["clutch", "क्लच", "ক্লাচ"]],
        ["brake", ["brake", "ब्रेक", "ব্রেক"]],
        ["filter", ["filter", "फ़िल्टर", "फिल्टर", "ফিল্টার", "ফিল্টার"]],
        ["bearing", ["bearing", "बेयरिंग", "बियरिंग", "বেয়ারিং", "বিয়ারিং"]],
        ["lubricant", ["lubricant", "लुब्रिकेंट", "লুব্রিকেন্ট", "oil", "तेल", "তেল"]],
        ["truck", ["truck", "ट्रक", "ট্রাক"]],
        ["bus", ["bus", "बस", "বাস"]],
        ["tractor", ["tractor", "ट्रैक्टर", "ট্রাক্টর"]],
        ["spare part", ["spare part", "spare parts", "स्पेयर पार्ट", "स्पेयर पार्ट्स", "स्पেয়ার পার্ট", "স্পেয়ার পার্টস", "স্পেয়ার পার্ট", "স্পেয়ার পার্টস"]],
        ["tata", ["tata", "टाटा", "তাতা", "টাটা"]],
        ["ashok leyland", ["ashok leyland", "अशोक लेलैंड", "अशोक लीलैंड", "অশোক লেল্যান্ড"]],
        ["eicher", ["eicher", "आयशर", "আইশার"]],
        ["bharatbenz", ["bharatbenz", "भारतबेंज़", "भारतबेंज", "ভারত বেঞ্জ"]],
        ["mahindra", ["mahindra", "महिंद्रा", "মাহিন্দ্রা"]],
        ["force motors", ["force motors", "फोर्स मोटर्स", "ফোর্স মোটরস"]],
        ["bosch", ["bosch", "बॉश", "बॉश", "বশ"]],
        ["skf", ["skf", "एसकेएफ", "এসকেএফ"]],
        ["timken", ["timken", "टिमकेन", "টিমকেন"]],
        ["setco", ["setco", "सेटको", "সেটকো"]],
        ["wabco", ["wabco", "वैबको", "ওয়াবকো", "ওয়াবকো"]],
        ["knorr bremse", ["knorr bremse", "नॉर ब्रेम्से", "নর ব্রেমসে"]]
    ];

    const PRODUCT_INTENT_TERMS = new Set([
        "clutch", "brake", "filter", "bearing", "lubricant",
        "air filter", "fuel filter", "oil filter", "brake lining",
        "brake pad", "release bearing", "clutch plate", "clutch cover",
        "water pump", "universal joint", "center support bearing",
        "torque rod bush", "tail lamp", "head lamp", "flywheel",
        "propeller shaft", "starter motor", "alternator", "radiator",
        "fan belt", "wheel bearing", "oil seal", "king pin",
        "leaf spring", "shock absorber", "air brake", "brake chamber",
        "slack adjuster", "spare part"
    ]);

    const STOP_WORDS = new Set([
        "the", "a", "an", "for", "with", "in", "on", "of", "and",
        "के", "का", "की", "को", "से", "में", "और", "लिए", "का",
        "এর", "এবং", "ও", "তে", "জন্য", "দিয়ে", "দিয়ে", "সাথে", "এর জন্য",
        "का लिए"
    ]);

    function normalise(value) {
        return String(value ?? "")
            .normalize("NFKC")
            .replace(/[०-९০-৯]/g, char => INDIC_DIGIT_MAP[char] || char)
            .trim()
            .toLocaleLowerCase();
    }

    // Part numbers are commonly entered with spaces, hyphens or slashes.
    const compact = value =>
        normalise(value).replace(/[^a-z0-9]+/g, "");

    const escapeRegExp = value =>
        String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    function searchableText(value) {
        return normalise(value);
    }

    function unique(values) {
        return [...new Set(values.filter(Boolean))];
    }

    function expandQuery(query) {
        const original = normalise(query);
        if (!original) return [];

        const variants = [original];
        let translated = original;

        // Long phrases first so "clutch plate" is expanded before "clutch".
        const aliases = QUERY_ALIASES
            .flatMap(([canonical, terms]) => terms.map(term => ({ canonical, term: normalise(term) })))
            .sort((a, b) => b.term.length - a.term.length);

        aliases.forEach(({ canonical, term }) => {
            if (!term || term === canonical) return;
            const pattern = new RegExp(`(^|\\s)${escapeRegExp(term)}(?=$|\\s)`, "giu");
            translated = translated.replace(pattern, `$1${canonical}`);
        });

        if (translated !== original) variants.push(translated.trim());

        // Also support query fragments where punctuation joins terms.
        const compactQuery = compact(original);
        aliases.forEach(({ canonical, term }) => {
            if (!term) return;
            if (compact(term) && compactQuery.includes(compact(term))) {
                variants.push(canonical);
            }
        });

        return unique(variants);
    }

    function tokenize(value) {
        return unique(
            normalise(value)
                .split(/[^a-z0-9\u0900-\u097F\u0980-\u09FF]+/u)
                .filter(token => token.length >= 2)
        );
    }

    function meaningfulTokens(value) {
        return tokenize(value).filter(token => !STOP_WORDS.has(token));
    }

    function tokenOverlapScore(query, text) {
        const queryTokens = meaningfulTokens(query);
        const textTokens = meaningfulTokens(text);
        if (!queryTokens.length || !textTokens.length) return 0;

        let matched = 0;
        queryTokens.forEach(token => {
            if (textTokens.some(candidate => candidate === token || candidate.includes(token) || token.includes(candidate))) {
                matched += 1;
            }
        });

        return matched / queryTokens.length;
    }

    function editDistanceAtMost(a, b, maxDistance = 1) {
        if (a === b) return 0;
        if (!a || !b) return Infinity;
        if (Math.abs(a.length - b.length) > maxDistance) return Infinity;

        const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
        const curr = new Array(b.length + 1).fill(0);

        for (let i = 1; i <= a.length; i++) {
            curr[0] = i;
            let rowMin = curr[0];
            for (let j = 1; j <= b.length; j++) {
                curr[j] = Math.min(
                    curr[j - 1] + 1,
                    prev[j] + 1,
                    prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
                rowMin = Math.min(rowMin, curr[j]);
            }
            if (rowMin > maxDistance) return Infinity;
            for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
        }
        return curr[b.length];
    }

    function fuzzyTokenScore(query, text) {
        const queryTokens = tokenize(query).filter(token => token.length >= 4);
        if (!queryTokens.length) return 0;

        const textTokens = tokenize(text);
        if (!textTokens.length) return 0;

        let total = 0;
        for (const qToken of queryTokens) {
            let matched = false;
            for (const token of textTokens) {
                if (token.includes(qToken) || qToken.includes(token)) {
                    total += 1;
                    matched = true;
                    break;
                }
                const allowed = qToken.length >= 8 ? 2 : 1;
                if (editDistanceAtMost(qToken, token, allowed) <= allowed) {
                    total += 1;
                    matched = true;
                    break;
                }
            }
            if (!matched) continue;
        }

        return queryTokens.length ? total / queryTokens.length : 0;
    }

    function hasProductIntent(query) {
        return expandQuery(query).some(variant => {
            const normalized = normalise(variant);
            return [...PRODUCT_INTENT_TERMS].some(term =>
                normalized === term || normalized.includes(`${term} `) || normalized.includes(` ${term}`)
            );
        });
    }

    function productIntentScore(item, query) {
        const variants = expandQuery(query);
        const normalizedQuery = variants.join(" ");
        const intentTerms = [...PRODUCT_INTENT_TERMS].filter(term =>
            normalizedQuery === term ||
            normalizedQuery.includes(`${term} `) ||
            normalizedQuery.includes(` ${term}`)
        );
        if (!intentTerms.length) return 0;

        const text = searchableText([
            item?.title,
            item?.subtitle,
            item?.keywords,
            item?.description,
            item?.applications,
            item?.category?.name,
            item?.brand?.name
        ].flat().filter(Boolean).join(" "));

        let score = 0;
        intentTerms.forEach(term => {
            if (text.includes(term)) score += term.includes(" ") ? 520 : 340;
        });
        return score;
    }

    function scoreItemForQuery(item, query) {
        const needle = normalise(query);
        if (!needle) return 0;

        const title = searchableText(item.title);
        const subtitle = searchableText(item.subtitle);
        const partNumber = searchableText(item.part_number);
        const compactNeedle = compact(needle);
        const compactPartNumber = compact(item.part_number);
        const references = searchableText([
            ...(Array.isArray(item.manufacturer_part_numbers) ? item.manufacturer_part_numbers : []),
            ...(item.manufacturer_part_number ? [item.manufacturer_part_number] : []),
            ...(Array.isArray(item.alternate_part_numbers) ? item.alternate_part_numbers : []),
            ...(Array.isArray(item.oem_numbers) ? item.oem_numbers : []),
            ...(Array.isArray(item.cross_references) ? item.cross_references : [])
        ].join(" "));
        const compactReferences = compact(references);
        const keywords = searchableText(Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords);
        const description = searchableText(item.description);
        const applications = searchableText(Array.isArray(item.applications) ? item.applications.join(" ") : item.applications);
        const vehicles = searchableText(Array.isArray(item.vehicles) ? item.vehicles.join(" ") : item.vehicles);

        let score = 0;

        if (partNumber && partNumber === needle) score += 1000;
        else if (compactPartNumber && compactPartNumber === compactNeedle && compactNeedle) score += 950;
        else if (partNumber && partNumber.includes(needle)) score += 700;
        else if (compactPartNumber && compactNeedle && compactPartNumber.includes(compactNeedle)) score += 650;

        if (references.includes(needle)) score += 650;
        else if (compactReferences && compactNeedle && compactReferences.includes(compactNeedle)) score += 600;

        if (title === needle) score += 900;
        else if (title.startsWith(needle)) score += 600;
        else if (title.includes(needle)) score += 350;

        if (subtitle.includes(needle)) score += 150;
        if (keywords.includes(needle)) score += 120;
        if (description.includes(needle)) score += 80;
        if (applications.includes(needle)) score += 70;
        if (vehicles.includes(needle)) score += 70;

        const fuzzyText = [title, subtitle, keywords, description, applications, vehicles].join(" ");
        const fuzzy = fuzzyTokenScore(needle, fuzzyText);
        if (fuzzy >= 1) score += 55 * fuzzy;

        const tokenOverlap = tokenOverlapScore(needle, fuzzyText);
        if (tokenOverlap > 0) {
            score += 85 * tokenOverlap;
            if (tokenOverlap >= 1) score += 120;
        }

        // Type bonus is only a ranking bonus; it must never turn an unrelated
        // record into a match by itself.
        if (score > 0) {
            score += TYPE_BONUS[normalise(item.type)] || 0;
        }
        return score;
    }

    function scoreItem(item, query) {
        const variants = expandQuery(query);
        if (!variants.length) return 0;

        let best = 0;
        variants.forEach((variant, index) => {
            const score = scoreItemForQuery(item, variant);
            const adjusted = index === 0 ? score : (score > 0 ? Math.max(1, score - 5) : 0);
            best = Math.max(best, adjusted);
        });
        return best;
    }

    function trackSearch(query, resultCount, source = "search") {
        const payload = {
            query: String(query || "").trim().slice(0, 160),
            resultCount: Number(resultCount) || 0,
            source: String(source || "search"),
            timestamp: new Date().toISOString()
        };

        try {
            window.dispatchEvent(new CustomEvent("souviks:search", { detail: payload }));
        } catch (error) {
            // CustomEvent may be unavailable in older embedded browsers.
        }

        if (typeof window.gtag === "function" && payload.query) {
            try {
                window.gtag("event", "search", {
                    search_term: payload.query,
                    results_count: payload.resultCount,
                    search_source: payload.source
                });
            } catch (error) {
                // Analytics must never interfere with search.
            }
        }
    }

    function search(records, query, limit = 20) {
        const max = Math.min(Math.max(Number(limit) || 20, 1), 100);

        const productIntent = hasProductIntent(query);

        return (Array.isArray(records) ? records : [])
            .map((item, index) => {
                let score = scoreItem(item, query);
                const type = normalise(item?.type);
                if (productIntent) {
                    if (type === "product") score += 420 + productIntentScore(item, query);
                    else if (type === "category") score += 90;
                }
                return { item, index, score };
            })
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, max)
            .map(entry => ({ ...entry.item, score: entry.score }));
    }

    function matchesText(text, query) {
        return scoreItem({
            type: "directory",
            title: text,
            subtitle: "",
            part_number: "",
            keywords: [text],
            description: text
        }, query) > 0;
    }

    function productSearchRecord(product) {
        return {
            ...product,
            type: "product",
            title: product?.product_name || product?.name || "",
            subtitle: product?.brand_name || product?.brand || "",
            part_number: product?.part_number || product?.partNumber || "",
            keywords: product?.keywords || [product?.brand_name, product?.category_name, product?.subcategory_name].filter(Boolean),
            description: product?.short_description || product?.description || ""
        };
    }

    function filterProducts(records, query) {
        const needle = normalise(query);
        if (!needle) return Array.isArray(records) ? records : [];

        return (Array.isArray(records) ? records : [])
            .map((product, index) => ({ product, index, score: scoreItem(productSearchRecord(product), needle) }))
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .map(entry => entry.product);
    }

    const QUICK_SUGGESTIONS = [
        "clutch", "clutch plate", "clutch cover", "release bearing",
        "brake", "brake lining", "brake pad", "air brake", "brake chamber",
        "filter", "air filter", "fuel filter", "oil filter",
        "bearing", "wheel bearing", "center support bearing",
        "water pump", "tail lamp", "head lamp", "flywheel",
        "propeller shaft", "starter motor", "alternator", "radiator",
        "torque rod bush", "universal joint", "king pin", "leaf spring",
        "shock absorber", "fan belt", "oil seal", "spare parts"
    ];

    function suggestionDistance(query, candidate) {
        const qTokens = meaningfulTokens(query);
        const cTokens = meaningfulTokens(candidate);
        if (!qTokens.length || !cTokens.length) return Infinity;

        let total = 0;
        let pairs = 0;
        qTokens.forEach(q => {
            let best = Infinity;
            cTokens.forEach(c => {
                if (q === c) best = 0;
                else if (c.includes(q) || q.includes(c)) best = Math.min(best, Math.abs(c.length - q.length));
                else if (Math.min(q.length, c.length) >= 4) best = Math.min(best, editDistanceAtMost(q, c, 2));
            });
            if (best !== Infinity) { total += best; pairs += 1; }
        });
        return pairs ? total / pairs + Math.max(0, cTokens.length - qTokens.length) * 0.25 : Infinity;
    }

    function suggestQueries(query, records = [], limit = 5) {
        const needle = normalise(query);
        if (!needle) return QUICK_SUGGESTIONS.slice(0, limit);
        const queryVariants = expandQuery(needle);

        const candidates = new Map();
        const add = value => {
            const text = String(value || "").trim();
            const key = compact(text);
            if (text && key && !candidates.has(key)) candidates.set(key, text);
        };

        QUICK_SUGGESTIONS.forEach(add);
        QUERY_ALIASES.forEach(([canonical]) => add(canonical));

        (Array.isArray(records) ? records : []).slice(0, 1200).forEach(item => {
            add(item?.part_number);
            add(item?.product_name || item?.name);
            add(item?.title);
            add(item?.brand_name);
            add(item?.category_name);
            add(item?.brand?.name);
            add(item?.category?.name);
        });

        return [...candidates.values()]
            .map((candidate, index) => {
                const candidateNormal = normalise(candidate);
                const distances = queryVariants.map(variant => suggestionDistance(variant, candidate));
                const exact = queryVariants.some(variant => normalise(variant) === candidateNormal) ? 0 : 1;
                return { candidate, distance: Math.min(...distances), index, exact };
            })
            .filter(entry => Number.isFinite(entry.distance))
            .sort((a, b) => a.exact - b.exact || a.distance - b.distance || a.index - b.index)
            .map(entry => entry.candidate)
            .slice(0, Math.min(Math.max(Number(limit) || 5, 1), 8));
    }

    window.SouviksSearchEngine = {
        normalise,
        compact,
        expandQuery,
        scoreItem,
        search,
        matchesText,
        filterProducts,
        suggestQueries,
        trackSearch
    };

})();


/* ===== voice-search.js ===== */
/* Souviks — browser-native voice search */
(function () {
    "use strict";

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function localeLanguage() {
        const lang = String(document.documentElement.lang || navigator.language || "en-IN").toLowerCase();
        if (lang.startsWith("bn")) return "bn-IN";
        if (lang.startsWith("hi")) return "hi-IN";
        return "en-IN";
    }

    function initVoiceSearch() {
        const input = document.getElementById("searchInput");
        const button = document.getElementById("voiceSearch");
        if (!input || !button || !SpeechRecognition) return;

        button.hidden = false;
        input.classList.add("has-voice-search");

        let recognition = null;
        let listening = false;

        const submitSearch = () => {
            const query = String(input.value || "").trim();
            if (!query) {
                input.focus();
                return;
            }

            if (document.body.classList.contains("products-page")) {
                input.dispatchEvent(new Event("input", { bubbles: true }));
                return;
            }

            if (document.body.classList.contains("index-page")) return;

            const lang = window.souviks?.currentLanguage || document.documentElement.lang || "en";
            const url = new URL(`/${lang}/products`, window.location.origin);
            url.searchParams.set("q", query);
            window.location.assign(url.pathname + url.search);
        };

        document.getElementById("searchButton")?.addEventListener("click", submitSearch);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !document.body.classList.contains("index-page")) {
                event.preventDefault();
                submitSearch();
            }
        });

        const setState = active => {
            listening = active;
            button.classList.toggle("is-listening", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
            button.setAttribute("title", active ? "Listening…" : "Voice search");
            button.setAttribute("aria-label", active ? "Listening for your search" : "Voice search");
        };

        const start = () => {
            if (listening) {
                recognition?.stop();
                return;
            }

            recognition = new SpeechRecognition();
            recognition.lang = localeLanguage();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setState(true);
            recognition.onresult = event => {
                const transcript = Array.from(event.results || [])
                    .map(result => result?.[0]?.transcript || "")
                    .join(" ")
                    .trim();
                if (!transcript) return;
                input.value = transcript;
                input.dispatchEvent(new Event("input", { bubbles: true }));
            };
            recognition.onerror = event => {
                setState(false);
                if (event?.error === "not-allowed") {
                    button.title = "Microphone permission is blocked";
                }
            };
            recognition.onend = () => setState(false);

            try {
                recognition.start();
            } catch (error) {
                setState(false);
            }
        };

        button.addEventListener("click", start);
    }

    window.SouviksVoiceSearch = { init: initVoiceSearch };

    document.addEventListener("DOMContentLoaded", initVoiceSearch);
})();


/* ===== pages/index.js ===== */
document.addEventListener(
    "DOMContentLoaded",
    () => {
        bindSearchEvents();
    }
);


function ensureSearchIndex() {
    if (Array.isArray(SEARCH_INDEX) && SEARCH_INDEX.length) return Promise.resolve(SEARCH_INDEX);
    if (!SEARCH_INDEX_PROMISE) {
        SEARCH_INDEX_PROMISE = fetch("/assets/data/search.json", {
            headers: { Accept: "application/json" },
            cache: "no-store",
            credentials: "same-origin"
        })
            .then(response => response.ok ? response.json() : [])
            .then(data => { SEARCH_INDEX = Array.isArray(data) ? data : []; return SEARCH_INDEX; })
            .catch(error => { console.warn("Souviks search index unavailable:", error); SEARCH_INDEX = []; return SEARCH_INDEX; });
    }
    return SEARCH_INDEX_PROMISE;
}

function searchCatalog(query) {

    if (!query) {
        return [];
    }

    if (
        window.SouviksSearchEngine &&
        typeof SouviksSearchEngine.search ===
            "function"
    ) {
        return SouviksSearchEngine.search(
            SEARCH_INDEX,
            query,
            8
        );
    }

    return SEARCH_INDEX
        .filter(item =>
            String(item.title || "")
                .toLowerCase()
                .includes(
                    String(query)
                        .trim()
                        .toLowerCase()
                )
        )
        .slice(0, 8);
}

function bindSearchEvents() {

    const input =
        document.querySelector(
            "#searchInput"
        );

    const results =
        document.querySelector(
            "#searchResults"
        );
const searchButton =
    document.querySelector(
        "#searchButton"
    );
const goToCatalogue = () => {
    const query = String(input?.value || "").trim();
    if (!query) {
        input?.focus();
        return;
    }

    const url = new URL(`/${LANG}/products`, window.location.origin);
    url.searchParams.set("q", query);
    window.location.assign(url.pathname + url.search);
};

searchButton?.addEventListener("click", goToCatalogue);

input?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        goToCatalogue();
    }
});
document.addEventListener(
    "click",
    event => {

        if(

            !event.target.closest(
                ".search-wrapper"
            )

        ){

            results.classList.remove(
                "active"
            );

        }

    }
);

    if (!input || !results) {

        return;

    }

    let searchRequest = 0;
    let searchTimer = null;
    input.addEventListener("input", event => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
        const query = String(event.target.value || "").trim();
        if (!query) {
            renderSearchResults([], results);
            return;
        }
        const requestId = ++searchRequest;
        await ensureSearchIndex();
        if (requestId !== searchRequest) return;
        const matches = searchCatalog(query);
        renderSearchResults(matches, results);
        window.SouviksSearchEngine?.trackSearch?.(query, matches.length, "homepage-autocomplete");
        }, 90);
    });

}


function getSearchUrl(item) {

    switch(item.type?.toLowerCase()) {

        case "product":
            return `/${LANG}/products/${item.slug}`;

        case "brand":
            return `/${LANG}/brands/${item.slug}`;

        case "category":
            return `/${LANG}/categories/${item.slug}`;

        case "vehicle":
            return `/${LANG}/vehicles/${item.slug}`;

        default:
            return item.url;
    }

}


function renderSearchResults(
    matches,
    container
) {

    if (!matches.length) {

        container.innerHTML = "";

        container.classList.remove(
            "active"
        );

        return;

    }

    container.innerHTML =

        matches.map(item => `

            <a
                href="${getSearchUrl(item)}"
                class="search-result">

                <div class="search-type">

                    ${item.type}

                </div>

                <div class="search-label">

                    ${item.title}

                </div>

                <div class="search-subtitle">

                    ${item.subtitle || ""}

                </div>

            </a>

        `).join("");

    container.classList.add(
        "active"
    );

}

let SEARCH_INDEX = [];
let SEARCH_INDEX_PROMISE = null;


/* ===== Souviks — refresh static product-card images from canonical catalogue ===== */
(() => {
    const run = async () => {
        const cards = Array.from(document.querySelectorAll(".product-card"));
        if (!cards.length) return;

        try {
            const response = await fetch("/assets/data/catalogue-index.json", {
                headers: { Accept: "application/json" },
                cache: "no-store",
                credentials: "same-origin"
            });
            if (!response.ok) return;

            const catalogue = await response.json();
            if (!Array.isArray(catalogue)) return;

            const byId = new Map(
                catalogue
                    .filter(item => item && item.id)
                    .map(item => [String(item.id), item])
            );

            cards.forEach(card => {
                const button = card.querySelector("[data-saved-product-id], .add-to-cart[data-id]");
                const id = String(
                    button?.dataset.savedProductId ||
                    button?.dataset.id ||
                    ""
                ).trim();
                if (!id) return;

                const product = byId.get(id);
                const image = String(product?.image_url || "").trim();
                if (!product || !image || image.endsWith("/placeholder.webp")) return;

                const img = card.querySelector(".product-image-file, .product-image img");
                if (!img || img.src.endsWith(image)) return;

                img.src = image;
                img.removeAttribute("srcset");
                img.removeAttribute("sizes");
                img.alt = String(product.product_name || product.name || img.alt || "Product");
            });
        } catch (error) {
            console.warn("[Souviks] Static product image refresh unavailable:", error);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
        void run();
    }
})();
