/*
==========================================================
SOUVIKS WEBSITE
SHARED SEARCH ENGINE
Version : 1.0
==========================================================
*/

(function () {

    "use strict";

    const TYPE_BONUS = {
        product: 10,
        category: 100,
        brand: 200,
        vehicle: 300
    };

    const normalise = (value) =>
        String(value ?? "")
            .trim()
            .toLowerCase();

    function searchableText(value) {
        return normalise(value);
    }

    function scoreItem(item, query) {

        const needle = normalise(query);

        if (!needle) {
            return 0;
        }

        const title = searchableText(item.title);
        const subtitle = searchableText(item.subtitle);
        const partNumber = searchableText(item.part_number);
        const keywords = searchableText(
            Array.isArray(item.keywords)
                ? item.keywords.join(" ")
                : item.keywords
        );
        const description = searchableText(item.description);
        const applications = searchableText(
            Array.isArray(item.applications)
                ? item.applications.join(" ")
                : item.applications
        );
        const vehicles = searchableText(
            Array.isArray(item.vehicles)
                ? item.vehicles.join(" ")
                : item.vehicles
        );

        let score = 0;

        if (partNumber && partNumber === needle) {
            score += 1000;
        } else if (partNumber && partNumber.includes(needle)) {
            score += 700;
        }

        if (title === needle) {
            score += 900;
        } else if (title.startsWith(needle)) {
            score += 600;
        } else if (title.includes(needle)) {
            score += 350;
        }

        if (subtitle.includes(needle)) {
            score += 150;
        }

        if (keywords.includes(needle)) {
            score += 120;
        }

        if (description.includes(needle)) {
            score += 80;
        }

        if (applications.includes(needle)) {
            score += 70;
        }

        if (vehicles.includes(needle)) {
            score += 70;
        }

        score += TYPE_BONUS[
            normalise(item.type)
        ] || 0;

        return score;
    }

    function search(records, query, limit = 20) {

        const max = Math.min(
            Math.max(
                Number(limit) || 20,
                1
            ),
            100
        );

        return (Array.isArray(records) ? records : [])
            .map((item, index) => ({
                item,
                index,
                score: scoreItem(item, query)
            }))
            .filter(entry => entry.score > 0)
            .sort((a, b) =>
                b.score - a.score ||
                a.index - b.index
            )
            .slice(0, max)
            .map(entry => ({
                ...entry.item,
                score: entry.score
            }));
    }

    window.SouviksSearchEngine = {
        normalise,
        scoreItem,
        search
    };

})();
