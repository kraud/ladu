# Admin user emails (plan, 2026-10-01)

**Status:** done. Merged as PR #62 (`admin-user-emails`). The live spec is `.context/features/admin.md` (§1 A-13, §5).

**Decisions kept:**
- A-13: permission `users.email` for `support`, `admin`, `owner`. Cooldown 5 minutes per user and email type, from `audit_log`; the second try gets 429.
- Verification email: only for a user who is not verified and not deleted. Reuse the `tokens` row, never rotate it.
- Reset email: only for a user with a password. A new `password_reset_tokens` row each time. A Google-only user gets no button.
- The UI says "handed to the mail service", never "delivered". `sendMail` never rejects, so delivery is unknown.
- Audit rows carry the email and language, never a token or link.

**Plan versus built:**
- The shared code is `backend/lib/accountEmails.ts`. The public handlers use it too.
- The admin runner got two optional `ActionSpec` fields: `cooldownMinutes` and `auditMetadata`. `apply` can return a function that the runner calls after the commit.
- Follow-up in the same PR: the public `requestPasswordReset` now answers 200 with the same message for an unknown, a throttled and a sent request. One email per account every 5 minutes.

**Traps:**
- The e2e backend cannot reach a mail server, so the spec checks the database and the UI, not an inbox.
- The cooldown test moves audit rows into the past. Fake timers do not work with the row lock.

**Not done:** knowing if an email arrived (needs Resend webhooks).

**Old text:** `git log -- .context/plans/admin-user-emails.md`
