import { useSyncExternalStore } from 'react';
import type { CreateOnboardingResponse } from './types';

/**
 * The result of the onboarding, for the dashboard card (onboarding.md D28). It stays until the user
 * closes the card, and it belongs to this browser, so it lives in `localStorage` (never throws here).
 * It holds the account id too: another account on the same browser must not see it.
 */
const KEY = 'ladu.onboardingResult';

export interface StoredResult extends CreateOnboardingResponse {
    userId: string;
}

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: StoredResult | null = null;

function read(): StoredResult | null {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(KEY);
    } catch {
        /* storage unavailable: no card */
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    cachedValue = null;
    if (raw) {
        try {
            const value = JSON.parse(raw) as StoredResult;
            if (typeof value.userId === 'string' && typeof value.words === 'number' && Array.isArray(value.tags)) {
                cachedValue = value;
            }
        } catch {
            /* a damaged value is the same as none */
        }
    }
    return cachedValue;
}

function notify() {
    listeners.forEach((listener) => listener());
}

export function saveOnboardingResult(userId: string, result: CreateOnboardingResponse): void {
    try {
        localStorage.setItem(KEY, JSON.stringify({ userId, words: result.words, tags: result.tags }));
    } catch {
        /* quota or unavailable: the card is only a courtesy */
    }
    notify();
}

export function dismissOnboardingResult(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        /* nothing to remove */
    }
    notify();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    window.addEventListener('storage', listener);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', listener);
    };
}

/** The stored result of the given account, or null (none, closed, or another account's). */
export function useOnboardingResult(userId: string | undefined): StoredResult | null {
    const value = useSyncExternalStore(subscribe, read, () => null);
    return value && userId && value.userId === userId ? value : null;
}
