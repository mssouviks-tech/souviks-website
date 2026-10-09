/* Extracted from the former account.js bundle: auth/vehicles.js */

/*
==========================================================
SOUVIKS — MY VEHICLES
==========================================================

Persistent customer vehicle garage backed by Supabase.
The account's authenticated user_id is always used for
CRUD operations; RLS must enforce the same ownership rule.
*/

const AccountVehiclesState = {
    vehicles: [],
    catalogue: [],
    editingId: null,
    busy: false
};

window.AccountVehiclesState = AccountVehiclesState;


document.addEventListener("DOMContentLoaded", () => {
    initializeAccountVehicles();
});


async function initializeAccountVehicles() {
    if (typeof supabaseClient === "undefined") {
        console.error("[Souviks Vehicles] Supabase client unavailable.");
        return;
    }

    const list = document.getElementById("accountVehiclesList");
    if (!list) return;

    try {
        AccountVehiclesState.catalogue = await loadVehicleCatalogue();
        populateVehicleSelect();
    } catch (error) {
        SouviksErrors?.log("[Souviks Vehicles] Unable to load vehicle catalogue:", error, "error");
    }

    bindVehicleEvents();
    window.refreshAccountVehicles = loadAccountVehicles;
}


async function loadVehicleCatalogue() {
    const response = await fetch("/assets/data/vehicles.json", {
        credentials: "same-origin",
        cache: "no-store"
    });
    if (!response.ok) {
        throw new Error(`Vehicle catalogue returned ${response.status}.`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data.filter(vehicle => vehicle && vehicle.active !== false) : [];
}


function bindVehicleEvents() {
    document.getElementById("addAccountVehicle")?.addEventListener("click", () => openVehicleModal());
    document.getElementById("addFirstAccountVehicle")?.addEventListener("click", () => openVehicleModal());
    document.getElementById("cancelAccountVehicle")?.addEventListener("click", closeVehicleModal);
    document.querySelectorAll("[data-vehicle-modal-close]").forEach(element => {
        element.addEventListener("click", closeVehicleModal);
    });

    document.getElementById("accountVehicleForm")?.addEventListener("submit", event => {
        event.preventDefault();
        saveAccountVehicle();
    });

    document.getElementById("accountVehiclesList")?.addEventListener("click", event => {
        const action = event.target.closest("[data-vehicle-action]");
        if (!action) return;

        const id = action.dataset.vehicleId || "";
        const type = action.dataset.vehicleAction;

        if (type === "edit") openVehicleModal(id);
        if (type === "remove") removeAccountVehicle(id);
        if (type === "parts") openVehicleParts(id);
    });

    document.addEventListener("keydown", event => {
        const modal = document.getElementById("accountVehicleModal");
        if (event.key === "Escape" && modal && !modal.hidden) {
            closeVehicleModal();
        }
    });
}


async function getCurrentUserId() {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error("Authentication required.");
    return data.user.id;
}


async function loadAccountVehicles() {
    const loading = document.getElementById("accountVehiclesLoading");
    const empty = document.getElementById("accountVehiclesEmpty");
    const list = document.getElementById("accountVehiclesList");

    if (!loading || !empty || !list) return;

    loading.hidden = false;
    empty.hidden = true;
    list.hidden = true;
    list.innerHTML = "";
    showVehicleStatus("");

    try {
        const userId = await getCurrentUserId();
        const { data, error } = await supabaseClient
            .from("customer_vehicles")
            .select("id, vehicle_id, vehicle_model, nickname, registration_number, variant, model_year, notes, created_at, updated_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        AccountVehiclesState.vehicles = data || [];
        loading.hidden = true;

        if (typeof renderAccountVehicleRecommendations === "function") {
            renderAccountVehicleRecommendations(AccountVehiclesState.vehicles);
        }

        if (!AccountVehiclesState.vehicles.length) {
            empty.hidden = false;
            return;
        }

        list.innerHTML = AccountVehiclesState.vehicles.map(renderVehicleCard).join("");
        list.hidden = false;

    } catch (error) {
        SouviksErrors?.log("[Souviks Vehicles] Failed to load vehicles:", error, "error");
        loading.hidden = true;
        empty.hidden = false;
        empty.innerHTML = `
            <strong>${escapeVehicleHTML(getVehicleTranslation("vehiclesLoadError", "Unable to load your vehicles."))}</strong>
            <p>${escapeVehicleHTML(error?.message || getVehicleTranslation("vehiclesLoadError", "Please try again."))}</p>
            <button type="button" class="btn btn-secondary" id="retryAccountVehicles">${escapeVehicleHTML(getVehicleTranslation("vehiclesTryAgain", "Try Again"))}</button>
        `;
        document.getElementById("retryAccountVehicles")?.addEventListener("click", loadAccountVehicles, { once: true });
        showVehicleStatus(getVehicleTranslation("vehiclesSaveError", "Unable to load your vehicles. Please try again."), "error");
    }
}


function renderVehicleCard(vehicle) {
    const catalogue = AccountVehiclesState.catalogue.find(item => String(item.id) === String(vehicle.vehicle_id));
    const image = catalogue?.image || "/assets/images/placeholder.webp";
    const model = vehicle.vehicle_model || catalogue?.model || vehicle.vehicle_id || "Vehicle";
    const nickname = vehicle.nickname || "";
    const registration = vehicle.registration_number || "";
    const variant = vehicle.variant || "";
    const year = vehicle.model_year ? String(vehicle.model_year) : "";
    const meta = [variant, year].filter(Boolean).join(" · ");

    return `
        <article class="account-vehicle-card">
            <div class="account-vehicle-image">
                <img src="${escapeVehicleAttr(image)}" alt="${escapeVehicleAttr(model)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/assets/images/placeholder.webp';">
            </div>
            <div class="account-vehicle-content">
                <div class="account-vehicle-card-heading">
                    <div>
                        <span class="account-vehicle-model">${escapeVehicleHTML(model)}</span>
                        ${nickname ? `<strong class="account-vehicle-nickname">${escapeVehicleHTML(nickname)}</strong>` : ""}
                    </div>
                    ${registration ? `<span class="account-vehicle-registration">${escapeVehicleHTML(registration)}</span>` : ""}
                </div>
                ${meta ? `<p class="account-vehicle-meta">${escapeVehicleHTML(meta)}</p>` : ""}
                ${vehicle.notes ? `<p class="account-vehicle-notes">${escapeVehicleHTML(vehicle.notes)}</p>` : ""}
                <div class="account-vehicle-actions">
                    <button type="button" class="btn btn-primary" data-vehicle-action="parts" data-vehicle-id="${escapeVehicleAttr(vehicle.id)}">${escapeVehicleHTML(getVehicleTranslation("viewVehicleParts", "View Compatible Parts"))}</button>
                    <button type="button" class="btn btn-secondary" data-vehicle-action="edit" data-vehicle-id="${escapeVehicleAttr(vehicle.id)}">${escapeVehicleHTML(getVehicleTranslation("editVehicle", "Edit"))}</button>
                    <button type="button" class="btn btn-secondary" data-vehicle-action="remove" data-vehicle-id="${escapeVehicleAttr(vehicle.id)}">${escapeVehicleHTML(getVehicleTranslation("removeVehicle", "Remove"))}</button>
                </div>
            </div>
        </article>
    `;
}


function ensureVehiclePicker() {
    const select = document.getElementById("accountVehicleSelect");
    if (!select) return null;
    if (select.dataset.customPickerReady === "true") return select.closest(".account-vehicle-picker");

    const parent = select.parentElement;
    if (!parent) return null;

    const wrapper = document.createElement("div");
    wrapper.className = "account-vehicle-picker";
    parent.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    select.classList.add("account-vehicle-select-native");
    select.tabIndex = -1;
    const associatedLabel = document.querySelector('label[for="accountVehicleSelect"]');
    if (associatedLabel) associatedLabel.htmlFor = "accountVehiclePickerTrigger";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "account-vehicle-picker-trigger";
    trigger.id = "accountVehiclePickerTrigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `
        <span class="account-vehicle-picker-icon" aria-hidden="true">🚚</span>
        <span class="account-vehicle-picker-copy">
            <strong class="account-vehicle-picker-value"></strong>
            <small class="account-vehicle-picker-hint"></small>
        </span>
        <span class="account-vehicle-picker-chevron" aria-hidden="true">▾</span>
    `;

    const panel = document.createElement("div");
    panel.className = "account-vehicle-picker-panel";
    panel.id = "accountVehiclePickerPanel";
    panel.hidden = true;
    panel.setAttribute("role", "listbox");
    panel.setAttribute("aria-label", "Vehicle models");
    panel.innerHTML = `
        <input
            type="search"
            class="account-vehicle-picker-search"
            placeholder="${escapeVehicleAttr(getVehicleTranslation("searchVehicle", document.getElementById("accountMessages")?.dataset.searchVehicle || "Search vehicle..."))}"
            aria-label="${escapeVehicleAttr(getVehicleTranslation("searchVehicle", document.getElementById("accountMessages")?.dataset.searchVehicle || "Search vehicle..."))}"
            autocomplete="off">
        <div class="account-vehicle-picker-options"></div>
        <div class="account-vehicle-picker-empty" hidden>
            ${escapeVehicleHTML(getVehicleTranslation("noVehiclesFound", document.getElementById("accountMessages")?.dataset.noVehiclesFound || "No matching vehicles found."))}
        </div>
    `;

    wrapper.insertBefore(trigger, select);
    wrapper.insertBefore(panel, select);

    const valueEl = trigger.querySelector(".account-vehicle-picker-value");
    const hintEl = trigger.querySelector(".account-vehicle-picker-hint");
    const search = panel.querySelector(".account-vehicle-picker-search");
    const options = panel.querySelector(".account-vehicle-picker-options");

    const close = () => {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };

    const open = () => {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        search.value = "";
        renderVehiclePickerOptions("");
        setTimeout(() => search.focus(), 0);
    };

    const sync = () => {
        const selected = AccountVehiclesState.catalogue.find(item => String(item.id) === String(select.value));
        const model = selected?.model || "";
        valueEl.textContent = model || getVehicleTranslation("selectVehicle", "Select a vehicle");
        hintEl.textContent = model ? "Vehicle model" : "Choose from the catalogue";
        trigger.classList.toggle("has-value", !!model);
        [...options.querySelectorAll("[data-vehicle-picker-id]")].forEach(option => {
            const active = String(option.dataset.vehiclePickerId) === String(select.value);
            option.classList.toggle("is-selected", active);
            option.setAttribute("aria-selected", active ? "true" : "false");
        });
    };

    function renderVehiclePickerOptions(query) {
        const needle = String(query || "").trim().toLocaleLowerCase();
        const matches = AccountVehiclesState.catalogue.filter(vehicle =>
            String(vehicle.model || vehicle.id || "").toLocaleLowerCase().includes(needle)
        );
        options.innerHTML = matches.map(vehicle => `
            <button type="button" class="account-vehicle-picker-option" role="option"
                data-vehicle-picker-id="${escapeVehicleAttr(vehicle.id)}" aria-selected="false">
                <span class="account-vehicle-picker-option-icon" aria-hidden="true">🚚</span>
                <span class="account-vehicle-picker-option-copy">
                    <strong>${escapeVehicleHTML(vehicle.model || vehicle.id)}</strong>
                    <small>Vehicle model</small>
                </span>
            </button>
        `).join("");
        panel.querySelector(".account-vehicle-picker-empty").hidden = matches.length !== 0;
        [...options.querySelectorAll("[data-vehicle-picker-id]")].forEach(option => {
            option.addEventListener("click", () => {
                select.value = option.dataset.vehiclePickerId || "";
                select.dispatchEvent(new Event("change", { bubbles: true }));
                sync();
                close();
                trigger.focus();
            });
        });
        sync();
    }

    trigger.addEventListener("click", () => {
        if (panel.hidden) open(); else close();
    });

    search.addEventListener("input", () => renderVehiclePickerOptions(search.value));
    search.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            trigger.focus();
        }
    });

    select.addEventListener("change", sync);

    document.addEventListener("click", event => {
        if (!wrapper.contains(event.target)) close();
    });

    select.dataset.customPickerReady = "true";
    renderVehiclePickerOptions("");
    return wrapper;
}


function syncVehiclePicker() {
    const select = document.getElementById("accountVehicleSelect");
    const wrapper = select?.closest(".account-vehicle-picker");
    if (!wrapper) return;
    const trigger = wrapper.querySelector(".account-vehicle-picker-trigger");
    const valueEl = wrapper.querySelector(".account-vehicle-picker-value");
    const hintEl = wrapper.querySelector(".account-vehicle-picker-hint");
    const selected = AccountVehiclesState.catalogue.find(item => String(item.id) === String(select.value));
    const model = selected?.model || "";
    if (valueEl) valueEl.textContent = model || getVehicleTranslation("selectVehicle", "Select a vehicle");
    if (hintEl) hintEl.textContent = model ? "Vehicle model" : "Choose from the catalogue";
    trigger?.classList.toggle("has-value", !!model);
}


function populateVehicleSelect() {
    const select = document.getElementById("accountVehicleSelect");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = `<option value="">${escapeVehicleHTML(getVehicleTranslation("selectVehicle", "Select a vehicle"))}</option>` +
        AccountVehiclesState.catalogue.map(vehicle =>
            `<option value="${escapeVehicleAttr(vehicle.id)}">${escapeVehicleHTML(vehicle.model || vehicle.id)}</option>`
        ).join("");
    if (currentValue) select.value = currentValue;

    ensureVehiclePicker();
    syncVehiclePicker();
}


function openVehicleModal(vehicleId = "") {
    const modal = document.getElementById("accountVehicleModal");
    const title = document.getElementById("accountVehicleModalTitle");
    if (!modal) return;

    AccountVehiclesState.editingId = vehicleId || null;
    populateVehicleSelect();
    resetVehicleForm();

    const existing = vehicleId
        ? AccountVehiclesState.vehicles.find(vehicle => String(vehicle.id) === String(vehicleId))
        : null;

    if (existing) {
        document.getElementById("accountVehicleSelect").value = existing.vehicle_id || "";
        syncVehiclePicker();
        document.getElementById("accountVehicleLabel").value = existing.nickname || "";
        document.getElementById("accountVehicleRegistration").value = existing.registration_number || "";
        document.getElementById("accountVehicleVariant").value = existing.variant || "";
        document.getElementById("accountVehicleYear").value = existing.model_year || "";
        document.getElementById("accountVehicleNotes").value = existing.notes || "";
        title.textContent = getVehicleTranslation("editVehicleTitle", "Edit Vehicle");
    } else {
        title.textContent = getVehicleTranslation("addVehicleTitle", "Add Vehicle");
    }

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("account-vehicle-modal-open");
    setTimeout(() => document.getElementById("accountVehiclePickerTrigger")?.focus(), 0);
}


function closeVehicleModal() {
    const modal = document.getElementById("accountVehicleModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("account-vehicle-modal-open");
    AccountVehiclesState.editingId = null;
    resetVehicleForm();
}


function resetVehicleForm() {
    const form = document.getElementById("accountVehicleForm");
    if (form) form.reset();
    syncVehiclePicker();
    showVehicleFormStatus("");
    const button = document.getElementById("saveAccountVehicle");
    if (button) button.disabled = false;
}


async function saveAccountVehicle() {
    if (AccountVehiclesState.busy) return;

    const select = document.getElementById("accountVehicleSelect");
    const userLabel = document.getElementById("accountVehicleLabel");
    const registration = document.getElementById("accountVehicleRegistration");
    const variant = document.getElementById("accountVehicleVariant");
    const year = document.getElementById("accountVehicleYear");
    const notes = document.getElementById("accountVehicleNotes");
    const button = document.getElementById("saveAccountVehicle");

    const vehicleId = String(select?.value || "").trim();
    if (!vehicleId) {
        showVehicleFormStatus(getVehicleTranslation("vehicleRequired", "Please select a vehicle."), "error");
        document.getElementById("accountVehiclePickerTrigger")?.focus();
        return;
    }

    const catalogue = AccountVehiclesState.catalogue.find(item => String(item.id) === vehicleId);
    if (!catalogue) {
        showVehicleFormStatus(getVehicleTranslation("vehicleRequired", "Please select a vehicle."), "error");
        return;
    }

    const payload = {
        vehicle_id: vehicleId,
        vehicle_model: catalogue.model || vehicleId,
        nickname: String(userLabel?.value || "").trim() || null,
        registration_number: String(registration?.value || "").trim().toUpperCase() || null,
        variant: String(variant?.value || "").trim() || null,
        model_year: year?.value ? Number(year.value) : null,
        notes: String(notes?.value || "").trim() || null
    };

    if (payload.model_year && (!Number.isInteger(payload.model_year) || payload.model_year < 1950 || payload.model_year > 2100)) {
        showVehicleFormStatus(getVehicleTranslation("vehicleYearInvalid", "Please enter a valid model year."), "error");
        year?.focus();
        return;
    }

    AccountVehiclesState.busy = true;
    if (button) button.disabled = true;
    showVehicleFormStatus(getVehicleTranslation("saving", "Saving..."));

    try {
        const userId = await getCurrentUserId();
        let result;

        if (AccountVehiclesState.editingId) {
            result = await supabaseClient
                .from("customer_vehicles")
                .update(payload)
                .eq("id", AccountVehiclesState.editingId)
                .eq("user_id", userId)
                .select("id, vehicle_id, vehicle_model, nickname, registration_number, variant, model_year, notes, created_at, updated_at")
                .single();
        } else {
            result = await supabaseClient
                .from("customer_vehicles")
                .insert({ ...payload, user_id: userId })
                .select("id, vehicle_id, vehicle_model, nickname, registration_number, variant, model_year, notes, created_at, updated_at")
                .single();
        }

        if (result.error) throw result.error;

        showVehicleStatus(
            AccountVehiclesState.editingId
                ? getVehicleTranslation("vehicleUpdated", "Vehicle updated successfully.")
                : getVehicleTranslation("vehicleSaved", "Vehicle saved successfully."),
            "success"
        );
        closeVehicleModal();
        await loadAccountVehicles();
        document.getElementById("accountDashboardVehicleCount") && updateDashboardVehicleCount();

    } catch (error) {
        SouviksErrors?.log("[Souviks Vehicles] Failed to save vehicle:", error, "error");
        showVehicleFormStatus(getVehicleTranslation("vehicleSaveError", "Unable to save this vehicle. Please try again."), "error");
    } finally {
        AccountVehiclesState.busy = false;
        if (button) button.disabled = false;
    }
}


async function removeAccountVehicle(vehicleId) {
    const existing = AccountVehiclesState.vehicles.find(vehicle => String(vehicle.id) === String(vehicleId));
    if (!existing) return;

    const label = existing.nickname || existing.vehicle_model || getVehicleTranslation("myVehicles", "vehicle");
    const confirmed = window.confirm(`${getVehicleTranslation("removeVehicleConfirm", "Remove this vehicle from your account?")}\n\n${label}`);
    if (!confirmed) return;

    try {
        const userId = await getCurrentUserId();
        const { error } = await supabaseClient
            .from("customer_vehicles")
            .delete()
            .eq("id", vehicleId)
            .eq("user_id", userId);

        if (error) throw error;
        showVehicleStatus(getVehicleTranslation("vehicleRemoved", "Vehicle removed."), "success");
        await loadAccountVehicles();
        await updateDashboardVehicleCount();
    } catch (error) {
        SouviksErrors?.log("[Souviks Vehicles] Failed to remove vehicle:", error, "error");
        showVehicleStatus(getVehicleTranslation("vehicleSaveError", "Unable to update your vehicles. Please try again."), "error");
    }
}


function openVehicleParts(vehicleId) {
    const vehicle = AccountVehiclesState.catalogue.find(item => String(item.id) === String(vehicleId)) ||
        AccountVehiclesState.vehicles.find(item => String(item.id) === String(vehicleId));
    if (!vehicle) return;
    const slug = vehicle.slug || vehicle.vehicle_id || vehicleId;
    const lang = document.documentElement.lang || "en";
    window.location.href = `/${encodeURIComponent(lang)}/vehicles/${encodeURIComponent(slug)}`;
}


async function updateDashboardVehicleCount() {
    const target = document.getElementById("accountDashboardVehicleCount");
    if (!target) return;
    try {
        const userId = await getCurrentUserId();
        const { count, error } = await supabaseClient
            .from("customer_vehicles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId);
        target.textContent = error ? "—" : String(count ?? 0);
    } catch {
        target.textContent = "—";
    }
}


function showVehicleStatus(message, type = "") {
    const element = document.getElementById("accountVehiclesStatus");
    if (!element) return;
    element.textContent = message || "";
    element.className = "form-status";
    if (type) element.classList.add(type);
    element.hidden = !message;
}


function showVehicleFormStatus(message, type = "") {
    const element = document.getElementById("accountVehicleFormStatus");
    if (!element) return;
    element.textContent = message || "";
    element.className = "form-status";
    if (type) element.classList.add(type);
    element.hidden = !message;
}


function getVehicleTranslation(key, fallback) {
    const messages = document.getElementById("accountMessages");
    if (!messages) return fallback;
    const datasetKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    return messages.dataset[datasetKey] || fallback;
}


function escapeVehicleHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeVehicleAttr(value) {
    return escapeVehicleHTML(value);
}
