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
    jsonb,
    primaryKey,
    uniqueIndex,
    index,
}: typeof import('drizzle-orm/pg-core') = require('drizzle-orm/pg-core');
const { relations, sql }: typeof import('drizzle-orm') = require('drizzle-orm');

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
    ...timestamps,
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
export const tags = pgTable('tags', {
    id:          uuid('id').primaryKey().defaultRandom(),
    authorId:    uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    label:       varchar('label', { length: 255 }).notNull(),
    description: text('description'),
    // 'Public' | 'Private' | 'Friends-Only' — typed enum (study §8.3).
    visibility:  tagVisibilityEnum('visibility').notNull(),
    ...timestamps,
});

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
    // Composite primary key enforces uniqueness (replaces the Mongoose unique index)
    (table) => [primaryKey({ columns: [table.tagId, table.wordId] })],
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
    // Composite primary key enforces uniqueness (replaces the Mongoose unique index)
    (table) => [primaryKey({ columns: [table.tagId, table.followerUserId] })],
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
        translationId:                uuid('translation_id').references(() => translations.id, { onDelete: 'set null' }),
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
    // Mirrors the MongoDB compound index on { user, word }
    (table) => [index('ep_user_word_idx').on(table.userId, table.wordId)],
);

// ---------------------------------------------------------------------------
// EXERCISE_PERFORMANCE_CASES
// Mapped from: exercisePerformanceModel.js → statsByCase[]
// Each case (nominative, genitive, etc.) for a given exercise performance entry.
// ---------------------------------------------------------------------------
export const exercisePerformanceCases = pgTable('exercise_performance_cases', {
    id:                   uuid('id').primaryKey().defaultRandom(),
    exercisePerformanceId: uuid('exercise_performance_id').notNull().references(() => exercisePerformances.id, { onDelete: 'cascade' }),
    caseName:             varchar('case_name', { length: 100 }).notNull(),
    // PostgreSQL native boolean[] array — mirrors the Mongoose [Boolean] field
    record:               boolean('record').array().notNull().default([]),
    lastDate:             timestamp('last_date'),
    knowledge:            real('knowledge'),
});

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
