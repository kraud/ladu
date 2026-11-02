# Account-less demo access (plan, 2026-10-14)

**Status:** done 2026-10-15 (slices 0 to 5, branch `demo-setup`, PR #89). French was added in PR #110. Rollout and ES/DE/EE review closed 2026-11-02 (confirmed by the user). The live spec is `.context/features/demo.md`.

**Decisions kept:** D1 to D20 of the plan, all in the spec. Key constraints: throw-away accounts deleted on expiry (D1); a separate admin gate, off by default (D2); caps frozen at start and enforced on every create and clone path (D3, D7, D11); restrictions for a demo user, server-side (D10); a live-demo cap as an admin setting (D15).

**Plan versus built:**
- Slices 3 to 5 were added before the merge: a language choice on `/demo`, a start transition screen, and the admin table and usage banner (the `demo_starts` and `demo_refusals` tables).
- `/demo` became two steps (description, then languages and Start).
- The per-IP start limit is in memory (the plan allowed this; a database version is an idea, `research/deferred-ideas.md` I-4).
- The seed is still the placeholder set (D5).

**Traps:** the demo copies must be the demo's own words (no source fields) or the "own copy" logic hides them; `protect` skips the activity writes for demos; the template has a NULL expiry so the purge keeps it; the e2e template needs `--reset` after a data change.

**Old text:** `git log -- .context/plans/demo-access.md`
