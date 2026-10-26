# Project Status

_Last updated: 2026-10-26, after a full repository audit, bug fixing, security hardening and test-suite work._

## Summary

| Area                             | Status                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Type check (`npm run typecheck`) | ✅ clean (src, tests, scripts)                                                                                                    |
| Lint (`npm run lint`)            | ✅ 0 problems (previously ~2,900, mostly CRLF line endings, plus 35 real errors)                                                  |
| Tests (`npm test`)               | ✅ 6 files, 102 tests passing (previously no test runner; `scripts/e2e-test.ts` could not run because its dependency was missing) |
| Build (`npm run build`)          | ✅                                                                                                                                |
| Production smoke test            | ✅ `NODE_ENV=production node dist/server.js` against MongoDB: health, search, login, cookies, 404/400/403 verified                |
| `npm audit`                      | ✅ 0 vulnerabilities (previously 15: 1 critical, 9 high)                                                                          |
| Vercel deployment                | ⏳ prepared (zero-config Express entry, env docs); **not yet deployed**                                                           |
| Google OAuth                     | ⚠️ code reviewed and hardened; not exercised end-to-end (needs credentials)                                                       |

## Module status

| Module                             | Status               | Notes                                                                                                     |
| ---------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| auth                               | ✅ verified by tests | Google flow verified by unit tests of the state helpers only                                              |
| user                               | ✅ verified          | Hanging stub routes removed; `GET /users/me` added                                                        |
| company                            | ✅ verified          |                                                                                                           |
| companyMember                      | ✅ mostly verified   | Add/list/permission paths tested; role update / remove / leave paths reviewed but not individually tested |
| jobCategory                        | ✅ verified          |                                                                                                           |
| jobListing                         | ✅ verified          | Public search was broken before the audit                                                                 |
| Application                        | ✅ verified          |                                                                                                           |
| resume                             | ✅ verified          |                                                                                                           |
| seekerProfile                      | ✅ verified          |                                                                                                           |
| seekerEducation / seekerExperience | ✅ verified          | Update paths reviewed; create/delete/ownership tested                                                     |

## Issues found and fixed

### Critical

| Issue                                               | Root cause                                                                                                       | Fix                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Anyone could register as `super_admin` / `admin`    | The register schema accepted every `UserRole`                                                                    | Register schema allows `seeker` / `employer` only (`auth.validation.ts`) |
| `GET /jobs` (public search) failed on every request | The route validated a _body_ with a `{ query: {...} }` schema; under Express 5 a bodiless GET crashed with a 500 | Query validation with a flat schema                                      |

### High

