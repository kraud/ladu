/**
 * Regression test: the config-driven field lists must equal the old
 * `VerbForm{EN,ES,DE,EE}` field lists transcribed verbatim in
 * `.context/.frontend/snapshot/forms-verbs.md`.
 */
import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { matchesVisibility } from './types';
import { getFormConfig } from './index';

/** `auxiliaryVerb`/`caseTypeDE->verbCases` don't derive their `name` from `caseName` mechanically — old-app naming quirks the manifest reproduces on purpose. */
const NAME_SUFFIX_EXCEPTIONS = new Set(['auxiliaryVerb', 'verbCases']);

describe('reflexive verb fields (Slice H5, D28, D29, D31, D32)', () => {
    const field = (lang: Lang, name: string) => getFormConfig(PartOfSpeech.verb, lang)!.fields.find((f) => f.name === name)!;

    it('Spanish and German have the reflexivity radio (Not / Always / Optionally); English and Estonian have no reflexive field', () => {
        for (const [lang, caseName] of [[Lang.ES, 'reflexivityES'], [Lang.DE, 'reflexivityDE']] as const) {
            const reflexivity = field(lang, 'reflexivity');
            expect(reflexivity).toMatchObject({ kind: 'radio', caseName, required: false });
            expect(reflexivity.kind === 'radio' && reflexivity.options.map((o) => o.value)).toEqual(['Not reflexive', 'Always reflexive', 'Optionally reflexive']);
        }
        for (const lang of [Lang.EN, Lang.EE]) {
            expect(field(lang, 'reflexive')).toBeUndefined();
            expect(field(lang, 'reflexivity')).toBeUndefined();
        }
    });

    it('Spanish has no pronoun-case radio: me, te, se are the same for dative and accusative (D33)', () => {
        expect(field(Lang.ES, 'reflexiveCase')).toBeUndefined();
    });

    it('German also has a pronoun-case radio (Accusative / Dative / Both)', () => {
        const pronounCase = field(Lang.DE, 'reflexiveCase');
        expect(pronounCase).toMatchObject({ kind: 'radio', caseName: 'reflexiveCaseDE', required: false });
        expect(pronounCase.kind === 'radio' && pronounCase.options.map((o) => o.value)).toEqual(['Accusative', 'Dative', 'Both']);
    });

    it('German: the pronoun-case radio is hidden only once "Not reflexive" is chosen', () => {
        const visibility = field(Lang.DE, 'reflexiveCase').visibleWhen!;
        expect(matchesVisibility(visibility, 'Not reflexive')).toBe(false);
        for (const value of ['Always reflexive', 'Optionally reflexive', undefined]) expect(matchesVisibility(visibility, value)).toBe(true);
    });

    it('German: the verb-case field has a Prepositional box, stored as "P" after A, D, G (D32)', () => {
        const verbCases = field(Lang.DE, 'verbCases');
        if (verbCases.kind !== 'multi-select') throw new Error('verbCases is a multi-select');
        expect(verbCases.options.map((o) => o.label)).toEqual(['Accusative', 'Dative', 'Genitive', 'Prepositional']);
        const all = verbCases.options.map((o) => o.value);
        expect(verbCases.encode(all)).toBe('ADGP');
        expect(verbCases.encode(['prepositionalDE', 'accusativeDE'])).toBe('AP');
        expect(verbCases.decode('DP')).toEqual(['dativeDE', 'prepositionalDE']);
        // A word saved before the box existed still decodes.
        expect(verbCases.decode('AD')).toEqual(['accusativeDE', 'dativeDE']);
    });

    it('Spanish: a pronoun before every person field of an always reflexive verb (2pl is ustedes: se, D10)', () => {
        const pronouns = ['1s', '2s', '3s', '1pl', '2pl', '3pl'].map((slot) => field(Lang.ES, `indicativePresent${slot}`).reflexive);
        const on = { field: 'reflexivity', equals: 'Always reflexive' };
        expect(pronouns).toEqual([
            { accusative: 'me', position: 'before', on },
            { accusative: 'te', position: 'before', on },
            { accusative: 'se', position: 'before', on },
            { accusative: 'nos', position: 'before', on },
            { accusative: 'se', position: 'before', on },
            { accusative: 'se', position: 'before', on },
        ]);
        expect(field(Lang.ES, 'infinitiveNonFiniteSimple').reflexive).toBeUndefined();
    });

    it('German: the pronoun shows for an always reflexive verb, after the verb in present and past, before it in perfect and future', () => {
        const on = { field: 'reflexivity', equals: 'Always reflexive' };
        expect(field(Lang.DE, 'indicativePresent1s').reflexive).toEqual({ accusative: 'mich', dative: 'mir', position: 'after', on, caseField: 'reflexiveCase' });
        expect(field(Lang.DE, 'indicativeSimplePast3pl').reflexive).toMatchObject({ accusative: 'sich', position: 'after' });
        expect(field(Lang.DE, 'indicativePerfect2s').reflexive).toEqual({ accusative: 'dich', dative: 'dir', position: 'before', on, caseField: 'reflexiveCase' });
        expect(field(Lang.DE, 'indicativeSimpleFuture1pl').reflexive).toMatchObject({ accusative: 'uns', position: 'before' });
        expect(field(Lang.DE, 'infinitive').reflexive).toBeUndefined();
    });

    it('Spanish: the infinitive check accepts a reflexive "-se" and "-ír" (before H5 "quejarse" and "oír" could not be saved)', () => {
        const infinitive = field(Lang.ES, 'infinitiveNonFiniteSimple');
        const regex = infinitive.kind === 'text' ? infinitive.pattern!.regex : /$^/;
        for (const word of ['bailar', 'tener', 'ir', 'oír', 'quejarse', 'lavarse', 'irse', 'reírse']) expect(regex.test(word), word).toBe(true);
        for (const word of ['bailo', 'quejarsee', 'ser2', 'se']) expect(regex.test(word), word).toBe(false);
    });
});

