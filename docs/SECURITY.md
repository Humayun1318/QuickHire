# Security

QuickHire is a portfolio project. The controls below are appropriate for a public demo API. They are **not** a substitute for the review, monitoring and incident response a commercial system needs.

## Implemented controls

### Transport and HTTP

| Control                | Where                              | Notes                                                                                                                                                                                                                                                                                 |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security headers       | `helmet()` in `src/app.ts`         | Default Helmet policy (CSP, HSTS, nosniff, frameguard, referrer policy, CORP/COOP). Fine for a JSON-only API                                                                                                                                                                          |
| `x-powered-by` removed | `app.disable('x-powered-by')`      |                                                                                                                                                                                                                                                                                       |
| CORS allow-list        | `src/app.ts`                       | Origins = `FRONTEND_URL` + `CORS_ORIGINS`. Credentials allowed. Methods: GET, POST, PATCH, DELETE, OPTIONS. Headers: `Content-Type`, `Authorization`. A browser `Origin` not on the list gets **403**, so cross-site requests never reach a handler (CSRF mitigation for cookie auth) |
| Body size limit        | `express.json({ limit: '100kb' })` | Returns 413. Well under Vercel's 4.5 MB function limit                                                                                                                                                                                                                                |
| Proxy trust            | `TRUST_PROXY` (auto `1` on Vercel) | Only the configured hop count is trusted, so arbitrary `X-Forwarded-For` chains are ignored                                                                                                                                                                                           |

### Rate limiting (`src/app/middlewares/rateLimiter.ts`)

| Limiter       | Scope                                                   | Limit                      |
| ------------- | ------------------------------------------------------- | -------------------------- |
| `apiLimiter`  | all `/api/v1` routes                                    | 300 requests / 15 min / IP |
| `authLimiter` | register, login, refresh, change-password, Google start | 20 requests / 15 min / IP  |

Responses use the standard `RateLimit` headers (draft-8) and status 429.

**Limitation:** the store is in memory. On Vercel each function instance keeps its own counters, so the effective limit is per instance, not global. A shared store such as Redis would fix this, but it is deliberately not added (cost and complexity for a portfolio project).

### Input validation

- Every body and every query that is read is validated with Zod (`validateRequestBody` / `validateRequestQuery`).
- `z.object` strips unknown keys. This blocks mass assignment of `role`, `status`, `ownerId`, `isVerified`, `tokenVersion`, `applicantId` and similar fields.
- Strings and arrays have length limits. Enums are enforced. ObjectIds are validated in schemas or rejected via `CastError` → 400.
- Values are type-checked as strings, numbers or booleans, so operator objects such as `{ "$ne": null }` are rejected (NoSQL injection).
- User text used in `$regex` (QueryBuilder search, job `city`/`country`) is escaped with `escapeRegex` and length-capped.
- URL fields (`website`, `logo`, `banner`, social links, resume `fileUrl`, avatar) accept `http(s)` only, which blocks `javascript:` and `data:` stored-XSS payloads.
- Express 5's default `simple` query parser does not build nested objects from `a[b]=c`.

### Authentication

