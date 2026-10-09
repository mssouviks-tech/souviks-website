/* Extracted from the former account.js bundle: auth/vehicle-recommendations.js */

/*
==========================================================
SOUVIKS — VEHICLE PART RECOMMENDATIONS
==========================================================

Connects the customer's saved vehicles to the existing
catalogue mapping in vehicles.json and surfaces a small,
useful set of compatible products on the account dashboard.

No extra database table is required. The source of truth for
vehicle/product compatibility remains the public catalogue.
==========================================================
*/

const AccountVehicleRecommendations = {
    products: [],
    loaded: false,
    loading: false,
    loadingPromise: null,
    vehicles: [],
    selectedVehicleId: ""
};


document.addEventListener("DOMContentLoaded", () => {
    initializeVehicleRecommendations();
});


async function initializeVehicleRecommendations() {
    const root = document.getElementById("accountVehiclePartsSection");
    if (!root) return;

    bindVehicleRecommendationEvents();

}


function bindVehicleRecommendationEvents() {
    const select = document.getElementById("accountVehiclePartsVehicle");
    if (!select || select.dataset.bound === "true") return;

    select.dataset.bound = "true";
    select.addEventListener("change", () => {
        AccountVehicleRecommendations.selectedVehicleId = select.value;
        syncVehicleRecommendationRichSelect(select);
        renderVehicleRecommendations();
    });

    if (document.documentElement.dataset.vehicleRichSelectBound !== "true") {
        document.documentElement.dataset.vehicleRichSelectBound = "true";

        document.addEventListener("click", event => {
            if (!event.target.closest(".account-rich-select")) {
                closeVehicleRecommendationRichSelect();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeVehicleRecommendationRichSelect();
            }
        });
    }
}


