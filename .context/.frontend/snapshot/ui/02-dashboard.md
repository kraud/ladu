# UI Spec 02 — Dashboard (`/`)

*Grounded in `snapshot/pages-word-flow.md` (Dashboard entry) + `pages-review-practice.md` (charts, structure).*

---

## Purpose

Post-login landing: welcome + at-a-glance vocabulary stats with drill-down charts. Read-only.

## Layout

```
┌─────────────────────────────────────────────────┐
│ Welcome back, <name>                            │
│ <cycling greeting in EN→ES→DE→EE>               │  (auto-rotating text)
├──────────────────────┬──────────────────────────┤
│ User info panel      │  Metrics panel           │
│  [stat card] Words   │  [Pie: words per PoS]    │
│  [stat card] Transl. │  [Bar: per language/mo]  │
│  [stat card] Incompl.│  [toggle: PoS ↔ language]│
└──────────────────────┴──────────────────────────┘
```

- **Welcome banner**: "Welcome back, {name}" + an auto-cycling localized greeting (one line, rotates through the 4 UI languages every few seconds — CSS/JS interval, subtle).
- **Info panel** (left, ~1/3): stat cards — total words, total translations, incomplete-words count. Simple number + label cards in a vertical stack.
- **Metrics panel** (right, ~2/3): two charts (keep c3/D3 or swap for Recharts — visually equivalent):
  - **Pie**: words per part-of-speech, colors keyed by PoS (`chartsColors` mapping).
  - **Bar**: translations per language (and per month view); grouped-by toggle (by PoS / by language; by month / by language).
  - Each chart has a small toggle for its metric type (words ↔ translations).
  - Chart "worst category" click → `/addWord/<pos>` shortcut (keep).

## States

- Loading: skeleton cards + chart placeholders.
- Empty (new user, zero words): stat cards show 0; charts render an empty-state message "Add your first words to see statistics" with CTA → `/addWord`.

## Data

- `GET /api/metrics/getUserMetrics` on mount (single query; staleTime ~5 min; no invalidation edges except word CRUD → metrics).
