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

### The seed account and the pagination test tag (local dev only)

A test account owns 200 popular words in one Public tag. It exists to test the word
tables with several pages (`.context/plans/words-pagination.md`): follow the tag from your
own account and `/tag/<id>` shows all 200 words, while `/words` shows them too (they come
from a followed tag, so they are read-only there).

| What | Value |
|---|---|
| Database | `keelapp_v2_dev` only (the account does **not** exist in staging or production) |
| Email | `pagination-seed@ladu.test` |
| Username | `pagination_seed` |
| Password | `LocalDev-Seed-2026` (a throwaway; it protects nothing outside this laptop) |
| Languages | English, Spanish, German, Estonian |
| Tag | "Pagination test (200 words)", Public, id `ae72cf6a-bc73-416c-a106-50fb635cba72` (the id changes if the dev database is rebuilt) |

To follow it from your own account: **Tags** → filter "Discover" → search "Pagination test" →
Follow.

The 200 words: 80 nouns, 55 verbs, 45 adjectives, 20 adverbs. Each keeps 2, 3 or 4 of the four
languages (about 50 / 110 / 40 words), so most rows have empty cells. They were made with the
same routes as the Add word page (English words by `frequency_rank` → `translate` → `draft`).
The frequency list ranks a spelling, not a part of speech, so a few words are odd ("can" →
"lata", "must" → "mosto"). That is normal for this data.

To rebuild or top up the data (the dev server must run on :5001; the script refuses to run
against anything that is not on this machine):

```bash
cd backend
npx tsx scripts/seed-pagination-words.ts           # tops the tag up to 200 words; registers the account if it is missing
npx tsx scripts/seed-pagination-words.ts --reset   # first deletes ALL words of the seed account, then seeds again
```

The script uses a fixed random seed, so a `--reset` run makes the same set again.

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

## The autocomplete lexicon (tables `lexemes` and `lexeme_translations`)

Autocomplete reads the word forms of a language from the `lexemes` table: one row per dictionary
entry, built from Wiktionary data (CC BY-SA 4.0). The `lexeme_translations` table holds the
translations between the languages (from the English Wiktionary entries, about 300k rows), built
by `ingest-translations.ts` into one file, `translations-en-<date>.jsonl.gz`, and loaded by the
same playbook and script. Both tables are **reference data, not user data**:

