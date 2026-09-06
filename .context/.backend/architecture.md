This is an overview of the `backend/` directory for the Keelapp project. The backend is a **Node.js/Express** application using **MongoDB (Mongoose)** for data storage, following a standard MVC-like pattern (Models, Routes, Controllers).

### 📂 Directory Structure Overview

```text
backend/
├── api/                # Entry point (Express app)
├── config/             # Configuration (DB connection)
├── controllers/        # Business logic (Feature-specific)
│   └── intermediary/   # Logic for junction/relationship models
├── middleware/         # Express middleware (Auth, Error handling)
├── models/             # Mongoose schemas
│   └── intermediary/   # Relationship schemas (Tag-Word, User-Tag)
├── routes/             # API endpoint definitions
├── utils/              # Helpers (Emailing, Translation mappings)
│   ├── equivalentTranslations/ # Rules for matching cases across languages
│   └── resources/      # Email templates and assets
└── vercel.json         # Deployment configuration
```

---

### 📄 Detailed File Breakdown

#### **Core Setup**
*   **`api/index.js`**: The main entry point. Configures Express, CORS, middleware (JSON/URL-encoded), connects to MongoDB, and mounts all feature routes.
*   **`config/db.js`**: Handles the connection logic to MongoDB using Mongoose.
*   **`vercel.json`**: Configures the serverless deployment for Vercel, rewriting all requests to the `/api` entry point.

#### **Models (Data Structure)**
*   **`models/userModel.js`**: Stores user profiles (name, email, password, target/UI/native languages).
*   **`models/wordModel.js`**: The core data unit. Stores a word, its Part of Speech (PoS), and an array of translations (each containing multiple grammatical cases).
*   **`models/tagModel.js`**: Stores tag metadata (label, author, visibility: Public/Private/Friends-Only).
*   **`models/notificationModel.js`**: Stores user notifications (friend requests, shared tags).
*   **`models/friendshipModel.js`**: Manages relationships between two users and their status (pending/accepted).
*   **`models/exercisePerformanceModel.js`**: Tracks user mastery of specific word cases (knowledge percentage, records of success/failure).
*   **`models/tokenModel.js`**: Temporary tokens for email verification and password resets.
*   **`models/intermediary/tagWordModel.js`**: Junction model linking Tags to Words.
*   **`models/intermediary/userFollowingTagModel.js`**: Junction model linking Users to Tags they follow.

#### **Controllers (Business Logic)**
*   **`controllers/wordController.js`**: CRUD for words; complex filtering (by PoS, gender, tags) and simplified data views for tables.
*   **`controllers/tagController.js`**: Management of tags; includes logic for cloning external tags, bulk-assigning tags to words, and tag discovery.
*   **`controllers/exerciseController.js`**: The most complex logic; generates practice sessions based on parameters (Single-Lang vs Multi-Lang, Multiple-Choice vs Text-Input), sorting words by "aged" knowledge levels.
*   **`controllers/exercisePerformanceController.js`**: Saves results from exercises, calculates the "forgetting curve" (aging), and determines current knowledge percentages.
*   **`controllers/userController.js`**: Handles registration, login (JWT), profile updates, and email verification.
*   **`controllers/autocompleteTranslationController.js`**: Interfaces with external APIs (like the Estonian Lang API) and internal libraries to automatically generate grammatical cases for verbs/nouns during word creation.
*   **`controllers/notificationController.js`**: Logic for sending and dismissing notifications.
*   **`controllers/friendshipController.js`**: Logic for creating, accepting, and deleting friend requests.
*   **`controllers/metricController.js`**: Uses MongoDB aggregation facets to calculate dashboard stats (words per month, PoS distribution, etc.).

#### **Routes (Endpoints)**
*   All files in **`routes/`** map HTTP methods and paths to the corresponding controller functions, most being wrapped in the `protect` middleware to ensure the user is authenticated.

#### **Utilities & Helpers**
*   **`middleware/authMiddleware.js`**: Extracts and verifies JWT from headers, attaching the user object to `req`.
*   **`middleware/errorMiddleware.js`**: Standardized JSON error response handler.
*   **`utils/sendEmail.js`**: Orchestrates sending system emails (verification/reset) using Nodemailer.
*   **`utils/equivalentTranslations/`**: Contains "Grouped Categories" which act as mapping tables. They tell the `exerciseController` which cases in Language A (e.g., Nominative) correspond to which cases in Language B (e.g., Nominative) for nouns and verbs.
