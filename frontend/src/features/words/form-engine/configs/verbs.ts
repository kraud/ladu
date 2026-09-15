/**
 * Verb form configs, one per language, derived from the `WordCasesData.Verb`
 * registry (`ts/wordCasesDataByPoS.ts`) plus a manifest layered over it —
 * unlike `nouns.ts`'s plain filter, because the registry is both a superset
 * (Spanish's conditional/imperative rows and compound non-finites are never
 * rendered) and, for `regularity`, entirely absent for German/Estonian.
 * `regularity` is therefore always synthesized directly from `VerbCases`,
 * never registry-filtered — exactly `nouns.ts`'s `regularityField` pattern,
 * just reused here for a field the registry sometimes (EN/ES) also happens
 * to carry, so that registry row is excluded via `isTenseRow` filtering
 * (property rows never enter `tenseRows` at all).
 *
 * Pronoun labels ("Yo", "Ich", "Mina"...) and tense/mood group headings
 * ("Modo indicativo", "Präsens", "Kindel"...) are hardcoded native
 * grammatical terms, not i18n keys — the snapshot documents exactly one
 * label per target language, never four (see the Slice 2 plan). Only
 * genuinely UI-descriptive field labels ("Infinitive", "Auxiliary verb"...)
 * go through `wordRelated:wordForm.verb.fields.*`.
 *
 * Field order and lists both key off `forms-verbs.md`'s "Rendered field
 * order" per language.
 */
import {
    AuxVerbDE,
    Lang,
    PartOfSpeech,
    Plurality,
    PrefixesVerbDE,
    TenseVerbDE,
    TenseVerbEE,
    TenseVerbEN,
    TenseVerbES,
    VerbCaseTypeDE,
    VerbCases,
    VerbMoodES,
    VerbRegularity,
} from '@/ts/enums';
import { WordCasesData, type VerbCasesData, type VerbTenseData } from '@/ts/wordCasesDataByPoS';
import type {
    CheckboxFieldConfig,
    FieldAdornment,
    FieldConfig,
    FieldGroup,
    FieldLayout,
    FieldPattern,
    RadioOption,
    TextFieldConfig,
    TranslationFormConfig,
} from './types';

const LANG_SUFFIX: Record<Lang, 'EN' | 'ES' | 'DE' | 'EE'> = {
    [Lang.EN]: 'EN',
    [Lang.ES]: 'ES',
    [Lang.DE]: 'DE',
    [Lang.EE]: 'EE',
};

const REGULARITY_OPTIONS: RadioOption[] = Object.values(VerbRegularity).map((value) => ({ value, label: value }));

/** `VerbCases.simplePresent1sEN` + `'EN'` -> `"simplePresent1s"` — the old app's own per-language field name. */
function stripLangSuffix(caseName: string, suffix: string): string {
    return caseName.slice(0, caseName.length - suffix.length);
}

function labelKey(caseName: string): string {
    return `wordRelated:wordForm.verb.fields.${caseName}`;
}

/** `wordRelated:wordForm.verb.errors.form{EN,ES,DE,EE}.<key>` — the per-language verb error block already in `wordRelated.json`. */
function verbErrorKey(suffix: string, key: string): string {
    return `wordRelated:wordForm.verb.errors.form${suffix}.${key}`;
}

/** Narrows a registry row to its tense-conjugation shape, excluding every property row (`regularity`, `infinitive`, `auxiliaryVerb`...). */
function isTenseRow(row: VerbCasesData): row is VerbCasesData & VerbTenseData {
    return !row.isVerbProperty;
}

function regularityField(lang: Lang): FieldConfig {
    const suffix = LANG_SUFFIX[lang];
    const caseName = VerbCases[`regularity${suffix}` as keyof typeof VerbCases];
    return {
        kind: 'radio',
        name: 'regularity',
        caseName,
        labelKey: labelKey(caseName),
        required: false,
        invalidMessageKey: verbErrorKey(suffix, 'regularityRequired'),
        options: REGULARITY_OPTIONS,
    };
}

