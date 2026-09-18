/* ==========================================================
   SOUVIKS BREADCRUMB MANAGER
   Deterministic, route-safe breadcrumbs.
========================================================== */

const Breadcrumb = {

    homeUrl() {
        const language = window.souviks?.currentLanguage || "en";
        return `/${language}/`;
    },

    escape(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    reset() {},
    start() {},
    visit() {},
    replace() {},
    current() { return []; },

    render(currentPage, items = []) {
        const list = document.getElementById("breadcrumb-list");
        if (!list) return;

        const path = [{ title: "Home", url: this.homeUrl() }];
        for (const item of (Array.isArray(items) ? items : [])) {
            if (!item?.title || !item?.url) continue;
            if (item.title === "Home" || item.url === path[0].url) continue;
            path.push({ title: item.title, url: item.url });
        }

        if (path[path.length - 1]?.title !== currentPage) {
            path.push({ title: currentPage, url: "" });
        }

        list.innerHTML = path.map((item, index) => {
            const current = index === path.length - 1;
            if (current) {
                return `<li class="breadcrumb-item active" aria-current="page">${this.escape(item.title)}</li>`;
            }
            return `<li class="breadcrumb-item"><a href="${this.escape(item.url)}">${this.escape(item.title)}</a></li>`;
        }).join("");
    }
};
