# System Specification & Feature Re-implementation Guide: Ladu

## 1. Project Purpose & High-Level Vision
**Ladu** is a multilingual web application designed specifically for polyglots and language learners to store, manage, centralize, and systematically practice vocabulary across multiple acquired languages simultaneously.

### 1.1 Core Problem & Problem Statement
* **The Retention Challenge:** When learning a new language, polyglots frequently struggle with retaining vocabulary from previously learned languages due to lack of active practice.
* **Limitations of Traditional Methods:** Traditional learning methods rely on flashcards or memorization paired almost exclusively with the user's native language. This leaves older acquired languages neglected, leading to rapid vocabulary decay.
* **Goal:** Instead of replacing traditional formal instruction, Ladu serves as an intelligent, central digital notebook and interactive practice suite that bridges vocabulary across all of a user's known/target languages at once.

### 1.2 Strategic UI/UX & Product Principles ("Design Commandments")
When redesigning and re-implementing the user interface and interaction flows, the agent must adhere to the following core principles that informed the original architectural and UX decisions:
1. **Effortless & Fast Entry:** Word creation and translation entry must be fast, intuitive, and highly frictionless to prevent user fatigue during vocabulary logging.
2. **Non-Intrusive Social Features:** Social capabilities (sharing collections, following public content, friending) must remain completely optional. The core loop (vocabulary management & exercises) must be fully functional for solo offline-style usage.
3. **Unobstructed Access to Core:** Never complicate or bury access to the core dictionary/word management module.
4. **Equal Language Representation:** Display all translations of a word equitably without arbitrarily prioritizing one language over another (e.g., avoid hardcoding English/Spanish as primary unless specified by the user).
5. **Linguistic Precision:** Forms and data fields must capture detailed grammatical nuances (gender, conjugations, declensions, irregularities) per language without overwhelming the interface.
6. **Data-Driven Feedback Loop:** Every piece of stored linguistic data should feed directly into personalized practice algorithms, progress insights, and visual statistics.
7. **Transparent Master & Progress Tracking:** Users should always easily understand the status of their vocabulary mastery and exercise performance.

Supported languages: **EN, ES, DE, EE** (English, Spanish, German, Estonian). A Word needs translations in **≥2 languages**.

---

## 2. Domain Data Model & Conceptual Architecture
To design an effective UI/UX, the agent must understand the underlying relationships between Entities in Ladu:

* **User (`User`):** Stores account information, native language (`nativeLanguage`), UI language preference (`uiLanguage`), active learning languages (`languages`), and friend connections (`Friendship`).
* **Word (`Word`):** The master logical concept for a single term (e.g., "to dance").
  * Belongs to a specific **Grammatical Category (`partOfSpeech`)**: `Noun`, `Verb`, `Adjective`, or `Adverb`.
  * Contains a collection of **Translations (`Translation`)**.
  * Contains optional user hints (`clue`) and metadata tracking if it was cloned/copied from another user (`isCloned`, `originalCreator`).
* **Translation (`Translation`):** Language-specific entry attached to a `Word` (e.g., Spanish: *bailar*, German: *tanzen*).
  * Consists of specific grammatical **Cases (`Case`)** (e.g., simple present 1st person, gerund, participle, gender).
* **Tag (`Tag`):** Categorization labels created by users to group words (e.g., "Chapter 1 Vocabulary", "Medical Terms").
  * Tags carry visibility settings: `Private`, `Public`, or `Friends-Only`.
  * Tags can be followed or cloned directly into another user's dictionary.
* **Exercise Performance (`ExercisePerformance` / `CaseStat`):** Historical record tracking answer correctness per user and per specific translation case (using continuous score calculations, 4-tier recent history, and spaced repetition decay algorithms).

### Logical Data Architecture
The application leads with a hierarchical data structure designed to represent a single concept across multiple languages with high grammatical precision.

**The "Word" hierarchy:**
1. **Word (Container):** Represented by `WordData`. This is the top-level anchor for a concept. It stores global metadata like `partOfSpeech` (e.g., Noun, Verb) and associated `tags`.
2. **Translation (`TranslationItem`):** A `Word` contains an array of translations. Each `TranslationItem` is bound to a specific `Lang` (enum: EN, ES, DE, EE).
3. **Cases (`WordItem`):** Within a translation, data is stored as an array of `WordItem` objects. Each item maps a grammatical `caseName` to its actual string value (`word`).
4. **Enums (The Logic Glue):** Strict TypeScript enums (`NounCases`, `VerbCases`, etc.) define the valid `caseName` keys. These enums ensure that an Estonian Noun has different required fields than a Spanish Noun, maintaining data integrity across the system.

