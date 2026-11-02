# Phase 3.9: dark mode and small fixes (plan, 2026-09-25)

**Status:** done 2026-09-26 (slices 0 to 18). PR #52 (`theme-and-ui-changes`, `c09c6a2`). Final state at the dark-mode gate: backend 244, frontend 696, e2e 34. The live spec is `.context/features/theme-and-language.md`.

**Decisions kept:** D1 to D4 and D6 to D9 in the spec (OS preference as the start value and not saved; theme in the user row and `localStorage`; URL handoff `?lng=&theme=`; precedence URL, browser, OS; login sends the theme only if the user chose one; `data-theme` attribute; inline no-flash script). Code cites D1, D6 and D7 (`lib/theme.ts`, `schema.ts`).

**Plan versus built:**
- D5 (small fixes) was empty at the start. The user's list became slices 11 to 18 (404 theme switch, `<html lang>`, form-row alignment, validation messages, sidebar expand flicker, dirty state after removing a translation, Review cell dialog title, and more).
- A code-scanning alert on `landing/app.js` was fixed on 2026-09-25.

**Traps:** the landing and the app palettes are kept in sync by hand; `landing/Dockerfile` lists files by name, so a new JS file needs a COPY line.

**Open then:** ES, DE and EE drafts from slices 12, 14 and 15.

**Old text:** `git log -- .context/plans/phase-3-9-dark-mode.md`
