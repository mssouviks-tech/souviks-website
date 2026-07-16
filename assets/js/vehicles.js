/*
==========================================================
SOUVIKS WEBSITE
VEHICLES MODULE
Version : 1.0
==========================================================
*/

class VehicleManager {

    constructor() {

        this.vehicles = [];

        this.filtered = [];

        this.container = null;

    }
    // ======================================================
    // INIT
    // ======================================================

    async init(

        selector = "#vehicle-grid"

    ) {

        this.container = Utils.el(

            selector

        );

        if (!this.container) {

            return;

        }

        this.vehicles =

            await API.vehicles();

        this.filtered = [

            ...this.vehicles

        ];

        this.render();

    }
    // ======================================================
    // VEHICLE CARD
    // ======================================================

    card(vehicle) {

        return `

        <article class="vehicle-card">

            <a href="${Utils.vehicleUrl(vehicle)}">

                <div class="vehicle-image">

                    <img
                        src="${vehicle.image || '/assets/images/vehicle-placeholder.webp'}"
                        alt="${vehicle.model}"
                        loading="lazy"
                    >

                </div>

                <div class="vehicle-content">

                    <h3 class="vehicle-title">

                        ${vehicle.model}

                    </h3>

                    <div class="vehicle-count">

                        ${vehicle.product_count || 0}
                        Products

                    </div>

                </div>

            </a>

        </article>

        `;

    }
    // ======================================================
    // RENDER GRID
    // ======================================================

    render() {

        if (!this.container) {

            return;

        }

        if (

            this.filtered.length === 0

        ) {

            this.container.innerHTML =

                Utils.emptyState(

                    "No vehicles found."

                );

            return;

        }

        this.container.innerHTML =

            this.filtered

                .map(

                    vehicle =>

                        this.card(

                            vehicle

                        )

                )

                .join("");

    }
    // ======================================================
    // SEARCH
    // ======================================================

    search(query) {

        if (!query) {

            this.filtered = [

                ...this.vehicles

            ];

            this.render();

            return;

        }

        query = query.toLowerCase();

        this.filtered =

            this.vehicles.filter(

                vehicle =>

                    vehicle.model

                        .toLowerCase()

                        .includes(

                            query

                        )

            );

        this.render();

    }
    // ======================================================
    // SORT
    // ======================================================

    sortByName() {

        this.filtered.sort(

            (a, b) =>

                a.model.localeCompare(

                    b.model

                )

        );

        this.render();

    }

    sortByProducts() {

        this.filtered.sort(

            (a, b) =>

                b.product_count -

                a.product_count

        );

        this.render();

    }
    // ======================================================
    // FEATURED
    // ======================================================

    featured(

        limit = 12

    ) {

        return this.vehicles

            .filter(

                vehicle =>

                    vehicle.featured === true

            )

            .slice(

                0,

                limit

            );

    }
    // ======================================================
    // VEHICLE DETAIL
    // ======================================================

    async hydrateVehiclePage() {

        const slug =

            Utils.currentSlug();

        const vehicle =

            await API.vehicleBySlug(

                slug

            );

        if (!vehicle) {

            return;

        }

        const target =

            Utils.el(

                "#vehicle-detail"

            );

        if (!target) {

            return;

        }

        target.innerHTML = `

            <div class="vehicle-detail">

                <div class="vehicle-image">

                    <img
                        src="${vehicle.image || '/assets/images/vehicle-placeholder.webp'}"
                        alt="${vehicle.model}"
                    >

                </div>

                <div class="vehicle-info">

                    <h1>

                        ${vehicle.model}

                    </h1>

                    <p>

                        ${vehicle.description || ""}

                    </p>

                    <div>

                        Products:
                        ${vehicle.product_count || 0}

                    </div>

                </div>

            </div>

        `;

const products =
    await API.productsByVehicle(
        vehicle.model
    );

const grid =
    Utils.el(
        "#product-grid"
    );
    if (
        grid &&
        products.length
    ) {

        grid.innerHTML =
            products.map(
                product =>
                    Products.card(
                        product
                    )
            ).join("");

    }

}

// ======================================================
// VEHICLE PRODUCTS
// ======================================================

async products(

    vehicleName

) {

    return await API.productsByVehicle(

        vehicleName

    );

}

    // ======================================================
    // VEHICLE META
    // ======================================================

    meta(vehicle) {

        return {

            manufacturer:

                vehicle.manufacturer ||

                {},

            variant:

                vehicle.variant ||

                "",

            generation:

                vehicle.generation ||

                "",

            fuel_type:

                vehicle.fuel_type ||

                "",

            vehicle_type:

                vehicle.vehicle_type ||

                ""

        };

    }
}

window.Vehicles = new VehicleManager();