describe('getFormConfig(Verb, lang) — old field-list parity', () => {
    it('English: regularity, 4 simple tenses x 5 pronoun slots', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.EN)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'regularity',
            'simplePresent1s',
            'simplePresent2s',
            'simplePresent3s',
            'simplePresent1pl',
            'simplePresent3pl',
            'simplePast1s',
            'simplePast2s',
            'simplePast3s',
            'simplePast1pl',
            'simplePast3pl',
            'simpleFuture1s',
            'simpleFuture2s',
            'simpleFuture3s',
            'simpleFuture1pl',
            'simpleFuture3pl',
            'simpleConditional1s',
            'simpleConditional2s',
            'simpleConditional3s',
            'simpleConditional1pl',
            'simpleConditional3pl',
        ]);
        expect(config.fields.find((f) => f.name === 'simplePresent1s')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'simplePresent1s').every((f) => !f.required)).toBe(true);
    });

    it('Spanish: 3 non-finites, regularity, reflexivity (H5), 4 indicative simple tenses x 6 pronoun slots — no conditional/imperative', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.ES)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'infinitiveNonFiniteSimple',
            'gerundNonFiniteSimple',
            'participleNonFiniteSimple',
            'regularity',
            'reflexivity', // new in Slice H5 (D33), not in the old app
            'indicativePresent1s',
            'indicativePresent2s',
            'indicativePresent3s',
            'indicativePresent1pl',
            'indicativePresent2pl',
            'indicativePresent3pl',
            'indicativeImperfectPast1s',
            'indicativeImperfectPast2s',
            'indicativeImperfectPast3s',
            'indicativeImperfectPast1pl',
            'indicativeImperfectPast2pl',
            'indicativeImperfectPast3pl',
            'indicativePerfectSimplePast1s',
            'indicativePerfectSimplePast2s',
            'indicativePerfectSimplePast3s',
            'indicativePerfectSimplePast1pl',
            'indicativePerfectSimplePast2pl',
            'indicativePerfectSimplePast3pl',
            'indicativeFuture1s',
            'indicativeFuture2s',
            'indicativeFuture3s',
            'indicativeFuture1pl',
            'indicativeFuture2pl',
            'indicativeFuture3pl',
        ]);
        const requiredNames = ['infinitiveNonFiniteSimple', 'gerundNonFiniteSimple', 'participleNonFiniteSimple'];
        for (const name of requiredNames) {
            expect(config.fields.find((f) => f.name === name)?.required).toBe(true);
        }
        expect(config.fields.filter((f) => !requiredNames.includes(f.name)).every((f) => !f.required)).toBe(true);
    });

    it('German: infinitive, auxiliaryVerb, prefix, regularity, verbCases, reflexivity + reflexiveCase (H5), 4 tenses x 6 pronoun slots', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.DE)!;
        // D36 — reordered from the old app's list (regularity used to sit right after
        // infinitive) so infinitive/auxiliaryVerb/prefix and regularity/verbCases each form one
        // contiguous, side-by-side row ahead of the tense grid. See `layout` assertions below.
        expect(config.fields.map((f) => f.name)).toEqual([
            'infinitive',
            'auxiliaryVerb',
            'prefix',
            'regularity',
            'verbCases',
            'reflexivity', // new in Slice H5 (D31), not in the old app
            'reflexiveCase', // new in Slice H5 (D31), not in the old app
            'indicativePresent1s',
            'indicativePresent2s',
            'indicativePresent3s',
            'indicativePresent1pl',
            'indicativePresent2pl',
            'indicativePresent3pl',
            'indicativePerfect1s',
            'indicativePerfect2s',
            'indicativePerfect3s',
            'indicativePerfect1pl',
            'indicativePerfect2pl',
            'indicativePerfect3pl',
            'indicativeSimpleFuture1s',
            'indicativeSimpleFuture2s',
            'indicativeSimpleFuture3s',
            'indicativeSimpleFuture1pl',
            'indicativeSimpleFuture2pl',
            'indicativeSimpleFuture3pl',
            'indicativeSimplePast1s',
            'indicativeSimplePast2s',
            'indicativeSimplePast3s',
            'indicativeSimplePast1pl',
            'indicativeSimplePast2pl',
            'indicativeSimplePast3pl',
        ]);
        expect(config.fields.find((f) => f.name === 'infinitive')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'infinitive').every((f) => !f.required)).toBe(true);
    });

    it('Estonian: searchInEnglish, -ma/-da infinitives, regularity, 3 tenses x 6 pronoun slots', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.EE)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'searchInEnglish',
            'infinitiveMa',
            'infinitiveDa',
            'regularity',
            'kindelPresent1s',
            'kindelPresent2s',
            'kindelPresent3s',
            'kindelPresent1pl',
            'kindelPresent2pl',
            'kindelPresent3pl',
            'kindelSimplePast1s',
            'kindelSimplePast2s',
            'kindelSimplePast3s',
            'kindelSimplePast1pl',
            'kindelSimplePast2pl',
            'kindelSimplePast3pl',
            'kindelPastPerfect1s',
            'kindelPastPerfect2s',
            'kindelPastPerfect3s',
            'kindelPastPerfect1pl',
            'kindelPastPerfect2pl',
            'kindelPastPerfect3pl',
        ]);
        const requiredNames = ['infinitiveMa', 'infinitiveDa'];
        for (const name of requiredNames) {
            expect(config.fields.find((f) => f.name === name)?.required).toBe(true);
        }
        expect(config.fields.filter((f) => !requiredNames.includes(f.name)).every((f) => !f.required)).toBe(true);
    });

    it('every field.caseName is field.name + the language suffix, except old-app naming quirks and persisted:false fields', () => {
        const suffixes: Record<Lang, string> = { [Lang.EN]: 'EN', [Lang.ES]: 'ES', [Lang.DE]: 'DE', [Lang.EE]: 'EE' };
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE]) {
            const config = getFormConfig(PartOfSpeech.verb, lang)!;
            for (const field of config.fields) {
                if (field.persisted === false) continue;
                if (NAME_SUFFIX_EXCEPTIONS.has(field.name)) continue;
                expect(field.caseName).toBe(`${field.name}${suffixes[lang]}`);
            }
        }
    });

    it('searchInEnglish (EE) has no backing case and is dropped from persistence', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.EE)!;
        const field = config.fields.find((f) => f.name === 'searchInEnglish')!;
        expect(field.persisted).toBe(false);
        expect(field.caseName).toBeUndefined();
    });

    it('every conjugation field carries a non-empty pronoun label', () => {
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE]) {
            const config = getFormConfig(PartOfSpeech.verb, lang)!;
            const conjugationFields = config.fields.filter((f) => f.group !== undefined);
            expect(conjugationFields.length).toBeGreaterThan(0);
            for (const field of conjugationFields) {
                expect(field.label).toBeTruthy();
            }
        }
    });

    it('Spanish 2nd person is labelled Tú and Ustedes — the forms the dictionary fills (decision D10)', () => {
        const fields = getFormConfig(PartOfSpeech.verb, Lang.ES)!.fields;
        const labelOf = (name: string) => fields.find((f) => f.name === name)?.label;
        expect(labelOf('indicativePresent2s')).toBe('Tú');
        expect(labelOf('indicativePresent2pl')).toBe('Ustedes');
    });

    describe('layout — each tense becomes a column, pronoun becomes a row', () => {
        it('English: tense is the column (captioned), pronoun slot is the row, mood stays in group', () => {
            const config = getFormConfig(PartOfSpeech.verb, Lang.EN)!;
            const present1s = config.fields.find((f) => f.name === 'simplePresent1s')!;
            const past1s = config.fields.find((f) => f.name === 'simplePast1s')!;
            expect(present1s.layout).toEqual({ row: '1S', column: 'Present-Simple', columnHeading: 'Present' });
            expect(past1s.layout).toEqual({ row: '1S', column: 'Past-Simple', columnHeading: 'Past' });
            // Same pronoun slot -> same row key, regardless of tense.
            expect(present1s.layout?.row).toBe(past1s.layout?.row);
            // The tense heading no longer lives in `group` — only the outer "Simple" heading does.
            expect(present1s.group).toEqual([{ heading: 'Simple', level: 1 }]);
            expect(config.fields.find((f) => f.name === 'regularity')?.layout).toBeUndefined();
        });

        it('Spanish: the outer mood/tense-type group stack is unchanged, only the innermost tense heading moved to layout', () => {
            const config = getFormConfig(PartOfSpeech.verb, Lang.ES)!;
            const present1s = config.fields.find((f) => f.name === 'indicativePresent1s')!;
            expect(present1s.group).toEqual([
                { heading: 'Modo indicativo', level: 1 },
                { heading: 'Tiempo simple', level: 2 },
            ]);
            expect(present1s.layout).toEqual({ row: '1S', column: 'Present', columnHeading: 'Presente' });
        });

        it('German: the auxiliary adornment survives the move to layout', () => {
            const config = getFormConfig(PartOfSpeech.verb, Lang.DE)!;
            const perfect1s = config.fields.find((f) => f.name === 'indicativePerfect1s')!;
            expect(perfect1s.layout).toEqual({ row: '1S', column: 'Perfect', columnHeading: 'Perfekt' });
            expect(perfect1s.adornment).toBeDefined();
        });

        it('Estonian: three tenses become three columns sharing one row set', () => {
            const config = getFormConfig(PartOfSpeech.verb, Lang.EE)!;
            // `f.group` narrows to the tense-grid fields — the `-ma`/`-da` infinitives also carry
            // `layout` (their own row, tested below) but no `group`.
            const columns = new Set(
                config.fields.filter((f) => f.group).map((f) => f.layout!.column),
            );
            expect(columns).toEqual(new Set(['Present', 'Simple-Past', 'Past-Perfect']));
        });
    });

    describe('layout — property-row groupings ahead of the tense grid', () => {
        it('Spanish: infinitive/gerund/participle share one row, three columns', () => {
            const config = getFormConfig(PartOfSpeech.verb, Lang.ES)!;
            const infinitive = config.fields.find((f) => f.name === 'infinitiveNonFiniteSimple')!;
            const gerund = config.fields.find((f) => f.name === 'gerundNonFiniteSimple')!;
            const participle = config.fields.find((f) => f.name === 'participleNonFiniteSimple')!;
            expect(infinitive.layout).toEqual({ row: 'nonFinite', column: 'infinitive', stackOnMobile: true });
            expect(gerund.layout).toEqual({ row: 'nonFinite', column: 'gerund', stackOnMobile: true });
            expect(participle.layout).toEqual({ row: 'nonFinite', column: 'participle', stackOnMobile: true });
            expect(config.fields.find((f) => f.name === 'regularity')?.layout).toBeUndefined();
        });

        it('German: infinitive/auxiliaryVerb/prefix share one row; regularity/verbCases share a separate one', () => {
            const config = getFormConfig(PartOfSpeech.verb, Lang.DE)!;
            const infinitive = config.fields.find((f) => f.name === 'infinitive')!;
            const auxiliaryVerb = config.fields.find((f) => f.name === 'auxiliaryVerb')!;
            const prefix = config.fields.find((f) => f.name === 'prefix')!;
            const regularity = config.fields.find((f) => f.name === 'regularity')!;
            const verbCases = config.fields.find((f) => f.name === 'verbCases')!;

            expect(infinitive.layout).toEqual({ row: 'meta1', column: 'infinitive', block: 'verbMeta1', fullRowOnMobile: true });
            expect(auxiliaryVerb.layout).toEqual({ row: 'meta1', column: 'auxiliaryVerb', block: 'verbMeta1' });
            expect(prefix.layout).toEqual({ row: 'meta1', column: 'prefix', block: 'verbMeta1' });
            expect(regularity.layout).toEqual({ row: 'meta2', column: 'regularity', block: 'verbMeta2' });
            expect(verbCases.layout).toEqual({ row: 'meta2', column: 'verbCases', block: 'verbMeta2' });
            // Distinct `block` ids are load-bearing: without them these two rows, sitting
            // back-to-back with nothing non-`layout` between them, would merge into one sparse
            // 2x5 grid instead of two clean rows (see `fieldLayout.ts`'s `blockKey`).
            expect(infinitive.layout?.block).not.toBe(regularity.layout?.block);
        });

        it('Estonian: the -ma/-da infinitives share one row, two columns', () => {
            const config = getFormConfig(PartOfSpeech.verb, Lang.EE)!;
            const ma = config.fields.find((f) => f.name === 'infinitiveMa')!;
            const da = config.fields.find((f) => f.name === 'infinitiveDa')!;
            expect(ma.layout).toEqual({ row: 'infinitives', column: 'ma' });
            expect(da.layout).toEqual({ row: 'infinitives', column: 'da' });
        });

        it('English: no property-row field carries a layout', () => {
            const config = getFormConfig(PartOfSpeech.verb, Lang.EN)!;
            expect(config.fields.find((f) => f.name === 'regularity')?.layout).toBeUndefined();
        });
    });
});
