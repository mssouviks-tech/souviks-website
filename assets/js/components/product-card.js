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

        const mrpNumber = Number(product?.mrp);
        const sellingNumber = Number(product?.selling_price);
        const hasMrp = Number.isFinite(mrpNumber) && mrpNumber > 0;
        const purchasable =
            Boolean(productId) &&
            product?.active !== false &&
            Number.isFinite(sellingNumber) &&
            sellingNumber > 0;
        const discounted =
            purchasable &&
            hasMrp &&
            sellingNumber < mrpNumber;
        const discount = discounted
            ? Math.round(((mrpNumber - sellingNumber) / mrpNumber) * 100)
            : null;

        const price = discounted
            ? '<span class="product-price-current">' + Utils.currency(sellingNumber) + "</span>" +
              '<span class="product-price-mrp">MRP ' + Utils.currency(mrpNumber) + "</span>" +
              '<span class="product-price-discount">' + discount + "% OFF</span>"
            : purchasable
                ? '<span class="product-price-current">' + Utils.currency(sellingNumber) + "</span>"
                : hasMrp
                    ? '<span class="product-price-mrp">MRP ' + Utils.currency(mrpNumber) + "</span>" +
                      '<span class="product-price-request">Get current price</span>'
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
        const language = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
        const purchaseLabel = language === "hi"
            ? "कार्ट में जोड़ें"
            : language === "bn"
                ? "কার্টে যোগ করুন"
                : "Add to Cart";
        const requestPartLabel = language === "hi"
            ? "पार्ट का अनुरोध"
            : language === "bn"
                ? "পার্টের অনুরোধ"
                : "Request a Part";
        const quantityLabels = language === "hi"
            ? { label: "मात्रा", decrease: "मात्रा घटाएँ", increase: "मात्रा बढ़ाएँ" }
            : language === "bn"
                ? { label: "পরিমাণ", decrease: "পরিমাণ কমান", increase: "পরিমাণ বাড়ান" }
                : { label: "Quantity", decrease: "Decrease quantity", increase: "Increase quantity" };
        const purchaseControls = purchasable
            ? '<div class="product-card-purchase-controls">' +
                '<div class="product-card-quantity" data-product-quantity-controls aria-label="' + quantityLabels.label + '">' +
                    '<button type="button" class="product-card-qty-button" data-product-qty-decrease aria-label="' + quantityLabels.decrease + '">−</button>' +
                    '<input type="number" class="product-card-qty-input" data-product-quantity min="1" max="9999" step="1" value="1" inputmode="numeric" aria-label="' + quantityLabels.label + '">' +
                    '<button type="button" class="product-card-qty-button" data-product-qty-increase aria-label="' + quantityLabels.increase + '">+</button>' +
                '</div>' +
                '<button type="button" class="btn btn-secondary add-to-purchase-cart" data-id="' + escape(productId) + '"' +
                    ' data-part="' + escape(partNumber) + '"' +
                    ' data-name="' + escape(name) + '"' +
                    ' data-brand="' + escape(brandName) + '"' +
                    ' aria-label="Add ' + escape(name) + ' to cart">' + purchaseLabel + '</button>' +
            '</div>'
            : "";
        const requestPartButton = !purchasable && productId && product?.active !== false
            ? '<a class="btn btn-primary product-request-part-link" href="/' + language + '/request-part?' +
                new URLSearchParams({
                    product_id: productId,
                    part_number: partNumber,
                    product_name: name,
                    brand: brandName
                }).toString() + '" aria-label="Request a part: ' + escape(name) + '">' + requestPartLabel + '</a>'
            : "";

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
                '<div class="product-price' +
                    (discounted ? " product-price-sale" : (!purchasable ? " product-price-on-request" : "")) +
                    '" aria-label="' + (discounted ? "Sale price" : (hasMrp && !purchasable ? "Reference MRP; current price on request" : "Price")) +
                    '">' + price + "</div>" +
                purchaseControls +
                requestPartButton +
            "</div>" +
        "</article>";
    }
};
