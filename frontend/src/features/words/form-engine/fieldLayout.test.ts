import { describe, expect, it } from 'vitest';
import { NounCases } from '@/ts/enums';
import type { TextFieldConfig } from './configs/types';
import { buildLayoutItems, isEmptyValue, isHiddenInDisplayOnly } from './fieldLayout';

const CASE_NAME = NounCases.singularEN;

function textField(name: string, overrides: Partial<Pick<TextFieldConfig, 'layout' | 'group' | 'required'>> = {}): TextFieldConfig {
    return {
        kind: 'text',
        name,
        caseName: CASE_NAME,
        labelKey: name,
        required: false,
        lowercase: true,
        ...overrides,
    };
}

describe('buildLayoutItems', () => {
    it('renders a field with no layout as a standalone item, unchanged order', () => {
        const fields = [textField('regularity'), textField('singular')];
        const items = buildLayoutItems(fields);

        expect(items).toEqual([
            { kind: 'field', index: 0, field: fields[0] },
            { kind: 'field', index: 1, field: fields[1] },
        ]);
    });

    it('groups two consecutive layout fields sharing no group into one 1x2 grid', () => {
        const singular = textField('singular', { layout: { row: 'Nominative', column: 'Singular' } });
        const plural = textField('plural', { layout: { row: 'Nominative', column: 'Plural' } });
        const items = buildLayoutItems([singular, plural]);

        expect(items).toEqual([
            {
                kind: 'grid',
                index: 0,
                fields: [singular, plural],
                rows: ['Nominative'],
                columns: ['Singular', 'Plural'],
                cells: [[singular, plural]],
                columnHeadings: undefined,
            },
        ]);
    });

    it('derives rows/columns in first-appearance order across a multi-declension noun block', () => {
        const declensions = ['Nominative', 'Accusative', 'Genitive', 'Dative'];
        const fields = declensions.flatMap((declension) => [
            textField(`singular${declension}`, { layout: { row: declension, column: 'Singular' } }),
            textField(`plural${declension}`, { layout: { row: declension, column: 'Plural' } }),
        ]);

        const [item] = buildLayoutItems(fields);
        expect(item.kind).toBe('grid');
        if (item.kind !== 'grid') throw new Error('unreachable');
        expect(item.rows).toEqual(declensions);
        expect(item.columns).toEqual(['Singular', 'Plural']);
        expect(item.cells).toHaveLength(4);
        expect(item.cells[2]).toEqual([fields[4], fields[5]]);
    });

    it('emits columnHeadings once any field in the block sets one, aligned to column order', () => {
        const present = textField('present1s', { layout: { row: '1s', column: 'Present', columnHeading: 'Present' } });
        const past = textField('past1s', { layout: { row: '1s', column: 'Past', columnHeading: 'Past' } });
        const items = buildLayoutItems([present, past]);

        expect(items).toEqual([
            expect.objectContaining({
                kind: 'grid',
                columns: ['Present', 'Past'],
                columnHeadings: ['Present', 'Past'],
            }),
        ]);
    });

    it('leaves a cell undefined when no field claims that row/column pairing', () => {
        // Genitive has no plural in this fixture — its row should have a hole, not a shifted column.
        const nomS = textField('nomS', { layout: { row: 'Nominative', column: 'Singular' } });
        const nomP = textField('nomP', { layout: { row: 'Nominative', column: 'Plural' } });
        const genS = textField('genS', { layout: { row: 'Genitive', column: 'Singular' } });
        const items = buildLayoutItems([nomS, nomP, genS]);

        expect(items).toEqual([
            expect.objectContaining({
                rows: ['Nominative', 'Genitive'],
                columns: ['Singular', 'Plural'],
                cells: [
                    [nomS, nomP],
                    [genS, undefined],
                ],
            }),
        ]);
    });

    it('starts a new block once the group heading stack changes, even between two layout fields', () => {
        const presentI = textField('present1s', {
            layout: { row: '1s', column: 'Present' },
            group: [{ heading: 'Simple', level: 1 }, { heading: 'Present', level: 2 }],
        });
        const pastI = textField('past1s', {
            layout: { row: '1s', column: 'Past' },
            group: [{ heading: 'Simple', level: 1 }, { heading: 'Past', level: 2 }],
        });
        const items = buildLayoutItems([presentI, pastI]);

        // Different `group` stacks (the tense heading differs) -> two separate 1x1 blocks, not one 1x2 block.
        expect(items).toHaveLength(2);
        expect(items.every((item) => item.kind === 'grid')).toBe(true);
    });

    it('a Spanish-adjective-shaped fixture collapses to just the surviving branch once hidden fields are pre-filtered', () => {
        // Mirrors what TranslationCard passes in: only the M/F branch fields
        // survive the visibleWhen filter, so buildLayoutItems never sees neutral*.
        const maleSingular = textField('maleSingular', { layout: { row: 'male', column: 'Singular' } });
        const malePlural = textField('malePlural', { layout: { row: 'male', column: 'Plural' } });
        const femaleSingular = textField('femaleSingular', { layout: { row: 'female', column: 'Singular' } });
        const femalePlural = textField('femalePlural', { layout: { row: 'female', column: 'Plural' } });

        const items = buildLayoutItems([maleSingular, malePlural, femaleSingular, femalePlural]);

        expect(items).toEqual([
            expect.objectContaining({
                rows: ['male', 'female'],
                columns: ['Singular', 'Plural'],
            }),
        ]);
    });
});

describe('isEmptyValue', () => {
    it.each([
        [undefined, true],
        [null, true],
        ['', true],
        [[], true],
        ['x', false],
        [['a'], false],
        [0, false],
        [false, false],
    ])('%s -> %s', (value, expected) => {
        expect(isEmptyValue(value)).toBe(expected);
    });
});

describe('isHiddenInDisplayOnly', () => {
    const required = textField('required', { required: true });
    const optional = textField('optional', { required: false });

    it('hides a non-required empty field only in displayOnly mode', () => {
        expect(isHiddenInDisplayOnly(optional, '', true)).toBe(true);
        expect(isHiddenInDisplayOnly(optional, '', false)).toBe(false);
    });

    it('never hides a required field, even when empty', () => {
        expect(isHiddenInDisplayOnly(required, '', true)).toBe(false);
    });

    it('never hides a field that has a value', () => {
        expect(isHiddenInDisplayOnly(optional, 'value', true)).toBe(false);
    });
});
