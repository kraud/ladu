// The language table (lib/languages.ts) against the rest of the app. Adding a language
// (.context/guides/add-language.md) must touch the table and the frontend enum together.
const {
    LANGUAGE_INFO, LANGUAGE_NAMES, LANGUAGE_SUFFIX, LANGUAGE_BY_SUFFIX, HUB_LANGUAGE, TRANSLATION_TARGETS, TARGET_BY_WIKTIONARY_CODE,
} = require('../../lib/languages');
const { Lang } = require('../../../frontend/src/ts/enums');
const { LANGUAGES: EXERCISE_LANGUAGES } = require('../../services/exercises/validate');
const { TRANSLATION_LANGUAGES } = require('../../lib/lexicon/translations');

describe('the language table', () => {
    it('holds the same languages as the frontend Lang enum (the enum order is not the display order)', () => {
        expect([...LANGUAGE_NAMES].sort()).toEqual(Object.values(Lang).sort());
    });

    it('uses the Lang enum key as the suffix', () => {
        for (const [key, name] of Object.entries(Lang)) {
            expect({ name, suffix: LANGUAGE_INFO[name].suffix }).toEqual({ name, suffix: key });
        }
    });

    it('has a unique suffix and a unique Wiktionary code per language', () => {
        expect(new Set(LANGUAGE_NAMES.map((n) => LANGUAGE_INFO[n].suffix)).size).toBe(LANGUAGE_NAMES.length);
        expect(new Set(LANGUAGE_NAMES.map((n) => LANGUAGE_INFO[n].wiktionary)).size).toBe(LANGUAGE_NAMES.length);
    });

    it('maps names to suffixes and back', () => {
        expect(LANGUAGE_SUFFIX.Estonian).toBe('EE');
        expect(LANGUAGE_BY_SUFFIX.EE).toBe('Estonian');
        for (const name of LANGUAGE_NAMES) expect(LANGUAGE_BY_SUFFIX[LANGUAGE_SUFFIX[name]]).toBe(name);
    });

    it('has English as the hub, and every other language as a translation target', () => {
        expect(HUB_LANGUAGE).toBe('English');
        expect(TRANSLATION_TARGETS).toEqual(LANGUAGE_NAMES.filter((n) => n !== 'English'));
        expect(TARGET_BY_WIKTIONARY_CODE).toEqual(TRANSLATION_LANGUAGES);
        expect(TARGET_BY_WIKTIONARY_CODE.et).toBe('Estonian');
    });

    it('is the list that the exercise validation reads', () => {
        expect([...EXERCISE_LANGUAGES]).toEqual(LANGUAGE_NAMES);
    });
});
