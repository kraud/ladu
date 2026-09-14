/**
 * The Review route's search-param contract (`?pos=&gender=&q=&lang=`) — D6/D10.
 * A hand-rolled `validateSearch`, matching the only existing precedent in the
 * router (`loginRoute`, `app/router.tsx`), just larger: real vocabulary
 * filtering instead of one `typeof` check, so it gets its own module and its
 * own unit tests rather than living inline.
 *
 * ## Why the parser accepts three different array shapes
 *
 * The router's *decoder* (`qss.decode`) already turns a repeated key
 * (`?pos=Noun&pos=Verb`) into an array for free. Its *encoder* cannot emit
 * that form at all — TanStack's own `qss.encode` is one-value-per-key by
 * design — so writing `{ pos: ['Noun','Verb'] }` back to the URL falls
 * through to the JSON-parseable branch and produces `pos=%5B%22Noun%22...%5D`
 * (`?pos=["Noun","Verb"]`, URL-encoded). A hand-typed URL (or the mockup's
 * own convention) is more likely to use a bare comma list, `?pos=Noun,Verb`.
 * All three therefore have to parse to the same array: repeated keys, one
 * comma-joined value, or the router's own JSON-array round-trip.
 *
 * Two coercions the router applies BEFORE this function ever sees a value
 * also have to be undone here:
 *   - `qss.toValue` turns a numeric- or boolean-looking string into a real
 *     number/boolean (`?q=2024` arrives as the number `2024`, not `"2024"`).
 *   - `defaultParseSearch`'s JSON branch additionally `JSON.parse`s any value
 *     starting with `[`, `{`, a digit, `-`, `"`, `true`/`false`/`null` — which
 *     is exactly how the router's own re-stringified array comes back in.
 *
 * `gender` is intentionally passed through as free strings with no vocabulary
 * validation — the stored vocabulary (v2 enum values vs. legacy DB spellings)
 * is unresolved until Slice 7 builds the filter chips against real data.
 */
import type { LangKey } from '@/features/words/types';
import type { WordListFilters } from '@/features/words/types';
import { PartOfSpeech } from '@/ts/enums';
import { UI_LANGUAGES, languageByLabel } from '@/lib/language';

export interface ReviewSearch {
    /** Local search box (Slice 7); matched server-side against any stored case word. */
    q?: string;
    pos?: PartOfSpeech[];
    /** Raw stored gender case words, passed through verbatim (see the module note above). */
    gender?: string[];
    /** Column order (D6) — `LangKey` values, not full labels, to keep the URL short. */
    lang?: LangKey[];
}

const POS_VALUES = new Set<string>(Object.values(PartOfSpeech));
const LANG_KEYS = new Set<string>(UI_LANGUAGES.map((entry) => entry.key));

/** Any of: an array (repeated key / JSON), a comma-joined string, or a single coerced value. */
function toStringArray(value: unknown): string[] {
    const raw = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
    return raw
        .flatMap((item) => {
            if (typeof item === 'string') return item.split(',');
            if (typeof item === 'number' || typeof item === 'boolean') return [String(item)];
            return [];
        })
        .map((item) => item.trim())
        .filter((item) => item !== '');
}

/** Undoes `qss.toValue`'s numeric/boolean coercion for a scalar search param. */
function toOptionalString(value: unknown): string | undefined {
    const text =
        typeof value === 'string'
            ? value
            : typeof value === 'number' || typeof value === 'boolean'
              ? String(value)
              : '';
    const trimmed = text.trim();
    return trimmed === '' ? undefined : trimmed;
}

/** Empty arrays collapse to `undefined` so the encoder omits the key entirely and URLs stay clean. */
function orUndefined<T>(values: T[]): T[] | undefined {
    return values.length > 0 ? values : undefined;
}

/**
 * `validateSearch` for `/review`. Every field is optional — `AppHeader`'s
 * `<Link to="/review">` passes no `search` at all, and a required key here
 * would fail that call at `tsc -b`.
 */
export function validateReviewSearch(search: Record<string, unknown>): ReviewSearch {
    return {
        q: toOptionalString(search.q),
        pos: orUndefined(
            toStringArray(search.pos).filter((value): value is PartOfSpeech => POS_VALUES.has(value)),
        ),
        gender: orUndefined(toStringArray(search.gender)),
        lang: orUndefined(
            toStringArray(search.lang).filter((value): value is LangKey => LANG_KEYS.has(value)),
        ),
    };
}

/** Search params -> the list-query filters. `lang` is display-only and never reaches the query key. */
export function reviewSearchToFilters(search: ReviewSearch): WordListFilters {
    return { q: search.q, pos: search.pos, gender: search.gender };
}

/** Picks between the two empty states: filtered-to-nothing vs. genuinely no words yet. */
export function hasActiveFilters(search: ReviewSearch): boolean {
    return search.q !== undefined || search.pos !== undefined || search.gender !== undefined;
}

/**
 * URL order wins; anything the URL omits (or an unrecognised/stale label) is
 * appended in the user's own account order, so a partial or bad `?lang=` can
 * never lose a column outright.
 */
export function resolveLanguageOrder(
    fromUrl: LangKey[] | undefined,
    userLanguages: readonly string[],
): LangKey[] {
    const base: LangKey[] = [];
    for (const label of userLanguages) {
        const entry = languageByLabel(label);
        if (entry) base.push(entry.key);
    }
    if (!fromUrl) return base;
    const allowed = new Set(base);
    const ordered = fromUrl.filter((key) => allowed.has(key));
    return [...ordered, ...base.filter((key) => !ordered.includes(key))];
}
