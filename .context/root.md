# Project Context: Ladu (Vocabulary Management System)

## 1. Overview & Purpose
**Ladu** is a multilingual web application designed for polyglots to centralize and practice vocabulary. Unlike traditional language apps that focus on translation pairs (e.g., English to Spanish), Ladu treats a "Word" as a single logical entity that can contain multiple translations across various languages simultaneously.

The goal is to prevent vocabulary loss by allowing users to manage complex linguistic data and generate automated exercises based on their personal library.

---

## 2. Monorepo Structure
The project is a **MERN** (MongoDB, Express, React, Node.js) stack application written in **TypeScript**.

### `/backend` (Server-side)
A Node.js/Express API that manages data persistence, business logic, and external API integrations.

*   **Tech Stack:** Node.js, Express, MongoDB/Mongoose, JWT, Nodemailer.
*   **Key Responsibilities:**
    *   **Data Models:** Manages complex relationships between Users, Words, Translations, Tags, and Exercise Performance.
    *   **Exercise Engine:** Generates practice sessions using "forgetting curve" logic and cross-language case mapping.
    *   **Linguistic Automation:** Interfaces with external APIs (e.g., Estonian Lang API) to auto-generate grammatical cases.
*   **Directory Overview:**
    ```text
    backend/
    ├── api/           # Entry point (Express app)
    ├── controllers/   # Business logic (Word CRUD, Exercise logic, Auth)
    ├── models/        # Mongoose schemas (Word, Translation, Tag, Performance)
    ├── routes/        # API endpoints
    └── utils/         # Helpers (Emailing, Translation mappings)
    ```

### `/frontend` (Client-side)
A React-based Single Page Application (SPA) designed for complex data entry and interactive learning.

*   **Tech Stack:** React 18, Redux Toolkit, MUI v5, Framer Motion, React Hook Form, TanStack Table, i18next.
*   **Key Features:**
    *   **Polymorphic Forms:** Dynamic word entry forms that adapt based on Part of Speech and Language.
    *   **State Management:** 10+ Redux slices managing everything from auth to exercise performance.
    *   **Visual Learning:** Integrated charts (C3.js/D3) for progress tracking and flag-themed UI components.
*   **Directory Overview:**
    ```text
    frontend/
    ├── src/
    │   ├── app/       # Redux store
    │   ├── features/  # Feature-based slices (auth, words, tags, etc.)
    │   ├── components/# Reusable UI & Complex Forms (Nouns, Verbs, etc.)
    │   ├── pages/     # Routed page components
    │   └── ts/        # Shared types and linguistic enums
    └── public/locales/# i18n translation files
    ```

---

## 3. Logical Data Architecture
The application leads with a hierarchical data structure designed to represent a single concept across multiple languages with high grammatical precision.

### The "Word" Hierarchy:
1.  **Word (Container):** Represented by `WordData`. This is the top-level anchor for a concept. It stores global metadata like `partOfSpeech` (e.g., Noun, Verb) and associated `tags`.
2.  **Translation (`TranslationItem`):** A `Word` contains an array of translations. Each `TranslationItem` is bound to a specific `Lang` (Enum: EN, ES, DE, EE).
3.  **Cases (`WordItem`):** Within a translation, data is stored as an array of `WordItem` objects. Each item maps a grammatical `caseName` to its actual string value (`word`).
4.  **Enums (The Logic Glue):** Strict TypeScript enums (`NounCases`, `VerbCases`, etc.) define the valid `caseName` keys. These enums ensure that an Estonian Noun has different required fields than a Spanish Noun, maintaining data integrity across the system.

### Visual Representation:
`Word` → `[Translations]` → `[Cases (CaseName + Value)]`

---

## 4. Core Logic & Workflow
* **Dynamic Entry:** The frontend generates forms dynamically. Selecting a "Noun" in "German" will trigger different input fields than an "Adverb" in "English" based on the `caseName` enums.
* **The "Word-Translation" Relationship:** A single `Word` ID acts as a bridge. If a user adds "Apple" (EN), "Manzana" (ES), and "Omena" (ET), they are all linked to one `Word` entry.
* **Exercise Engine:** The system retrieves words and their translations to generate various test types (Flashcards, Multiple Choice). It uses `ExercisePerformance` data to prioritize words based on mastery and "aging."
* **Social Layer:** Users can follow friends and access public Tags, allowing for collaborative vocabulary building.

---

## 5. Development Standards & Patterns
* **Language:** Documentation is in English/Spanish; code follows English naming conventions.
* **Security:** JWT-based authentication with `protect` middleware on the backend and `AuthVerify` component on the frontend.
* **Architecture:** Feature-based organization on the frontend; MVC-like pattern on the backend.
* **Data Consistency:** Strict TypeScript typing for linguistic enums (Languages, Parts of Speech, Grammatical Cases) across both tiers.
