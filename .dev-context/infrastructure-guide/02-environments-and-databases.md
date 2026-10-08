# Environments and databases

There are **five** places code or data can live. They are easy to conflate
because three of them are called "local," but each serves a different
purpose and — critically — none of them can see another's data.

| # | Environment | Database | Where it runs | Lives how long |
|---|---|---|---|---|
| 1 | Local dev | `keelapp_v2_dev` (Docker, port 5433) | Your laptop | Persistent, until you `docker compose down -v` |
| 2 | Local test | `keelapp_test` | Your laptop, same Postgres container | Persistent, wiped/reseeded by test runs |
| 3 | CI | `keelapp_test` / `keelapp_e2e` (fresh each time) | GitHub Actions runner | Only for the duration of one workflow run |
| 4 | Staging | `ladu_staging` | The VPS | Persistent, but throwaway-safe |
| 5 | Production | `ladu_prod` | The VPS | Persistent, **real user data** |

## 1–2. Local dev and local test

Both run in one Docker Postgres container your machine starts with
`npm run docker:up`. They're two separate databases inside that one
container — dev is what you poke at while building a feature, test is what
Jest tears down and rebuilds on every run (`init-test-db.sh`).

**To open a SQL shell:**

```bash
docker exec -it <container-name> psql -U keelapp_user -d keelapp_v2_dev
```

**To browse tables/rows with a GUI instead:**

```bash
npm run db:studio   # opens Drizzle Studio in the browser
```

## 3. CI

Every PR and every push to `main` spins up a **brand-new, empty** Postgres
container inside the GitHub Actions runner (`postgres:15-alpine`, defined
right in `ci.yml`). It's created, migrated, used for the test run, and
destroyed — there is no way to `psql` into it after the fact, and it has
never seen staging or production data. If a test fails because of "data,"
the data in question was created by that same test run, seconds earlier.

## 4–5. Staging and production

These live in the **same Postgres server** on the VPS (the `postgres`
container from `platform.yml`), as two separate databases with two separate
database users. `ladu_staging`'s user cannot read `ladu_prod`, and vice
versa — that isolation is enforced by Postgres permissions granted during
server setup, not by anything at the application layer.

Neither database publishes a port to the internet — `postgres` in
`platform.yml` has no `ports:` entry at all. The **only** way to reach either
database is to SSH into the VPS first and run `psql` from inside a
container on the same Docker network.

### Opening a SQL shell on staging or production

```bash
ssh -i ~/.ssh/ladu_deploy deploy@152.53.146.206

# staging:
docker compose -f /opt/ladu/platform/compose/platform.yml \
  --env-file /opt/ladu/platform/.env \
  exec postgres psql -U ladu_admin -d ladu_staging

# production:
docker compose -f /opt/ladu/platform/compose/platform.yml \
  --env-file /opt/ladu/platform/.env \
  exec postgres psql -U ladu_admin -d ladu_prod
```

`ladu_admin` is the Postgres **superuser** (set up by Ansible), so this gets
you full access to browse/query/edit anything in whichever database you
named. There is no separate read-only or GUI-based way to browse staging/prod
tables today — `psql` over SSH is it. Treat this like production access even
when you're pointed at staging, out of habit: the command differs by one
word (`ladu_staging` vs `ladu_prod`), and it's easy to run the wrong one.

**A concrete gotcha:** `docker restart` on a container does **not** reload
`.env` changes — Docker fixes a container's environment variables at
*creation* time. If you edit `/opt/ladu/staging/.env` by hand and just
restart, nothing changes. You need `docker compose ... up -d` to actually
recreate the container. This bit the Resend email cutover twice during
setup (see [`05-troubleshooting-playbook.md`](05-troubleshooting-playbook.md)).

## Migrations and the expand/contract rule

Migrations are generated locally (`drizzle-kit generate`, via
`npm run db:migrate`) and committed to the repo like any other code change.
They run as **their own deploy step**, before the container swap — see
`deploy/scripts/deploy.sh`: it runs
`docker compose run --rm backend node scripts/migrate.js` first, and only
proceeds to swap containers if that succeeds. If a migration fails, the
*previous* release keeps running untouched — nobody's served a broken app.

The rule that makes this safe, and that every migration must follow:

> **The previous release must still work after the migration runs.**

In practice this means: add a column before any code reads it; add a
NOT NULL column with a default (or as nullable, backfilled, then tightened in
a *later* migration) rather than requiring it immediately; when removing a
column, ship a release that stops using it first, and only drop the column
in a subsequent release. This matters because `deploy.sh`'s automatic
rollback (see [`03-development-workflow.md`](03-development-workflow.md))
**reverts the container images only — never the database.** If a migration
already ran and the deploy still fails its health check afterward, rolling
back to the old image means old code running against a *new* schema. The
expand/contract discipline is what keeps that combination safe rather than
catastrophic — never edit a migration file that has already run against any
shared environment; write a new one instead.

## The autocomplete lexicon (table `lexemes`)

Autocomplete reads the word forms of a language from the `lexemes` table: one row per dictionary
entry, built from Wiktionary data (CC BY-SA 4.0). It is **reference data, not user data**:

- It is rebuilt from a **versioned file** (`lexicon-<lang>-<date>.jsonl.gz`, a few MB), made on a
  developer machine by `backend/scripts/lexicon/ingest.ts` (see that folder's README).
- The **nightly backup skips its rows** (`pg_dump --exclude-table-data=public.lexemes`); the table
  definition is still backed up. So a restored database has the table, but **empty**.
- A load replaces **one language** in **one transaction**: a failed load changes nothing.
- Refreshing it is manual, about once per quarter (plan decision D14).

**Load or refresh** (from `deploy/ansible/`, after building the file):

```bash
ansible-playbook lexicon.yml -e lexicon_file=../../backend/scripts/lexicon/.data/out/lexicon-de-2026-10-03.jsonl.gz
# staging only:
ansible-playbook lexicon.yml -e lexicon_file=<file> -e '{"lexicon_environments": ["staging"]}'
```

The playbook copies the file to `/opt/ladu/lexicon/` on the VPS (every version is kept there), then
runs `node scripts/lexicon/load.js` inside `backend-staging`, then `backend-prod`. If staging
fails, prod is not touched.

**After a database restore** the lexicon is empty; autocomplete then falls back to the old
libraries or answers "not found". Reload from the copy on the VPS, no laptop needed:

```bash
# on the VPS, as deploy, for each language file and each environment:
docker cp /opt/ladu/lexicon/lexicon-de-2026-10-03.jsonl.gz backend-prod:/tmp/
docker exec backend-prod node scripts/lexicon/load.js /tmp/lexicon-de-2026-10-03.jsonl.gz
```

**Check what is loaded:**

```sql
SELECT language, part_of_speech, source_version, count(*) FROM lexemes GROUP BY 1, 2, 3;
```

Local dev and test databases load the same way (`node scripts/lexicon/load.js <file>` from
`backend/`). The committed fixture `backend/scripts/lexicon/fixtures/lexicon-de-fixture.jsonl`
(44 German words) is enough for tests and e2e.

## Email sender addresses per environment

Not a database, but environment-scoped the same way: staging sends real
transactional email as `staging@ladu.com.ar`, production as
`noreply@ladu.com.ar` — both via Resend, both real deliverable addresses.
Registering the same email address on staging and production is safe and
won't collide, since (as above) they're entirely separate databases.
