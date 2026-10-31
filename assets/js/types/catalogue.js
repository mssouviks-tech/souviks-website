/**
 * Shared catalogue domain types for editor and JSDoc tooling.
 *
 * This file is not loaded by the browser. It is referenced by maintained
 * catalogue runtime modules so product/entity contracts stay consistent.
 */

/**
 * @typedef {Object} CatalogueProduct
 * @property {string} id
 * @property {string} slug
 * @property {string} product_name
 * @property {string} [name]
 * @property {string} [part_number]
 * @property {string} brand_id
 * @property {string} brand_name
 * @property {string} category_id
 * @property {string} category_name
 * @property {string} [subcategory_id]
 * @property {string} [subcategory_name]
 * @property {number|null} [mrp]
 * @property {number|null} [selling_price]
 * @property {number|null} [discount_percent]
 * @property {string} [image_url]
 * @property {string} [image]
 * @property {string} [primary_image]
 * @property {string[]} [gallery]
 * @property {Object<string, number[]>} [gallery_dimensions]
 * @property {string[]} [vehicles]
 * @property {string[]} [applications]
 * @property {boolean} [featured]
 * @property {boolean} [active]
 * @property {string} [description]
 * @property {number[]} [dimensions_mm] Nominal diameter and overall length, in millimetres
 * @property {{name: string, value_mm: number, source?: string}[]} [dimension_specs_mm] Typed partial measurements in millimetres when a complete diameter/length pair is unavailable
 * @property {number} [weight_calculation_quantity] Number of identical pieces represented by the sellable SKU for weight estimation
 * @property {string} [dimensions_label]
 * @property {string} [dimensions_source]
 * @property {number} [calculated_weight_g] Estimated net product weight, in grams
 * @property {number} [approx_weight_g] Estimated packed shipping weight, in grams
 * @property {string} [weight_estimation_status]
 * @property {string} [weight_estimation_method]
 * @property {string} [weight_estimation_notes]
 */

/**
 * @typedef {Object} CatalogueEntity
 * @property {string} id
 * @property {string} slug
 * @property {string} [name]
 * @property {string} [model]
 * @property {boolean} [active]
 */

/**
 * @typedef {CatalogueEntity & {
 *   brand_id?: string,
 *   category_id?: string,
 *   subcategory_id?: string
 * }} CatalogueRelationshipEntity
 */
