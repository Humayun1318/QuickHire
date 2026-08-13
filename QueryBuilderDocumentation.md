# QueryBuilder — Complete Technical Reference

> This document describes the **actual, current implementation** of `QueryBuilder` in this
> repository. All types, constants, and behaviors below are taken directly from the source —
> nothing is inferred or reconstructed.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Source Map](#2-source-map)
3. [Constructor](#3-constructor)
4. [Internal State](#4-internal-state)
5. [Execution Flow](#5-execution-flow)
6. [Private Helper Methods](#6-private-helper-methods)
7. [Public Chainable Methods](#7-public-chainable-methods)
8. [Terminal Methods](#8-terminal-methods)
9. [Configuration Reference (`FilterConfig`)](#9-configuration-reference-filterconfig)
10. [In-Repo Usage Example: `jobCategory`](#10-in-repo-usage-example-jobcategory)
11. [Method Chaining Order — Why It Matters](#11-method-chaining-order--why-it-matters)
12. [Best Practices](#12-best-practices)
13. [Common Mistakes](#13-common-mistakes)
14. [Performance Notes](#14-performance-notes)
15. [Appendix: Quick Reference Cheat Sheet](#15-appendix-quick-reference-cheat-sheet)

---

## 1. Overview & Architecture

`QueryBuilder<T>` (`src/app/builder/QueryBuilder.ts`) is a single, generic, reusable class that
turns an incoming Express `req.query` object into a fully-formed, paginated Mongoose query —
search, typed filtering, numeric/date ranges, sorting, field selection, population, and lean
conversion — without any module (`user`, `company`, `jobListing`, `jobCategory`, ...) needing to
hand-write that logic itself.

```text
builder/
└── QueryBuilder.ts              ← the engine (documented in full below)

shared/
└── queryBuilder/
    ├── queryBuilder.types.ts    ← FilterConfig / ModelQuery / QueryParams / PaginationMeta types
    ├── queryBuilder.constants.ts← default query key names + default numeric values
    └── index.ts                 ← barrel: re-exports types + constants

shared/validation/
└── queryBuilderSchema.ts        ← Zod schema for query-level params (page, limit, search, sort, fields)
```

**Why split the engine from per-module config?**

`QueryBuilder` has no idea what a "user" or a "job category" is. It only knows the *shapes* of query
operations: search a set of fields, filter a set of fields, range-filter a set of fields, sort by a
set of fields, select a set of fields, populate a set of paths. Every one of those "sets" is
supplied from the outside, per call site, via a `config: FilterConfig` object (`*.builder.config.ts`,
one per module).

**Why this matters in practice:** if the shared builder ever grew module-specific logic (e.g.
`if (field === "salary") { ... }`), every future module would either have to route around that
special case or risk silently triggering it. Keeping the builder 100% generic is what makes it safe
to reuse across `user`, `company`, `jobListing`, `jobCategory`, and any future module without
regression risk to the others. A bug fix or feature added to `QueryBuilder.ts` benefits every module
simultaneously; a bug introduced there also *breaks* every module simultaneously — which is exactly
why the class has to stay small, generic, and free of business rules.

---

## 2. Source Map

| File | Responsibility |
|---|---|
| `builder/QueryBuilder.ts` | The generic engine class (~710 lines). All chainable methods, helpers, and execution logic |
| `shared/queryBuilder/queryBuilder.types.ts` | `FilterConfig`, `RangeFilterConfig`, `ModelQuery`, `QueryParams`, `PaginationMeta`, `QueryField` types |
| `shared/queryBuilder/queryBuilder.constants.ts` | `DEFAULT_PAGE = 1`, `DEFAULT_LIMIT = 20`, `MAX_LIMIT = 100`, query key names (`search`, `sort`, `page`, `limit`, `fields`) |
| `shared/queryBuilder/index.ts` | Barrel re-exports |
| `shared/validation/queryBuilderSchema.ts` | Zod validation of the shared query-level params (`search`, `sort`, `fields`, `page`, `limit`) |

---

## 3. Constructor

```ts
constructor(
  model: Model<T>,
  modelQuery: ModelQuery<T>,
  queryParams: QueryParams,
  config: FilterConfig
) {
  this.model = model;
  this.modelQuery = modelQuery;
  this.queryParams = queryParams;
  this.config = config;

  this.limit = config.defaultLimit ?? DEFAULT_LIMIT;
}
```

> **This is a 4-argument constructor**, not 3. A common mistake is to call
> `new QueryBuilder(SomeModel.find(), req.query, config)` — that is **not** this class's signature.
> This implementation requires the raw Mongoose `Model` *separately* from the already-started
> `Query` (`modelQuery`), because `getMeta()` needs the model to run an independent
> `countDocuments()` call (see §8.1).

| Parameter | Type | Where it comes from | Internal use |
|---|---|---|---|
| `model` | `Model<T>` | The Mongoose model itself, e.g. `JobCategory` (not `JobCategory.find()`) | Used exclusively by `getMeta()` to run `model.countDocuments(this.internalFilter)` — a second, independent query used only to compute pagination totals |
| `modelQuery` | `ModelQuery<T>` (alias for `Query<any, T>`) | The already-initiated query, e.g. `JobCategory.find()` | The query object every chainable method (`search`, `filter`, `range`, `sort`, `paginate`, `fields`, `populate`, `lean`) mutates by reassignment (`this.modelQuery = this.modelQuery.X(...)`) |
| `queryParams` | `QueryParams` (alias for `Record<string, unknown>`) | `req.query` from Express | Read-only source for every query key (`search`, `sort`, `page`, `limit`, `fields`, plus every field named in `filterableFields`/`rangeFields`) |
| `config` | `FilterConfig` | A per-module `*.builder.config.ts` file | Drives every decision the builder makes — which fields are searchable/filterable/range/sortable/selectable, defaults, and caps. See §9 |

**Constructor side effect worth knowing:** `this.limit` is set immediately in the constructor from
`config.defaultLimit ?? DEFAULT_LIMIT`, *before* `paginate()` has ever run. This means:

- `this.limit` always has a usable value even if `paginate()` is never called in the chain.
- `this.skip` is **not** initialized here — it keeps its class-property default of `0` until
  `paginate()` runs (see §7.5 and the mistake called out in §13).

### Service Example

```ts
const builder = new QueryBuilder(
  JobCategory,        // Model<T>        — the model itself
  JobCategory.find(), // ModelQuery<T>  — the started query
  queryParams,        // QueryParams
  jobCategoryBuilderConfig, // FilterConfig
);
```

### Common Mistakes

- Passing `Model.find()` as the first argument instead of the bare `Model`. This compiles under a
  loose generic setup but breaks `getMeta()` at runtime, because `model.countDocuments` won't
  behave correctly on a `Query` object (and even if a similarly-named method exists, it wouldn't be
  counting against a *fresh* base query — it would inherit whatever was already chained onto the
  passed-in query object).
- Swapping the `modelQuery` and `queryParams` argument order — both are objects, so TypeScript
  structural typing may not catch this immediately with a broad `QueryParams` type.

### Best Practices

- Always construct the builder with a *fresh* `Model.find()` — don't pre-chain `.sort()`,
  `.limit()`, etc. onto `modelQuery` before handing it to the constructor. Let the builder own all
  of that via its chainable methods so `internalFilter` and `this.limit`/`this.page`/`this.skip`
  stay the single source of truth.
- Build `config` once per module as a top-level constant (`jobCategoryBuilderConfig`) and import it
  — don't construct it inline per request.

---

## 4. Internal State

```ts
private modelQuery: ModelQuery<T>;
private model: Model<T>;
private queryParams: QueryParams;
private config: FilterConfig;
private internalFilter: FilterQuery<T> = {};
private page = DEFAULT_PAGE;
private limit = DEFAULT_LIMIT;
private skip = 0;
```

| Field | Purpose |
|---|---|
| `modelQuery` | The live, mutable Mongoose query. Every chainable method reassigns this by calling a Mongoose query method on it and storing the result back (`this.modelQuery = this.modelQuery.sort(...)`, etc.) |
| `model` | Bare model reference, used only for the independent `countDocuments()` call in `getMeta()` |
| `queryParams` | Raw `req.query`, read via the private getters (§6) — never mutated |
| `config` | The per-module `FilterConfig` — never mutated |
| `internalFilter` | The **cumulative** Mongo filter object built up by `search()`, `filter()`, and `range()` via `addFilter()`. This is what both the main query *and* `getMeta()`'s `countDocuments()` use, so pagination totals always match the filter actually applied |
| `page` | Current 1-indexed page number, set by `paginate()` (defaults to `DEFAULT_PAGE` until then) |
| `limit` | Page size. Initialized in the constructor from `config.defaultLimit ?? DEFAULT_LIMIT`, then possibly overwritten by `paginate()` |
| `skip` | Number of documents to skip, computed only inside `paginate()` as `(page - 1) * limit`. Stays `0` if `paginate()` is never called |

---

## 5. Execution Flow

```text
Incoming HTTP Request
        │
        ▼
Express req.query  (QueryParams)
        │
        ▼
new QueryBuilder(model, modelQuery, req.query, config)
        │
        ▼
   .search()     → reads "search", adds { $or: [...] } to internalFilter
        │
        ▼
   .filter()     → reads config.filterableFields, adds equality/$in/ObjectId/number/bool filters
        │
        ▼
   .range()      → reads config.rangeFields, adds { field: { $gte, $lte } } filters
        │
        ▼
   .sort()       → reads "sort", calls modelQuery.sort(...) directly (NOT part of internalFilter)
        │
        ▼
   .paginate()   → reads "page"/"limit", sets page/limit/skip, calls modelQuery.skip().limit()
        │
        ▼
   .fields()     → reads "fields", calls modelQuery.select(...)
        │
        ▼
   .populate()   → reads config.populate, calls modelQuery.populate(...) per entry
        │
        ▼
   .lean()       → calls modelQuery.lean() (default: enabled)
        │
        ▼
   .execute()    → Promise.all([ modelQuery, getMeta() ])
        │              │
        │              └─ getMeta() → model.countDocuments(internalFilter) → { page, limit, skip,
        │                             total, totalPages, hasNextPage, hasPreviousPage, nextPage,
        │                             previousPage }
        ▼
   { meta, data } returned to controller → JSON response
```

**Key structural fact:** only `search()`, `filter()`, and `range()` write into `internalFilter`
(via `addFilter()`). `sort()`, `paginate()`, `fields()`, `populate()`, and `lean()` all operate
directly on `modelQuery` and never touch `internalFilter`. This is *why* `getMeta()`'s
`countDocuments(this.internalFilter)` gives you a correct "total matching records" number
regardless of sorting, pagination, field selection, or population — those don't affect which
documents match, only how they're shaped/ordered/sliced.

---

## 6. Private Helper Methods

These are not part of the public chain — they're used internally by the methods in §7. Documented
here because every one of them is directly responsible for how a raw query-string value gets
converted into a typed value used in a Mongo filter.

### `getString(key: string): string`

```ts
private getString(key: string): string {
  const value = this.getValue(key);
  return typeof value === "string" ? value.trim() : "";
}
```

- **Purpose:** the single point of truth for reading *any* raw query param safely.
- **Behavior:** returns `""` (not `undefined`) for anything that isn't a string — including
  `undefined`, arrays (e.g. `?role=A&role=B` parsed by Express as `string[]`), and numbers.
- **Edge case:** because Express's default query parser can produce arrays for repeated keys
  (`?role=A&role=B` → `{ role: ["A", "B"] }`), `getString("role")` on that input returns `""`, not
  `"A"` or `["A","B"]`. If you need multi-value support for a field, use the `arrayFields` config
  (comma-separated single value) documented in §9 — this builder does **not** support Express's
  repeated-key array style.
- **Best practice:** never read `this.queryParams[key]` directly anywhere else in the class — always
  go through `getString` (or one of the typed getters below, which are all built on top of it) so
  trimming and type-safety stay consistent.

### `getNumber(key: string): number | undefined`

```ts
private getNumber(key: string): number | undefined {
  const value = this.getValue(key);

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  if (!normalized) return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}
```

- Handles **both native numbers and string query values** — useful when `queryParams` is assembled
  programmatically (e.g. a service merging `query.isActive ?? true`) rather than always coming from
  `req.query`.
- Returns `undefined` for missing/empty/non-numeric values — callers must always check for
  `undefined`, never assume a number came back.
- `Number("")` would be `0`, but that path is pre-empted by the empty-string check, so an empty
  string correctly yields `undefined`, not `0`.
- `Number("  42 ")` → `42` (trimming happens upstream).
- **Edge case:** `Number("1e3")` → `1000` (scientific notation is accepted, since `Number()`
  accepts it) — worth knowing if `minSalary=1e3` should probably be rejected but currently isn't.

### `getBoolean(key: string): boolean | undefined`

```ts
private getBoolean(key: string): boolean | undefined {
  const value = this.getValue(key);
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}
```

- **Case-insensitive literal match:** `"true"`, `"TRUE"`, `"True"`, and `" TrUe "` all produce
  `true`; `"false"` variants produce `false`. `"1"`, `"0"`, `"yes"` return `undefined`.
- Also accepts a **native boolean** value directly (`typeof value === "boolean"`) — relevant when
  a service composes `queryParams` with real boolean values before passing them to the builder.
- Used exclusively by `filter()` for fields listed in `config.booleanFields`.

### `getArray(key: string): string[]`

```ts
private getArray(key: string): string[] {
  const value = this.getString(key);
  if (!value) return [];
  return value.split(",").map(item => item.trim()).filter(Boolean);
}
```

- Converts `"React, Node ,,Express"` → `["React", "Node", "Express"]` — trims each item and drops
  empty segments produced by stray commas.
- Returns `[]` (not `undefined`) when the key is missing — callers check `.length`, not truthiness
  of the value itself.

### `getDate(key: string): Date | undefined`

```ts
private getDate(key: string): Date | undefined {
  const value = this.getValue(key);
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  if (!normalized) return undefined;

  const date = new Date(normalized);
  return isNaN(date.getTime()) ? undefined : date;
}
```

- Also accepts a **native `Date` instance** (e.g. when `queryParams` is composed programmatically).
- Delegates entirely to the native `Date` constructor's parsing — accepts anything `new Date(...)`
  accepts: ISO strings (`2025-01-01`), full ISO datetimes, and even loosely-formatted strings like
  `"Jan 1 2025"` (Node-engine dependent). No format validation is enforced beyond "is this a
  parseable date at all."
- Invalid strings (`"not-a-date"`) safely become `undefined` rather than throwing or producing an
  `Invalid Date`.

### `addFilter(filter: FilterQuery<T>): void`

```ts
private addFilter(filter: FilterQuery<T>) {
  this.internalFilter = { ...this.internalFilter, ...filter };
  this.modelQuery = this.modelQuery.find(this.internalFilter);
}
```

- **This is the only place `internalFilter` is ever written to.** `search()`, `filter()`, and
  `range()` all funnel their results through this one method.
- **Merge strategy is a shallow spread**, not a deep merge. Every call **replaces** any top-level
  key that already exists in `internalFilter` with the new value for that key. See §13 for the
  concrete bug this can cause if two config sections (e.g. `filterableFields` and `rangeFields`)
  ever target the *same* field name.
- After merging, it re-applies the **entire accumulated** `internalFilter` to `modelQuery` via
  `.find()` — not just the incremental piece. This is intentional/safe (each call fully re-syncs
  `modelQuery`'s conditions with `internalFilter`), but it does mean `.find()` is called once per
  `search()`/`filter()`/`range()` invocation that actually adds something, each time with the full
  filter so far.

---

## 7. Public Chainable Methods

Every method below returns `this`, which is what makes `.search().filter().range()...` possible.
Each dry run traces one concrete request end-to-end.

### 7.1 `search()`

```ts
search() {
  const keyword = this.getString(SEARCH_QUERY_KEY);
  if (!keyword) return this;

  const searchableFields = this.config.searchableFields ?? [];
  if (!searchableFields.length) return this;

  const conditions = searchableFields.map(field => ({
    [field]: { $regex: keyword, $options: "i" },
  } as FilterQuery<T>));

  this.addFilter({ $or: conditions });
  return this;
}
```

**Purpose:** free-text, case-insensitive, partial-match search across a whitelisted set of fields —
the "search box" behavior.

**Why it exists:** without it, every module would hand-roll its own `$or`/`$regex` block, and
inevitably some modules would forget `$options: "i"` (case sensitivity bugs) or forget to whitelist
fields (accidentally regex-searching an ObjectId field and throwing a cast error).

**Parameters:** none directly — reads `SEARCH_QUERY_KEY` (`"search"`, per
`queryBuilder.constants.ts`) off `queryParams`, and `config.searchableFields`.

**Return:** `this` (chainable). No return value carries data — everything is written to
`internalFilter`/`modelQuery` as a side effect.

**Internal algorithm:**

1. Read and trim the `search` query param. If empty → no-op, return immediately.
2. Read `config.searchableFields`. If empty/undefined → no-op (a keyword with nothing to search is
   silently ignored, not an error).
3. Build one `{ field: { $regex: keyword, $options: "i" } }` object per searchable field.
4. Wrap them all in a single `$or` and merge into `internalFilter` via `addFilter()`.

**Dry Run**

```text
Incoming URL:
  GET /job-categories?search=engineer

Incoming req.query:
  { search: "engineer" }

Config (jobCategoryBuilderConfig):
  searchableFields: ["name", "slug"]

Execution:
  keyword = "engineer"
  searchableFields = ["name", "slug"]
  conditions = [
    { name: { $regex: "engineer", $options: "i" } },
    { slug: { $regex: "engineer", $options: "i" } }
  ]

Generated filter (merged into internalFilter):
  { $or: [
      { name: { $regex: "engineer", $options: "i" } },
      { slug: { $regex: "engineer", $options: "i" } }
  ] }

Generated MongoDB query:
  db.jobcategories.find({
    $or: [
      { name: { $regex: "engineer", $options: "i" } },
      { slug: { $regex: "engineer", $options: "i" } }
    ]
  })
```

**Edge Cases**

- `search=` (present but empty) → trimmed to `""` → treated identically to no `search` param at all.
- `searchableFields` configured but empty array vs. not configured at all → same behavior (both use
  `?? []`).
- A keyword containing regex special characters (e.g. `search=a.b*`) is passed **unescaped** into
  `$regex` — it will be interpreted as a real regex pattern, not a literal string. See mistake in
  §13.

**Common Mistakes**

- Forgetting to add a field to `searchableFields` and assuming `search=` will match it — it silently
  won't, no error is thrown.
- Not sanitizing/escaping user input before it reaches `$regex` — a user typing regex metacharacters
  can cause unexpected matches or, in pathological cases, expensive regex evaluation (see §14).

**Best Practices**

- Keep `searchableFields` short and string-typed. Don't include ObjectId or numeric fields — regex
  against a non-string field either won't match anything meaningful or, depending on the field type
  and Mongoose's schema-level casting, can behave unpredictably.
- If you need literal (non-regex) search safety, escape user input for regex metacharacters before
  it reaches this builder — this class does not do that for you.

**Performance Notes**

- `$regex` without a leading `^` anchor **cannot use an index efficiently** — Mongo has to scan
  every candidate document's field value. See §14 for index guidance.

---

### 7.2 `filter()`

```ts
filter() {
  const filterableFields = this.config.filterableFields ?? [];

  const booleanFields = new Set(this.config.booleanFields ?? []);
  const objectIdFields = new Set(this.config.objectIdFields ?? []);
  const arrayFields = new Set(this.config.arrayFields ?? []);
  const enumFields = new Set(this.config.enumFields ?? []);
  const numberFields = new Set(this.config.numberFields ?? []);

  const filters: Record<string, unknown> = {};

  for (const field of filterableFields) {
    if (numberFields.has(field)) {
      const value = this.getNumber(field);
      if (value !== undefined) filters[field] = value;
      continue;
    }
    if (booleanFields.has(field)) {
      const boolValue = this.getBoolean(field);
      if (boolValue !== undefined) filters[field] = boolValue;
      continue;
    }
    if (arrayFields.has(field)) {
      const values = this.getArray(field);
      if (values.length) filters[field] = { $in: values };
      continue;
    }
    if (objectIdFields.has(field)) {
      const value = this.getString(field);
      if (value && Types.ObjectId.isValid(value)) {
        filters[field] = new Types.ObjectId(value);
      }
      continue;
    }
    const value = this.getString(field);
    if (enumFields.has(field)) {
      filters[field] = value;
      continue;
    }
    // normal string or nested field
    if (value) filters[field] = value;
  }

  if (Object.keys(filters).length) this.addFilter(filters);
  return this;
}
```

**Purpose:** exact-match (or typed-equivalent) filtering across an arbitrary whitelist of fields,
with per-field type handling.

**Why it exists:** a single generic loop replaces what would otherwise be repetitive
`if (req.query.role) filter.role = req.query.role;` blocks in every service file, while still
letting each field opt into boolean/array/ObjectId/enum/number handling.

**Parameters:** none directly — reads `config.filterableFields` plus the five classification sets
(`booleanFields`, `objectIdFields`, `arrayFields`, `enumFields`, `numberFields`).

**Return:** `this`.

**Internal algorithm — type-resolution order (first match wins, and it's checked in this exact
order for every field):**

1. `numberFields` → `getNumber()` → numeric equality. **Checked first** — if a field appears in both
   `numberFields` and `filterableFields`/`objectIdFields`, the numeric path wins.
2. `booleanFields` → `getBoolean()` → only literal `"true"`/`"false"` (case-insensitive) produce a
   filter; anything else for that field is silently dropped (no fallback to string).
3. `arrayFields` → `getArray()` → comma-split → `{ $in: [...] }`.
4. `objectIdFields` → validated with `Types.ObjectId.isValid()` → cast to `new Types.ObjectId(value)`
   if valid; **silently skipped if invalid** (no error surfaced to the caller).
5. `enumFields` → stored as a **plain string**, identical to the default/unclassified path — it
   provides no extra validation (see the FAQ-style notes in §13).
6. Anything not in any of the above sets → plain string equality (also supports dot-notation nested
   fields, e.g. `"address.city"`, since Mongo/Mongoose treat that as a normal key).

**Dry Run**

```text
Incoming URL:
  GET /job-categories?depth=3&isActive=true&parentId=64f1a2b3c4d5e6f7a8b9c0d1

Incoming req.query:
  { depth: "3", isActive: "true", parentId: "64f1a2b3c4d5e6f7a8b9c0d1" }

Config (jobCategoryBuilderConfig):
  filterableFields: ["isActive", "parentId", "depth"]
  numberFields:     ["depth", "jobCount"]
  booleanFields:    ["isActive"]
  objectIdFields:   ["parentId"]

Execution:
  depth     → numberField → getNumber("depth") = 3      → filters.depth = 3
  isActive  → boolean     → getBoolean("isActive") = true → filters.isActive = true
  parentId  → objectId    → ObjectId.isValid(...) = true
              → filters.parentId = ObjectId("64f1a2b3c4d5e6f7a8b9c0d1")

Generated filter:
  { depth: 3, isActive: true, parentId: ObjectId("64f1a2b3c4d5e6f7a8b9c0d1") }

Generated MongoDB query:
  db.jobcategories.find({
    depth: 3,
    isActive: true,
    parentId: ObjectId("64f1a2b3c4d5e6f7a8b9c0d1")
  })
```

**Second dry run — `arrayFields`**

```text
Incoming URL:
  GET /users?role=ADMIN,HR

Config:
  filterableFields: ["role"]
  arrayFields: ["role"]

Execution:
  getArray("role") → ["ADMIN", "HR"]
  filters.role = { $in: ["ADMIN", "HR"] }

Generated MongoDB query:
  db.users.find({ role: { $in: ["ADMIN", "HR"] } })
```

**Service Example**

```ts
// jobCategory.builder.config.ts
export const jobCategoryBuilderConfig: FilterConfig = {
  searchableFields: ["name", "slug"],
  filterableFields: ["isActive", "parentId", "depth"],
  numberFields: ["depth", "jobCount"],
  booleanFields: ["isActive"],
  objectIdFields: ["parentId"],
  // ...
};
```

**Edge Cases**

- A field in `filterableFields` but present as an *empty string* in the query (`?depth=`) is skipped
  entirely — you cannot use this mechanism to explicitly filter for an empty-string value.
- An invalid ObjectId string (`?parentId=not-an-id`) is dropped silently — the filter is simply not
  applied, so the query behaves as if `parentId` was never sent, rather than returning a 400 or an
  empty result set.
- A field present in **two** classification sets at once (e.g. both `numberFields` and
  `objectIdFields`) resolves using whichever check comes first in the fixed order above
  (`number → boolean → array → objectId → enum`) — the later classification is effectively ignored
  for that field.

**Common Mistakes**

- Adding a field to `filterableFields` but forgetting to classify it in `numberFields` or
  `objectIdFields` when it's actually a number or `Types.ObjectId` ref — it will be filtered as a
  **plain string**, and Mongoose/Mongo will likely cast-fail or simply never match, because the
  stored value is not a string.
- Expecting `enumFields` to reject invalid enum values — it does not validate against any enum list;
  it behaves exactly like an unclassified string field.
- Relying on `filter()` for range/comparison queries (`>`, `<`) — this method only ever produces
  equality, `$in`, or exact-ObjectId/numeric conditions. Use `range()` (§7.3) for comparisons.

**Performance Notes**

- Equality and `$in` filters on indexed fields (e.g. `depth`, `parentId`) are cheap. ObjectId
  equality on an indexed foreign-key-style field is the fastest filter type this method can
  produce — always index fields you expect to be commonly filtered on.

---

### 7.3 `range()`

```ts
range() {
  const ranges = this.config.rangeFields ?? [];
  const filters: Record<string, unknown> = {};

  for (const range of ranges) {
    const fieldName = range.field.charAt(0).toUpperCase() + range.field.slice(1);
    const isDate = range.type === "date";

    const defaultMinKey = isDate ? `start${fieldName}` : `min${fieldName}`;
    const defaultMaxKey = isDate ? `end${fieldName}` : `max${fieldName}`;

    const min = isDate
      ? this.getDate(range.minKey ?? defaultMinKey)
      : this.getNumber(range.minKey ?? defaultMinKey);
    const max = isDate
      ? this.getDate(range.maxKey ?? defaultMaxKey)
      : this.getNumber(range.maxKey ?? defaultMaxKey);

    if (min === undefined && max === undefined) continue;

    const condition: Record<string, number | Date> = {};
    if (min !== undefined) condition.$gte = min;
    if (max !== undefined) condition.$lte = max;

    filters[range.field] = condition;
  }

  if (Object.keys(filters).length) this.addFilter(filters);
  return this;
}
```

**Purpose:** numeric or date **range** filtering (`$gte`/`$lte`) with auto-derived query-key names,
so a config entry for `field: "salary"` automatically understands `minSalary`/`maxSalary` without
the module needing to spell those key names out.

**Why it exists:** range queries (`salary between X and Y`, `createdAt between two dates`) are
extremely common and easy to get subtly wrong (off-by-one on inclusivity, inconsistent key naming
across modules). Centralizing the key-derivation logic means every module gets the same
`min`/`max`/`start`/`end` naming convention for free.

**Parameters:** none directly — reads `config.rangeFields`, an array of `RangeFilterConfig`
descriptors:

```ts
interface RangeFilterConfig {
  field: string;
  minKey?: string;
  maxKey?: string;
  type?: "number" | "date";
}
```

**Return:** `this`.

**Internal algorithm:**

1. For each configured range descriptor, capitalize the field name (`salary` → `Salary`) to build
   the *default* key names.
2. If `range.type === "date"`, defaults are `start{Field}` / `end{Field}`; otherwise (numeric, the
   default assumption) they're `min{Field}` / `max{Field}`.
3. An explicit `range.minKey`/`range.maxKey` always overrides the derived default (`??` short-circuits
   only on `null`/`undefined`, so an explicit override is always respected).
4. Parse `min`/`max` using `getDate()` (date mode) or `getNumber()` (numeric mode, default).
5. **If both `min` and `max` are `undefined`, that field is skipped entirely** — no empty condition
   is emitted.
6. Each field's condition uses `$gte` (lower bound, inclusive) and `$lte` (upper bound, inclusive) —
   an open-ended range with only one valid bound still applies the other side as unbounded.
7. All conditions merge into `internalFilter` via `addFilter()` in one pass.

**Dry Run — numeric range**

```text
Incoming URL:
  GET /job-categories?minJobCount=5&maxJobCount=50

Config:
  rangeFields: [ { field: "jobCount", minKey: "minJobCount", maxKey: "maxJobCount" } ]

Execution:
  isDate = false
  min = getNumber("minJobCount") = 5
  max = getNumber("maxJobCount") = 50
  condition = { $gte: 5, $lte: 50 }
  filters.jobCount = { $gte: 5, $lte: 50 }

Generated MongoDB query:
  db.jobcategories.find({ jobCount: { $gte: 5, $lte: 50 } })
```

**Dry Run — open-ended range (min only, default key derivation)**

```text
Incoming URL:
  GET /job-categories?minDepth=2

Config:
  rangeFields: [ { field: "depth" } ]   // type omitted → numeric; keys derived

Execution:
  defaultMinKey = "minDepth", defaultMaxKey = "maxDepth"
  min = getNumber("minDepth") = 2
  max = undefined (param absent)
  filters.depth = { $gte: 2 }

Generated MongoDB query:
  db.jobcategories.find({ depth: { $gte: 2 } })   // no $lte at all
```

**Dry Run — date range with custom keys**

```text
Incoming URL:
  GET /users?fromDate=2025-01-01&toDate=2025-12-31

Config:
  rangeFields: [
    { field: "createdAt", type: "date", minKey: "fromDate", maxKey: "toDate" }
  ]

Execution:
  minKey used = "fromDate" (explicit override, not the derived "startCreatedAt")
  min = getDate("fromDate") = Date("2025-01-01T00:00:00.000Z")
  max = getDate("toDate")   = Date("2025-12-31T00:00:00.000Z")
  filters.createdAt = { $gte: Date(...), $lte: Date(...) }
```

**Edge Cases**

- `?toDate=2025-12-31` alone (no `$lte` cutoff time component) resolves to **midnight UTC on
  2025-12-31**, not end-of-day — a document created at `2025-12-31T14:00:00Z` will **not** be
  included by `$lte: 2025-12-31T00:00:00Z`. Callers wanting an inclusive "through end of day" need
  to either pass a full timestamp or add a day on the client/service side. This builder does not
  adjust for that.
- `min > max` (e.g. `minSalary=50000&maxSalary=10000`) is **not validated** — it's passed straight
  through as `{ $gte: 50000, $lte: 10000 }`, which is a logically impossible condition and will
  simply match zero documents.
- An invalid number/date string for either bound resolves to `undefined` for *that* bound only —
  the other bound (if valid) still applies as an open-ended range.

**Common Mistakes**

- Assuming `type: "date"` is inferred from the field name (`createdAt`, `startDate`, etc.) — it is
  **not**; you must explicitly set `type: "date"` in the config or the field will be parsed with
  `getNumber()` and silently fail to match any dates (a numeric parse of an ISO date string like
  `"2025-01-01"` returns `NaN` → `undefined` → field skipped).
- Forgetting that the default key derivation capitalizes only the **first letter**: `field:
  "monthlySalary"` → defaults `minMonthlySalary` / `maxMonthlySalary`, not `minMonthlysalary`.

**Best Practices**

- Always set `type: "date"` explicitly for any date range field — don't rely on naming
  conventions.
- Use `minKey`/`maxKey` overrides when you want friendlier public API query names (`fromDate`/
  `toDate`) instead of the auto-derived `startCreatedAt`/`endCreatedAt`.

**Performance Notes**

- `$gte`/`$lte` range conditions on an indexed field use the index efficiently (range scan). Always
  index fields configured in `rangeFields` that are queried frequently, especially date fields used
  for reporting/dashboards.

---

### 7.4 `sort()`

```ts
sort() {
  const sortableFields = this.config.sortableFields ?? [];
  const sort = this.getString(SORT_QUERY_KEY);

  if (!sort) {
    if (this.config.defaultSort) {
      this.modelQuery = this.modelQuery.sort(this.config.defaultSort);
    }
    return this;
  }

  const sorts = sort.split(",").map(item => item.trim()).filter(Boolean);
  const validSorts = sorts.filter(item => {
    const field = item.startsWith("-") ? item.slice(1) : item;
    return sortableFields.includes(field);
  });

  if (validSorts.length) {
    this.modelQuery = this.modelQuery.sort(validSorts.join(" "));
  }
  return this;
}
```

**Purpose:** whitelist-safe multi-field sorting, using Mongoose's native `"field1 -field2"` string
syntax, with a config-level fallback default sort.

**Why it exists:** letting `req.query.sort` reach `.sort()` unfiltered would let a client sort (and
thus force a full collection scan / large in-memory sort) on any field, including unindexed ones —
a denial-of-service-adjacent risk. Whitelisting via `sortableFields` closes that off.

**Parameters:** none directly — reads `SORT_QUERY_KEY` (`"sort"`), `config.sortableFields`, and
`config.defaultSort`.

**Return:** `this`.

**Internal algorithm:**

1. If no `sort` query param at all: apply `config.defaultSort` **only if configured** — otherwise
   leave Mongo's natural (unspecified) order.
2. If `sort` is present: split on commas, trim each token, strip a leading `-` to get the bare field
   name, and keep only tokens whose bare field name is in `sortableFields`.
3. **Invalid tokens are silently dropped**, not rejected — a mixed request like
   `sort=name,-secretInternalField` where only `name` is whitelisted still sorts by `name`, quietly
   ignoring the disallowed field.
4. If *no* tokens survive whitelisting, no `.sort()` call is made at all (not even the default) —
   this is a subtle branch: an all-invalid `sort` param results in **no sort**, not the configured
   default. See §13.

**Dry Run**

```text
Incoming URL:
  GET /job-categories?sort=-createdAt,name

Config:
  sortableFields: ["name", "depth", "jobCount", "createdAt", "updatedAt"]

Execution:
  sort = "-createdAt,name"
  sorts = ["-createdAt", "name"]
  validSorts:
    "-createdAt" → bare field "createdAt" → in sortableFields → kept
    "name"       → bare field "name"      → in sortableFields → kept
  validSorts = ["-createdAt", "name"]
  modelQuery.sort("-createdAt name")

Generated MongoDB query (conceptually):
  db.jobcategories.find({...}).sort({ createdAt: -1, name: 1 })
```

**Dry Run — all tokens rejected**

```text
Incoming URL:
  GET /job-categories?sort=internalSecretField

Config:
  sortableFields: ["name", "depth", "jobCount", "createdAt", "updatedAt"]
  defaultSort: "name"

Execution:
  sorts = ["internalSecretField"]
  validSorts = []  (not whitelisted)
  → validSorts.length is 0 → modelQuery.sort() is never called
  → NOTE: defaultSort is NOT applied here, because the `if (!sort)` branch only runs when
    the query param is absent entirely, not when it's present-but-entirely-invalid.

Result: query runs with no explicit sort (Mongo natural order), even though a defaultSort exists.
```

**Edge Cases**

- Whitespace-only or duplicate-comma input (`sort=, ,name`) is cleaned up by
  `.filter(Boolean)` after trimming — empty tokens are dropped before whitelist-checking.
- A field can be sorted both ascending and "descending" in the same request only once each — passing
  `sort=name,-name` produces `validSorts = ["name", "-name"]`, and Mongoose's `"name -name"` sort
  string behavior in that conflicting case is undefined/last-wins per Mongoose internals — this
  builder does not deduplicate by bare field name.

**Common Mistakes**

- Assuming an invalid `sort` value falls back to `defaultSort` — it does not (see dry run above).
  If you want a guaranteed default even for garbage input, that has to be added explicitly in your
  service layer or in this method (it currently isn't).
- Forgetting to add a field to `sortableFields` that's exposed elsewhere (e.g. via `selectableFields`
  or in API docs) — clients will get silently-ignored sort requests with no error feedback.

**Best Practices**

- Always set `defaultSort` for list endpoints so results have a stable, predictable order even when
  no `sort` param is sent — pagination is unreliable across requests without *some* consistent sort
  order (`skip`/`limit` on an unsorted query can return inconsistent pages).
- Keep `sortableFields` limited to indexed fields where possible (see §14).

**Performance Notes**

- Sorting on a field with a supporting index avoids Mongo needing to do an in-memory sort (which is
  capped and can error out — `32MB` default sort memory limit) for large result sets. Compound
  indexes that match your filter + sort pattern (e.g. `{ isActive: 1, createdAt: -1 }`) are ideal
  for filtered, sorted, paginated list endpoints.

---

### 7.5 `paginate()`

```ts
paginate() {
  const page = this.getNumber(PAGE_QUERY_KEY);
  const limit = this.getNumber(LIMIT_QUERY_KEY);

  this.page = page && page > 0 ? page : DEFAULT_PAGE;

  this.limit =
    limit && limit > 0
      ? Math.min(limit, this.config.maxLimit ?? MAX_LIMIT)
      : this.config.defaultLimit ?? DEFAULT_LIMIT;

  this.skip = (this.page - 1) * this.limit;

  this.modelQuery = this.modelQuery.skip(this.skip).limit(this.limit);
  return this;
}
```

**Purpose:** turn `page`/`limit` query params into `skip`/`limit` on the Mongoose query, with
validation and an upper cap.

**Why it exists:** without a cap, a client could request `?limit=1000000` and force the server to
load and serialize an enormous result set. `maxLimit` protects against that while still letting
clients ask for a smaller page size than the default.

**Parameters:** none directly — reads `PAGE_QUERY_KEY` (`"page"`), `LIMIT_QUERY_KEY` (`"limit"`),
`config.maxLimit`, `config.defaultLimit`.

**Return:** `this`.

**Internal algorithm:**

1. Parse `page`/`limit` as numbers (may be `undefined`).
2. `page`: valid only if truthy **and** `> 0`; otherwise falls back to `DEFAULT_PAGE`. (Note: `0` is
   falsy in JS, so `page=0` and `page=-5` both fall back identically — the `> 0` check is actually
   redundant for `0` specifically but matters for negative numbers, since a negative number is
   truthy.)
3. `limit`: if a valid positive number was supplied, it's **capped** at
   `config.maxLimit ?? MAX_LIMIT` via `Math.min`. If **no valid limit was supplied at all**, it
   falls back to `config.defaultLimit ?? DEFAULT_LIMIT` — **not** capped against `maxLimit` in that
   fallback branch (see the mistake flagged in §13).
4. `skip = (page - 1) * limit`.
5. Apply `.skip(skip).limit(limit)` to `modelQuery`.

**Dry Run**

```text
Incoming URL:
  GET /job-categories?page=2&limit=10

Config:
  defaultLimit: 20
  maxLimit: 100

Execution:
  page = getNumber("page") = 2 → 2 > 0 → this.page = 2
  limit = getNumber("limit") = 10 → 10 > 0 → this.limit = Math.min(10, 100) = 10
  this.skip = (2 - 1) * 10 = 10
  modelQuery.skip(10).limit(10)

Generated MongoDB query (conceptually):
  db.jobcategories.find({...}).skip(10).limit(10)
```

**Dry Run — limit exceeds cap**

```text
Incoming URL:
  GET /job-categories?limit=500

Config:
  maxLimit: 100

Execution:
  limit = 500 → 500 > 0 → this.limit = Math.min(500, 100) = 100   // capped

Result: client asked for 500, server enforces 100.
```

**Edge Cases**

- `page=abc` (non-numeric) → `getNumber` returns `undefined` → falls back to `DEFAULT_PAGE`, exactly
  like an omitted `page` param — no error surfaced.
- `page=1.5` → `Number("1.5") = 1.5` (not rejected as non-integer) → `this.page = 1.5` →
  `this.skip = (1.5 - 1) * limit`, a **fractional skip value** passed to Mongoose's `.skip()`. This
  is not validated as an integer anywhere in this method.
- `limit=0` explicitly → `0 && 0 > 0` is falsy → falls to the `config.defaultLimit ?? DEFAULT_LIMIT`
  branch, **not** treated as "return zero results."

**Common Mistakes**

- **Setting `config.defaultLimit` larger than `config.maxLimit`.** Because the "no valid limit
  supplied" fallback branch uses `defaultLimit` *without* capping it against `maxLimit`, a
  misconfigured module (`defaultLimit: 200, maxLimit: 50`) will silently serve 200 records per page
  whenever the client omits `limit`, even though an explicit `?limit=200` request would correctly be
  capped to 50. Always keep `defaultLimit <= maxLimit` by convention.
- Forgetting to call `paginate()` at all in the chain. See §13 — this is one of the most impactful
  mistakes possible with this builder.
- Not passing an integer validator on `page`/`limit` upstream (e.g. in a DTO/Zod schema) if you need
  to guarantee whole-number pages — this method accepts fractional numbers as shown above.

**Best Practices**

- Always set both `defaultLimit` and `maxLimit` per module, and keep `defaultLimit <= maxLimit`.
- Always include `.paginate()` in the chain for any list endpoint, even if you expect small result
  sets — omitting it doesn't just skip pagination, it also produces meta stats (`getMeta()`) that
  won't match the actual returned data (see §13).

**Performance Notes**

- Large `skip` values on large collections are inherently expensive in MongoDB (`skip` still has to
  walk past the skipped documents). For very deep pagination on big collections, consider
  cursor/keyset pagination (e.g. `_id > lastSeenId`) instead of offset-based `skip`/`limit` — this
  builder implements offset-based pagination only.

---

### 7.6 `fields()`

```ts
fields() {
  const selectableFields = this.config.selectableFields ?? [];
  const fields = this.getString(FIELDS_QUERY_KEY);
  if (!fields) return this;

  const selected = fields.split(",").map(item => item.trim()).filter(Boolean);
  const validFields = selected.filter(field => selectableFields.includes(field));

  if (validFields.length) {
    this.modelQuery = this.modelQuery.select(validFields.join(" "));
  }
  return this;
}
```

**Purpose:** sparse fieldsets — let clients request only the fields they need, from a safe
whitelist, reducing payload size and, for `lean()` reads, some serialization overhead.

**Parameters:** none directly — reads `FIELDS_QUERY_KEY` (`"fields"`) and
`config.selectableFields`.

**Return:** `this`.

**Internal algorithm:**

1. No `fields` param → no-op (all fields returned, per schema/model default).
2. Split on commas, trim, drop empties, then keep only entries present in
   `config.selectableFields`.
3. If any valid fields survive, call `modelQuery.select(validFields.join(" "))` — Mongoose's
   space-separated projection string.
4. **All-invalid input → no `.select()` call at all** (same silent-drop philosophy as `sort()`).

**Dry Run**

```text
Incoming URL:
  GET /job-categories?fields=name,slug,jobCount

Config:
  selectableFields: ["name", "slug", "icon", "parentId", "depth", "jobCount",
                     "isActive", "createdAt", "updatedAt"]

Execution:
  selected = ["name", "slug", "jobCount"]   // all three are whitelisted
  validFields = ["name", "slug", "jobCount"]
  modelQuery.select("name slug jobCount")

Generated MongoDB query (conceptually):
  db.jobcategories.find({...}, { name: 1, slug: 1, jobCount: 1 })
```

**Edge Cases**

- `fields=name,secretField` where only `name` is whitelisted → silently returns only `name`.
- `fields=, ,` → all tokens empty after filtering → no-op, all fields returned.

**Best Practices**

- Mirror your API docs exactly against `selectableFields` — anything documented but missing from
  the whitelist silently fails client-side with no error.
- Combine `fields()` with `lean()` on list endpoints for the smallest possible payload.

**Performance Notes**

- A narrower projection reduces both document transfer size and, combined with `lean()`,
  hydration cost. For list endpoints returning hundreds of documents, field selection is one of the
  cheapest bandwidth wins available.

---

### 7.7 `populate()`

```ts
populate() {
  const populates = this.config.populate ?? [];
  if (!populates.length) return this;

  for (const populate of populates) {
    this.modelQuery = this.modelQuery.populate(populate);
  }
  return this;
}
```

**Purpose:** automatically join/populate configured Mongoose reference paths on every query — no
client-side toggle needed; population is entirely config-driven.

**Parameters:** none directly — reads `config.populate`, an array of Mongoose `PopulateOptions`
(e.g. `{ path: "parentId", select: "name slug" }`).

**Return:** `this`.

**Internal algorithm:** iterate `config.populate` and call `.populate(entry)` on `modelQuery` for
each entry, in order.

**Dry Run**

```text
Config (jobCategoryBuilderConfig):
  populate: [ { path: "parentId", select: "name slug" } ]

Execution:
  modelQuery.populate({ path: "parentId", select: "name slug" })

Generated MongoDB behavior:
  After the main find, Mongoose issues an additional lookup on jobcategories
  using parentId's ObjectId values, projecting only { name, slug }, and hydrates
  each result's parentId with the parent document.
```

**Edge Cases**

- No client-facing toggle to *disable* configured population — if a module always populates
  `parentId`, every request through that builder will always pay that join cost, regardless of
  whether the client needs it. If conditional population is required, it needs to be handled outside
  this builder (e.g. building `config.populate` dynamically before constructing `QueryBuilder`).

**Common Mistakes**

- Populating deeply nested/large documents unconditionally for list endpoints that render summaries
  — this can significantly inflate response size and DB round-trip cost for every request through
  that config, even ones that don't need the populated data.

**Best Practices**

- Keep `populate` entries minimal and use field-selecting populate objects (`{ path, select }`)
  rather than full-document population, especially for list endpoints.
- If different endpoints on the same module need different population needs, use two different
  `*.builder.config.ts` exports (e.g. `categoryListConfig` vs. `categoryTreeConfig`) rather than
  trying to make `populate` conditional inside a single config.

**Performance Notes**

- Each populated path is effectively an additional query (or `$lookup`-equivalent work) — populate
  only what the response actually needs, and add indexes on the referenced `_id` fields being
  populated against (usually already indexed by default as primary keys, but double-check compound
  reference patterns).

---

### 7.8 `lean()`

```ts
lean(enable = true) {
  if (enable) {
    this.modelQuery = this.modelQuery.lean();
  }
  return this;
}
```

**Purpose:** convert the query result from full Mongoose Documents (with getters, virtuals, methods,
change-tracking) into plain JavaScript objects — faster to produce and serialize, at the cost of
losing document instance methods/virtuals.

**Parameters:** `enable: boolean = true` — defaults to `true` if called with no arguments.

**Return:** `this`.

**Internal algorithm:** if `enable` is `true` (including the default, no-argument call), apply
`.lean()` to `modelQuery`. If `enable` is `false`, **do nothing** — this is not a toggle-off; it's a
no-op.

**Dry Run**

```text
Service call:
  .lean()          → modelQuery.lean() is called → results will be plain objects
  .lean(false)     → nothing happens → modelQuery is unchanged (documents, not plain objects,
                      UNLESS lean() was never going to be called anyway — .lean(false) cannot
                      "undo" an earlier .lean() call in the same chain, because it never calls
                      any Mongoose method at all when enable is false)
```

**Edge Cases**

- `.lean(false)` reads as "explicitly disable lean" but the implementation cannot disable something
  that hasn't been enabled — it's functionally identical to not calling `.lean()` at all. There is
  no code path in this method that would ever *remove* `.lean()` from an already-lean query within
  the same chain (this only matters if some future refactor calls `.lean()` unconditionally
  elsewhere).

**Common Mistakes**

- Calling `.lean(false)` expecting it to reverse an earlier `.lean()` — it does not; if you don't
  want lean results, simply don't call `.lean()` (or `.lean(true)`) anywhere in the chain.

**Best Practices**

- Default to `.lean()` on every read-only list/detail endpoint that doesn't need Mongoose document
  instance methods, virtuals, or change-tracking — it's meaningfully faster for high-throughput
  read paths.
- Skip `.lean()` only when you specifically need to call instance methods or rely on virtuals on the
  returned documents.

**Performance Notes**

- Lean queries skip Mongoose's document hydration step entirely — for read-heavy list endpoints with
  large result sets, this is one of the cheapest, highest-impact performance wins available in the
  entire chain.

---

## 8. Terminal Methods

### 8.1 `getMeta()`

```ts
async getMeta(): Promise<PaginationMeta> {
  const total = await this.model.countDocuments(this.internalFilter);
  const totalPages = Math.ceil(total / this.limit);

  return {
    page: this.page,
    limit: this.limit,
    skip: this.skip,
    total,
    totalPages,
    hasNextPage: this.page < totalPages,
    hasPreviousPage: this.page > 1,
    nextPage: this.page < totalPages ? this.page + 1 : null,
    previousPage: this.page > 1 ? this.page - 1 : null,
  };
}
```

**Purpose:** compute pagination metadata for the *current* filter state, independent of sorting,
field selection, population, or lean conversion.

**Why a separate `countDocuments()` call:** `internalFilter` reflects only `search()` + `filter()` +
`range()` — none of `sort()`/`paginate()`/`fields()`/`populate()`/`lean()` touch it. So
`countDocuments(internalFilter)` always answers "how many documents match the filter, in total,"
regardless of which page you're viewing. This is the correct way to compute `totalPages` — counting
the already-paginated result array (`.length`) would only ever tell you the current page's size
(at most `limit`), never the true total.

**Dry Run**

```text
State at call time:
  internalFilter = { isActive: true, depth: 2 }
  page = 2
  limit = 10

Execution:
  total = await JobCategory.countDocuments({ isActive: true, depth: 2 })  // e.g. 47
  totalPages = Math.ceil(47 / 10) = 5

Returned meta (exact shape of PaginationMeta):
  {
    page: 2,
    limit: 10,
    skip: 10,
    total: 47,
    totalPages: 5,
    hasNextPage: true,      // 2 < 5
    hasPreviousPage: true,  // 2 > 1
    nextPage: 3,
    previousPage: 1
  }
```

**Edge Cases / Critical Bug Risk**

- **`config.defaultLimit: 0` is dangerous.** In `paginate()`, the fallback expression is
  `config.defaultLimit ?? DEFAULT_LIMIT`. The nullish-coalescing operator `??` only falls back on
  `null`/`undefined` — **not** on `0`. So if a module ever configures `defaultLimit: 0` (e.g. by
  mistake, or as an attempted "no limit" signal), `this.limit` becomes `0` whenever the client omits
  `?limit=`. Then in `getMeta()`, `Math.ceil(total / 0)` evaluates to `Infinity` (or `NaN` if
  `total` is also `0`), which makes `hasNextPage: this.page < Infinity` **always `true`** — an
  infinite-pagination bug. **Never configure `defaultLimit: 0` or `maxLimit: 0`.**
- If `getMeta()` is awaited without `paginate()` ever having run, `this.limit` is still whatever the
  constructor set it to (`config.defaultLimit ?? DEFAULT_LIMIT`) and `this.page`/`this.skip` are
  `DEFAULT_PAGE`/`0` — the meta object will describe a "page 1" that doesn't actually correspond to
  any `.skip()`/`.limit()` applied to the real query, because `paginate()` never ran (see §13).

**Best Practices**

- Never set `defaultLimit` or `maxLimit` to `0` in any `*.builder.config.ts`.
- Always call `paginate()` before `execute()` so `getMeta()`'s numbers actually correspond to the
  real, applied `.skip()`/`.limit()`.

**Performance Notes**

- `countDocuments()` on a large, unfiltered (or loosely filtered) collection can itself be a
  non-trivial query. Make sure the fields used in `filterableFields`/`rangeFields`/`searchableFields`
  are indexed so both the main find and this count benefit from the same indexes.

---

### 8.2 `execute()`

```ts
async execute() {
  const [data, meta] = await Promise.all([
    this.modelQuery,
    this.getMeta(),
  ]);
  return { meta, data };
}
```

**Purpose:** the terminal method — actually runs the query against MongoDB and returns the final
`{ meta, data }` shape.

**Why `execute()` must always be the last call in the chain:** every other method in this class is
synchronous and returns `this` purely by mutating internal state (`modelQuery`, `internalFilter`,
`page`, `limit`, `skip`) — none of them touch the database. `execute()` is the only method that
actually awaits anything. Calling it earlier in the chain would run the query before `sort()`,
`paginate()`, `fields()`, `populate()`, or `lean()` had a chance to configure `modelQuery`, and
because those methods mutate `this.modelQuery` by *reassignment*, any state built up after
`execute()` runs would be irrelevant — the query has already fired.

**Internal algorithm:**

1. `this.modelQuery` is a Mongoose `Query` object, which is "thenable" (implements `.then()`) — no
   explicit `.exec()` call is needed; `Promise.all` awaiting it directly is sufficient to trigger
  
   execution.
2. `this.modelQuery` and `this.getMeta()` run **concurrently** via `Promise.all` — two separate
   round trips to MongoDB (the main `find` and the `countDocuments` inside `getMeta()`) happen in
   parallel rather than sequentially, which reduces total latency versus awaiting them one after
   another.
3. Returns `{ meta, data }` — `data` is the array of documents (or plain objects, if `.lean()` was
   applied), `meta` is the `PaginationMeta` object from §8.1.

**Dry Run — full chain, end to end**

```text
Incoming URL:
  GET /job-categories?search=engineering&isActive=true&minDepth=1&sort=-createdAt&page=2&limit=10&fields=name,slug

Incoming req.query:
  {
    search: "engineering", isActive: "true", minDepth: "1",
    sort: "-createdAt", page: "2", limit: "10", fields: "name,slug"
  }

Config (jobCategoryBuilderConfig):
  searchableFields: ["name", "slug"]
  filterableFields: ["isActive", "parentId", "depth"]
  booleanFields:    ["isActive"]
  numberFields:     ["depth", "jobCount"]
  rangeFields: [ { field: "depth", minKey: "minDepth", maxKey: "maxDepth" } ]
  sortableFields:   ["name", "depth", "jobCount", "createdAt", "updatedAt"]
  selectableFields: ["name", "slug", "icon", "parentId", "depth", "jobCount",
                     "isActive", "createdAt", "updatedAt"]
  populate: [ { path: "parentId", select: "name slug" } ]
  defaultSort: "name"
  defaultLimit: 20
  maxLimit: 100

Execution trace:
  search()     → internalFilter.$or = [{name:/engineering/i}, {slug:/engineering/i}]
  filter()     → internalFilter.isActive = true
  range()      → internalFilter.depth = { $gte: 1 }
  sort()       → modelQuery.sort("-createdAt")
  paginate()   → page=2, limit=10, skip=10 → modelQuery.skip(10).limit(10)
  fields()     → modelQuery.select("name slug")
  populate()   → modelQuery.populate({ path: "parentId", select: "name slug" })
  lean()       → modelQuery.lean()
  execute()    → Promise.all([modelQuery, getMeta()])

Final internalFilter (used by BOTH the find and countDocuments):
  {
    $or: [
      { name:  { $regex: "engineering", $options: "i" } },
      { slug:  { $regex: "engineering", $options: "i" } }
    ],
    isActive: true,
    depth: { $gte: 1 }
  }

Generated MongoDB query:
  db.jobcategories.find(
    { $or: [...], isActive: true, depth: { $gte: 1 } },
    { name: 1, slug: 1 }
  ).sort({ createdAt: -1 })
   .skip(10).limit(10)
   .populate({ path: "parentId", select: "name slug" })
   .lean()

Final response shape:
  {
    meta: {
      page: 2, limit: 10, skip: 10, total: 14, totalPages: 2,
      hasNextPage: false, hasPreviousPage: true, nextPage: null, previousPage: 1
    },
    data: [
      { name: "Software Engineering", slug: "software-engineering",
        parentId: { name: "Technology", slug: "technology" } },
      // ... up to 10 matching, lean, field-selected documents
    ]
  }
```

**Service Example**

```ts
export const getAllCategories = async (query: Record<string, unknown>) => {
  const queryParams = {
    ...query,
    isActive: query.isActive ?? true,   // service-layer default, composed pre-builder
  };

  const { data, meta } = await new QueryBuilder(
    JobCategory,
    JobCategory.find(),
    queryParams,
    jobCategoryBuilderConfig,
  )
    .search()
    .filter()
    .range()
    .sort()
    .paginate()
    .fields()
    .populate()
    .lean()
    .execute();   // MUST be last — this is what actually hits the database

  return { results: data, meta };
};
```

**Edge Cases**

- If `execute()` is called mid-chain (before `paginate()`/`fields()`/etc.), the query still runs —
  Mongoose queries fire on `await`/`.then()`. Any chain methods called *after* `execute()` has
  already resolved would be reassigning `this.modelQuery` on an already-executed query object,
  which has no further effect on the already-returned result.

**Best Practices**

- Always place `execute()` last in the chain.
- Prefer awaiting the whole chain in one expression (as shown above) rather than storing `builder`
  and calling methods across multiple statements with awaits in between — there's no async work
  until `execute()`, so intermediate `await`s serve no purpose and add confusion.

**Performance Notes**

- The `Promise.all` parallelism here is a meaningful, "free" performance win: without it, awaiting
  the main query and then the count sequentially would take roughly the sum of both round trips
  instead of the max of the two.

---

## 9. Configuration Reference (`FilterConfig`)

> Taken verbatim from `shared/queryBuilder/queryBuilder.types.ts` in this repository.

```ts
export interface FilterConfig {
  searchableFields?: QueryField<any>[];
  filterableFields?: QueryField<any>[];
  sortableFields?: QueryField<any>[];
  selectableFields?: QueryField<any>[];
  numberFields?: QueryField<any>[];
  booleanFields?: QueryField<any>[];
  objectIdFields?: QueryField<any>[];
  arrayFields?: QueryField<any>[];
  enumFields?: QueryField<any>[];
  rangeFields?: RangeFilterConfig[];
  populate?: PopulateOptions[];
  defaultSort?: string;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface RangeFilterConfig {
  field: string;
  minKey?: string;
  maxKey?: string;
  type?: "number" | "date";
}

export type QueryField<T> = Extract<keyof T, string> | string;
```

| Property | Type | Required? | Used by | Default / Fallback Behavior | Generated Query Effect |
|---|---|---|---|---|---|
| `searchableFields` | `QueryField<any>[]` | Optional (`?? []`) | `search()` | Empty → `search()` becomes a no-op even if a keyword is sent | Adds `$or` of `$regex` conditions across listed fields |
| `filterableFields` | `QueryField<any>[]` | Optional (`?? []`) | `filter()` | Empty → `filter()` is a no-op | Adds equality / `$in` / ObjectId / numeric conditions per field |
| `numberFields` | `QueryField<any>[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as numeric | Field parsed via `getNumber()`; silently skipped if non-numeric |
| `booleanFields` | `QueryField<any>[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as boolean | Field parsed via `getBoolean()`; only exact `"true"`/`"false"` (case-insensitive) produce a filter |
| `objectIdFields` | `QueryField<any>[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as ObjectId | Field cast to `Types.ObjectId` if valid; silently dropped if invalid |
| `arrayFields` | `QueryField<any>[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as CSV array | Field parsed via `getArray()` into `{ $in: [...] }` |
| `enumFields` | `QueryField<any>[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as enum | Currently identical to the unclassified/default path — plain string equality |
| `rangeFields` | `RangeFilterConfig[]` | Optional (`?? []`) | `range()` | Empty → `range()` is a no-op | Adds `{ field: { $gte, $lte } }` conditions with auto-derived or custom query-key names |
| `sortableFields` | `QueryField<any>[]` | Optional (`?? []`) | `sort()` | Empty → invalid/all `sort` tokens dropped | Whitelist-checked `.sort()` via Mongoose's `"field -field"` string syntax |
| `selectableFields` | `QueryField<any>[]` | Optional (`?? []`) | `fields()` | Empty → all `fields` tokens dropped → no `.select()` | `.select()` on whitelisted fields only |
| `populate` | `PopulateOptions[]` | Optional (`?? []`) | `populate()` | Empty → no-op | `.populate(entry)` per entry, unconditionally applied |
| `defaultSort` | `string` | Optional | `sort()` | Absent → no sort when `sort` param is missing | Applied only when the `sort` param is absent entirely |
| `defaultLimit` | `number` | Optional | `paginate()`, constructor | `DEFAULT_LIMIT` (20) | Initial `this.limit`; fallback when no valid `?limit=` is sent |
| `maxLimit` | `number` | Optional | `paginate()` | `MAX_LIMIT` (100) | Upper cap on an explicitly-supplied `?limit=` via `Math.min` |

**Constants** (`queryBuilder.constants.ts`):

| Constant | Value | Meaning |
|---|---|---|
| `DEFAULT_PAGE` | `1` | 1-indexed page fallback |
| `DEFAULT_LIMIT` | `20` | Page-size fallback |
| `MAX_LIMIT` | `100` | Hard cap on `?limit=` |
| `SEARCH_QUERY_KEY` | `"search"` | Free-text search key |
| `SORT_QUERY_KEY` | `"sort"` | Sort key |
| `PAGE_QUERY_KEY` | `"page"` | Page key |
| `LIMIT_QUERY_KEY` | `"limit"` | Limit key |
| `FIELDS_QUERY_KEY` | `"fields"` | Field-selection key |
| `DEFAULT_SORT` | `"-createdAt"` | Exported but **not consumed by the builder itself** — it's a convenience default available to configs that want to match it |
| `DEFAULT_SELECT` | `"-__v"` | Exported but **not consumed by the builder itself** — available if a module wants to exclude the Mongoose version key by default |

---

## 10. In-Repo Usage Example: `jobCategory`

`jobCategory` is currently the only module in this repository with a real builder config. It
demonstrates every major `FilterConfig` option working together.

**Config** (`modules/jobCategory/jobCategory.builder.config.ts`):

```ts
export const jobCategoryBuilderConfig: FilterConfig = {
  searchableFields: ["name", "slug"],
  filterableFields: ["isActive", "parentId", "depth"],
  numberFields: ["depth", "jobCount"],
  booleanFields: ["isActive"],
  objectIdFields: ["parentId"],
  rangeFields: [
    { field: "depth", minKey: "minDepth", maxKey: "maxDepth" },
    { field: "jobCount", minKey: "minJobCount", maxKey: "maxJobCount" },
  ],
  sortableFields: ["name", "depth", "jobCount", "createdAt", "updatedAt"],
  defaultSort: "name",
  selectableFields: [
    "name", "slug", "icon", "parentId", "depth", "jobCount",
    "isActive", "createdAt", "updatedAt",
  ],
  populate: [{ path: "parentId", select: "name slug" }],
  defaultLimit: 20,
  maxLimit: 100,
};
```

**Service consumption** (`modules/jobCategory/jobCategory.service.ts` — `getAllCategories`):

```ts
const getAllCategories = async (query: Record<string, unknown>) => {
  // Service-layer default: hide inactive categories unless explicitly requested
  const queryParams = { ...query, isActive: query.isActive ?? true };

  const { data, meta } = await new QueryBuilder(
    JobCategory,
    JobCategory.find(),
    queryParams,
    jobCategoryBuilderConfig,
  )
    .search()
    .filter()
    .range()
    .sort()
    .paginate()
    .fields()
    .populate()
    .lean()
    .execute();

  return { results: data, meta };
};
```

Two patterns worth noting in that real code:

1. **Composition before construction.** `queryParams` is assembled *before* the builder (merging a
   service-layer `isActive` default). This works cleanly because `getBoolean()`/`getNumber()`
   accept native types, not just strings.
2. **Meta is returned alongside data.** The `{ results: data, meta }` envelope travels to the
   controller, where it nests under `sendResponse`'s `data` field. Other modules that use the
   builder (or could use it — `jobListing.searchJobs` hand-rolls a similar but module-specific
   `buildJobQuery` flow) can follow the same `{ data, meta }` convention.

**Module-level query validation** (`modules/jobCategory/jobCategory.validation.ts`):

The module's `getCategoryQuerySchema` extends the shared `queryBuilderSchema` (which validates the
five shared keys `search`, `sort`, `fields`, `page`, `limit` as strings with numeric constraints on
`page`/`limit`) with module-specific keys: `isActive`, `parentId`, `depth`, `jobCount`, `minDepth`,
`maxDepth`, `minJobCount`, `maxJobCount`. This means invalid query values are rejected at the
middleware layer *before* the builder ever sees them — the recommended pattern for any module that
adopts the builder.

---

## 11. Method Chaining Order — Why It Matters

The canonical order used throughout the codebase is:

```ts
builder
  .search()    // 1. filter-building
  .filter()    // 1. filter-building
  .range()     // 1. filter-building
  .sort()      // 2. query-shaping
  .paginate()  // 2. query-shaping
  .fields()    // 2. query-shaping
  .populate()  // 2. query-shaping
  .lean()      // 2. query-shaping
  .execute();  // 3. terminal
```

Within group 1, order between `search()`/`filter()`/`range()` is irrelevant — they all merge into
the same `internalFilter` and are re-applied as one accumulated `.find(...)`. Within group 2, order
is also mostly irrelevant because each method reassigns `modelQuery` independently. The only
ordering rules that matter are:

1. **All chainables before `execute()`** — `execute()` fires the query; anything chained after it is
   too late.
2. **`paginate()` before `execute()`** — otherwise `getMeta()`'s numbers won't correspond to any
   applied `.skip()`/`.limit()`, and you'll report wrong totals/page counts.
3. **Never pre-chain anything onto `modelQuery` before the constructor** — the builder treats the
   passed-in query as a clean slate and owns all mutation from there.

---

## 12. Best Practices

The most valuable habits that emerge from how this builder is actually wired:

1. **One config file per module** (`*.builder.config.ts`), top-level export, imported into the
   service. Never inline configs.
2. **Validate query params at the middleware layer** with a Zod schema that extends
   `queryBuilderSchema` (see §10) — the builder is permissive and silent on invalid input, so the
   schema is your only enforcement point.
3. **Whitelist deliberately.** Every field that appears in API documentation for an endpoint must
   also appear in the corresponding `searchableFields`/`filterableFields`/`sortableFields`/
   `selectableFields` — the builder fails *silently* for unmapped fields, which is a quiet contract
   violation for clients.
4. **Classify by schema type.** Every field in `filterableFields` that is an ObjectId ref goes in
   `objectIdFields`; every numeric field goes in `numberFields`; every boolean in `booleanFields`.
   Unclassified fields silently become plain-string filters, which never match ObjectId or numeric
   storage.
5. **Keep `defaultLimit <= maxLimit`** and never set either to `0` (see §8.1).
6. **Pair the builder with `lean()`** on every read-only list endpoint.
7. **Index what you query.** Fields in `searchableFields`, `filterableFields`, `objectIdFields`,
   `rangeFields`, and `sortableFields` should carry matching indexes so the main find *and* the
   `countDocuments` in `getMeta()` both stay fast.

---

## 13. Common Mistakes

| # | Mistake | Symptom |
|---|---|---|
| 1 | Passing `Model.find()` as the first constructor argument | `getMeta()` misbehaves (count runs against the chained query, not a fresh base) |
| 2 | Forgetting `paginate()` before `execute()` | Correct data, but `meta` describes an unpaginated result (wrong `skip`/`limit`/`totalPages`) |
| 3 | Expecting an invalid `sort` value to fall back to `defaultSort` | No sort applied at all — silent natural-order results |
| 4 | Setting `defaultLimit: 0` or `maxLimit: 0` | `Infinity` pagination metadata; possibly enormous default pages |
| 5 | Leaving an ObjectId field unclassified | Plain-string filter never matches stored ObjectIds — endpoint appears broken |
| 6 | Expecting `enumFields` to validate values | It doesn't — behaves exactly like the unclassified string path |
| 7 | Calling `.lean(false)` to "undo" `.lean()` | No-op; results remain lean if it was enabled earlier in the chain |
| 8 | Assuming `search=` input is regex-escaped | Metacharacters are interpreted as real regex; unexpected matches or expensive scans |
| 9 | Configuring `defaultLimit > maxLimit` | Omitted `?limit=` silently serves `defaultLimit` records (the cap only applies to *explicit* values) |
| 10 | Putting the same field in `filterableFields` as both a range field and an equality field | Shallow-spread merge overwrites the key — last writer wins, silently dropping the other condition |
| 11 | `page=1.5` or other fractional input | Fractional `skip` passed to Mongoose — no integer validation occurs |
| 12 | Date range `toDate=YYYY-MM-DD` expecting end-of-day inclusion | Resolves to midnight UTC; documents later that day are excluded |
| 13 | Expecting `type: "date"` to be inferred from field name | Numeric mode is the default; `getNumber("2025-01-01")` → `NaN` → field skipped silently |

---

## 14. Performance Notes

**Counting is a real query.** `getMeta()` issues an independent `countDocuments(internalFilter)` on
every paginated request. On large collections with loose filters, this can dominate request
latency. Keep filter fields indexed, and consider `estimatedDocumentCount()` semantics only where
approximate totals are acceptable (this builder always counts exactly).

**Text search is the slowest capability this builder offers.** `$regex` without a `^` anchor cannot
use indexes; on large collections, consider migrating long-term to MongoDB text indexes or a
dedicated search engine if free-text search is a core feature.

**Skip scales linearly.** `skip(N)` still walks `N` documents. For deep pages on big collections,
offset pagination degrades; keyset pagination (`_id > lastSeenId`) is the scalable alternative,
outside this builder's scope.

**Population multiplies round trips.** Every `populate` entry is effectively an additional query.
Prefer `{ path, select }` population over full-document population on list endpoints.

**`Promise.all` is a free win.** The main find and the meta count run concurrently — keep them
concurrent; never sequentially `await` data and then meta.

---

## 15. Appendix: Quick Reference Cheat Sheet

| URL Param | Key | Example | Effect |
|---|---|---|---|
| Free-text search | `search` | `?search=react` | `$or` of case-insensitive `$regex` across `searchableFields` |
| Sort | `sort` | `?sort=-createdAt,name` | Whitelist-checked `.sort("-createdAt name")` |
| Pagination | `page`, `limit` | `?page=2&limit=10` | `.skip(10).limit(10)`, `limit` capped at `maxLimit` (default cap `100`) |
| Field selection | `fields` | `?fields=name,slug` | `.select()` on whitelisted fields only |
| Filter (string) | any `filterableFields` key | `?slug=backend` | Plain-string equality |
| Filter (number) | any `numberFields` key | `?depth=2` | Numeric equality |
| Filter (boolean) | any `booleanFields` key | `?isActive=true` | Literal (case-insensitive) `"true"`/`"false"` |
| Filter (CSV array) | any `arrayFields` key | `?role=ADMIN,HR` | `{ $in: ["ADMIN", "HR"] }` |
| Filter (ObjectId) | any `objectIdFields` key | `?parentId=64f1a2...` | Cast to `ObjectId`, dropped if invalid |
| Range (number) | `min{Field}` / `max{Field}` | `?minDepth=1&maxDepth=5` | `{ field: { $gte, $lte } }` (custom keys via `minKey`/`maxKey`) |
| Range (date) | `start{Field}` / `end{Field}` | `?startCreatedAt=2025-01-01` | Date range (requires `type: "date"` in config) |

**Canonical service snippet:**

```ts
const { data, meta } = await new QueryBuilder(
  SomeModel, SomeModel.find(), req.query, someBuilderConfig
)
  .search().filter().range().sort().paginate().fields().populate().lean()
  .execute();
```
