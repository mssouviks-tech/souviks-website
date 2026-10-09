/* Extracted from the former account.js bundle: analytics/account-analytics.js */

(() => {
    "use strict";

    const GA_MEASUREMENT_ID = "G-FDLYP5QB8V";

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
        window.dataLayer.push(arguments);
    };

    const hasMeasurementScript = Array.from(document.scripts || []).some(script =>
        String(script.src || "").includes(
            "googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID
        )
    );

    if (!hasMeasurementScript) {
        const script = document.createElement("script");
        script.async = true;
        script.src =
            "https://www.googletagmanager.com/gtag/js?id=" +
            encodeURIComponent(GA_MEASUREMENT_ID);
        document.head.appendChild(script);
        window.gtag("js", new Date());
        window.gtag("config", GA_MEASUREMENT_ID);
    }

    const analytics = window.souviksAnalytics || {};

    analytics.trackEvent = function(name, params = {}) {
        try {
            window.gtag("event", String(name || "event"), {
                ...params,
                page_location: window.location.href,
                page_title: document.title
            });
        } catch (error) {
            // Analytics must never interfere with account functionality.
        }
    };

    analytics.trackLead = function(type = "lead", params = {}) {
        analytics.trackEvent("generate_lead", {
            lead_type: String(type || "lead"),
            ...params
        });
    };

    window.souviksAnalytics = analytics;
})();
