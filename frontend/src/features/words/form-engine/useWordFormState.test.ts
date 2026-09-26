import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { Lang, NounCases, PartOfSpeech } from '@/ts/enums';
import type { WordBE } from '../types';
import { translationHasData, useWordFormState } from './useWordFormState';

function seedSession(languages: string[]) {
    useAuthStore.getState().setSession({
        id: 'u1',
        name: 'Kai',
        email: 'kai@example.com',
        username: 'kai',
        languages,
        uiLanguage: 'English',
    });
}

beforeEach(() => {
    useAuthStore.getState().clearSession();
});

describe('useWordFormState — create mode', () => {
    it('starts empty and seeds partOfSpeech from defaultPartOfSpeech', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState({ defaultPartOfSpeech: PartOfSpeech.noun }));

        expect(result.current.partOfSpeech).toBe(PartOfSpeech.noun);
        expect(result.current.translations).toEqual([]);
        expect(result.current.availableLanguages.map((l) => l.label)).toEqual(['English', 'Spanish']);
        expect(result.current.canSave).toBe(false);
        expect(result.current.canAddMore).toBe(true);
        expect(result.current.belowMinTranslations).toBe(true);
    });

    it('belowMinTranslations flips false at 2 slots, regardless of completion/dirtiness', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());

        act(() => result.current.addTranslation(Lang.EN));
        expect(result.current.belowMinTranslations).toBe(true);

        act(() => result.current.addTranslation(Lang.ES));
        expect(result.current.belowMinTranslations).toBe(false);
    });

    it('addTranslation appends a dirty, incomplete slot and shrinks availableLanguages', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());

        act(() => result.current.addTranslation(Lang.EN));

        expect(result.current.translations).toEqual([
            { language: Lang.EN, cases: [], completionState: false, isDirty: true, hasData: false },
        ]);
        expect(result.current.availableLanguages.map((l) => l.label)).toEqual(['Spanish']);
    });

    it('canAddMore is false at 4 slots or with no languages left', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());

        act(() => result.current.addTranslation(Lang.EN));
        act(() => result.current.addTranslation(Lang.ES));

        expect(result.current.canAddMore).toBe(false); // no languages left, even though < 4 slots
    });

    it('updateTranslation merges completion/dirty/cases by index', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());
        act(() => result.current.addTranslation(Lang.EN));

        act(() =>
            result.current.updateTranslation(0, {
                cases: [{ caseName: NounCases.singularEN, word: 'house' }],
                completionState: true,
                isDirty: true,
            }),
        );

        expect(result.current.translations[0]).toEqual({
            language: Lang.EN,
            cases: [{ caseName: NounCases.singularEN, word: 'house' }],
            completionState: true,
            isDirty: true,
            hasData: false, // untouched by this hand-built change: the slot's own value stays
        });
    });

    it('clearTranslation empties cases but keeps the language bound', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());
        act(() => result.current.addTranslation(Lang.EN));
        act(() =>
            result.current.updateTranslation(0, {
                cases: [{ caseName: NounCases.singularEN, word: 'house' }],
                completionState: true,
                isDirty: true,
            }),
        );

        act(() => result.current.clearTranslation(0));

        expect(result.current.translations[0]).toEqual({
            language: Lang.EN,
            cases: [],
            completionState: false,
            isDirty: true,
            hasData: false,
        });
    });

    it('clearTranslation bumps resetTokens for that language only', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());
        act(() => result.current.addTranslation(Lang.EN));
        act(() => result.current.addTranslation(Lang.ES));

        expect(result.current.resetTokens[Lang.EN]).toBeUndefined();

        act(() => result.current.clearTranslation(0));
        expect(result.current.resetTokens[Lang.EN]).toBe(1);
        expect(result.current.resetTokens[Lang.ES]).toBeUndefined();

        act(() => result.current.clearTranslation(0));
        expect(result.current.resetTokens[Lang.EN]).toBe(2); // bumps again on a second Clear
    });

    it("clearTranslation's resetTokens entry stays with its language after an earlier slot is removed", () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());
        act(() => result.current.addTranslation(Lang.EN));
        act(() => result.current.addTranslation(Lang.ES));

        act(() => result.current.removeTranslation(0)); // drop EN — ES is now index 0
        act(() => result.current.clearTranslation(0)); // clears ES, not the old EN slot

        expect(result.current.resetTokens[Lang.ES]).toBe(1);
        expect(result.current.resetTokens[Lang.EN]).toBeUndefined();
    });

    it('removeTranslation drops the slot and frees the language back up', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());
        act(() => result.current.addTranslation(Lang.EN));
        act(() => result.current.addTranslation(Lang.ES));

        act(() => result.current.removeTranslation(0));

        expect(result.current.translations).toHaveLength(1);
        expect(result.current.translations[0]?.language).toBe(Lang.ES);
        expect(result.current.availableLanguages.map((l) => l.label)).toEqual(['English']);
    });

    describe('canSave', () => {
        function complete(result: ReturnType<typeof useWordFormState>, index: number) {
            act(() =>
                result.updateTranslation(index, {
                    cases: [{ caseName: NounCases.singularEN, word: 'x' }],
                    completionState: true,
                    isDirty: true,
                }),
            );
        }

        it('is false under 2 translations', () => {
            seedSession(['English', 'Spanish']);
            const { result } = renderHook(() => useWordFormState());
            act(() => result.current.addTranslation(Lang.EN));
            complete(result.current, 0);
            expect(result.current.canSave).toBe(false);
        });

        it('is false with an incomplete slot', () => {
            seedSession(['English', 'Spanish']);
            const { result } = renderHook(() => useWordFormState());
            act(() => result.current.addTranslation(Lang.EN));
            act(() => result.current.addTranslation(Lang.ES));
            complete(result.current, 0);
            // slot 1 (ES) is still incomplete
            expect(result.current.canSave).toBe(false);
        });

        it('is true once >= 2 complete and dirty', () => {
            seedSession(['English', 'Spanish']);
            const { result } = renderHook(() => useWordFormState());
            act(() => result.current.addTranslation(Lang.EN));
            act(() => result.current.addTranslation(Lang.ES));
            complete(result.current, 0);
            complete(result.current, 1);
            expect(result.current.canSave).toBe(true);
        });
    });

    it('reset clears everything back to empty', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());
        act(() => result.current.addTranslation(Lang.EN));
        act(() => result.current.setClue('a note'));

        act(() => result.current.reset());

        expect(result.current.partOfSpeech).toBeUndefined();
        expect(result.current.translations).toEqual([]);
        expect(result.current.clue).toBe('');
        expect(result.current.canSave).toBe(false);
    });

    it('buildPayload strips completion/dirty flags', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState({ defaultPartOfSpeech: PartOfSpeech.noun }));
        act(() => result.current.addTranslation(Lang.EN));
        act(() =>
            result.current.updateTranslation(0, {
                cases: [{ caseName: NounCases.singularEN, word: 'house' }],
                completionState: true,
                isDirty: true,
            }),
        );
        act(() => result.current.setClue('a place to live'));

        expect(result.current.buildPayload()).toEqual({
            partOfSpeech: PartOfSpeech.noun,
            clue: 'a place to live',
            translations: [{ language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'house' }] }],
        });
    });
});