function requiredTextField(
    caseName: VerbCases,
    name: string,
    requiredMessageKey: string,
    pattern?: FieldPattern,
    layout?: FieldLayout
): TextFieldConfig {
    return {
        kind: 'text',
        name,
        caseName,
        labelKey: labelKey(caseName),
        required: true,
        requiredMessageKey,
        lowercase: true,
        pattern,
        layout,
    };
}

// ---- pronoun labels — native grammatical terms, never i18n (see file header) ----
type PronounSlot = '1S' | '2S' | '3S' | '1P' | '2P' | '3P';

function slotOf(row: VerbTenseData): PronounSlot {
    return `${row.person}${row.plurality === Plurality.S ? 'S' : 'P'}` as PronounSlot;
}

const PRONOUN_LABELS: Record<Lang, Partial<Record<PronounSlot, string>>> = {
    [Lang.EN]: { '1S': 'I', '2S': 'You', '3S': 'He/She/it', '1P': 'We', '3P': 'They' },
    [Lang.ES]: {
        '1S': 'Yo',
        '2S': 'Vos',
        '3S': 'Él/Ella/eso',
        '1P': 'Nosotros/as',
        '2P': 'Ustedes',
        '3P': 'Ellos/as',
    },
    [Lang.DE]: { '1S': 'Ich', '2S': 'Du', '3S': 'Er/Sie/es', '1P': 'Wir', '2P': 'Ihr', '3P': 'Sie' },
    [Lang.EE]: { '1S': 'Mina', '2S': 'Sina', '3S': 'Tema', '1P': 'Meie', '2P': 'Teie', '3P': 'Nad' },
};

function pronounLabel(lang: Lang, row: VerbTenseData): string {
    return PRONOUN_LABELS[lang][slotOf(row)] ?? '';
}

/** Pronoun -> row, tense -> column: each tense becomes a side-by-side column, with the tense name printed once as its caption. */
function tenseLayout(row: VerbTenseData, columnHeading: string): FieldLayout {
    return { row: slotOf(row), column: row.tense, columnHeading };
}

// ---- tense/mood group headings — also hardcoded native terms ----
const EN_TOP_GROUP: FieldGroup = { heading: 'Simple', level: 1 };
const EN_TENSE_HEADINGS: Partial<Record<TenseVerbEN, string>> = {
    [TenseVerbEN.presentSimple]: 'Present',
    [TenseVerbEN.pastSimple]: 'Past',
    [TenseVerbEN.futureSimple]: 'Future',
    [TenseVerbEN.conditionalSimple]: 'Conditional',
};

const ES_MOOD_GROUP: FieldGroup = { heading: 'Modo indicativo', level: 1 };
const ES_SIMPLE_TENSE_GROUP: FieldGroup = { heading: 'Tiempo simple', level: 2 };
const ES_TENSE_HEADINGS: Partial<Record<TenseVerbES, string>> = {
    [TenseVerbES.present]: 'Presente',
    [TenseVerbES.imperfectPast]: 'Pretérito imperfecto',
    [TenseVerbES.perfectSimplePast]: 'Pretérito perfecto simple',
    // The old form rendered this in untranslated English ("Future") — fixed here to native Spanish.
    [TenseVerbES.future]: 'Futuro',
};

// The old form's own heading was the untranslated English word "Indicative:" — fixed here to native German.
const DE_TOP_GROUP: FieldGroup = { heading: 'Indikativ', level: 1 };
const DE_TENSE_HEADINGS: Partial<Record<TenseVerbDE, string>> = {
    [TenseVerbDE.present]: 'Präsens',
    [TenseVerbDE.perfect]: 'Perfekt',
    [TenseVerbDE.simpleFuture]: 'Futur I',
    [TenseVerbDE.simplePast]: 'Präteritum',
};

const EE_TOP_GROUP: FieldGroup = { heading: 'Kindel', level: 1 };
// Flagged for user review, same as the rest of this slice's Estonian copy.
const EE_TENSE_HEADINGS: Partial<Record<TenseVerbEE, string>> = {
    [TenseVerbEE.present]: 'Olevik',
    [TenseVerbEE.simplePast]: 'Lihtminevik',
    [TenseVerbEE.pastPerfect]: 'Täisminevik',
};

