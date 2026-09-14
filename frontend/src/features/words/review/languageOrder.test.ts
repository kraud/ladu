import { describe, expect, it } from 'vitest';
import type { LangKey } from '@/features/words/types';
import {
    hideLanguage,
    initialOrder,
    moveWithinOrder,
    reconcileOrder,
    showLanguage,
} from './languageOrder';

describe('initialOrder', () => {
    it('is active first, then the rest of the account in account order', () => {
        expect(initialOrder(['EN', 'DE'], ['DE', 'EN', 'ES', 'EE'])).toEqual(['EN', 'DE', 'ES', 'EE']);
    });

    it('is just active when nothing is hidden', () => {
        expect(initialOrder(['EN', 'DE'], ['DE', 'EN'])).toEqual(['EN', 'DE']);
    });
});

describe('hideLanguage', () => {
    it('removes the language from Active when above the floor', () => {
        expect(hideLanguage(['EN', 'DE', 'ES'], 'DE')).toEqual(['EN', 'ES']);
    });

    it('refuses to drop below MIN_VISIBLE_LANGUAGES', () => {
        expect(hideLanguage(['EN', 'DE'], 'DE')).toBeNull();
    });

    it('is a no-op for a language that is not active', () => {
        expect(hideLanguage(['EN', 'DE', 'ES'], 'EE' as LangKey)).toBeNull();
    });
});

describe('showLanguage — re-inserts at its existing `order` position, never appends', () => {
    it('inserts between two active languages when that is where it already sits in order', () => {
        // ES sits between EN and DE in `order`, currently hidden.
        expect(showLanguage(['EN', 'ES', 'DE'], ['EN', 'DE'], 'ES')).toEqual(['EN', 'ES', 'DE']);
    });

    it('appends only when its `order` position is genuinely at the end', () => {
        expect(showLanguage(['EN', 'DE', 'ES'], ['EN', 'DE'], 'ES')).toEqual(['EN', 'DE', 'ES']);
    });

    it('prepends when its `order` position is genuinely at the start', () => {
        expect(showLanguage(['ES', 'EN', 'DE'], ['EN', 'DE'], 'ES')).toEqual(['ES', 'EN', 'DE']);
    });
});

describe('moveWithinOrder — swaps two Active languages, leaving any hidden one between them untouched', () => {
    it('moves an active language earlier, swapping it with its active neighbour', () => {
        // ES (hidden) sits between EN and DE — moving DE earlier must not disturb ES's position.
        const result = moveWithinOrder(['EN', 'ES', 'DE'], ['EN', 'DE'], 1, -1);
        expect(result?.order).toEqual(['DE', 'ES', 'EN']);
        expect(result?.active).toEqual(['DE', 'EN']);
    });

    it('moves an active language later', () => {
        const result = moveWithinOrder(['EN', 'DE'], ['EN', 'DE'], 0, 1);
        expect(result?.order).toEqual(['DE', 'EN']);
        expect(result?.active).toEqual(['DE', 'EN']);
    });

    it('is a no-op at the start of Active', () => {
        expect(moveWithinOrder(['EN', 'DE'], ['EN', 'DE'], 0, -1)).toBeNull();
    });

    it('is a no-op at the end of Active', () => {
        expect(moveWithinOrder(['EN', 'DE'], ['EN', 'DE'], 1, 1)).toBeNull();
    });

    it('never touches a hidden language\'s position', () => {
        const result = moveWithinOrder(['EN', 'ES', 'DE', 'EE'], ['EN', 'DE'], 0, 1);
        expect(result?.order).toEqual(['DE', 'ES', 'EN', 'EE']);
        expect(result?.order.indexOf('ES')).toBe(1);
        expect(result?.order.indexOf('EE')).toBe(3);
    });
});

describe('reconcileOrder', () => {
    it('leaves order untouched when it already agrees with active/allLanguages', () => {
        expect(reconcileOrder(['EN', 'ES', 'DE'], ['EN', 'DE'], ['EN', 'DE', 'ES'])).toEqual([
            'EN',
            'ES',
            'DE',
        ]);
    });

    it('returns the SAME array reference when nothing changed (lets React bail on the re-render)', () => {
        const prev: LangKey[] = ['EN', 'ES', 'DE'];
        expect(reconcileOrder(prev, ['EN', 'DE'], ['EN', 'DE', 'ES'])).toBe(prev);
    });

    it('drops a language no longer on the account', () => {
        expect(reconcileOrder(['EN', 'DE', 'ES'], ['EN', 'DE'], ['EN', 'DE'])).toEqual(['EN', 'DE']);
    });

    it('appends a newly-added account language', () => {
        expect(reconcileOrder(['EN', 'DE'], ['EN', 'DE'], ['EN', 'DE', 'EE'])).toEqual(['EN', 'DE', 'EE']);
    });

    it('rebuilds when `active` changed from outside (order no longer agrees)', () => {
        // `order` still has EN before DE, but `active` (e.g. a direct URL edit) now says DE before EN.
        expect(reconcileOrder(['EN', 'DE'], ['DE', 'EN'], ['EN', 'DE'])).toEqual(['DE', 'EN']);
    });
});
