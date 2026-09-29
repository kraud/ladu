import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { defaultParams } from './params';
import { loadRememberedParams, REMEMBERED_KEY, rememberParams } from './remembered';

const account = ['English', 'Spanish', 'German'];

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('remembered practice settings', () => {
    it('returns the defaults when nothing is stored', () => {
        expect(loadRememberedParams(account)).toEqual(defaultParams(account));
    });

    it('gives back what was remembered, including the typing strictness', () => {
        const params = {
            ...defaultParams(account),
            languages: [Lang.DE, Lang.ES],
            partsOfSpeech: [PartOfSpeech.verb],
            amount: 25,
            strictnessTI: 1 as const,
            excludeNative: true,
        };
        rememberParams(params);
        expect(loadRememberedParams(account)).toEqual(params);
    });

    it('ignores a broken or planted blob', () => {
        localStorage.setItem(REMEMBERED_KEY, '{not json');
        expect(loadRememberedParams(account)).toEqual(defaultParams(account));
        localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ n: 9999, card: 'drag', lang: ['XX'] }));
        expect(loadRememberedParams(account)).toEqual(defaultParams(account));
        localStorage.setItem(REMEMBERED_KEY, '"text"');
        expect(loadRememberedParams(account)).toEqual(defaultParams(account));
    });

    it('drops remembered languages the account no longer has', () => {
        rememberParams({ ...defaultParams(account), languages: [Lang.EN, Lang.DE] });
        expect(loadRememberedParams(['English', 'Spanish']).languages).toEqual([Lang.EN]);
    });

    it('does not throw when storage is unavailable', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => rememberParams(defaultParams(account))).not.toThrow();
        expect(loadRememberedParams(account)).toEqual(defaultParams(account));
    });
});
