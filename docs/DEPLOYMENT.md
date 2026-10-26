# Deployment Guide

Target: **Vercel Hobby (free) plan** for the API and a **MongoDB Atlas free cluster** for the database. Nothing in this setup requires a paid service.

> **Status:** the project has been prepared and smoke-tested locally as a production build (`NODE_ENV=production node dist/server.js` against MongoDB). It has **not** been deployed to Vercel yet, so steps 3–5 below have not been verified against a live deployment.

---

## 1. Local setup

```bash
git clone https://github.com/Humayun1318/QuickHire.git
cd QuickHire
npm install
cp .env.example .env
```

Edit `.env`:

- `DB_URL`: an Atlas connection string (see step 2), or a local **replica set**. A standalone `mongod` fails on the transactional endpoints. To run a one-node replica set locally: `mongod --replSet rs0` and then `mongosh --eval "rs.initiate()"`.
- Generate the two JWT secrets:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

Run it:

```bash
npm run dev        # development with reload, http://localhost:5000
# or
npm run build && npm start
```

Verify before deploying:

```bash
npm run check      # typecheck + lint + tests + build
```

## 2. Database (MongoDB Atlas, free)

1. Create an account at <https://www.mongodb.com/cloud/atlas> and create a **Free** cluster. The free tier offers 512 MB of storage, which is plenty for a demo.
2. **Database Access** → add a database user with a strong password and the _Read and write to any database_ role (or scope it to the `quickhire` database).
3. **Network Access** → add `0.0.0.0/0`. Vercel functions do not have fixed outbound IPs on the free plan, so an IP allow-list is not possible. The database is protected by the user credentials.
4. **Connect → Drivers** → copy the `mongodb+srv://…` string, insert the password and a database name:

   ```
   mongodb+srv://quickhire_app:<password>@cluster0.xxxxx.mongodb.net/quickhire?retryWrites=true&w=majority
   ```

Atlas clusters are replica sets, so transactions work. Indexes are created automatically by Mongoose on the first connection.

## 3. Vercel project

Vercel deploys Express apps with **zero configuration**. It looks for an entry file such as `src/app.ts` that imports `express` and default-exports the app (this project does), and runs the whole app as one Vercel Function. `express.static` is not used, so that limitation does not apply.

1. Push the repository to GitHub.
2. Go to <https://vercel.com/new> and import the repository.
3. **Framework preset:** Express (auto-detected). If detection picks something else, choose _Express_.
4. **Root directory:** repository root. Leave the build and output settings at their defaults.
5. Add the environment variables (step 4) **before** the first deploy, then click **Deploy**.

> Using the CLI instead: `npm i -g vercel`, then `vercel` (preview) and `vercel --prod`. Vercel CLI 47.0.5+ is needed for zero-config Express.

## 4. Production environment variables

Set these in _Project → Settings → Environment Variables_ for the **Production** environment. Add them to _Preview_ too if you use preview deployments.

| Variable                                                            | Value                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                                          | `production`                                                                                                       |
| `DB_URL`                                                            | Atlas connection string                                                                                            |
| `FRONTEND_URL`                                                      | Your frontend origin, e.g. `https://quickhire-web.vercel.app` (no trailing slash)                                  |
| `CORS_ORIGINS`                                                      | Optional extra origins, comma-separated (e.g. `http://localhost:3000` for local frontend dev against the live API) |
| `BCRYPT_SALT_ROUND`                                                 | `10` (higher values slow every login on 1 vCPU)                                                                    |
| `JWT_ACCESS_SECRET`                                                 | random 48+ byte hex                                                                                                |
| `JWT_REFRESH_SECRET`                                                | a different random value                                                                                           |
| `JWT_ACCESS_EXPIRES`                                                | `15m`                                                                                                              |
| `JWT_REFRESH_EXPIRES`                                               | `7d`                                                                                                               |
| `SUPER_ADMIN_EMAIL`                                                 | your admin email                                                                                                   |
| `SUPER_ADMIN_PASSWORD`                                              | strong password; change it after first login                                                                       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Optional. Callback: `https://<api-domain>/api/v1/auth/google/callback`                                             |

Do **not** set `PORT` (Vercel ignores it). `TRUST_PROXY` is set automatically on Vercel. There is no `.env` file in production; `dotenv` simply finds nothing to load.

If a required variable is missing, the function fails at startup with `Missing required environment variable(s): …` in the runtime logs.

