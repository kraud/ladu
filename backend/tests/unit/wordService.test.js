/**
 * wordService.test.js
 *
 * Unit tests for the pure (non-DB) helpers in wordService.ts.
 *
 * DB-dependent functions (fetchTranslationsMap, fetchTagsMap,
 * fetchWordsWithRelations, fetchWordWithRelations, getWordsByIds) are
 * covered by the integration tests (words.test.js, tags.test.js,
 * exercises.test.js) which exercise them through the API endpoints.
 *
 * assembleWord is a pure data mapper — given a word row and pre-built maps,
 * it returns the legacy nested shape. No database needed.
 */

const { assembleWord } = require('../../services/wordService');

// ---------------------------------------------------------------------------
// Helpers: build mock rows that match the Drizzle $inferSelect shapes
// ---------------------------------------------------------------------------

/**
 * Build a mock word row (WordRow).
 */
const makeWord = (overrides = {}) => ({
    id: 'word-uuid-1',
    userId: 'user-uuid-1',
    partOfSpeech: 'noun',
    clue: 'a test word',
    isCloned: false,
    originalCreatorId: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-02T00:00:00Z'),
    ...overrides,
});

/**
 * Build a mock translation entry (AssembledTranslation).
 */
const makeTranslation = (overrides = {}) => ({
    _id: 'trans-uuid-1',
    language: 'Spanish',
    cases: [
        { word: 'casa', caseName: 'singularNominative' },
        { word: 'casa', caseName: 'singularAccusative' },
    ],
    ...overrides,
});

/**
 * Build a mock tag row (TagRow).
 */
const makeTag = (overrides = {}) => ({
    id: 'tag-uuid-1',
    authorId: 'author-uuid-1',
    label: 'My Tag',
    description: 'A test tag',
    public: 'Public',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-02T00:00:00Z'),
    ...overrides,
});

// ============================================================================
// assembleWord
// ============================================================================

describe('assembleWord', () => {
    // Happy path: maps all fields correctly
    it('maps all fields from WordRow to WordResponse', () => {
        const word = makeWord({ originalCreatorId: 'creator-uuid-1', isCloned: true });
        const translation = makeTranslation();
        const tag = makeTag();

        const translationsMap = new Map([[word.id, [translation]]]);
        const tagsMap = new Map([[word.id, [tag]]]);

        const result = assembleWord(word, translationsMap, tagsMap);

        // Field remapping
        expect(result._id).toBe(word.id);
        expect(result.id).toBe(word.id);
        expect(result.user).toBe(word.userId);             // userId → user
        expect(result.originalCreator).toBe(word.originalCreatorId); // originalCreatorId → originalCreator

        // Passthrough fields
        expect(result.partOfSpeech).toBe(word.partOfSpeech);
        expect(result.clue).toBe(word.clue);
        expect(result.isCloned).toBe(word.isCloned);

        // Nested data
        expect(result.translations).toEqual([translation]);
        expect(result.tags).toEqual([tag]);

        // Dates
        expect(result.createdAt).toBe(word.createdAt);
        expect(result.updatedAt).toBe(word.updatedAt);
    });

    // Returns empty translations array when word has no translations
    it('returns empty translations array when word has no translations in map', () => {
        const word = makeWord();
        const result = assembleWord(word, new Map(), new Map());

        expect(result.translations).toEqual([]);
    });

    // Returns empty tags array when word has no tags
    it('returns empty tags array when word has no tags in map', () => {
        const word = makeWord();
        const result = assembleWord(word, new Map(), new Map());

        expect(result.tags).toEqual([]);
    });

    // Handles null clue and null originalCreator
    it('passes null clue and null originalCreator through as null', () => {
        const word = makeWord({ clue: null, originalCreatorId: null });
        const result = assembleWord(word, new Map(), new Map());

        expect(result.clue).toBeNull();
        expect(result.originalCreator).toBeNull();
    });

    // Maps multiple translations for the same word
    it('includes all translations for the word from the map', () => {
        const word = makeWord();
        const t1 = makeTranslation({ _id: 't1', language: 'Spanish' });
        const t2 = makeTranslation({ _id: 't2', language: 'German' });

        const translationsMap = new Map([[word.id, [t1, t2]]]);
        const result = assembleWord(word, translationsMap, new Map());

        expect(result.translations).toHaveLength(2);
        expect(result.translations).toContainEqual(t1);
        expect(result.translations).toContainEqual(t2);
    });

    // Maps multiple tags for the same word
    it('includes all tags for the word from the map', () => {
        const word = makeWord();
        const tag1 = makeTag({ id: 'tag-1', label: 'Tag 1' });
        const tag2 = makeTag({ id: 'tag-2', label: 'Tag 2' });

        const tagsMap = new Map([[word.id, [tag1, tag2]]]);
        const result = assembleWord(word, new Map(), tagsMap);

        expect(result.tags).toHaveLength(2);
        expect(result.tags).toContainEqual(tag1);
        expect(result.tags).toContainEqual(tag2);
    });

    // Ignores other entries in the map (only picks matching wordId)
    it('ignores translations and tags for other words in the map', () => {
        const word = makeWord({ id: 'target-word' });
        const otherTranslation = makeTranslation({ _id: 'other-t' });
        const otherTag = makeTag({ id: 'other-tag' });

        const translationsMap = new Map([
            ['other-word', [otherTranslation]],
            [word.id, []],
        ]);
        const tagsMap = new Map([
            ['other-word', [otherTag]],
            [word.id, []],
        ]);

        const result = assembleWord(word, translationsMap, tagsMap);

        expect(result.translations).toEqual([]);
        expect(result.tags).toEqual([]);
    });

    // Preserves date object references
    it('preserves exact createdAt and updatedAt references', () => {
        const now = new Date();
        const word = makeWord({ createdAt: now, updatedAt: now });

        const result = assembleWord(word, new Map(), new Map());

        expect(result.createdAt).toBe(now);
        expect(result.updatedAt).toBe(now);
    });

    // Handles translations with empty cases array
    it('passes through translations with empty cases array', () => {
        const word = makeWord();
        const translation = makeTranslation({ cases: [] });

        const translationsMap = new Map([[word.id, [translation]]]);
        const result = assembleWord(word, translationsMap, new Map());

        expect(result.translations).toHaveLength(1);
        expect(result.translations[0].cases).toEqual([]);
    });
});
