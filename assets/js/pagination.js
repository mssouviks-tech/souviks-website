/*
==========================================================
SOUVIKS WEBSITE
PAGINATION ENGINE
Version : 1.0
==========================================================
*/

class PaginationManager {

    constructor() {

        this.data = [];

        this.currentPage = 1;

        this.perPage = 12;

        this.totalPages = 0;

        this.container = null;

        this.onChange = null;

    }
    // ======================================================
    // INIT
    // ======================================================

    init({

        data = [],

        perPage = 12,

        container = "#pagination",

        onChange = null

    } = {}) {

        this.data = [...data];

        this.perPage = perPage;

        this.currentPage = 1;

        this.container = Utils.el(

            container

        );

        this.onChange = onChange;

        this.calculate();

        this.render();

        return this.pageData();

    }
    // ======================================================
    // CALCULATE
    // ======================================================

    calculate() {

        this.totalPages = Math.max(

            1,

            Math.ceil(

                this.data.length /

                this.perPage

            )

        );

    }
    // ======================================================
    // PAGE DATA
    // ======================================================

    pageData() {

        const start =

            (this.currentPage - 1)

            * this.perPage;

        const end =

            start +

            this.perPage;

        return this.data.slice(

            start,

            end

        );

    }
    // ======================================================
    // UPDATE DATA
    // ======================================================

    update(data = []) {

        this.data = [...data];

        this.currentPage = 1;

        this.calculate();

        this.render();

        return this.pageData();

    }
    // ======================================================
    // PREVIOUS
    // ======================================================

    previous() {

        if (

            this.currentPage <= 1

        ) {

            return;

        }

        this.currentPage--;

        this.refresh();

    }

    // ======================================================
    // NEXT
    // ======================================================

    next() {

        if (

            this.currentPage >=

            this.totalPages

        ) {

            return;

        }

        this.currentPage++;

        this.refresh();

    }
    // ======================================================
    // GOTO
    // ======================================================

    go(page) {

        page = Number(page);

        if (

            page < 1 ||

            page > this.totalPages

        ) {

            return;

        }

        this.currentPage = page;

        this.refresh();

    }
    // ======================================================
    // REFRESH
    // ======================================================

    refresh() {

        this.render();

        if (

            typeof this.onChange ===

            "function"

        ) {

            this.onChange(

                this.pageData()

            );

        }

    }
    // ======================================================
    // RENDER
    // ======================================================

render() {

    if (!this.container) return;

    const info = this.info();

    this.container.innerHTML = `

        <button
            class="pagination-prev"
            data-page="prev"
            ${info.currentPage === 1 ? "disabled" : ""}
        >
            Previous
        </button>

        <span class="pagination-status">

            Page ${info.currentPage}
            of
            ${info.totalPages}

        </span>

        <button
            class="pagination-next"
            data-page="next"
            ${info.currentPage === info.totalPages ? "disabled" : ""}
        >
            Next
        </button>

    `;

    this.bind();

}
    // ======================================================
    // EVENTS
    // ======================================================

    bind() {

        Utils.els(

            "[data-page]"

        ).forEach(

            button => {

                button.onclick = () => {

                    const value =

                        button.dataset.page;

                    if (

                        value === "prev"

                    ) {

                        this.previous();

                        return;

                    }

                    if (

                        value === "next"

                    ) {

                        this.next();

                        return;

                    }

                    this.go(

                        value

                    );

                };

            }

        );

    }
    // ======================================================
    // INFO
    // ======================================================

    info() {

        return {

            currentPage:

                this.currentPage,

            totalPages:

                this.totalPages,

            perPage:

                this.perPage,

            totalRecords:

                this.data.length

        };

    }
}

const Pagination = new PaginationManager();