## 5. Post-deployment smoke test

Replace `API` with your deployment URL.

```bash
API=https://<project>.vercel.app

curl -s $API/                                   # {"success":true,"message":"QuickHire API is running"}
curl -s "$API/api/v1/jobs?limit=1"              # 200 with data + meta (connects to MongoDB)
curl -s $API/api/v1/job-categories/tree         # 200

# Super admin login (also proves seeding worked)
curl -s -X POST $API/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<SUPER_ADMIN_EMAIL>","password":"<SUPER_ADMIN_PASSWORD>"}'

# CORS: should be 403
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://not-allowed.example' "$API/api/v1/jobs"
```

From the browser frontend, check that login sets cookies (`Secure; SameSite=None`) and that `GET /api/v1/users/me` with `credentials: 'include'` returns the user.

## 6. Google OAuth (optional)

1. In Google Cloud Console → _APIs & Services → Credentials_, create an **OAuth client ID** (type: Web application).
2. Authorised redirect URI: `https://<api-domain>/api/v1/auth/google/callback`. Add `http://localhost:5000/api/v1/auth/google/callback` for local development.
3. Set the three `GOOGLE_*` variables and redeploy.
4. The frontend starts the flow by navigating (not fetching) to `GET /api/v1/auth/google?role=seeker&redirect=/dashboard`. After success the user lands on `FRONTEND_URL/dashboard` with auth cookies set. The frontend then calls `GET /users/me`.

## Free-tier constraints

| Constraint                                                             | Effect on this app                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Vercel Hobby is for **personal, non-commercial** use                   | Fits a portfolio project                                                                                              |
| Function max duration 300 s, 2 GB memory, 1 vCPU                       | Far above what any endpoint needs                                                                                     |
| Request/response body ≤ 4.5 MB                                         | The API caps JSON bodies at 100 kb; responses are paginated                                                           |
| Cold starts                                                            | The first request on a new instance also opens the MongoDB connection, so it is noticeably slower than later requests |
| No persistent filesystem / no background processes                     | The app writes no files and runs no timers; job expiry is evaluated at query time                                     |
| Per-instance memory                                                    | Rate-limit counters are per instance (see [SECURITY.md](SECURITY.md))                                                 |
| Atlas free cluster: 512 MB storage, limited throughput and connections | `maxPoolSize: 10` per instance keeps connection use modest                                                            |

Limits change over time. Check <https://vercel.com/docs/limits> and the Atlas pricing page.

## Troubleshooting

| Symptom                                                          | Likely cause / fix                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `503 Service temporarily unavailable` on every `/api/v1` route   | MongoDB is unreachable. Check `DB_URL`, the Atlas user and password, and that Network Access includes `0.0.0.0/0`. The runtime logs show `Database connection failed: …`                                                                                                                    |
| Function crashes with `Missing required environment variable(s)` | Add the variable in Vercel and **redeploy** (env changes need a new deployment)                                                                                                                                                                                                             |
| `Transaction numbers are only allowed on a replica set member`   | The database is a standalone `mongod`. Use Atlas or a local replica set                                                                                                                                                                                                                     |
| Browser shows a CORS error / 403 `Origin not allowed by CORS`    | The frontend origin is not exactly `FRONTEND_URL` or listed in `CORS_ORIGINS` (scheme, host and port must match, with no trailing slash)                                                                                                                                                    |
| Login works but the cookie is not sent back                      | The frontend must use `credentials: 'include'` (fetch) or `withCredentials: true` (axios). In production the API must be served over HTTPS (Vercel is). Browsers that block third-party cookies may still drop them; use the `Authorization: Bearer` header from the login response instead |
| 429 responses during testing                                     | Auth endpoints allow 20 requests per 15 minutes per IP per instance. Wait, or test locally                                                                                                                                                                                                  |
| Google login redirects to `/login?error=Login session expired…`  | The `oauth_state` cookie was missing. Start the flow and finish it in the same browser within 10 minutes, and make sure `GOOGLE_CALLBACK_URL` uses the same host as the API                                                                                                                 |
| `redirect_uri_mismatch` from Google                              | The Google Console redirect URI must equal `GOOGLE_CALLBACK_URL` exactly                                                                                                                                                                                                                    |
| Vercel picks the wrong entry                                     | Make sure the framework preset is _Express_. The intended entry is `src/app.ts` (default export)                                                                                                                                                                                            |
