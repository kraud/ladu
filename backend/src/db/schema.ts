const {
    pgTable,
    pgEnum,
    uuid,
    varchar,
    text,
    boolean,
    integer,
    real,
    timestamp,
    date,
    jsonb,
    primaryKey,
    uniqueIndex,
    index,
    check,
}: typeof import('drizzle-orm/pg-core') = require('drizzle-orm/pg-core');
const { relations, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
// Type-only import (erased at compile time) — needed to break the circular
// type inference a self-referencing FK's `.references(() => table.column)`
// callback would otherwise hit (`words.sourceWordId` -> `words.id`,
// `tags.sourceTagId` -> `tags.id`; phase-4-tags.md D11).
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums (typed domain values that were previously free-form varchar)
// ---------------------------------------------------------------------------
export const friendshipStatusEnum = pgEnum('friendship_status', [
    'pending',
    'accepted',
    'declined',
    'cancelled',
]);

export const tagVisibilityEnum = pgEnum('tag_visibility', [
    'Public',
    'Private',
    'Friends-Only',
]);

export const tagShareStatusEnum = pgEnum('tag_share_status', [
    'pending',
    'accepted',
    'declined',
]);

// ---------------------------------------------------------------------------
// Helper: shared timestamp columns used on most tables
// ---------------------------------------------------------------------------
const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
};

