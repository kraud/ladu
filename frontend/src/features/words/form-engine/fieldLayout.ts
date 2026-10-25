/**
 * Turns a flat, already-filtered `FieldConfig[]` into the sequence of items
 * `TranslationCard` actually renders: a field with no `layout` renders alone,
 * exactly as before; a maximal run of consecutive `layout`-bearing fields
 * that share the same `group` stack becomes one grid block (a noun case's
 * singular/plural row, a Spanish adjective's gender grid, a verb's
 * tense-as-column grid).
 *
 * Callers MUST filter out fields the current form state would hide —
 * `visibleWhen` mismatches and, in `displayOnly`, empty non-required fields
 * — before calling `buildLayoutItems`. Filtering afterward would still hide
 * the individual field, but a hidden field inside a grid block would leave a
 * blank row/column behind; filtering first means a block's rows/columns are
 * derived only from what will actually render. `isHiddenInDisplayOnly` below
 * is the second half of that filter — `visibleWhen` already has
 * `matchesVisibility` in `configs/types.ts`.
 */
import type { FieldConfig, FieldGroup } from './configs/types';

export function isEmptyValue(value: unknown): boolean {
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || value === '';
}

/** The same "non-required + empty -> hidden" rule `FieldRenderer` applies to its own field, exposed so a caller can pre-filter a whole field list with it. */
export function isHiddenInDisplayOnly(field: FieldConfig, value: unknown, displayOnly: boolean): boolean {
    return displayOnly && !field.required && isEmptyValue(value);
}

/**
 * `fieldsToCases`' own drop rules (`TranslationCard.tsx`), minus the "resulting
 * word is blank" one — there's no value to read here, only the field's shape.
 * Shared by `TranslationCard`'s own case-count summary (a collapsed card's
 * "N of M cases") and `review/completion.ts`'s completion-ring denominator,
 * so the two can't drift apart on what counts as a persisted case field.
 */
export function isPersistedCaseField(field: FieldConfig): boolean {
    return field.persisted !== false && field.kind !== 'checkbox' && Boolean(field.caseName);
}

export interface SingleLayoutItem {
    kind: 'field';
    /** This field's index in the field list passed to `buildLayoutItems` — feeds `groupHeadingsToPrint`. */
    index: number;
    field: FieldConfig;
}

export interface GridLayoutItem {
    kind: 'grid';
    /** The block's first field's index in the field list passed to `buildLayoutItems` — feeds `groupHeadingsToPrint`. */
    index: number;
    /** Every field in the block, in original order — stable identity for React keys. */
    fields: FieldConfig[];
    rows: string[];
    columns: string[];
    /** Row-major; `cells[r][c]` is undefined where no field in the block claims that `(row, column)` pairing. */
    cells: (FieldConfig | undefined)[][];
    /** Present only once any field in the block sets `layout.columnHeading`; parallel to `columns`. */
    columnHeadings?: (string | undefined)[];
    /** Set when any field in the block asks to stack in one column on a phone (`FieldLayout.stackOnMobile`). */
    stackOnMobile?: boolean;
    /** Set when any field in the block takes a whole row on a phone (`FieldLayout.fullRowOnMobile`): the block then wraps 2-up instead of scrolling. */
    wrapsOnMobile?: boolean;
    /** Set when any field in the block asks to keep all its columns in one row on a phone (`FieldLayout.fitRow`). */
    fitsRow?: boolean;
}

export type LayoutItem = SingleLayoutItem | GridLayoutItem;

function groupStackKey(group: FieldGroup[] | undefined): string {
    return JSON.stringify((group ?? []).map((entry) => `${entry.level}:${entry.heading}`));
}

/**
 * The full key deciding whether two adjacent layout fields merge into the
 * same grid block: the `group` stack (unchanged behaviour) plus the explicit
 * `layout.block` id, when one is set (see `FieldLayout.block`'s doc comment
 * in `configs/types.ts` for why that escape hatch exists).
 */
function blockKey(field: FieldConfig): string {
    return `${groupStackKey(field.group)}\u0000${field.layout?.block ?? ''}`;
}

function buildGrid(fields: FieldConfig[]): Omit<GridLayoutItem, 'kind' | 'index'> {
    const rows: string[] = [];
    const columns: string[] = [];
    const byPosition = new Map<string, FieldConfig>();
    const columnHeadingByColumn = new Map<string, string>();

    for (const field of fields) {
        const { row, column, columnHeading } = field.layout!;
        if (!rows.includes(row)) rows.push(row);
        if (!columns.includes(column)) columns.push(column);
        byPosition.set(`${row}\u0000${column}`, field);
        if (columnHeading !== undefined) columnHeadingByColumn.set(column, columnHeading);
    }

    const cells = rows.map((row) => columns.map((column) => byPosition.get(`${row}\u0000${column}`)));
    const columnHeadings = columnHeadingByColumn.size > 0 ? columns.map((column) => columnHeadingByColumn.get(column)) : undefined;

    const fitsRow = fields.some((field) => field.layout?.fitRow) || undefined;

    // `fitRow` wins: a row that always fits never stacks or wraps.
    const stackOnMobile = (!fitsRow && fields.some((field) => field.layout?.stackOnMobile)) || undefined;

    const wrapsOnMobile = (!fitsRow && fields.some((field) => field.layout?.fullRowOnMobile)) || undefined;

    return { fields, rows, columns, cells, columnHeadings, stackOnMobile, wrapsOnMobile, fitsRow };
}

/** `fields` must already be filtered to what will actually render (see file header). */
export function buildLayoutItems(fields: FieldConfig[]): LayoutItem[] {
    const items: LayoutItem[] = [];
    let i = 0;
    while (i < fields.length) {
        const field = fields[i];
        if (!field.layout) {
            items.push({ kind: 'field', index: i, field });
            i += 1;
            continue;
        }

        const key = blockKey(field);
        const blockFields = [field];
        let j = i + 1;
        while (j < fields.length && fields[j].layout && blockKey(fields[j]) === key) {
            blockFields.push(fields[j]);
            j += 1;
        }
        items.push({ kind: 'grid', index: i, ...buildGrid(blockFields) });
        i = j;
    }
    return items;
}

/** "haus" -> "Haus": only the first letter changes. */
export function capitalizeFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
