import { describe, expect, it } from 'vitest';
import { buildProfileSchema, NO_NATIVE_LANGUAGE } from './schemas';

// Identity `t` — assert on the message keys, like the auth schema tests.
const t = (key: string) => key;
const schema = buildProfileSchema(t);

const valid = {
    name: 'Kai',
    username: 'kai',
    languages: ['English', 'Spanish'],
    nativeLanguage: NO_NATIVE_LANGUAGE,
    masteredLanguagePairs: [] as string[][],
};

describe('buildProfileSchema', () => {
    it('accepts a complete profile', async () => {
        await expect(schema.validate(valid)).resolves.toEqual(valid);
    });

    it('requires a name', async () => {
        await expect(schema.validate({ ...valid, name: '  ' })).rejects.toThrow(
            'loginRegister:errors.nameRequired',
        );
    });

    it('requires a username', async () => {
        await expect(schema.validate({ ...valid, username: '' })).rejects.toThrow(
            'loginRegister:errors.usernameRequired',
        );
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
            const profile = { ...valid, languages: three, masteredLanguagePairs: [['English', 'Spanish']] };
            await expect(schema.validate(profile)).resolves.toEqual(profile);
        });

        it('rejects pairs that cover every pair of the selected languages', async () => {
            const profile = { ...valid, masteredLanguagePairs: [['English', 'Spanish']] };
            await expect(schema.validate(profile)).rejects.toThrow('account:masteredPairs.errors.allMastered');
        });

        it('ignores a pair that uses a language that is no longer selected', async () => {
            const profile = { ...valid, masteredLanguagePairs: [['English', 'French']] };
            await expect(schema.validate(profile)).resolves.toBeDefined();
        });
    });
});
