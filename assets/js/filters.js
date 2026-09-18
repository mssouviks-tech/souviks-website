/*
==========================================================
SOUVIKS WEBSITE
FILTER ENGINE
Version : 1.0
==========================================================
*/

class FilterManager {

    constructor() {

        this.original = [];

        this.filtered = [];

        this.filters = {};

    }
    // ======================================================
    // INIT
    // ======================================================

    init(data = []) {

        this.original = [...data];

        this.filtered = [...data];

        this.filters = {};

        return this.filtered;

    }
    // ======================================================
    // SET FILTER
    // ======================================================

    set(key, value) {

        if (

            value === null ||

            value === undefined ||

            value === ""

        ) {

            delete this.filters[key];

        }

        else {

            this.filters[key] = value;

        }

        return this.apply();

    }
    // ======================================================
    // REMOVE FILTER
    // ======================================================

    remove(key) {

        delete this.filters[key];

        return this.apply();

    }

    // ======================================================
    // CLEAR ALL
    // ======================================================

    clear() {

        this.filters = {};

        this.filtered = [

            ...this.original

        ];

        return this.filtered;

    }
    // ======================================================
    // APPLY
    // ======================================================

    apply() {

        this.filtered = this.original.filter(

            item => {

                return Object.entries(

                    this.filters

                ).every(

                    ([key, value]) => {

                        const field = item[key];

                        if (

                            Array.isArray(

                                field

                            )

                        ) {

                            return field.includes(

                                value

                            );

                        }

                        return field === value;

                    }

                );

            }

        );

        return this.filtered;

    }
    // ======================================================
    // SEARCH
    // ======================================================

    search(

        query,

        fields = []

    ) {

        if (!query) {

            return this.filtered;

        }

        query = query.toLowerCase();

        return this.filtered.filter(

            item => {

                return fields.some(

                    field => {

                        const value =

                            item[field];

                        if (

                            value === null ||

                            value === undefined

                        ) {

                            return false;

                        }

                        return String(

                            value

                        )

                        .toLowerCase()

                        .includes(

                            query

                        );

                    }

                );

            }

        );

    }
    // ======================================================
    // SORT
    // ======================================================

    sort(

        field,

        direction = "asc"

    ) {

        const multiplier =

            direction === "desc"

                ? -1

                : 1;

        this.filtered.sort(

            (a, b) => {

                const first =

                    a[field] ?? "";

                const second =

                    b[field] ?? "";

                if (

                    first < second

                ) {

                    return -1 *

                        multiplier;

                }

                if (

                    first > second

                ) {

                    return 1 *

                        multiplier;

                }

                return 0;

            }

        );

        return this.filtered;

    }
    // ======================================================
    // COUNTS
    // ======================================================

    counts(field) {

        const counts = {};

        this.original.forEach(

            item => {

                const value =

                    item[field];

                if (

                    value === null ||

                    value === undefined ||

                    value === ""

                ) {

                    return;

                }

                counts[value] =

                    (counts[value] || 0)

                    + 1;

            }

        );

        return counts;

    }
    // ======================================================
    // RESULTS
    // ======================================================

    results() {

        return this.filtered;

    }

    // ======================================================
    // TOTAL
    // ======================================================

    total() {

        return this.filtered.length;

    }
}

const Filters = new FilterManager();