describe('useWordFormState — edit mode', () => {
    const initialWord: WordBE = {
        id: 'w1',
        user: 'u1',
        partOfSpeech: PartOfSpeech.noun,
        clue: 'a place to live',
        isCloned: false,
        originalCreator: null,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        translations: [
            { id: 't-en', language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'house' }] },
            { id: 't-es', language: Lang.ES, cases: [{ caseName: 'singularES', word: 'casa' }] },
            { id: 't-de', language: Lang.DE, cases: [{ caseName: 'singularNominativDE', word: 'Haus' }] },
        ],
    };

    it('hydrates only translations in the current user languages, marked complete + clean', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState({ initialWord }));

        expect(result.current.partOfSpeech).toBe(PartOfSpeech.noun);
        expect(result.current.clue).toBe('a place to live');
        expect(result.current.translations).toEqual([
            { language: Lang.EN, cases: initialWord.translations[0]!.cases, completionState: true, isDirty: false },
            { language: Lang.ES, cases: initialWord.translations[1]!.cases, completionState: true, isDirty: false },
        ]);
        // German was dropped (it's no longer one of the user's own languages),
        // and isn't offered back — a user can only add languages they've
        // configured on their profile, and both of those (EN/ES) are in use.
        expect(result.current.availableLanguages).toEqual([]);
        expect(result.current.canSave).toBe(false); // nothing dirty yet
    });

    it("offers back a language dropped from hydration once it's back in the user's own languages", () => {
        seedSession(['English', 'Spanish', 'German']);
        const { result } = renderHook(() => useWordFormState({ initialWord }));

        expect(result.current.translations).toHaveLength(3); // German kept this time
        expect(result.current.availableLanguages).toEqual([]);
    });
});

