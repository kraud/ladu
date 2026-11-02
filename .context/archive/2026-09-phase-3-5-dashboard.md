# Phase 3.5: dashboard and user metrics (plan, 2026-09-16)

**Status:** done 2026-09-16 (slices 0 to 7). PR #4 (`dashboard-metrics`, `7a4588c`). Final state: backend 175, frontend 611, e2e 12. Changed 2026-10-23 and 2026-10-24 (unpracticed words). The live spec is `.context/features/dashboard.md`.

**Decisions kept:** M-1 to M-9 in the spec (bar chart toggles with no backend change; hand-rolled SVG and no chart library; three stat cards; local toggle state; i18n titles win over mockup copy; part-of-speech series; worst-category link; 12-month window filled on the client; units per X mode).

**Plan versus built:**
- D10 of the plan ("no languages" shows a dash and a link) is gone: the third card now counts unpracticed words, not incomplete words.
- The build plan said "code-split the charts". With no chart library there is nothing to split (decision recorded, not built).
- The brief asked to read the old `UserMetrics.tsx`. It is not on disk. The controls were rebuilt from the snapshot and the translated i18n keys.

**Traps:** `<Select.Value>` shows the raw value without a label mapper; `SegmentedToggle` `allowDeselect` must default to `true`; month data is server-local on a `timestamp without time zone` column.

**Open then:** ES, DE and EE texts of `userInfoCards.*`.

**Old text:** `git log -- .context/plans/phase-3-5-dashboard-metrics.md`
