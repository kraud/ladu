# Production Deployment: MongoDB → PostgreSQL

Reference document capturing the deployment discussion for future decision-making.

---

## Current State

- **Monorepo**: root `package.json` runs both FE (React/CRA) and BE (Express + Drizzle) via `concurrently`.
- **Local DB**: Docker Compose spins up PostgreSQL 15 Alpine container (`keelapp_dev`, `keelapp_test`).
- **DB connection**: `backend/src/db/index.ts` creates a `pg.Pool` from `DATABASE_URL` env var, passes it to Drizzle.
- **Previous setup**: FE and BE were separate Vercel projects; BE connected to MongoDB Atlas free-tier cluster.
- **Root scripts already support single-project deploy**: `npm run build` → builds frontend, `npm start` → runs backend.

---

## Where Does Postgres Live in Production?

Same place MongoDB Atlas did: a managed cloud service. Vercel is serverless — you don't run your own Postgres there.

### Options evaluated

| Provider | Free tier | Notes |
|---|---|---|
| **Neon** | 0.5 GB storage, auto-suspend on idle | Closest analog to MongoDB Atlas free tier; first-class Drizzle support |
| **Supabase** | 500 MB, always-on | Includes Postgres + extras we don't need |
| **Vercel Postgres** | 60 GB-hrs/mo | Tied to Vercel billing |
| **Railway** | $1/mo credit (free tier) | Can host Postgres directly, but sleep behavior adds cold-start latency on DB |

---

## Single Project vs. Two Projects on Vercel

**Single project is the better option.** Reasons:

1. **Repo is already structured for it.** Root `package.json` has the build/start scripts Vercel needs.
2. **Eliminates CORS.** Backend currently has `origin: '*'` — not production-ready. Same-origin removes this entirely.
3. **Simpler env management.** One `DATABASE_URL`, one `JWT_SECRET`, one place to configure.
4. **Vercel Serverless Functions handle Express natively.** Express app goes in `api/`, frontend is static output.

### Vercel config (for reference)

```jsonc
// vercel.json (root)
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "frontend/build",
  "installCommand": "npm install",
  "functions": {
    "backend/api/index.js": {
      "includeFiles": "backend/**"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/backend/api/index.js" }
  ]
}
```

### What changes vs. two-project setup

- Delete `frontend/.env` (proxy setting is only for local dev).
- Move `DATABASE_URL`, `JWT_SECRET`, etc. to Vercel project env vars.
- Remove or scope `cors` (currently `origin: '*'`).
- Make `app.listen()` conditional so it doesn't bind a port in serverless:

```js
// Only listen when running directly (local dev), not on Vercel
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`Server on ${port}`));
}
module.exports = app;
```

### Database for Vercel setup

**Neon** is the recommended managed Postgres for this path — zero code changes, same connection string pattern (`postgresql://user:pass@host/dbname`).

---

## Railway as the Deployment Target

Since Railway is more relevant for work experience, it was evaluated as the primary deployment platform.

### Railway Free Tier

| | Limit |
|---|---|
| Subscription | $0/mo |
| Monthly credit | $1 (resets, doesn't roll over) |
| RAM per service | 0.5 GB |
| Volume storage | 0.5 GB |
| Services per project | 5 |
| Sleep | Services suspend after inactivity; first request has 10-30s cold start |

### Resource cost estimate for this project

- Express API (~0.128 GB RAM): ~$0.06/mo
- PostgreSQL (~0.256 GB RAM + small volume): ~$0.12/mo
- Network egress: negligible at handful-of-users scale
- **Total: ~$0.18-0.24/mo** — well within $1/mo free credit

### Recommended combo: Railway (backend) + Neon (Postgres)

- **Backend on Railway Free Tier**: learn the platform, deployment pipeline, env vars, GitHub integration.
- **Database on Neon Free Tier**: 0.5 GB storage, always-on (no sleep), auto-suspend only on idle.
- **Why split**: Neon's Postgres is always-on, so the app wakes up clean. Railway's sleep on the DB service would add cold-start latency on the DB connection too.

This gives Railway deployment experience without fighting sleep/suspension on the database. The `DATABASE_URL` env var just points to Neon's connection string — same pattern as local Docker.

### Railway config (for reference)

```
Railway project:
  └── backend (Express app)
        DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/keelapp
        JWT_SECRET=...
        NODE_ENV=production
```

Frontend stays on Vercel (or can move to Railway too — both free tiers work).

### Growth threshold

The $1/mo free credit gets tight around ~50 regular concurrent users or with background jobs. At that point, upgrade to Hobby ($5/mo, includes $5 credit). For a portfolio project with a handful of users, free tier covers it indefinitely.

---

## Key Files Involved

- `backend/src/db/index.ts` — Drizzle/pool connection (reads `DATABASE_URL`)
- `backend/drizzle.config.ts` — migration config (reads `DATABASE_URL`)
- `backend/api/index.js` — Express entry point (serverless adapter needed)
- `backend/app.js` — Express app setup (CORS config, route mounting)
- `docker-compose.yml` — local Postgres (stays for dev, not needed in prod)
- `package.json` (root) — build/start scripts already support single-project deploy
- `.env` — contains `DATABASE_URL`, `JWT_SECRET`, etc. (env vars move to hosting platform)

---

## Decisions Pending

- **Hosting platform**: Vercel (single project) vs. Railway (backend) + Vercel (frontend)
- **Database provider**: Neon vs. Railway-managed Postgres vs. other
- **When to do it**: after the migration plan phases are complete (Phase 6 cleanup is the natural spot)
