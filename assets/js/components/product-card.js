/// <reference path="../types/catalogue.js" />

/**
 * Single browser-side product-card renderer.
 *
 * Build-time catalogue cards are owned by scripts/catalogue/product_card.py.
 * This runtime component owns interactive listing/PDP card markup.
 */
const ProductCard = {
    /**
     * @param {CatalogueProduct} product
     * @param {{prioritize?: boolean, imageSrc?: string}} [options]
     * @returns {string}
     */
    render(product, options) {
        options = options || {};

        const prioritize = Boolean(options.prioritize);
        const cardImage = String(
            options.imageSrc || product?.image_url || "/assets/images/placeholder.webp"
        );
        const productId = String(product?.id || "");
        const name = String(product?.product_name || product?.name || "");
        const partNumber = String(product?.part_number || product?.partNumber || "");
        const brandName = String(product?.brand_name || product?.brand || "");

        const hasSellingPrice =
            product?.selling_price !== null &&
            product?.selling_price !== undefined &&
            product?.selling_price !== "";
        const hasMrp =
            product?.mrp !== null &&
            product?.mrp !== undefined &&
            product?.mrp !== "";

        const mrpNumber = Number(product?.mrp);
        const sellingNumber = Number(product?.selling_price);
        const discounted =
            Number.isFinite(mrpNumber) &&
            Number.isFinite(sellingNumber) &&
            mrpNumber > 0 &&
            sellingNumber < mrpNumber;
        const discount = discounted
            ? Math.round(((mrpNumber - sellingNumber) / mrpNumber) * 100)
            : null;

        const price = discounted
            ? '<span class="product-price-current">' + Utils.currency(sellingNumber) + "</span>" +
              '<span class="product-price-mrp">MRP ' + Utils.currency(mrpNumber) + "</span>" +
              '<span class="product-price-discount">' + discount + "% OFF</span>"
            : (hasSellingPrice || hasMrp)
                ? (hasSellingPrice ? "Price" : "MRP") +
                  ": " +
                  Utils.currency(hasSellingPrice ? product.selling_price : product.mrp)
                : "Get current price";

        const isSaved =
            typeof SavedProducts !== "undefined" &&
            SavedProducts.isSaved(productId);

        const escape = value =>
            String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");

        const loading = prioritize ? "eager" : "lazy";
        const priority = prioritize ? ' fetchpriority="high"' : "";
        const savedClass = isSaved ? " is-saved" : "";
        const savedState = isSaved ? "true" : "false";
        const savedLabel = isSaved
            ? "Remove from saved products"
            : "Save product";
        const savedIcon = isSaved ? "♥" : "♡";
        const addLabel =
            window.souviks?.translations?.buttons?.add_to_rfq || "Add To RFQ";

        return '<article class="product-card">' +
            '<div class="product-image">' +
                '<a href="' + Utils.productUrl(product) +
                    '" aria-label="View ' + escape(name) + '">' +
                    '<img class="product-image-file" src="' + escape(cardImage) +
                    '" alt="' + escape(name) + '"' +
                    ' loading="' + loading + '"' + priority +
                    ' decoding="async" draggable="false">' +
                "</a>" +
                '<button type="button" class="product-save-button' + savedClass + '"' +
                    ' data-saved-product-id="' + escape(productId) + '"' +
                    ' data-saved="' + savedState + '"' +
                    ' aria-pressed="' + savedState + '"' +
                    ' aria-label="' + savedLabel + '">' +
                    '<span data-saved-icon aria-hidden="true">' + savedIcon + "</span>" +
                "</button>" +
            "</div>" +
            '<div class="product-content">' +
                '<div class="product-brand-label">' + escape(brandName) + "</div>" +
                '<div class="product-part-number">' +
                    (partNumber
                        ? "Part No. <strong>" + escape(partNumber) + "</strong>"
                        : "Part number on request") +
                "</div>" +
                '<h3 class="product-title"><a href="' +
                    Utils.productUrl(product) + '">' + escape(name) + "</a></h3>" +
                '<div class="product-price' + (discounted ? " product-price-sale" : "") +
                    '" aria-label="Price">' + price + "</div>" +
                '<button type="button" class="btn btn-primary add-to-cart"' +
                    ' data-id="' + escape(productId) + '"' +
                    ' data-part="' + escape(partNumber) + '"' +
                    ' data-name="' + escape(name) + '"' +
                    ' data-brand="' + escape(brandName) + '"' +
                    ' aria-label="Add ' + escape(name) + ' to RFQ">' +
                    addLabel +
                "</button>" +
            "</div>" +
        "</article>";
    }
};