| Issue                                                                                                                  | Fix                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /users/:id` was public and exposed email/phone                                                                    | Admin only                                                                                                                                                                                                                                                       |
| Job update / status / delete required the client to send `companyId` (even in a DELETE body) and authorized against it | The company is derived from the stored job (`loadManagedJob`). Verified during the audit that the old check was **not** exploitable (an omitted id became `null` and matched nothing); the change removes the fragile contract. Covered by IDOR regression tests |
| Stub routes (`/users/update`, `/users/delete`, `/auth/:id`, …) never responded and hung requests                       | Removed                                                                                                                                                                                                                                                          |
| `Authorization: Bearer <token>` was rejected (the header was passed to `jwt.verify` verbatim)                          | Bearer parsing (the bare token is still accepted)                                                                                                                                                                                                                |
| Authorization used the role inside the token, so bans and role changes were not applied until expiry                   | `checkAuth` uses the DB user's role and status                                                                                                                                                                                                                   |
| Expired or invalid JWTs returned 500                                                                                   | Mapped to 401                                                                                                                                                                                                                                                    |
| Change-password had no validation (an empty `newPassword` cleared the password) and existing sessions survived         | Zod schema + `tokenVersion` revocation + fresh tokens                                                                                                                                                                                                            |
| Public job detail and search exposed drafts (`?status=draft`)                                                          | Public endpoints return published jobs only; members use the new `GET /jobs/company/:companyId` (the controller already existed but was not routed)                                                                                                              |
| Company member list (emails, phones) readable by any employer                                                          | Members and admins only                                                                                                                                                                                                                                          |
| Deleted seeker profiles readable by employers via `?active=false`                                                      | Admins only                                                                                                                                                                                                                                                      |
| Google OAuth `state` was never verified (login CSRF); any Google email was linked                                      | Nonce cookie + verified-email requirement + relative-only redirects                                                                                                                                                                                              |
| No Helmet, no rate limiting, no body limit; CORS accepted a single origin only                                         | Helmet, express-rate-limit, 100 kb limit, CORS allow-list with 403 for other origins                                                                                                                                                                             |
| 15 vulnerable dependencies (proxy-addr, body-parser, path-to-regexp, qs, mongoose, zod, …)                             | `npm audit fix` (non-breaking)                                                                                                                                                                                                                                   |
| `.env.example` used `MONGO_URI` (code reads `DB_URL`), omitted variables, and suggested `BCRYPT_SALT_ROUND=50` (hangs) | Rewritten; env validation enforces 8–14                                                                                                                                                                                                                          |

### Medium

| Issue                                                                                                                                                                                                | Fix                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Job search computed a sort but never applied it                                                                                                                                                      | `.sort()` applied                                                   |
| Category counter decrement passed a filter object to `findByIdAndUpdate`; Mongoose used only its `_id` and silently dropped the `jobCount > 0` guard, so counts could go negative (verified: 0 → -1) | `findOneAndUpdate` with the guard                                   |
| Creating a job without `expiresAt` always failed (the default was set in `pre('save')`, which runs after validation)                                                                                 | Schema `default`                                                    |
| Published → draft did not decrement category counts; a category change on a published job did not move counts                                                                                        | Counts adjusted on every transition                                 |
| Category could be moved under its own child (cycle, stale depths)                                                                                                                                    | A category with children cannot be moved; breadcrumb loop is capped |
| Duplicate index declarations made index creation fail (`SeekerProfile.userId`) and produced warnings (`slug`)                                                                                        | Declared once                                                       |
| Every profile PATCH wiped `languages` (`.default([])` in the update schema)                                                                                                                          | Optional                                                            |
| A deleted seeker profile could never be re-created (unique index)                                                                                                                                    | Restore on create                                                   |
| Experience `responsibilities` were lowercased                                                                                                                                                        | Case preserved                                                      |
| Unawaited completeness update in experience create                                                                                                                                                   | Awaited                                                             |
| Employers could set applications to `withdrawn`; concurrent withdraws could double-decrement                                                                                                         | Status enum restricted; conditional updates                         |
| Duplicate application race returned a generic error (wrong error class check)                                                                                                                        | Matches `code === 11000` → 409                                      |
| Duplicate-key handler could crash (regex on the message) and echoed values                                                                                                                           | Uses `keyValue` → 409, field name only                              |
| Malformed JSON → 500; production responses leaked internal error messages                                                                                                                            | 400 / generic 500 message                                           |
| QueryBuilder `enumFields` filtered on `''` when the param was absent; search regex was unescaped                                                                                                     | Fixed; input escaped                                                |
| `javascript:` URLs accepted for website/logo/resume                                                                                                                                                  | `http(s)` only                                                      |
| Unbounded seeker profile listing                                                                                                                                                                     | Paginated                                                           |
| One-company-per-owner not concurrency-safe                                                                                                                                                           | Partial unique index                                                |
| A deleted company's jobs stayed live and accepted applications                                                                                                                                       | Cascade deactivation                                                |
| `express-session` MemoryStore (leaks, not serverless-safe) though no flow used sessions                                                                                                              | Removed                                                             |

### Low / housekeeping

- Logout cleared cookies with different attributes than they were set with (`SameSite`) → shared cookie options.
- Removed empty scaffold files, dead commented-out code, and unused imports and dependencies.
- Mixed CRLF/LF line endings → `.gitattributes` + Prettier.
- Moved `QueryBuilderDocumentation.md` to `docs/QUERY_BUILDER.md` and updated it to the current code.
- Added CI (GitHub Actions) and Dependabot configuration.

## API contract changes

These are intentional changes from the previous behaviour, all documented in [API.md](API.md):

- `POST /auth/register` rejects `role` values other than `seeker` / `employer`.
- Removed the non-functional stub routes under `/auth` and `/users`.
- `GET /users/:id` requires admin. `GET /users` is paginated (`data` + `meta`).
- `GET /seeker-profiles` (list) is paginated (`data` + `meta`).
- Job endpoints accept flat JSON. The old `{ body: … }` wrapper still works. `companyId` is no longer needed for update / status / delete.
- Duplicate-key errors return **409** instead of 400. The Zod error message is `Validation Error` (was `Zod Error`), and `errorSources[].path` is the full dotted path.
- Public job detail returns 404 for non-published jobs.
- `PATCH /jobs/:id/featured` is open to `super_admin` too, and validates `isFeatured`.

## Open items / known limitations

- **Deployment** to Vercel has not been performed. Follow [DEPLOYMENT.md](DEPLOYMENT.md) and run the smoke test.
- **Google OAuth** needs a manual end-to-end check with real credentials.
- Rate limits are per serverless instance; there is no JWT denylist and no refresh-token rotation (see [SECURITY.md](SECURITY.md)).
- Job expiry is query-time only. `status` stays `published` after `expiresAt` until an employer changes it.
- The resume limit (5) and "first education/experience" completeness bonus use read-then-write checks; a burst of concurrent requests could exceed or skew them slightly.
- Updating education/experience with `isCurrentlyStudying: false` / `isCurrentJob: false` requires `endDate` in the same request, even if one is already stored.
- Company names are stored lowercase (existing behaviour of `normalizeName`). Consider a separate display name if the frontend needs the original casing.
- `GET /companies/me` returns only a company you **own**. Non-owner members have no "my companies" endpoint.
- `npm run generateModule` still scaffolds empty controller stubs. Implement or remove them before registering routes.
- No email verification, password reset, notifications, or file upload (by design for now).
