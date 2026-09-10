import { describe, expect, it } from 'vitest';
import { buildProfileSchema } from './schemas';

// Identity `t` — assert on the message keys, like the auth schema tests.
const t = (key: string) => key;
const schema = buildProfileSchema(t);

const valid = { name: 'Kai', username: 'kai', languages: ['English', 'Spanish'] };

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
});
