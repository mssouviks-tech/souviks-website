/* ==========================================================
   SOUVIKS BREADCRUMB MANAGER
========================================================== */

const Breadcrumb = {

    STORAGE_KEY: "svks_breadcrumb",

    MAX_DEPTH: 6,

    /* ======================================================
       PRIVATE
    ====================================================== */

    _load() {

        const data = sessionStorage.getItem(
            this.STORAGE_KEY
        );

        if (!data) {

            return [];

        }

        try {

            return JSON.parse(data);

        }

        catch {

            return [];

        }

    },

    _save(path) {

        sessionStorage.setItem(

            this.STORAGE_KEY,

            JSON.stringify(
                this._normalize(path)
            )

        );

    },

    _normalize(path) {

        if (!Array.isArray(path)) {

            return [];

        }

        const cleaned = [];

        for (const item of path) {

            if (!item?.title || !item?.url) {

                continue;

            }

            const duplicate = cleaned.findIndex(

                crumb => crumb.url === item.url

            );

            if (duplicate >= 0) {

                cleaned.splice(

                    duplicate + 1

                );

            }

            else {

                cleaned.push({

                    title: item.title,

                    url: item.url

                });

            }

        }

        while (

            cleaned.length > this.MAX_DEPTH

        ) {

            cleaned.shift();

        }

        return cleaned;

    },

    /* ======================================================
       PUBLIC API
    ====================================================== */

    reset() {

        sessionStorage.removeItem(

            this.STORAGE_KEY

        );

    },

    start(title, url) {

        this._save([

            {

                title,

                url

            }

        ]);

    },

    visit(title, url) {

        const path = this._load();

        const existing = path.findIndex(

            item => item.url === url

        );

        if (existing >= 0) {

            path.splice(

                existing + 1

            );

        }

        else {

            path.push({

                title,

                url

            });

        }

        this._save(path);

    },

    replace(title, url) {

        const path = this._load();

        if (path.length) {

            path.pop();

        }

        path.push({

            title,

            url

        });

        this._save(path);

    },

    current() {

        return this._load();

    },

render(currentPage, fallback = []) {

    const list =
        document.getElementById("breadcrumb-list");

    if (!list) {
        return;
    }

    let path = this._load();

    if (!path.length) {
        path = [...fallback];
    }

    list.innerHTML = "";

    path.forEach(item => {

        const li =
            document.createElement("li");

        li.className =
            "breadcrumb-item";

        li.innerHTML = `
            <a href="${item.url}">
                ${item.title}
            </a>
        `;

        list.appendChild(li);

    });

    const last =
        path[path.length - 1];

    if (!last || last.title !== currentPage) {

        const current =
            document.createElement("li");

        current.className =
            "breadcrumb-item active";

        current.setAttribute(
            "aria-current",
            "page"
        );

        current.textContent =
            currentPage;

        list.appendChild(current);
    }

}

}; 

document.addEventListener(
    "click",
    event => {

        const link =
            event.target.closest("a[data-breadcrumb]");

        if (!link) {
            return;
        }

        if (link.dataset.breadcrumbType === "detail") {
            return;
        }

        Breadcrumb.visit(
            link.dataset.breadcrumb,
            link.pathname
        );

    }
);