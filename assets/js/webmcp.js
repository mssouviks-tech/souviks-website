/*
==========================================================
SOUVIKS WEBSITE
WEBMCP / BROWSER AGENT TOOLS
Version : 1.1
==========================================================
*/

(function () {

    "use strict";

    function getModelContext() {
        return navigator.modelContext || document.modelContext || null;
    }

    function jsonResponse(data) {
        return {
            content: [{
                type: "text",
                text: JSON.stringify(data)
            }]
        };
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    async function getJson(path, message) {
        const response = await fetch(path, {
            headers: { "Accept": "application/json" }
        });
        if (!response.ok) {
            throw new Error(message);
        }
        return await response.json();
    }

    async function initialiseWebMCP() {
        const modelContext = getModelContext();

        if (!modelContext || typeof modelContext.registerTool !== "function") {
            return;
        }

        const controllers = [];

        async function register(tool) {
            const controller = new AbortController();
            try {
                await modelContext.registerTool(tool, {
                    signal: controller.signal
                });
                controllers.push(controller);
            } catch (error) {
                console.warn(
                    "Souviks WebMCP tool registration failed:",
                    tool.name,
                    error
                );
            }
        }

        const handlers = {
            souviks_search: async ({ query, limit = 10 }) => {
                const index = await getJson("/assets/data/search.json", "Unable to load catalogue search index.");
                const needle = normalize(query);
                if (!needle) return jsonResponse([]);
                const results = index
                    .map((item) => {
                        const fields = [
                            normalize(item.part_number),
                            normalize(item.title),
                            normalize(item.subtitle),
                            normalize(item.description),
                            normalize(Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords),
                            normalize(Array.isArray(item.applications) ? item.applications.join(" ") : item.applications),
                            normalize(Array.isArray(item.vehicles) ? item.vehicles.join(" ") : item.vehicles)
                        ];
                        let score = 0;
                        const part = fields[0];
                        if (part === needle) score += 1000;
                        else if (part.includes(needle)) score += 700;
                        if (fields[1].includes(needle)) score += 400;
                        if (fields[2].includes(needle)) score += 150;
                        if (fields.slice(3).some((field) => field.includes(needle))) score += 100;
                        return { item, score };
                    })
                    .filter((entry) => entry.score > 0)
                    .sort((a, b) => (b.score - a.score) || String(a.item.title || "").localeCompare(String(b.item.title || "")))
                    .slice(0, Math.min(Number(limit) || 10, 20))
                    .map((entry) => entry.item);
                return jsonResponse(results);
            },
            souviks_get_product: async ({ partNumber, id, slug }) => {
                const products = await getJson("/assets/data/products.json", "Unable to load product catalogue.");
                const targetPart = normalize(partNumber);
                const targetId = normalize(id);
                const targetSlug = normalize(slug);
                const product = products.find((item) => {
                    if (targetId && normalize(item.id) === targetId) return true;
                    if (targetSlug && normalize(item.slug) === targetSlug) return true;
                    return targetPart && normalize(item.part_number || item.partNumber) === targetPart;
                });
                return jsonResponse(product ? { found: true, product } : { found: false });
            },
            souviks_get_brand: async ({ id, slug, name }) => {
                const items = await getJson("/assets/data/brands.json", "Unable to load brand index.");
                const a = normalize(id), b = normalize(slug), c = normalize(name);
                const item = items.find((x) => (a && normalize(x.id) === a) || (b && normalize(x.slug) === b) || (c && normalize(x.name) === c));
                return jsonResponse(item ? { found: true, brand: item } : { found: false });
            },
            souviks_get_category: async ({ id, slug, name }) => {
                const items = await getJson("/assets/data/categories.json", "Unable to load category index.");
                const a = normalize(id), b = normalize(slug), c = normalize(name);
                const item = items.find((x) => (a && normalize(x.id) === a) || (b && normalize(x.slug) === b) || (c && normalize(x.name) === c));
                return jsonResponse(item ? { found: true, category: item } : { found: false });
            },
            souviks_get_vehicle: async ({ id, slug, model }) => {
                const items = await getJson("/assets/data/vehicles.json", "Unable to load vehicle index.");
                const a = normalize(id), b = normalize(slug), c = normalize(model);
                const item = items.find((x) => (a && normalize(x.id) === a) || (b && normalize(x.slug) === b) || (c && normalize(x.model) === c));
                return jsonResponse(item ? { found: true, vehicle: item } : { found: false });
            },
            souviks_get_catalogue: async ({ resource }) => {
                const paths = {
                    products: "/assets/data/products.json",
                    brands: "/assets/data/brands.json",
                    categories: "/assets/data/categories.json",
                    vehicles: "/assets/data/vehicles.json",
                    search: "/assets/data/search.json"
                };
                const path = paths[resource];
                if (!path) throw new Error("Unknown catalogue resource.");
                return jsonResponse(await getJson(path, "Unable to load catalogue resource."));
            },
            souviks_navigate: async ({ destination }) => {
                const destinations = {
                    home: "/en/",
                    products: "/en/products.html",
                    brands: "/en/brands.html",
                    categories: "/en/categories.html",
                    vehicles: "/en/vehicles.html"
                };
                const path = destinations[destination];
                if (!path) throw new Error("Unknown Souviks destination.");
                window.location.assign(path);
                return jsonResponse({ navigatedTo: new URL(path, window.location.origin).href });
            }
        };

        async function loadToolManifest() {
            const manifest = await getJson("/assets/data/agent/tools.json", "Unable to load Souviks agent tool manifest.");
            return Array.isArray(manifest?.tools) ? manifest.tools : [];
        }

        const toolManifest = await loadToolManifest();

        await Promise.all(
            toolManifest.map(async (tool) => {
                const execute = handlers[tool.name];
                if (typeof execute !== "function") {
                    console.warn("Souviks WebMCP tool has no execution handler:", tool.name);
                    return;
                }
                await register({
                    name: tool.name,
                    title: tool.title,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    annotations: tool.annotations,
                    execute
                });
            })
        );

        window.souviksWebMCP = {
            controllers,
            unregister() {
                controllers.forEach((controller) => controller.abort());
                controllers.length = 0;
            }
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialiseWebMCP, { once: true });
    } else {
        initialiseWebMCP();
    }

})();
