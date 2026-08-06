# QueryBuilder — Complete Technical Reference

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [What This Document Covers](#2-what-this-document-covers)
3. [Constructor](#3-constructor)
4. [Internal State](#4-internal-state)
5. [Execution Flow](#5-execution-flow)
6. [Private Helper Methods](#6-private-helper-methods)
7. [Public Chainable Methods](#7-public-chainable-methods)
   - [7.1 `search()`](#71-search)
   - [7.2 `filter()`](#72-filter)
   - [7.3 `range()`](#73-range)
   - [7.4 `sort()`](#74-sort)
   - [7.5 `paginate()`](#75-paginate)
   - [7.6 `fields()`](#76-fields)
   - [7.7 `populate()`](#77-populate)
   - [7.8 `lean()`](#78-lean)
8. [Terminal Methods](#8-terminal-methods)
   - [8.1 `getMeta()`](#81-getmeta)
   - [8.2 `execute()`](#82-execute)
9. [Configuration Reference (`FilterConfig`)](#9-configuration-reference-filterconfig)
10. [Configuration Rules & Rationale](#10-configuration-rules--rationale)
11. [File-by-File Documentation](#11-file-by-file-documentation)
12. [Method Chaining Order — Why It Matters](#12-method-chaining-order--why-it-matters)
13. [Real-World Module Examples](#13-real-world-module-examples)
14. [Best Practices](#14-best-practices)
15. [Common Mistakes](#15-common-mistakes)
16. [FAQ](#16-faq)
17. [Performance Notes](#17-performance-notes)
18. [Appendix: Quick Reference Cheat Sheet](#18-appendix-quick-reference-cheat-sheet)

---

## 1. Overview & Architecture

`QueryBuilder<T>` is a single, generic, reusable class that turns an incoming Express
`req.query` object into a fully-formed, paginated Mongoose query — search, filtering, numeric/date
ranges, sorting, field selection, population, and lean conversion — without any module (`user`,
`company`, `job`, ...) needing to hand-write that logic itself.

```text
builder/
└── queryBuilder.ts          ← the engine (documented in full below)
shared/
└── queryBuilder/    
    ├── queryBuilder.types.ts        ← FilterConfig / ModelQuery / QueryParams / PaginationMeta types
    ├── queryBuilder.constants.ts    ← default query key names + default numeric values
    └── index.ts               ← re-exports

modules/
├── user/
│   ├── user.builder.config.ts
│   └── user.service.ts
├── company/
│   ├── company.builder.config.ts
│   └── company.service.ts
└── job/
    ├── job.builder.config.ts
    └── job.service.ts
```

**Why split the engine from per-module config?**

- `QueryBuilder` has no idea what a "user" or a "job" is. It only knows the *shapes* of query
  operations: search a set of fields, filter a set of fields, range-filter a set of fields, sort by
  a set of fields, select a set of fields, populate a set of paths. Every one of those "sets" is
  supplied from the outside, per call site, via a `config: FilterConfig` object.
- This means the class in `query.builder.ts` never contains a string like `"role"`, `"salary"`, or
  `"companyId"` anywhere in it. All domain vocabulary lives in `*.builder.config.ts` files, one per
  module.
- **Why this matters in practice:** if the shared builder ever grew module-specific logic (e.g. `if
  (field === "salary") { ... }`), every future module would either have to route around that
  special case or risk silently triggering it. Keeping the builder 100% generic is what makes it
  safe to reuse across `user`, `company`, `job`, and any future module without regression risk to
  the others. A bug fix or feature added to `query.builder.ts` benefits every module simultaneously;
  a bug introduced there also *breaks* every module simultaneously — which is exactly why the class
  has to stay small, generic, and free of business rules.

---

## 2. What This Document Covers

| File | Provided to generate this doc? | Coverage in this document |
|---|---|---|
| `query.builder.ts` | ✅ Full source provided | Fully documented, method-by-method, from the actual implementation |
| `query.types.ts` | ❌ Not provided | Shape reconstructed from usage (§9, §11.2) — **verify against your actual file** |
| `query.constants.ts` | ❌ Not provided | Key names reconstructed from in-code comments (§11.3) — **numeric defaults unverified** |
| `index.ts` | ❌ Not provided | Documented generically as a re-export barrel (§11.4) |

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

> ⚠️ **This is a 4-argument constructor**, not 3. A common mistake (including in generic "how to use
> a QueryBuilder" examples) is to call `new QueryBuilder(SomeModel.find(), req.query, config)` —
> that is **not** this class's signature. This implementation requires the raw Mongoose `Model`
> *separately* from the already-started `Query` (`modelQuery`), because `getMeta()` needs the model
> to run an independent `countDocuments()` call (see §8.1).

| Parameter | Type | Required | Where it comes from | Internal use |
|---|---|---|---|---|
| `model` | `Model<T>` | Yes | The Mongoose model itself, e.g. `User` (not `User.find()`) | Used exclusively by `getMeta()` to run `model.countDocuments(this.internalFilter)` — a second, independent query used only to compute pagination totals |
| `modelQuery` | `ModelQuery<T>` | Yes | The already-initiated query, e.g. `User.find()` | This is the query object every chainable method (`search`, `filter`, `range`, `sort`, `paginate`, `fields`, `populate`, `lean`) mutates by reassignment (`this.modelQuery = this.modelQuery.X(...)`) |
| `queryParams` | `QueryParams` | Yes | `req.query` from Express | Read-only source for every query key (`search`, `sort`, `page`, `limit`, `fields`, plus every field named in `filterableFields`/`rangeFields`) |
| `config` | `FilterConfig` | Yes | A per-module `*.builder.config.ts` file | Drives every decision the builder makes — which fields are searchable/filterable/range/sortable/selectable, defaults, and caps. See §9 |

**Constructor side effect worth knowing:** `this.limit` is set immediately in the constructor from
`config.defaultLimit ?? DEFAULT_LIMIT`, *before* `paginate()` has ever run. This means:

- `this.limit` always has a usable value even if `paginate()` is never called in the chain.
- `this.skip` is **not** initialized here — it keeps its class-property default of `0` until
  `paginate()` runs (see §7.5 and the mistake called out in §15).

### Service Example

```ts
const builder = new QueryBuilder(
    User,              // Model<T>  — the model itself
    User.find(),        // ModelQuery<T> — the started query
    req.query,           // QueryParams
    userBuilderConfig    // FilterConfig
);
```

### Common Mistakes

- Passing `Model.find()` as the first argument instead of the bare `Model`. This compiles under a
  loose `any`-leaning generic setup but breaks `getMeta()` at runtime because `model.countDocuments`
  won't exist on a `Query` object the same way (and even if a similarly-named method exists, it
  won't be counting against a *fresh* base query — it would inherit whatever was already chained
  onto the passed-in query object).
- Swapping the `modelQuery` and `queryParams` argument order — both are objects, so TypeScript
  structural typing may not catch this immediately if `QueryParams` is a broad type like
  `Record<string, unknown>` **(inferred)**.

### Best Practices

- Always construct the builder with a *fresh* `Model.find()` — don't pre-chain `.sort()`,
  `.limit()`, etc. onto `modelQuery` before handing it to the constructor. Let the builder own all
  of that via its chainable methods so `internalFilter` and `this.limit`/`this.page`/`this.skip`
  stay the single source of truth.
- Build `config` once per module as a top-level constant (`userBuilderConfig`) and import it — don't
  construct it inline per request.

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
   .filter()     → reads config.filterableFields, adds equality/$in/ObjectId/bool filters
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
    const value = this.queryParams[key];
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
    const value = this.getString(key);
    if (!value) return undefined;
    const number = Number(value);
    if (Number.isNaN(number)) return undefined;
    return number;
}
```

- Returns `undefined` for missing/empty/non-numeric strings — callers must always check for
  `undefined`, never assume a number came back.
- `Number("")` would be `0`, but that path is pre-empted by the `!value` check, so an empty string
  correctly yields `undefined`, not `0`.
- `Number("  42 ")` → `42` (trimming happens upstream in `getString`).
- **Edge case:** `Number("1e3")` → `1000` (scientific notation is accepted, since `Number()`
  accepts it) — worth knowing if `minSalary=1e3` should probably be rejected but currently isn't.

### `getBoolean(key: string): boolean | undefined`

```ts
private getBoolean(key: string): boolean | undefined {
    const value = this.getString(key);
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
}
```

- **Strict literal match only.** `"1"`, `"0"`, `"True"`, `"TRUE"`, `"yes"` all return `undefined` —
  not `true`/`false`. Only the exact lowercase strings `"true"` / `"false"` are recognized.
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
    const value = this.getString(key);
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
}
```

- Delegates entirely to the native `Date` constructor's parsing — accepts anything `new Date(...)`
  accepts: ISO strings (`2025-01-01`), full ISO datetimes, and even loosely-formatted strings like
  `"Jan 1 2025"` (browser/Node-engine dependent). No format validation is enforced beyond "is this a
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
  key that already exists in `internalFilter` with the new value for that key. See §15 for the
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

**Parameters:** none directly — reads `SEARCH_QUERY_KEY` **(inferred: `"search"`, from the method's
own comment `search=john`)** off `queryParams`, and `config.searchableFields`.

**Return:** `this` (chainable). No return value carries data — everything is written to
`internalFilter`/`modelQuery` as a side effect.

**Internal algorithm:**
1. Read and trim the `search` query param. If empty → no-op, return immediately.
2. Read `config.searchableFields`. If empty/undefined → no-op (a keyword with nothing to search is
   silently ignored, not an error).
3. Build one `{ field: { $regex: keyword, $options: "i" } }` object per searchable field.
4. Wrap them all in a single `$or` and merge into `internalFilter` via `addFilter()`.

**Dry Run**

```
Incoming URL:
  GET /users?search=john

Incoming req.query:
  { search: "john" }

Config:
  searchableFields: ["name", "email"]

Execution:
  keyword = "john"
  searchableFields = ["name", "email"]
  conditions = [
    { name:  { $regex: "john", $options: "i" } },
    { email: { $regex: "john", $options: "i" } }
  ]

Generated filter (merged into internalFilter):
  { $or: [
      { name:  { $regex: "john", $options: "i" } },
      { email: { $regex: "john", $options: "i" } }
  ] }

Generated MongoDB query:
  db.users.find({
    $or: [
      { name:  { $regex: "john", $options: "i" } },
      { email: { $regex: "john", $options: "i" } }
    ]
  })
```

**Service Example**

```ts
const builder = new QueryBuilder(User, User.find(), req.query, userBuilderConfig);
const { data, meta } = await builder.search().filter().range().sort().paginate()
  .fields().populate().lean().execute();
```

**Edge Cases**
- `search=` (present but empty) → trimmed to `""` → treated identically to no `search` param at all.
- `searchableFields` configured but empty array vs. not configured at all → same behavior (both use
  `?? []`).
- A keyword containing regex special characters (e.g. `search=a.b*`) is passed **unescaped** into
  `$regex` — it will be interpreted as a real regex pattern, not a literal string. See mistake in
  §15.

**Common Mistakes**
- Forgetting to add a field to `searchableFields` and assuming `search=` will match it — it silently
  won't, no error is thrown.
- Not sanitizing/escaping user input before it reaches `$regex` — a user typing regex metacharacters
  can cause unexpected matches or, in pathological cases, expensive regex evaluation (see §17).

**Best Practices**
- Keep `searchableFields` short and string-typed. Don't include ObjectId or numeric fields — regex
  against a non-string field either won't match anything meaningful or, depending on the field type
  and Mongoose's schema-level casting, can behave unpredictably.
- If you need literal (non-regex) search safety, escape user input for regex metacharacters before
  it reaches this builder — this class does not do that for you.

**Performance Notes**
- `$regex` without a leading `^` anchor **cannot use an index efficiently** — Mongo has to scan
  every candidate document's field value. See §17 for index guidance.

---

### 7.2 `filter()`

```ts
filter() {
    const filterableFields = this.config.filterableFields ?? [];
    const booleanFields = new Set(this.config.booleanFields ?? []);
    const objectIdFields = new Set(this.config.objectIdFields ?? []);
    const arrayFields = new Set(this.config.arrayFields ?? []);
    const enumFields = new Set(this.config.enumFields ?? []);

    const filters: Record<string, unknown> = {};

    for (const field of filterableFields) {
        const value = this.getString(field);
        if (!value) continue;

        if (booleanFields.has(field)) { /* getBoolean → filters[field] = bool */ continue; }
        if (arrayFields.has(field))   { /* getArray → filters[field] = { $in: [...] } */ continue; }
        if (objectIdFields.has(field)){ /* Types.ObjectId.isValid → filters[field] = ObjectId */ continue; }
        if (enumFields.has(field))    { filters[field] = value; continue; }

        filters[field] = value; // plain string / nested field
    }

    if (Object.keys(filters).length) this.addFilter(filters);
    return this;
}
```

**Purpose:** exact-match (or typed-equivalent) filtering across an arbitrary whitelist of fields,
with per-field type handling.

**Why it exists:** a single generic loop replaces what would otherwise be repetitive
`if (req.query.role) filter.role = req.query.role;` blocks in every service file, while still
letting each field opt into boolean/array/ObjectId/enum handling.

**Parameters:** none directly — reads `config.filterableFields` plus the four classification sets
(`booleanFields`, `objectIdFields`, `arrayFields`, `enumFields`).

**Return:** `this`.

**Internal algorithm — type-resolution order (first match wins, and it's checked in this exact
order for every field):**
1. `booleanFields` → `getBoolean()` → only literal `"true"`/`"false"` produce a filter; anything
   else for that field is silently dropped (no fallback to string).
2. `arrayFields` → `getArray()` → comma-split → `{ $in: [...] }`.
3. `objectIdFields` → validated with `Types.ObjectId.isValid()` → cast to `new Types.ObjectId(value)`
   if valid; **silently skipped if invalid** (no error surfaced to the caller).
4. `enumFields` → stored as a **plain string**, identical to the default/unclassified path — see the
   FAQ (§16) for why this currently provides no extra validation.
5. Anything not in any of the above sets → plain string equality (also supports dot-notation nested
   fields, e.g. `"address.city"`, since Mongo/Mongoose treat that as a normal key).

**Dry Run**

```
Incoming URL:
  GET /users?role=ADMIN&isActive=true&companyId=64f1a2b3c4d5e6f7a8b9c0d1

Incoming req.query:
  { role: "ADMIN", isActive: "true", companyId: "64f1a2b3c4d5e6f7a8b9c0d1" }

Config:
  filterableFields: ["role", "isActive", "companyId"]
  booleanFields:    ["isActive"]
  objectIdFields:   ["companyId"]

Execution:
  role      → not boolean/array/objectId/enum → filters.role = "ADMIN"
  isActive  → boolean → getBoolean("isActive") = true → filters.isActive = true
  companyId → objectId → ObjectId.isValid(...) = true
              → filters.companyId = ObjectId("64f1a2b3c4d5e6f7a8b9c0d1")

Generated filter:
  {
    role: "ADMIN",
    isActive: true,
    companyId: ObjectId("64f1a2b3c4d5e6f7a8b9c0d1")
  }

Generated MongoDB query:
  db.users.find({
    role: "ADMIN",
    isActive: true,
    companyId: ObjectId("64f1a2b3c4d5e6f7a8b9c0d1")
  })
```

**Second dry run — `arrayFields`**

```
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
// userBuilderConfig.ts
export const userBuilderConfig: FilterConfig = {
  searchableFields: ["name", "email"],
  filterableFields: ["role", "isActive", "companyId"],
  booleanFields: ["isActive"],
  objectIdFields: ["companyId"],
};
```

**Edge Cases**
- A field in `filterableFields` but present as an *empty string* in the query (`?role=`) is skipped
  entirely (`if (!value) continue`) — you cannot use this mechanism to explicitly filter for an
  empty-string value.
- An invalid ObjectId string (`?companyId=not-an-id`) is dropped silently — the filter is simply
  not applied, so the query behaves as if `companyId` was never sent, rather than returning a 400
  or an empty result set.
- A field present in **two** classification sets at once (e.g. both `booleanFields` and
  `arrayFields`) resolves using whichever check comes first in the fixed order above
  (`boolean → array → objectId → enum`) — the later classification is effectively ignored for that
  field.

**Common Mistakes**
- Adding a field to `filterableFields` but forgetting to classify it in `objectIdFields` when it's a
  `Types.ObjectId` ref — it will be filtered as a **plain string**, and Mongoose/Mongo will likely
  cast-fail or simply never match, because the stored value is a BSON ObjectId, not a string.
- Expecting `enumFields` to reject invalid enum values — it does not validate against any enum list;
  it behaves exactly like an unclassified string field (see §16 FAQ).
- Relying on `filter()` for range/comparison queries (`>`, `<`) — this method only ever produces
  equality, `$in`, or exact-ObjectId conditions. Use `range()` (§7.3) for comparisons.

**Best Practices**
- Keep the four classification sets and `filterableFields` in sync explicitly in each
  `*.builder.config.ts` — don't rely on a field "just working" as a string by omission if it's
  actually an ObjectId or boolean in the schema.
- For fields backed by a real Mongoose enum in the schema, consider still doing schema-level enum
  validation (Mongoose will reject invalid document writes) — `filterableFields`/`enumFields` here
  is about *shaping a query*, not validating one.

**Performance Notes**
- Equality and `$in` filters on indexed fields (e.g. `role`, `companyId`) are cheap. ObjectId
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
        const defaultMaxKey = isDate ? `end${fieldName}`   : `max${fieldName}`;

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

**Parameters:** none directly — reads `config.rangeFields`, an array of range descriptors:
`{ field: string; type?: "date" | ...; minKey?: string; maxKey?: string }` **(inferred shape from
usage — confirm exact type union for `type` in `query.types.ts`)**.

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
   is ever added.
6. If only one bound is present, the resulting condition has only that one operator (`$gte` **or**
   `$lte`, not both) — this is an open-ended range, not an error.

**Dry Run — numeric range**

```
Incoming URL:
  GET /users?minSalary=20000&maxSalary=50000

Config:
  rangeFields: [ { field: "salary" } ]   // type omitted → numeric

Execution:
  fieldName = "Salary"
  isDate = false
  defaultMinKey = "minSalary"
  defaultMaxKey = "maxSalary"
  min = getNumber("minSalary") = 20000
  max = getNumber("maxSalary") = 50000
  condition = { $gte: 20000, $lte: 50000 }
  filters.salary = { $gte: 20000, $lte: 50000 }

Generated MongoDB query:
  db.users.find({ salary: { $gte: 20000, $lte: 50000 } })
```

**Dry Run — date range with custom keys**

```
Incoming URL:
  GET /users?fromDate=2025-01-01&toDate=2025-12-31

Config:
  rangeFields: [
    { field: "createdAt", type: "date", minKey: "fromDate", maxKey: "toDate" }
  ]

Execution:
  fieldName = "CreatedAt"
  isDate = true
  minKey used = "fromDate" (explicit override, not the derived "startCreatedAt")
  maxKey used = "toDate"
  min = getDate("fromDate") = Date("2025-01-01T00:00:00.000Z")
  max = getDate("toDate")   = Date("2025-12-31T00:00:00.000Z")
  filters.createdAt = { $gte: Date(...), $lte: Date(...) }

Generated MongoDB query:
  db.users.find({
    createdAt: { $gte: ISODate("2025-01-01T00:00:00.000Z"), $lte: ISODate("2025-12-31T00:00:00.000Z") }
  })
```

**Dry Run — open-ended range (min only)**

```
Incoming URL:
  GET /users?minSalary=20000

Generated MongoDB query:
  db.users.find({ salary: { $gte: 20000 } })   // no $lte at all — not { $lte: undefined }
```

**Service Example**

```ts
export const userBuilderConfig: FilterConfig = {
  // ...
  rangeFields: [
    { field: "salary" },                                                   // → minSalary / maxSalary
    { field: "createdAt", type: "date", minKey: "fromDate", maxKey: "toDate" }, // custom keys
  ],
};
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

**Parameters:** none directly — reads `SORT_QUERY_KEY` **(inferred: `"sort"`)**,
`config.sortableFields`, and `config.defaultSort`.

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
   default. See §15.

**Dry Run**

```
Incoming URL:
  GET /users?sort=-createdAt,name

Config:
  sortableFields: ["createdAt", "name", "email"]

Execution:
  sort = "-createdAt,name"
  sorts = ["-createdAt", "name"]
  validSorts:
    "-createdAt" → bare field "createdAt" → in sortableFields → kept
    "name"       → bare field "name"      → in sortableFields → kept
  validSorts = ["-createdAt", "name"]
  modelQuery.sort("-createdAt name")

Generated MongoDB query (conceptually):
  db.users.find({...}).sort({ createdAt: -1, name: 1 })
```

**Dry Run — all tokens rejected**

```
Incoming URL:
  GET /users?sort=internalSecretField

Config:
  sortableFields: ["createdAt", "name"]
  defaultSort: "-createdAt"

Execution:
  sorts = ["internalSecretField"]
  validSorts = []  (not whitelisted)
  → validSorts.length is 0 → modelQuery.sort() is never called
  → NOTE: defaultSort is NOT applied here, because the `if (!sort)` branch only runs when
    the query param is absent entirely, not when it's present-but-entirely-invalid.

Result: query runs with no explicit sort (Mongo natural order), even though a defaultSort exists.
```

**Service Example**

```ts
export const userBuilderConfig: FilterConfig = {
  // ...
  sortableFields: ["createdAt", "name", "email"],
  defaultSort: "-createdAt",
};
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
- Keep `sortableFields` limited to indexed fields where possible (see §17).

**Performance Notes**
- Sorting on a field with a supporting index avoids Mongo needing to do an in-memory sort (which is
  capped and can error out — `32MB` default sort memory limit) for large result sets. Compound
  indexes that match your filter + sort pattern (e.g. `{ companyId: 1, createdAt: -1 }`) are ideal
  for filtered, sorted, paginated list endpoints.

---

### 7.5 `paginate()`

```ts
paginate() {
    const page = this.getNumber(PAGE_QUERY_KEY);
    const limit = this.getNumber(LIMIT_QUERY_KEY);

    this.page = page && page > 0 ? page : DEFAULT_PAGE;

    this.limit = limit && limit > 0
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

**Parameters:** none directly — reads `PAGE_QUERY_KEY` **(inferred: `"page"`)**, `LIMIT_QUERY_KEY`
**(inferred: `"limit"`)**, `config.maxLimit`, `config.defaultLimit`.

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
   fallback branch (see the mistake flagged in §15).
4. `skip = (page - 1) * limit`.
5. Apply `.skip(skip).limit(limit)` to `modelQuery`.

**Dry Run**

```
Incoming URL:
  GET /users?page=2&limit=10

Config:
  defaultLimit: (unverified, from query.constants.ts)
  maxLimit: 50

Execution:
  page = getNumber("page") = 2 → 2 > 0 → this.page = 2
  limit = getNumber("limit") = 10 → 10 > 0 → this.limit = Math.min(10, 50) = 10
  this.skip = (2 - 1) * 10 = 10
  modelQuery.skip(10).limit(10)

Generated MongoDB query (conceptually):
  db.users.find({...}).skip(10).limit(10)
```

**Dry Run — limit exceeds cap**

```
Incoming URL:
  GET /users?limit=500

Config:
  maxLimit: 50

Execution:
  limit = 500 → 500 > 0 → this.limit = Math.min(500, 50) = 50   // capped

Result: client asked for 500, server enforces 50.
```

**Service Example**

```ts
export const userBuilderConfig: FilterConfig = {
  // ...
  defaultLimit: 20,
  maxLimit: 100,
};
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
- Forgetting to call `paginate()` at all in the chain. See §15 — this is one of the most impactful
  mistakes possible with this builder.
- Not passing an integer validator on `page`/`limit` upstream (e.g. in a DTO/Zod schema) if you need
  to guarantee whole-number pages — this method accepts fractional numbers as shown above.

**Best Practices**
- Always set both `defaultLimit` and `maxLimit` per module, and keep `defaultLimit <= maxLimit`.
- Always include `.paginate()` in the chain for any list endpoint, even if you expect small result
  sets — omitting it doesn't just skip pagination, it also produces meta stats (`getMeta()`) that
  won't match the actual returned data (see §15).

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

**Parameters:** none directly — reads `FIELDS_QUERY_KEY` **(inferred: `"fields"`)** and
`config.selectableFields`.

**Return:** `this`.

**Internal algorithm:**
1. No `fields` param → no-op (all fields returned, per schema/model default).
2. Split on commas, trim, drop empties, then keep only entries present in `selectableFields`.
3. If nothing survives whitelisting, `.select()` is never called (equivalent to "no fields param" —
   all fields returned) — same "invalid input silently ignored" pattern as `sort()`.

**Dry Run**

```
Incoming URL:
  GET /users?fields=name,email

Config:
  selectableFields: ["name", "email", "role", "createdAt"]

Execution:
  fields = "name,email"
  selected = ["name", "email"]
  validFields = ["name", "email"]   // both whitelisted
  modelQuery.select("name email")

Generated MongoDB query (conceptually):
  db.users.find({...}, { name: 1, email: 1 })
```

**Service Example**

```ts
export const userBuilderConfig: FilterConfig = {
  // ...
  selectableFields: ["name", "email", "role", "createdAt", "companyId"],
};
```

**Edge Cases**
- Mixing valid and invalid field names (`fields=name,password`) silently drops `password` if it's
  not whitelisted — the request still succeeds, just returns fewer fields than asked for, with no
  error indicating `password` was rejected.
- No interaction with Mongoose's own `select: false` schema-level field hiding — if a field is
  `select: false` at the schema level (e.g. a password hash), asking for it here via `fields=` would
  still be blocked by Mongoose itself unless `+field` syntax or `.select("+password")` is used
  elsewhere — this builder passes whatever whitelisted field names through as-is, with no `+`
  prefixing logic.

**Common Mistakes**
- Whitelisting a sensitive field (e.g. a field that should stay `select: false` at the schema level)
  in `selectableFields` — this builder trusts the config completely; it does not layer additional
  sensitivity checks on top.
- Expecting an error/warning when a requested field isn't whitelisted — there isn't one; it's
  dropped silently.

**Best Practices**
- Never include sensitive fields (password hashes, tokens, internal-only flags) in
  `selectableFields` — treat this whitelist as a security boundary, not just a convenience feature.
- Keep `selectableFields` roughly aligned with what your API documentation promises clients they can
  request.

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

**Purpose:** apply a fixed, module-defined set of Mongoose population instructions to every query
built by this instance — not client-controlled.

**Why it's different from the other methods:** every other public method reads something from
`queryParams` (client input). `populate()` reads **only** from `config.populate` — there is no
`?populate=` query-string mechanism here. Population targets are decided by the backend module, not
requested by the client.

**Parameters:** none directly — reads `config.populate`, an array whose entries are passed as-is to
Mongoose's `.populate()`, so each entry can be a plain string path (`"companyId"`) or a full
Mongoose populate options object (`{ path: "companyId", select: "name" }`) **(inferred from the
fact that `.populate(populate)` accepts whatever Mongoose's `.populate()` itself accepts)**.

**Return:** `this`.

**Internal algorithm:** loop over `config.populate` and call `.populate(entry)` once per entry,
sequentially chaining onto `modelQuery`. Mongoose supports multiple independent `.populate()` calls
in a chain, so this correctly accumulates all of them.

**Dry Run**

```
Config:
  populate: [
    "companyId",
    { path: "createdBy", select: "name email" }
  ]

Execution:
  modelQuery = modelQuery.populate("companyId")
  modelQuery = modelQuery.populate({ path: "createdBy", select: "name email" })

Generated query (conceptually):
  db.users.find({...})
    .populate("companyId")
    .populate({ path: "createdBy", select: "name email" })
```

**Service Example**

```ts
export const jobBuilderConfig: FilterConfig = {
  // ...
  populate: [
    { path: "companyId", select: "name logoUrl" },
    "postedBy",
  ],
};
```

**Edge Cases**
- No client-facing toggle to *disable* configured population — if a module always populates
  `companyId`, every request through that builder will always pay that join cost, regardless of
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
  `*.builder.config.ts` exports (e.g. `userListConfig` vs. `userDetailConfig`) rather than trying to
  make `populate` conditional inside a single config.

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

```
Service call:
  .lean()          → modelQuery.lean() is called → results will be plain objects
  .lean(false)     → nothing happens → modelQuery is unchanged (documents, not plain objects,
                      UNLESS lean() was never going to be called anyway — .lean(false) cannot
                      "undo" an earlier .lean() call in the same chain, because it never calls
                      any Mongoose method at all when enable is false)
```

**Service Example**

```ts
// Typical read-heavy list endpoint — lean is almost always desired:
await builder.search().filter().sort().paginate().lean().execute();

// If you specifically need Mongoose Document instances (e.g. to call instance methods
// on results later), simply omit .lean() from the chain entirely — do not rely on .lean(false).
```

**Edge Cases**
- `.lean(false)` reads as "explicitly disable lean" but the implementation cannot disable something
  that hasn't been enabled — it's functionally identical to not calling `.lean()` at all. There is no
  code path in this method that would ever *remove* `.lean()` from an already-lean query within the
  same chain (this only matters if some future refactor calls `.lean()` unconditionally elsewhere).

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

```
State at call time:
  internalFilter = { role: "ADMIN", isActive: true }
  page = 2
  limit = 10

Execution:
  total = await User.countDocuments({ role: "ADMIN", isActive: true })  // e.g. 47
  totalPages = Math.ceil(47 / 10) = 5

Returned meta:
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
  any `.skip()`/`.limit()` applied to the real query, because `paginate()` never ran (see §15).

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

```
Incoming URL:
  GET /users?search=john&role=ADMIN&isActive=true&minSalary=20000&sort=-createdAt&page=1&limit=10&fields=name,email&populate=ignored-not-supported-here

Incoming req.query:
  {
    search: "john", role: "ADMIN", isActive: "true", minSalary: "20000",
    sort: "-createdAt", page: "1", limit: "10", fields: "name,email"
  }

Config (userBuilderConfig):
  searchableFields: ["name", "email"]
  filterableFields: ["role", "isActive"]
  booleanFields: ["isActive"]
  rangeFields: [{ field: "salary" }]
  sortableFields: ["createdAt"]
  defaultLimit: 20
  maxLimit: 100
  selectableFields: ["name", "email", "role"]
  populate: [{ path: "companyId", select: "name" }]

Execution trace:
  search()   → internalFilter.$or = [{name:/john/i},{email:/john/i}]
  filter()   → internalFilter.role = "ADMIN", internalFilter.isActive = true
  range()    → internalFilter.salary = { $gte: 20000 }
  sort()     → modelQuery.sort("-createdAt")
  paginate() → page=1, limit=10, skip=0 → modelQuery.skip(0).limit(10)
  fields()   → modelQuery.select("name email")
  populate() → modelQuery.populate({ path: "companyId", select: "name" })
  lean()     → modelQuery.lean()
  execute()  → Promise.all([modelQuery, getMeta()])

Final internalFilter (used by BOTH the find and countDocuments):
  {
    $or: [{ name: {$regex:"john",$options:"i"} }, { email: {$regex:"john",$options:"i"} }],
    role: "ADMIN",
    isActive: true,
    salary: { $gte: 20000 }
  }

Generated MongoDB query:
  db.users.find(
    { $or: [...], role: "ADMIN", isActive: true, salary: { $gte: 20000 } },
    { name: 1, email: 1 }
  ).sort({ createdAt: -1 }).skip(0).limit(10).populate({ path: "companyId", select: "name" }).lean()

Final response shape:
  {
    meta: {
      page: 1, limit: 10, skip: 0, total: 3, totalPages: 1,
      hasNextPage: false, hasPreviousPage: false, nextPage: null, previousPage: null
    },
    data: [
      { name: "John Doe", email: "john@x.com", role: "ADMIN", companyId: { name: "Acme Inc" } },
      // ... up to 10 matching, lean, field-selected documents
    ]
  }
```

**Service Example**

```ts
export const getUsers = async (req: Request) => {
  const builder = new QueryBuilder(User, User.find(), req.query, userBuilderConfig);

  return builder
    .search()
    .filter()
    .range()
    .sort()
    .paginate()
    .fields()
    .populate()
    .lean()
    .execute();   // MUST be last — this is what actually hits the database
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

> Reconstructed entirely from how `this.config.*` is read inside `query.builder.ts`. The literal
> TypeScript interface in `query.types.ts` was not provided — property *names* and how each is used
> are accurate; exact optional/required modifiers and literal union types (e.g. the full set of
> valid `range.type` values) should be confirmed against your actual `query.types.ts`.

| Property | Type (inferred) | Required? | Used by | Default / Fallback Behavior | Generated Query Effect |
|---|---|---|---|---|---|
| `searchableFields` | `string[]` | Optional (`?? []`) | `search()` | Empty → `search()` becomes a no-op even if a keyword is sent | Adds `$or` of `$regex` conditions across listed fields |
| `filterableFields` | `string[]` | Optional (`?? []`) | `filter()` | Empty → `filter()` is a no-op | Adds equality / `$in` / ObjectId conditions per field |
| `booleanFields` | `string[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as boolean | Field parsed via `getBoolean()`; only exact `"true"`/`"false"` produce a filter |
| `objectIdFields` | `string[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as ObjectId | Field cast to `Types.ObjectId` if valid; silently dropped if invalid |
| `arrayFields` | `string[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as CSV array | Field parsed via `getArray()` into `{ $in: [...] }` |
| `enumFields` | `string[]` | Optional (`?? []`) | `filter()` | Empty set → no field treated as enum | Currently identical to the unclassified/default path — plain string equality (see FAQ) |
| `rangeFields` | `{ field: string; type?: "date" \| ...; minKey?: string; maxKey?: string }[]` | Optional (`?? []`) | `range()` | Empty → `range()` is a no-op | Adds `{ field: { $gte?, $lte? } }` per entry |
| `sortableFields` | `string[]` | Optional (`?? []`) | `sort()` | Empty → all client `sort` tokens rejected; falls to `defaultSort` only if `sort` param absent | `.sort("field1 -field2")` |
| `defaultSort` | `string` (Mongoose sort string) | Optional | `sort()` | Applied only when **no** `sort` query param was sent at all | `.sort(defaultSort)` |
| `selectableFields` | `string[]` | Optional (`?? []`) | `fields()` | Empty → all `fields` tokens rejected → no `.select()` call, all fields returned | `.select("field1 field2")` |
| `populate` | `(string \| PopulateOptions)[]` | Optional (`?? []`) | `populate()` | Empty → no population | One `.populate(entry)` call per array entry |
| `defaultLimit` | `number` | Optional | Constructor (initial `this.limit`), `paginate()` fallback when no valid `limit` sent | Falls back to `DEFAULT_LIMIT` **(unverified numeric value)** if not set | Controls page size when client omits `limit` — **not capped by `maxLimit`** in this fallback path |
| `maxLimit` | `number` | Optional | `paginate()` | Falls back to `MAX_LIMIT` **(unverified numeric value)** if not set | Caps any *explicitly requested* `limit` via `Math.min` |

### Correct vs. Incorrect Usage Examples

**Correct — explicit, complete config:**
```ts
export const userBuilderConfig: FilterConfig = {
  searchableFields: ["name", "email"],
  filterableFields: ["role", "isActive", "companyId"],
  booleanFields: ["isActive"],
  objectIdFields: ["companyId"],
  rangeFields: [{ field: "salary" }, { field: "createdAt", type: "date" }],
  sortableFields: ["createdAt", "name"],
  defaultSort: "-createdAt",
  selectableFields: ["name", "email", "role", "createdAt"],
  populate: [{ path: "companyId", select: "name" }],
  defaultLimit: 20,
  maxLimit: 100,
};
```

**Incorrect — relying on fallback/implicit behavior in production:**
```ts
export const userBuilderConfig: FilterConfig = {
  filterableFields: ["companyId"], // ⚠️ companyId not in objectIdFields — will be
                                    //    filtered as a plain string, breaking the query
  // no defaultLimit, no maxLimit  // ⚠️ relying entirely on DEFAULT_LIMIT/MAX_LIMIT
                                    //    constants — fine for a prototype, risky for
                                    //    production where you want per-module control
};
```

---

## 10. Configuration Rules & Rationale

| Rule | Why |
|---|---|
| `range.field` is required; everything else in a range descriptor is optional | The field is the only piece that can't be derived — key names and type default sensibly (`type` defaults to numeric behavior; keys default from the capitalized field name) |
| `type` on a range descriptor is optional and defaults to numeric-style parsing | Numeric ranges (salary, price, age) are the more common case; date ranges are the deliberate opt-in via `type: "date"` |
| `minKey`/`maxKey` are optional | Most fields are happy with the auto-derived `min{Field}`/`max{Field}` or `start{Field}`/`end{Field}` names; overrides exist only for cases where the public API needs friendlier names |
| Explicit configuration is strongly recommended over relying on constant fallbacks (`DEFAULT_LIMIT`, `MAX_LIMIT`, `DEFAULT_PAGE`) | Fallbacks exist purely as a safety net so the builder never crashes on a missing config value — not as a substitute for each module deciding its own real limits. A "people" module and an "audit log" module have very different sane page sizes; leaning on one shared global default across every module removes that per-module control |
| Never rely on fallback defaults in production | Because the fallback values live in a file that wasn't reviewed as part of this documentation pass, and because (per §8.1) a misconfigured `defaultLimit`/`maxLimit` can cause real bugs (including the `Infinity` totalPages case), every module should set these explicitly and intentionally |
| Every module maintains its own `*.builder.config.ts` | Keeps domain vocabulary (`"salary"`, `"companyId"`, `"role"`) out of the shared engine entirely — see §1 |
| The shared `QueryBuilder` must remain generic | Any module-specific `if` branch added to `query.builder.ts` would couple the shared engine's correctness to one module's needs and risk regressing every other module that uses it |

---

## 11. File-by-File Documentation

### 11.1 `query.builder.ts`

**Purpose:** the entire engine — the `QueryBuilder<T>` class documented in full in §3–§8.

**Responsibilities:** parsing raw query params into typed values (§6); building and merging the
Mongo filter object (`search`, `filter`, `range`); shaping the query (`sort`, `paginate`, `fields`,
`populate`, `lean`); executing it and returning `{ meta, data }`.

**Interacts with:** `query.types.ts` (for its type imports), `query.constants.ts` (for default query
key names and default numeric values), and — indirectly — every `*.builder.config.ts` in the
codebase, since each one is passed in as the `config: FilterConfig` constructor argument.

**Why it exists as a single file:** all the logic that must stay generic and reusable lives here,
isolated from anything module-specific.

### 11.2 `query.types.ts` — *(not provided; shape inferred from usage only)*

Based on how types are imported and used in `query.builder.ts`, this file must export at least:

- `FilterConfig` — the interface documented in §9.
- `ModelQuery<T>` — presumably an alias for Mongoose's `Query<T[], T>` or similar chainable query
  type, since it's the return/parameter type threaded through every chainable method.
- `QueryParams` — presumably `Record<string, unknown>` or similar, representing `req.query`, since
  values are read via `this.queryParams[key]` and immediately type-checked (`typeof value ===
  "string"`) rather than assumed to already be strings.
- `PaginationMeta` — the exact shape returned by `getMeta()` (§8.1): `{ page, limit, skip, total,
  totalPages, hasNextPage, hasPreviousPage, nextPage, previousPage }`.

**This document does not claim these are the literal interface definitions** — only that any valid
`query.types.ts` must support the field names and operations shown throughout §3–§8.

### 11.3 `query.constants.ts` — *(not provided; key names inferred from in-code comments)*

Based on the doc-comments directly above each method in `query.builder.ts` (e.g. `search()`'s
comment literally shows `search=john`), this file almost certainly exports:

| Constant | Inferred value | Confidence |
|---|---|---|
| `SEARCH_QUERY_KEY` | `"search"` | High — matches the `search()` method's own example comment |
| `SORT_QUERY_KEY` | `"sort"` | High — matches `sort()`'s example comment (`sort=-createdAt,name`) |
| `PAGE_QUERY_KEY` | `"page"` | High — matches `paginate()`'s example comment (`page=2&limit=10`) |
| `LIMIT_QUERY_KEY` | `"limit"` | High — same comment as above |
| `FIELDS_QUERY_KEY` | `"fields"` | High — matches `fields()`'s example comment (`fields=name,email`) |
| `DEFAULT_PAGE` | Not shown anywhere in the provided source | **Unverified — confirm in `query.constants.ts`** (conventionally `1`, but not confirmed here) |
| `DEFAULT_LIMIT` | Not shown anywhere in the provided source | **Unverified — confirm in `query.constants.ts`** |
| `MAX_LIMIT` | Not shown anywhere in the provided source | **Unverified — confirm in `query.constants.ts`** |

### 11.4 `index.ts` — *(not provided; documented generically)*

Standard convention for a barrel file at the root of a small module like this would be to re-export
the class and its public types so consumers can do:

```ts
import { QueryBuilder, FilterConfig } from "shared/queryBuilder";
```

rather than reaching into individual files. This document does not confirm the actual contents of
your `index.ts`.

---

## 12. Method Chaining Order — Why It Matters

```ts
await builder
  .search()
  .filter()
  .range()
  .sort()
  .paginate()
  .fields()
  .populate()
  .lean()
  .execute();
```

- **`search()` / `filter()` / `range()` can technically run in any relative order** — each one only
  ever writes to `internalFilter` via `addFilter()`, and (per §6) each `addFilter()` call re-applies
  the *entire* cumulative `internalFilter`, not just its own increment. As long as none of them
  target the same top-level field name (see the shallow-merge risk in §15), the final filter is the
  same regardless of the order these three run in.
- **`sort()`, `fields()`, `populate()`, `lean()` are independent of each other and of the filter
  methods** — they operate on `modelQuery` directly and don't read or write `internalFilter`. Their
  relative order among themselves doesn't change the final query.
- **`paginate()` should run after any method that might change *what* is being counted**, i.e. after
  `search()`/`filter()`/`range()` conceptually — although in this implementation it doesn't actually
  matter *technically* (since `paginate()` only calls `.skip()`/`.limit()` on `modelQuery` and
  doesn't read `internalFilter`), keeping it after the filter-building methods matches the
  request's natural "filter → sort → page → shape" flow and matches what `getMeta()` conceptually
  reports on.
- **`execute()` must always be last.** It's the only method that returns a `Promise` and actually
  contacts the database (§8.2). Every method before it is a synchronous, chainable state mutation.

---

## 13. Real-World Module Examples

> The `QueryBuilder` engine behavior shown below is the exact, documented behavior from §7–§8. The
> `*.builder.config.ts` contents in this section are illustrative examples (not sourced from an
> actual repository file you shared) to demonstrate the engine across different domains.

### 13.1 User Module

```ts
// modules/user/user.builder.config.ts
export const userBuilderConfig: FilterConfig = {
  searchableFields: ["name", "email"],
  filterableFields: ["role", "isActive", "companyId"],
  booleanFields: ["isActive"],
  objectIdFields: ["companyId"],
  rangeFields: [{ field: "createdAt", type: "date" }],
  sortableFields: ["name", "createdAt"],
  defaultSort: "-createdAt",
  selectableFields: ["name", "email", "role", "createdAt"],
  populate: [{ path: "companyId", select: "name" }],
  defaultLimit: 20,
  maxLimit: 100,
};
```

```
Request:  GET /users?search=john&role=ADMIN&isActive=true&sort=-createdAt&page=1&limit=10

Generated filter:
  {
    $or: [{name:/john/i},{email:/john/i}],
    role: "ADMIN",
    isActive: true
  }

Response:
  {
    meta: { page: 1, limit: 10, skip: 0, total: 2, totalPages: 1,
            hasNextPage: false, hasPreviousPage: false, nextPage: null, previousPage: null },
    data: [
      { name: "John Doe", email: "john@acme.com", role: "ADMIN",
        companyId: { name: "Acme Inc" }, createdAt: "2025-03-01T00:00:00.000Z" }
    ]
  }
```

### 13.2 Company Module

```ts
// modules/company/company.builder.config.ts
export const companyBuilderConfig: FilterConfig = {
  searchableFields: ["name", "registrationNumber"],
  filterableFields: ["industry", "isVerified"],
  booleanFields: ["isVerified"],
  enumFields: ["industry"],
  rangeFields: [{ field: "employeeCount" }],
  sortableFields: ["name", "createdAt"],
  defaultSort: "name",
  selectableFields: ["name", "industry", "isVerified", "employeeCount"],
  defaultLimit: 15,
  maxLimit: 50,
};
```

```
Request:  GET /companies?industry=SOFTWARE&isVerified=true&minEmployeeCount=50

Generated filter:
  { industry: "SOFTWARE", isVerified: true, employeeCount: { $gte: 50 } }

Generated MongoDB query:
  db.companies.find({ industry: "SOFTWARE", isVerified: true, employeeCount: { $gte: 50 } })
    .sort({ name: 1 }).skip(0).limit(15)
```

### 13.3 Job Module

```ts
// modules/job/job.builder.config.ts
export const jobBuilderConfig: FilterConfig = {
  searchableFields: ["title", "description"],
  filterableFields: ["status", "employmentType", "companyId"],
  objectIdFields: ["companyId"],
  arrayFields: ["employmentType"],
  rangeFields: [
    { field: "salary" },
    { field: "postedAt", type: "date", minKey: "fromDate", maxKey: "toDate" },
  ],
  sortableFields: ["postedAt", "salary"],
  defaultSort: "-postedAt",
  selectableFields: ["title", "status", "salary", "postedAt"],
  populate: [{ path: "companyId", select: "name logoUrl" }],
  defaultLimit: 20,
  maxLimit: 100,
};
```

```
Request:  GET /jobs?employmentType=FULL_TIME,CONTRACT&minSalary=40000&fromDate=2025-01-01

Generated filter:
  {
    employmentType: { $in: ["FULL_TIME", "CONTRACT"] },
    salary: { $gte: 40000 },
    postedAt: { $gte: ISODate("2025-01-01T00:00:00.000Z") }
  }
```

### 13.4 Product Module

```ts
// modules/product/product.builder.config.ts
export const productBuilderConfig: FilterConfig = {
  searchableFields: ["name", "sku"],
  filterableFields: ["category", "inStock"],
  booleanFields: ["inStock"],
  enumFields: ["category"],
  rangeFields: [{ field: "price" }],
  sortableFields: ["price", "createdAt"],
  selectableFields: ["name", "price", "category", "inStock"],
  defaultLimit: 24,
  maxLimit: 96,
};
```

```
Request:  GET /products?category=ELECTRONICS&minPrice=100&maxPrice=500&sort=price

Generated filter:
  { category: "ELECTRONICS", price: { $gte: 100, $lte: 500 } }

Generated query:
  db.products.find({...}).sort({ price: 1 }).skip(0).limit(24)
```

### 13.5 Order Module

```ts
// modules/order/order.builder.config.ts
export const orderBuilderConfig: FilterConfig = {
  filterableFields: ["status", "customerId"],
  objectIdFields: ["customerId"],
  enumFields: ["status"],
  rangeFields: [{ field: "createdAt", type: "date" }, { field: "totalAmount" }],
  sortableFields: ["createdAt", "totalAmount"],
  defaultSort: "-createdAt",
  selectableFields: ["status", "totalAmount", "createdAt"],
  populate: [{ path: "customerId", select: "name email" }],
  defaultLimit: 25,
  maxLimit: 100,
};
```

```
Request:  GET /orders?status=SHIPPED&startCreatedAt=2025-06-01&endCreatedAt=2025-06-30

Generated filter:
  {
    status: "SHIPPED",
    createdAt: { $gte: ISODate("2025-06-01"), $lte: ISODate("2025-06-30") }
  }
```

---

## 14. Best Practices

1. **Always call `paginate()`, even for endpoints you don't expect to grow.** Skipping it doesn't
   just skip pagination — it also produces `getMeta()` numbers that don't match the actual (fully
   unbounded) result set (see §15).
2. **Set `defaultLimit` and `maxLimit` explicitly, per module, with `defaultLimit <= maxLimit`.**
   Don't lean on `DEFAULT_LIMIT`/`MAX_LIMIT` fallbacks in production modules.
3. **Never configure `defaultLimit: 0` or `maxLimit: 0`** — this can produce an `Infinity`
   `totalPages` and an always-true `hasNextPage` (§8.1).
4. **Classify every `filterableFields` entry correctly** (`booleanFields` / `objectIdFields` /
   `arrayFields`) — an unclassified ObjectId or boolean field will filter incorrectly and silently.
5. **Explicitly set `type: "date"` on any range field that's a date** — don't rely on field naming.
6. **Keep `searchableFields` restricted to actual string fields** and consider sanitizing user input
   before it reaches `$regex` if literal (non-regex) matching is required.
7. **Always set `defaultSort`** for any list endpoint so pagination is stable and predictable even
   when the client sends no `sort` param.
8. **Default to `.lean()`** on read-only endpoints; skip it only when you need Mongoose document
   instance methods or virtuals.
9. **Keep `populate` entries minimal and field-selected** (`{ path, select }`) rather than
   full-document population, especially on list endpoints.
10. **`execute()` must always be the last call in the chain.**

---

## 15. Common Mistakes

| Mistake | What actually happens | Fix |
|---|---|---|
| Forgetting to call `.paginate()` | `modelQuery` never gets `.skip()`/`.limit()` applied — the query can return **every** matching document, while `getMeta()` still reports `page: 1` / `limit: <default>` computed from a `this.limit` that was never actually applied to the real query. Meta and actual data size can diverge | Always include `.paginate()` in the chain for list endpoints |
| `defaultLimit: 0` (or `maxLimit: 0`) | `Math.ceil(total / 0)` → `Infinity`; `hasNextPage` becomes permanently `true` | Never use `0` for either limit constant; use a real positive integer |
| Two config sections targeting the same field name (e.g. a field in both `filterableFields` and `rangeFields`) | `addFilter()`'s shallow spread merge means whichever of `filter()`/`range()` runs **last** overwrites the other's condition for that field entirely — one of the two filters is silently lost | Keep `filterableFields` and `rangeFields` mutually exclusive per field name |
| Expecting `enumFields` to validate against a fixed set of allowed values | It doesn't — it behaves identically to an unclassified string field (plain equality, any string value accepted) | Validate enum values elsewhere (e.g. a DTO/Zod schema before the query even reaches this builder), or rely on schema-level Mongoose enum validation for writes |
| Assuming an invalid `sort=` or `fields=` value falls back to any default | It doesn't — an all-invalid `sort` param results in **no sort at all** (not `defaultSort`); an all-invalid `fields` param results in **all fields returned** (not an error) | Validate `sort`/`fields` params against the same whitelist client-side, or add explicit fallback-on-all-invalid handling in your service layer if this matters for your use case |
| Not adding `type: "date"` for a date range field | The field is parsed with `getNumber()`, which returns `undefined` for any ISO date string (`NaN` result) — the range filter is silently never applied | Always set `type: "date"` explicitly in the range descriptor |
| Passing an ObjectId field through `filterableFields` without adding it to `objectIdFields` | It's filtered as a plain string, which will not match the BSON `ObjectId` values actually stored — the filter effectively returns zero matches, silently | Add the field to `objectIdFields` |
| Sending an invalid ObjectId string as a filter value | Silently dropped — no error, the field is simply not filtered on, so results are broader than the client likely intended | Validate ObjectId format before invoking `filter()`, e.g. in request validation middleware |
| `min > max` in a range filter | Passed straight through as an impossible condition (`{ $gte: 50000, $lte: 10000 }`) — zero results, no error | Validate `min <= max` in a request-level schema if this matters for UX |
| Relying on `.lean(false)` to disable an earlier `.lean()` call | It's a no-op — cannot undo `.lean()` once applied earlier in the same chain | Simply don't call `.lean()` (or `.lean(true)`) at all if you don't want lean results |
| Unescaped user input reaching `$regex` via `search()` | Regex metacharacters in the search term are interpreted literally as regex syntax, not escaped text | Escape regex metacharacters in the search keyword before it's used, if literal matching is required |

---

## 16. FAQ

**Q: Does `enumFields` validate the value against a real enum list?**
A: No. As implemented, `enumFields` behaves exactly like the default/unclassified string path —
`filters[field] = value` either way. It currently exists as a semantic label in the config (useful
for readability and possibly future extension) rather than as active validation logic.

**Q: What happens if I call `.execute()` before `.paginate()`?**
A: The query fires immediately on `.execute()` (since it awaits `this.modelQuery`, which is
thenable). Any chain methods called after `.execute()` has already resolved have no effect on the
already-returned result. Always put `.execute()` last.

**Q: Can clients request multiple values for one filterable field using the standard
`?role=A&role=B` (repeated key) style?**
A: No — `getString()` returns `""` for anything that isn't already a string, and Express would parse
repeated keys as an array, not a string. Use the comma-separated single-value style instead
(`?role=A,B`) with that field listed in `arrayFields`.

**Q: Does `range()` validate that `min <= max`?**
A: No. An inverted range (`min > max`) is passed straight through as a logically impossible
condition and simply returns zero matching documents — no error is thrown.

**Q: Is `.lean(false)` a way to explicitly opt out of lean queries?**
A: No — it's a no-op. There is no code path that removes an already-applied `.lean()`. Omit the
`.lean()` call entirely if you don't want lean results.

**Q: Does `getMeta()`'s total count reflect sorting, field selection, or population?**
A: No, and that's intentional. `total`/`totalPages` are computed via
`model.countDocuments(this.internalFilter)`, which only reflects `search()`/`filter()`/`range()`
conditions — sorting, field selection, population, and lean conversion don't change which documents
match, only how they're shaped, so they correctly play no role in the count.

**Q: What is the exact numeric value of `DEFAULT_LIMIT` / `MAX_LIMIT` / `DEFAULT_PAGE`?**
A: Not determinable from the source shared for this document — `query.constants.ts` wasn't
included. Check that file directly, and per the best practices in §14, don't rely on those
fallbacks in production modules anyway — set `defaultLimit`/`maxLimit` explicitly per module.

**Q: Why does the constructor take both `model` and `modelQuery` separately, instead of deriving
one from the other?**
A: `getMeta()` needs an independent `countDocuments()` call against the base model, separate from
whatever the main `modelQuery` has accumulated (filters, sort, skip, limit, select, populate). Since
`modelQuery` is progressively mutated through the chain, the class needs the untouched `model`
reference to reliably run that separate count query.

---

## 17. Performance

**Regex performance (`search()`):** `$regex` conditions without a `^` anchor cannot use a B-tree
index efficiently — MongoDB must evaluate the regex against every candidate document's field value
for the scanned range. For large collections, consider a dedicated text index (`$text`) or a search
service (e.g. Atlas Search, Elasticsearch) if free-text search performance becomes a bottleneck;
this builder's `search()` implementation is a straightforward regex `$or`, appropriate for small-to
medium collections or narrow candidate sets (e.g. already filtered by `companyId`).

**Indexes:** every field listed in `filterableFields`, `rangeFields`, and `sortableFields` that's
actually used frequently in production traffic should have a supporting index. For combined
filter+sort+paginate patterns (the common case — e.g. "all jobs for a company, sorted by
`postedAt`"), a compound index matching that pattern (`{ companyId: 1, postedAt: -1 }`) will serve
the query far more efficiently than separate single-field indexes.

**Pagination:** this builder implements **offset-based** pagination (`skip`/`limit`). `skip` cost
grows with the number of documents skipped — for very deep pagination (e.g. page 10,000) on large
collections, this becomes expensive because MongoDB still has to walk past all skipped documents.
If deep pagination is a real requirement, consider cursor/keyset pagination (`_id > lastSeenId` or
`createdAt < lastSeenTimestamp`) as a future enhancement — not currently implemented here.

**Populate:** each populated path is effectively an extra query/lookup. Only populate what the
response actually needs, and prefer `{ path, select }` entries over full-document population,
especially in `populate` arrays used by list endpoints.

**Lean:** `.lean()` (§7.8) skips Mongoose document hydration — meaningfully cheaper for read-heavy
endpoints returning many documents, since there's no getters/virtuals/change-tracking overhead per
document.

**ObjectId filtering:** equality/`$in` filters on `Types.ObjectId`-cast fields (§7.2) are typically
the cheapest, most index-friendly filters this builder produces — favor them where possible over
regex-based matching.

---

## 18. Appendix: Quick Reference Cheat Sheet

| Method | Reads from | Writes to | Async? |
|---|---|---|---|
| `search()` | `queryParams.search`, `config.searchableFields` | `internalFilter` (via `addFilter`) | No |
| `filter()` | `queryParams[field]` for each `filterableFields` entry, plus 4 classification sets | `internalFilter` | No |
| `range()` | `queryParams[minKey/maxKey]`, `config.rangeFields` | `internalFilter` | No |
| `sort()` | `queryParams.sort`, `config.sortableFields`, `config.defaultSort` | `modelQuery` directly | No |
| `paginate()` | `queryParams.page`, `queryParams.limit`, `config.defaultLimit`, `config.maxLimit` | `page`, `limit`, `skip`, `modelQuery` | No |
| `fields()` | `queryParams.fields`, `config.selectableFields` | `modelQuery` directly | No |
| `populate()` | `config.populate` (not client-controlled) | `modelQuery` directly | No |
| `lean()` | argument `enable` (default `true`) | `modelQuery` directly | No |
| `getMeta()` | `internalFilter`, `page`, `limit`, `skip` | — (returns `PaginationMeta`) | **Yes** |
| `execute()` | `modelQuery`, `getMeta()` | — (returns `{ meta, data }`) | **Yes** |

**Standard chain:**
```ts
await new QueryBuilder(Model, Model.find(), req.query, moduleBuilderConfig)
  .search()
  .filter()
  .range()
  .sort()
  .paginate()
  .fields()
  .populate()
  .lean()
  .execute();
```