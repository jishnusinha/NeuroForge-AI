# Security policy

## Supported release surface

NeuroForge has two operationally different surfaces:

1. **GitHub Pages educational demo** — browser-only React/TensorFlow.js and local guest experiments. This build must not expose MongoDB, server login, remote model saving, or credentials.
2. **Optional full-stack Express/MongoDB** — account, API and synchronization functionality. It is not assumed secure or production-ready merely because its code passes tests; hosting, mail delivery, secrets, network boundaries, database backups and an account-specific security review are separate release gates.

There is no promise of a hosted production API or account service until those gates are complete.

## Reporting vulnerabilities

Please **do not publish exploit details or user data in a public GitHub issue**. Check the repository's GitHub **Security → Report a vulnerability** option if private vulnerability reporting has been enabled by the maintainers. If that option is not available, contact the maintainer through an existing private communication channel before disclosing details. No dedicated mailbox is claimed here.

Useful information: affected version or commit, concise reproduction steps, expected versus actual behavior, observed impact and whether accounts or cloud resources are involved. Do not include real credentials, medical/user data, private data exports, or active exploit payloads.

## Contributors and maintainers

- No credentials in `client/`, `VITE_*` environment variables, GitHub Pages bundles or repository files; server secrets belong in a managed runtime store.
- Treat imported CSV as untrusted; preserve row/file limits and formula/HTML protections. Handle user content with escaped text, not raw HTML interpolation.
- Require authorization for private runs, artifact ownership, report shares and cross-user data; verify with negative tests.
- Do not allow public CORS with credentials, expose Express diagnostic endpoints publicly, or add public MongoDB ingress.
- Production passwords/session tokens must not be logged. Prefer cookie-session hardening and session invalidation before public account rollout.
- Use GitHub OIDC with tightly scoped trust and short-lived deployment credentials if AWS is later approved. Do not put AWS static access keys into GitHub.
- Enable account-specific AWS budgets, but remember AWS Budgets alerts are not a guaranteed spending cap.
- Do not merge code with failing CI, security regressions, or unexplained changes to saved artifact formats.

## Privacy

Browser-local IndexedDB and localStorage data persist in the browser profile; they are not an encrypted secret vault. Shared-device users should clear local data when finished. Deleting a locally saved browser artifact does not revoke an already issued remote share; the full-stack server requires separate share revocation.

## Security scope limitations

Automated CI is not a penetration test, legal compliance attestation or external infrastructure audit. The public GitHub Pages site does not imply that optional Express/MongoDB endpoints are deployed.
