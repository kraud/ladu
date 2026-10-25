/**
 * The conjunction form (conjunctions-and-prepositions plan, slice 1): the same four fields in every
 * language, plus the Spanish mood select. The type radio is required (Q2); the second part is shown,
 * and required, only while the "Paired" box is on (Q1).
 */
import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { isStoredCheckbox, matchesVisibility, type FieldConfig } from './types';
import { getFormConfig } from './index';

/** Field names that would actually render given these sibling values — the same filter `FieldRenderer` applies via `visibleWhen`. */
function visibleNames(fields: FieldConfig[], values: Record<string, unknown>): string[] {
    return fields
        .filter((f) => !f.visibleWhen || matchesVisibility(f.visibleWhen, values[f.visibleWhen.field]))
        .map((f) => f.name);
}

describe('getFormConfig(Conjunction, lang)', () => {
    it.each([Lang.EN, Lang.DE, Lang.EE])('%s: word, second part, type and paired, in grid order', (lang) => {
        const config = getFormConfig(PartOfSpeech.conjunction, lang)!;
        expect(config.fields.map((f) => f.name)).toEqual(['conjunction', 'secondPart', 'conjunctionType', 'correlative']);
    });

    it('Spanish: the same fields plus the verb mood', () => {
        const config = getFormConfig(PartOfSpeech.conjunction, Lang.ES)!;
        expect(config.fields.map((f) => f.name)).toEqual(['conjunction', 'secondPart', 'conjunctionType', 'correlative', 'mood']);
    });

    it.each([Lang.EN, Lang.ES, Lang.DE, Lang.EE])('%s: only the word is required; the type is an optional radio; the box is stored and optional', (lang) => {
        const config = getFormConfig(PartOfSpeech.conjunction, lang)!;
        const byName = (name: string) => config.fields.find((f) => f.name === name)!;
        expect(byName('conjunction').required).toBe(true);
        expect(byName('conjunctionType').required).toBe(false);
        expect(byName('conjunctionType').kind).toBe('radio');
        expect(byName('correlative').required).toBe(false);
        expect(isStoredCheckbox(byName('correlative'))).toBe(true);
    });

    it.each([
        [Lang.EN, 'EN'],
        [Lang.ES, 'ES'],
        [Lang.DE, 'DE'],
        [Lang.EE, 'EE'],
    ])('%s: every case name ends in the language code %s', (lang, code) => {
        const config = getFormConfig(PartOfSpeech.conjunction, lang)!;
        for (const field of config.fields) expect(field.caseName).toMatch(new RegExp(`${code}$`));
    });

    it('the word shares a row with the second part, the type with the paired box, and the mood sits on its own row', () => {
        const rowAndColumn = (config: ReturnType<typeof getFormConfig>, name: string) => {
            const layout = config!.fields.find((f) => f.name === name)?.layout;
            return `${layout?.row}/${layout?.column}`;
        };
        const es = getFormConfig(PartOfSpeech.conjunction, Lang.ES);
        expect(rowAndColumn(es, 'conjunction')).toBe('word/first');
        expect(rowAndColumn(es, 'secondPart')).toBe('word/second');
        expect(rowAndColumn(es, 'conjunctionType')).toBe('meta/first');
        expect(rowAndColumn(es, 'correlative')).toBe('meta/second');
        expect(rowAndColumn(es, 'mood')).toBe('mood/first');
    });

    it('the second part shows, and is required, only while the paired box is on', () => {
        const config = getFormConfig(PartOfSpeech.conjunction, Lang.DE)!;
        expect(visibleNames(config.fields, {})).not.toContain('secondPart');
        expect(visibleNames(config.fields, { correlative: false })).not.toContain('secondPart');
        expect(visibleNames(config.fields, { correlative: true })).toContain('secondPart');
        expect(config.fields.find((f) => f.name === 'secondPart')?.required).toBe(true);
    });

    it('the Spanish mood shows only for a subordinating conjunction and is optional', () => {
        const config = getFormConfig(PartOfSpeech.conjunction, Lang.ES)!;
        expect(visibleNames(config.fields, {})).not.toContain('mood');
        expect(visibleNames(config.fields, { conjunctionType: 'Coordinating' })).not.toContain('mood');
        expect(visibleNames(config.fields, { conjunctionType: 'Subordinating' })).toContain('mood');
        expect(config.fields.find((f) => f.name === 'mood')?.required).toBe(false);
    });
});
