import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseHandoff, takeHandoffParams } from './handoff';

describe('parseHandoff', () => {
    it('reads both values and returns an empty remainder', () => {
        expect(parseHandoff('?lng=es&theme=dark')).toEqual({
            handoff: { lng: 'es', theme: 'dark' },
            cleanedSearch: '',
            found: true,
        });
    });

    it('accepts all four language codes, in any letter case', () => {
        for (const code of ['en', 'es', 'de', 'ee']) {
            expect(parseHandoff(`?lng=${code}`).handoff.lng).toBe(code);
        }
        expect(parseHandoff('?lng=DE&theme=LIGHT').handoff).toEqual({ lng: 'de', theme: 'light' });
    });

    it('ignores invalid values but still reports them as found, so the address is cleaned', () => {
        for (const search of ['?lng=fr', '?theme=system', '?theme=', '?lng', '?lng=%E0%A4%A']) {
            const result = parseHandoff(search);
            expect(result.handoff).toEqual({});
            expect(result.found).toBe(true);
            expect(result.cleanedSearch).toBe('');
        }
    });

    it('keeps every other parameter exactly as written', () => {
        const result = parseHandoff('?redirect=%2Freview%3Ftag%3Da&lng=es&x=1&theme=dark');
        expect(result.cleanedSearch).toBe('?redirect=%2Freview%3Ftag%3Da&x=1');
        expect(result.handoff).toEqual({ lng: 'es', theme: 'dark' });
    });

    it('reports nothing found when the keys are absent', () => {
        expect(parseHandoff('').found).toBe(false);
        expect(parseHandoff('?redirect=%2F').found).toBe(false);
        // a key that only contains the name is not the key
        expect(parseHandoff('?theme2=dark&mylng=es').found).toBe(false);
    });
});

describe('takeHandoffParams', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
        document.documentElement.removeAttribute('data-theme');
    });
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('applies and saves the theme, returns the language and cleans the address', () => {
        window.history.replaceState(null, '', '/login?lng=es&theme=dark');

        expect(takeHandoffParams()).toEqual({ lng: 'es', theme: 'dark' });

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem('ladu.theme')).toBe('dark');
        expect(window.location.pathname + window.location.search).toBe('/login');
    });

    it('beats a different saved choice (the address is the latest intent)', () => {
        localStorage.setItem('ladu.theme', 'light');
        window.history.replaceState(null, '', '/login?theme=dark');

        takeHandoffParams();

        expect(localStorage.getItem('ladu.theme')).toBe('dark');
    });

    it('keeps other parameters and the #fragment', () => {
        window.history.replaceState(null, '', '/login?redirect=%2Freview&lng=de#token=abc');

        takeHandoffParams();

        expect(window.location.pathname).toBe('/login');
        expect(window.location.search).toBe('?redirect=%2Freview');
        expect(window.location.hash).toBe('#token=abc');
    });

    it('does nothing (and does not touch the address) when no handoff key is present', () => {
        window.history.replaceState(null, '', '/login?redirect=%2Freview');

        expect(takeHandoffParams()).toEqual({});

        expect(window.location.search).toBe('?redirect=%2Freview');
        expect(localStorage.getItem('ladu.theme')).toBeNull();
    });

    it('saves nothing for an invalid theme, but still cleans the address', () => {
        window.history.replaceState(null, '', '/login?theme=system&lng=fr');

        expect(takeHandoffParams()).toEqual({});

        expect(localStorage.getItem('ladu.theme')).toBeNull();
        expect(window.location.search).toBe('');
    });
});
