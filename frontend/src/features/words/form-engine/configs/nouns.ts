/**
 * Noun form configs, one per language, derived from the `WordCasesData.Noun`
 * registry (`ts/wordCasesDataByPoS.ts`) plus two structural fields the
 * registry does not carry at all: `regularity` (all four languages) and
 * `gender` (ES/DE/FR — anchored on the registry's own gender rows).
 *
 * Field order and the regression test both key off `forms-nouns.md`:
 * [gender if present] -> regularity -> the remaining registry rows in
 * registry order (singular/plural pairs, then EE's `shortForm`).
 */
import { DeclensionNoun, GenderDE, GenderES, GenderFR, Lang, NounCases, PartOfSpeech, Plurality, VerbRegularity } from '@/ts/enums';
import { NounPropertyCategories, WordCasesData, type NounCasesData } from '@/ts/wordCasesDataByPoS';
import { LANG_SUFFIX } from '@/lib/language';
import type { FieldConfig, FieldLayout, RadioFieldConfig, TextFieldConfig, TranslationFormConfig } from './types';

const GENDER_OPTIONS: Partial<Record<Lang, RadioFieldConfig['options']>> = {
    [Lang.ES]: Object.values(GenderES).map((value) => ({ value, label: value })),
    [Lang.DE]: Object.values(GenderDE).map((value) => ({ value, label: value })),
    [Lang.FR]: Object.values(GenderFR).map((value) => ({ value, label: value })),
};

const REGULARITY_OPTIONS: RadioFieldConfig['options'] = Object.values(VerbRegularity).map((value) => ({
    value,
    label: value,
}));

/** `NounCases.singularNominativDE` + `'DE'` -> `"singularNominativ"` — the old app's own per-language field name. */
function stripLangSuffix(caseName: string, suffix: string): string {
    return caseName.slice(0, caseName.length - suffix.length);
}

function labelKey(caseName: string): string {
    return `wordRelated:wordForm.noun.fields.${caseName}`;
}

/** `wordRelated:wordForm.noun.errors.form{EN,ES,DE,EE}.<key>` — the per-language noun error block already in `wordRelated.json`. */
function nounErrorKey(suffix: string, key: string): string {
    return `wordRelated:wordForm.noun.errors.form${suffix}.${key}`;
}

function toTextField(row: NounCasesData, suffix: string, lowercase: boolean, capitalize: boolean): TextFieldConfig {
    const required = !row.isNounProperty && row.plurality === Plurality.S && row.declination === DeclensionNoun.nominative;
    return {
        kind: 'text',
        name: stripLangSuffix(row.caseName, suffix),
        caseName: row.caseName,
        labelKey: labelKey(row.caseName),
        required,
        requiredMessageKey: required ? nounErrorKey(suffix, 'singularFormRequired') : undefined,
        lowercase,
        capitalize: capitalize || undefined,
        // Pairs a case's singular and plural onto the same row (EE's `shortForm` property
        // row has no plurality/declination of its own and stays full-width, unpaired).
        layout: row.isNounProperty ? undefined : { row: row.declination, column: row.plurality },
    };
}

/**
 * Gender and regularity share one row, equal in width, on a phone too (`fitRow`) — for the languages
 * that have a gender (ES, DE, FR). Its cells align at the top (`alignTop`): on a phone the options of one
 * radio group can wrap, and the two labels must still line up. Its own `block`, so it does not merge with the
 * declension rows below.
 */
function metaLayout(column: 'gender' | 'regularity'): FieldLayout {
    return { row: 'meta', column, block: 'nounMeta', fitRow: true, alignTop: true };
}

function toGenderField(row: NounCasesData, lang: Lang): RadioFieldConfig {
    const suffix = LANG_SUFFIX[lang];
    return {
        kind: 'radio',
        name: stripLangSuffix(row.caseName, suffix),
        caseName: row.caseName,
        labelKey: labelKey(row.caseName),
        required: true,
        requiredMessageKey: nounErrorKey(suffix, 'genderRequired'),
        invalidMessageKey: nounErrorKey(suffix, 'genderRequired'),
        options: GENDER_OPTIONS[lang] ?? [],
        layout: metaLayout('gender'),
    };
}

function regularityField(lang: Lang, withGender: boolean): RadioFieldConfig {
    const suffix = LANG_SUFFIX[lang];
    const caseName = NounCases[`regularity${suffix}` as keyof typeof NounCases];
    return {
        kind: 'radio',
        name: 'regularity',
        caseName,
        labelKey: labelKey(caseName),
        required: false,
        invalidMessageKey: nounErrorKey(suffix, 'regularityRequired'),
        options: REGULARITY_OPTIONS,
        layout: withGender ? metaLayout('regularity') : undefined,
    };
}

function buildNounConfig(lang: Lang): TranslationFormConfig {
    const suffix = LANG_SUFFIX[lang];
    const rows = WordCasesData.Noun.filter((row) => row.language === lang);
    const genderRow = rows.find(
        (row) => row.isNounProperty && row.nounPropertyCategory === NounPropertyCategories.gender
    );
    const otherRows = rows.filter((row) => row !== genderRow);
    const lowercase = lang !== Lang.DE;

    const fields: FieldConfig[] = [];
    if (genderRow) {
        fields.push(toGenderField(genderRow, lang));
    }
    fields.push(regularityField(lang, genderRow !== undefined));
    for (const row of otherRows) {
        fields.push(toTextField(row, suffix, lowercase, lang === Lang.DE));
    }

    return { pos: PartOfSpeech.noun, lang, fields };
}

export const NOUN_CONFIGS: Partial<Record<Lang, TranslationFormConfig>> = {
    [Lang.EN]: buildNounConfig(Lang.EN),
    [Lang.ES]: buildNounConfig(Lang.ES),
    [Lang.DE]: buildNounConfig(Lang.DE),
    [Lang.EE]: buildNounConfig(Lang.EE),
    [Lang.FR]: buildNounConfig(Lang.FR),
};
