/* product.js module extracted from legacy section: pages/product-page.js */

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        if (typeof Products === "undefined") return;
        await Products.hydrateProductPage();
    }
);
