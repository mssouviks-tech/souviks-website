/*
==========================================================
SOUVIKS WEBSITE
CATEGORIES PAGE
==========================================================
*/

async function initialisePage() {

    await Categories.init(

        "#categoryGrid"

    );

Breadcrumb.start(
    "Categories",
    "/${LANG}/categories.html"
);

Breadcrumb.render("Categories");

}