**Visual representation:** `Word` → `[Translations]` → `[Cases (caseName + value)]`

### Core Logic & Workflow
* **Dynamic Entry:** The frontend generates forms dynamically. Selecting a "Noun" in "German" will trigger different input fields than an "Adverb" in "English" based on the `caseName` enums.
* **The "Word-Translation" Relationship:** A single `Word` ID acts as a bridge. If a user adds "Apple" (EN), "Manzana" (ES), and "Omena" (EE), they are all linked to one `Word` entry.
* **Exercise Engine:** The system retrieves words and their translations to generate various test types (Flashcards, Multiple Choice). It uses `ExercisePerformance` data to prioritize words based on mastery and "aging".
* **Social Layer:** Users can follow friends and access public Tags, allowing for collaborative vocabulary building.

---

## 3. Comprehensive Feature Requirements & Workflows

### 3.1 User Account & Authentication Management
* **Account Registration & Email Verification:** Standard signup with username, email, and password. Requires email verification before full system access.
* **Session Persistence:** Persistent login state (valid for 30 days) across browser sessions.
* **Password Recovery:** Standard token-based password reset via email link.

### 3.2 Central Vocabulary Management (Word Repository)
This is the core workspace of the application.

#### 1. Detailed Word & Translation Creation
* **Multi-Language Forms:** To create a word, the user must provide translations in at least **2 active languages**.
* **Grammatically Adaptive Forms:** The input fields dynamically alter depending on the chosen `partOfSpeech`:
  * **Verbs:** Infinitive, gerund, participle, indicative tenses (present, past imperfect, past perfect, future) across 1st, 2nd, 3rd person singular and plural. Includes regularity flags.
  * **Nouns:** Word form, gender (masculine, feminine, neuter), plural forms, article specifications.
  * **Adjectives & Adverbs:** Base forms, comparative/superlative forms, or specific syntactic cases where applicable.
* **Auto-Completion Engine:** UI provides an **Auto-complete** button leveraging natural language generation rules (e.g., RosaeNLG rulesets) to automatically generate verb conjugations or noun genders based on the base infinitive/lemma, dramatically cutting down user typing effort.

#### 2. Word & Translation Views
* **Master Table / Grid View (Listado):** 
  * Displays vocabulary in a tabular format where rows represent `Words` and columns represent `Active Languages`.
  * Allows interactive sorting, searching, and filtering by `partOfSpeech`, `Tag`, language presence, or text query.
  * Single cell clicks trigger a quick-edit drawer/modal for that specific language's translation form.
* **Full Word Inspector:** A dedicated view showing all translations of a word side-by-side with complete expanded grammatical breakdowns (e.g., full conjugation grids).

#### 3. Word Editing & Deletion
* **Inline / Full Editing:** Users can update any translation case field, add missing languages to an existing word, or alter associated `Tags`.
* **Structural Restrictions:** `partOfSpeech` cannot be altered once created. Words must always retain at least 2 language translations.
* **Permissions:** Users can edit or delete only words they authored. Words accessed via "followed" tags are read-only.

---

### 3.3 Tag & Collection Management

#### 1. Creation & Visibility Controls
* Users create tags with a `label`, `description`, and explicit visibility setting:
  * **Private:** Visible and usable only by the author.
  * **Friends-Only:** Discoverable and copyable only by confirmed friends.
  * **Public:** Visible to all platform users.

#### 2. Social Tag Actions
* **Follow Tag:** Enables a user to subscribe to another user's public/friends tag. Words appear in their list and exercise pool in **read-only** mode.
* **Clone Tag:** Copies all words and translations inside the target tag directly into the user's personal dictionary. Cloned words become independent copies that the user can freely edit or delete.

---

### 3.4 Interactive Exercise & Spaced-Repetition System
The key differentiator of Ladu is generating dynamic multi-language exercises directly from user-stored data.

