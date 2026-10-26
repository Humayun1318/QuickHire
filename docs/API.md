# API Reference

Base URL: `http://localhost:5000/api/v1` locally, or `https://<your-project>.vercel.app/api/v1` once deployed.

- All request bodies are JSON (`Content-Type: application/json`, max 100 kb).
- Unknown body fields are **silently stripped** by the Zod schemas. They are never stored.
- Path parameters ending in `Id` are MongoDB ObjectIds. A malformed id returns `400`.
- Dates are ISO 8601 strings, for example `2026-01-31T00:00:00.000Z`.

## Conventions

### Authentication

Protected routes accept the access token in any of these forms:

| Method                               | Example                                        |
| ------------------------------------ | ---------------------------------------------- |
| Header (recommended for API clients) | `Authorization: Bearer <accessToken>`          |
| Header, bare token (legacy)          | `Authorization: <accessToken>`                 |
| Cookie (browsers)                    | `accessToken=<token>` (httpOnly, set by login) |

Browser clients on another origin must send `credentials: 'include'` and be listed in `FRONTEND_URL` / `CORS_ORIGINS`.

### Roles

`super_admin`, `admin`, `seeker`, `employer`. "Admin" below means `admin` or `super_admin`. Company-level roles (`OWNER`, `ADMIN`, `HR`, `RECRUITER`, `INTERVIEWER`) are checked inside services. "Job manager" means `OWNER`, `ADMIN`, `HR` or `RECRUITER` of the company that owns the job.

### Response shape

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Jobs retrieved successfully",
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 }
}
```

`meta` is only present on paginated endpoints.

### Errors

```json
{
  "success": false,
  "message": "Validation Error",
  "errorSources": [{ "path": "address.city", "message": "Invalid input" }]
}
```

| Status | When                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| 400    | Validation failure, malformed JSON, malformed ObjectId, invalid state transition                                  |
| 401    | Missing / invalid / expired token, wrong credentials, token revoked by a password change                          |
| 403    | Authenticated but not allowed (role, ownership, company membership, inactive account, origin not allowed by CORS) |
| 404    | Resource or route not found (also used for resources you are not allowed to see)                                  |
| 409    | Duplicate (email, company, application, category name, …) or a concurrent status change                           |
| 413    | Body larger than 100 kb                                                                                           |
| 429    | Rate limit exceeded                                                                                               |
| 503    | Database unreachable, or Google sign-in not configured                                                            |
| 500    | Unexpected error. The message is generic in production                                                            |

In `development` mode error responses also include `err` and `stack`.

### Pagination

| Endpoint family                                              | Query params                                  | Limits              |
| ------------------------------------------------------------ | --------------------------------------------- | ------------------- |
| `GET /jobs`, `GET /jobs/company/:id`                         | `page`, `limit`                               | default 20, max 50  |
| `GET /seeker-profiles` (list)                                | `page`, `limit`                               | default 20, max 100 |
| QueryBuilder endpoints (`GET /users`, `GET /job-categories`) | `page`, `limit`, `sort`, `search`, `fields`\* | default 20, max 100 |

\* `fields` is supported by `GET /job-categories` only. See [QUERY_BUILDER.md](QUERY_BUILDER.md).

---

## Health

| Method | Path                      | Access | Notes                                                                           |
| ------ | ------------------------- | ------ | ------------------------------------------------------------------------------- |
| GET    | `/` (no `/api/v1` prefix) | Public | `{ success: true, message: "QuickHire API is running" }`. Does not touch the DB |

## Auth — `/auth`

Rate limited: 20 requests per 15 minutes per IP (except logout and the OAuth callback).

| Method | Path                    | Access   | Body / query                                                                                                              | Notes                                                                                                                                         |
| ------ | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/register`        | Public   | `name` (2–50), `email`, `password`, `phone?`, `avatar?` (http(s) URL), `role?` (`seeker` \| `employer`, default `seeker`) | 201 with the user (no password). 409 if the email exists. Any other `role` is 400                                                             |
| POST   | `/auth/login`           | Public   | `email`, `password`                                                                                                       | 200 `{ accessToken, refreshToken, user }`, and sets both httpOnly cookies. 401 with the same message for an unknown email or a wrong password |
| POST   | `/auth/refresh-token`   | Public   | `refreshToken` cookie, or body `{ refreshToken }`                                                                         | 200 `{ accessToken }`, and sets the cookie. 401 if missing, invalid, or revoked                                                               |
| POST   | `/auth/logout`          | Public   | —                                                                                                                         | Clears both cookies                                                                                                                           |
| POST   | `/auth/change-password` | Any role | `oldPassword`, `newPassword`                                                                                              | Invalidates all existing tokens and returns new `{ accessToken, refreshToken }`                                                               |
| GET    | `/auth/google`          | Public   | `role?` (`seeker` \| `employer`), `redirect?` (relative path such as `/dashboard`)                                        | Redirects to Google. 503 if Google is not configured                                                                                          |
| GET    | `/auth/google/callback` | Google   | —                                                                                                                         | Sets the cookies and redirects to `FRONTEND_URL + redirect`. On failure it redirects to `FRONTEND_URL/login?error=…`                          |

