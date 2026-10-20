# GitHub Pages browser-only deployment

This repository has two distinct deployment targets:
1. **Public educational demo:** React + TensorFlow.js running in the visitor's browser, on GitHub Pages.
2. **Full-stack application:** Express, MongoDB, cloud users, sync, durable sharing, and email delivery on separately managed hosts.

## Publish the public demo

1. Merge `feat/github-pages-public-demo` into `master`.
2. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Open **Actions → Deploy NeuroForge browser demo to GitHub Pages** and run it if a successful run has not already started.
4. After the action succeeds, verify **https://jishnusinha.github.io/NeuroForge-AI/** in a browser.
5. Open **https://jishnusinha.github.io/NeuroForge-AI/#/app/playground**, train a regression, save a run, refresh, and check local recovery; also test Studio and Arena.
6. Only advertise the URL as live after it actually loads.

## Why this build differs from local full-stack development

The Pages workflow sets `GITHUB_PAGES=true` for Vite's asset base and `VITE_STATIC_DEMO=true` to use hash routing, disable account/cloud sync, and fail fast on unavailable server API calls. Local saved experiments and IndexedDB drafts remain usable. Server-backed public report links and authenticated sharing are **not** available on Pages; the banner explains this limitation.

Do not ship credentials, MongoDB connection strings, or email webhook tokens in `VITE_*` frontend environment variables. GitHub Pages is not a Node.js hosting service.

## Deploy the full-stack version separately

- Deploy `server/` to a Node.js-capable host (such as Render, Fly.io or a container service). The `server/package.json` start script is `npm start`.
- Configure `MONGODB_URI`, `NODE_ENV=production`, `PUBLIC_APP_URL`, `AUTH_EMAIL_WEBHOOK_URL`, and `AUTH_EMAIL_WEBHOOK_SECRET` as server-side secrets. Complete security verification and email-delivery testing before enabling registration.
- Host the Vite frontend on a platform supporting SPA history fallback and HTTPS (such as Render Static Site, Netlify or Cloudflare Pages) and set `VITE_API_URL` to the HTTPS API root ending in `/api`.
- Restrict API CORS to the actual frontend origins before opening production account endpoints. Confirm secure cookies/tokens, rate limiting and abuse protection.
- Test cross-origin login, email verification, MongoDB backups, private-resource authorization, and report-share revocation.
- Never treat the temporary server memory fallback as production durability.

Use the repository's `docs/REVIEW_REMEDIATION.md` for outstanding production gates.