import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { turnstileLanguage } from './turnstile';

const scripts = () => document.querySelectorAll('script[src*="challenges.cloudflare.com"]');

afterEach(() => {
    delete window.turnstile;
    scripts().forEach((script) => script.remove());
});

describe('turnstileLanguage', () => {
    it('passes English, Spanish, German and French on, and leaves Estonian (not supported by Turnstile) to "auto"', () => {
        expect(turnstileLanguage('en')).toBe('en');
        expect(turnstileLanguage('es')).toBe('es');
        expect(turnstileLanguage('de-AT')).toBe('de');
        expect(turnstileLanguage('fr-CA')).toBe('fr');
        expect(turnstileLanguage('ee')).toBe('auto');
        expect(turnstileLanguage('')).toBe('auto');
    });
});

describe('loadTurnstile', () => {
    // The loader keeps its promise in the module, so each test loads a fresh copy of it.
    let loadTurnstile: typeof import('./turnstile').loadTurnstile;
    beforeEach(async () => {
        vi.resetModules();
        ({ loadTurnstile } = await import('./turnstile'));
    });

    it('adds the script once (explicit render), shares the promise, and resolves when the API is there', async () => {
        const first = loadTurnstile();
        const second = loadTurnstile();
        expect(scripts()).toHaveLength(1);
        expect((scripts()[0] as HTMLScriptElement).src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');

        const api = { render: () => 'id', reset: () => undefined, remove: () => undefined };
        window.turnstile = api;
        (scripts()[0] as HTMLScriptElement).onload?.(new Event('load'));

        await expect(first).resolves.toBe(api);
        await expect(second).resolves.toBe(api);
    });

    it('rejects when the script cannot load, and the next call tries again', async () => {
        const failed = loadTurnstile();
        (scripts()[0] as HTMLScriptElement).onerror?.(new Event('error'));
        await expect(failed).rejects.toThrow('Turnstile did not load');
        expect(scripts()).toHaveLength(0);

        const again = loadTurnstile();
        expect(scripts()).toHaveLength(1);
        window.turnstile = { render: () => 'id', reset: () => undefined, remove: () => undefined };
        (scripts()[0] as HTMLScriptElement).onload?.(new Event('load'));
        await expect(again).resolves.toBeDefined();
    });
});