| Control              | Details                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password hashing     | bcrypt. Cost from `BCRYPT_SALT_ROUND`, validated to 8–14                                                                                                                                                                  |
| Password policy      | 8+ characters, at most 72 bytes (bcrypt's input limit), upper + lower + digit + special                                                                                                                                   |
| Password field       | `select: false`, and stripped again in `toJSON` / `toObject`                                                                                                                                                              |
| Login messages       | The same message for an unknown email and a wrong password. Account status is only revealed after a correct password                                                                                                      |
| JWT                  | HS256 only, pinned on verify (blocks `alg: none` and algorithm confusion). Separate access and refresh secrets, which must differ in production                                                                           |
| Session revocation   | `tokenVersion` is incremented on password change, which invalidates all existing access and refresh tokens                                                                                                                |
| Live authorization   | `checkAuth` reloads the user and uses the **database** role and status on every request                                                                                                                                   |
| Cookies              | `HttpOnly`, `Path=/`. In production `Secure; SameSite=None` (needed for a frontend on another site); in development `SameSite=Lax`. Cleared with identical attributes on logout                                           |
| Google OAuth         | State nonce + httpOnly cookie (login CSRF protection), verified-email requirement for account linking, redirect restricted to relative paths on `FRONTEND_URL` (no open redirect), role restricted to `seeker`/`employer` |
| Privilege escalation | Self-registration can only create `seeker` or `employer` accounts                                                                                                                                                         |

### Authorization (access control)

- **Platform roles** are enforced per route by `checkAuth(...)`.
- **Object ownership** is enforced in services:
  - Seekers can only read or modify their own profile, education, experience, resumes and applications.
  - Job update, status change and delete authorize against the company stored on the job, not a client-supplied `companyId`.
  - Applicant lists and reviews require the requester to be a job manager of the job's company.
  - Company member lists (which contain emails and phone numbers) are visible to members of that company and admins only.
  - Drafts and closed jobs are hidden from public endpoints. Companies see them via `GET /jobs/company/:id`.
  - Only admins can view soft-deleted seeker profiles.
- **Integrity rules:** employers cannot set an application to `withdrawn`; terminal applications are immutable; status changes use conditional updates, so concurrent writes cannot double-count.

### Error handling and logging

- Production error responses contain no stack trace, no `err` object and no internal message for 500s.
- Duplicate-key errors report the field name only, never the value.
- Unexpected errors are logged server-side with method and URL. No passwords or tokens are logged.

### Dependencies

- `npm audit` reported **0 vulnerabilities** after this audit. The fixes came from the non-breaking `npm audit fix`, including patched `mongoose`, `zod`, `body-parser`, `path-to-regexp` and `qs`.
- Removed unused packages: `chalk`, `ora`, `mongodb` (Mongoose bundles its own driver), `express-session`, and the stub `@types/*` packages.
- Dependabot (`.github/dependabot.yml`) opens weekly npm update PRs. It only runs once the repository is on GitHub with Dependabot enabled.
- CI (`.github/workflows/ci.yml`) runs `npm audit --omit=dev --audit-level=high`.

### Secrets

- `.env` and `.env.*` (except `.env.example`) are git-ignored. `.env.example` contains placeholders only.
- `.env` has never been committed to this repository's history (checked with `git log --all -- .env`).
- Production secrets live in Vercel project environment variables.

## Known limitations and accepted risks

| Risk                                                    | Status / mitigation                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rate limits are per instance on Vercel                  | Accepted. Documented above                                                                                                                                                           |
| Logout does not revoke JWTs (no denylist)               | Accepted. Keep `JWT_ACCESS_EXPIRES` short (e.g. `15m`). Changing the password revokes all tokens                                                                                     |
| Refresh tokens are not rotated on use                   | Accepted. A stolen refresh token stays valid until it expires or the password changes                                                                                                |
| Tokens are also returned in the login JSON body         | Kept for API clients and backward compatibility. Browser frontends should rely on the httpOnly cookies and not store tokens in `localStorage`                                        |
| `SameSite=None` cookies in production                   | Required for a cross-site frontend. CSRF is mitigated by the CORS origin check, JSON-only bodies, and no sensitive state-changing GET routes (GET only increments job view counters) |
| No email verification or password reset                 | Not implemented. `isVerified` is informational                                                                                                                                       |
| No account lockout                                      | Brute force is slowed by `authLimiter` only                                                                                                                                          |
| Super-admin password comes from an env var              | Change it after the first deployment and keep the env var secret                                                                                                                     |
| Resume/logo URLs point to external hosts                | The API stores URLs only and never fetches them, so there is no SSRF surface. The frontend should still treat them as untrusted                                                      |
| The Google OAuth flow is not covered by automated tests | Needs real Google credentials. Verify manually after configuring it                                                                                                                  |

## Security checklist (before each deployment)

- [ ] `NODE_ENV=production`
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are long random strings, different from each other and from development
- [ ] `JWT_ACCESS_EXPIRES` is short (e.g. `15m`)
- [ ] `FRONTEND_URL` / `CORS_ORIGINS` list only your real frontend origins (no wildcards)
- [ ] `SUPER_ADMIN_PASSWORD` is strong and changed after first login
- [ ] MongoDB Atlas user has access to this database only; the password is not reused
- [ ] `npm audit --omit=dev` is clean, or the findings are reviewed
- [ ] `npm run check` passes
- [ ] Google OAuth redirect URI in the Google Console matches `GOOGLE_CALLBACK_URL` exactly (if enabled)

## Recommended future improvements

- Shared rate-limit store and per-account login throttling
- Refresh-token rotation with reuse detection
- Email verification and password-reset flows
- Structured logging with request IDs
- An audit trail for admin actions (verification, featuring)
