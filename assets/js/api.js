/*
==========================================================
SOUVIKS WEBSITE
API LAYER
Version : 1.0
==========================================================
*/

class SouviksAPI {

    constructor() {

        this.cache = {};

        this.basePath = "/assets/data";

    }
    // ======================================================
    // FETCH JSON
    // ======================================================

    async fetchJson(filename) {

        if (this.cache[filename]) {

            return this.cache[filename];

        }

        try {

            const response = await fetch(

                `${this.basePath}/${filename}`

            );

            if (!response.ok) {

                throw new Error(

                    `Failed loading ${filename}`

                );

            }

            const data = await response.json();

            this.cache[filename] = data;

            return data;

        }

        catch (error) {

            console.error(error);

            return [];

        }

    }
    // ======================================================
    // PRODUCTS
    // ======================================================

    async products() {

        return await this.fetchJson(

            "products.json"

        );

    }

    async productBySlug(slug) {

        const products = await this.products();

        return products.find(

            item => item.slug === slug

        );

    }

    async productById(id) {

        const products = await this.products();

        return products.find(

            item => item.id === id

        );

    }
    // ======================================================
    // BRANDS
    // ======================================================

    async brands() {

        return await this.fetchJson(

            "brands.json"

        );

    }

    async brandBySlug(slug) {

        const brands = await this.brands();

        return brands.find(

            item => item.slug === slug

        );

    }

    async brandById(id) {

        const brands = await this.brands();

        return brands.find(

            item => item.id === id

        );

    }
    // ======================================================
    // CATEGORIES
    // ======================================================

    async categories() {

        return await this.fetchJson(

            "categories.json"

        );

    }

    async categoryBySlug(slug) {

        const categories = await this.categories();

        return categories.find(

            item => item.slug === slug

        );

    }

    async categoryById(id) {

        const categories = await this.categories();

        return categories.find(

            item => item.id === id

        );

    }
    // ======================================================
    // VEHICLES
    // ======================================================

    async vehicles() {

        return await this.fetchJson(

            "vehicles.json"

        );

    }

    async vehicleBySlug(slug) {

        const vehicles = await this.vehicles();

        return vehicles.find(

            item => item.slug === slug

        );

    }

    async vehicleById(id) {

        const vehicles = await this.vehicles();

        return vehicles.find(

            item => item.id === id

        );

    }
    // ======================================================
    // SEARCH
    // ======================================================

    async searchIndex() {

        return await this.fetchJson(

            "search.json"

        );

    }
    // ======================================================
    // PRODUCTS BY BRAND
    // ======================================================

    async productsByBrand(brandId) {

        const products = await this.products();

        return products.filter(

            product =>

                product.brand_id === brandId

        );

    }

    // ======================================================
    // PRODUCTS BY CATEGORY
    // ======================================================

    async productsByCategory(categoryId) {

        const products = await this.products();

        return products.filter(

            product =>

                product.category_id === categoryId

        );

    }

    // ======================================================
    // PRODUCTS BY VEHICLE
    // ======================================================

    async productsByVehicle(vehicleName) {

        const products = await this.products();

        return products.filter(

            product =>

                product.vehicles.includes(

                    vehicleName

                )

        );

    }
}

window.API = new SouviksAPI();