- It is rebuilt from a **versioned file** (`lexicon-<lang>-<date>.jsonl.gz`, a few MB), made on a
  developer machine by `backend/scripts/lexicon/ingest.ts` (see that folder's README).
- The **nightly backup skips their rows** (`pg_dump --exclude-table-data=public.lexemes
  --exclude-table-data=public.lexeme_translations`); the table definitions are still backed up.
  So a restored database has the tables, but **empty**.
- A load replaces **one language** (a translation file: **all** translations) in **one
  transaction**: a failed load changes nothing.
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
# docker cp makes the file root-owned; the backend runs as the user `ladu`, so hand it over first:
docker exec --user root backend-prod chown ladu:ladu /tmp/lexicon-de-2026-10-03.jsonl.gz
docker exec backend-prod node scripts/lexicon/load.js /tmp/lexicon-de-2026-10-03.jsonl.gz
docker exec --user root backend-prod rm -f /tmp/lexicon-de-2026-10-03.jsonl.gz
```

**Space:** all three Wiktionary languages (English, German, Spanish) take about 220 MB per
database; the translations about 90 MB more. A reload deletes and re-inserts a language, so for a while the old rows still take
space; Postgres's autovacuum frees it for reuse on its own, nothing to do.

**Check what is loaded:**

```sql
SELECT language, part_of_speech, source_version, count(*) FROM lexemes GROUP BY 1, 2, 3;
SELECT language, source_version, count(*) FROM lexeme_translations GROUP BY 1, 2;
```

Local dev and test databases load the same way (`node scripts/lexicon/load.js <file>` from
`backend/`). The committed fixtures in `backend/scripts/lexicon/fixtures/` (a few dozen words per
language, and `translations-en-fixture.jsonl` with the translations of 11 English words) are
enough for tests and e2e (`npm run lexicon:load:fixture -w backend`).

## Demo accounts (`users.is_demo`)

The "Try the demo" button makes a throwaway account (`.context/plans/demo-access.md`). It is off
by default in every environment. The owner turns it on, and sets its duration and its caps, in the
admin panel: **Access → Demo** (`/access?tab=demo`). Nothing to deploy.

- **What a demo row looks like:** `is_demo = true`, name `Demo`, username `demo-<uuid>`, email
  `demo+<uuid>@ladu.invalid` (no mail can reach it), no password. `demo_expires_at` is the end of
  the demo; after it, the backend refuses the token.
- **The per-IP limit** is an environment variable, `DEMO_STARTS_PER_IP` (default 5 starts per hour
  and per IP). Not a secret, and not needed in a normal deploy. IPs stay in the backend's memory
  only, and a restart clears them. The e2e config sets it to 1000, because all its demos come
  from one IP.
- **How many demos run now** (also shown in the admin Demo tab):

  ```sql
  SELECT count(*) FROM users WHERE is_demo AND demo_expires_at > now();
  ```
- **The demo template (needed once per environment).** Every demo is a copy of one template
  account (username `__demo_template__`, no expiry, never purged), built from
  `backend/scripts/demo-template/data.json`. Without it, the demo start answers 503
  `demo_unavailable` and the backend logs the command to run. Seed it once in each environment:

  ```bash
  # local dev (the e2e start-up does this by itself):
  npm run demo:template -w backend
  # staging / production, on the VPS:
  docker exec backend-staging node scripts/seed-demo-template.js
  docker exec backend-prod node scripts/seed-demo-template.js
  ```

  **When:** after the merge, once `deploy.yml` has deployed the environment — the script and the
  demo columns (migrations 0027 + 0028) only exist on the server from that deploy on. Then seed
  staging, then production, and only after that turn the demo on (admin panel, staging first).
  Nothing breaks in between: the demo is off by default. The tests never need this step: Jest
  seeds its own template, and the e2e start-up (locally and in the CI `e2e` job) runs
  `npm run demo:template`.

  Running it again keeps the existing template. After a change to `data.json`, rebuild it with
  `--reset` (`npm run demo:template -w backend -- --reset`, or add `--reset` to the `docker exec`
  line). Demos that are running keep their own copy.
- **Cleanup:** the nightly purge (`scripts/purge.js`) deletes demos whose time is over, with all
  their data. It writes no audit row; its log line counts them (`… N expired demo(s) …`). Until
  the next run, an expired demo stays in the database, but it does not count toward the live cap
  and its token does not work.
- **Where demos do not show:** the admin users list, the admin statistics (accounts, sign-ups,
  languages and content totals) and user search all leave out demo accounts and the template.
- **Demo usage numbers (admin Demo tab, under the settings):** a banner (starts per window, what
  visitors add, cap hits, refused starts, languages) and a table of the demo accounts on the
  database now. They come from two tables that the purge does not delete (migration 0029, it arrives
  with the deploy; nothing to run by hand):
  - `demo_starts`: one row per start (time, languages, seed counts, caps). Before it deletes an
    expired demo, the purge writes the final counts to its row (`closed_at`); `user_id` then becomes
    NULL. No IP and no other personal data.
  - `demo_refusals`: refused starts, one counter per UTC day and code (`demo_busy`,
    `demo_rate_limited`, `demo_disabled`, `demo_unavailable`).

  ```sql
  SELECT count(*) FROM demo_starts WHERE started_at > now() - interval '7 days';
  SELECT * FROM demo_refusals ORDER BY day DESC, code;
  ```

  Both are kept for now (small rows); a retention cut-off can be added to the purge later. The e2e
  teardown deletes the start rows of its own demos, but its "demo is off" test adds 1 to the local
  `demo_disabled` counter on each run.

## Email sender addresses per environment

Not a database, but environment-scoped the same way: staging sends real
transactional email as `staging@ladu.com.ar`, production as
`noreply@ladu.com.ar` — both via Resend, both real deliverable addresses.
Registering the same email address on staging and production is safe and
won't collide, since (as above) they're entirely separate databases.
