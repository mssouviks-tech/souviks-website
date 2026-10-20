/// <reference path="../types/catalogue.js" />
/* products.js module extracted from legacy section: products.js */

/*
==========================================================
SOUVIKS WEBSITE
PRODUCTS MODULE
Version : 1.0
==========================================================
*/

class ProductManager {

constructor() {

    this.products = [];
    this.filtered = [];

    this.container = null;

    this.currentPage = 1;

    this.pageSize = 20;

}
    // ======================================================
    // INIT
    // ======================================================

    async init(

        selector = "#product-grid",
        source = "products"

    ) {

        this.container = Utils.el(

            selector

        );

        if (!this.container) {

            return;

        }

        const sourceProducts = source === "catalogue-index"
            ? await API.catalogueIndex()
            : await API.products();

        // Inactive master records are not customer-facing catalogue data.
        // Filter them at the runtime boundary so search, facets, sorting and
        // pagination can never expose a retired product.
        this.products = (Array.isArray(sourceProducts) ? sourceProducts : [])
            .filter(product => product && product.active !== false);

        this.filtered = [

            ...this.products

        ];

        // Keep builder-generated product cards in the initial HTML.
        // JavaScript continues to render after filtering, sorting,
        // pagination, or other user interaction.
        if (
            this.container.dataset.staticRendered !==
            "true"
        ) {
            this.render();
        }

    }

    // ======================================================
    // PRODUCT IMAGE RESOLUTION
    // ======================================================

