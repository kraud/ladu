# Account badges ("official" and later types)

> Status: **approved 2026-10-06. Slice 0 done. Slices 1–8 not started.**
> Branch: `verified-accounts`.

## How to start

- Read `CLAUDE.md`, `.context/README.md` and this file.
- Do one slice at a time. Stop after each slice. The user reviews and runs
  `git commit` themselves. Claude only drafts the commit message.
- Run tests without `| tail` or `| head`. Check the real exit code.

## Context

The owner of Ladu wants to mark some accounts with a badge, for example
"official". Users see the badge next to the author of a Tag. Users can
filter `/tags` by "author has badge X". This helps users find good Tags to
follow or clone.

Tags are fully built (Phase 4: all slices done, see `phase-4-tags.md`). The
`CLAUDE.md` note "tags deferred" refers to tag *sharing* only. The tag API
already builds `TagSummary` in a batch (`buildTagSummaries`,
`backend/controllers/tagController.ts:216`). Badges add one query to that
batch and cause no N+1.

**Naming rule.** `users.verified` already means "email verified" (schema,
serializers, admin filters, stats). This feature never uses the word
"verified" in code, fields or copy. The term is **badge**. The type is
**official**.

## Decisions

### Given by the user (do not re-open)

| # | Decision |
|---|---|
| G1 | The badge is on the **account**, not on the Tag. Tags are the first content type that shows it. |
| G2 | Many badge types. First type: `official`. The type is `varchar(32)`, as `staff_accounts.role`. No Postgres enum. A new type needs no migration. |
| G3 | New table `user_badges`: `id`, `user_id` (FK users, cascade), `type`, `granted_at`, `revoked_at` (nullable), `granted_by` (FK staff_accounts, restrict). Partial unique index `(user_id, type) WHERE revoked_at IS NULL`. A revoke sets `revoked_at`. It never deletes the row. |
| G4 | Only the owner grants badges, in the admin panel. No public endpoint writes a badge. New permission `badge.manage` in `lib/adminPermissions.ts`. No migration for the permission. |
| G5 | Reuse `audit_log`: actions `badge.grant` and `badge.revoke`, each with a reason. |
| G6 | Read the badge from the DB on each request. Not in the JWT. A revoke takes effect at once. |
| G7 | A clone does not inherit a badge. `tags.source_tag_id` already gives "Cloned from X". |
| G8 | Block impersonation of reserved names. |

### Taken with the user on 2026-10-06

| # | Decision |
|---|---|
| D1 | **Name match rule.** Normalize the name (see Slice 7). Block it if it **contains** `ladu` or `official`. Block it if it **equals** `admin`, `staff`, `support`, `moderator` or `team`. "badminton" stays allowed. |
| D2 | **Exemption.** An account with an active `official` badge skips the reserved-name check. We check a name only when it changes. Existing names stay. |
| D3 | **Fix `updateUser` username uniqueness** in the same slice. It must use `lower(username)`, as registration does, and trim the value. |
| D4 | **Filter control is a select** from the start: "Author: Anyone / Official". It scales to more types with no UI change. |

### Calls made by the agent (each is reversible, tell me if you disagree)

- **A1 — Allowed types live in code.** `backend/lib/badges.ts` exports
  `BADGE_TYPES = ['official'] as const`. Grant and the `?badge=` filter reject
  any other value with 400. A new type is a one-line code change.
- **A2 — `author.badges` is `string[]`** (active types, sorted). For example
  `["official"]`. It is empty when the author has no badge. Objects are not
  needed now.
- **A3 — Banned or deleted authors show no badge.** The badge query joins
  `users` and ignores rows with `banned_at` or `deleted_at` set. The row
  stays. Unban brings the badge back.
- **A4 — The admin user detail shows only active badges**, with
  `grantedAt` and `grantedBy.name`. The history is in the audit log already.
- **A5 — Endpoints:**
  - `POST /api/admin/users/:id/badges`, body `{type, reason}`
  - `POST /api/admin/users/:id/badges/:type/revoke`, body `{reason}`

  Both use `requireStaff('badge.manage')`. Both return 409 if the badge is
  already active (grant) or not active (revoke). Both return the fresh
  `UserDetail`, as the other user actions do.
