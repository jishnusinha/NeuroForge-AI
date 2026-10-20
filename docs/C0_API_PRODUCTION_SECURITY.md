# C0 — Express production security baseline

This PR hardens only the production runtime boundary. Browser demo code, ML algorithms, application cookies and MongoDB schema are unchanged.

1. Production requires explicitly configured `MONGODB_URI` and establishes the MongoDB connection **before listening**. No default localhost fallback in production; no false healthy cloud service without durable database access.
2. CORS accepts only exact configured origins from `CORS_ORIGINS` (comma-separated HTTPS origins) and `PUBLIC_APP_URL`. Wildcard or insecure nonlocal origins are rejected during setup. State-changing requests with an unknown browser `Origin` get an explicit 403. Origin headers without allowlist entries do not get an access-control-allow-origin response.
3. Responses set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `Cache-Control: no-store` for API routes.
4. The internal `/api/v2/diagnostics` process memory endpoint returns 404 in production; developer/test operation keeps it for local debugging. Health and ready probes remain available.
5. Untrusted `x-request-id` inputs are constrained to 64 printable safe characters or replaced by a generated UUID.

The API remains behind a future HTTPS reverse proxy. The browser-only GitHub Pages edition does not use the Express runtime. Local development and existing isolated Playwright tests retain their permissive local-network mode.

## Tests and limitations

Node tests exercise production-like HTTP origin rejection, trusted headers, hidden diagnostics, IDs, and production no-URI startup refusal. Existing API ownership and MongoDB integration suites must pass unchanged.

This is a **baseline**, not production account approval: localStorage bearer tokens, authentication cookies/CSRF, trusted proxy settings, email verification/delivery, brute-force controls across multiple instances, secure share revocation and audit logging still need separate security design and tests. A reverse proxy, private Atlas allowlist, HTTPS, backups, billing safeguards and AWS OIDC deployment require explicit user approval; this PR provisions none of them.
