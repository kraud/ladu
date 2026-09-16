/**
 * Chart series colours — reuses existing design tokens rather than a new
 * palette (`MOCKUPS/dashboard.html:247`'s hex values are byte-identical to
 * these). Both charts consume these through props (`PieChart`/`BarChart` are
 * colour-agnostic), so this is the one place a series-to-colour mapping is
 * decided.
 */
import { PartOfSpeech } from '@/ts/enums';
import { langTint } from '@/lib/language';

const POS_COLOR_VAR: Partial<Record<PartOfSpeech, string>> = {
    [PartOfSpeech.noun]: 'var(--accent)',
    [PartOfSpeech.verb]: 'var(--lang-es)',
    [PartOfSpeech.adjective]: 'var(--warning)',
    [PartOfSpeech.adverb]: 'var(--lang-gb)',
};

/** `CREATABLE_POS` -> a CSS colour (`var(...)`) reference. Unknown/uncreatable PoS fall back to `--accent`. */
export function posColor(pos: PartOfSpeech): string {
    return POS_COLOR_VAR[pos] ?? 'var(--accent)';
}

/** A `UI_LANGUAGES` label (e.g. `"English"`) -> its `--lang-*` token, via `lib/language.ts`'s existing lookup. */
export function langColor(label: string): string {
    return langTint(label);
}
