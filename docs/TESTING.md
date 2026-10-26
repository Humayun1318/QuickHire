# Testing

## Strategy

The suite tests the API **from the outside**. Each test sends real HTTP requests with Supertest to the real Express app (`src/app.ts`) — the same middleware, validation, auth and error handling that run in production — backed by a real MongoDB server.

- **Database:** `mongodb-memory-server` starts one in-memory **replica set** per test run (`tests/setup/globalSetup.ts`). A replica set is required because some services use transactions. Each test file gets its own randomly named database (`tests/setup/env.ts`) and drops it afterwards.
- **Environment:** `tests/setup/env.ts` sets every required variable with `NODE_ENV=test` before any app module is imported. No `.env` file, secrets or network access are needed, apart from the one-time MongoDB binary download.
- **Rate limiting** is skipped when `NODE_ENV=test`.
- **Helpers** (`tests/helpers.ts`): `createUser`, `loginSuperAdmin`, `createCompany`, `createJob`, `auth(token)`.

## Commands

| Command                             | Purpose                           |
| ----------------------------------- | --------------------------------- |
| `npm test`                          | Run all tests once (`vitest run`) |
| `npm run test:watch`                | Watch mode                        |
| `npx vitest run tests/jobs.test.ts` | One file                          |
| `npx vitest run -t "IDOR"`          | Tests whose name matches          |
| `npm run check`                     | typecheck + lint + test + build   |

The first run downloads a MongoDB binary (several hundred MB) into the mongodb-memory-server cache. Later runs are fast; the full suite takes roughly 10 s on a typical laptop.

## Coverage map

| File                   | What it verifies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.test.ts`          | Health check, Helmet headers, JSON 404, malformed JSON → 400, 413 body limit, no stack traces outside development, CORS allow-list, preflight, disallowed origin → 403                                                                                                                                                                                                                                                                                                                                                                    |
| `auth.test.ts`         | Registration (role escalation blocked, mass assignment ignored, duplicates 409, weak passwords, NoSQL operator payloads), login (cookies, identical error messages, suspended accounts), `checkAuth` (Bearer / bare / cookie, expired / forged / `alg: none`, DB role over token role, immediate suspension), refresh, change-password revocation, logout, admin-only user endpoints, Google 503 when unconfigured                                                                                                                        |
| `jobs.test.ts`         | Category hierarchy, cycle prevention, deletion guards, admin search with regex escaping; company uniqueness, URL scheme validation, verification flow, update permissions, member-list privacy, company roles; job creation (flat and legacy body), expiry rules, public search (published only, `status` ignored, text search, filters, sort, regex escaping, query validation), detail visibility, company dashboard, **cross-company IDOR**, category counters across status changes and deletion, featuring, company-deletion cascade |
| `applications.test.ts` | Resume default handling, ownership, last-resume rule, URL validation; applying, duplicates, foreign resume, employer cannot apply, draft/expired jobs, cross-company access to applicants, review, employer cannot set `withdrawn`, withdrawal counters and terminal states, admin access                                                                                                                                                                                                                                                 |
| `seeker.test.ts`       | Profile creation and completeness, partial update keeps other fields, re-creation after delete, deleted profiles hidden from employers, seekers cannot browse, education/experience completeness points, date validation, case preserved in responsibilities, ownership                                                                                                                                                                                                                                                                   |
| `unit.test.ts`         | `escapeRegex`, OAuth state/redirect sanitizing and nonce comparison, `buildJobQuery` defaults, pagination caps and sort, duplicate-key error mapping                                                                                                                                                                                                                                                                                                                                                                                      |

Last recorded run: **6 files, 102 tests, all passing.**

## Not covered by automated tests

| Area                                                                     | Why                                                               | How to verify manually                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Google OAuth round trip                                                  | Needs real Google credentials and a browser                       | Follow [DEPLOYMENT.md § Google OAuth](DEPLOYMENT.md#6-google-oauth-optional) and sign in with a test account |
| Behaviour on Vercel (cold start, proxy IP, cookies across sites)         | Needs a deployment                                                | Run the smoke test in [DEPLOYMENT.md](DEPLOYMENT.md#5-post-deployment-smoke-test)                            |
| Rate-limit thresholds                                                    | Disabled in tests so suites stay deterministic                    | Send more than 20 login requests within 15 min locally and expect 429                                        |
| Company member role changes (`PATCH /companies/members/:id`) and leaving | Authorization rules are covered indirectly by add/list tests only | Exercise with two employer accounts                                                                          |
| Database outage                                                          | Hard to simulate reliably                                         | Stop MongoDB locally, call `/api/v1/jobs`, and expect 503                                                    |

## Writing new tests

- Put tests in `tests/<area>.test.ts`. Start each file with `beforeAll(setupDatabase)` and `afterAll(teardownDatabase)`.
- Prefer API-level tests that assert **status codes and observable data**. Only reach into models directly to arrange states the API cannot create (for example an expired job) or to assert persisted values.
- Use `createUser()` for unique accounts so tests stay independent.
- Every bug fix should come with a regression test that fails without the fix.