// ---- German conjugated-auxiliary adornment (Perfect/SimpleFuture inputs) ----
const HABEN_PRESENT: Record<PronounSlot, string> = {
    '1S': 'habe',
    '2S': 'hast',
    '3S': 'hat',
    '1P': 'haben',
    '2P': 'habt',
    '3P': 'haben',
};
const SEIN_PRESENT: Record<PronounSlot, string> = {
    '1S': 'bin',
    '2S': 'bist',
    '3S': 'ist',
    '1P': 'sind',
    '2P': 'seid',
    '3P': 'sind',
};
// German's future tense always uses "werden" as its auxiliary, regardless of the verb's own perfect-tense auxiliary choice.
const WERDEN_PRESENT: Record<PronounSlot, string> = {
    '1S': 'werde',
    '2S': 'wirst',
    '3S': 'wird',
    '1P': 'werden',
    '2P': 'werdet',
    '3P': 'werden',
};

function deAdornment(row: VerbTenseData): FieldAdornment | undefined {
    const slot = slotOf(row);
    if (row.tense === TenseVerbDE.perfect) {
        return { watchField: 'auxiliaryVerb', values: { [AuxVerbDE.H]: HABEN_PRESENT[slot], [AuxVerbDE.S]: SEIN_PRESENT[slot] } };
    }
    if (row.tense === TenseVerbDE.simpleFuture) {
        return { watchField: 'auxiliaryVerb', values: { [AuxVerbDE.H]: WERDEN_PRESENT[slot], [AuxVerbDE.S]: WERDEN_PRESENT[slot] } };
    }
    return undefined;
}

// ---- German verb-case multi-select: three literal options, encoded to an acronym (matching the old app's own untranslated option labels) ----
const VERB_CASE_OPTIONS: RadioOption[] = [
    { value: VerbCaseTypeDE.accusativeDE, label: 'Accusative' },
    { value: VerbCaseTypeDE.dativeDE, label: 'Dative' },
    { value: VerbCaseTypeDE.genitiveDE, label: 'Genitive' },
];
const VERB_CASE_ORDER = [VerbCaseTypeDE.accusativeDE, VerbCaseTypeDE.dativeDE, VerbCaseTypeDE.genitiveDE];
const VERB_CASE_ACRONYM: Record<string, string> = {
    [VerbCaseTypeDE.accusativeDE]: 'A',
    [VerbCaseTypeDE.dativeDE]: 'D',
    [VerbCaseTypeDE.genitiveDE]: 'G',
};
const VERB_CASE_FROM_ACRONYM: Record<string, string> = { A: VerbCaseTypeDE.accusativeDE, D: VerbCaseTypeDE.dativeDE, G: VerbCaseTypeDE.genitiveDE };

function encodeVerbCases(selected: string[]): string {
    return VERB_CASE_ORDER.filter((value) => selected.includes(value)).map((value) => VERB_CASE_ACRONYM[value]).join('');
}

function decodeVerbCases(word: string): string[] {
    return word
        .split('')
        .map((letter) => VERB_CASE_FROM_ACRONYM[letter])
        .filter((value): value is string => !!value);
}

const AUX_VERB_OPTIONS: RadioOption[] = [
    { value: AuxVerbDE.H, label: AuxVerbDE.H },
    { value: AuxVerbDE.S, label: AuxVerbDE.S },
]; // haben/sein only — werden exists on AuxVerbDE but is not offered here, matching the old form.

const PREFIX_OPTIONS: RadioOption[] = Object.values(PrefixesVerbDE).map((value) => ({ value, label: value }));

