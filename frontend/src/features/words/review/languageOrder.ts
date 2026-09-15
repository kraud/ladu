/**
 * Pure array logic behind `LanguageOrderControl`, split out for direct unit
 * testing (the same reasoning `row.ts` / `completion.ts` already apply to
 * the rest of the review feature).
 *
 * The model: a single stable `order` array holding every account language —
 * owned by `LanguageOrderControl` as local state, since only the *visible*
 * subset's order is ever persisted to the URL (`active`/`search.lang`).
 * Toggling a language's visibility must never move it — hiding removes it
 * from `active` but leaves `order` untouched; showing re-inserts it into
 * `active` at the position `order` already has it in, rather than appending
 * it. Reordering (the ← / → arrows) only ever swaps two currently-visible
 * languages, wherever they sit in `order` — so a hidden language sitting
 * between them is never disturbed by that swap either.
 */
import type { LangKey } from '@/features/words/types';
import { MIN_VISIBLE_LANGUAGES } from './search';

/** The starting `order`: visible languages first (in their given order), then hidden ones in account order. */
export function initialOrder(active: LangKey[], allLanguages: LangKey[]): LangKey[] {
    return [...active, ...allLanguages.filter((key) => !active.includes(key))];
}

/**
 * Keeps `prev` (the current `order` state) in step with the account's
 * language set and, when `active` changed from OUTSIDE this component's own
 * actions (a direct URL edit, browser back/forward — never this component's
 * own `onChange`, whose round-trip always leaves `order` already consistent
 * with the new `active`), rebuilds from scratch rather than silently
 * disagreeing with the URL.
 */
export function reconcileOrder(prev: LangKey[], active: LangKey[], allLanguages: LangKey[]): LangKey[] {
    const next = prev.filter((key) => allLanguages.includes(key));
    for (const key of allLanguages) {
        if (!next.includes(key)) next.push(key);
    }
    const visibleSubset = next.filter((key) => active.includes(key));
    const matchesActive =
        visibleSubset.length === active.length && visibleSubset.every((key, i) => key === active[i]);
    if (!matchesActive) return initialOrder(active, allLanguages);
    // Same content as `prev`? Return `prev` itself — React's `setState` bails
    // out on a functional updater that returns the identical reference,
    // skipping a re-render that would otherwise fire on every `active`/
    // `allLanguages` change even when nothing here actually needed to move.
    if (next.length === prev.length && next.every((key, i) => key === prev[i])) return prev;
    return next;
}

/** Drops a language from Active. `null` when doing so would breach the min-visible floor. */
export function hideLanguage(active: LangKey[], key: LangKey): LangKey[] | null {
    if (active.length <= MIN_VISIBLE_LANGUAGES) return null;
    if (!active.includes(key)) return null;
    return active.filter((k) => k !== key);
}

/** Re-inserts a hidden language into Active at its existing `order` position — never appended. */
export function showLanguage(order: LangKey[], active: LangKey[], key: LangKey): LangKey[] {
    return order.filter((k) => active.includes(k) || k === key);
}

/** Swaps two languages' positions in `order`, wherever they currently sit. A no-op if either is missing. */
function swapInOrder(order: LangKey[], a: LangKey, b: LangKey): LangKey[] {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 || ib === -1) return order;
    const next = [...order];
    [next[ia], next[ib]] = [next[ib], next[ia]];
    return next;
}

/**
 * Moves the Active item at `index` one step earlier (`delta: -1`) or later
 * (`delta: 1`), by swapping it with its Active neighbour in `order` — so any
 * hidden language sitting between them in `order` stays exactly where it is.
 * `null` at the edge of Active (nothing to swap with).
 */
export function moveWithinOrder(
    order: LangKey[],
    active: LangKey[],
    index: number,
    delta: -1 | 1,
): { order: LangKey[]; active: LangKey[] } | null {
    const neighborIndex = index + delta;
    if (neighborIndex < 0 || neighborIndex >= active.length) return null;
    const newOrder = swapInOrder(order, active[index], active[neighborIndex]);
    const newActive = newOrder.filter((key) => active.includes(key));
    return { order: newOrder, active: newActive };
}
