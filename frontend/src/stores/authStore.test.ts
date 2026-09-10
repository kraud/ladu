import { beforeEach, describe, expect, it } from 'vitest';
import { toSessionUser, useAuthStore, type RawUser } from './authStore';
import { expiredToken, futureToken } from '@/test/tokens';

const STORAGE_KEY = 'ladu.session';

beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clearSession();
});

describe('toSessionUser — normalizes every backend shape', () => {
    it('login shape: nativeLanguage key omitted', () => {
        const raw: RawUser = {
            id: 'u1',
            name: 'Ada',
            email: 'ada@example.com',
            username: 'ada',
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            verified: true,
            token: 'tok-login',
        };
        expect(toSessionUser(raw)).toEqual({
            id: 'u1',
            name: 'Ada',
            email: 'ada@example.com',
            username: 'ada',
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            nativeLanguage: null,
            verified: true,
        });
    });

    it('verify / getMe shape: full row', () => {
        const raw: RawUser = {
            id: 'u2',
            name: 'Bo',
            email: 'bo@example.com',
            username: 'bo',
            languages: [],
            uiLanguage: 'German',
            nativeLanguage: 'German',
            verified: true,
        };
        const session = toSessionUser(raw);
        expect(session.id).toBe('u2');
        expect(session.nativeLanguage).toBe('German');
    });

    it('register shape: verified false is preserved', () => {
        expect(toSessionUser({ id: 'u4', email: 'd@x.com', verified: false }).verified).toBe(false);
    });

    it('a missing verified flag (nullable column) is treated as verified', () => {
        expect(toSessionUser({ id: 'u5', email: 'e@x.com', verified: null }).verified).toBe(true);
        expect(toSessionUser({ id: 'u6', email: 'f@x.com' }).verified).toBe(true);
    });

    it('falls back for a missing id and a non-array languages value', () => {
        const session = toSessionUser({ email: 'g@x.com', languages: 'English' as unknown as string[] });
        expect(session.id).toBe('');
        expect(session.languages).toEqual([]);
        expect(session.uiLanguage).toBe('English');
    });
});

describe('setSession — token resolution', () => {
    it('takes the token embedded in the login response', () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', token: 'tok-login' });
        expect(useAuthStore.getState().token).toBe('tok-login');
    });

    it('keeps the existing token when a getMe refresh carries none', () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', token: 'tok-login' });
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', name: 'Ada refreshed' });
        expect(useAuthStore.getState().token).toBe('tok-login');
        expect(useAuthStore.getState().user?.name).toBe('Ada refreshed');
    });

    it('prefers an explicit token argument', () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', token: 'embedded' }, 'explicit');
        expect(useAuthStore.getState().token).toBe('explicit');
    });

    it('clearSession wipes user and token', () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', token: 't' });
        useAuthStore.getState().clearSession();
        expect(useAuthStore.getState()).toMatchObject({ user: null, token: null });
    });
});

describe('guarded rehydration', () => {
    it('discards a malformed localStorage blob without throwing', async () => {
        localStorage.setItem(STORAGE_KEY, '{ this is not json');
        await expect(useAuthStore.persist.rehydrate()).resolves.not.toThrow();
        expect(useAuthStore.getState().user).toBeNull();

        // The garbage is gone; whatever remains (an empty re-persist) is valid JSON.
        const stored = localStorage.getItem(STORAGE_KEY);
        expect(stored).not.toContain('this is not json');
        if (stored !== null) {
            expect(() => JSON.parse(stored) as unknown).not.toThrow();
        }
    });

    it('drops a persisted session whose token has expired', async () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ state: { user: { id: 'u1', email: 'a@x.com' }, token: expiredToken() }, version: 0 }),
        );
        await useAuthStore.persist.rehydrate();
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().token).toBeNull();
    });

    it('drops a persisted session whose user shape is invalid', async () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ state: { user: { name: 'no id or email' }, token: futureToken() }, version: 0 }),
        );
        await useAuthStore.persist.rehydrate();
        expect(useAuthStore.getState().user).toBeNull();
    });

    it('restores a valid, unexpired persisted session', async () => {
        const token = futureToken();
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ state: { user: { id: 'u1', email: 'a@x.com' }, token }, version: 0 }),
        );
        await useAuthStore.persist.rehydrate();
        expect(useAuthStore.getState().user).toMatchObject({ id: 'u1', email: 'a@x.com' });
        expect(useAuthStore.getState().token).toBe(token);
    });
});
