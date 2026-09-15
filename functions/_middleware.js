/*
==========================================================
SOUVIKS WEBSITE
REQUEST MIDDLEWARE
==========================================================

Keeps agent infrastructure isolated from the main site
while preserving normal browser responses.
==========================================================
*/

import { handleAgentRequest } from "./agent/index.js";
import { handleMarkdownResponse } from "./agent/markdown.js";
import { handleAgentSkillsRequest } from "./agent/skills.js";



const ARD_MANIFEST = {
  "specVersion": "1.0",
  "host": {
    "displayName": "Souviks",
    "identifier": "souviks.co.in",
    "documentationUrl": "https://souviks.co.in/en/about.html"
  },
  "entries": [
    {
      "identifier": "urn:air:souviks.co.in:catalogue:products",
      "displayName": "Souviks Product Catalogue",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/products.json",
      "description": "Machine-readable Souviks product catalogue containing commercial vehicle spare-parts product records.",
      "representativeQueries": [
        "Find a Souviks spare part by part number.",
        "Show products from a specific automotive brand.",
        "Find products in a particular spare-parts category.",
        "Which spare parts are available in the Souviks catalogue?"
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:catalogue:vehicles",
      "displayName": "Souviks Vehicle Applications",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/vehicles.json",
      "description": "Machine-readable Souviks vehicle application data for supported commercial vehicle models and related catalogue categories and brands.",
      "representativeQueries": [
        "Which Souviks parts apply to Tata Signa?",
        "Find vehicle applications for a commercial vehicle model.",
        "Show the vehicle models supported by the Souviks catalogue."
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:catalogue:search",
      "displayName": "Souviks Catalogue Search Index",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/search.json",
      "description": "Machine-readable search index for finding Souviks catalogue entries by product name, part number, brand, category, vehicle, and keywords.",
      "representativeQueries": [
        "Search the Souviks catalogue for a part number.",
        "Find a product by SKU or product name.",
        "Search for parts matching a vehicle and brand."
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:catalogue:brands",
      "displayName": "Souviks Brand Index",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/brands.json",
      "description": "Machine-readable index of brands represented in the Souviks catalogue.",
      "representativeQueries": [
        "Which brands are represented in the Souviks catalogue?",
        "Find products from a specific brand."
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:catalogue:categories",
      "displayName": "Souviks Category Index",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/categories.json",
      "description": "Machine-readable index of product categories represented in the Souviks catalogue.",
      "representativeQueries": [
        "What product categories does Souviks offer?",
        "Find spare parts in the brakes category.",
        "Which categories are available for commercial vehicles?"
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:index:part",
      "displayName": "Souviks Part Identifier Index",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/agent/part-index.json",
      "description": "Compact machine-readable index for exact Souviks product ID, part number, and manufacturer part number lookups.",
      "representativeQueries": [
        "Find an exact Souviks part number.",
        "Look up a Souviks manufacturer part number."
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:index:vehicle",
      "displayName": "Souviks Vehicle Index",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/agent/vehicle-index.json",
      "description": "Compact machine-readable vehicle index connecting vehicle applications to Souviks products, brands, and categories.",
      "representativeQueries": [
        "Find parts for Tata Signa.",
        "Which products are associated with a vehicle model?"
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:index:brand",
      "displayName": "Souviks Brand Index",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/agent/brand-index.json",
      "description": "Compact machine-readable brand index connecting Souviks brands to products, vehicles, and categories.",
      "representativeQueries": [
        "Which products does Fleetguard have in the Souviks catalogue?",
        "Find the vehicle applications of a brand."
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:index:category",
      "displayName": "Souviks Category Index",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/agent/category-index.json",
      "description": "Compact machine-readable category index connecting Souviks categories to products, brands, vehicles, and subcategories.",
      "representativeQueries": [
        "Find products in the Filters category.",
        "Which brands supply parts in a category?"
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:index:products-summary",
      "displayName": "Souviks Product Summary Index",
      "type": "application/json",
      "url": "https://souviks.co.in/assets/data/agent/products-summary.json",
      "description": "Compact machine-readable product summary index for keyword discovery without downloading the full catalogue records.",
      "representativeQueries": [
        "Search Souviks products by name and brand.",
        "Find catalogue products matching a vehicle and category.",
        "Search product applications and descriptions."
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:agent:a2a",
      "displayName": "Souviks Catalogue A2A Agent",
      "type": "application/a2a-agent-card+json",
      "url": "https://souviks.co.in/.well-known/agent-card.json",
      "description": "A2A agent for discovering Souviks commercial vehicle spare parts, brands, categories, vehicle applications, and catalogue information.",
      "capabilities": [
        "catalogue-discovery",
        "part-identification",
        "catalogue-navigation"
      ],
      "representativeQueries": [
        "Find a Souviks spare part by part number.",
        "Identify a part from its SKU or product name.",
        "Find vehicle applications for a Souviks product."
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:server:mcp",
      "displayName": "Souviks Catalogue MCP Server",
      "type": "application/mcp-server-card+json",
      "url": "https://souviks.co.in/.well-known/mcp/server-card.json",
      "description": "MCP server exposing Souviks catalogue discovery tools for products, vehicles, brands, categories, and catalogue resources.",
      "capabilities": [
        "search_catalogue",
        "find_vehicle",
        "list_brands",
        "list_categories",
        "get_catalogue_resources"
      ],
      "representativeQueries": [
        "Search the Souviks catalogue for a specific part.",
        "Find Souviks vehicle applications.",
        "List the brands available in the Souviks catalogue."
      ]
    },
    {
      "identifier": "urn:air:souviks.co.in:documentation:api-catalog",
      "displayName": "Souviks API Catalog",
      "type": "application/linkset+json",
      "url": "https://souviks.co.in/.well-known/api-catalog",
      "description": "RFC 9727 API catalog describing the machine-readable Souviks catalogue resources and their service documentation.",
      "representativeQueries": [
        "Where can an agent discover the Souviks API resources?",
        "Find the machine-readable Souviks catalogue endpoints."
      ]
    }
  ]
}
;

function ardResponse() {
    return new Response(
        JSON.stringify(ARD_MANIFEST),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "public, max-age=300, s-maxage=300",
                "Access-Control-Allow-Origin": "*"
            }
        }
    );
}

export async function onRequest(context) {
    const requestUrl = new URL(context.request.url);
    const pathname = requestUrl.pathname;

    // Canonicalise the bare domain at the edge. This cannot be done with
    // the Pages _redirects file because host-based sources must use a
    // Cloudflare Redirect Rule. Keeping it here makes the repository
    // deployment self-contained and preserves the request path/query.
    if (requestUrl.hostname === "souviks.co.in") {
        const target = new URL(requestUrl);
        target.hostname = "www.souviks.co.in";

        return new Response(null, {
            status: 301,
            headers: {
                Location: target.toString(),
                "Cache-Control": "public, max-age=300"
            }
        });
    }

    if (pathname === "/.well-known/ai-catalog.json") {
        return ardResponse();
    }

    const skillsResponse =
        await handleAgentSkillsRequest(
            context.request
        );

    if (skillsResponse) {
        return skillsResponse;
    }

    const agentResponse =
        await handleAgentRequest(
            context.request,
            context.env
        );

    if (agentResponse) {
        return agentResponse;
    }

    const response =
        await context.next();

    return handleMarkdownResponse(
        context.request,
        response
    );
}
