# auth.md

## Service

Souviks is a commercial vehicle spare-parts catalogue and enquiry service at:

https://www.souviks.co.in/

This document describes authentication and registration options for software agents acting on behalf of users.

## Agent audience

This information is intended for AI agents and other automated software that need to:

- discover Souviks catalogue information;
- assist a user with spare-part enquiries or quotation requests;
- direct a user to create or access a Souviks account.

## Agent authentication

Souviks does not currently publish a dedicated OAuth authorization server, OAuth Protected Resource Metadata document, A2A agent registration endpoint, or MCP authentication endpoint for third-party agents.

Agents MUST NOT assume that the normal website login credentials or session tokens are an agent API credential.

The publicly available catalogue resources are intended for discovery without authentication:

- https://www.souviks.co.in/assets/data/products.json
- https://www.souviks.co.in/assets/data/brands.json
- https://www.souviks.co.in/assets/data/categories.json
- https://www.souviks.co.in/assets/data/vehicles.json
- https://www.souviks.co.in/assets/data/search.json

## User account registration

A human user can register a Souviks account at:

https://www.souviks.co.in/en/register.html

Localized registration pages are also available:

- English: https://www.souviks.co.in/en/register.html
- Hindi: https://www.souviks.co.in/hi/register.html
- Bengali: https://www.souviks.co.in/bn/register.html

### Supported registration method

**Interactive web registration**

The registration page collects the user's name, email address, password, and password confirmation. The website submits registration through its authentication provider and may require email verification.

There is currently no public agent-specific account-provisioning API. Agents should direct the user to the registration page rather than attempting to automate account creation.

## Credentials and credential use

For normal website account access, authentication is handled by Souviks' configured authentication service. Credentials and sessions are intended for the user-facing website.

Do not expose a user's password, session token, refresh token, or other authentication credential in catalogue discovery requests.

Because Souviks does not currently publish a supported third-party agent credential flow, agents should use the public catalogue resources for read-only catalogue discovery and ask the user to complete authenticated website actions when an account is required.

## Authenticated website actions

Authenticated or user-specific functionality is available through the normal website account flow, including:

https://www.souviks.co.in/en/login.html

and:

https://www.souviks.co.in/en/account.html

Agents should not attempt to submit undocumented authentication requests or probe private authentication endpoints.

## Future agent authentication

When Souviks publishes a supported OAuth or agent authentication service, this document can be extended with:

- the authorization server metadata URL;
- supported scopes;
- supported bearer-token methods;
- an agent registration URI and registration method;
- credential and token-use requirements;
- revocation and lifecycle information where applicable.
