/**
 * The `/practice` route's search-param contract (C5): the parameters live in
 * the URL, so a set-up can be shared or bookmarked, and a reload keeps it.
 * Same hand-rolled `validateSearch` pattern as `features/words/review/search.ts`.
 *
 *   ?lang=EN,ES&pos=Noun&pos=Verb&n=10&card=text&mode=mixed&mc=1&ti=2&order=weakest&native=include
 *
 * Short codes keep the URL readable. Every field is optional and every invalid
 * value is dropped (never an error): a stale or hand-typed URL falls back to
 * the remembered / default value for that field.
 *
 * Array and scalar coercions are the same as in the Review contract: the
 * router hands over repeated keys as arrays, numeric-looking strings as
 * numbers, and its own JSON-array round-trip, so all three shapes are accepted.
 */
import type { LangKey } from '@/features/words/types';
import { languageByKey, languageByLabel, UI_LANGUAGES } from '@/lib/language';
import type { PartOfSpeech } from '@/ts/enums';
import { AMOUNT_MAX, AMOUNT_MIN, knownLanguages, SELECTABLE_PARTS_OF_SPEECH } from './params';
import type {
    CardTypeParam,
    DifficultyMC,
    LanguageMode,
    PracticeParams,
    StrictnessTI,
    WordSelection,
} from './types';

export type CardCode = 'text' | 'choice' | 'random';
export type ModeCode = 'different' | 'same' | 'mixed';
export type OrderCode = 'weakest' | 'random';
export type NativeCode = 'include' | 'exclude';

export interface PracticeSearch {
    lang?: LangKey[];
    pos?: PartOfSpeech[];
    n?: number;
    card?: CardCode;
    mode?: ModeCode;
    mc?: DifficultyMC;
    ti?: StrictnessTI;
    order?: OrderCode;
    native?: NativeCode;
}

const CARD_TO_PARAM: Record<CardCode, CardTypeParam> = {
    text: 'Text-Input',
    choice: 'Multiple-Choice',
    random: 'Random',
};
const MODE_TO_PARAM: Record<ModeCode, LanguageMode> = {
    different: 'Multi-Language',
    same: 'Single-Language',
    mixed: 'Random',
};
const ORDER_TO_PARAM: Record<OrderCode, WordSelection> = {
    weakest: 'Exercise-Performance',
    random: 'Random',
};

const invert = <K extends string, V extends string>(map: Record<K, V>): Record<V, K> =>
    Object.fromEntries(Object.entries(map).map(([code, value]) => [value, code])) as Record<V, K>;

const PARAM_TO_CARD = invert(CARD_TO_PARAM);
const PARAM_TO_MODE = invert(MODE_TO_PARAM);
const PARAM_TO_ORDER = invert(ORDER_TO_PARAM);

// Only the four types the parameters screen offers — the enum has more (pronoun, …).
const POS_VALUES = new Set<string>(SELECTABLE_PARTS_OF_SPEECH);
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

/** A whole number from a number or numeric string, else `undefined`. */
function toInteger(value: unknown): number | undefined {
    const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof number === 'number' && Number.isInteger(number) ? number : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const orUndefined = <T>(values: T[]): T[] | undefined => (values.length > 0 ? values : undefined);

/** `validateSearch` for `/practice`. Never throws. */
export function validatePracticeSearch(search: Record<string, unknown>): PracticeSearch {
    const amount = toInteger(search.n);
    const mc = toInteger(search.mc);
    const ti = toInteger(search.ti);
    return {
        lang: orUndefined(
            Array.from(new Set(toStringArray(search.lang).filter((key): key is LangKey => LANG_KEYS.has(key)))),
        ),
        pos: orUndefined(
            Array.from(new Set(toStringArray(search.pos).filter((value): value is PartOfSpeech => POS_VALUES.has(value)))),
        ),
        // Out-of-range amounts are kept out of the URL contract: the form shows its own error for typed values.
        n: amount !== undefined && amount >= AMOUNT_MIN && amount <= AMOUNT_MAX ? amount : undefined,
        card: oneOf(search.card, ['text', 'choice', 'random']),
        mode: oneOf(search.mode, ['different', 'same', 'mixed']),
        mc: mc !== undefined && mc >= 0 && mc <= 3 ? (mc as DifficultyMC) : undefined,
        ti: ti !== undefined && ti >= 1 && ti <= 3 ? (ti as StrictnessTI) : undefined,
        order: oneOf(search.order, ['weakest', 'random']),
        native: oneOf(search.native, ['include', 'exclude']),
    };
}

/**
 * URL over `base` (the remembered or default settings) -> the settings to show.
 * Languages are limited to the account's own; if none of the URL's survive, the base
 * languages stay. The URL's order is kept (it is display-only: the server shuffles).
 */
export function searchToParams(
    search: PracticeSearch,
    base: PracticeParams,
    userLanguages: readonly string[],
): PracticeParams {
    const allowed = new Set<string>(knownLanguages(userLanguages));
    const fromUrl = (search.lang ?? [])
        .map((key) => languageByKey(key)?.label)
        .filter((label): label is string => label !== undefined && allowed.has(label));
    const languages = fromUrl.length > 0 ? knownLanguages(fromUrl) : base.languages;

    return {
        languages,
        partsOfSpeech: search.pos ?? base.partsOfSpeech,
        amount: search.n ?? base.amount,
        type: search.card ? CARD_TO_PARAM[search.card] : base.type,
        multiLang: search.mode ? MODE_TO_PARAM[search.mode] : base.multiLang,
        difficultyMC: search.mc ?? base.difficultyMC,
        strictnessTI: search.ti ?? base.strictnessTI,
        wordSelection: search.order ? ORDER_TO_PARAM[search.order] : base.wordSelection,
        excludeNative: search.native ? search.native === 'exclude' : base.excludeNative,
    };
}

/** Settings -> the full URL contract (every field written, so the URL alone reproduces them). */
export function paramsToSearch(params: PracticeParams): PracticeSearch {
    const lang = params.languages
        .map((label) => languageByLabel(label)?.key)
        .filter((key): key is LangKey => key !== undefined);
    return {
        lang: orUndefined(lang),
        pos: orUndefined([...params.partsOfSpeech]),
        // An invalid typed amount never reaches the URL.
        n: Number.isInteger(params.amount) && params.amount >= AMOUNT_MIN && params.amount <= AMOUNT_MAX ? params.amount : undefined,
        card: PARAM_TO_CARD[params.type],
        mode: PARAM_TO_MODE[params.multiLang],
        mc: params.difficultyMC,
        ti: params.strictnessTI,
        order: PARAM_TO_ORDER[params.wordSelection],
        native: params.excludeNative ? 'exclude' : 'include',
    };
}
