---
name: auth-guidance
description: Guide agents through Souviks user authentication and registration without treating website credentials as agent API credentials.
---

# Souviks Authentication Guidance

Souviks provides user-facing account registration and login but does not currently publish a separate agent-specific provisioning API.

Use https://www.souviks.co.in/auth.md as the authoritative agent registration guidance.

For user account actions, direct the user to:

- Registration: https://www.souviks.co.in/en/register.html
- Login: https://www.souviks.co.in/en/login.html

Do not expose passwords, session tokens, or refresh tokens in catalogue requests. Do not automate undocumented authentication endpoints.
