const toggle =
    document.getElementById(
        "language-toggle"
    );

const menu =
    document.getElementById(
        "language-menu"
    );

document.querySelectorAll(
    "#language-menu a"
).forEach(
    link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const language =
                    event.currentTarget.dataset.language;

                const supported = [
                    "en",
                    "bn",
                    "hi"
                ];

                const url =
                    new URL(
                        window.location.href
                    );

                const parts =
                    url.pathname.split("/");

                if (
                    parts.length > 1 &&
                    supported.includes(
                        parts[1]
                    )
                ) {

                    parts[1] = language;

                }

                else {

                    parts.splice(
                        1,
                        0,
                        language
                    );

                }

                url.pathname =
                    parts.join("/");

                window.location.href =
                    url.toString();

            }
        );

    }
);

toggle.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        menu.classList.toggle(
            "open"
        );

        toggle.querySelector(
            ".language-arrow"
        ).textContent =
            menu.classList.contains(
                "open"
            )
            ? "▲"
            : "▼";

    }
);