    /** @param {CatalogueProduct} product @param {string|null} [filename] @returns {string} */
    productImageSrc(product, filename = null) {
        const folder = String(product?.image_folder || "").trim();
        const candidate = String(
            filename ||
            (Array.isArray(product?.gallery) && product.gallery.length
                ? product.gallery[0]
                : product?.primary_image || "")
        ).trim();

        // Generated card derivatives are distinct from original product images.
        // Use only the bounded derivative path published by the build; detail
        // galleries continue to use the canonical full-resolution image URLs.
        const thumbnailUrl = String(product?.card_image_url || "").trim();
        if (/^\/assets\/images\/product-thumbnails\/[^/?#]+\/[^/?#]+\.webp$/i.test(thumbnailUrl)) {
            return thumbnailUrl;
        }

        // The packaged gallery is authoritative. It contains the actual
        // normalized filenames (1.webp, 2.webp, ...).
        if (folder && candidate) {
            return `/assets/images/products/${encodeURIComponent(folder)}/${encodeURIComponent(candidate)}`;
        }

        const imageUrl = String(product?.image_url || "").trim();
        if (imageUrl && !imageUrl.endsWith("/placeholder.webp")) {
            return imageUrl;
        }

        return "/assets/images/placeholder.webp";
    }

    // ======================================================
    // STATIC PDP SYNCHRONIZATION
    // ======================================================

    syncStaticProductGallery(product) {
        const gallery = document.querySelector(".pdp-gallery");
        if (!gallery) return;

        const folder = String(product?.image_folder || "").trim();
        const galleryFiles = Array.isArray(product?.gallery)
            ? product.gallery.map(file => String(file || "").trim()).filter(Boolean)
            : [];
        const fallback = String(product?.image_url || "").trim() || "/assets/images/placeholder.webp";

        const srcFor = filename => {
            if (!filename) return fallback;
            if (/^https?:\/\//i.test(filename) || filename.startsWith("/")) return filename;
            if (folder) {
                return `/assets/images/products/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
            }
            if (filename === product?.image && fallback) return fallback;
            return fallback;
        };

        const dimensionsFor = filename => {
            const dims = product?.gallery_dimensions?.[filename];
            if (!Array.isArray(dims) || dims.length !== 2) return null;
            const width = Number(dims[0]);
            const height = Number(dims[1]);
            return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
                ? [width, height]
                : null;
        };

        const mainImage = document.getElementById("pdpMainImage");
        if (mainImage) {
            const src = srcFor(galleryFiles[0] || String(product?.image || "").trim());
            // The catalogue-index refresh can finish after a failed image has
            // already recovered to the placeholder. Never resurrect the same
            // broken source once the gallery has recorded a terminal fallback.
            const mainImageFallbackComplete =
                mainImage.dataset.galleryFallback === "done" ||
                String(mainImage.getAttribute("src") || "").endsWith("/assets/images/placeholder.webp");
            if (!mainImageFallbackComplete) {
                mainImage.src = src;
            }
            mainImage.alt = String(product?.product_name || product?.name || "Product image");
            const dims = dimensionsFor(galleryFiles[0] || String(product?.image || "").trim());
            if (dims && !mainImageFallbackComplete) {
                mainImage.width = dims[0];
                mainImage.height = dims[1];
            }
        }

        const thumbContainer = gallery.querySelector(".pdp-thumbnails");
        if (!thumbContainer || !galleryFiles.length) return;

        const existingButtons = Array.from(thumbContainer.querySelectorAll(".pdp-thumb"));
        galleryFiles.forEach((filename, index) => {
            let button = existingButtons[index];
            if (!button) {
                button = document.createElement("button");
                button.type = "button";
                button.className = "pdp-thumb";
                thumbContainer.appendChild(button);
            }
            button.hidden = false;
            button.setAttribute("type", "button");
            button.setAttribute("aria-label", `View ${String(product?.product_name || product?.name || "Product")} image ${index + 1}`);
            let img = button.querySelector("img");
            if (!img) {
                img = document.createElement("img");
                button.appendChild(img);
            }
            img.src = srcFor(filename);
            img.alt = `${String(product?.product_name || product?.name || "Product")} image ${index + 1}`;
            img.loading = "lazy";
            img.decoding = "async";
            img.draggable = false;
            const dims = dimensionsFor(filename);
            if (dims) {
                img.width = dims[0];
                img.height = dims[1];
            }
        });

        existingButtons.slice(galleryFiles.length).forEach(button => {
            button.hidden = true;
        });
    }

    async hydrateStaticRecommendations(product) {
        const frequentSlider = document.querySelector(".pdp-frequent-slider");
        const relatedSlider = document.querySelector(".pdp-related-slider-main");

        const bindSlider = (slider, prev, next) => {
            if (!slider || slider.dataset.recommendationControlsBound === "true") return;
            slider.dataset.recommendationControlsBound = "true";
            prev?.addEventListener("click", () => slider.scrollBy({ left: -600, behavior: "smooth" }));
            next?.addEventListener("click", () => slider.scrollBy({ left: 600, behavior: "smooth" }));
        };

        bindSlider(frequentSlider, document.querySelector(".pdp-frequent-prev"), document.querySelector(".pdp-frequent-next"));
        bindSlider(relatedSlider, document.querySelector(".pdp-related-prev-btn"), document.querySelector(".pdp-related-next-btn"));

        const frequentNeedsData = Boolean(frequentSlider && !frequentSlider.querySelector(".product-card"));
        const relatedNeedsData = Boolean(relatedSlider && !relatedSlider.querySelector(".product-card"));
        if (!frequentNeedsData && !relatedNeedsData) return;

        try {
            const response = await fetch("/assets/data/catalogue-index.json", {
                headers: { Accept: "application/json" },
                cache: "no-store",
                credentials: "same-origin"
            });
            if (!response.ok) return;
            const catalogue = await response.json();
            if (!Array.isArray(catalogue) || !catalogue.length) return;

            const previousProducts = this.products;
            this.products = catalogue;

            const frequentlyProducts = this.frequentlyUsedWith(product, 6);
            const frequentIds = new Set(frequentlyProducts.map(item => item.id));
            const relatedProducts = this.related(product, 6, frequentIds);

            if (frequentSlider && frequentNeedsData) {
                frequentSlider.innerHTML = frequentlyProducts.map(item => this.card(item)).join("");
            }
            if (relatedSlider && relatedNeedsData) {
                relatedSlider.innerHTML = relatedProducts.map(item => this.card(item)).join("");
            }

            this.products = previousProducts;

            bindSlider(frequentSlider, document.querySelector(".pdp-frequent-prev"), document.querySelector(".pdp-frequent-next"));
            bindSlider(relatedSlider, document.querySelector(".pdp-related-prev-btn"), document.querySelector(".pdp-related-next-btn"));
            window.SavedProducts?.updateButtons?.();
        } catch (error) {
            SouviksErrors?.log("[Souviks PDP] Static recommendation hydration unavailable:", error, "warn");
        }
    }

    // ======================================================
    // PRODUCT CARD
    // ======================================================

/** @param {CatalogueProduct} product @param {boolean} [prioritize] @returns {string} */
card(product, prioritize = false) {
    return ProductCard.render(product, {
        prioritize,
        imageSrc: this.productImageSrc(product)
    });
}

    // ======================================================
    // RENDER GRID
    // ======================================================

render() {

    if (!this.container) {

        return;

    }

    if (

        !this.filtered ||

        this.filtered.length === 0

    ) {

        this.container.innerHTML =

            Utils.emptyState(

                "No products found."

            );

        return;

    }

    const start =

        (this.currentPage - 1) *

        this.pageSize;

    const end =

        start +

        this.pageSize;

    const pageProducts =

        this.filtered.slice(

            start,

            end

        );

    this.container.innerHTML =

        pageProducts

            .map(

                (product, index) =>

                    this.card(product, index < 4)

            )

            .join("");

    this.updateResults();

    this.renderPagination();

}

updateResults() {

    const totalProducts =
        document.getElementById("totalProducts");

    if (totalProducts) {
        totalProducts.textContent =
            this.products.length;
    }

    const visible =
        document.getElementById("visibleProducts");

    if (visible) {
        visible.textContent =
            this.filtered.length;
    }

    const start =
        document.getElementById("currentResultStart");

    const end =
        document.getElementById("currentResultEnd");

    const total =
        document.getElementById("totalResults");

    if (start) {
        start.textContent =
            this.filtered.length
                ? ((this.currentPage - 1) * this.pageSize) + 1
                : 0;
    }

    if (end) {
        end.textContent =
            Math.min(
                this.currentPage * this.pageSize,
                this.filtered.length
            );
    }

    if (total) {
        total.textContent =
            this.filtered.length;
    }
}

    // ======================================================
    // PAGINATION
    // ======================================================

renderPagination() {

    const container =

        document.getElementById(

            "pagination"

        );

    if (!container) {

        return;

    }

    const pages = Math.ceil(

        this.filtered.length /

        this.pageSize

    );

    let html = "";

    for (

        let i = 1;

        i <= pages;

        i++

    ) {

        html += `

        <button

            class="pagination-page ${

                i === this.currentPage

                    ? "active"

                    : ""

            }"

            data-page="${i}">

            ${i}

        </button>

        `;

    }

    container.innerHTML = html;

    container

        .querySelectorAll(

            "[data-page]"

        )

        .forEach(

            button => {

                button.addEventListener(

                    "click",

                    () => {

                        this.currentPage =

                            Number(

                                button.dataset.page

                            );

                        this.render();

                    }

                );

            }

        );

}

    // ======================================================
    // FILTER BRAND
    // ======================================================

    filterBrand(

        brandId

    ) {

        if (!brandId) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;

            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.brand_id ===

                    brandId

            );

        this.render();

    }

    // ======================================================
    // FILTER CATEGORY
    // ======================================================

    filterCategory(

        categoryId

    ) {

        if (!categoryId) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;
            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.category_id ===

                    categoryId

            );

        this.render();

    }

    // ======================================================
    // FILTER VEHICLE
    // ======================================================

    filterVehicle(

        vehicleName

    ) {

        if (!vehicleName) {

            this.filtered = [

                ...this.products

            ];
            this.currentPage = 1;
            this.render();

            return;

        }

        this.filtered =

            this.products.filter(

                product =>

                    product.vehicles.includes(

                        vehicleName

                    )

            );

        this.render();

    }

    // ======================================================
    // FEATURED
    // ======================================================

    featured(

        count = 8

    ) {

        return this.products

            .filter(

                item =>

                    item.featured === true

            )

            .slice(

                0,

                count

            );

    }

    // ======================================================
    // PDP RECOMMENDATIONS
    // ======================================================

frequentlyUsedWith(product, limit = 6, excludedIds = new Set()) {

    const currentVehicles = new Set(
        (product?.vehicles || []).map(v => String(v).trim()).filter(Boolean)
    );

    if (!currentVehicles.size) return [];

    const relevance = item => {
        const itemVehicles = new Set(
            (item?.vehicles || []).map(v => String(v).trim()).filter(Boolean)
        );
        return [...currentVehicles].filter(v => itemVehicles.has(v)).length;
    };

    return this.products
        .filter(item =>
            item.id !== product.id &&
            !excludedIds.has(item.id) &&
            item.active !== false &&
            relevance(item) > 0
        )
        .sort((a, b) => {
            const scoreA = relevance(a);
            const scoreB = relevance(b);
            if (scoreB !== scoreA) return scoreB - scoreA;
            if (a.subcategory_id === product.subcategory_id && b.subcategory_id !== product.subcategory_id) return -1;
            if (b.subcategory_id === product.subcategory_id && a.subcategory_id !== product.subcategory_id) return 1;
            if (a.category_id === product.category_id && b.category_id !== product.category_id) return -1;
            if (b.category_id === product.category_id && a.category_id !== product.category_id) return 1;
            return String(a.product_name || "").localeCompare(String(b.product_name || ""));
        })
        .slice(0, limit);
}

related(product, limit = 6, excludedIds = new Set()) {

    return this.products
        .filter(item =>
            item.id !== product.id &&
            !excludedIds.has(item.id) &&
            item.active !== false &&
            item.category_id === product.category_id
        )
        .sort((a, b) => {
            const subA = a.subcategory_id === product.subcategory_id ? 0 : 1;
            const subB = b.subcategory_id === product.subcategory_id ? 0 : 1;
            if (subA !== subB) return subA - subB;

            const brandA = a.brand_id === product.brand_id ? 0 : 1;
            const brandB = b.brand_id === product.brand_id ? 0 : 1;
            if (brandA !== brandB) return brandA - brandB;

            return String(a.product_name || "").localeCompare(String(b.product_name || ""));
        })
        .slice(0, limit);
}

    // ======================================================
    // PRODUCT PRICING
    // ======================================================

priceHtml(product) {

    const mrp = Number(product?.mrp);
    const sellingPrice = Number(product?.selling_price);

    const hasMrp = Number.isFinite(mrp) && mrp >= 0;
    const hasSellingPrice = Number.isFinite(sellingPrice) && sellingPrice >= 0;

    if (!hasMrp && !hasSellingPrice) {
        return "";
    }

    const formatPrice = value =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(value);

    let discountHtml = "";

    if (hasMrp && hasSellingPrice && mrp > 0 && sellingPrice < mrp) {
        const discount = Math.round(((mrp - sellingPrice) / mrp) * 100);
        discountHtml = `<span class="pdp-price-discount">${discount}% OFF</span>`;
    }

    return `
        <div class="pdp-pricing" aria-label="Product pricing">
            ${hasMrp ? `
                <div class="pdp-price-mrp">
                    <span class="pdp-price-label">MRP</span>
                    <span class="pdp-price-value">${formatPrice(mrp)}</span>
                </div>
            ` : ""}
            ${hasSellingPrice ? `
                <div class="pdp-price-selling">
                    <span class="pdp-price-label">Selling Price</span>
                    <span class="pdp-price-value">${formatPrice(sellingPrice)}</span>
                    ${discountHtml}
                </div>
            ` : ""}
        </div>
    `;
}

    // ======================================================
    // PRODUCT GALLERY
    // ======================================================

    bindGallery(product) {
        const gallery = document.querySelector(".pdp-gallery");
        const mainImage = document.getElementById("pdpMainImage");
        if (!gallery || !mainImage) return;

        const placeholder = "/assets/images/placeholder.webp";

        const primary = this.productImageSrc(product) || placeholder;

        const safeImage = (image, fallback = primary) => {
            if (!image || image.dataset.galleryFallback === "placeholder") return;

            image.addEventListener("error", () => {
                const stage = image.dataset.galleryFallback || "primary";

                if (stage === "primary" && fallback && fallback !== image.src) {
                    image.dataset.galleryFallback = "placeholder";
                    image.src = fallback;
                    return;
                }

                image.dataset.galleryFallback = "placeholder";
                image.src = placeholder;
            }, { once: true });
        };

        // Main image: current source -> canonical primary -> global placeholder.
        mainImage.dataset.galleryFallback = "primary";
        const handleMainImageError = () => {
            if (mainImage.dataset.galleryFallback === "primary" &&
                primary &&
                mainImage.src !== new URL(primary, window.location.href).href) {
                mainImage.dataset.galleryFallback = "placeholder";
                mainImage.src = primary;
                return;
            }

            mainImage.dataset.galleryFallback = "done";
            mainImage.src = placeholder;
        };
        mainImage.addEventListener("error", handleMainImageError);

        // Static HTML can start loading the image before this module executes.
        // Handle an already-failed request rather than waiting for a new error.
        if (mainImage.complete && mainImage.naturalWidth === 0) {
            handleMainImageError();
        }

        const thumbs = [...gallery.querySelectorAll(".pdp-thumb")];
        const validThumbs = thumbs.length ? thumbs : [];

        validThumbs.forEach((thumb, index) => {
            const img = thumb.querySelector("img");
            if (!img) {
                thumb.hidden = true;
                return;
            }

            // Each thumbnail is isolated: one bad asset cannot break the gallery.
            img.dataset.galleryFallback = "placeholder";
            img.addEventListener("error", () => {
                img.dataset.galleryFallback = "done";
                img.src = placeholder;
                thumb.classList.add("is-gallery-fallback");
            }, { once: true });

            thumb.addEventListener("click", () => {
                const source = String(img.currentSrc || img.src || "").trim();
                if (!source) return;

                mainImage.dataset.galleryFallback = "primary";
                mainImage.src = source;

                validThumbs.forEach(item => item.classList.remove("active"));
                thumb.classList.add("active");
            });

            if (index === 0) thumb.classList.add("active");
        });

        // If the static builder produced no thumbnails, retain a functional
        // one-item fallback rather than an empty gallery rail.
        if (!thumbs.length) {
            const wrapper = gallery.querySelector(".pdp-thumbnails");
            if (wrapper) {
                wrapper.innerHTML = `
                    <button class="pdp-thumb is-gallery-fallback active" type="button"
                        aria-label="View product image">
                        <img src="${placeholder}" alt="${String(product?.product_name || "Product")} image">
                    </button>
                `;
                const fallbackThumb = wrapper.querySelector(".pdp-thumb");
                fallbackThumb?.addEventListener("click", () => {
                    mainImage.dataset.galleryFallback = "done";
                    mainImage.src = primary || placeholder;
                });
            }
        }

        const thumbContainer = gallery.querySelector(".pdp-thumbnails");
        const thumbPrev = gallery.querySelector(".pdp-thumb-prev");
        const thumbNext = gallery.querySelector(".pdp-thumb-next");

        thumbPrev?.addEventListener("click", () => {
            thumbContainer?.scrollBy({ left: -260, behavior: "smooth" });
        });

        thumbNext?.addEventListener("click", () => {
            thumbContainer?.scrollBy({ left: 260, behavior: "smooth" });
        });

        const brandImage = gallery.querySelector(".pdp-brand-badge img");
        if (brandImage) {
            brandImage.addEventListener("error", () => {
                const badge = brandImage.closest(".pdp-brand-badge");
                if (badge) badge.hidden = true;
            }, { once: true });
        }

    }

    bindPdpFastInteractions(product) {
        const qtyInput=document.getElementById("pdpQty");
        const minusBtn=document.querySelector(".pdp-qty-minus");
        const plusBtn=document.querySelector(".pdp-qty-plus");
        const rfqBtn=document.querySelector(".pdp-rfq-btn");
        const removeBtn=document.querySelector(".pdp-remove-btn");
        const bindSlider = (sliderSelector, prevSelector, nextSelector) => {
            const slider = document.querySelector(sliderSelector);
            document.querySelector(prevSelector)?.addEventListener("click", () =>
                slider?.scrollBy({ left: -600, behavior: "smooth" })
            );
            document.querySelector(nextSelector)?.addEventListener("click", () =>
                slider?.scrollBy({ left: 600, behavior: "smooth" })
            );
        };
        bindSlider(".pdp-frequent-slider", ".pdp-frequent-prev", ".pdp-frequent-next");
        bindSlider(".pdp-related-slider-main", ".pdp-related-prev-btn", ".pdp-related-next-btn");
        if(!qtyInput||!rfqBtn||!removeBtn||typeof RFQ==="undefined") return;
        let inRFQ=false;
        const markChanged=()=>{if(inRFQ) rfqBtn.textContent="Update RFQ";};
        minusBtn?.addEventListener("click",()=>{qtyInput.value=Math.max(1,Number(qtyInput.value)-1);markChanged();});
        plusBtn?.addEventListener("click",()=>{qtyInput.value=Math.max(1,Number(qtyInput.value)+1);markChanged();});
        qtyInput.addEventListener("input",markChanged);
        rfqBtn.addEventListener("click",async()=>{
            const qty=Math.max(1,Number(qtyInput.value)||1);
            const ok=await RFQ.setQuantity(product.id,{partNumber:product.part_number,name:product.product_name,brand:product.brand_name},qty);
            if(!ok)return; inRFQ=true; rfqBtn.textContent="Added ✓"; removeBtn.style.display="block";
        });
        removeBtn.addEventListener("click",async()=>{
            await RFQ.remove(product.id); inRFQ=false; qtyInput.value=1; rfqBtn.textContent="Add To RFQ"; removeBtn.style.display="none";
        });
        void (async()=>{try{
            const item=(await RFQ.get()).find(entry=>entry.id===product.id);
            if(!item)return; inRFQ=true; qtyInput.value=item.qty; rfqBtn.textContent="Added ✓"; removeBtn.style.display="block";
        }catch(error){SouviksErrors?.log("Souviks RFQ state unavailable:", error, "warn");}})();
    }

    // ======================================================
    // PRODUCT DETAIL
    // ======================================================

async hydrateProductPage() {

    // Builder pages are fully rendered in HTML. Do not make catalogue JSON,
    // breadcrumb lookup, vehicle lookup, or related-product loading a prerequisite
    // for the first interaction.
    const staticTarget=Utils.el("#product-detail");
    const embeddedProduct=window.SOUVIKS_PRODUCT_PAGE_DATA;
    if(staticTarget?.dataset.staticRendered==="true" && embeddedProduct?.id){
        this.bindPdpFastInteractions(embeddedProduct);
        this.syncStaticProductGallery(embeddedProduct);
        setTimeout(() => this.hydrateStaticRecommendations(embeddedProduct), 0);
        setTimeout(()=>this.initReviews(embeddedProduct),0);
        return;
    }

    const slug = Utils.currentSlug();
    const product = await API.productBySlug(slug);

    const missingProductCopy = {
        en: {
            title: "Product unavailable",
            message: "This product is no longer available in the Souviks catalogue."
        },
        hi: {
            title: "उत्पाद उपलब्ध नहीं है",
            message: "यह उत्पाद अब Souviks कैटलॉग में उपलब्ध नहीं है।"
        },
        bn: {
            title: "পণ্যটি উপলভ্য নয়",
            message: "এই পণ্যটি এখন আর Souviks ক্যাটালগে উপলভ্য নয়।"
        }
    }[LANG] || {
        title: "Product unavailable",
        message: "This product is no longer available in the Souviks catalogue."
    };

    if (!product) {
        const target = Utils.el("#product-detail");
        if (target && target.dataset.staticRendered !== "true") {
            target.innerHTML = `
                <div class="container">
                    <div class="empty-state" role="status" aria-live="polite">
                        <h2>${missingProductCopy.title}</h2>
                        <p>${missingProductCopy.message}</p>
                        <a class="btn btn-primary" href="/${LANG}/products">Browse Products</a>
                    </div>
                </div>
            `;
        }
        return;
    }

    const brand = await API.brandById(product.brand_id);
    const category = await API.categoryById(product.category_id);

    const breadcrumbItems = [
        { title: "Products", url: `/${LANG}/products` }
    ];

    if (category?.name && category?.slug) {
        breadcrumbItems.push({
            title: category.name,
            url: `/${LANG}/categories/${category.slug}`
        });
    }

    if (brand?.name && brand?.slug) {
        breadcrumbItems.push({
            title: brand.name,
            url: `/${LANG}/brands/${brand.slug}`
        });
    }

    Breadcrumb.render(product.product_name, breadcrumbItems);

const brandLogo =
    brand?.logo || "";

const imageBase =
    `/assets/images/products/${encodeURIComponent(String(product.image_folder || ""))}`;

const galleryImages =
    Array.isArray(product.gallery) && product.gallery.length
    ? product.gallery.map(file => {
        const value = String(file || "").trim();
        if (!value) return "";
        if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
        return `${imageBase}/${encodeURIComponent(value)}`;
    }).filter(Boolean)
    : (product.image_url
        ? [String(product.image_url)]
        : (product.image
            ? [`${imageBase}/${encodeURIComponent(String(product.image))}`]
            : ["/assets/images/placeholder.webp"]));

this.products =
    await API.products();

    const target =
        Utils.el("#product-detail");

    if (!target) return;
const allVehicles =
    await API.vehicles();
   
const vehiclesHtml =
    (product.vehicles || [])
        .map(vehicleName => {

            const vehicle =
                allVehicles.find(
                    v => v.model === vehicleName
                );

            return `
                <div class="pdp-vehicle-card">

                    <div class="pdp-vehicle-image">

                        <img
                            src="${
                                vehicle?.image ||
                                '/assets/images/vehicle-placeholder.webp'
                            }"
                            alt="${vehicleName}"
                            loading="lazy"
                            decoding="async">

                    </div>

                    <div class="pdp-vehicle-content">

                        <h4>${vehicleName}</h4>

                    </div>

                </div>
            `;
        })
        .join("");

    const frequentlyProducts = this.frequentlyUsedWith(product, 6);
    const frequentlyIds = new Set(frequentlyProducts.map(item => item.id));
    const relatedProducts = this.related(product, 6, frequentlyIds);

    const frequentHtml = frequentlyProducts
        .map(item => this.card(item))
        .join("");

    const relatedHtml = relatedProducts
        .map(item => this.card(item))
        .join("");

const galleryHtml = `

<div class="pdp-gallery">

    ${
        brandLogo ?

        `
        <div class="pdp-brand-badge" aria-hidden="true">

            <img
                src="${brandLogo}"
                alt=""
                loading="lazy"
                decoding="async"
                width="56"
                height="56">

        </div>
        `

        :

        ""
    }

    <div class="pdp-main-image">

        <img
            id="pdpMainImage"
            src="${galleryImages[0]}"
            alt="${product.product_name}"
            draggable="false"
            ${Utils.responsiveImageAttrs(galleryImages[0], product.gallery_dimensions?.[product.gallery?.[0]], '(max-width: 768px) 92vw, 800px', 'eager')}
        >

    </div>

<div class="pdp-thumb-wrapper">

    <button
        class="pdp-thumb-prev">

        ‹

    </button>

    <div class="pdp-thumbnails">

        ${galleryImages.map(img => `

            <button class="pdp-thumb">

                <img
                    src="${img}"
                    alt="${product.product_name}"
                    draggable="false"
                    ${Utils.responsiveImageAttrs(img, product.gallery_dimensions?.[img], '96px', 'lazy')}
                >

            </button>

        `).join("")}

    </div>

    <button
        class="pdp-thumb-next">

        ›

    </button>

</div>

</div>

`;

    if (target.dataset.staticRendered !== "true") {

    target.innerHTML = `

<div class="container">

<div class="pdp-wrapper">

    <section class="pdp-hero">
${galleryHtml}

        <div class="pdp-summary">

            <div class="pdp-badges">

                <span class="pdp-stock">
                    ${product.selling_price !== null && product.selling_price !== undefined && product.selling_price !== "" || product.mrp !== null && product.mrp !== undefined && product.mrp !== "" ? "Availability subject to confirmation" : "Price &amp; availability on request"}
                </span>

                <span class="pdp-genuine">
                    Established Brand
                </span>

            </div>

            <h1 class="pdp-title">

                ${product.product_name}

            </h1>

            <div class="pdp-part">

                PART ID:
                ${product.id || ""}

            </div>

            ${this.priceHtml(product)}

          <div class="pdp-meta">

    <div class="pdp-row">
        <strong>Product ID</strong>
        <span>${product.id || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Part Number</strong>
        <span>${product.part_number || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Brand</strong>
        <span>${product.brand_name || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Category</strong>
        <span>${product.category_name || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Sub Category</strong>
        <span>${product.subcategory_name || ""}</span>
    </div>

    <div class="pdp-row">
        <strong>Applications</strong>
        <span>${(product.applications || []).join(", ")}</span>
    </div>

    <div class="pdp-row">
        <strong>Compatible Vehicles</strong>
        <span>${(product.vehicles || []).join(", ")}</span>
    </div>

</div>
<div class="pdp-actions">

    <div class="pdp-qty">

        <button
            type="button"
            class="pdp-qty-minus">

            −

        </button>

        <input
            id="pdpQty"
            type="number"
            min="1"
            value="1">

        <button
            type="button"
            class="pdp-qty-plus">

            +

        </button>

    </div>

    <button
        class="btn btn-primary pdp-rfq-btn">

        Add To RFQ

    </button>

    <button
        class="pdp-remove-btn"
        style="display:none">

        🗑

    </button>

</div>

        </div>

        <aside class="pdp-inquiry">

            <h3>Request This Part</h3>

            <form>

                <input
                    type="text"
                    placeholder="Name">

                <input
                    type="text"
                    placeholder="Phone">

                <input
                    type="text"
                    placeholder="Vehicle">

                <input
                    type="text"
                    value="${product.part_number || ""}"
                    placeholder="Part Number">

                <textarea
                    placeholder="Requirement"></textarea>

                <button
                    class="btn btn-primary">

                    Request Quote

                </button>

            </form>

        </aside>

</section>

<section class="pdp-trust">

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/genuine.svg"
            alt="Genuine Parts">

        <div>

            <strong>
                Established Brand
            </strong>

            <span>
                Catalogue-listed product
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/trusted.svg"
            alt="Trusted">

        <div>

            <strong>
                Trusted Since 1986
            </strong>

            <span>
                Serving Workshops & Fleets
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/inventory.svg"
            alt="Inventory">

        <div>

            <strong>
                Wide Range Available
            </strong>

            <span>
                5000+ Products
            </span>

        </div>

    </div>

    <div class="pdp-trust-item">

        <img
            src="/assets/icons/delivery.svg"
            alt="Delivery">

        <div>

            <strong>
                Pan India Delivery
            </strong>

            <span>
                Fast & Reliable
            </span>

        </div>

    </div>

</section>

<section class="pdp-section-nav">

    <a
        href="#description-section"
        class="pdp-tab-btn">

        Description

    </a>

    <a
        href="#vehicles-section"
        class="pdp-tab-btn">

        Compatible Vehicles

    </a>

    <a
        href="#related-section"
        class="pdp-tab-btn">

        Related Products

    </a>

</section>

<section
    id="description-section"
    class="pdp-section">

    <h2 class="pdp-section-title">

        Description

    </h2>

    <div class="pdp-description-grid">

        <div class="pdp-description-card">

            <h3>Description</h3>

            <p>

                ${product.description || ""}

            </p>

        </div>

        <div class="pdp-description-card">

            <h3>Applications</h3>

            <ul>

                ${(product.applications || [])
                    .map(
                        app =>
                        `<li>${app}</li>`
                    )
                    .join("")}

            </ul>

        </div>

    </div>

</section>

<section
    id="vehicles-section"
    class="pdp-section">

    <h2 class="pdp-section-title">

        Compatible Vehicles

    </h2>

    <div class="pdp-vehicle-grid">

        ${vehiclesHtml}

    </div>

</section>

<section
    id="frequently-used-section"
    class="pdp-section pdp-recommendation-section">

    <h2 class="pdp-section-title">
        Frequently used with this part
    </h2>

    <p class="pdp-section-intro">
        Products commonly used with this part across the same vehicle group.
    </p>

    <div class="pdp-related-wrapper pdp-recommendation-wrapper">
        <button class="pdp-related-prev pdp-frequent-prev" type="button" aria-label="Previous frequently used products">‹</button>
        <div class="pdp-related-slider pdp-frequent-slider">
            ${frequentHtml}
        </div>
        <button class="pdp-related-next pdp-frequent-next" type="button" aria-label="Next frequently used products">›</button>
    </div>

</section>

<section
    id="related-section"
    class="pdp-section pdp-recommendation-section">

    <h2 class="pdp-section-title">
        Related Products
    </h2>

    <p class="pdp-section-intro">
        Other products from the same category, with matching subcategory products shown first.
    </p>

    <div class="pdp-related-wrapper pdp-recommendation-wrapper">
        <button class="pdp-related-prev pdp-related-prev-btn" type="button" aria-label="Previous related products">‹</button>
        <div class="pdp-related-slider pdp-related-slider-main">
            ${relatedHtml}
        </div>
        <button class="pdp-related-next pdp-related-next-btn" type="button" aria-label="Next related products">›</button>
    </div>

</section>

</div>

</div>

`;

}

/* ==========================================
   PDP RFQ CONTROLS
========================================== */

const qtyInput =
    document.getElementById(
        "pdpQty"
    );

const minusBtn =
    document.querySelector(
        ".pdp-qty-minus"
    );

const plusBtn =
    document.querySelector(
        ".pdp-qty-plus"
    );

const rfqBtn =
    document.querySelector(
        ".pdp-rfq-btn"
    );

const removeBtn =
    document.querySelector(
        ".pdp-remove-btn"
    );

/*
----------------------------------------------------------
LOAD EXISTING RFQ ITEM
----------------------------------------------------------
*/

const rfqItems =
    await RFQ.get();

const rfqItem =
    rfqItems.find(
        item =>
            item.id === product.id
    );

let inRFQ = false;

if (
    rfqItem &&
    qtyInput &&
    rfqBtn &&
    removeBtn
) {

    inRFQ = true;

    qtyInput.value =
        rfqItem.qty;

    rfqBtn.textContent =
        "Added ✓";

    removeBtn.style.display =
        "block";

}

/*
----------------------------------------------------------
PDP QUANTITY — MINUS
----------------------------------------------------------
*/

minusBtn?.addEventListener(

    "click",

    () => {

        qtyInput.value =
            Math.max(

                1,

                Number(
                    qtyInput.value
                ) - 1

            );

        if (inRFQ) {

            rfqBtn.textContent =
                "Update RFQ";

        }

    }

);

/*
----------------------------------------------------------
PDP QUANTITY — PLUS
----------------------------------------------------------
*/

plusBtn?.addEventListener(

    "click",

    () => {

        qtyInput.value =
            Number(
                qtyInput.value
            ) + 1;

        if (inRFQ) {

            rfqBtn.textContent =
                "Update RFQ";

        }

    }

);

/*
----------------------------------------------------------
PDP QUANTITY — MANUAL INPUT
----------------------------------------------------------
*/

qtyInput?.addEventListener(

    "input",

    () => {

        if (inRFQ) {

            rfqBtn.textContent =
                "Update RFQ";

        }

    }

);

/*
----------------------------------------------------------
PDP — ADD / UPDATE RFQ
----------------------------------------------------------
*/

rfqBtn?.addEventListener(

    "click",

    async () => {

        const qty =
            Math.max(

                1,

                Number(
                    qtyInput.value
                ) || 1

            );

        const success =
            await RFQ.setQuantity(

                product.id,

                {

                    partNumber:
                        product.part_number,

                    name:
                        product.product_name,

                    brand:
                        product.brand_name

                },

                qty

            );

        if (!success) {

            return;

        }

        inRFQ = true;

        rfqBtn.textContent =
            "Added ✓";

        removeBtn.style.display =
            "block";

    }

);

/*
----------------------------------------------------------
PDP — REMOVE FROM RFQ
----------------------------------------------------------
*/

removeBtn?.addEventListener(

    "click",

    async () => {

        await RFQ.remove(
            product.id
        );

        inRFQ = false;

        qtyInput.value =
            1;

        rfqBtn.textContent =
            "Add To RFQ";

        removeBtn.style.display =
            "none";

    }

);

this.bindGallery(product);
this.initReviews(product);

const slider =
    document.querySelector(
        ".pdp-related-slider"
    );

const prev =
    document.querySelector(
        ".pdp-related-prev"
    );

const next =
    document.querySelector(
        ".pdp-related-next"
    );

if(
    slider &&
    prev &&
    next
){

    prev.addEventListener(
        "click",
        () => {

            slider.scrollBy({
                left:-600,
                behavior:"smooth"
            });

        }
    );

    next.addEventListener(
        "click",
        () => {

            slider.scrollBy({
                left:600,
                behavior:"smooth"
            });

        }
    );

}

}

    // ======================================================
    // PRODUCT REVIEWS
    // Reviews are stored in Supabase and only approved reviews
    // are publicly rendered. Submission requires a signed-in user.
    // ======================================================

    async initReviews(product) {
        const section = document.querySelector("[data-product-id]");
        if (!section || !product?.id) return;

        const list = section.querySelector("[data-review-list]");
        const summary = section.querySelector("[data-review-summary]");
        const form = section.querySelector("[data-review-form]");
        const signIn = section.querySelector("[data-review-signin]");
        const status = section.querySelector("[data-review-status]");

        const escapeHtml = value => String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const stars = rating => {
            const n = Math.max(0, Math.min(5, Number(rating) || 0));
            return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
        };

        if (typeof supabaseClient === "undefined") {
            if (list) list.innerHTML = '<div class="pdp-review-empty">Reviews are currently unavailable.</div>';
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from("product_reviews")
                .select("id, reviewer_name, rating, title, review, created_at")
                .eq("product_id", String(product.id))
                .eq("status", "approved")
                .order("created_at", { ascending: false });

            if (error) throw error;

            const reviews = Array.isArray(data) ? data : [];
            const average = reviews.length
                ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length
                : 0;

            if (summary) {
                summary.innerHTML = reviews.length
                    ? `<strong>${average.toFixed(1)} <span aria-hidden="true">★</span></strong><span>${reviews.length} review${reviews.length === 1 ? "" : "s"}</span>`
                    : `<strong>—</strong><span>No reviews yet</span>`;
            }

            if (list) {
                list.innerHTML = reviews.length
                    ? reviews.map(item => {
                        const date = item.created_at
                            ? new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : "";
                        return `<article class="pdp-review-card"><div class="pdp-review-card-top"><div><strong>${escapeHtml(item.reviewer_name || "Souviks Customer")}</strong>${date ? `<span>${escapeHtml(date)}</span>` : ""}</div><span class="pdp-review-stars" aria-label="${Number(item.rating) || 0} out of 5 stars">${stars(item.rating)}</span></div>${item.title ? `<h3>${escapeHtml(item.title)}</h3>` : ""}<p>${escapeHtml(item.review || "")}</p></article>`;
                    }).join("")
                    : '<div class="pdp-review-empty">No customer reviews yet. Be the first to share your experience.</div>';
            }
        } catch (error) {
            SouviksErrors?.log("Souviks reviews unavailable:", error, "warn");
            if (list) list.innerHTML = '<div class="pdp-review-empty">No customer reviews have been published yet.</div>';
        }

        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                if (form) {
                    form.hidden = false;
                    const nameInput = form.querySelector("[name='reviewer_name']");
                    if (nameInput && !nameInput.value) {
                        nameInput.value = user.user_metadata?.full_name || user.user_metadata?.name || "";
                    }
                }
                if (signIn) signIn.hidden = true;
            } else {
                if (form) form.hidden = true;
                if (signIn) {
                    signIn.hidden = false;
                    const language = window.souviks?.currentLanguage || "en";
                    const loginPath = `/${encodeURIComponent(language)}/login`;
                    signIn.innerHTML = `Please <a href="${loginPath}">sign in</a> to share your experience with this product.`;
                }
            }
        } catch (error) {
            if (form) form.hidden = true;
            if (signIn) signIn.hidden = false;
        }

        form?.addEventListener("submit", async event => {
            event.preventDefault();
            if (status) status.textContent = "";

            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                if (status) status.textContent = "Please sign in before submitting a review.";
                return;
            }

            const formData = new FormData(form);
            const rating = Number(formData.get("rating"));
            const reviewerName = String(formData.get("reviewer_name") || "").trim();
            const title = String(formData.get("title") || "").trim();
            const review = String(formData.get("review") || "").trim();

            if (!reviewerName || !title || !review || rating < 1 || rating > 5) {
                if (status) status.textContent = "Please complete all review fields and select a rating.";
                return;
            }

            const button = form.querySelector("button[type='submit']");
            if (button) {
                button.disabled = true;
                button.textContent = "Submitting…";
            }

            const { error } = await supabaseClient.from("product_reviews").insert({
                product_id: String(product.id),
                user_id: user.id,
                reviewer_name: reviewerName,
                rating,
                title,
                review,
                status: "pending"
            });

            if (button) {
                button.disabled = false;
                button.textContent = "Submit Review";
            }

            if (error) {
                SouviksErrors?.log("Souviks review submission failed:", error, "error");
                if (status) status.textContent = "We could not submit your review right now. Please try again.";
                return;
            }

            form.reset();
            const nameInput = form.querySelector("[name='reviewer_name']");
            if (nameInput) nameInput.value = reviewerName;
            if (status) status.textContent = "Thank you. Your review has been submitted and is awaiting moderation.";
        });
    }
}

window.Products = new ProductManager();
