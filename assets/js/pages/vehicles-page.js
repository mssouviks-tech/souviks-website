/*
==========================================================
SOUVIKS WEBSITE
VEHICLES PAGE
==========================================================
*/

let vehiclesExpanded = false;

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        await Vehicles.init(

            "#vehicle-grid"

        );

        renderVehicles(

            Vehicles.vehicles

        );

        updateCounters(

            Vehicles.vehicles

        );

        bindSearch();

        bindShowMore();

    }

);

function renderVehicles(
    vehicles
) {

    if (

        !vehicles ||

        vehicles.length === 0

    ) {

        Vehicles.container.innerHTML =

            Utils.emptyState(

                "No vehicles found."

            );

        return;

    }

    Vehicles.container.innerHTML =

        vehicles
            .map(

                vehicle =>

                    Vehicles.card(
                        vehicle
                    )

            )
            .join("");

}

function bindSearch() {

    document
        .getElementById(
            "searchInput"
        )
        ?.addEventListener(

            "input",

            event => {

                const query =

                    event.target.value
                        .trim()
                        .toLowerCase();

                let results = [

                    ...Vehicles.vehicles

                ];

                if (query) {

                    results =

                        results.filter(

                            vehicle =>

                                vehicle.name
                                    ?.toLowerCase()
                                    ?.includes(
                                        query
                                    )

                        );

                    expandVehicles();

                }

                renderVehicles(
                    results
                );

                updateCounters(
                    results
                );

            }

        );

}

function bindShowMore() {

document
    .getElementById(
        "showMoreVehicles"
    )
    ?.addEventListener(

        "click",

        () => {

            const wrapper =

                document.getElementById(
                    "vehicleDirectoryWrapper"
                );

            if (!wrapper) {

                return;

            }

            wrapper.classList.remove(
                "directory-collapsed"
            );

            wrapper.classList.add(
                "directory-expanded"
            );

            document
                .getElementById(
                    "showMoreVehicles"
                )
                ?.remove();

        }

    );

}

function expandVehicles() {

    if (

        vehiclesExpanded

    ) {

        return;

    }

    vehiclesExpanded = true;

    document.body.classList.add(

        "vehicles-expanded"

    );

    document
        .getElementById(
            "showMoreVehicles"
        )
        ?.remove();

}

function updateCounters(
    results
) {

    document
        .getElementById(
            "visibleVehicles"
        )
        ?.replaceChildren(

            document.createTextNode(

                results.length

            )

        );

}

