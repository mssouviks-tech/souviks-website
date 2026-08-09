document.addEventListener(
    "DOMContentLoaded",
    () => {

        const button =
            document.getElementById(
                "mobileMenuButton"
            );

        const navigation =
            document.getElementById(
                "mobileNavigation"
            );

        if (
            !button ||
            !navigation
        ) {
            return;
        }

        button.setAttribute(
            "aria-expanded",
            "false"
        );

        button.addEventListener(
            "click",
            () => {

                const isOpen =
                    navigation.classList.toggle(
                        "active"
                    );

                button.setAttribute(
                    "aria-expanded",
                    isOpen
                );

            }
        );

    }
);