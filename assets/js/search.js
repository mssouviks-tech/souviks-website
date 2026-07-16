/*
==========================================================
SOUVIKS WEBSITE
SEARCH MODULE
Version : 1.0
==========================================================
*/

class SearchManager {

    constructor() {

        this.index = [];

        this.results = [];

        this.input = null;

        this.resultsContainer = null;

        this.activeIndex = -1;

    }
    // ======================================================
    // INIT
    // ======================================================

    async init(

        inputSelector = "#search-input",

        resultsSelector = "#search-results"

    ) {

        this.input = Utils.el(

            inputSelector

        );

        this.resultsContainer = Utils.el(

            resultsSelector

        );

        if (

            !this.input ||

            !this.resultsContainer

        ) {

            return;

        }

        this.index = await API.searchIndex();

        this.bindEvents();

    }
    // ======================================================
    // EVENTS
    // ======================================================

    bindEvents() {

        this.input.addEventListener(

            "input",

            Utils.debounce(

                event => {

                    this.search(

                        event.target.value

                    );

                },

                250

            )

        );

        this.input.addEventListener(

            "keydown",

            event =>

                this.handleKeyboard(

                    event

                )

        );

        document.addEventListener(

            "click",

            event => {

                if (

                    !this.resultsContainer.contains(

                        event.target

                    ) &&

                    event.target !== this.input

                ) {

                    this.clear();

                }

            }

        );

    }
    // ======================================================
    // SEARCH
    // ======================================================

    search(query) {

        query = query

            .trim()

            .toLowerCase();

        if (!query) {

            this.clear();

            return;

        }

        this.results =

            this.index

                .filter(item => {

                    const titleMatch =

                        item.title

                            ?.toLowerCase()

                            .includes(query);

                    const keywordMatch =

                        item.keywords

                            ?.join(" ")

                            .toLowerCase()

                            .includes(query);

                    const partMatch =

                        item.part_number

                            ?.toLowerCase()

                            .includes(query);

                    return (

                        titleMatch ||

                        keywordMatch ||

                        partMatch

                    );

                })

                .sort(

                    (

                        a,

                        b

                    ) =>

                        b.weight -

                        a.weight

                )

                .slice(

                    0,

                    20

                );

        this.render();

    }
    // ======================================================
    // RESULT CARD
    // ======================================================

    resultCard(item) {

        return `

        <a

            href="${item.url}"

            class="search-result"

        >

            <div class="search-type">

                ${item.type}

            </div>

            <div class="search-content">

                <div class="search-title">

                    ${item.title}

                </div>

                <div class="search-subtitle">

                    ${item.subtitle || ""}

                </div>

            </div>

        </a>

        `;

    }

    // ======================================================
    // RENDER
    // ======================================================

    render() {

        if (

            !this.results ||

            this.results.length === 0

        ) {

            this.resultsContainer.innerHTML =

                Utils.emptyState(

                    "No results found."

                );

            return;

        }

        this.resultsContainer.innerHTML =

            this.results

                .map(

                    item =>

                        this.resultCard(

                            item

                        )

                )

                .join("");

    }

    // ======================================================
    // KEYBOARD
    // ======================================================

    handleKeyboard(event) {

        const items =

            Utils.els(

                ".search-result"

            );

        if (

            items.length === 0

        ) {

            return;

        }

        if (

            event.key ===

            "ArrowDown"

        ) {

            event.preventDefault();

            this.activeIndex++;

        }

        if (

            event.key ===

            "ArrowUp"

        ) {

            event.preventDefault();

            this.activeIndex--;

        }

        if (

            this.activeIndex < 0

        ) {

            this.activeIndex = 0;

        }

        if (

            this.activeIndex >=

            items.length

        ) {

            this.activeIndex =

                items.length - 1;

        }

        items.forEach(

            item =>

                item.classList.remove(

                    "active"

                )

        );

        items[

            this.activeIndex

        ].classList.add(

            "active"

        );

        if (

            event.key ===

            "Enter"

        ) {

            items[

                this.activeIndex

            ].click();

        }

    }

    // ======================================================
    // CLEAR
    // ======================================================

    clear() {

        this.results = [];

        this.activeIndex = -1;

        if (

            this.resultsContainer

        ) {

            this.resultsContainer.innerHTML = "";

        }

    }

}

const Search = new SearchManager();