- **A6 — Badge filter in the URL.** `?badge=official` goes in
  `tagsRoute.validateSearch`, next to `scope`. A user can share the link
  "official tags".
- **A7 — No extra index for the filter.** The filter is
  `EXISTS (… user_badges WHERE user_id = tags.author_id AND type = $1 AND revoked_at IS NULL)`.
  The partial unique index `(user_id, type) WHERE revoked_at IS NULL` serves
  this lookup. The table stays very small (the owner grants by hand). We
  check this with `EXPLAIN` in Slice 4.

## Design

### Schema (`backend/src/db/schema.ts`)

```ts
export const userBadges = pgTable('user_badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 32 }).notNull(), // see lib/badges.ts — no enum, a new type needs no migration
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  grantedBy: uuid('granted_by').notNull().references(() => staffAccounts.id, { onDelete: 'restrict' }),
}, (table) => [
  uniqueIndex('user_badges_active_unique').on(table.userId, table.type).where(sql`${table.revokedAt} IS NULL`),
]);
```

Migration `0020_user_badges.sql` comes from `npm run db:generate`. (Match the
timestamp style of the other columns while building.)

### Backend helper (`backend/lib/badges.ts`)

- `BADGE_TYPES`, `type BadgeType`, `isBadgeType(value)`.
- `activeBadgesByUserIds(userIds): Promise<Map<string, BadgeType[]>>`. One
  query. It applies A3. Used by `buildTagSummaries`, the admin detail and the
  name check.
- `activeBadgeCondition(type)`: the SQL `EXISTS` for the tag filter.

### TagSummary

`author: { id, username, badges: string[] }`. All 7 endpoints that return a
`TagSummary` get it through `buildTagSummaries`. No change in each endpoint.

### Admin

- `badge.manage` goes in `PERMISSIONS` only. `owner` gets it automatically
  (`owner: [...PERMISSIONS]`). Mirror it in
  `admin/src/test/msw/handlers.ts` `PERMISSIONS_BY_ROLE`.
- The controller locks the user row `FOR UPDATE`. It uses `readReason(body, true)` from
  `lib/adminRequest.ts`. It writes the badge row and the audit row in one
  transaction:
  `{ staffId, action: 'badge.grant'|'badge.revoke', targetType: 'user', targetId, reason, metadata: { email, username, badge: type } }`.
  `admin/src/features/audit/describe.ts` then shows the `badge` key with no
  change.
- `loadUserDetail` gains `badges: [{ type, grantedAt, grantedBy: { id, name } }]`.

## Slices

| # | Slice | Ends with |
|---|---|---|
| 0 | Save this plan | `.context/plans/verified-badges.md` + a row in the `.context/README.md` spec index |
| 1 | Schema + migration + `lib/badges.ts` | `npm run db:migrate` applies 0020; Jest green |
| 2 | Admin API: grant + revoke + detail | grant/revoke with curl or Jest; audit rows written |
| 3 | Admin UI: Badges section + dialogs | owner grants and revokes in the admin panel |
| 4 | Tag API: `author.badges` + `?badge=` filter | `GET /api/tags?badge=official` returns only badged authors |
| 5 | Frontend: badge next to author | badge shows on `/tags` cards and `/tag/:id` |
| 6 | Frontend: author filter select | `/tags?badge=official` works from the UI |
| 7 | Reserved names (impersonation) | register / OAuth signup / update reject "Ladu_0fficial" |
| 8 | e2e gate + docs | `npm run test:e2e` green (except the 8 known oauth-2..5 failures) |

### Slice 0 — Save the plan

**What and why.** We copy this plan into the repo, so it stays with the
code, as the other plans do.

- Copy this file to `.context/plans/verified-badges.md`.
- Add one row to the "Where the specs live" table in `.context/README.md`.

### Slice 1 — Schema and migration

**What and why.** We add the `user_badges` table. Nothing reads it yet. This
slice proves that the table, the cascade and the partial unique index work,
before any endpoint uses them. A *partial unique index* is a unique rule that
applies only to some rows. Here it applies only to active rows
(`revoked_at IS NULL`). One user can have many *revoked* `official` rows
(the history), but only one *active* row.

- `schema.ts`: the `userBadges` table (above).
- `npm run db:generate` → `0020_user_badges.sql`. Read the SQL before applying.
- `backend/lib/badges.ts`: `BADGE_TYPES`, `isBadgeType`,
  `activeBadgesByUserIds`, `activeBadgeCondition`.