**Password policy:** 8+ characters and at most 72 bytes, with an uppercase letter, a lowercase letter, a digit, and one of `@$!%*?&`.

## Users — `/users`

| Method | Path         | Access   | Notes                                                                                                                                                                              |
| ------ | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/users/me`  | Any role | Current user. Works with cookie-only sessions, for example after Google login                                                                                                      |
| GET    | `/users`     | Admin    | Query: `search` (name/email), `role`, `status`, `isVerified`, `sort` (`name`, `email`, `createdAt`, `lastLogin`, prefix `-` for descending), `page`, `limit`. Unknown params → 400 |
| GET    | `/users/:id` | Admin    |                                                                                                                                                                                    |

## Job categories — `/job-categories`

| Method | Path                                   | Access | Notes                                                                                                                                                                              |
| ------ | -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/job-categories/tree`                 | Public | Nested tree of active categories                                                                                                                                                   |
| GET    | `/job-categories/roots`                | Public | Top-level categories, most jobs first                                                                                                                                              |
| GET    | `/job-categories/slug/:slug`           | Public | `{ category, breadcrumb }`                                                                                                                                                         |
| GET    | `/job-categories/:categoryId/children` | Public |                                                                                                                                                                                    |
| GET    | `/job-categories`                      | Admin  | QueryBuilder: `search`, `isActive`, `parentId`, `depth`, `minDepth`/`maxDepth`, `minJobCount`/`maxJobCount`, `sort`, `fields`, `page`, `limit`. Response `data: { results, meta }` |
| POST   | `/job-categories`                      | Admin  | `name` (2–80, unique, case-insensitive), `icon?`, `parentId?`. Max depth is 2 (three levels)                                                                                       |
| PATCH  | `/job-categories/:categoryId`          | Admin  | `name?`, `icon?`, `parentId?` (`null` = root). A category that has sub-categories cannot be moved                                                                                  |
| DELETE | `/job-categories/:categoryId`          | Admin  | Soft delete. 400 if it has active children or published jobs                                                                                                                       |

## Companies — `/companies`

