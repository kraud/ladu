# Account badges (plan, 2026-10-06 to 2026-10-07)

**Status:** done. Merged as PR #74 (`verified-accounts`), all 9 slices (0 to 8). The live spec is `.context/features/admin.md` (§1 B-1 to B-5, §4, §5).

**Decisions kept:**
- G1 to G8 and D1 to D4 of the plan became B-1 to B-5 in the spec: badge on the account, type in `varchar(32)`, owner-only, read from the DB each request, no inheritance on clone, reserved-name rule with an `official` exemption.
- A1: allowed types live in `backend/lib/badges.ts` (`BADGE_TYPES`). A3: banned and deleted authors show no badge.
- A5: two endpoints, both `requireStaff('badge.manage')`, both return the fresh `UserDetail`.

**Plan versus built:**
- The table has no time zone on its timestamps, like every other table.
- `TagAuthor.badges` is `string[]`, not a union, so a newer server cannot break an older build.
- The owner redesigned `/tags` on 2026-10-07: the filter became a "Verified" checkbox and the seal is an icon only (B-5).
- A third error code `google_name_reserved` was added for Google sign-up.
- `updateUser` now trims the username, checks it case-insensitively and runs the credential check first.

**Traps:**
- `users.verified` means "email verified". Never use the word for the badge in code.
- The admin user detail must list badge rows straight from the table. `activeBadgesByUserIds` hides a banned account's badge, and staff must still see it to revoke it.
- A grant on a deleted account is allowed on purpose; the badge is hidden until a restore.
- `e2e/fixtures/db.ts` `deleteStaffByEmail` must delete badge rows first (`granted_by` is `restrict`).
- The `admin-5` e2e locator is `h1 + span`. Keep the badge section out of that position.

**Gate result:** `npm run test:e2e` gave 65 passed, 8 failed (the known `oauth-2` to `oauth-5` set), 14 not run (chained access-gate projects, run by hand and green).

**Old text:** `git log -- .context/plans/verified-badges.md`
