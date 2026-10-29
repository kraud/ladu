# 01 — Principles and tone

Ladu is a vocabulary manager for **polyglots**. These people speak several languages and want to keep all of them alive. The interface must feel like a good dictionary and a calm workbench: precise, quiet, and fast.

The seven rules below come from `.context/overview.md` §1.2. Each rule is turned into UI behaviour.

## The seven rules in UI terms

| # | Rule | What it means when you design | Seen in |
|---|---|---|---|
| 1 | Word entry is fast and frictionless | Start with one text field. Offer type-ahead. Fill the other languages for the user. Never open with a long form. | `app-add-word-typeahead.png` |
| 2 | Social features are optional | The solo loop (words → practice) must work with no tags shared, no friends. Social badges are small and secondary. | `app-tags.png` |
| 3 | Never bury the core dictionary | "words" is always one click away in the header. No flow may hide it. | header in every app screen |
| 4 | All languages shown equally | Same size, same weight, same order logic for every language. Never mark EN or ES as "main". Use the account's order. | `app-words.png`, `app-word-detail.png` |
| 5 | Show grammar without overwhelming | Group by tense and mood. Use small caps labels, collapse cards, show only the forms that apply. | `app-add-word-draft.png`, `app-word-detail.png` |
| 6 | Every stored datum feeds practice and stats | When you add a field, ask where practice or stats use it. Show that link when you can (counts, rings, dots). | `app-dashboard.png`, `app-practice-feedback.png` |
| 7 | Progress is always legible | Show mastery with a visible mark: dots, ring, percent, last-practised date. Never hide it behind a click. | `app-practice-feedback.png` |

## Personality

| Trait | In the UI | Not |
|---|---|---|
| **Scholarly** | Serif titles. Mono for small facts. Generous space around words. | Playful fonts. Mascots. |
| **Calm** | Flat surfaces. 1px borders. Little motion. One blue. | Gradients. Heavy shadows. Confetti. |
| **Precise** | Tabular numbers. Exact labels ("3rd person singular"). | Vague words ("stuff", "things"). |
| **Multilingual by default** | Flags and language names next to every translation. | A hard-coded EN/ES pair. |
| **Encouraging, not loud** | Short success text, a green check, a filled dot. | Exclamation marks, streak guilt. |

## Voice for interface text

- Use short, direct sentences. One idea per sentence.
- Use sentence case: "New word", not "New Word".
- Use the verb on buttons: "Create tag", "Save word", "Start session".
- Say what happens: "The demo lasts a few minutes. When it ends, all your changes are deleted."
- Use "you" for the user. Do not use "we" for the product except in onboarding ("We'll add a mix of words").
- Write every string in the i18n files (`frontend/public/locales/<lang>/`). Never put visible text in a component.
- Supported UI languages: English, Español, Deutsch, Eesti, Français. Text must fit the longest language. German and Estonian are often the longest.

## Decision filter

Before you add a new UI element, ask:

1. Does a pattern in `05-components.md` already do this? **Reuse it.**
2. Does it help the user add, find, practise or understand a word? If not, remove it.
3. Does it work in light mode, dark mode, at 375px wide, and in all five languages?
4. Is its state clear (loading, empty, error, success)? See `06-icons-motion-states.md`.
