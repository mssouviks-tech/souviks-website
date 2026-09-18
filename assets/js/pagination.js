/*
==========================================================
SOUVIKS WEBSITE
PAGINATION ENGINE
Version : 2.0
==========================================================
*/

class PaginationManager {
    constructor() {
        this.data = [];
        this.currentPage = 1;
        this.perPage = 20;
        this.totalPages = 1;
        this.container = null;
        this.onChange = null;
    }

    init({ data = [], perPage = 20, container = "#pagination", onChange = null } = {}) {
        this.data = [...data];
        this.perPage = this.normalisePerPage(perPage);
        this.currentPage = 1;
        this.container = Utils.el(container);
        this.onChange = onChange;
        this.calculate();
        this.render();
        return this.pageData();
    }

    normalisePerPage(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.floor(number) : 20;
    }

    calculate() {
        this.totalPages = Math.max(1, Math.ceil(this.data.length / this.perPage));
        this.currentPage = Math.min(this.currentPage, this.totalPages);
    }

    pageData() {
        const start = (this.currentPage - 1) * this.perPage;
        return this.data.slice(start, start + this.perPage);
    }

    update(data = []) {
        this.data = [...data];
        this.currentPage = 1;
        this.calculate();
        this.render();
        return this.pageData();
    }

    setPerPage(value, resetPage = true) {
        this.perPage = this.normalisePerPage(value);
        if (resetPage) this.currentPage = 1;
        this.calculate();
        this.render();
        return this.pageData();
    }

    previous() {
        if (this.currentPage <= 1) return;
        this.currentPage -= 1;
        this.refresh();
    }

    next() {
        if (this.currentPage >= this.totalPages) return;
        this.currentPage += 1;
        this.refresh();
    }

    go(page) {
        const target = Number(page);
        if (!Number.isFinite(target) || target < 1 || target > this.totalPages) return;
        this.currentPage = Math.floor(target);
        this.refresh();
    }

    refresh() {
        this.render();
        if (typeof this.onChange === "function") this.onChange(this.pageData());
    }

    render() {
        if (!this.container) return;

        const info = this.info();
        this.container.innerHTML = `
            <button class="pagination-prev" data-page="prev" ${info.currentPage === 1 ? "disabled" : ""}>Previous</button>
            <span class="pagination-status" aria-live="polite">Page ${info.currentPage} of ${info.totalPages}</span>
            <button class="pagination-next" data-page="next" ${info.currentPage === info.totalPages ? "disabled" : ""}>Next</button>
        `;
        this.bind();
    }

    bind() {
        this.container?.querySelectorAll("[data-page]").forEach(button => {
            button.onclick = () => {
                const value = button.dataset.page;
                if (value === "prev") return this.previous();
                if (value === "next") return this.next();
                this.go(value);
            };
        });
    }

    info() {
        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            perPage: this.perPage,
            totalRecords: this.data.length
        };
    }
}

const Pagination = new PaginationManager();
