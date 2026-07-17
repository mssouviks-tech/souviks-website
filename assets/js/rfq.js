window.RFQ = {

    key: "souviks_rfq"

};

RFQ.get = function(){

    return JSON.parse(

        localStorage.getItem(

            RFQ.key

        ) || "[]"

    );

};

RFQ.save = function(

    items

){

    localStorage.setItem(

        RFQ.key,

        JSON.stringify(

            items

        )

    );

};

RFQ.add = function(

    product

){

    const items =

        RFQ.get();

    const existing =

        items.find(

            item =>

                item.id === product.id

        );

    if(existing){

        existing.qty += 1;

    }

    else{

        items.push({

            ...product,

            qty:1

        });

    }

    RFQ.save(

        items

    );

    RFQ.updateBadge();

};

RFQ.updateBadge = function(){

    const total =

        RFQ.get()

            .reduce(

                (sum,item)=>

                    sum + item.qty,

                0

            );

    document

        .querySelectorAll(

            ".rfq-badge"

        )

        .forEach(

            badge =>

                badge.textContent =

                    total

        );

};

document.addEventListener(

    "click",

    event => {

        const button =

            event.target.closest(

                ".add-to-cart"

            );

        if(!button){

            return;

        }

        RFQ.add({

            id:
                button.dataset.id,

            partNumber:
                button.dataset.part,

            name:
                button.dataset.name,

            brand:
                button.dataset.brand

        });

        button.textContent =

            "Added";

    }

);

document.addEventListener(

    "DOMContentLoaded",

    RFQ.updateBadge

);

RFQ.renderPage = function(){

    const table =

        document.getElementById(
            "rfq-items"
        );

    if(!table){

        return;

    }

    const items = RFQ.get();

    if(!items.length){

        table.innerHTML = `

            <tr>

                <td colspan="5">

                    RFQ Basket Empty

                </td>

            </tr>

        `;

        return;

    }

    table.innerHTML =

        items.map(

            item => `

            <tr>

                <td>

                    ${item.partNumber}

                </td>

                <td>

                    ${item.name}

                </td>

                <td>

                    ${item.brand}

                </td>

                <td>

                    <div class="rfq-qty">

                        <button

                            class="qty-minus"

                            data-id="${item.id}"

                        >

                            -

                        </button>

                        <span>

                            ${item.qty}

                        </span>

                        <button

                            class="qty-plus"

                            data-id="${item.id}"

                        >

                            +

                        </button>

                    </div>

                </td>

                <td>

                    <button

                        class="remove-rfq"

                        data-id="${item.id}"

                    >

                        Remove

                    </button>

                </td>

            </tr>

            `

        ).join("");

};
document.addEventListener(

    "DOMContentLoaded",

    () => {

        RFQ.updateBadge();

        RFQ.renderPage();

    }

);

RFQ.changeQty = function(

    id,

    amount

){

    const items =

        RFQ.get();

    const item =

        items.find(

            item =>

                item.id === id

        );

    if(!item){

        return;

    }

    item.qty += amount;

    if(item.qty <= 0){

        RFQ.remove(id);

        return;

    }

    RFQ.save(items);

    RFQ.updateBadge();

    RFQ.renderPage();

};

RFQ.remove = function(id){

    const items =

        RFQ.get().filter(

            item =>

                item.id !== id

        );

    RFQ.save(items);

    RFQ.updateBadge();

    RFQ.renderPage();

};

document.addEventListener(

    "click",

    event => {

        const plus =

            event.target.closest(
                ".qty-plus"
            );

        if(plus){

            RFQ.changeQty(

                plus.dataset.id,

                1

            );

        }

        const minus =

            event.target.closest(
                ".qty-minus"
            );

        if(minus){

            RFQ.changeQty(

                minus.dataset.id,

                -1

            );

        }

        const remove =

            event.target.closest(
                ".remove-rfq"
            );

        if(remove){

            RFQ.remove(

                remove.dataset.id

            );

        }

    }

);