describe('useWordFormState — saveBlockReason', () => {
    it('is minTranslations below 2 slots, whatever else is true', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState({ defaultPartOfSpeech: PartOfSpeech.noun }));
        expect(result.current.saveBlockReason).toBe('minTranslations');

        act(() => result.current.addTranslation(Lang.EN));
        expect(result.current.saveBlockReason).toBe('minTranslations');
    });

    it('is incomplete with 2 slots while any slot is missing a required field', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState({ defaultPartOfSpeech: PartOfSpeech.noun }));
        act(() => result.current.addTranslation(Lang.EN));
        act(() => result.current.addTranslation(Lang.ES));
        expect(result.current.saveBlockReason).toBe('incomplete');

        act(() => result.current.updateTranslation(0, { cases: [], completionState: true, isDirty: true }));
        expect(result.current.saveBlockReason).toBe('incomplete'); // the second slot is still incomplete
    });

    it('is null once every slot is complete and something changed', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState({ defaultPartOfSpeech: PartOfSpeech.noun }));
        act(() => result.current.addTranslation(Lang.EN));
        act(() => result.current.addTranslation(Lang.ES));
        act(() => result.current.updateTranslation(0, { cases: [], completionState: true, isDirty: true }));
        act(() => result.current.updateTranslation(1, { cases: [], completionState: true, isDirty: true }));
        expect(result.current.saveBlockReason).toBeNull();
        expect(result.current.canSave).toBe(true);
    });

    it('is noChanges for a hydrated, complete word nobody has touched', () => {
        seedSession(['English', 'Spanish']);
        const initialWord: WordBE = {
            id: 'word-1',
            user: 'u1',
            partOfSpeech: PartOfSpeech.noun,
            translations: [
                { id: 'tr-1', language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'house' }] },
                { id: 'tr-2', language: Lang.ES, cases: [{ caseName: NounCases.singularES, word: 'casa' }] },
            ],
            clue: null,
            isCloned: false,
            originalCreator: null,
            tags: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };
        const { result } = renderHook(() => useWordFormState({ initialWord }));
        // Hydrated slots start complete-but-clean only after their cards report; simulate that.
        act(() => result.current.updateTranslation(0, { cases: [], completionState: true, isDirty: false }));
        act(() => result.current.updateTranslation(1, { cases: [], completionState: true, isDirty: false }));
        expect(result.current.saveBlockReason).toBe('noChanges');

        act(() => result.current.setClue('a small building'));
        expect(result.current.saveBlockReason).toBeNull();
    });
});

describe('translationHasData', () => {
    it('trusts the card\'s own hasData when it has reported one', () => {
        expect(translationHasData({ language: Lang.EN, cases: [], hasData: true })).toBe(true);
        expect(translationHasData({ language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'a' }], hasData: false })).toBe(false);
    });

    it('falls back to the cases before the card has reported', () => {
        expect(translationHasData({ language: Lang.EN, cases: [] })).toBe(false);
        expect(translationHasData({ language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'a' }] })).toBe(true);
    });

    it('addTranslation and clearTranslation both leave a slot without data', () => {
        seedSession(['English', 'Spanish']);
        const { result } = renderHook(() => useWordFormState());
        act(() => result.current.addTranslation(Lang.EN));
        expect(translationHasData(result.current.translations[0]!)).toBe(false);

        act(() => result.current.updateTranslation(0, { cases: [], completionState: false, isDirty: true, hasData: true }));
        expect(translationHasData(result.current.translations[0]!)).toBe(true);

        act(() => result.current.clearTranslation(0));
        expect(translationHasData(result.current.translations[0]!)).toBe(false);
    });
});

describe('useWordFormState — removing a translation from a saved word', () => {
    const threeLanguageWord: WordBE = {
        id: 'word-1',
        user: 'u1',
        partOfSpeech: PartOfSpeech.noun,
        translations: [
            { id: 'tr-1', language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'house' }] },
            { id: 'tr-2', language: Lang.ES, cases: [{ caseName: NounCases.singularES, word: 'casa' }] },
            { id: 'tr-3', language: Lang.DE, cases: [{ caseName: NounCases.singularNominativDE, word: 'Haus' }] },
        ],
        clue: null,
        isCloned: false,
        originalCreator: null,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };

    /** Mounted cards report complete + clean for every hydrated slot. */
    function hydrated() {
        seedSession(['English', 'Spanish', 'German']);
        const hook = renderHook(() => useWordFormState({ initialWord: threeLanguageWord }));
        for (let i = 0; i < 3; i++) {
            act(() => hook.result.current.updateTranslation(i, { cases: [], completionState: true, isDirty: false }));
        }
        return hook;
    }

    it('starts with nothing to save', () => {
        const { result } = hydrated();
        expect(result.current.canSave).toBe(false);
        expect(result.current.saveBlockReason).toBe('noChanges');
    });

    it('removing one of three makes Save available, with no other edit', () => {
        const { result } = hydrated();
        act(() => result.current.removeTranslation(0));

        expect(result.current.translations).toHaveLength(2);
        expect(result.current.saveBlockReason).toBeNull();
        expect(result.current.canSave).toBe(true);
    });

    it('removing down to one translation is still blocked, by the minimum', () => {
        const { result } = hydrated();
        act(() => result.current.removeTranslation(0));
        act(() => result.current.removeTranslation(0));

        expect(result.current.canSave).toBe(false);
        expect(result.current.saveBlockReason).toBe('minTranslations');
    });

    it('reset clears the removal, so a fresh word starts with nothing to save', () => {
        const { result } = hydrated();
        act(() => result.current.removeTranslation(0));
        act(() => result.current.reset(PartOfSpeech.noun));
        act(() => result.current.addTranslation(Lang.EN));
        act(() => result.current.updateTranslation(0, { cases: [], completionState: true, isDirty: false }));
        act(() => result.current.addTranslation(Lang.ES));
        act(() => result.current.updateTranslation(1, { cases: [], completionState: true, isDirty: false }));

        expect(result.current.saveBlockReason).toBe('noChanges');
    });
});