- `backend/tests/db.js`: add `user_badges` to the `TRUNCATE` list.
- `e2e/fixtures/db.ts`: `deleteStaffByEmail` must delete `user_badges` rows
  that the staff account granted before it deletes the staff row
  (`granted_by` is `restrict`, the same reason audit rows are deleted first).
- Tests: new `backend/tests/userBadges.test.js`:
  - a second active badge of the same type → unique violation
  - revoke, then grant again → allowed
  - delete the user → badge rows go (cascade)
  - delete the granting staff row → blocked (restrict)
  - `activeBadgesByUserIds` ignores revoked rows, banned users and deleted users (A3)
- Docs: a comment on the table in `schema.ts` (same style as `staff_accounts.role`).

### Slice 2 — Admin API: grant, revoke, detail

**What and why.** The owner needs a safe way to give and remove a badge.
Only the admin API can write a badge. Every write leaves an audit row with a
reason. That way we always know who gave which badge, when and why.

- `lib/adminPermissions.ts`: add `badge.manage` to `PERMISSIONS`.
- `routes/admin/userRoutes.js`: the two routes from A5.
- `controllers/admin/badgeController.ts` (new; keeps `userController.ts`
  from growing): validate UUID, `isBadgeType` (400), `readReason` (400),
  transaction with row lock, 404 unknown user, 409 already active / not
  active, insert or set `revoked_at = now()`, audit row, respond with
  `loadUserDetail`.
- `loadUserDetail`: add `badges` (A4).
- Tests: `backend/tests/adminBadges.test.js`, modeled on
  `adminUserActions.test.js`:
  - role matrix: only owner → 2xx; admin/support/viewer → 403
  - reason: missing / blank / not text / too long → 400
  - unknown type → 400; unknown user → 404; double grant → 409; revoke when none → 409
  - audit row content (action, reason, `metadata.badge`)
  - revoke keeps the row and sets `revoked_at`; grant again after revoke works
  - `GET /api/admin/users/:id` shows only active badges
- Docs: add `badge.manage` to the permission list in
  `.context/plans/admin-dashboard.md`.

### Slice 3 — Admin UI

**What and why.** The owner gets a screen to do Slice 2 without curl. We add
a "Badges" section to the user detail page. It shows the active badges and
the buttons to grant and revoke. Each button opens a dialog with a required
reason, the same pattern as Ban.

- `admin/src/features/users/types.ts`: `badges` on `UserDetail`;
  `admin/src/test/users.ts` `makeDetail` default `badges: []`.
- `api.ts` / `hooks.ts`: `grantBadge`, `revokeBadge`, `useUserBadge(userId)`.
  On success: `setQueryData(userKeys.detail(id))` + invalidate the list (same
  as `useUserAction`).
- `components/BadgeSection.tsx` + `components/BadgeDialog.tsx`: the dialog is
  modeled on `ActionDialog` in `UserActions.tsx` (reason textarea, max 500,
  confirm disabled until the reason is not blank, `role="alert"` on error,
  `role="status"` on success). Grant mode has a type select (only types not
  active yet). Buttons render only when `useCan('badge.manage')`.
- `UserDetailPage.tsx`: render `BadgeSection` as its own section. Do not put
  a span right after the `h1` (the admin-5 e2e locator is `h1 + span`).
- `admin/src/test/msw/handlers.ts`: `badge.manage` for owner; handlers for
  the two routes.
- Tests: `BadgeSection.test.tsx` — list renders, owner sees the buttons and
  other roles do not, reason required, POST body correct, the list updates
  after success.

### Slice 4 — Tag API: `author.badges` and the filter

**What and why.** The learner app needs the data. Every `TagSummary` now
says which badges its author has. `GET /api/tags` gets a `badge=` parameter
that keeps only Tags whose author has that active badge. The filter is a SQL
`EXISTS` subquery, so pagination and `total` stay correct.

- `buildTagSummaries`: add `activeBadgesByUserIds(authorIds)` to its
  `Promise.all`; set `author.badges`. Update the `TagSummary` interface.
- `listTags`: read `badge`; 400 if not `isBadgeType`; push
  `activeBadgeCondition(type)` into `conditions` **before** the `total` count.
  It combines with `scope`, `q`, `sort` and the cursor (AND).
