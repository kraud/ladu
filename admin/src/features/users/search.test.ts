import { describe, expect, it } from 'vitest';
import { validateUsersSearch } from '@/features/users/search';

describe('validateUsersSearch', () => {
    it('keeps the login allowed filter, as text or as the boolean the router reads from a typed link', () => {
        expect(validateUsersSearch({ loginAllowed: 'true' }).loginAllowed).toBe('true');
        expect(validateUsersSearch({ loginAllowed: false }).loginAllowed).toBe('false');
        expect(validateUsersSearch({ verified: true }).verified).toBe('true');
        expect(validateUsersSearch({ loginAllowed: 'maybe' }).loginAllowed).toBeUndefined();
        expect(validateUsersSearch({ loginAllowed: 1 }).loginAllowed).toBeUndefined();
    });

    it('keeps valid values', () => {
        expect(validateUsersSearch({ q: ' kaja ', page: '3', sort: 'name', order: 'asc', verified: 'false', status: 'banned', method: 'google' })).toEqual({
            q: 'kaja',
            page: 3,
            sort: 'name',
            order: 'asc',
            verified: 'false',
            status: 'banned',
            method: 'google',
        });
    });

    it('drops anything malformed instead of failing', () => {
        expect(validateUsersSearch({ q: '   ', page: '0', sort: 'password', order: 'up', verified: 'maybe', status: ['x'], method: 7 })).toEqual({
            q: undefined,
            page: undefined,
            sort: undefined,
            order: undefined,
            verified: undefined,
            status: undefined,
            method: undefined,
        });
        expect(validateUsersSearch({ page: '1.5' }).page).toBeUndefined();
        expect(validateUsersSearch({ page: 'abc' }).page).toBeUndefined();
    });

    it('leaves page 1 out of the URL', () => {
        expect(validateUsersSearch({ page: 1 }).page).toBeUndefined();
    });
});
