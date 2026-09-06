# UI Spec 05 — Practice (`/practice`)

*Grounded in `snapshot/exercise-flow.md` (full parameter/card/performance spec) + `pages-review-practice.md` + `pages-word-flow.md` (WordSimpleList). One state machine: parameters → cards → results.*

---

## Phase 1 — Parameter menu (before "accept")

```
┌─────────────────────────────────────────────────────┐
│ Configure exercises                                  │
│ ┌─ Pre-selected words panel (only when arriving     │
│ │  from Review) ─────────────────────────────────┐  │
│ │ [word chips grouped by PoS, flag+translation]  │  │
│ └────────────────────────────────────────────────┘  │
│ Languages    [🇩🇪][🇪🇪][🇬🇧][🇪🇸]  (DnD order)        │
│ Type         (•) Noun  ( ) Verb ( ) Adj ( ) Adv     │
│ Amount       [ 10 ]                                  │
│ Card type    (•) Text-Input ( ) Multiple-Choice ( ) Random │
│ Multi-language (•) Single ( ) Multi ( ) Random      │
│ ▸ Advanced options (collapse)                        │
│    MC difficulty    [slider 0–3]  (disabled for TI)  │
│    TI difficulty    [slider 1–3]  (disabled for MC)  │
│    Word selection   (•) By performance ( ) Random    │
│    Native language  (•) Include ( ) Ignore           │
│              [Start practice]                       │
└─────────────────────────────────────────────────────┘
```

- **Pre-selected words panel**: when the user arrived from Review's "Create exercises", show the selected words as compact chips grouped by PoS (each chip: flag + primary-case word; tooltip = registered-cases count). PoS checkboxes are pre-constrained to the selected words' PoS set.
- **Sliders**: MC 0–3 (L0 any word-type/any language → L3 same word/same language/different cases); TI 1–3 (L1 ignore accents+caps → L3 exact). Slider labels/tooltip text via i18n.
- **Validation**: ≥1 PoS; amount = positive integer. Invalid → inline errors; Start disabled while generating (spinner).
- Difficulty defaults: MC=1, TI=2 (see `exercise-flow.md` §2).

## Phase 2 — Exercise cards

```
┌─────────────────────────────────────────────────────┐
│  7/10 · 72%          [progress bar colored by score] │
│ ┌─────────────────────────────────────────────────┐ │
│ │  🇬🇧 tree   (n.)                                 │ │
│ │  ────────────────────────────                   │ │
│ │  🇪🇪 [___________]                    [Check]    │ │
│ │  (or MC: 4 rounded option buttons)              │ │
│ │  [shortcut: per-case performance % + thumbs]    │ │
│ └─────────────────────────────────────────────────┘ │
│ [◀ Previous]                              [Next ▶]  │
└─────────────────────────────────────────────────────┘
```

- **Score header**: live "correct/total" + interpolated color (red→orange→green ramp).
- **Question**: prompt = `itemA` (flag + case chip like "n. singular" + the word). Verb prompts include the pronoun (person/plurality per language).
- **Text-Input**: single input; Enter or **Check** submits; readOnly after answering; difficulty rules from `exercise-flow.md` §5.2 (L1 accent/case-insensitive → "partially correct", L2 case-insensitive, L3 exact).
- **Multiple-Choice**: 4 option buttons (correct + distractors, deterministic order); after answering the chosen button turns green/red, others gray out; single-submit guarded.
- **Feedback**: toast immediately — "Correct ✅" / "Incorrect ❌ (answer: X)" / "Partially correct ⚠ (answer: X)". Partial counts as correct for the score.
- **Performance shortcuts**: a small % badge per case + 4 thumb-rating icons; **Master** / **Forget** buttons (AlertDialog confirm) — only enabled after answering.
- **Navigation**: Prev/Next chevrons; disabled while saving; forward navigation resets transient state; last card's Next → results.
- After the last answer the card auto-advances to results (current behavior: "Go to results" button when all answered).

## Phase 3 — Results (`EndScreen`)

```
┌─────────────────────────────────────────────────────┐
│  Results: 8/10 (80%)                                │
│ ▸ Parameters used (collapsible)                     │
│ ▸ Words practiced (collapsible, when pre-selected)  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ✓ 🇬🇧 tree → 🇪🇪 puu    n. singular    [Review]  │ │
│ │ ✗ 🇬🇧 run → 🇪🇸 correr  v. present 1s  [Review]  │ │
│ └─────────────────────────────────────────────────┘ │
│ [New practice session]                              │
└─────────────────────────────────────────────────────┘
```

- **Result rows**: green/red border + ✓/✗ icon; MC/TI type icon; itemA (+itemB when multi-language) with flags; the user's answer shown; PoS/case chips; **Review** button jumps back to that exact card (index-based jump, then Next returns to results).
- **New practice session** → resets everything to the parameter menu (keeps pre-selected words).

## States

- Generating: spinner while `getUserExercises` runs.
- No exercises matched: empty state ("No exercises could be created with these parameters") + "Adjust parameters" CTA.
- Guarded route (fixed): requires auth.

## Intentional deltas

- Unhandled performance-save errors (old desync bug) → surfaced via toast; navigation never desyncs card state.
- Amount validator accepts only true positive integers (old accepted `+1`).