function buildEnConfig(): TranslationFormConfig {
    const suffix = LANG_SUFFIX[Lang.EN];
    const tenseRows = WordCasesData.Verb.filter((row) => row.language === Lang.EN).filter(isTenseRow);

    const fields: FieldConfig[] = [regularityField(Lang.EN)];
    for (const row of tenseRows) {
        const required = row.tense === TenseVerbEN.presentSimple && row.person === 1 && row.plurality === Plurality.S;
        fields.push({
            kind: 'text',
            name: stripLangSuffix(row.caseName, suffix),
            caseName: row.caseName,
            label: pronounLabel(Lang.EN, row),
            required,
            requiredMessageKey: required ? verbErrorKey(suffix, 'simplePresentRequired') : undefined,
            lowercase: true,
            group: [EN_TOP_GROUP],
            layout: tenseLayout(row, EN_TENSE_HEADINGS[row.tense as TenseVerbEN]!),
        });
    }
    return { pos: PartOfSpeech.verb, lang: Lang.EN, fields };
}

function buildEsConfig(): TranslationFormConfig {
    const suffix = LANG_SUFFIX[Lang.ES];
    const rows = WordCasesData.Verb.filter((row) => row.language === Lang.ES);
    // Excludes ES's conditional (mood: conditionalES) and imperative (mood: imperativeES) rows, and both compound non-finite property rows, by construction.
    const tenseRows = rows.filter(isTenseRow).filter((row) => row.mood === VerbMoodES.indicativeES);

    const fields: FieldConfig[] = [
        requiredTextField(
            VerbCases.infinitiveNonFiniteSimpleES,
            'infinitiveNonFiniteSimple',
            verbErrorKey(suffix, 'infinitiveNonFiniteRequired'),
            { regex: /^(?!.*\d).*(ar|er|ir)$/, messageKey: verbErrorKey(suffix, 'infinitiveNotMatching') },
            { row: 'nonFinite', column: 'infinitive' }
        ),
        requiredTextField(
            VerbCases.gerundNonFiniteSimpleES,
            'gerundNonFiniteSimple',
            verbErrorKey(suffix, 'gerundNonFiniteRequired'),
            undefined,
            { row: 'nonFinite', column: 'gerund' }
        ),
        requiredTextField(
            VerbCases.participleNonFiniteSimpleES,
            'participleNonFiniteSimple',
            verbErrorKey(suffix, 'participleNonFiniteRequired'),
            undefined,
            { row: 'nonFinite', column: 'participle' }
        ),
        regularityField(Lang.ES),
    ];

    for (const row of tenseRows) {
        fields.push({
            kind: 'text',
            name: stripLangSuffix(row.caseName, suffix),
            caseName: row.caseName,
            label: pronounLabel(Lang.ES, row),
            required: false,
            lowercase: true,
            group: [ES_MOOD_GROUP, ES_SIMPLE_TENSE_GROUP],
            layout: tenseLayout(row, ES_TENSE_HEADINGS[row.tense as TenseVerbES]!),
        });
    }
    return { pos: PartOfSpeech.verb, lang: Lang.ES, fields };
}

