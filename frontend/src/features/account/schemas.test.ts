import { describe, expect, it } from 'vitest';
import { buildDetailsSchema, buildLanguagesSchema, NO_NATIVE_LANGUAGE } from './schemas';

// Identity `t` — assert on the message keys, like the auth schema tests.
const t = (key: string) => key;

describe('buildDetailsSchema (account card)', () => {
    const schema = buildDetailsSchema(t);
    const valid = { name: 'Kai', username: 'kai' };

    it('accepts a name and a username', async () => {
        await expect(schema.validate(valid)).resolves.toEqual(valid);
    });

    it('requires a name', async () => {
        await expect(schema.validate({ ...valid, name: '  ' })).rejects.toThrow('loginRegister:errors.nameRequired');
    });

    it('requires a username', async () => {
        await expect(schema.validate({ ...valid, username: '' })).rejects.toThrow(
            'loginRegister:errors.usernameRequired',
        );
    });
});

describe('buildLanguagesSchema (languages card)', () => {
    const schema = buildLanguagesSchema(t);
    const valid = {
        languages: ['English', 'Spanish'],
        nativeLanguage: NO_NATIVE_LANGUAGE,
        masteredLanguagePairs: [] as string[][],
    };

    it('accepts a complete selection', async () => {
        await expect(schema.validate(valid)).resolves.toEqual(valid);
    });

    it('requires at least 2 languages', async () => {
        await expect(schema.validate({ ...valid, languages: ['English'] })).rejects.toThrow(
            'common:userData.errors.notEnoughLanguages',
        );
    });

    it('rejects an empty language selection', async () => {
        await expect(schema.validate({ ...valid, languages: [] })).rejects.toThrow(
            'common:userData.errors.notEnoughLanguages',
        );
    });

    describe('masteredLanguagePairs', () => {
        const three = ['English', 'Spanish', 'German'];

        it('accepts a pair that leaves another pair open', async () => {
            const selection = { ...valid, languages: three, masteredLanguagePairs: [['English', 'Spanish']] };
            await expect(schema.validate(selection)).resolves.toEqual(selection);
        });

        it('rejects pairs that cover every pair of the selected languages', async () => {
            const selection = { ...valid, masteredLanguagePairs: [['English', 'Spanish']] };
            await expect(schema.validate(selection)).rejects.toThrow('account:masteredPairs.errors.allMastered');
        });

        it('ignores a pair that uses a language that is no longer selected', async () => {
            const selection = { ...valid, masteredLanguagePairs: [['English', 'French']] };
            await expect(schema.validate(selection)).resolves.toBeDefined();
        });
    });
});
