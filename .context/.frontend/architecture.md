# Frontend Context

## Overview

Ladu is a multi-language vocabulary learning app (React + TypeScript + Redux). Users add words with translations across 4 languages (English, Spanish, German, Estonian), organize them into tags, and practice via exercises. The frontend proxies to `localhost:5000`.

## Tech Stack

- **Framework**: React 18, Create React App, TypeScript 4.7
- **State**: Redux Toolkit (10 slices)
- **UI**: MUI v5, emotion/styled, framer-motion (page transitions)
- **Forms**: react-hook-form + yup validation
- **Tables**: @tanstack/react-table
- **Charts**: c3 (D3-based)
- **i18n**: i18next + http-backend + browser-language-detector
- **Drag & Drop**: @dnd-kit
- **HTTP**: axios
- **Notifications**: react-toastify
- **Icons**: react-icons, MUI icons

---

## Directory Tree

```
frontend/
├── package.json              # Dependencies & scripts (start/build/test/eject)
├── tsconfig.json             # TypeScript config: target ES2016, jsx: react, strict
├── README.md                 # CRA + Redux template docs
│
├── public/                   # Static assets
│   ├── index.html            # HTML shell, Google Fonts (Roboto, Bigelow Rules)
│   ├── manifest.json         # PWA manifest
│   ├── favicon.png / logo192.png
│   ├── *.svg                 # Country flags (AQ, DE, EE, ES, GB)
│   ├── icon-*.png / LOGO-*   # App icons and logo variants (horizontal/vertical, blue/white/border/filled)
│   ├── robots.txt
│   └── locales/              # i18n translation JSON files per language
│       ├── en/               # English (11 namespaces)
│       ├── es/               # Spanish translations
│       ├── de/               # German translations
│       └── ee/               # Estonian translations
│
└── src/                      # Application source
    ├── index.tsx             # Entry point: renders App with Redux Provider, ThemeProvider, BrowserRouter, Suspense
    ├── App.tsx               # Root component: CssBaseline, Container, MainView, ToastContainer
    ├── i18n.ts               # i18next init with backend + language detector (supports en/es/de/ee)
    │
    ├── app/
    │   └── store.tsx         # Redux store with 10 reducers (auth, user, words, notifications, friendships, tags, metrics, autocompletedTranslations, exercises, exercisesPerformance)
    │
    ├── ts/                   # Shared TypeScript types/enums
    │   ├── enums.ts          # NounCases, VerbCases, AdjectiveCases, AdverbCases, Lang, PartOfSpeech, Pronouns, Grammatical enums per language
    │   ├── interfaces.ts     # WordData, TranslationItem, UserData, NotificationData, FriendshipData, TagData, Exercise types, FilterItem, PerformanceStats, etc.
    │   └── wordCasesDataByPoS.ts  # Data structures mapping case names to languages/PoS (NounCasesData, VerbCasesData, etc.)
    │
    ├── theme/
    │   ├── theme.ts          # MUI theme customization (allWhite palette, Container maxWidth override)
    │   └── chartsColors.ts   # Color map for chart categories (by PoS and language)
    │
    ├── common/
    │   └── AuthVerify.tsx     # JWT expiry checker: parses token on route change, fires onLogOut if expired
    │
    ├── hooks/
    │   ├── useInterval.tsx    # setInterval hook with optional immediate-first-run
    │   └── useFollowUnfollowTag.tsx  # Tag follow/unfollow logic hook
    │
    ├── features/             # Redux feature slices (each has a Service and a Slice)
    │   ├── auth/
    │   │   ├── authService.ts    # Login/register/logout API calls
    │   │   └── authSlice.ts      # Auth state: user, isLoading, isError, message; handles login/register/logout/updateUser
    │   ├── words/
    │   │   ├── wordService.ts    # CRUD for words, search, autocomplete
    │   │   └── wordSlice.ts      # Words state: list, search results, selected PoS, CRUD thunks
    │   ├── tags/
    │   │   ├── tagService.ts     # CRUD for tags, search, follow/unfollow
    │   │   └── tagSlice.ts       # Tags state: list, search results, CRUD thunks
    │   ├── exercises/
    │   │   ├── exerciseService.ts    # Fetch exercises (translations for practice)
    │   │   └── exerciseSlice.ts      # Exercise state: exercise list, settings, selected words
    │   ├── exercisePerformance/
    │   │   ├── exercisePerformanceService.ts  # Save exercise results, performance actions (master/forget)
    │   │   └── exercisePerformanceSlice.ts    # Performance tracking state
    │   ├── notifications/
    │   │   ├── notificationService.ts     # Get/dismiss/accept friend requests, tag shares
    │   │   └── notificationSlice.ts       # Notification state
    │   ├── friendships/
    │   │   ├── friendshipService.ts   # Send/accept/block friendships
    │   │   └── friendshipSlice.ts     # Friendships state
    │   ├── users/
    │   │   ├── userService.ts     # Get/update user data
    │   │   └── userSlice.ts       # User state (other users)
    │   ├── metrics/
    │   │   ├── metricService.ts       # Fetch user stats (word counts, translation counts)
    │   │   └── metricSlice.ts         # Metrics state
    │   └── autocompletedTranslation/
    │       ├── autocompletedTranslationService.ts  # Auto-fill translation forms via external API
    │       └── autocompletedTranslationSlice.ts    # Autocomplete state
    │
    ├── components/            # Reusable UI components
    │   ├── Header.tsx         # ResponsiveAppBar: nav (AddWord, Practice, Review), search (words/tags), user menu, UI language switcher, notification badge
    │   ├── LaduLogo.tsx       # Ladu logo component (variant/color/direction props)
    │   ├── LoadingScreen.tsx   # Full-page loading spinner
    │   ├── Spinner.tsx        # MUI LinearProgress wrapper
    │   ├── SpinningText.tsx   # Animated spinning text
    │   ├── StyledSwitch.tsx   # MUI switch styled for word/tag search toggle
    │   ├── UserBadge.tsx      # User avatar + info display
    │   ├── ConfirmationButton.tsx   # Button with confirmation dialog
    │   ├── ConfirmationModal.tsx    # Generic confirmation modal
    │   ├── FriendSearchModal.tsx    # Modal for searching/adding friends
    │   ├── TagInfoModal.tsx         # Modal showing tag details
    │   ├── ImageCarousel.tsx        # Image carousel component
    │   ├── TextInputFormHook.tsx    # TextField wrapped with react-hook-form
    │   ├── SelectFormHook.tsx       # Select wrapped with react-hook-form
    │   ├── CheckboxGroupFormHook.tsx # Checkbox group with react-hook-form
    │   ├── RadioGroupFormHook.tsx   # Radio group with react-hook-form
    │   ├── AutocompleteSearch.tsx   # Debounced autocomplete search input
    │   ├── AutocompleteMultiple.tsx # Multi-select autocomplete for tags/filters
    │   ├── PartOfSpeechSelector.tsx # Part-of-speech radio selector
    │   ├── ExerciseParameterSelector.tsx # Exercise type/amount/language configuration
    │   ├── ExerciseCard.tsx    # Main practice card: shows translation question, handles Multiple-Choice & Text-Input answers, performance tracking (master/forget), streak/progress bar
    │   ├── WordForm.tsx        # Full word creation/editing form: PoS selector, language selection, translation forms, tags, clue, save/delete
    │   ├── TranslationFormGeneric.tsx   # Single-language translation form: language selector flag-borders, delegates to WordFormSelector
    │   ├── WordSimpleList.tsx  # Simple list display of words
    │   ├── TableFilters.tsx    # Filter controls for tables (tags, PoS, gender)
    │   ├── DnDLanguageOrderSelector.tsx # Drag-and-drop language ordering
    │   ├── DnDSortableItem.tsx # Sortable item wrapper for DnD
    │   ├── GeneralUseComponents.tsx  # Misc shared components: CountryFlag, UserChip, TagChip, SearchResultItem, triggerToastMessageWithButton
    │   ├── generalUseFunctions.ts    # Utility functions: language helpers, stringAvatar, chip fields, pronouns, deterministicSort, getAllIndividualTagDataFromFilterItem
    │   │
    │   ├── exercises/
    │   │   ├── EndScreen.tsx    # Exercise session results/statistics
    │   │   └── ResultRow.tsx    # Single result row in exercise summary
    │   │
    │   ├── charts/
    │   │   ├── C3Chart.tsx      # Generic C3 chart wrapper
    │   │   ├── BarChart.tsx     # Bar chart component
    │   │   ├── PieChart.tsx     # Pie chart component
    │   │   ├── UserInfoCard.tsx # User info card for dashboard
    │   │   ├── UserInfoPanel.tsx # User stats panel for dashboard
    │   │   └── UserMetrics.tsx  # Metrics display component
    │   │
    │   ├── table/
    │   │   ├── TranslationsTable.tsx    # @tanstack/react-table based translations table with sorting, filtering, column visibility
    │   │   ├── DebouncedTextField.tsx   # Debounced text field for table filters
    │   │   ├── ExtraTableComponents.tsx # Extra table UI (column toggle, filter reset)
    │   │   └── columns/
    │   │       └── ReviewTableColumns.tsx  # Column definitions for the review table
    │   │
    │   └── forms/              # Language-specific word forms (by PoS + language)
    │       ├── WordFormSelector.tsx  # Routes to correct form based on PoS + Lang
    │       ├── commonFunctions.ts    # Shared form helpers (getWordByCase, validation, field display logic, iteration gating)
    │       ├── autocompleteFormFunctions.ts # Auto-fill logic for Estonian word forms via external API
    │       ├── AutocompleteButtonWithStatus.tsx  # Button showing autocomplete status (query/match/partial/no-match)
    │       ├── nouns/
    │       │   ├── NounFormEN.tsx    # English noun form
    │       │   ├── NounFormES.tsx    # Spanish noun form (gender, singular, plural, regularity)
    │       │   ├── NounFormDE.tsx    # German noun form (gender, 4 cases, singular/plural)
    │       │   └── NounFormEE.tsx    # Estonian noun form (3 cases, singular/plural, short form)
    │       ├── verbs/
    │       │   ├── VerbFormEN.tsx    # English verb form (all tenses, all pronouns)
    │       │   ├── VerbFormES.tsx    # Spanish verb form (indicative, subjunctive, imperative tenses)
    │       │   ├── VerbFormDE.tsx    # German verb form (present, perfect, future, past, aux, prefix)
    │       │   └── VerbFormEE.tsx    # Estonian verb form (kindel present/past/perfect)
    │       ├── adjectives/
    │       │   ├── AdjectiveFormEN.tsx   # English adjective (positive/comparative/superlative)
    │       │   ├── AdjectiveFormES.tsx   # Spanish adjective (gender + number forms)
    │       │   ├── AdjectiveFormDE.tsx   # German adjective (positive/komparativ/superlativ)
    │       │   └── AdjectiveFormEE.tsx   # Estonian adjective (3 degrees + plural + cases)
    │       ├── adverbs/
    │       │   ├── AdverbFormEN.tsx  # English adverb (positive/comparative/superlative)
    │       │   ├── AdverbFormES.tsx  # Spanish adverb (positive/comparative/superlative)
    │       │   └── AdverbFormDE.tsx  # German adverb (gradable/adverb/comparative/superlative)
    │       └── tags/               # Tag-related form components
    │
    └── pages/                 # Page-level components
        ├── Login.tsx            # Login form
        ├── Register.tsx         # Registration form
        ├── VerificationUser.tsx # Email verification handler
        ├── ResetPassword.tsx    # Password reset form
        ├── Dashboard.tsx        # Main dashboard (word/translation counts, charts, user info)
        ├── AddWord.tsx          # Add/edit word page (wraps WordForm)
        ├── DisplayWord.tsx      # View word details (read-only mode)
        ├── DisplayTag.tsx       # View tag details (read-only mode)
        ├── Practice.tsx         # Practice/exercise page (wraps ExerciseCard + ExerciseParameterSelector)
        ├── Review.tsx           # Review/edit existing translations (table-based)
        ├── Account.tsx          # User account settings (languages, profile, preferences)
        ├── NotificationHub.tsx  # Notification center (friend requests, tag shares)
        ├── LoadingScreen.tsx    # Loading screen component
        ├── NotFound.tsx         # 404 page with option to hide header
        │
        └── management/     # App shell components
            ├── MainView.tsx        # Main layout: toolbar conditional display, route rendering, notification polling, UI language sync
            ├── RoutesWithAnimation.tsx  # Route definitions with framer-motion animated transitions
            └── LocationProvider.tsx     # AnimatePresence wrapper for route animations

---

## Routing (React Router v6)

| Path                     | Component         | Description                          |
|--------------------------|-------------------|--------------------------------------|
| `/`                      | Dashboard         | Home / stats dashboard               |
| `/addWord/:partOfSpeech?`| AddWord           | Add or edit a word                   |
| `/review/:filtersURL?`   | Review            | Review translations table (iteration gated) |
| `/practice`              | Practice          | Exercise/practice mode               |
| `/login`                 | Login             | Login page (no toolbar)              |
| `/register`              | Register          | Register page (no toolbar)           |
| `/resetPassword/:userId?/:tokenId?` | ResetPassword | Password reset (no toolbar)  |
| `/user`                  | Account           | User account settings                |
| `/user/:userId?/notifications` | NotificationHub | Notification center         |
| `/user/:userId?/verify/:tokenId?` | VerificationUser | Email verification (no toolbar) |
| `/word/:wordId?`         | DisplayWord       | View word details                    |
| `/tag/:tagId?`           | DisplayTag        | View tag details (iteration gated)   |
| `*`                      | NotFound          | 404 page                             |

---

## State Management (Redux Slices)

All slices follow a pattern: `{Service, Slice}` with createAsyncThunk for API calls.

| Slice                    | Key State                                 |
|--------------------------|-------------------------------------------|
| auth                     | user, isLoading, isError, message         |
| words                    | words, searchResults, selectedPoS         |
| tags                     | tags, searchResultTags                    |
| exercises                | exercises, exerciseSettings, selectedWords|
| exercisesPerformance     | performance, stats                        |
| notifications            | notifications, loading states            |
| friendships              | friendships list                         |
| users                    | other users data                         |
| metrics                  | word/translation counts                  |
| autocompletedTranslations| autocomplete results for word forms      |

---

## i18n Namespaces (per language)

Located in `public/locales/{lang}/`:
`common.json`, `dashboard.json`, `loginRegister.json`, `wordRelated.json`, `translation.json`, `review.json`, `practice.json`, `tags.json`, `friendship.json`, `notifications.json`, `caseDescription.json`

---

## Key Architectural Patterns

1. **Feature-based organization**: Each domain (auth, words, tags, etc.) is a self-contained feature with its own service (API calls) and slice (Redux state).
2. **Polymorphic word forms**: `WordFormSelector` routes to the correct language + PoS form component using a switch pattern.
3. **Iteration gating**: `checkEnvironmentAndIterationToDisplay(n)` controls feature visibility based on environment/iteration flags.
4. **Drag-and-drop**: Used for language ordering in user settings.
5. **Page transitions**: Framer Motion spring animations between routes.
6. **Performance tracking**: Exercises save per-translation performance data (correct/incorrect, time) and allow "master"/"forget" actions.
7. **Flag-styled form borders**: Translation forms display country-flag-colored borders using CSS gradients.
