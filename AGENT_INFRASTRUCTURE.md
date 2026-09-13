# Agent Infrastructure

This directory is the durable agent-facing layer for the Souviks website.

## What belongs here

- `functions/agent/index.js` — A2A Agent Card, A2A transport/task handling, OAuth/OIDC discovery, and OAuth Protected Resource Metadata.
- `functions/agent/markdown.js` — Markdown content negotiation for requests using `Accept: text/markdown`.
- `auth.md` — Auth.md registration and authentication guidance.
- `.well-known/api-catalog` — RFC 9727 catalogue linkset.
- `.well-known/agent-card.json` — A2A Agent Card route is served by the middleware.
- `openapi/catalog.json` — machine-readable catalogue API description.
- `_headers` — response headers for the API catalogue.

## Safe website refresh workflow

The website catalogue data and pages may be rebuilt locally at any time. Do not copy an older local project over the GitHub repository.

Before publishing a website refresh:

1. Pull the current `main`.
2. Make the normal product, vehicle, page, or design changes.
3. Keep the `functions/agent/`, `auth.md`, `.well-known/api-catalog`, `openapi/catalog.json`, and `_headers` files.
4. Review `git diff` before pushing.
5. Push to `main`.

The long-lived `agent-infrastructure` branch is the dedicated development branch for agent-layer changes. When it contains new agent functionality, merge that branch (or an agent-specific PR) into the latest `main` rather than replacing the repository with an older local copy.

## Source-of-truth rule

The current GitHub `main` branch is the production source of truth. Local website rebuilds must start from the current `main`.

## Important

Catalogue data remains in the normal website data files. Agent infrastructure reads the current published catalogue rather than maintaining a second product dataset. This avoids duplicated product inventories and reduces merge conflicts.
