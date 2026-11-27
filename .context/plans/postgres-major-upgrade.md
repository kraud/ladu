# Plan: Postgres major upgrade (15 → 17)

Status: not started. Written on 2026-11-23. Planned for the first half of 2027. No file has been changed yet.

Goal: the VPS, local dev and CI all run the same newer Postgres major version, with no data lost and a tested way back.

## Why, and why not now

- Postgres 15 gets security fixes until **November 2027**. (From memory: check postgresql.org/support/versioning before you rely on the date.) The upgrade has no deadline pressure until mid-2027.
- Dependabot opened PR #143 (`15.20-alpine` → `18.6-alpine`) on 2026-11-23. It was closed with "ignore this major version". Reason: all CI jobs use Postgres 15, so the green checks proved nothing about 18. A merge would have broken the VPS (see "Traps").
- Today the version is not a decision. The old app used 15, and we copied it. No document gives a reason.
- Doing it on our own date, with a tested dump and restore, is safer than being forced to do it in 2027.

## Concepts

- **Major version:** 15, 16, 17, 18. The data files of one major version cannot be read by another. A patch update (15.19 → 15.20) is safe. A major update is a migration.
- **`pg_dump` / restore:** `pg_dump -Fc` writes one database to a file. `pg_restore` reads it into a new server. This is the upgrade method here, because the data is small.
- **Roles:** the users of the server (`ladu_staging`, `ladu_prod`, the superuser). `pg_dump` does **not** save them. `pg_dumpall --globals-only` does.
- **Volume:** the Docker storage that holds the data (`postgres_data`). A new major version needs a new, empty volume.

## Scope

- One server on the VPS holds two databases: `ladu_staging` and `ladu_prod` (see `02-environments-and-databases.md`).
- Local dev (`docker-compose.yml`) and CI (`.github/workflows/ci.yml`) move to the same major version. Local data is disposable and is not migrated.
- No data model change. No application code change is expected. Check this in slice 1.

## Decisions to confirm at the start

| Topic | Recommendation |
|---|---|
| Target version | **17**. It keeps the old data path (`/var/lib/postgresql/data`), has had more patch releases, and is supported until November 2029. 18 changes the data path (`/var/lib/postgresql/18/docker`) and needs a different volume mount. 18 is also an option later (support until November 2030). |
| Method | Dump and restore into a **new volume**. Keep the old volume until prod has run well for one week. |
| Downtime | Accept a short outage (about 10 to 30 minutes, to be measured on staging). Ladu has no uptime promise and the data is small. |
| Dependabot rule | Done on 2026-11-27: `.github/dependabot.yml` ignores Postgres majors. Patch PRs keep arriving. |

## Slices

Each slice ends with something runnable. Suggest a commit message after each slice.

1. **Check compatibility, locally.** Change `docker-compose.yml:8` to `postgres:17-alpine`. Run `npm run docker:up` with a fresh volume, then `npm run db:migrate`, `npm test` and `npm run test:e2e`. Read the Postgres 16 and 17 release notes for removed features. No `CREATE EXTENSION` exists in the migrations (checked 2026-11-23), so no extension needs a new version. Also run `psql` against the new container with the same client (`pg_dump` version must be the same as the server or newer).
2. **CI.** Change both service containers in `.github/workflows/ci.yml` (`:51` and `:133`) to `postgres:17-alpine`. Update `deploy/scripts/restore-test.sh:38` too. This is the throwaway container of the weekly restore test. If it stays on 15, the test checks the wrong version once prod moves. Merge only when CI is green.
3. **Rehearsal on staging, on a copy.** Do **not** touch the real stack yet. On the VPS, start a second Postgres 17 container with its own volume. Restore the latest B2 dump of `ladu_prod` into it. Measure the time. Run a row count. This repeats `restore-test.sh`, but on the VPS and with real size. Write down the commands and the times in the infrastructure guide.
4. **Upgrade the VPS.** Needs a quiet time. Steps:
   1. Make a fresh dump of **both** databases (`ladu_staging` and `ladu_prod`) and the roles (`pg_dumpall --globals-only`). The nightly `backup.sh` dumps only `ladu_prod`, and it leaves out the data of `lexemes` and `lexeme_translations`. Copy the dumps off the VPS (B2 or the laptop) and check that the files are not empty.
   2. Stop the app containers (staging and prod backends).
   3. Stop postgres. Keep the old `postgres_data` volume unchanged.
   4. Change `docker-compose.platform.yml:24` to `postgres:17.<latest patch>-alpine` and the volume name (for example `postgres17_data`). Run the Ansible `platform` role. It syncs the file and starts postgres.
   5. Restore roles, then each database. Reload the autocomplete lexicon (`02-environments-and-databases.md`, section "The autocomplete lexicon").
   6. Start the app containers. Run the staging smoke test. Check `/api/health` on prod.
   7. Do **not** remove the old volume yet.
