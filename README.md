# QuickHire Backend

**QuickHire** is a production-grade RESTful API backend for a job marketplace platform, built with **TypeScript**, **Express 5**, and **Mongoose (MongoDB)**. It supports a three-sided marketplace — **Job Seekers**, **Employers**, and **Platform Administrators** — with a complete authentication layer (local JWT + Google OAuth 2.0), role-based access control, company team management, SEO-friendly job listings with text-indexed search, and a fully generic, reusable `QueryBuilder` engine for search/filter/sort/paginate operations across every module.

| Property | Detail |
| --- | --- |
| **Runtime** | Node.js (v18+ recommended) |
| **Language** | TypeScript 5.8 (strict, compiled to `dist/`) |
| **Framework** | Express 5.1 with cookie sessions |
| **Database** | MongoDB via Mongoose 8 |
| **Auth** | JWT access/refresh tokens (httpOnly cookies) + Passport.js Google OAuth 2.0 |
| **Validation** | Zod 4 schemas with custom middleware |
| **Code quality** | ESLint 9 (flat config) + Prettier |
| **API Base URL** | `http://localhost:4000/api/v1` |

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Features](#features)
3. [Prerequisites](#prerequisites)
4. [Installation & Setup](#installation--setup)
5. [Environment Variables](#environment-variables)
6. [Available Scripts](#available-scripts)
7. [Project Structure](#project-structure)
8. [Domain Model & Roles](#domain-model--roles)
9. [API Endpoints](#api-endpoints)
10. [Authentication & Authorization](#authentication--authorization)
11. [The QueryBuilder Engine](#the-querybuilder-engine)
12. [Module Conventions & Code Generation](#module-conventions--code-generation)
13. [Error Handling & Response Format](#error-handling--response-format)
14. [Production & Deployment Notes](#production--deployment-notes)
15. [Contributing](#contributing)
16. [Author & Contact](#author--contact)

---

## Overview & Architecture

The application follows the classic **controller → service → model** layered architecture with a module-per-domain folder layout. Every domain entity lives in its own directory under `src/app/modules/`, and each module contains the same set of focused files (`controller`, `service`, `route`, `model`, `interface`, `validation`, `constants`, `utils`), which keeps concerns strictly separated and makes the codebase navigable at a glance.

The request pipeline is wired once in `src/app.ts` and then reused by every route:

```text
Request
  → express.json()                        (body parsing)
  → cookieParser()                        (auth cookies)
  → express-session + passport session    (Google OAuth state)
  → CORS (credentials enabled)
  → /api/v1/:module routes
      → validateRequest (Zod)
      → checkAuth (JWT + role guard)
      → controller (catchAsync-wrapped)
          → service (business logic + models)
              → sendResponse (uniform JSON)
  → globalErrorHandler (last in chain)
  → notFound (404 catch-all)
```

`src/server.ts` is a thin bootstrap: it connects to MongoDB via Mongoose, starts the HTTP server on the configured port, seeds the super-admin account if it does not exist, and installs **graceful-shutdown handlers** for `SIGINT`, `SIGTERM`, `unhandledRejection`, and `uncaughtException` so the process exits cleanly in any failure scenario.

## Features

### Core

- **Three actor roles** — `super_admin`, `admin`, `seeker`, `employer` — enforced per-route with `checkAuth(...)`.
- **Local authentication** with bcrypt-hashed passwords, JWT access + refresh token pairs, httpOnly cookies, and token refresh/rotate flow.
- **Google OAuth 2.0** via Passport.js: new users are auto-created with the requested role, existing users have the Google provider linked automatically, and OAuth flows pass role + redirect state securely.
- **Company accounts** with slugged profiles, admin-controlled verification status, and a team-membership system with granular roles (`OWNER`, `ADMIN`, `HR`, `RECRUITER`, `INTERVIEWER`) and a permission map.
- **Job listings** with SEO-friendly slugs, full-text search (`$text` index with relevance scoring), typed filters (type, work mode, experience level, category, salary, location), a draft → published → closed/expired lifecycle, featured toggling, view/application counters, and automatic expiry handling.
- **Hierarchical job categories** with parent references, depth levels, slug trees, breadcrumbs, and automatic job-count rollups.
- **Seeker profiles** with headline, bio, skills, languages, expected salary (negotiable), availability status, social links, and an auto-computed profile-completeness score.
- **Education & experience entries** scoped to the seeker's profile, with ownership checks and transactional deletes that keep profile state consistent.
- **Resumes** — seekers manage multiple uploaded resumes (title + file URL) with one default, ownership-restricted CRUD, and safe deletion that promotes a fallback default when the deleted resume was the default.
- **Job applications** linked to a seeker, their resume, and a job listing — seeker-only submission with duplicate protection (one application per seeker per job), expired-job and draft-job guards, seeker withdrawal with counter rollback, and employer-side review (status, note, score) restricted to members managing that listing.
- **Super-admin seeding** on every boot from environment variables (safe, idempotent).

### Platform / Developer Experience

- **Generic `QueryBuilder<T>` engine** — one ~700-line class powering search, filtering (string/number/boolean/ObjectId/CSV-array), numeric/date ranges, sorting, field selection, population, and pagination for every module. Fully documented in [`QueryBuilderDocumentation.md`](./QueryBuilderDocumentation.md), rewritten to match the current implementation verbatim.
- **CLI module scaffolder** — `npm run generateModule` interactively creates a new module directory with all standard files pre-filled.
- **Uniform API response envelope** — `{ statusCode, success, message, data }` with a `meta` object for pagination.
- **Zod 4 request validation** for bodies and queries, including a multipart/form-data passthrough (`req.body.data`).
- **Global error handler** translating `AppError`, `ZodError`, `CastError`, duplicate-key (E11000), and validation errors into consistent JSON.
- **ESLint (flat config) + Prettier** with shared VS Code workspace settings (`formatOnSave`, flat-config support).
- **Hot reload** in development via `ts-node-dev --respawn`.

## Prerequisites

| Tool | Requirement |
| --- | --- |
| Node.js | v18 or later (v22 LTS recommended) |
| npm | v9 or later (ships with Node) |
| MongoDB | Local instance or an Atlas connection string |
| Git | For cloning and version control |

## Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/Humayun1318/QuickHire.git
cd QuickHire

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Then edit .env with your real values (see "Environment Variables" below)

# 4. Start the development server (hot reload)
npm run dev
```

The server boots on the configured `PORT` (default `4000`), connects to MongoDB, and seeds a super-admin account from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` if one does not already exist.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Variables marked **(runtime)** are required for the application to start; the configuration loader in `src/app/config/env.ts` validates their presence.

```dotenv
# Runtime
NODE_ENV=development                   # "development" | "production"
PORT=4000                              # HTTP listen port
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/<db>
FRONTEND_URL=http://localhost:3000     # Allowed CORS origin (credentials enabled)

# Security
BCRYPT_SALT_ROUND=12                   # bcrypt cost factor
EXPRESS_SESSION_SECRET=<long-random>   # server-side session secret (Passport/Google OAuth)

# JWT
JWT_ACCESS_SECRET=<long-random>
JWT_ACCESS_EXPIRES=7d                  # ms / "7d" style strings accepted by jsonwebtoken
JWT_REFRESH_SECRET=<long-random>
JWT_REFRESH_EXPIRES=30d

# Super admin seed
SUPER_ADMIN_EMAIL=admin@quickhire.com
SUPER_ADMIN_PASSWORD=<strong-password>

# Google OAuth (Passport strategy)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
```

> **Note on `BCRYPT_SALT_ROUND`:** the example file ships with `50`, which is far beyond bcrypt's acceptable cost-factor range (1–31) and will throw at runtime. Use a sensible value such as `12`.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server with hot reload (`ts-node-dev --respawn --transpile-only`) |
| `npm start` | Run the compiled production bundle from `dist/server.js` |
| `npm run build` | Compile TypeScript to JavaScript (`tsc`) into `dist/` |
| `npm run generateModule` | Interactively scaffold a new module (controller, service, route, model, interface, validation, constants, utils) |
| `npm run lint` | Lint all TypeScript files with ESLint (flat config) |
| `npm run lint:fix` | Lint and automatically fix fixable issues |
| `npm run format` | Format the entire workspace with Prettier |
| `npm test` | Placeholder — no test suite is configured yet |

## Project Structure

```text
QuickHire/
├── src/
│   ├── server.ts                      # Bootstrap: DB connect, server start, super-admin seed, graceful shutdown
│   ├── app.ts                         # Express app factory: middleware, route mounting, error handlers
│   └── app/
│       ├── builder/QueryBuilder.ts    # Generic search/filter/sort/paginate engine (≈700 lines)
│       ├── config/
│       │   ├── env.ts                 # .env loading + validation (typed EnvConfig)
│       │   └── passport.ts            # Google OAuth 2.0 strategy + serialize/deserialize
│       ├── errorHelpers/
│       │   └── AppError.ts            # Custom error class carrying an HTTP status code
│       ├── helpers/                   # Error-type translators (CastError, duplicate key, Zod, validation)
│       ├── interfaces/                # Global type declarations (index.d.ts, error.types.ts)
│       ├── middlewares/
│       │   ├── checkAuth.ts           # JWT verification → user lookup → status check → role guard
│       │   ├── validateRequest.ts     # Zod validation for bodies and query strings
│       │   ├── globalErrorHandler.ts  # Last-resort error handler with per-type formatting
│       │   └── notFound.ts            # 404 catch-all
│       ├── modules/                   # Domain modules (see "Module Conventions")
│       │   ├── auth/                  # Local login, register, token refresh, Google OAuth, password change
│       │   ├── user/                  # User CRUD, role/status enums, auth-entry sub-schema
│       │   ├── jobListing/            # Jobs: CRUD, slugs, text search, filters, lifecycle, featured
│       │   ├── jobCategory/           # Hierarchical categories with slugs, tree, breadcrumbs, job counts
│       │   ├── Application/           # Job applications
│       │   ├── company/               # Employer company profiles, slugs, verification
│       │   ├── companyMember/         # Team roles + permission-based authorization
│       │   ├── seekerProfile/         # Seeker profiles + completeness scoring
│       │   ├── seekerEducation/       # Education entries per seeker
│       │   ├── seekerExperience/       # Experience entries per seeker
│       │   ├── resume/                 # Seeker resumes: CRUD, default selection, safe deletion
│       ├── routes/index.ts            # Central registry mounting all module routers on /api/v1
│       ├── shared/
│       │   ├── interfaces/            # Shared types (address, socialLinks)
│       │   ├── schemas/               # Shared Zod schemas (address, socialLinks, query builder)
│       │   └── validation/            # Shared validation helpers
│       └── utils/                     # jwt, catchAsync, sendResponse, setAuthCookie, userTokens,
│                                      # seedSuperAdmin, validateUserStatus, isValidObjectId, etc.
├── scripts/generate-module.ts         # CLI module scaffolder
├── QueryBuilderDocumentation.md       # Complete technical reference for the QueryBuilder engine
├── .env.example                       # Template environment file
├── .prettierrc / .prettierignore      # Formatting rules
├── eslint.config.mjs                  # ESLint flat config
├── tsconfig.json                      # TypeScript compiler options
└── package.json                       # Dependencies + scripts
```

## Domain Model & Roles

### User Roles

| Role | Value | Who |
| --- | --- | --- |
| `SUPER_ADMIN` | `super_admin` | Platform owner, seeded from env, full access |
| `ADMIN` | `admin` | Platform staff: manage categories, feature jobs, verify companies, view users |
| `SEEKER` | `seeker` | Job seekers: manage profile, education, experience, resumes, submit applications |
| `EMPLOYER` | `employer` | Employers: own a company, manage members, post/manage jobs |

### Account Lifecycle

Users carry a `status` field with four states: `active` (can log in), `inactive` (soft-deactivated), `suspended` (blocked pending admin review), and `banned` (permanently blocked). The `checkAuth` middleware and login flows consult this field on every authenticated request, and the `toJSON` transform strips the password field even if it was explicitly selected — defense in depth.

### Job Listing Lifecycle

```text
draft  →  published  →  closed   (manual transitions, employer)
                  →  expired    (automatic, when expiresAt passes)
```

A closed job may be reopened to `published` as long as it has not expired. Listings support job types (`full-time`, `part-time`, `freelance`, `internship`, `contract`), work modes (`remote`, `onsite`, `hybrid`), experience levels (`entry`, `junior`, `mid`, `senior`, `lead`), and salaries in `BDT`, `USD`, `GBP`, or `EUR` (negotiable flag supported).

### Company Teams

Each company has one `OWNER` and optional `ADMIN`, `HR`, `RECRUITER`, and `INTERVIEWER` members, defined in `ROLE_PERMISSIONS` (e.g., `manage_members`, `post_jobs`, `view_applications`, `schedule_interviews`). Route-level checks require `EMPLOYER`, while service-level authorization (`requireCompanyRole`) enforces that the requester actually holds an OWNER/ADMIN role in the target company before member or job operations proceed.

### Key Models

| Model | Highlights |
| --- | --- |
| `User` | Unique lowercase email, `auths[]` provider entries (local + Google), role/status indexes, `seekerProfileId` / `companyId` FKs, password excluded from JSON output |
| `JobListing` | Unique title slug, `$text` index for search, `companyId` + `categoryId` + `postedBy` refs, `viewCount`/`applicationCount` counters, status lifecycle, expiry auto-handling |
| `JobCategory` | Self-referencing `parentId`, `depth`, `jobCount` rollups, unique slugs, soft-delete (`isActive`) |
| `Company` | Unique slug, verification status + note managed by admins, embedded address + social links |
| `CompanyMember` | `companyId` + `userId` pair uniqueness, team role + permission check helper |
| `SeekerProfile` | Headline, bio, skills, languages, expected salary (amount/currency/negotiable), availability, social links, `profileCompleteness` |
| `SeekerEducation` / `SeekerExperience` | Owned by seeker via `userId` + `profileId`, ownership guards on update/delete |
| `Resume` | `userId` FK, title + file URL, `isDefault`, `downloadCount`, unique user-id uniqueness | (seeker-owned)
| `Application` | `jobId` + `applicantId` + `resumeId` refs, `coverLetter`, `status` flow (`pending` → `reviewed` / `accepted` / `rejected` / `withdrawn`), `employerNote`, `score`, unique `jobId` + `applicantId` index, appliedAt/updatedAt |

## API Endpoints

All endpoints are prefixed with **`/api/v1`**. Endpoints marked **(public)** require no token; others require a valid JWT access token and the roles shown.

### Authentication — `/auth`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Create a user (local) |
| POST | `/auth/login` | Public | Local login → access + refresh token cookies |
| POST | `/auth/refresh-token` | Public | Issue a new access token from a refresh token |
| POST | `/auth/logout` | Public | Log out |
| POST | `/auth/change-password` | Any authenticated | Change password |
| GET | `/auth/google` | Public | Initiate Google OAuth (accepts `?role=` and `?redirect=`) |
| GET | `/auth/google/callback` | Public | OAuth callback, issues tokens |
| PATCH / DELETE / GET | `/auth/update/:id`, `/auth/delete/:id`, `/auth/:id` | Varies | Auth record management |
| GET | `/auth` | — | List all auth records |

### Users — `/users`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/users` | `admin`, `super_admin` | List all users |
| GET | `/users/:id` | — | Get user by ID |
| PATCH | `/users/update/:id` | — | Update user |
| DELETE | `/users/delete/:id` | — | Delete user |

### Jobs — `/jobs`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/jobs` | Public | Search & filter the job board (`?searchTerm=react&type=full-time&page=1&limit=20` + QueryBuilder params) |
| GET | `/jobs/slug/:slug` | Public | Job detail by SEO slug |
| GET | `/jobs/:jobId` | Public | Job detail by ID (increments `viewCount`) |
| POST | `/jobs` | `employer` | Publish a job listing |
| PATCH | `/jobs/:jobId` | `employer` | Update job content |
| PATCH | `/jobs/:jobId/status` | `employer` | Change lifecycle status |
| PATCH | `/jobs/:jobId/featured` | `admin` | Toggle featured flag |
| DELETE | `/jobs/:jobId` | `employer` | Soft-delete a job |

### Job Categories — `/job-categories`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/job-categories/tree` | Public | Full category tree with breadcrumbs |
| GET | `/job-categories/roots` | Public | Top-level categories (homepage) |
| GET | `/job-categories/slug/:slug` | Public | Category detail by slug |
| GET | `/job-categories/:categoryId/children` | Public | Children for dynamic dropdowns |
| GET / POST | `/job-categories` | `admin`, `super_admin` | List (QueryBuilder) / create |
| PATCH / DELETE | `/job-categories/:categoryId` | `admin`, `super_admin` | Update / soft-delete |

### Companies — `/companies`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/companies` | `employer` | Create company (one per employer) |
| GET | `/companies/me` | `employer` | Own company profile |
| GET | `/companies?slug=` | Public | Company by slug (seekers browsing) |
| PATCH | `/companies/:companyId` | `employer` | Update own company |
| DELETE | `/companies/:companyId` | `employer` | Soft-delete own company |
| PATCH | `/companies/:companyId/verification` | `admin`, `super_admin` | Update verification status + note |

### Company Members — `/companies/members`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/companies/members` | `employer` | Add a member (OWNER/ADMIN check in service) |
| GET | `/companies/members` | `employer`, `admin`, `super_admin` | List members of a company |
| PATCH | `/companies/members/:memberId` | `employer` | Change a member's role |
| DELETE | `/companies/members/:companyId/:memberId` | `employer` | Remove a member |
| DELETE | `/companies/members/leave/:companyId` | `employer` | Leave the company (owner cannot leave) |

### Seeker Profile — `/seeker-profiles`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/seeker-profiles/create` | `seeker` | Create profile (one per user) |
| GET | `/seeker-profiles/me` | `seeker` | Own profile |
| GET | `/seeker-profiles` | `employer`, `admin`, `super_admin` | View profiles (recruiting) |
| PATCH | `/seeker-profiles/update` | `seeker` | Update own profile |
| DELETE | `/seeker-profiles/me` | `seeker` | Soft-delete own profile |

### Education — `/seeker-educations` & Experience — `/seeker-experiences`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/{module}/create` | `seeker` | Add an entry (profile must exist) |
| GET | `/{module}/list` | `seeker` | List own entries |
| PATCH | `/{module}/update/:id` | `seeker` | Update own entry (ownership guard) |
| DELETE | `/{module}/delete/:id` | `seeker` | Delete own entry (transactional) |

### Applications — `/applications`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/applications` | `seeker` | Submit an application for a job (duplicate, expired, and draft guards) |
| GET | `/applications/my-applications` | `seeker` | List own applications |
| PATCH | `/applications/:applicationId/withdraw` | `seeker` | Withdraw own application (status → `withdrawn`, counters sync) |
| GET | `/applications/jobs/:jobId` | `employer` | List applications for one of their job listings |
| PATCH | `/applications/:applicationId/review` | `employer` | Employer review: status / employer note / score |
| GET | `/applications/:applicationId` | `admin`, `super_admin` | Application detail (audit) |

### Resumes — `/resumes`

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/resumes/create` | `seeker` | Upload a resume (title + file URL) |
| GET | `/resumes` | `seeker` | List own resumes |
| GET | `/resumes/:resumeId` | `seeker` | Resume detail (ownership guard) |
| PATCH | `/resumes/:resumeId` | `seeker` | Update title / file URL (ownership guard) |
| DELETE | `/resumes/:resumeId` | `seeker` | Soft-delete (auto-promotes fallback default if deleted resume was default) |
| PATCH | `/resumes/:resumeId/set-default` | `seeker` | Set this resume as the default used when applying |

## Authentication & Authorization

### Local JWT Flow

1. **Register / Login** — password validated with bcrypt; on success the server issues an **access token** (contains `userId`, `email`, `role`) and a **refresh token**, both set as httpOnly cookies (`secure`/`sameSite=none` only in production).
2. **Protected route** — `checkAuth(...roles)` reads the token from the `Authorization: Bearer` header **or** the `accessToken` cookie, verifies it with `jwt.verify`, looks the user up by email, validates the account status (`validateUserStatus`), and asserts the role against the allowed list. The decoded payload is attached as `req.user`.
3. **Refresh** — `POST /auth/refresh-token` validates the refresh token, re-checks the user still exists and is active, and returns a fresh access token.
4. **Password change** — re-verifies the old password before applying bcrypt hashing to the new one.

### Google OAuth Flow

`GET /auth/google?role=seeker&redirect=/` initiates Passport's Google strategy with the role and redirect packed into the OAuth `state` parameter. On callback the application: validates the state; finds or creates the user (auto-linking the Google provider for existing users); rejects inactive/banned accounts; and issues JWT cookies.

### Authorization Layers

Authorization is enforced at two layers: route-level role gates via `checkAuth(...)`, and service-level business authorization (e.g., `requireCompanyRole`, `isOwnedByCompany`, `isOwnedByUser`) that prevents horizontal privilege escalation — an employer can only act on companies and jobs they own.

## The QueryBuilder Engine

[`src/app/builder/QueryBuilder.ts`](src/app/builder/QueryBuilder.ts) is a generic, chainable class that converts any Express `req.query` into a fully-formed Mongoose query: full-text **search** (`search`), exact filter matching (**filter**), numeric/date ranges (**range**), **sort**, **paginate** (page/limit with `meta`), field selection (**fields**), **populate**, and **lean** conversion, terminating in `execute()` or `getMeta()`.

Modules configure it declaratively through a `FilterConfig` (searchable/filterable/sortable/selectable fields, number/boolean/objectId/array/range fields, default sort/limit, population):

```ts
new QueryBuilder(JobListing.find(), req.query, {
    searchableFields: ['title', 'description'],
    filterableFields: ['type', 'workMode', 'experienceLevel'],
    rangeFields: [{ field: 'salary', minKey: 'minSalary', maxKey: 'maxSalary' }],
    defaultSort: '-createdAt',
    defaultLimit: 20,
    maxLimit: 100,
})
.search().filter().range().sort().paginate().fields().lean().execute();
```

Standard query keys are `search`, `sort`, `page`, `limit`, and `fields` (defaults: page 1, limit 20, max 100, sort `-createdAt`). The `jobCategory` module ships with its own `FilterConfig`, and the full technical reference — constructor, internal state, every private helper, all public methods, chaining order, and best practices — lives in **[`QueryBuilderDocumentation.md`](./QueryBuilderDocumentation.md)**.

## Module Conventions & Code Generation

Every module under `src/app/modules/` follows the same contract:

| File | Responsibility |
| --- | --- |
| `*.constants.ts` | Enums and configuration constants (roles, statuses, permissions, defaults) |
| `*.interface.ts` | TypeScript interfaces / DTOs for the domain model |
| `*.models.ts` | Mongoose schema + model, with static helpers (`isOwnedByUser`, `findByEmail`, etc.) |
| `*.validation.ts` | Zod 4 schemas for request bodies and queries |
| `*.service.ts` | Business logic, exported as a single service object |
| `*.controller.ts` | Express handlers wrapped in `catchAsync`, delegating to the service and `sendResponse` |
| `*.route.ts` | Route definitions with middleware composition |
| `*.utils.ts` | Module-specific helpers |
| `*.authorization.ts` | (Optional) business-level permission checks, e.g. `company` |

To add a new domain, run `npm run generateModule` — the CLI prompts for a module name and scaffolds all files — then register its router in [`src/app/routes/index.ts`](src/app/routes/index.ts) by adding a `{ path, route }` entry to `moduleRoutes`.

## Error Handling & Response Format

All successful responses share a uniform envelope:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Job fetched successfully",
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 148, "totalPages": 8, "hasNextPage": true, ... }
}
```

Errors are intercepted by `globalErrorHandler`, which converts each error class into the same envelope: application `AppError` instances (custom status + message), `ZodError` (field-level validation messages), MongoDB `CastError` (invalid ObjectIDs), duplicate-key `E11000` (unique constraint violations such as an existing email or slug), and generic 500 failures. Controllers never throw visibly — `catchAsync` routes every async rejection to this handler automatically.

## Production & Deployment Notes

- Build with `npm run build` and run with `npm start` (entry: `dist/server.js`).
- In production, set `NODE_ENV=production`, a strong `EXPRESS_SESSION_SECRET`, both JWT secrets, and `FRONTEND_URL` to the deployed frontend origin — cookies become `secure` with `SameSite=None` only then.
- `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` are consumed at boot to seed the platform owner; rotate the password after first login and treat these as secrets.
- The process exits gracefully on `SIGINT`/`SIGTERM` and on unhandled rejections/exceptions, which pairs well with container orchestration (Docker/Kubernetes) health semantics.
- MongoDB unique indexes back email, company slugs, category slugs, and member uniqueness — the global error handler translates collisions into friendly 400 messages.
- Note: the auth module contains a few unimplemented placeholder handlers (`getAllAuth`, `getAuthById`, `updateAuth`, `deleteAuth`) — extend them in `auth.service.ts` as the admin panel takes shape.

## Contributing

Contributions are welcome. Please open an issue to discuss larger changes before submitting a pull request, and run `npm run lint` and `npm run format` before committing. Module additions should follow the conventions described above.

## Author & Contact

| | |
| --- | --- |
| **Author** | Humayun Kabir |
| **Email** | humayunkabir6267@gmail.com |
| **GitHub** | [github.com/Humayun1318](https://github.com/Humayun1318) |
| **Portfolio** | [humayunkabir.com](https://my-portfolio-brown-eta-20.vercel.app/) |

---

*QuickHire Backend — built with TypeScript, Express 5, Mongoose 8, Zod 4, and Passport.js. Happy coding!*
