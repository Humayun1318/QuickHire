# AGENTS.md — instructions for AI coding assistants

QuickHire is a job-portal REST API: TypeScript (strict), Express 5, Mongoose 8, Zod 4, Vitest. It is a personal portfolio project deployed (or intended to be) on **Vercel's free tier** with **MongoDB Atlas free**. Keep changes small, correct, and free of paid infrastructure.

## Commands

```bash
npm run dev          # local server (needs .env, see .env.example)
npm run typecheck    # tsc over src + tests + scripts (tsconfig.dev.json)
npm run lint         # eslint + prettier rules; must report 0 problems
npm test             # vitest + supertest + in-memory MongoDB replica set
npm run build        # tsc → dist (tsconfig.json, src only)
npm run check        # all of the above — run before finishing any task
```

## Architecture (read docs/ARCHITECTURE.md for detail)

- `src/app.ts`: builds the Express app and **default-exports it**. This is the Vercel entry. Keep it free of `listen()` and other side effects.
- `src/server.ts`: local entry (connect + listen + graceful shutdown).
- `src/app/config/`: `env.ts` (validated env vars; add new ones here and to `.env.example`), `db.ts` (cached connection), `passport.ts`.
- `src/app/modules/<module>/`: `route → validation → controller → service → models`. Controllers do not import models, and services do not touch `req`/`res`.
- `src/app/routes/index.ts` mounts every module under `/api/v1`.

## Rules

1. **Validate at the boundary.** Every body/query a handler reads goes through `validateRequestBody` / `validateRequestQuery` with a `z.object` schema. Bound string and array lengths. Use `httpUrl()` / `objectIdString()` from `src/app/shared/validation/common.validation.ts`.
2. **Authorize in two layers.** `checkAuth(...roles)` on the route, plus ownership / company-role checks in the service. **Derive ownership from the stored document** (e.g. `job.companyId`), never from a client-supplied id.
3. **Never trust token claims for authorization.** `checkAuth` loads the user and uses the DB role. Use `getUserIdFromReq` / `getUserRoleFromReq`.
4. **Errors:** throw `AppError(status, message)`; wrap handlers in `catchAsync`; respond with `sendResponse`. Do not leak internals: the global handler hides 500 messages outside development.
5. **Never let a handler hang.** Every route must send a response or call `next(err)`. Do not leave stub controllers registered.
6. **User input in `$regex`** must go through `escapeRegex`.
7. **Mongoose:** declare each index once; use schema `default` instead of setting required values in `pre('save')`; remember that `findOneAndUpdate` skips save hooks; filter soft-deleted records (`isActive` / `status`).
8. **Keep counters consistent** (`JobCategory.jobCount` = published jobs, `JobListing.applicationCount`) whenever a status, category, or deletion changes.
9. **Serverless constraints:** no in-memory state that must be shared, no background timers or cron, no writes to the local filesystem, no session store. Reuse `connectDB()`.
10. **Secrets:** never commit `.env` or real credentials; only placeholders in `.env.example`. Never log passwords or tokens.
11. **No unnecessary rewrites or new infrastructure** (Redis, queues, Docker, paid services). Preserve existing API contracts. If one must change, keep backwards compatibility or document the change in `docs/API.md`.
12. **Tests are required.** Add or adjust API tests in `tests/` for every behavior change or bug fix (success, validation, authz, cross-user access). Never weaken lint/TS settings or skip tests to get green.

## Documentation to update with code changes

| Change                                  | Update                                                                |
| --------------------------------------- | --------------------------------------------------------------------- |
| Endpoint added / changed                | `docs/API.md` (+ README API table if it is a new area)                |
| New env var                             | `src/app/config/env.ts`, `.env.example`, README, `docs/DEPLOYMENT.md` |
| Security-relevant change                | `docs/SECURITY.md`                                                    |
| Architecture / module dependency change | `docs/ARCHITECTURE.md`                                                |
| QueryBuilder change                     | `docs/QUERY_BUILDER.md`                                               |
| Notable fix or known issue              | `docs/PROJECT_STATUS.md`                                              |

## Gotchas

- Express 5: `req.query` is a read-only getter (validation middleware does not write back), and `req.body` is `undefined` when no body is sent.
- Transactions (company create, education/experience delete) need a replica set. Tests use `MongoMemoryReplSet`.
- Job endpoints accept a legacy `{ "body": { … } }` wrapper. Keep `unwrapLegacyBody` in `jobListing.validation.ts`.
- Prettier enforces LF line endings (`.gitattributes` too). On Windows with `core.autocrlf=true`, run `npm run lint:fix` if lint reports `␍`.
