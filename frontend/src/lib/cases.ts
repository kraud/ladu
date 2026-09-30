/**
 * Readable labels for grammatical forms ("cases"), for practice cards and results.
 *
 * The old app showed raw enum names as chips. Here a case name is looked up in
 * `WordCasesData` (the same table the word forms are built from) and described
 * with translated terms from `practice:cases.*`, in the interface language:
 *   pluralGenitivDE          -> "Plural · Genitive"
 *   indicativePresent1sES    -> "Present · 1st person singular"
 *   genderDE                 -> "Gender"   (a property, used as the target of a drill)
 *
 * A verb form also has a personal pronoun (`pronounFor`): the practice card
 * writes it next to the prompt and the input, in the language of the word —
 * native grammar terms, never translated (same rule as the word forms).
 *
 * Case names carry their language suffix, so no language argument is needed.
 */
import type { TFunction } from 'i18next';
import { pronounLabel } from '@/features/words/form-engine/configs/verbs';
import { PartOfSpeech, Plurality, type DeclensionNoun, type Lang } from '@/ts/enums';
import { WordCasesData, type VerbTenseData } from '@/ts/wordCasesDataByPoS';

export type CaseDescriptor =
    | { kind: 'noun'; plurality: Plurality; declension: DeclensionNoun }
    | { kind: 'verb'; tense: string; person: 1 | 2 | 3; plurality: Plurality }
    | { kind: 'property'; category: string };

const NOUN_ROWS = new Map(WordCasesData.Noun.map((row) => [row.caseName as string, row]));
const VERB_ROWS = new Map(WordCasesData.Verb.map((row) => [row.caseName as string, row]));

/** What a case is, or `undefined` for a name the table does not know. */
export function describeCase(pos: PartOfSpeech | string, caseName: string): CaseDescriptor | undefined {
    if (pos === PartOfSpeech.noun) {
        const row = NOUN_ROWS.get(caseName);
        if (!row) return undefined;
        return row.isNounProperty
            ? { kind: 'property', category: row.nounPropertyCategory }
            : { kind: 'noun', plurality: row.plurality, declension: row.declination };
    }
    if (pos === PartOfSpeech.verb) {
        const row = VERB_ROWS.get(caseName);
        if (!row) return undefined;
        return row.isVerbProperty
            ? { kind: 'property', category: row.verbPropertyCategory }
            : { kind: 'verb', tense: row.tense, person: row.person, plurality: row.plurality };
    }
    return undefined;
}

/**
 * The tenses the catalogue can ask about, by meaning. Every language names them
 * differently ("Present-Simple", "Perfect-Simple-Past", "Simple-Future"), so a card
 * shows the shared meaning. Anything else is shown as its own name, spaced.
 */
const TENSE_BUCKET: Record<string, 'present' | 'past' | 'future'> = {
    Present: 'present',
    'Present-Simple': 'present',
    'Past-Simple': 'past',
    'Simple-Past': 'past',
    'Perfect-Simple-Past': 'past',
    Future: 'future',
    'Future-Simple': 'future',
    'Simple-Future': 'future',
};

const humanize = (value: string): string => value.replace(/-/g, ' ');

function tenseLabel(t: TFunction, tense: string): string {
    const bucket = TENSE_BUCKET[tense];
    return bucket ? t(`practice:cases.tense.${bucket}`) : humanize(tense);
}

function personKey(person: number, plurality: Plurality): string {
    return `${person}${plurality === Plurality.S ? 'S' : 'P'}`;
}

/** One piece of a form label: the full word and its abbreviation ("Genitive" / "gen."). */
export interface CasePart {
    full: string;
    abbr: string;
}

/**
 * The pieces of a form label, in reading order: noun = plurality + declension,
 * verb = tense + person (with plurality), property = its category. Each piece has an
 * abbreviation in the interface language (`practice:cases.abbr.*`); a piece without
 * one is its own abbreviation. Unknown names come back as one unchanged piece.
 */
export function caseParts(t: TFunction, pos: PartOfSpeech | string, caseName: string): CasePart[] {
    const descriptor = describeCase(pos, caseName);
    if (!descriptor) return [{ full: caseName, abbr: caseName }];

    const part = (group: string, key: string, full: string): CasePart => ({
        full,
        abbr: t(`practice:cases.abbr.${group}.${key}`, { defaultValue: full }),
    });

    switch (descriptor.kind) {
        case 'noun':
            return [
                part('plurality', descriptor.plurality, t(`practice:cases.plurality.${descriptor.plurality}`, { defaultValue: descriptor.plurality })),
                part('declension', descriptor.declension, t(`practice:cases.declension.${descriptor.declension}`, { defaultValue: descriptor.declension })),
            ];
        case 'verb': {
            const bucket = TENSE_BUCKET[descriptor.tense];
            const person = personKey(descriptor.person, descriptor.plurality);
            return [
                bucket
                    ? part('tense', bucket, tenseLabel(t, descriptor.tense))
                    : { full: humanize(descriptor.tense), abbr: humanize(descriptor.tense) },
                part('person', person, t(`practice:cases.person.${person}`)),
            ];
        }
        case 'property':
            return [
                part('property', descriptor.category, t(`practice:cases.property.${descriptor.category}`, { defaultValue: humanize(descriptor.category) })),
            ];
    }
}

/** "Plural · Genitive", "Present · 1st person singular", "Gender". Unknown names come back unchanged. */
export function caseLabel(t: TFunction, pos: PartOfSpeech | string, caseName: string): string {
    return caseParts(t, pos, caseName)
        .map((part) => part.full)
        .join(' · ');
}

/**
 * The personal pronoun of a verb form ("Yo", "Ich", "Mina"), in the language the
 * form belongs to; `undefined` for anything that is not a conjugated form
 * (infinitives, regularity, participles…) and for nouns.
 */
export function pronounFor(pos: PartOfSpeech | string, caseName: string): string | undefined {
    if (pos !== PartOfSpeech.verb) return undefined;
    const row = VERB_ROWS.get(caseName);
    if (!row || row.isVerbProperty) return undefined;
    const label = pronounLabel(row.language as Lang, row as VerbTenseData);
    return label === '' ? undefined : label;
}