async function loadVehicleRecommendationProducts() {
    if (AccountVehicleRecommendations.loaded) {
        return AccountVehicleRecommendations.products;
    }

    if (AccountVehicleRecommendations.loadingPromise) {
        return AccountVehicleRecommendations.loadingPromise;
    }

    AccountVehicleRecommendations.loading = true;

    AccountVehicleRecommendations.loadingPromise = fetch("/assets/data/products.json", {
        credentials: "same-origin",
        cache: "no-store"
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Product catalogue returned ${response.status}.`);
            }
            return response.json();
        })
        .then(data => {
            AccountVehicleRecommendations.products = Array.isArray(data)
                ? data.filter(product => product && product.active !== false)
                : [];
            AccountVehicleRecommendations.loaded = true;
            return AccountVehicleRecommendations.products;
        })
        .finally(() => {
            AccountVehicleRecommendations.loading = false;
            AccountVehicleRecommendations.loadingPromise = null;
        });

    return AccountVehicleRecommendations.loadingPromise;
}


window.renderAccountVehicleRecommendations = async function(savedVehicles = []) {
    const root = document.getElementById("accountVehiclePartsSection");
    if (!root) return;

    AccountVehicleRecommendations.vehicles = Array.isArray(savedVehicles)
        ? savedVehicles
        : [];

    const loadingState = document.getElementById("accountVehiclePartsLoading");
    const emptyState = document.getElementById("accountVehiclePartsEmpty");
    const controls = document.getElementById("accountVehiclePartsControls");
    const list = document.getElementById("accountVehiclePartsList");

    if (!loadingState || !emptyState || !controls || !list) return;

    if (!AccountVehicleRecommendations.loaded) {
        loadingState.hidden = false;
        emptyState.hidden = true;
        controls.hidden = true;
        list.hidden = true;

        try {
            await loadVehicleRecommendationProducts();
        } catch (error) {
            SouviksErrors?.log("[Souviks Vehicle Parts] Product catalogue failed:", error, "error");
            renderVehicleRecommendationError();
            return;
        }
    }

    loadingState.hidden = true;

    if (!AccountVehicleRecommendations.vehicles.length) {
        controls.hidden = true;
        list.hidden = true;
        emptyState.hidden = false;
        emptyState.innerHTML = `
            <p>${escapeVehicleRecommendationHTML(
                getVehicleRecommendationTranslation(
                    "vehiclePartsNoVehicles",
                    "Add a vehicle to see compatible parts here."
                )
            )}</p>
            <a href="${getAccountPath("vehicles")}" class="btn btn-primary">
                ${escapeVehicleRecommendationHTML(
                    getVehicleRecommendationTranslation(
                        "addVehicle",
                        "Add Vehicle"
                    )
                )}
            </a>
        `;
        return;
    }

    emptyState.hidden = true;
    controls.hidden = false;
    list.hidden = false;

    populateVehicleRecommendationSelect();
    renderVehicleRecommendations();
};


function populateVehicleRecommendationSelect() {
    const select = document.getElementById("accountVehiclePartsVehicle");
    if (!select) return;

    const existing = AccountVehicleRecommendations.vehicles.find(vehicle =>
        String(vehicle.id) === String(AccountVehicleRecommendations.selectedVehicleId)
    );

    if (!existing) {
        AccountVehicleRecommendations.selectedVehicleId = String(
            AccountVehicleRecommendations.vehicles[0]?.id || ""
        );
    }

    select.innerHTML = AccountVehicleRecommendations.vehicles.map(vehicle => {
        const catalogue = findCatalogueVehicle(vehicle.vehicle_id);
        const model = vehicle.vehicle_model || catalogue?.model || vehicle.vehicle_id || "Vehicle";
        const label = vehicle.nickname
            ? `${vehicle.nickname} — ${model}`
            : model;

        return `
            <option value="${escapeVehicleRecommendationAttr(vehicle.id)}">
                ${escapeVehicleRecommendationHTML(label)}
            </option>
        `;
    }).join("");

    select.value = AccountVehicleRecommendations.selectedVehicleId;
    renderVehicleRecommendationRichSelect(select);
}


function getVehicleFamily(model = "") {
    const name = String(model || "").trim().toLowerCase();

    if (name.includes("tata")) return { key: "tata", label: "Tata", icon: "/assets/icons/vehicle.svg" };
    if (name.includes("ashok leyland") || name.includes("ashok")) return { key: "ashok-leyland", label: "Ashok Leyland", icon: "/assets/icons/vehicle.svg" };
    if (name.includes("mahindra")) return { key: "mahindra", label: "Mahindra", icon: "/assets/icons/vehicle.svg" };
    if (name.includes("eicher")) return { key: "eicher", label: "Eicher", icon: "/assets/icons/vehicle.svg" };
    if (name.includes("bharatbenz") || name.includes("bharat benz")) return { key: "bharatbenz", label: "BharatBenz", icon: "/assets/icons/vehicle.svg" };
    if (/tractor|swaraj|massey|farmtrac|sonalika|deutz|utility/.test(name)) {
        return { key: "utility", label: "Tractors & Utility", icon: "/assets/icons/vehicle.svg" };
    }

    return { key: "other", label: "Other Vehicles", icon: "/assets/icons/vehicle.svg" };
}


function getVehicleCatalogueImage(catalogueVehicle) {
    return String(
        catalogueVehicle?.image ||
        catalogueVehicle?.cutout ||
        catalogueVehicle?.hero ||
        ""
    ).trim() || "/assets/images/placeholder.webp";
}


function getSavedVehicleDisplay(vehicle) {
    const catalogue = findCatalogueVehicle(vehicle.vehicle_id);
    const model = String(
        vehicle.vehicle_model ||
        catalogue?.model ||
        vehicle.vehicle_id ||
        "Vehicle"
    ).trim();

    return {
        catalogue,
        model,
        primary: String(vehicle.nickname || model).trim(),
        secondary: vehicle.nickname ? model : ""
    };
}


function renderVehicleRecommendationRichSelect(select) {
    if (!select) return;

    let wrapper = select.parentElement?.querySelector(".account-rich-select");

    if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "account-rich-select";
        wrapper.innerHTML = `
            <button
                type="button"
                class="account-rich-select-trigger"
                aria-haspopup="listbox"
                aria-expanded="false">
            </button>
            <div
                class="account-rich-select-panel"
                role="listbox"
                hidden>
            </div>
        `;
        select.insertAdjacentElement("afterend", wrapper);

        const trigger = wrapper.querySelector(".account-rich-select-trigger");
        trigger.addEventListener("click", () => {
            const expanded = trigger.getAttribute("aria-expanded") === "true";
            if (expanded) {
                closeVehicleRecommendationRichSelect();
            } else {
                closeVehicleRecommendationRichSelect();
                trigger.setAttribute("aria-expanded", "true");
                wrapper.querySelector(".account-rich-select-panel").hidden = false;
            }
        });
    }

    select.classList.add("account-rich-select-source");

    const panel = wrapper.querySelector(".account-rich-select-panel");
    const selectedId = String(AccountVehicleRecommendations.selectedVehicleId || select.value || "");
    const groups = new Map();

    AccountVehicleRecommendations.vehicles.forEach(vehicle => {
        const display = getSavedVehicleDisplay(vehicle);
        const family = getVehicleFamily(display.model);
        if (!groups.has(family.key)) {
            groups.set(family.key, { family, vehicles: [] });
        }
        groups.get(family.key).vehicles.push({ vehicle, display });
    });

    panel.innerHTML = Array.from(groups.values()).map(group => `
        <section class="account-rich-select-group">
            <div class="account-rich-select-group-label">
                <span class="account-rich-select-group-icon" aria-hidden="true"><img src="/assets/icons/vehicle.svg" alt="" width="24" height="24"></span>
                <span>${escapeVehicleRecommendationHTML(group.family.label)}</span>
            </div>
            <div>
                ${group.vehicles.map(({ vehicle, display }) => {
                    const id = String(vehicle.id);
                    const selected = id === selectedId;
                    const image = getVehicleCatalogueImage(display.catalogue);
                    return `
                        <button
                            type="button"
                            class="account-rich-select-option"
                            role="option"
                            aria-selected="${selected ? "true" : "false"}"
                            data-vehicle-recommendation-id="${escapeVehicleRecommendationAttr(id)}">
                            <span class="account-rich-select-option-thumb">
                                <img
                                    src="${escapeVehicleRecommendationAttr(image)}"
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    onerror="this.onerror=null;this.src='/assets/images/placeholder.webp';">
                            </span>
                            <span class="account-rich-select-option-copy">
                                <strong>${escapeVehicleRecommendationHTML(display.primary)}</strong>
                                ${display.secondary ? `<small>${escapeVehicleRecommendationHTML(display.secondary)}</small>` : ""}
                            </span>
                            <span class="account-rich-select-option-check" aria-hidden="true">${selected ? "✓" : ""}</span>
                        </button>
                    `;
                }).join("")}
            </div>
        </section>
    `).join("");

    panel.querySelectorAll("[data-vehicle-recommendation-id]").forEach(option => {
        option.addEventListener("click", () => {
            const value = option.getAttribute("data-vehicle-recommendation-id") || "";
            select.value = value;
            AccountVehicleRecommendations.selectedVehicleId = value;
            syncVehicleRecommendationRichSelect(select);
            closeVehicleRecommendationRichSelect();
            select.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });

    syncVehicleRecommendationRichSelect(select);
}


function syncVehicleRecommendationRichSelect(select) {
    if (!select) return;

    const wrapper = select.parentElement?.querySelector(".account-rich-select");
    if (!wrapper) return;

    const trigger = wrapper.querySelector(".account-rich-select-trigger");
    const current = AccountVehicleRecommendations.vehicles.find(vehicle =>
        String(vehicle.id) === String(select.value)
    );

    if (!trigger || !current) return;

    const display = getSavedVehicleDisplay(current);
    const image = getVehicleCatalogueImage(display.catalogue);

    trigger.innerHTML = `
        <span class="account-rich-select-trigger-thumb">
            <img
                src="${escapeVehicleRecommendationAttr(image)}"
                alt=""
                loading="lazy"
                decoding="async"
                onerror="this.onerror=null;this.src='/assets/images/placeholder.webp';">
        </span>
        <span class="account-rich-select-trigger-copy">
            <strong>${escapeVehicleRecommendationHTML(display.primary)}</strong>
            ${display.secondary ? `<small>${escapeVehicleRecommendationHTML(display.secondary)}</small>` : ""}
        </span>
        <span class="account-rich-select-chevron" aria-hidden="true">⌄</span>
    `;

    wrapper.querySelectorAll("[data-vehicle-recommendation-id]").forEach(option => {
        const selected = String(option.getAttribute("data-vehicle-recommendation-id")) === String(select.value);
        option.setAttribute("aria-selected", selected ? "true" : "false");
        const check = option.querySelector(".account-rich-select-option-check");
        if (check) check.textContent = selected ? "✓" : "";
    });
}


function closeVehicleRecommendationRichSelect() {
    document.querySelectorAll(".account-rich-select").forEach(wrapper => {
        const trigger = wrapper.querySelector(".account-rich-select-trigger");
        const panel = wrapper.querySelector(".account-rich-select-panel");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        if (panel) panel.hidden = true;
    });
}



function renderVehicleRecommendations() {
    const selected = AccountVehicleRecommendations.vehicles.find(vehicle =>
        String(vehicle.id) === String(AccountVehicleRecommendations.selectedVehicleId)
    );

    const list = document.getElementById("accountVehiclePartsList");
    const count = document.getElementById("accountVehiclePartsCount");
    const title = document.getElementById("accountVehiclePartsSelectedTitle");
    const browse = document.getElementById("accountVehiclePartsBrowse");

    if (!list || !count || !title || !browse) return;

    if (!selected) {
        list.innerHTML = "";
        count.textContent = "";
        title.textContent = "";
        browse.hidden = true;
        return;
    }

    const catalogueVehicle = findCatalogueVehicle(selected.vehicle_id);
    const products = resolveVehicleProducts(catalogueVehicle, selected.vehicle_model);

    const visibleProducts = products.slice(0, 4);

    const model = selected.vehicle_model || catalogueVehicle?.model || selected.vehicle_id || "Vehicle";
    const label = selected.nickname
        ? `${selected.nickname} · ${model}`
        : model;

    title.textContent = label;
    count.textContent = `${products.length} ${getVehicleRecommendationTranslation(
        "vehiclePartsCompatibleCount",
        "compatible parts"
    )}`;

    if (catalogueVehicle?.slug) {
        browse.hidden = false;
        browse.href = getVehiclePath(catalogueVehicle.slug);
    } else {
        browse.hidden = true;
    }

    if (!visibleProducts.length) {
        list.innerHTML = `
            <div class="account-vehicle-parts-empty-inline">
                ${escapeVehicleRecommendationHTML(
                    getVehicleRecommendationTranslation(
                        "vehiclePartsNoMappedProducts",
                        "No compatible products are mapped to this vehicle yet."
                    )
                )}
            </div>
        `;
        return;
    }

    list.innerHTML = visibleProducts
        .map(renderVehicleRecommendationCard)
        .join("");
}


function resolveVehicleProducts(catalogueVehicle, vehicleModel = "") {
    const productMap = new Map(
        AccountVehicleRecommendations.products.map(product => [String(product.id), product])
    );

    if (Array.isArray(catalogueVehicle?.products) && catalogueVehicle.products.length) {
        return catalogueVehicle.products
            .map(id => productMap.get(String(id)))
            .filter(Boolean)
            .filter(product => product.active !== false);
    }

    const target = normalizeVehicleName(vehicleModel);
    if (!target) return [];

    return AccountVehicleRecommendations.products
        .filter(product => Array.isArray(product.vehicles))
        .filter(product => product.vehicles.some(name => normalizeVehicleName(name) === target))
        .slice(0, 50);
}


function renderVehicleRecommendationCard(product) {
    const image = String(
        product.image_url ||
        (product.image_folder && product.gallery?.[0]
            ? `/assets/images/products/${product.image_folder}/${product.gallery[0]}`
            : product.primary_image || "")
    ).trim() || "/assets/images/placeholder.webp";

    const productName = product.product_name || product.name || "Product";
    const brand = product.brand_name || product.brand || "";
    const part = product.part_number || product.partNumber || "";
    const sale = Number(product.selling_price);
    const mrp = Number(product.mrp);
    const hasSale = Number.isFinite(sale) && sale > 0;
    const hasMrp = Number.isFinite(mrp) && mrp > 0;
    const hasDiscount = hasSale && hasMrp && sale < mrp;

    let pricing = `<span class="account-vehicle-part-price-request">${escapeVehicleRecommendationHTML(
        getVehicleRecommendationTranslation("priceOnRequest", "Price on request")
    )}</span>`;

    if (hasSale) {
        pricing = `
            <span class="account-vehicle-part-price">₹${sale.toLocaleString("en-IN")}</span>
            ${hasDiscount ? `<span class="account-vehicle-part-mrp">₹${mrp.toLocaleString("en-IN")}</span>` : ""}
            ${hasDiscount ? `<span class="account-vehicle-part-discount">${Math.round(((mrp - sale) / mrp) * 100)}% OFF</span>` : ""}
        `;
    } else if (hasMrp) {
        pricing = `<span class="account-vehicle-part-price">₹${mrp.toLocaleString("en-IN")}</span>`;
    }

    const productUrl = getProductUrl(product);

    return `
        <article class="account-vehicle-part-card">
            <a href="${escapeVehicleRecommendationAttr(productUrl)}" class="account-vehicle-part-image">
                <img
                    src="${escapeVehicleRecommendationAttr(image)}"
                    alt="${escapeVehicleRecommendationAttr(productName)}"
                    loading="lazy"
                    decoding="async"
                    onerror="this.onerror=null;this.src='/assets/images/placeholder.webp';">
            </a>
            <div class="account-vehicle-part-content">
                <span class="account-vehicle-part-brand">${escapeVehicleRecommendationHTML(brand)}</span>
                <h4>
                    <a href="${escapeVehicleRecommendationAttr(productUrl)}">
                        ${escapeVehicleRecommendationHTML(productName)}
                    </a>
                </h4>
                ${part ? `<span class="account-vehicle-part-number">${escapeVehicleRecommendationHTML(part)}</span>` : ""}
                <div class="account-vehicle-part-pricing">${pricing}</div>
                <button
                    type="button"
                    class="btn btn-primary add-to-cart account-vehicle-part-rfq"
                    data-id="${escapeVehicleRecommendationAttr(product.id)}"
                    data-part="${escapeVehicleRecommendationAttr(part)}"
                    data-name="${escapeVehicleRecommendationAttr(productName)}"
                    data-brand="${escapeVehicleRecommendationAttr(brand)}">
                    ${escapeVehicleRecommendationHTML(
                        getVehicleRecommendationTranslation("addToRFQ", "Add to RFQ")
                    )}
                </button>
            </div>
        </article>
    `;
}


function findCatalogueVehicle(vehicleId) {
    const catalogue = Array.isArray(window.AccountVehiclesState?.catalogue)
        ? window.AccountVehiclesState.catalogue
        : [];

    return catalogue.find(vehicle => String(vehicle.id) === String(vehicleId)) || null;
}


function normalizeVehicleName(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}


function getProductUrl(product) {
    const lang = document.documentElement.lang || window.souviks?.currentLanguage || "en";
    const slug = product.slug || "";
    return `/${encodeURIComponent(lang)}/products/${encodeURIComponent(slug)}`;
}


function getVehiclePath(slug) {
    const lang = document.documentElement.lang || window.souviks?.currentLanguage || "en";
    return `/${encodeURIComponent(lang)}/vehicles/${encodeURIComponent(slug)}`;
}


function getAccountPath(view) {
    const lang = document.documentElement.lang || window.souviks?.currentLanguage || "en";
    return `/${encodeURIComponent(lang)}/account?view=${encodeURIComponent(view)}`;
}


function renderVehicleRecommendationError() {
    const loading = document.getElementById("accountVehiclePartsLoading");
    const empty = document.getElementById("accountVehiclePartsEmpty");
    const controls = document.getElementById("accountVehiclePartsControls");
    const list = document.getElementById("accountVehiclePartsList");

    if (loading) loading.hidden = true;
    if (controls) controls.hidden = true;
    if (list) list.hidden = true;

    if (empty) {
        empty.hidden = false;
        empty.innerHTML = `
            <p>${escapeVehicleRecommendationHTML(
                getVehicleRecommendationTranslation(
                    "vehiclePartsLoadError",
                    "Compatible parts could not be loaded right now."
                )
            )}</p>
        `;
    }
}


function getVehicleRecommendationTranslation(key, fallback) {
    const messages = document.getElementById("accountMessages");
    if (!messages) return fallback;

    return messages.dataset[key] || fallback;
}


function escapeVehicleRecommendationHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeVehicleRecommendationAttr(value) {
    return escapeVehicleRecommendationHTML(value);
}
