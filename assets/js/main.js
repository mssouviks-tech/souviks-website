console.log("Souviks Core Loaded");

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

        if(
            !button ||
            !navigation
        ){
            return;
        }

        button.addEventListener(
            "click",
            () => {

                navigation.classList.toggle(
                    "active"
                );

                button.setAttribute(
                    "aria-expanded",
                    navigation.classList.contains(
                        "active"
                    )
                );

            }
        );

    }
);