- Check the plan with `EXPLAIN` on the dev DB (A7). Add an index only if the
  plan needs one.
- Tests (`backend/tests/tags.test.js`):
  - `author.badges` is `[]` by default, `["official"]` after a grant (insert
    via the DB helper), `[]` after a revoke (no re-login: G6)
  - banned author → `[]` (A3)
  - a clone by another user → the clone's author has `[]` (G7)
  - `?badge=official` with each scope; `total` is correct; pagination over
    two pages; unknown type → 400
- Docs: update the `TagSummary` block in `phase-4-tags.md` (one line + a
  pointer to this plan).

### Slice 5 — Frontend: the badge next to the author

**What and why.** Users see the badge. We show a small seal icon plus a
short label ("Official") right after "by <username>". The icon makes it easy
to spot; the text makes it clear (commandment 7: status is always legible).
It has one accent colour and no animation, so it is not noisy. The owner
does not see their own badge on their own Tags, because the "by" row only
shows on Tags of other users. That is correct.

- `features/tags/types.ts`: `TagAuthor.badges: AuthorBadgeType[]`;
  `AuthorBadgeType = 'official'`.
- `components/TagBadge.tsx`: new `AuthorBadges({ badges })`. It uses
  Phosphor `SealCheckIcon` + text, with an `aria-label` and a `title`. One
  CSS class `.t-author-badge` in `globals.css`, built on accent tokens (dark
  mode works with no extra rule). Do not reuse the name `has-badge` (that is
  the unread dot).
- Render it in `TagCard.tsx` (after the `byAuthor` span) and in
  `TagViewPage.tsx` (the `.t-by` header block).
- `test/msw/tagHandlers.ts`: option `authorBadges?: Record<string, string[]>`;
  `toSummary` sets `author.badges`.
- Locales: `tags.json` → `authorBadge.official` in en, es, de, ee.
- Tests: `TagBadge.test.tsx` (renders, accessible name, nothing for `[]`),
  `TagCard.test.tsx` and `TagViewPage.test.tsx` (badge shows for a badged
  author, not for others).

### Slice 6 — Frontend: the author filter

**What and why.** Users can ask for "only Tags from official authors". The
control is a select "Author: Anyone / Official" in the tool row, next to
Sort (D4). Its value lives in the URL (A6), so the view can be shared and
survives a reload.

- `app/router.tsx`: `tagsRoute.validateSearch` accepts `badge` (only known
  types; anything else is dropped).
- `types.ts`: `TagListFilters.badge?`; `api.ts` `buildListQuery` sets it;
  `keys.ts` needs no change (the filters object is the key).
- `TagsPage.tsx`: the select; pass `badge` to `useTags`; a new empty state
  "No tags from official authors match" with an action "Show all authors".
- MSW: the list handler filters by `badge` before `total`.
- Locales: `page.authorFilter.{label,any}` and the empty state, 4 languages.
- Tests: `TagsPage.test.tsx` — select sets the URL and the query string;
  reload keeps it; empty state; it combines with scope and search.

### Slice 7 — Reserved names (impersonation)

**What and why.** A badge only helps if nobody can *pretend* to be official.
Today usernames and display names (`users.name`) have no rules at all. We
add one small check. First we **normalize** the name: we turn it into a
plain form so that look-alike tricks give the same text. Then we compare it
with the reserved words (D1).

Normalize steps (`backend/lib/reservedNames.ts`):
1. Unicode NFKC (turns full-width and styled letters into plain letters).
2. Lowercase.
3. NFD + remove combining marks (removes accents: "Ladú" → "ladu").
4. Map a small look-alike table: Cyrillic/Greek letters that look Latin
   (а е о р с х у і к м т н в, ο α ε ι κ ν ρ τ υ χ) and digits/symbols
   (0→o, 1→l, 3→e, 4→a, 5→s, 7→t, @→a, $→s, !→i, |→l).
5. Remove every character that is not `a-z` (spaces, dots, `_`, `-`,
   zero-width characters).

Rule: reject if the result contains `ladu` or `official`, or equals `admin`,
`staff`, `support`, `moderator` or `team`. Exempt: an account with an active
`official` badge (D2). We check only a value that changes.

