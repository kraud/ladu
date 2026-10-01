import { describe, expect, it } from 'vitest';
import { apiRange, validateAuditSearch } from '@/features/audit/search';

const ID = '3c177fb8-235b-4259-9d77-40176ae26e77';

describe('validateAuditSearch', () => {
    it('keeps valid values', () => {
        expect(validateAuditSearch({ staff: ID, action: ' user.ban ', from: '2026-10-01', to: '2026-10-03', page: '3' })).toEqual({
            staff: ID,
            action: 'user.ban',
            from: '2026-10-01',
            to: '2026-10-03',
            page: 3,
        });
        expect(validateAuditSearch({ staff: 'system' }).staff).toBe('system');
    });

    it('drops anything malformed instead of failing', () => {
        expect(
            validateAuditSearch({ staff: 'bob', action: '   ', from: '1 Oct', to: '2026-02-31', page: '0' }),
        ).toEqual({ staff: undefined, action: undefined, from: undefined, to: undefined, page: undefined });
        expect(validateAuditSearch({ staff: ['x'], action: 5, from: 20261001, page: 'abc' })).toEqual({
            staff: undefined,
            action: undefined,
            from: undefined,
            to: undefined,
            page: undefined,
        });
        expect(validateAuditSearch({ action: 'x'.repeat(65) }).action).toBeUndefined();
    });

    it('refuses a day that does not exist, and accepts 29 February of a leap year', () => {
        expect(validateAuditSearch({ from: '2026-02-29' }).from).toBeUndefined();
        expect(validateAuditSearch({ from: '2028-02-29' }).from).toBe('2028-02-29');
    });

    it('leaves page 1 out of the URL', () => {
        expect(validateAuditSearch({ page: 1 }).page).toBeUndefined();
    });
});

describe('apiRange', () => {
    it('sends nothing for a day that is not set', () => {
        expect(apiRange({})).toEqual({ from: undefined, to: undefined });
    });

    it('starts at the beginning of the first day, and ends at the beginning of the day after the last', () => {
        const { from, to } = apiRange({ from: '2026-10-01', to: '2026-10-03' });

        expect(new Date(from as string).getTime()).toBe(new Date(2026, 9, 1).getTime());
        expect(new Date(to as string).getTime()).toBe(new Date(2026, 9, 4).getTime());
    });

    it('goes over the end of a month', () => {
        const { to } = apiRange({ to: '2026-10-31' });

        expect(new Date(to as string).getTime()).toBe(new Date(2026, 10, 1).getTime());
    });
});