#### 1. Exercise Generation & Target Selection
Exercises can be initiated in two modes:
1. **Pre-selected Words Mode:** Initiated directly from the Word Table view by checking specific words.
2. **Random/Automated Mode:** System selects words based on customizable user parameters.

#### 2. Exercise Configuration Parameters
When starting a practice session, the UI must allow configuring:
* **Active Target Languages:** Select which language pairs to include in the current session.
* **Grammatical Categories (`partOfSpeech`):** Filter by Verbs, Nouns, Adjectives, or Adverbs.
* **Exercise Card Types:**
  * **Text Input (Campo de Texto):** Prompt displays a word/case in one language; user types the exact translation in the target language.
  * **Multiple Choice (Opción Múltiple):** Prompt displays a term; user selects from 3-4 options.
  * **Random / Mixed:** Dynamically alternates between card types.
* **Language Cardinality per Card:**
  * **Multi-Language:** Prompt in Language A -> Answer in Language B.
  * **Single-Language:** Prompt is a grammatical description/case in Language A -> Answer in Language A (e.g., Conjugate *bailar* in 1st Person Present).
* **Native Language Inclusion:** Option to exclude exercises testing into or from the user's native language.
* **Sorting & Spaced-Repetition Algorithms:**
  * **Exercise-Performance (Adaptive):** Prioritizes words/cases with lower knowledge scores or those due for review according to Ebbinghaus' spaced repetition memory decay curve.
  * **Random Selection:** Purely random word sampling.
* **Difficulty Levels:**
  * **Multiple Choice Distractor Levels (Level 0 - Level 3):** Level 0 picks random incorrect terms across different parts of speech; Level 3 picks closely related forms/conjugations of the same part of speech or similar tense to challenge mastery.
  * **Text Input Strictness Levels:** Controls fuzzy matching tolerances for accent marks, capitalization, or slight spelling variations.

#### 3. Exercise Evaluation & Manual Mastery Overrides
* **Real-time Feedback:** Shows instant pass/fail state and reveals exact target forms upon submission.
* **Historical Accuracy Indicators:** Displays recent performance history (last 4 attempts indicator: thumbs up/down visual indicators with percentage score).
* **Manual Modifiers (Overrides):**
  * **Mastered (`master`):** Flags translation as fully memorized, preventing it from appearing in frequent review queues.
  * **Revise (`revise`):** Flags translation for immediate high-priority practice.

---

### 3.5 Social Features & Notifications

* **Friend System:** Search users by username, send friend requests, accept/reject requests, and block users.
* **Notification System:**
  * Real-time polling/updates for incoming friend requests and tag-sharing invites.
  * Unread badge counters and notification management panel (mark as read / dismiss).

---

### 3.6 Analytics & User Dashboard (Stats)
A visual dashboard providing immediate insight into portfolio distribution and progress:
* **Vocabulary Breakdown Charts:** Donut/Bar charts categorizing total words by language and `partOfSpeech`.
* **Growth Timeline:** Visual graphs tracking vocabulary additions and practice activity over time.
* **Mastery Metrics:** Percentage distributions of mastered terms vs. terms requiring review.

---

## 4. UI/UX Design Guidelines for the AI Design Agent

When redesigning Ladu's UI/UX, prioritize the following layout & component structures:

1. **Adaptive Multi-Language Forms:**
   * Design input components that clean up dense grammatical data (e.g., grouped collapsible accordion sections or tabular form matrices for verb tenses).
   * Include prominent, ergonomic trigger buttons for **Auto-complete** near base forms.
2. **Dense Data Presentation (Word List View):**
   * Responsive data tables with horizontal scrolling or adaptive column hiding for multi-language display.
   * Quick action drawers for inline translation edits without total context switching.
3. **Focused Exercise Flow:**
   * Clean, distraction-free flashcard/question cards.
   * High visibility for grammar prompts (person, tense, case, gender).
   * Clear, accessible manual feedback triggers (`Mastered` / `Revise` quick buttons).
4. **Intuitive Tag Visibility Badges:**
   * Visual indicators for `Public`, `Private`, and `Friends-Only` states on tags and list items.

---
*Note: This technical requirement document synthesizes the domain rules, functional workflows, data structures, and operational behaviors of the Ladu platform for UI/UX redesign.*
