# Deployment safety

## Repository-side gate

The static catalogue workflow builds a candidate in a clean workspace and validates it before committing generated output.

The candidate must pass:
- catalogue/data projection parity
- price integrity
- product image existence
- generated route/canonical parity
- multilingual entity parity
- redirect target consistency
- robots/sitemap consistency
- structured-data validation
- generated HTML structure checks
- internal link and asset checks
- JavaScript architecture and syntax checks

If any check fails, the workflow stops before the generated catalogue commit is pushed.

The workflow also serializes catalogue/refactor publication and rebuilds from the latest `main` when a concurrent push wins the race.

## Cloudflare production boundary

The repository cannot change Cloudflare Pages project settings. For production safety, the Cloudflare Pages project should use `main` as the production branch and production auto-deploy should be enabled only for that branch. Direct pushes to `main` should therefore be protected by GitHub required-status checks so invalid source changes cannot bypass the repository gate.

Cloudflare Pages supports separate controls for the production branch and preview branches. Preview deployments can be enabled for all non-production branches or restricted to selected custom branches.

Recommended setup:
1. Cloudflare Pages → project → **Settings → Builds & deployments → Configure Production deployments**.
2. Set the production branch to `main`.
3. Keep preview deployments enabled for pull requests/custom branches.
4. In GitHub, protect `main` and require successful catalogue/build validation checks before merging.
5. Do not create a second ad-hoc deployment workflow unless Cloudflare Direct Upload is intentionally being used.

## Preview deployments

Cloudflare Pages Git integration provides preview deployments for custom branches and pull requests without changing production traffic. This is preferable to inventing a repo-local preview environment because the deployed result uses the same Pages project configuration as production.

For a Direct Upload project, Wrangler can also publish a branch preview with:

`npx wrangler pages deploy <BUILD_OUTPUT_DIRECTORY> --branch=<BRANCH_NAME>`

That path should only be adopted when the project is intentionally managed with Direct Upload and the required Cloudflare credentials/project name are configured in CI.

## Current repository limitation

A repository workflow cannot prove that the Cloudflare dashboard currently has the recommended branch controls enabled. That is a platform-side verification item, not a missing repository test.
