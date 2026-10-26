# Development Guide

## Workflow

```bash
npm install
cp .env.example .env     # point DB_URL at a replica set (Atlas or local rs)
npm run dev              # reloads on change
```

Before every commit:

```bash
npm run check            # typecheck + lint + test + build
```

CI (`.github/workflows/ci.yml`) runs the same steps plus `npm audit --omit=dev --audit-level=high` on pushes to `main` and on pull requests.

## Code conventions

- **TypeScript strict.** Avoid `any`; if it is truly unavoidable, add a targeted `eslint-disable-next-line` with a reason.
- **Formatting:** Prettier (`.prettierrc`: single quotes, semicolons, trailing commas, LF line endings), enforced through ESLint. `.gitattributes` keeps LF line endings on every OS.
- **Naming:** files are `<module>.<layer>.ts`; services export one object (`jobListingService`), controllers likewise (`jobListingController`).
- **Responses** always go through `sendResponse(res, { statusCode, success, message, data, meta? })`.
- **Errors:** throw `new AppError(HTTP_STATUS_CODE.X, 'message')`. Never `res.status(...).json` an error from a controller.
- **Async handlers** are wrapped in `catchAsync`.
- **Comments** explain _why_, not _what_.

## Module boundaries

```text
src/app/modules/<module>/
  <module>.route.ts       routes + middleware order
  <module>.validation.ts  Zod schemas (body + query)
  <module>.controller.ts  req → service → sendResponse
  <module>.service.ts     business logic and authorization
  <module>.models.ts      Mongoose schema, indexes, hooks
  <module>.interface.ts   TypeScript types
  <module>.constants.ts   enums, messages, config (optional)
  <module>.utils.ts       pure helpers (optional)
```

- Controllers never import models. Services never touch `req`/`res`.
- Cross-module calls go service → **model** where possible. Call another service only for shared side effects (counter updates, cascades).
- Shared building blocks live in `src/app/shared/` (schemas, Zod helpers such as `httpUrl` and `objectIdString`, QueryBuilder types) and `src/app/utils/`.

## Adding a feature

1. `npm run generateModule` scaffolds a module folder. The generated controllers are empty stubs: implement them or delete them, because a handler that never responds hangs the request.
2. Write the Zod schemas first. Use `z.object` (unknown keys are stripped), bound every string and array, and use `httpUrl()` for URLs and `objectIdString()` for ids.
3. Implement the service. Derive ownership from stored documents, never from client-supplied ids, and throw `AppError` with the correct status.
4. Wire up the routes: `checkAuth(roles)` → `validateRequestBody/Query(schema)` → controller.
5. Register the router in `src/app/routes/index.ts`.
6. Add API tests in `tests/` covering success, validation, authorization, and cross-user access.
7. Update `docs/API.md` and, if the architecture changed, `docs/ARCHITECTURE.md`.

## Fixing a bug

1. Reproduce it with a failing test in `tests/`.
2. Fix the root cause in the lowest appropriate layer.
3. Run `npm run check`.
4. Record notable fixes in `docs/PROJECT_STATUS.md`.

## Database changes

- Declare an index **once**, either `unique: true` / `index: true` on the field **or** `schema.index(...)`, never both. Duplicate declarations make index creation fail.
- Set defaults with schema `default`, not in `pre('save')`. Validation runs before `pre('save')` hooks.
- Remember that `findOneAndUpdate` / `updateOne` skip `save` hooks.
- Use transactions only where atomicity truly matters. They need a replica set.
- Never run destructive migrations against shared or production data without a backup.

## Useful references

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API.md](API.md)
- [QUERY_BUILDER.md](QUERY_BUILDER.md)
- [SECURITY.md](SECURITY.md)
- [TESTING.md](TESTING.md)