5. **Docs.**
   - Update `01-architecture-overview.md:109`, `03-development-workflow.md:208`, `02-environments-and-databases.md` (section 3, CI), `05-troubleshooting-playbook.md:45`, `deployment-strategy.md` (`:26`, `:84`, `:354`, `:488`) and `.context/README.md:169`. Add a "How to upgrade Postgres" section to the guide with the commands that worked.
6. **Clean up, one week later.** If `ladu_prod` ran well and the nightly backup and the weekly restore test are both green on 17, remove the old volume. Then fold this plan into the guide, write the record in `archive/`, and delete this file.

Every slice ends with a green CI run. Slices 1 and 2 also need a green `npm run test:e2e`.

## Rollback

- **Before step 4.4:** nothing has changed. Start the old stack again.
- **After step 4.4, with the old volume still present:** stop postgres, set the image and the volume back to the old values (`15.20-alpine`, `postgres_data`), run the `platform` role, start the apps. Data written after the upgrade is lost, so decide fast.
- **Old volume removed:** restore from the dumps of step 4.1 into a 15 container. This is why step 6 waits one week.

## Traps

- **Green CI proves nothing until CI uses the target version.** All CI jobs and the dev compose use 15 today. Slice 2 fixes this before any production change.
- **A merge of a bare version bump breaks the VPS.** Compose pulls the new image, and the container cannot read the old data files. For 18 the data path also changes, so the server may start with an empty database and look healthy. (Not tested on 18.) Never merge a Dependabot major bump for Postgres by itself.
- **`backup.sh` is not a full backup.** It dumps `ladu_prod` only, and it skips the rows of `lexemes` and `lexeme_translations`. For the upgrade, dump staging and the roles as well, and reload the lexicon after the restore.
- **Roles are not in a dump.** Restoring a database without `ladu_prod` and `ladu_staging` first gives permission errors. Restore the roles first.
- **`public` schema rights.** Since Postgres 15, only the schema owner can create tables in `public` (the first live migration failed on this: `deployment-strategy.md:275`). The restored databases keep their owners, but check this after the restore by running a migration on staging.
- **`restore-test.sh` hard-codes the image** (`postgres:15-alpine`, line 38). Change it with the VPS, or the weekly check tests the wrong version.
- **Dependabot ignores Postgres majors** (`.github/dependabot.yml`, since 2026-11-27). It does not propose the new version, so choose it and change the files by hand. Keep the rule after the upgrade.
- **Client and server versions.** `pg_dump` must be the same version as the server or newer. The VPS runs it inside the container, so this is safe there. On the laptop, check `pg_dump --version` if you dump by hand.

## Not in scope

- `pg_upgrade` (in-place upgrade). It needs both versions in one container. Dump and restore is simpler and safe at this data size.
- Replication, high availability, or a second server.
- Using new 17 or 18 features in the code.
