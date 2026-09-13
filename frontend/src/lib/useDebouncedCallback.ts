/**
 * Debounces a changing value, per hook instance — replaces the old app's
 * module-global `setTimerTriggerFunction` (a single shared `setTimeout` id
 * used by every autocomplete-driving field across the whole app, so two
 * fields debouncing at once would cancel each other's timers). Each call to
 * this hook owns its own timer, cleaned up on unmount or on the next change.
 *
 * Named for the file the phase plan reserved (`useDebouncedCallback.ts`), but
 * exports a value-debounce, not a callback-debounce: `AutocompleteRow` only
 * ever needs "the field's value, settled" — wrapping a callback would just
 * make callers re-memoize a function for no behavioural gain.
 */
import { useEffect, useState } from 'react';

export function useDebouncedCallback<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}
