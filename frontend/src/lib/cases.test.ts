import { describe, expect, it } from 'vitest';
import { createTestI18n } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import { caseLabel, caseParts, describeCase, pronounFor } from './cases';

const i18n = createTestI18n();
const t = i18n.t.bind(i18n);

describe('describeCase', () => {
    it('describes noun forms', () => {
        expect(describeCase(PartOfSpeech.noun, 'pluralGenitivDE')).toEqual({
            kind: 'noun', plurality: 'Plural', declension: 'Genitive',
        });
        expect(describeCase('Noun', 'singularEN')).toMatchObject({ kind: 'noun', plurality: 'Singular', declension: 'Nominative' });
    });

    it('describes noun properties', () => {
        expect(describeCase('Noun', 'genderES')).toEqual({ kind: 'property', category: 'Gender' });
        expect(describeCase('Noun', 'shortFormEE')).toEqual({ kind: 'property', category: 'Short-Form' });
    });

    it('describes verb forms and properties', () => {
        expect(describeCase('Verb', 'indicativePresent1sES')).toMatchObject({ kind: 'verb', person: 1, plurality: 'Singular' });
        expect(describeCase('Verb', 'participleNonFiniteSimpleES')).toEqual({ kind: 'property', category: 'Participle' });
        expect(describeCase('Verb', 'auxVerbDE')).toEqual({ kind: 'property', category: 'Auxiliary-Verb' });
    });

    it('does not know a name in the wrong part of speech or a made-up one', () => {
        expect(describeCase('Noun', 'indicativePresent1sES')).toBeUndefined();
        expect(describeCase('Verb', 'singularEN')).toBeUndefined();
        expect(describeCase('Noun', 'nope')).toBeUndefined();
        expect(describeCase('Adjective', 'positive')).toBeUndefined();
    });
});

describe('caseLabel (UI language: English)', () => {
    it('labels noun forms', () => {
        expect(caseLabel(t, 'Noun', 'pluralGenitivDE')).toBe('Plural · Genitive');
        expect(caseLabel(t, 'Noun', 'singularNimetavEE')).toBe('Singular · Nominative');
        expect(caseLabel(t, 'Noun', 'pluralOsastavEE')).toBe('Plural · Partitive');
    });

    it('labels verb forms by the shared meaning of the tense', () => {
        expect(caseLabel(t, 'Verb', 'simplePresent1sEN')).toBe('Present · 1st person singular');
        expect(caseLabel(t, 'Verb', 'indicativePresent1sES')).toBe('Present · 1st person singular');
        expect(caseLabel(t, 'Verb', 'indicativePerfectSimplePast3plES')).toBe('Past · 3rd person plural');
        expect(caseLabel(t, 'Verb', 'indicativeSimpleFuture1sDE')).toBe('Future · 1st person singular');
        expect(caseLabel(t, 'Verb', 'kindelSimplePast3sEE')).toBe('Past · 3rd person singular');
    });

    it('labels properties by their category (the target of a same-language drill)', () => {
        expect(caseLabel(t, 'Noun', 'genderDE')).toBe('Gender');
        expect(caseLabel(t, 'Verb', 'regularityES')).toBe('Regularity');
        expect(caseLabel(t, 'Verb', 'gerundNonFiniteSimpleES')).toBe('Gerund');
        expect(caseLabel(t, 'Verb', 'infinitiveNonFiniteSimpleES')).toBe('Infinitive');
    });

    it('returns an unknown name unchanged, so a card never shows an empty label', () => {
        expect(caseLabel(t, 'Noun', 'mysteryForm')).toBe('mysteryForm');
    });
});

describe('caseParts (UI language: English)', () => {
    it('gives every piece of a noun form its full word and abbreviation', () => {
        expect(caseParts(t, 'Noun', 'pluralGenitivDE')).toEqual([
            { full: 'Plural', abbr: 'pl.' },
            { full: 'Genitive', abbr: 'gen.' },
        ]);
    });

    it('keeps the person and the plurality of a verb form in one piece', () => {
        expect(caseParts(t, 'Verb', 'indicativeSimpleFuture3plDE')).toEqual([
            { full: 'Future', abbr: 'fut.' },
            { full: '3rd person plural', abbr: '3rd p. pl.' },
        ]);
    });

    it('abbreviates a property, and its full labels join to the case label', () => {
        expect(caseParts(t, 'Verb', 'participleNonFiniteSimpleES')).toEqual([{ full: 'Participle', abbr: 'ptcp.' }]);
        expect(caseParts(t, 'Noun', 'singularNimetavEE').map((p) => p.full).join(' · ')).toBe(caseLabel(t, 'Noun', 'singularNimetavEE'));
    });

    it('is its own abbreviation for an unknown name', () => {
        expect(caseParts(t, 'Noun', 'mysteryForm')).toEqual([{ full: 'mysteryForm', abbr: 'mysteryForm' }]);
    });
});

describe('pronounFor', () => {
    it('gives the pronoun in the language of the form', () => {
        expect(pronounFor('Verb', 'simplePresent1sEN')).toBe('I');
        expect(pronounFor('Verb', 'indicativePresent1sES')).toBe('Yo');
        expect(pronounFor('Verb', 'indicativePresent1sDE')).toBe('Ich');
        expect(pronounFor('Verb', 'kindelPresent1sEE')).toBe('Mina');
    });

    it('is undefined for infinitives, properties, nouns and unknown names', () => {
        expect(pronounFor('Verb', 'infinitiveNonFiniteSimpleES')).toBeUndefined();
        expect(pronounFor('Verb', 'regularityEN')).toBeUndefined();
        expect(pronounFor('Noun', 'singularEN')).toBeUndefined();
        expect(pronounFor('Verb', 'nope')).toBeUndefined();
    });
});
