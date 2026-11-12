# Authentication and session model

## Context

Doni stores personal financial data. The session model has to keep tokens out of reach of injected scripts, let sessions last across visits on mobile, and allow sessions to be ended server-side (sign-out, account deletion, suspected token theft).

## Decision

- A **short-lived access token** is held **in memory only** on the client and sent as a bearer token.
- A **refresh token** lives in an **httpOnly, Secure, SameSite cookie**. Refresh tokens are **stored server-side**, **rotated on every use**, and grouped into families: **reuse of a rotated token revokes the whole family**. Sign-out revokes server-side.
- Access and refresh tokens are signed with **distinct, required secrets**; a refresh token is never accepted as an access token.
- There is a single sign-up path. Users can read and update only their own account; account administration requires the admin role.
- The frontend refreshes silently and guards authenticated routes before loading them.

## Rejected alternatives

- **Tokens in localStorage/sessionStorage**: readable by any script running on the page.
- **Long-lived stateless JWT with no server-side store**: cannot be revoked on sign-out or deletion.
- **Classic server session cookie only**: workable, but the API is consumed as a bearer-token API generated from OpenAPI; the hybrid keeps the API stateless per request while keeping revocation.
- **Third-party auth provider**: added dependency and data leaving our hosting region for a simple email/password need.

## Consequences

- A page reload always performs a silent refresh to obtain a new access token.
- The refresh endpoint needs CSRF-appropriate cookie settings and the frontend and API origins must be configured accordingly.
- A refresh-token table must be maintained and cleaned up.
- Sensitive account actions (deleting the account) re-enter the password on the request, and access tokens are checked against the account so a deleted or deactivated account's sessions end at once (ADR 0016).