// ===========================================================================
// STAFF_ACCOUNTS
// Admin-dashboard staff logins (.context/plans/admin-dashboard.md §2). A
// separate table from `users` on purpose: a learner token can never open an
// admin route, and a staff account needs no vocabulary data. Staff are
// disabled (`disabledAt`), never deleted, so `audit_log` rows keep a valid FK.
// ===========================================================================
export const staffAccounts = pgTable('staff_accounts', {
    id:           uuid('id').primaryKey().defaultRandom(),
    // Stored lowercased; the unique constraint is therefore case-insensitive.
    email:        varchar('email', { length: 255 }).notNull().unique(),
    name:         varchar('name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    // 'owner' | 'admin' | 'support' | 'viewer' — the role -> permission map
    // lives in lib/adminPermissions.ts, so a new role needs no migration.
    role:         varchar('role', { length: 32 }).notNull(),
    disabledAt:   timestamp('disabled_at'),
    lastLoginAt:  timestamp('last_login_at'),
    // Slice 8: an account made or reset by an owner starts with a temporary
    // password the owner knows. Until the person sets their own, every admin
    // route except `me` and `change-password` answers 403 (requireStaff).
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    passwordChangedAt:  timestamp('password_changed_at'),
    // Carried in the staff JWT as `tv`. Raised on a password change or reset
    // and on disable, so older tokens stop working at once.
    tokenVersion: integer('token_version').notNull().default(0),
    ...timestamps,
});

// ---------------------------------------------------------------------------
// AUDIT_LOG
// One row per admin action: who did what, to what, and why. `targetId` is
// plain text with no FK, because the target can be a user that a purge later
// deletes; `metadata` keeps what would otherwise be lost (email, username).
// ---------------------------------------------------------------------------
export const auditLog = pgTable(
    'audit_log',
    {
        id:         uuid('id').primaryKey().defaultRandom(),
        // NULL = the system (the nightly purge job), which has no staff account.
        staffId:    uuid('staff_id').references(() => staffAccounts.id, { onDelete: 'restrict' }),
        // e.g. 'staff.login', 'user.ban'
        action:     varchar('action', { length: 64 }).notNull(),
        targetType: varchar('target_type', { length: 32 }),
        targetId:   varchar('target_id', { length: 64 }),
        reason:     text('reason'),
        metadata:   jsonb('metadata'),
        createdAt:  timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        index('audit_log_created_idx').on(table.createdAt),
        index('audit_log_target_idx').on(table.targetType, table.targetId),
        index('audit_log_staff_idx').on(table.staffId, table.createdAt),
    ],
);

// ---------------------------------------------------------------------------
// Access gates (.context/plans/access-gates.md): the owner switches registration
// and login between 'open', 'closed' and 'limited' with no deploy. ONE row
// (id fixed to 1); the migration inserts it with both modes 'open'. Read on
// each request that needs it — no cache, so a change works at once.
// ---------------------------------------------------------------------------
export const accessSettings = pgTable(
    'access_settings',
    {
        id:                integer('id').primaryKey().default(1),
        registrationMode:  varchar('registration_mode', { length: 16 }).notNull().default('open'),
        // Plain text shown under the translated banner; never markup, not translated.
        registrationNote:  varchar('registration_note', { length: 300 }).notNull().default(''),
        loginMode:         varchar('login_mode', { length: 16 }).notNull().default('open'),
        loginNote:         varchar('login_note', { length: 300 }).notNull().default(''),
        updatedAt:         timestamp('updated_at').defaultNow().notNull(),
        updatedByStaffId:  uuid('updated_by_staff_id').references(() => staffAccounts.id, { onDelete: 'set null' }),
    },
    () => [
        check('access_settings_single_row', sql`id = 1`),
        check('access_settings_registration_mode_check', sql`registration_mode IN ('open', 'closed', 'limited')`),
        check('access_settings_login_mode_check', sql`login_mode IN ('open', 'closed', 'limited')`),
    ],
);

// Emails allowed to register while registration is 'limited'. Stored lowercase
// (unique = case-insensitive). The row is deleted when that person registers.
export const registrationInvites = pgTable('registration_invites', {
    id:               uuid('id').primaryKey().defaultRandom(),
    email:            varchar('email', { length: 255 }).notNull().unique(),
    createdAt:        timestamp('created_at').defaultNow().notNull(),
    createdByStaffId: uuid('created_by_staff_id').references(() => staffAccounts.id, { onDelete: 'set null' }),
});

// ===========================================================================
// USERS
// Mapped from: backend/models/userModel.js
// ===========================================================================
export const users = pgTable('users', {
    id:             uuid('id').primaryKey().defaultRandom(),
    name:           varchar('name', { length: 255 }).notNull(),
    email:          varchar('email', { length: 255 }).notNull().unique(),
    username:       varchar('username', { length: 255 }).notNull().unique(),
    // Nullable since oauth-login-strategy.md Phase 1: a Google-only account
    // never sets a password hash. `loginUser` guards against NULL explicitly
    // (userController.ts) rather than letting bcrypt.compare see it.
    password:       varchar('password', { length: 255 }),
    // PostgreSQL native text[] array — mirrors the Mongoose [String] field
    languages:      text('languages').array().notNull().default([]),
    uiLanguage:     varchar('ui_language', { length: 50 }),
    // 'light' | 'dark' (validated in userController, like `uiLanguage`). NULL
    // means the user never chose one, so the client keeps following the OS
    // (.context/plans/phase-3-9-dark-mode.md D1/D7).
    theme:          varchar('theme', { length: 10 }),
    nativeLanguage: varchar('native_language', { length: 50 }),
    verified:       boolean('verified').default(false),
    // --- Admin dashboard, slice 1 (.context/plans/admin-dashboard.md §4) ---
    // Login capture. Country only (CF-IPCountry header) — IP addresses are
    // never stored. All NULL for accounts that have not logged in since this
    // column set was added.
    lastLoginAt:      timestamp('last_login_at'),
    lastLoginCountry: varchar('last_login_country', { length: 2 }),
    // Written by `protect`, at most once per hour per user.
    lastSeenAt:       timestamp('last_seen_at'),
    // Ban flag. Set by staff (slice 5); enforced by `protect` and both logins.
    bannedAt:         timestamp('banned_at'),
    banReason:        text('ban_reason'),
    // Soft delete (30-day grace, then a purge). The row stays, so the email
    // and username stay reserved.
    deletedAt:        timestamp('deleted_at'),
    deletedByStaffId: uuid('deleted_by_staff_id').references(() => staffAccounts.id, { onDelete: 'set null' }),
    // Carried in the JWT as `tv`. Raising it invalidates every older token.
    tokenVersion:     integer('token_version').notNull().default(0),
    ...timestamps,
});

// ---------------------------------------------------------------------------
// LOGIN_EVENTS
// One row per successful login: the login history shown on the admin user
// page. Country only, never an IP. Rows older than 90 days are deleted by the
// nightly purge job (admin-dashboard.md slice 5).
// ---------------------------------------------------------------------------
export const loginEvents = pgTable(
    'login_events',
    {
        id:        uuid('id').primaryKey().defaultRandom(),
        userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        // 'password' | 'google'
        method:    varchar('method', { length: 16 }).notNull(),
        country:   varchar('country', { length: 2 }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [index('login_events_user_created_idx').on(table.userId, table.createdAt)],
);

// Accounts allowed to sign in while login is 'limited'. Holds USER ids, not emails, so
// it survives an email change; the row goes when the account is purged. Adding by
// email looks the account up first.
export const loginAllowedUsers = pgTable('login_allowed_users', {
    userId:           uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    addedAt:          timestamp('added_at').defaultNow().notNull(),
    addedByStaffId:   uuid('added_by_staff_id').references(() => staffAccounts.id, { onDelete: 'set null' }),
});

// ---------------------------------------------------------------------------
// WORDS
// Mapped from: backend/models/wordModel.js
// Translations & cases are extracted into their own tables (normalized).
// ---------------------------------------------------------------------------
export const words = pgTable(
    'words',
    {
        id:                uuid('id').primaryKey().defaultRandom(),
        userId:            uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        partOfSpeech:      varchar('part_of_speech', { length: 100 }).notNull(),
        clue:              text('clue'),
        isCloned:          boolean('is_cloned').notNull().default(false),
        // If this word was cloned from another user's word, store the original creator
        originalCreatorId: uuid('original_creator_id').references(() => users.id, { onDelete: 'set null' }),
        // The specific word row this one was cloned from (tag clone —
        // phase-4-tags.md D11), for display/auditing. Distinct from
        // `originalCreatorId`, which names a *user*, not a word: a word can
        // be re-cloned (clone-of-a-clone), so this always points one hop
        // back, not to some ultimate origin. `set null` rather than cascade
        // — deleting the source word must not delete every clone of it.
        sourceWordId:      uuid('source_word_id').references((): AnyPgColumn => words.id, { onDelete: 'set null' }),
        ...timestamps,
    },
    // Backs the keyset-pagination ORDER BY (created_at DESC, id DESC) used by
    // getWordsSimplified (Phase 3 Slice 5).
    (table) => [index('words_created_at_id_idx').on(table.createdAt, table.id)],
);

// ---------------------------------------------------------------------------
// TRANSLATIONS
// Mapped from: wordModel.js → translations[].language
// One word can have many translations (one per language).
// ---------------------------------------------------------------------------
export const translations = pgTable('translations', {
    id:       uuid('id').primaryKey().defaultRandom(),
    wordId:   uuid('word_id').notNull().references(() => words.id, { onDelete: 'cascade' }),
    language: varchar('language', { length: 50 }).notNull(),
    ...timestamps,
});

// ---------------------------------------------------------------------------
// TRANSLATION_CASES
// Mapped from: wordModel.js → translations[].cases[]
// Each translation has one or more grammatical cases (e.g. nominative, genitive).
// ---------------------------------------------------------------------------
export const translationCases = pgTable('translation_cases', {
    id:            uuid('id').primaryKey().defaultRandom(),
    translationId: uuid('translation_id').notNull().references(() => translations.id, { onDelete: 'cascade' }),
    caseName:      varchar('case_name', { length: 100 }).notNull(),
    word:          varchar('word', { length: 500 }).notNull(),
});

// ---------------------------------------------------------------------------
// TAGS
// Mapped from: backend/models/tagModel.js
// ---------------------------------------------------------------------------
export const tags = pgTable(
    'tags',
    {
        id:          uuid('id').primaryKey().defaultRandom(),
        authorId:    uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        label:       varchar('label', { length: 255 }).notNull(),
        description: text('description'),
        // 'Public' | 'Private' | 'Friends-Only' — typed enum (study §8.3).
        visibility:  tagVisibilityEnum('visibility').notNull(),
        // The tag this one was cloned from (phase-4-tags.md D11), for
        // display ("Cloned from X by Y") and auditing. `set null` — deleting
        // the source tag must not delete every clone of it.
        sourceTagId: uuid('source_tag_id').references((): AnyPgColumn => tags.id, { onDelete: 'set null' }),
        ...timestamps,
    },
    (table) => [
        // Backs `GET /api/tags`'s `scope=owned` filter and the ownership
        // checks throughout tagController (phase-4-tags.md — missing before).
        index('tags_author_id_idx').on(table.authorId),
        // A user's tag labels are unique, case-insensitively (D13). Create/
        // rename maps this constraint's 23505 to a 409 with a clear message
        // (Slice 2); a clone whose label collides gets a numeric suffix
        // before insert (Slice 3), so this should never actually fire for a
        // clone in normal operation, only for a racing double-submit.
        uniqueIndex('tags_author_label_unique').on(table.authorId, sql`lower(${table.label})`),
    ],
);

// ---------------------------------------------------------------------------
// TAG_WORDS  (junction table: many-to-many between tags and words)
// Mapped from: backend/models/intermediary/tagWordModel.js
// ---------------------------------------------------------------------------
export const tagWords = pgTable(
    'tag_words',
    {
        tagId:     uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
        wordId:    uuid('word_id').notNull().references(() => words.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        // Composite primary key enforces uniqueness (replaces the Mongoose unique index)
        primaryKey({ columns: [table.tagId, table.wordId] }),
        // The PK above only serves lookups by `tag_id` first. `removeTagsFromWords`
        // and the per-word tags list both look up by `word_id` alone
        // (phase-4-tags.md — missing before).
        index('tag_words_word_id_idx').on(table.wordId),
    ],
);

// ---------------------------------------------------------------------------
// USER_FOLLOWING_TAGS  (junction table: many-to-many between users and tags)
// Mapped from: backend/models/intermediary/userFollowingTagModel.js
// ---------------------------------------------------------------------------
export const userFollowingTags = pgTable(
    'user_following_tags',
    {
        tagId:          uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
        followerUserId: uuid('follower_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        createdAt:      timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        // Composite primary key enforces uniqueness (replaces the Mongoose unique index)
        primaryKey({ columns: [table.tagId, table.followerUserId] }),
        // The PK above only serves lookups by `tag_id` first. Resolving "which
        // tags does this user follow" (every followed-word/followed-tag query)
        // looks up by `follower_user_id` alone (phase-4-tags.md — missing before).
        index('user_following_tags_follower_user_id_idx').on(table.followerUserId),
    ],
);

// ---------------------------------------------------------------------------
// TAG_SHARES
// Redesigned (study §8.3): the tag-share lifecycle is an explicit table, not a
// notification-as-carrier. `senderId` shares `tagId` with `recipientId`;
// accept clones the tag + words + translations + cases server-side.
// One outstanding share per (tag, recipient): partial UNIQUE WHERE pending.
// ---------------------------------------------------------------------------
export const tagShares = pgTable(
    'tag_shares',
    {
        id:          uuid('id').primaryKey().defaultRandom(),
        tagId:       uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
        senderId:    uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        status:      tagShareStatusEnum('status').notNull(),
        ...timestamps,
    },
    (table) => [
        uniqueIndex('tag_shares_pending_unique')
            .on(table.tagId, table.recipientId)
            .where(sql`${table.status} = 'pending'`),
    ],
);

// ---------------------------------------------------------------------------
// FRIENDSHIPS
// Redesigned (study §8.2): a directed relationship with an explicit requester
// and addressee, a NOT NULL status enum, and database-enforced uniqueness.
//   - One outstanding request per direction: partial UNIQUE (requester, addressee)
//     WHERE status = 'pending'.
//   - One friendship per unordered pair: expression UNIQUE (LEAST, GREATEST)
//     WHERE status = 'accepted'.
// `declined` / `cancelled` rows are kept for history and are not uniqueness-
// constrained; re-requesting after decline/cancel inserts a fresh row.
// ---------------------------------------------------------------------------
export const friendships = pgTable(
    'friendships',
    {
        id:          uuid('id').primaryKey().defaultRandom(),
        requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        addresseeId: uuid('addressee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        status:      friendshipStatusEnum('status').notNull(),
        ...timestamps,
    },
    (table) => [
        uniqueIndex('friendships_pending_unique')
            .on(table.requesterId, table.addresseeId)
            .where(sql`${table.status} = 'pending'`),
        uniqueIndex('friendships_accepted_unique')
            .on(
                sql`least(${table.requesterId}, ${table.addresseeId})`,
                sql`greatest(${table.requesterId}, ${table.addresseeId})`,
            )
            .where(sql`${table.status} = 'accepted'`),
    ],
);

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// Mapped from: backend/models/notificationModel.js
// The 'content' field uses jsonb to store arbitrary payload (Mixed in Mongoose).
// ---------------------------------------------------------------------------
export const notifications = pgTable('notifications', {
    id:        uuid('id').primaryKey().defaultRandom(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    variant:   varchar('variant', { length: 100 }).notNull(),
    dismissed: boolean('dismissed').notNull().default(false),
    // Flexible JSONB payload — structure varies by variant (e.g. friend requests, tag invites)
    content:   jsonb('content'),
    ...timestamps,
});

// ---------------------------------------------------------------------------
// TOKENS
// Mapped from: backend/models/tokenModel.js
// Used for email verification. Verification links never expire (a deliberate
// product decision, 2026-09-22) — no TTL is enforced anywhere against
// `createdAt`, and `userId` stays UNIQUE (one outstanding token per user).
// ---------------------------------------------------------------------------
export const tokens = pgTable('tokens', {
    id:        uuid('id').primaryKey().defaultRandom(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
    token:     varchar('token', { length: 512 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// PASSWORD_RESET_TOKENS
// Replaces the old `users.password_tokens` text[] column (2026-09-22): reset
// links now expire 30 minutes after `createdAt` and are single-use, enforced
// by `updatePassword` checking `usedAt IS NULL` + the age window. Unlike
// `tokens.userId`, `userId` here is NOT unique — a user may have several
// outstanding reset requests at once (e.g. one per device); a successful
// reset invalidates all of a user's other outstanding rows, not just the one
// used.
// ---------------------------------------------------------------------------
export const passwordResetTokens = pgTable('password_reset_tokens', {
    id:        uuid('id').primaryKey().defaultRandom(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token:     varchar('token', { length: 512 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    usedAt:    timestamp('used_at'),
});

// ---------------------------------------------------------------------------
// OAUTH_IDENTITIES
// New in Phase 1 (.dev-context/oauth-login-strategy.md) — one row per linked
// external sign-in provider per user, supporting password + OAuth
// simultaneously rather than one method per account. Empty until Phase 2
// starts inserting rows. `provider` stays a plain varchar rather than a typed
// enum with one value ('google' today) — negligible cost, and what would let
// a future provider be added without another migration, should one ever be
// wanted. **Identity lookup is always by `(provider, providerUserId)`, never
// by email** — a provider's email can change; its `sub` cannot.
// ---------------------------------------------------------------------------
export const oauthIdentities = pgTable(
    'oauth_identities',
    {
        id:             uuid('id').primaryKey().defaultRandom(),
        userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        provider:       varchar('provider', { length: 32 }).notNull(),
        providerUserId: varchar('provider_user_id', { length: 255 }).notNull(),
        // Audit trail only — never used for lookup (see above).
        emailAtLink:    varchar('email_at_link', { length: 255 }).notNull(),
        ...timestamps,
    },
    (table) => [
        uniqueIndex('oauth_identities_provider_sub_unique').on(table.provider, table.providerUserId),
        index('oauth_identities_user_id_idx').on(table.userId),
    ],
);

// ---------------------------------------------------------------------------
// EXERCISE_PERFORMANCES
// Mapped from: backend/models/exercisePerformanceModel.js
// Tracks per-user, per-translation performance metrics.
// statsByCase[] is extracted into exercise_performance_cases (normalized).
// ---------------------------------------------------------------------------
export const exercisePerformances = pgTable(
    'exercise_performances',
    {
        id:                           uuid('id').primaryKey().defaultRandom(),
        userId:                       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        wordId:                       uuid('word_id').notNull().references(() => words.id, { onDelete: 'cascade' }),
        translationId:                uuid('translation_id').notNull().references(() => translations.id, { onDelete: 'cascade' }),
        // 'Mastered' | 'Revise'
        performanceModifier:          varchar('performance_modifier', { length: 50 }),
        // Counts correct answers since the user last marked as 'Revise'
        reviseCounter:                integer('revise_counter'),
        // Averaged, time-decayed knowledge score across all cases
        averageTranslationKnowledge:  real('average_translation_knowledge'),
        lastDateModifiedTranslation:  timestamp('last_date_modified_translation'),
        translationLanguage:          varchar('translation_language', { length: 50 }),
        ...timestamps,
    },
    (table) => [
        // Mirrors the MongoDB compound index on { user, word }
        index('ep_user_word_idx').on(table.userId, table.wordId),
        // One performance row per (user, translation) — phase-5-practice.md defect 8.
        uniqueIndex('ep_user_translation_unique').on(table.userId, table.translationId),
        check('ep_modifier_check', sql`${table.performanceModifier} IN ('Mastered', 'Revise')`),
    ],
);

// ---------------------------------------------------------------------------
// EXERCISE_PERFORMANCE_CASES
// Mapped from: exercisePerformanceModel.js → statsByCase[]
// Each case (nominative, genitive, etc.) for a given exercise performance entry.
// ---------------------------------------------------------------------------
export const exercisePerformanceCases = pgTable(
    'exercise_performance_cases',
    {
        id:                   uuid('id').primaryKey().defaultRandom(),
        exercisePerformanceId: uuid('exercise_performance_id').notNull().references(() => exercisePerformances.id, { onDelete: 'cascade' }),
        caseName:             varchar('case_name', { length: 100 }).notNull(),
        // PostgreSQL native boolean[] array — mirrors the Mongoose [Boolean] field
        record:               boolean('record').array().notNull().default([]),
        lastDate:             timestamp('last_date'),
        knowledge:            real('knowledge'),
    },
    (table) => [
        // One case stat per (performance, case) — phase-5-practice.md defect 8.
        uniqueIndex('epc_performance_case_unique').on(table.exercisePerformanceId, table.caseName),
    ],
);

// ---------------------------------------------------------------------------
// PRACTICE_CONFIGS
// Phase 5.5 (phase-5-5-saved-practice.md §4): a named set of practice settings,
// with or without pre-selected words. Private to its owner.
// `word_ids` has no FK on purpose (D8): words can be deleted later, and the
// list endpoint reports how many saved words are no longer visible.
// ---------------------------------------------------------------------------
export const practiceConfigs = pgTable(
    'practice_configs',
    {
        id:          uuid('id').primaryKey().defaultRandom(),
        userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        name:        varchar('name', { length: 60 }).notNull(),
        description: varchar('description', { length: 200 }),
        // The validated settings, including the client-only `strictnessTI`.
        params:      jsonb('params').notNull(),
        // NULL = no pre-selected words.
        wordIds:     uuid('word_ids').array(),
        // NULL = the words were not chosen by tag. Not foreign keys: a tag can be deleted later,
        // and the client then drops it (the words stay in `word_ids`).
        tagIds:      uuid('tag_ids').array(),
        ...timestamps,
    },
    (table) => [
        // Names are unique per user, ignoring letter case (D6).
        uniqueIndex('pc_user_name_unique').on(table.userId, sql`lower(${table.name})`),
    ],
);

// ---------------------------------------------------------------------------
// PRACTICE_SESSIONS
// Phase 5.5 (phase-5-5-saved-practice.md §4): an unfinished practice session the
// user chose to keep. `snapshot` is the client's whole session (resume must show
// the same exercises); `summary` is built by the server from it, so the list
// stays light and never trusts a client-written summary. Private to its owner.
// At most 10 per user and 7 days of life: both enforced in the service.
// ---------------------------------------------------------------------------
export const practiceSessions = pgTable(
    'practice_sessions',
    {
        id:        uuid('id').primaryKey().defaultRandom(),
        userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        snapshot:  jsonb('snapshot').notNull(),
        summary:   jsonb('summary').notNull(),
        expiresAt: timestamp('expires_at').notNull(),
        ...timestamps,
    },
    (table) => [
        index('ps_user_updated_idx').on(table.userId, table.updatedAt),
    ],
);

// ===========================================================================
// RELATIONS
// Drizzle's relational API — used by the Drizzle query builder (db.query.*)
// ===========================================================================

export const usersRelations = relations(users, ({ many }) => ({
    words:              many(words),
    tags:               many(tags),
    userFollowingTags:  many(userFollowingTags),
    friendshipsAsRequester: many(friendships, { relationName: 'requester' }),
    friendshipsAsAddressee: many(friendships, { relationName: 'addressee' }),
    tagSharesSent:      many(tagShares, { relationName: 'sender' }),
    tagSharesReceived:  many(tagShares, { relationName: 'recipient' }),
    notifications:      many(notifications),
    tokens:             many(tokens),
    passwordResetTokens: many(passwordResetTokens),
    oauthIdentities:    many(oauthIdentities),
    exercisePerformances: many(exercisePerformances),
}));

export const wordsRelations = relations(words, ({ one, many }) => ({
    user:        one(users, { fields: [words.userId], references: [users.id] }),
    originalCreator: one(users, { fields: [words.originalCreatorId], references: [users.id] }),
    sourceWord:  one(words, { fields: [words.sourceWordId], references: [words.id], relationName: 'wordClone' }),
    clones:      many(words, { relationName: 'wordClone' }),
    translations: many(translations),
    tagWords:    many(tagWords),
    exercisePerformances: many(exercisePerformances),
}));

export const translationsRelations = relations(translations, ({ one, many }) => ({
    word:   one(words, { fields: [translations.wordId], references: [words.id] }),
    cases:  many(translationCases),
    exercisePerformances: many(exercisePerformances),
}));

export const translationCasesRelations = relations(translationCases, ({ one }) => ({
    translation: one(translations, { fields: [translationCases.translationId], references: [translations.id] }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
    author:            one(users, { fields: [tags.authorId], references: [users.id] }),
    sourceTag:         one(tags, { fields: [tags.sourceTagId], references: [tags.id], relationName: 'tagClone' }),
    clones:            many(tags, { relationName: 'tagClone' }),
    tagWords:          many(tagWords),
    userFollowingTags: many(userFollowingTags),
    tagShares:         many(tagShares),
}));

export const tagWordsRelations = relations(tagWords, ({ one }) => ({
    tag:  one(tags,  { fields: [tagWords.tagId],  references: [tags.id] }),
    word: one(words, { fields: [tagWords.wordId], references: [words.id] }),
}));

export const userFollowingTagsRelations = relations(userFollowingTags, ({ one }) => ({
    tag:          one(tags,  { fields: [userFollowingTags.tagId],          references: [tags.id] }),
    followerUser: one(users, { fields: [userFollowingTags.followerUserId], references: [users.id] }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
    requester: one(users, { fields: [friendships.requesterId], references: [users.id], relationName: 'requester' }),
    addressee: one(users, { fields: [friendships.addresseeId], references: [users.id], relationName: 'addressee' }),
}));

export const tagSharesRelations = relations(tagShares, ({ one }) => ({
    tag:       one(tags,  { fields: [tagShares.tagId],       references: [tags.id] }),
    sender:    one(users, { fields: [tagShares.senderId],    references: [users.id], relationName: 'sender' }),
    recipient: one(users, { fields: [tagShares.recipientId], references: [users.id], relationName: 'recipient' }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const tokensRelations = relations(tokens, ({ one }) => ({
    user: one(users, { fields: [tokens.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
    user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const oauthIdentitiesRelations = relations(oauthIdentities, ({ one }) => ({
    user: one(users, { fields: [oauthIdentities.userId], references: [users.id] }),
}));

export const exercisePerformancesRelations = relations(exercisePerformances, ({ one, many }) => ({
    user:        one(users,        { fields: [exercisePerformances.userId],        references: [users.id] }),
    word:        one(words,        { fields: [exercisePerformances.wordId],        references: [words.id] }),
    translation: one(translations, { fields: [exercisePerformances.translationId], references: [translations.id] }),
    cases:       many(exercisePerformanceCases),
}));

export const exercisePerformanceCasesRelations = relations(exercisePerformanceCases, ({ one }) => ({
    exercisePerformance: one(exercisePerformances, {
        fields: [exercisePerformanceCases.exercisePerformanceId],
        references: [exercisePerformances.id],
    }),
}));

// ---------------------------------------------------------------------------
// OPS_EVENTS
// Facts about the deployment that only the VPS scripts know: one row for each
// nightly backup and each weekly restore test (deploy/scripts/record-event.sh
// writes them as the DB superuser, after the run). The admin health page reads
// the newest row of each kind. Only production is backed up, so staging has none.
// ---------------------------------------------------------------------------
export const opsEvents = pgTable(
    'ops_events',
    {
        id:        uuid('id').primaryKey().defaultRandom(),
        // 'backup' | 'restore_test'
        kind:      varchar('kind', { length: 32 }).notNull(),
        ok:        boolean('ok').notNull(),
        // A short human-readable line: the dump file name, or why the run failed.
        detail:    text('detail'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [index('ops_events_kind_created_idx').on(table.kind, table.createdAt)],
);

// ---------------------------------------------------------------------------
// USER_ACTIVITY_DAYS
// One row for each user for each UTC day on which they used the app (admin
// dashboard, slice 9). `users.last_seen_at` holds only the LAST time, so it
// cannot answer "how many users were active on 12 September?". This table can.
// `protect` writes the row at the first request of each day (on conflict, it
// does nothing). History starts on the day this table was deployed. The nightly
// purge deletes rows older than 400 days; a purged account's rows cascade away.
// ---------------------------------------------------------------------------
export const userActivityDays = pgTable(
    'user_activity_days',
    {
        userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        // A plain 'YYYY-MM-DD' string (UTC), not a JS Date: a day has no time zone to get wrong.
        day:    date('day', { mode: 'string' }).notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.day] }),
        // Backs "who was active in this range of days".
        index('user_activity_days_day_idx').on(table.day),
    ],
);
