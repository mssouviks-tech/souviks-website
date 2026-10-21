/* Reconcile static product-card images with published compact catalogue thumbnails.
   The static HTML renderer is authoritative for full-size fallbacks. Only change a
   card image when the catalogue explicitly publishes a compact derivative; never
   replace a thumbnail with a full-resolution product gallery image. */
(() => {
    "use strict";

    const THUMBNAIL_RE = /^\/assets\/images\/product-thumbnails\/[^/?#]+\/[^/?#]+\.webp$/i;
    const BATCH_SIZE = 4;

    function publishedThumbnail(product) {
        const value = String(product?.card_image_url || "").trim();
        return THUMBNAIL_RE.test(value) ? value : "";
    }

    function scheduleStaticProductCardImages(products) {
        if (!Array.isArray(products) || !products.length) return;

        const cards = Array.from(document.querySelectorAll(".product-card"));
        if (!cards.length) return;

        const productsById = new Map(
            products.filter(item => item && item.id)
                .map(item => [String(item.id), item])
        );
        const updates = [];

        for (const card of cards) {
            const control = card.querySelector("[data-saved-product-id], .add-to-cart[data-id]");
            const id = String(control?.dataset.savedProductId || control?.dataset.id || "").trim();
            if (!id) continue;

            const product = productsById.get(id);
            if (!product) continue;

            const imageUrl = publishedThumbnail(product);
            if (!imageUrl) continue;

            const image = card.querySelector(".product-image-file, .product-image img");
            if (!image) continue;

            const current = String(image.getAttribute("src") || "").trim();
            if (current === imageUrl || image.src.endsWith(imageUrl)) continue;

            updates.push({
                image,
                imageUrl,
                alt: String(product.product_name || product.name || image.alt || "Product")
            });
        }

        if (!updates.length) return;

        // Do not decode or swap every card image in one post-load long task.
        // Small animation-frame batches keep the initial viewport responsive.
        let cursor = 0;
        const applyBatch = () => {
            const stop = Math.min(cursor + BATCH_SIZE, updates.length);
            for (; cursor < stop; cursor += 1) {
                const update = updates[cursor];
                update.image.src = update.imageUrl;
                update.image.removeAttribute("srcset");
                update.image.removeAttribute("sizes");
                if (update.image.alt !== update.alt) update.image.alt = update.alt;
            }
            if (cursor < updates.length) window.requestAnimationFrame(applyBatch);
        };
        window.requestAnimationFrame(applyBatch);
    }

    const schedule = products => {
        const run = () => scheduleStaticProductCardImages(products);
        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(run, { timeout: 1500 });
        } else {
            window.setTimeout(() => window.requestAnimationFrame(run), 750);
        }
    };

    const loaded = window.Products?.products;
    if (Array.isArray(loaded) && loaded.length) {
        schedule(loaded);
        return;
    }

    window.addEventListener("souviks:catalogue-index-ready", event => {
        schedule(event.detail?.products);
    }, { once: true });
})();
