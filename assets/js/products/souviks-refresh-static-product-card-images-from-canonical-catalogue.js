/* Refresh statically-rendered product card images from the catalogue already loaded by ProductManager.
   Do not fetch catalogue-index.json independently here: the listing controller loads it,
   and a second cache-bypassing request competes with initial rendering. */
(() => {
    "use strict";

    function refreshStaticProductCardImages(products) {
        const cards = Array.from(document.querySelectorAll(".product-card"));
        if (!cards.length || !Array.isArray(products) || !products.length) return;

        const byId = new Map(
            products
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
            if (!product) return;

            // Prefer the compact catalogue thumbnail. Replacing it with image_url
            // can unintentionally download full-resolution product imagery in cards.
            const image = typeof window.Products?.productImageSrc === "function"
                ? String(window.Products.productImageSrc(product) || "").trim()
                : String(product.card_image_url || product.image_url || "").trim();
            if (!image || image.endsWith("/placeholder.webp")) return;

            const img = card.querySelector(".product-image-file, .product-image img");
            if (!img || img.getAttribute("src") === image || img.src.endsWith(image)) return;

            img.src = image;
            img.removeAttribute("srcset");
            img.removeAttribute("sizes");
            img.alt = String(product.product_name || product.name || img.alt || "Product");
        });
    }

    const products = window.Products?.products;
    if (Array.isArray(products) && products.length) {
        refreshStaticProductCardImages(products);
        return;
    }

    window.addEventListener("souviks:catalogue-index-ready", event => {
        refreshStaticProductCardImages(event.detail?.products);
    }, { once: true });
})();
