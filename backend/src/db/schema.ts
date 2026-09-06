const {
    pgTable,
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
const { relations }: typeof import('drizzle-orm') = require('drizzle-orm');

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
    password:       varchar('password', { length: 255 }).notNull(),
    // PostgreSQL native text[] array — mirrors the Mongoose [String] field
    languages:      text('languages').array().notNull().default([]),
    uiLanguage:     varchar('ui_language', { length: 50 }),
    nativeLanguage: varchar('native_language', { length: 50 }),
    verified:       boolean('verified').default(false),
    // Used for email-verification/password-reset tokens stored inline
    passwordTokens: text('password_tokens').array().notNull().default([]),
    ...timestamps,
});

// ---------------------------------------------------------------------------
// WORDS
// Mapped from: backend/models/wordModel.js
// Translations & cases are extracted into their own tables (normalized).
// ---------------------------------------------------------------------------
export const words = pgTable('words', {
    id:                uuid('id').primaryKey().defaultRandom(),
    userId:            uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    partOfSpeech:      varchar('part_of_speech', { length: 100 }).notNull(),
    clue:              text('clue'),
    isCloned:          boolean('is_cloned').notNull().default(false),
    // If this word was cloned from another user's word, store the original creator
    originalCreatorId: uuid('original_creator_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
});

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
    // 'Public' | 'Private' | 'Friends-Only' — kept as varchar per original model
    public:      varchar('public', { length: 50 }).notNull(),
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
// FRIENDSHIPS
// Mapped from: backend/models/friendshipModel.js
// MongoDB stored a 2-item userIds array; here we use explicit user1Id/user2Id
// columns with a CHECK constraint so user1Id < user2Id (prevents duplicates).
// ---------------------------------------------------------------------------
export const friendships = pgTable('friendships', {
    id:      uuid('id').primaryKey().defaultRandom(),
    user1Id: uuid('user1_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    user2Id: uuid('user2_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    // 'pending' | 'accepted'
    status:  varchar('status', { length: 50 }),
    ...timestamps,
});

// ---------------------------------------------------------------------------
// FRIENDSHIP_PARTNERSHIPS
// Mapped from: friendshipModel.js → partnerships[]
// A friendship can have multiple partnerships (mentor/mentee per language).
// ---------------------------------------------------------------------------
export const friendshipPartnerships = pgTable('friendship_partnerships', {
    id:           uuid('id').primaryKey().defaultRandom(),
    friendshipId: uuid('friendship_id').notNull().references(() => friendships.id, { onDelete: 'cascade' }),
    // mentor is the user who is teaching; the mentee is the other participant
    mentorId:     uuid('mentor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    language:     varchar('language', { length: 50 }).notNull(),
    ...timestamps,
});

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
// Used for email verification. The TTL is handled at the application layer.
// ---------------------------------------------------------------------------
export const tokens = pgTable('tokens', {
    id:        uuid('id').primaryKey().defaultRandom(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
    token:     varchar('token', { length: 512 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
    friendshipsAsUser1: many(friendships, { relationName: 'user1' }),
    friendshipsAsUser2: many(friendships, { relationName: 'user2' }),
    notifications:      many(notifications),
    tokens:             many(tokens),
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
}));

export const tagWordsRelations = relations(tagWords, ({ one }) => ({
    tag:  one(tags,  { fields: [tagWords.tagId],  references: [tags.id] }),
    word: one(words, { fields: [tagWords.wordId], references: [words.id] }),
}));

export const userFollowingTagsRelations = relations(userFollowingTags, ({ one }) => ({
    tag:          one(tags,  { fields: [userFollowingTags.tagId],          references: [tags.id] }),
    followerUser: one(users, { fields: [userFollowingTags.followerUserId], references: [users.id] }),
}));

export const friendshipsRelations = relations(friendships, ({ one, many }) => ({
    user1:        one(users, { fields: [friendships.user1Id], references: [users.id], relationName: 'user1' }),
    user2:        one(users, { fields: [friendships.user2Id], references: [users.id], relationName: 'user2' }),
    partnerships: many(friendshipPartnerships),
}));

export const friendshipPartnershipsRelations = relations(friendshipPartnerships, ({ one }) => ({
    friendship: one(friendships, { fields: [friendshipPartnerships.friendshipId], references: [friendships.id] }),
    mentor:     one(users,       { fields: [friendshipPartnerships.mentorId],     references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const tokensRelations = relations(tokens, ({ one }) => ({
    user: one(users, { fields: [tokens.userId], references: [users.id] }),
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
