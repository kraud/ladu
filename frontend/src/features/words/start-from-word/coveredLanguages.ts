/**
 * The languages a type-ahead line shows as flags: the languages the sense covers, only those of the
 * account, without the start language (the typed word is already in it). At most `max` flags show;
 * `more` counts the rest, for the "+N" badge.
 */
export const MAX_COVERED_FLAGS = 4;

export function coveredLanguages(
    covered: readonly string[],
    startLanguage: string,
    accountLanguages: readonly string[],
    max: number = MAX_COVERED_FLAGS,
): { shown: string[]; more: number } {
    const others = covered.filter((language) => language !== startLanguage && accountLanguages.includes(language));
    return { shown: others.slice(0, max), more: Math.max(0, others.length - max) };
}