- `isReservedName(value)` + unit tests (`backend/tests/reservedNames.test.js`):
  "Ladu", "L a d u", "LADÚ", "Ladu_0fficial", "Lаdu" (Cyrillic а),
  "ＬＡＤＵ" (full-width), "Admin" → blocked; "badminton", "teammate",
  "Ladislav", "Kevin" → allowed.
- Apply it to `username` and `name` in: `registerUser`
  (`controllers/userController.ts:196`), `signupComplete`
  (`controllers/oauthController.ts:323`) and `updateUser`
  (`controllers/userController.ts:367`). The response is 400 with a stable
  error code (for example `NAME_RESERVED`). Do not leak the word list.
- D3: `updateUser` uniqueness uses `lower(username)` (reuse
  `findUserByUsernameInsensitive`), excluding the caller; trim the value.
- Frontend: map the new error code to a message in the register form, the
  OAuth signup form and the account form (4 languages).
- Tests: register / OAuth signup / update rejected; a badged account can
  rename to "Ladu"; an unchanged legacy name passes an update; the D3 case
  ("Admin" vs "admin") → 400.

### Slice 8 — e2e gate and docs

**What and why.** We prove the whole flow in a real browser, against the
real backend and Postgres. This is the required gate for every phase.

`e2e/tests/admin-13-badges.spec.ts` (serial):
1. Seed: owner staff, learner A ("author") with one Public tag, learner B
   ("reader"). Add a `seedTag` helper to `e2e/fixtures/db.ts` if none exists.
2. Owner logs in to the admin UI (:5174), opens A, grants `official` without
   a reason (confirm disabled), then with a reason → status notice. The
   audit row exists (`getAuditForUser`).
3. B logs in to the app (:5173), opens `/tags` → Discover. A's card shows the
   badge. The tag page shows it too.
4. B picks "Author: Official" → only A's tag; the URL has `?badge=official`.
5. Owner revokes with a reason. B reloads → no badge; the filter shows the
   empty state.
6. B tries to rename to "Ladu 0fficial" on the account page → error.
7. `afterAll`: delete users, then staff (fixture order from Slice 1).

Gate: `npm run test:e2e`. The 8 `oauth-2..5` specs fail at the Google stub
on unchanged code (known). Do not count them as new failures. Report all
other failures as they are.

Docs:
- `.context/overview.md`: a short "Account badges" paragraph (what they are,
  who grants them, where they show).
- This plan: a "Shipped" note for each slice, as `phase-4-tags.md` does.
- `admin-dashboard.md`: the new section on the user detail page.

## Later (out of scope, do not block it)

- **Popularity counts** (follows and copies per week, month, year, all
  time). No new tables are needed. `user_following_tags.created_at` and
  `tags.source_tag_id` (+ `tags.created_at`) hold the data. Future indexes:
  `user_following_tags (tag_id, created_at)` and
  `tags (source_tag_id, created_at)`. *(Your prompt text was garbled here:
  "The exs` … `usat`". I read it as `user_following_tags`. Please correct me
  if you meant something else.)*
- Self-service badge requests.
- Event or history tables that survive deletions.
- Badges on other content (words, profiles, practice sets). G1 makes this a
  frontend-only change later.
- More badge types (`teacher`, `curator`, `partner`): add to `BADGE_TYPES`,
  add locale strings, add an icon. No migration.

## Risks

- The `admin-5` e2e locator `h1 + span` breaks if a span goes right after
  the `h1`. Slice 3 keeps badges in their own section.
- `deleteStaffByEmail` in e2e fails on `granted_by restrict` if Slice 1 does
  not update it. This also affects any other spec that deletes the owner
  after a grant.
- The look-alike table is small on purpose. It blocks the common tricks, not
  every Unicode confusable. A full confusables list can come later if abuse
  shows up.

## Verification

Per slice:
- Backend: `npm test` (exit code 0). `npx tsc --noEmit -p backend`.
- Admin: `npm test -w admin`, `npx tsc -b` in `admin/`.
- Frontend: `npm test -w frontend`, `npx tsc -b`, `npm run build -w frontend`.
- Manual: `npm run dev:admin` (grant / revoke), `npm run dev` (see badge,
  use filter).

End: `npm run test:e2e` green, except the 8 known `oauth-2..5` failures.