| Method | Path                                 | Access                             | Notes                                                                                                                                                            |
| ------ | ------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/companies`                         | Employer                           | `name` (2–100), `description?`, `industry?`, `size?`, `website?`, `address?`, `socialLinks?`. One active company per employer (409). The creator becomes `OWNER` |
| GET    | `/companies/me`                      | Employer                           | The company you own                                                                                                                                              |
| GET    | `/companies?companyId=` or `?slug=`  | Public                             | Only **verified** companies (otherwise 403)                                                                                                                      |
| PATCH  | `/companies/:companyId`              | Employer (company `OWNER`/`ADMIN`) | Same fields as create plus `logo`, `banner`. Company `ADMIN` cannot rename                                                                                       |
| DELETE | `/companies/:companyId`              | Employer (owner)                   | Soft delete. Also deactivates all the company's jobs                                                                                                             |
| PATCH  | `/companies/:companyId/verification` | Admin                              | `verificationStatus` (`unverified`\|`pending`\|`verified`\|`rejected`), `verificationNote?` (≤500)                                                               |

Enums: `industry` uses the values in `company.constants.ts` (`Technology`, `Finance`, …). `size` is one of `1-10`, `11-50`, `51-200`, `201-500`, `500+`. `address` is `{ city, country, state?, postalCode?, location?: { type: "Point", coordinates: [lng, lat] } }`. `socialLinks` is `{ linkedin?, github?, portfolio?, twitter? }`. All URLs must be `http(s)`.

## Company members — `/companies/members`

| Method | Path                                        | Access                             | Body / query                                                      | Notes                                                                  |
| ------ | ------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| POST   | `/companies/members`                        | Employer (company `OWNER`/`ADMIN`) | `companyId`, `userId` (an employer account), `role` (not `OWNER`) | Company `ADMIN` cannot assign `ADMIN`                                  |
| GET    | `/companies/members?companyId=` or `?slug=` | Company members, admins            |                                                                   | Includes member contact details                                        |
| PATCH  | `/companies/members/:memberId`              | Employer (`OWNER`/`ADMIN`)         | `companyId`, `role`                                               | The owner's role cannot change, and you cannot change your own role    |
| DELETE | `/companies/members/:companyId/:memberId`   | Employer (`OWNER`/`ADMIN`)         |                                                                   | Owner cannot be removed. Company `ADMIN` cannot remove another `ADMIN` |
| DELETE | `/companies/members/leave/:companyId`       | Employer (member)                  |                                                                   | The owner cannot leave                                                 |

## Jobs — `/jobs`

### Public search — `GET /jobs`

Only **published, active, non-expired** jobs are returned. Any `status` parameter is ignored.

| Param                     | Type                                                                                            | Notes                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `searchTerm`              | string ≤100                                                                                     | Full-text search (title × 10, skills × 5, description × 1)               |
| `categoryId`, `companyId` | ObjectId                                                                                        |                                                                          |
| `type`                    | `full-time` \| `part-time` \| `freelance` \| `internship` \| `contract`                         |                                                                          |
| `workMode`                | `remote` \| `onsite` \| `hybrid`                                                                |                                                                          |
| `experienceLevel`         | `entry` \| `junior` \| `mid` \| `senior` \| `lead`                                              |                                                                          |
| `city`, `country`         | string ≤100                                                                                     | Case-insensitive partial match. Input is escaped                         |
| `salaryMin`, `salaryMax`  | integer                                                                                         | Matches jobs where `salary.min ≥ salaryMin` and `salary.max ≤ salaryMax` |
| `isFeatured`              | `true` \| `false`                                                                               |                                                                          |
| `sortBy`                  | `newest` (default: featured first, then newest) \| `salary` \| `relevance` (needs `searchTerm`) |                                                                          |
| `page`, `limit`           | integer                                                                                         | Max 50 per page                                                          |

### Other job endpoints

| Method | Path                       | Access                                      | Notes                                                                                                                |
| ------ | -------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| GET    | `/jobs/:jobId`             | Public                                      | Published jobs only (draft/closed → 404). Increments `viewCount`                                                     |
| GET    | `/jobs/slug/:slug`         | Public                                      | Same as above, by slug                                                                                               |
| GET    | `/jobs/company/:companyId` | Company members, admins                     | All of the company's active jobs, any status. Query: `status?`, `page`, `limit`                                      |
| POST   | `/jobs`                    | Employer (job manager of `companyId`)       | See body below. 201                                                                                                  |
| PATCH  | `/jobs/:jobId`             | Employer (job manager of the job's company) | Any create field except `status`. A `companyId` in the body is ignored                                               |
| PATCH  | `/jobs/:jobId/status`      | Employer (job manager)                      | `{ status }` (`draft`\|`published`\|`closed`\|`expired`). Publishing a job past `expiresAt` → 400. Same status → 400 |
| DELETE | `/jobs/:jobId`             | Employer (job manager)                      | Soft delete                                                                                                          |
| PATCH  | `/jobs/:jobId/featured`    | Admin                                       | `{ isFeatured: boolean }`                                                                                            |

**Create body:**

```json
{
  "companyId": "665f…",
  "title": "Senior Node Developer",
  "description": "At least 50 characters …",
  "type": "full-time",
  "workMode": "remote",
  "experienceLevel": "senior",
  "categoryId": "665f…",
  "skills": ["Node.js", "MongoDB"],
  "requirements": ["5+ years backend"],
  "responsibilities": ["Design APIs"],
  "salary": {
    "min": 80000,
    "max": 120000,
    "currency": "BDT",
    "isNegotiable": true,
    "isVisible": true
  },
  "location": { "city": "Dhaka", "country": "Bangladesh" },
  "status": "draft",
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```

Required fields are `companyId`, `title` (5–150), `description` (50–10000), `type` and `workMode`. `status` must be `draft` (default) or `published`. `expiresAt` must be in the future and defaults to 30 days. Skills are stored lowercase. The legacy shape `{ "body": { …same fields… } }` is still accepted.

## Seeker profile — `/seeker-profiles`

| Method | Path                            | Access          | Notes                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/seeker-profiles/create`       | Seeker          | `headline?` (≤120), `bio?` (≤1000), `address?`, `skills?`, `languages?`, `expectedSalary?` `{ amount, currency, isNegotiable }`, `jobPreference?` (`remote`\|`hybrid`\|`onsite`), `availabilityStatus?` (`open`\|`passive`\|`not_looking`), `socialLinks?`. 409 if an active profile exists. Re-creating after a delete restores the profile |
| GET    | `/seeker-profiles/me`           | Seeker          |                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/seeker-profiles?profileId=`   | Employer, admin | Single profile                                                                                                                                                                                                                                                                                                                               |
| GET    | `/seeker-profiles?page=&limit=` | Employer, admin | Paginated list, most complete profiles first. `active=false` (deleted profiles) only works for admins                                                                                                                                                                                                                                        |
| PATCH  | `/seeker-profiles/update`       | Seeker          | Partial update. Fields you omit are left unchanged                                                                                                                                                                                                                                                                                           |
| DELETE | `/seeker-profiles/me`           | Seeker          | Soft delete                                                                                                                                                                                                                                                                                                                                  |

`profileCompleteness` (0–100) is computed from the profile fields, plus 15 points for having at least one education entry and 15 for at least one experience entry.

## Education — `/seeker-educations` · Experience — `/seeker-experiences`

Requires an existing seeker profile.

| Method | Path                   | Access         | Notes                         |
| ------ | ---------------------- | -------------- | ----------------------------- |
| POST   | `/{module}/create`     | Seeker         | See fields below              |
| GET    | `/{module}/list`       | Seeker         | Your entries, newest first    |
| PATCH  | `/{module}/update/:id` | Seeker (owner) | 403 if the entry is not yours |
| DELETE | `/{module}/delete/:id` | Seeker (owner) |                               |

- **Education fields:** `institution`, `degree` (`SSC`, `HSC`, `Diploma`, `Bachelor`, `Master`, `PhD`, `Other`), `fieldOfStudy?`, `startDate`, `endDate?` (required unless `isCurrentlyStudying`), `grade?`, `description?` (≤500).
- **Experience fields:** `jobTitle`, `company`, `employmentType` (same values as job `type`), `workMode?`, `location?`, `startDate`, `endDate?` (required unless `isCurrentJob`), `responsibilities?`, `technologiesUsed?` (stored lowercase).

## Resumes — `/resumes`

| Method | Path                             | Access         | Notes                                                                                                  |
| ------ | -------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| POST   | `/resumes/create`                | Seeker         | `title` (≤80), `fileUrl` (http(s)). Max 5 active resumes. The first one becomes the default            |
| GET    | `/resumes`                       | Seeker         | Default first                                                                                          |
| GET    | `/resumes/:resumeId`             | Seeker (owner) | 404 if not yours                                                                                       |
| PATCH  | `/resumes/:resumeId`             | Seeker (owner) | `title?`, `fileUrl?`                                                                                   |
| DELETE | `/resumes/:resumeId`             | Seeker (owner) | Soft delete. The last resume cannot be deleted. Deleting the default promotes the newest remaining one |
| PATCH  | `/resumes/:resumeId/set-default` | Seeker (owner) |                                                                                                        |

## Applications — `/applications`

| Method | Path                                    | Access                 | Notes                                                                                                                                                        |
| ------ | --------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/applications`                         | Seeker                 | `jobId`, `resumeId` (must be yours), `coverLetter` (10–2000). The job must be published and not expired. Duplicates → 409                                    |
| GET    | `/applications/my-applications`         | Seeker                 |                                                                                                                                                              |
| PATCH  | `/applications/:applicationId/withdraw` | Seeker (applicant)     | Body `{ "status": "withdrawn" }`. Not allowed once the application is `accepted`, `rejected` or `withdrawn`                                                  |
| GET    | `/applications/jobs/:jobId`             | Employer (job manager) | Applicants with name, email and resume                                                                                                                       |
| PATCH  | `/applications/:applicationId/review`   | Employer (job manager) | `status?` (`shortlisted`\|`interviewed`\|`accepted`\|`rejected`), `employerNote?` (≤1000), `score?` (0–100 integer). Terminal applications cannot be changed |
| GET    | `/applications/:applicationId`          | Admin                  |                                                                                                                                                              |

Status flow: `pending → shortlisted → interviewed → accepted | rejected`, and the applicant may set `withdrawn` at any non-terminal point. The job's `applicationCount` is kept in sync.
