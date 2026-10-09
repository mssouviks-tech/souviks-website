/* products.js module extracted from legacy section: voice-search.js */

/* Souviks — browser-native voice search */
(function () {
    "use strict";

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function localeLanguage() {
        const lang = String(document.documentElement.lang || navigator.language || "en-IN").toLowerCase();
        if (lang.startsWith("bn")) return "bn-IN";
        if (lang.startsWith("hi")) return "hi-IN";
        return "en-IN";
    }

    function initVoiceSearch() {
        const input = document.getElementById("searchInput");
        const button = document.getElementById("voiceSearch");
        if (!input || !button || !SpeechRecognition) return;

        button.hidden = false;
        input.classList.add("has-voice-search");

        let recognition = null;
        let listening = false;

        const submitSearch = () => {
            const query = String(input.value || "").trim();
            if (!query) {
                input.focus();
                return;
            }

            if (document.body.classList.contains("products-page")) {
                input.dispatchEvent(new Event("input", { bubbles: true }));
                return;
            }

            if (document.body.classList.contains("index-page")) return;

            const lang = window.souviks?.currentLanguage || document.documentElement.lang || "en";
            const url = new URL(`/${lang}/products`, window.location.origin);
            url.searchParams.set("q", query);
            window.location.assign(url.pathname + url.search);
        };

        document.getElementById("searchButton")?.addEventListener("click", submitSearch);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !document.body.classList.contains("index-page")) {
                event.preventDefault();
                submitSearch();
            }
        });

        const setState = active => {
            listening = active;
            button.classList.toggle("is-listening", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
            button.setAttribute("title", active ? "Listening…" : "Voice search");
            button.setAttribute("aria-label", active ? "Listening for your search" : "Voice search");
        };

        const start = () => {
            if (listening) {
                recognition?.stop();
                return;
            }

            recognition = new SpeechRecognition();
            recognition.lang = localeLanguage();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setState(true);
            recognition.onresult = event => {
                const transcript = Array.from(event.results || [])
                    .map(result => result?.[0]?.transcript || "")
                    .join(" ")
                    .trim();
                if (!transcript) return;
                input.value = transcript;
                input.dispatchEvent(new Event("input", { bubbles: true }));
            };
            recognition.onerror = event => {
                setState(false);
                if (event?.error === "not-allowed") {
                    button.title = "Microphone permission is blocked";
                }
            };
            recognition.onend = () => setState(false);

            try {
                recognition.start();
            } catch (error) {
                setState(false);
            }
        };

        button.addEventListener("click", start);
    }

    window.SouviksVoiceSearch = { init: initVoiceSearch };

    document.addEventListener("DOMContentLoaded", initVoiceSearch);
})();
