/**
 * The preposition form (conjunctions-and-prepositions plan, slice 2). Only the word is required (Q6).
 * German adds the governed cases and the article contractions; Estonian adds a case per position and
 * the where-to / where-from series.
 */
import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { matchesVisibility, isStoredCheckbox, type FieldConfig, type MultiSelectFieldConfig } from './types';
import { getFormConfig } from './index';

/** Field names that would actually render given these sibling values — the same filter `FieldRenderer` applies via `visibleWhen`. */
function visibleNames(fields: FieldConfig[], values: Record<string, unknown>): string[] {
    return fields
        .filter((f) => !f.visibleWhen || matchesVisibility(f.visibleWhen, values[f.visibleWhen.field]))
        .map((f) => f.name);
}

const config = (lang: Lang) => getFormConfig(PartOfSpeech.preposition, lang)!;

describe('getFormConfig(Preposition, lang)', () => {
    it.each([Lang.EN, Lang.ES])('%s: the word and the position', (lang) => {
        expect(config(lang).fields.map((f) => f.name)).toEqual(['preposition', 'position']);
    });

    it('German: word, position, governed cases, then the contractions', () => {
        expect(config(Lang.DE).fields.map((f) => f.name)).toEqual([
            'preposition',
            'position',
            'governedCase',
            'contracts',
            'withDem',
            'withDer',
            'withDas',
        ]);
    });

    it('Estonian: word, position, a case per position, then the series', () => {
        expect(config(Lang.EE).fields.map((f) => f.name)).toEqual([
            'preposition',
            'position',
            'governedCasePre',
            'governedCasePost',
            'spatialSeries',
            'directionTo',
            'directionFrom',
        ]);
    });

    it.each([Lang.EN, Lang.ES, Lang.DE, Lang.EE])('%s: only the word is required; the position is an optional radio', (lang) => {
        const fields = config(lang).fields;
        expect(fields.filter((f) => f.required).map((f) => f.name)).toEqual(['preposition']);
        expect(fields.find((f) => f.name === 'position')?.kind).toBe('radio');
    });

    it.each([
        [Lang.EN, 'EN'],
        [Lang.ES, 'ES'],
        [Lang.DE, 'DE'],
        [Lang.EE, 'EE'],
    ])('%s: every case name ends in the language code %s', (lang, code) => {
        for (const field of config(lang).fields) expect(field.caseName).toMatch(new RegExp(`${code}$`));
    });

    it('German: the contraction fields show only while the box is on, and the box is stored', () => {
        const fields = config(Lang.DE).fields;
        expect(visibleNames(fields, {})).not.toContain('withDem');
        expect(visibleNames(fields, { contracts: true })).toEqual(
            expect.arrayContaining(['withDem', 'withDer', 'withDas'])
        );
        expect(isStoredCheckbox(fields.find((f) => f.name === 'contracts')!)).toBe(true);
    });

    it('German: the governed cases encode to the verb-case letters and back, in the order A, D, G', () => {
        const field = config(Lang.DE).fields.find((f) => f.name === 'governedCase') as MultiSelectFieldConfig;
        expect(field.encode(['genitiveDE'])).toBe('G');
        expect(field.encode(['dativeDE', 'accusativeDE'])).toBe('AD');
        expect(field.decode('GD')).toEqual(['genitiveDE', 'dativeDE']);
        expect(field.decode('')).toEqual([]);
    });

    it('Estonian: the case of the noun follows the position; an empty position shows both', () => {
        const fields = config(Lang.EE).fields;
        expect(visibleNames(fields, {})).toEqual(expect.arrayContaining(['governedCasePre', 'governedCasePost']));
        expect(visibleNames(fields, { position: 'Before the noun' })).toContain('governedCasePre');
        expect(visibleNames(fields, { position: 'Before the noun' })).not.toContain('governedCasePost');
        expect(visibleNames(fields, { position: 'After the noun' })).toContain('governedCasePost');
        expect(visibleNames(fields, { position: 'After the noun' })).not.toContain('governedCasePre');
        expect(visibleNames(fields, { position: 'Before or after the noun' })).toEqual(
            expect.arrayContaining(['governedCasePre', 'governedCasePost'])
        );
    });

    it('Estonian: the direction fields show only while the series box is on', () => {
        const fields = config(Lang.EE).fields;
        expect(visibleNames(fields, {})).not.toContain('directionTo');
        expect(visibleNames(fields, { spatialSeries: true })).toEqual(expect.arrayContaining(['directionTo', 'directionFrom']));
        expect(isStoredCheckbox(fields.find((f) => f.name === 'spatialSeries')!)).toBe(true);
    });
});
