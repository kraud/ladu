# Plan: Manual production releases (tags, GitHub Releases, approval gate)

Status: not started. Research done on 2026-10-12. No file has been changed yet.

Goal: a merge to `main` still deploys to staging and runs the smoke test by itself. A change reaches **production** only when the user picks a tested commit, tags it, and approves the deploy in GitHub.

## How to start (read this first in a new session)

1. Read `CLAUDE.md` and `.context/README.md`. Follow the working rules: one small slice, an overview in plain language **before** any file changes (explain each GitHub concept the slice uses), ask before assuming, docs with the code. The user runs `git commit` and creates branches; you only draft messages and names.
2. Read `.github/workflows/deploy.yml`, `deploy/scripts/deploy.sh`, and `.dev-context/infrastructure-guide/03-development-workflow.md`.
3. Confirm the **Decisions to confirm** below before slice 1.

## Today

`deploy.yml` runs on every push to `main`: `build-and-push` → `staging` → `smoke` → `production` (`needs: smoke`). No human step exists. `03-development-workflow.md` says this was a deliberate choice, so that doc and `.dev-context/deployment-strategy.md` must change at the end.

## Target

```
merge to main  → build → staging → smoke test        (automatic, as today)
                                    │
user tags a tested commit (v1.4.0) and publishes a GitHub Release
                                    │
             approval gate → production deploy of THAT image
```

## Concepts

- **Tag:** a permanent name on one commit (`v1.4.0`).
- **Release:** a GitHub page on a tag. It holds release notes and fires the `release: published` event.
- **Environment protection rule:** a setting on the `production` Environment. A job that targets it waits until a named reviewer clicks Approve.
- **Promotion:** deploy the same image that ran on staging. Do not rebuild.

## Scope: GitHub and repo only

No change on the VPS, in Ansible, or in Terraform.

- `deploy.sh` and `app.yml` are copied to the VPS on every deploy and take any image tag.
- The release workflow turns the tag into its commit SHA (`git rev-parse v1.4.0^{commit}`) and runs `./deploy.sh prod <sha>`. The image tag stays the SHA, so the `/api/health` check (`grep "sha":"$IMAGE_TAG"`) still matches. **Do not pass the version tag to `deploy.sh`**: the health check would never match and every release would roll back.
- Adding `v1.4.0` as a second image tag in GHCR is optional (`docker buildx imagetools create`, metadata only, no rebuild).
- **Landing stays as it is:** the image goes to `landing:latest` on merge, and the user runs the Ansible `platform` playbook after the checks pass. Decided on 2026-10-12.

## Decisions to confirm at the start

| Topic | Recommendation |
|---|---|
| Trigger | `release: published` (gives release notes and a history). Add `workflow_dispatch` (input: tag) for rollbacks and redeploys. |
| Tag scheme | Semver (`v1.4.0`) or date-based (`v2026.10.12`). Ask the user. |
| Repo visibility | Required reviewers on Environments need a public repo, or a paid plan for a private one. **Check first**: if not available, the approval gate cannot be used and the Release click is the only gate. |
| Self-review | The user is the only reviewer, so they approve their own run. The gate is a deliberate pause, not a second pair of eyes. |
| GHCR version tag | Optional. Recommend skipping at first. |

## Slices

Each slice ends with something runnable. Suggest a commit message after each one.

1. **GitHub settings.** Add a required reviewer on the `production` Environment. Add a tag ruleset: only the user creates `v*` tags; tags cannot be moved or deleted. No code.
2. **`release.yml` with `workflow_dispatch` only.** Move the `production` job out of `deploy.yml` into the new file. Remove `needs: smoke` (the jobs are now in different workflows). The job checks out the tag (not `main`), because it copies `app.yml` and `deploy.sh` from the checkout. Use its own `concurrency` group so a staging deploy and a release do not queue behind each other. Prove one promotion works by hand.
3. **"Was this tested?" check.** Before deploying, the release workflow confirms that this SHA was deployed to staging and passed smoke (Actions API or a commit status). Without it, an untested commit could be tagged and shipped.
4. **`release: published` trigger.** Add the trigger and auto-generated release notes (`generate_release_notes`). Optionally add the GHCR version tag.
5. **Docs.** Update `03-development-workflow.md`, `deployment-strategy.md` ("Rejected options"), and the troubleshooting playbook. Add a "How to release" and a "How to roll back" section. Rollback = run the workflow again with the previous tag.

Every slice ends with a green CI run. If a slice changes anything under `e2e/`, run `npm run test:e2e`.

## Traps

- **Migrations pile up.** Staging runs ahead of production by several commits. A release runs all the pending migrations in one batch. Keep the expand/contract rule (add the new column first, remove the old one in a later release). `deploy.sh` rolls back code, not the database.
- **Staging is not the release candidate.** Staging always shows the newest `main`. If `main` moves before the user releases, tag the SHA that passed smoke, not the head of `main`.
- **Drift.** A forgotten release leaves production far behind `main`. Consider a reminder or a check in the dashboard.
- **Concurrency.** `deploy.yml` uses `cancel-in-progress: false`. At most one run can wait; extra queued runs are cancelled. This is fine for staging, but check it still holds after the split.
- **Secrets.** Production secrets stay in the `production` Environment, so only the job with `environment: production` can read them. Keep that on the new job.

## Benefits

- Rollback is a normal action: run the workflow again with the previous tag.
- `/api/health` can show the version as well as the SHA. Sentry can use the tag as the release name (optional follow-up).
- GitHub builds the changelog from merged PRs.
- A hotfix uses the normal path: PR into `main`, staging, tag. No special process.

## Cost

About 2 minutes of the user's attention per production change. A tag scheme to follow. Risk of production lagging behind `main`.