function buildDeConfig(): TranslationFormConfig {
    const suffix = LANG_SUFFIX[Lang.DE];
    const tenseRows = WordCasesData.Verb.filter((row) => row.language === Lang.DE).filter(isTenseRow);

    // Two layout rows ahead of the tense grid: infinitive/auxiliaryVerb/prefix, then
    // regularity/verbCases. Reordered from the old app's field list (regularity used to sit
    // right after infinitive) so the two row's fields are each contiguous — `buildLayoutItems`
    // groups consecutive `layout`-bearing fields, and the distinct `block` ids below keep the
    // two rows from merging into one sparse 2x5 grid despite sitting back-to-back with nothing
    // non-`layout` between them (D36 — see `.context/plans/phase-3-forms-autocomplete-review.md`).
    const fields: FieldConfig[] = [
        requiredTextField(
            VerbCases.infinitiveDE,
            'infinitive',
            verbErrorKey(suffix, 'infinitiveNonFiniteRequired'),
            { regex: /^(?!.*\d).*(en|ern|eln)$/, messageKey: verbErrorKey(suffix, 'infinitiveNotMatching') },
            { row: 'meta1', column: 'infinitive', block: 'verbMeta1' }
        ),
        {
            kind: 'toggle',
            name: 'auxiliaryVerb',
            caseName: VerbCases.auxVerbDE,
            labelKey: labelKey(VerbCases.auxVerbDE),
            required: false,
            options: AUX_VERB_OPTIONS,
            layout: { row: 'meta1', column: 'auxiliaryVerb', block: 'verbMeta1' },
        },
        {
            kind: 'select',
            name: 'prefix',
            caseName: VerbCases.prefixDE,
            labelKey: labelKey(VerbCases.prefixDE),
            required: false,
            options: PREFIX_OPTIONS,
            layout: { row: 'meta1', column: 'prefix', block: 'verbMeta1' },
        },
        { ...regularityField(Lang.DE), layout: { row: 'meta2', column: 'regularity', block: 'verbMeta2' } },
        {
            kind: 'multi-select',
            name: 'verbCases',
            caseName: VerbCases.caseTypeDE,
            labelKey: labelKey(VerbCases.caseTypeDE),
            required: false,
            options: VERB_CASE_OPTIONS,
            encode: encodeVerbCases,
            decode: decodeVerbCases,
            layout: { row: 'meta2', column: 'verbCases', block: 'verbMeta2' },
        },
    ];

    for (const row of tenseRows) {
        fields.push({
            kind: 'text',
            name: stripLangSuffix(row.caseName, suffix),
            caseName: row.caseName,
            label: pronounLabel(Lang.DE, row),
            required: false,
            lowercase: true,
            group: [DE_TOP_GROUP],
            layout: tenseLayout(row, DE_TENSE_HEADINGS[row.tense as TenseVerbDE]!),
            adornment: deAdornment(row),
        });
    }
    return { pos: PartOfSpeech.verb, lang: Lang.DE, fields };
}

function buildEeConfig(): TranslationFormConfig {
    const suffix = LANG_SUFFIX[Lang.EE];
    const tenseRows = WordCasesData.Verb.filter((row) => row.language === Lang.EE).filter(isTenseRow);

    const searchInEnglish: CheckboxFieldConfig = {
        kind: 'checkbox',
        name: 'searchInEnglish',
        labelKey: verbErrorKey(suffix, 'searchInEnglishLabel'),
        required: false,
        persisted: false,
    };

    const infinitiveMa: TextFieldConfig = {
        kind: 'text',
        name: 'infinitiveMa',
        caseName: VerbCases.infinitiveMaEE,
        labelKey: labelKey(VerbCases.infinitiveMaEE),
        required: true,
        requiredMessageKey: verbErrorKey(suffix, 'infinitiveMaRequired'),
        lowercase: true,
        pattern: {
            regex: /^(?!.*\d).*(ma)$/,
            messageKey: verbErrorKey(suffix, 'infinitiveMaNotMatching'),
            relaxedWhen: { field: 'searchInEnglish', equals: true },
        },
        layout: { row: 'infinitives', column: 'ma' },
    };

    const fields: FieldConfig[] = [
        searchInEnglish,
        infinitiveMa,
        requiredTextField(
            VerbCases.infinitiveDaEE,
            'infinitiveDa',
            verbErrorKey(suffix, 'infinitiveDaRequired'),
            undefined,
            { row: 'infinitives', column: 'da' }
        ),
        regularityField(Lang.EE),
    ];

    for (const row of tenseRows) {
        fields.push({
            kind: 'text',
            name: stripLangSuffix(row.caseName, suffix),
            caseName: row.caseName,
            label: pronounLabel(Lang.EE, row),
            required: false,
            lowercase: true,
            group: [EE_TOP_GROUP],
            layout: tenseLayout(row, EE_TENSE_HEADINGS[row.tense as TenseVerbEE]!),
        });
    }
    return { pos: PartOfSpeech.verb, lang: Lang.EE, fields };
}

export const VERB_CONFIGS: Record<Lang, TranslationFormConfig> = {
    [Lang.EN]: buildEnConfig(),
    [Lang.ES]: buildEsConfig(),
    [Lang.DE]: buildDeConfig(),
    [Lang.EE]: buildEeConfig(),
};
