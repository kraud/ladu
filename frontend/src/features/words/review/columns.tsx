import type { ColumnDef } from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from '@phosphor-icons/react';
import type { TFunction } from 'i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { FlagIcon } from '@/components/common/FlagIcon';
import { TagChip } from '@/components/common/TagChip';
import { avatarInitials } from '@/lib/avatar';
import { partOfSpeechLabelKey } from '@/lib/words';
import { PartOfSpeech } from '@/ts/enums';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { WordCell } from './WordCell';
import type { LanguageSort } from './useLanguageSort';

/** `Noun` -> `"review:table.posAbbr.noun"`, mirroring `lib/words.ts`'s `partOfSpeechLabelKey`. Exported for `FilterBar`'s PoS chips (Slice 7), same abbreviations as the Type column. */
export function posAbbrKey(pos: PartOfSpeech): string {
    const key = (Object.keys(PartOfSpeech) as (keyof typeof PartOfSpeech)[]).find(
        (candidate) => PartOfSpeech[candidate] === pos,
    );
    return `review:table.posAbbr.${key ?? 'noun'}`;
}

export interface BuildColumnsOptions {
    /** Column order and set — `resolveLanguageOrder(search.lang, user.languages)` (D6). */
    languages: LangKey[];
    /** Session user id — decides the owner dot and which rows a cell's Add button appears on. */
    userId: string;
    userName: string;
    /** Toolbar "Display gender" switch (Slice 7). Defaults to visible until that switch exists. */
    showGender: boolean;
    /** Toolbar "Display progress" switch — gates the completion ring per cell. */
    showProgress: boolean;
    /** Desktop: a checkbox column selects rows. Phone: rows are selected by a long press, so no column. */
    selectable: boolean;
    /** Toolbar "Display owner" switch — gates the owner column. */
    showOwner: boolean;
    /** Toolbar "Display word type" switch — gates the word-type column. */
    showPos: boolean;
    t: TFunction;
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
    /** Opens the tags dialog of a word (a click anywhere on its Tags cell). */
    onOpenTags?: (wordId: string) => void;
    /** The active column sort, and the click on a language header. Without `onSort` the headers are plain text. */
    sort?: LanguageSort | null;
    onSort?: (lang: LangKey) => void;
}

export interface BuildLanguageColumnsOptions {
    languages: LangKey[];
    userId: string;
    showGender: boolean;
    showProgress: boolean;
    /** Threaded straight through to `WordCell` — see its own doc comment. */
    editable?: boolean;
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
    /** The active column sort, and the click on a language header. Without `onSort` the headers are plain text. */
    sort?: LanguageSort | null;
    onSort?: (lang: LangKey) => void;
    t?: TFunction;
}

/** A language header that sorts its column: A to Z, Z to A, then the default order (`useLanguageSort`). */
function SortHeader({
    langKey,
    sort,
    onSort,
    t,
}: {
    langKey: LangKey;
    sort: LanguageSort | null | undefined;
    onSort: (lang: LangKey) => void;
    t: TFunction;
}) {
    const dir = sort?.lang === langKey ? sort.dir : null;
    const labelKey = dir === 'asc' ? 'review:table.sort.asc' : dir === 'desc' ? 'review:table.sort.desc' : 'review:table.sort.off';
    return (
        <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 hover:text-foreground data-[sorted]:text-(--accent-strong)"
            data-sorted={dir ?? undefined}
            aria-label={t(labelKey, { lang: langKey })}
            title={t(labelKey, { lang: langKey })}
            onClick={() => onSort(langKey)}
        >
            <FlagIcon lang={langKey} /> {langKey}
            {dir === 'asc' && <ArrowUpIcon size={12} weight="bold" aria-hidden="true" />}
            {dir === 'desc' && <ArrowDownIcon size={12} weight="bold" aria-hidden="true" />}
        </button>
    );
}

/**
 * The Type/part-of-speech column, alone — extracted out of `buildWordColumns`
 * for the same reason as `buildLanguageColumns` below: `WordPicker` and
 * `TagWordsTable` (`features/tags/components/`, phase-4-tags.md D18/Slice 6)
 * each need this exact abbreviation column without Review's own select/owner
 * column alongside it. `size` differs slightly per host (a picker's compact
 * row vs. Review's own column width), so it's the one parameter.
 */
export function buildPartOfSpeechColumn(t: TFunction, size = 44): ColumnDef<WordSimpleBE> {
    return {
        id: 'partOfSpeech',
        accessorKey: 'partOfSpeech',
        size,
        header: '',
        cell: ({ row }) => (
            <span className="pos-abbr" title={t(partOfSpeechLabelKey(row.original.partOfSpeech))}>
                {t(posAbbrKey(row.original.partOfSpeech))}
            </span>
        ),
    };
}

/**
 * Just the per-language `WordCell` columns — extracted out of
 * `buildWordColumns` so a second table (`features/tags/components/
 * TagWordsTable.tsx`, phase-4-tags.md Slice 6) can reuse the exact same
 * language rendering without also inheriting Review's own select/owner
 * column, which is shaped around `RowSelectionState` + a bulk-action bar,
 * not that table's own row shape.
 */
export function buildLanguageColumns(options: BuildLanguageColumnsOptions): ColumnDef<WordSimpleBE>[] {
    const { languages, userId, showGender, showProgress, editable, onOpenCell, sort, onSort, t } = options;

    return languages.map((langKey) => ({
        id: `lang_${langKey}`,
        accessorFn: (row) => row[`data${langKey}`] ?? '',
        header: () =>
            onSort && t ? (
                <SortHeader langKey={langKey} sort={sort} onSort={onSort} t={t} />
            ) : (
                <span className="flex items-center gap-1.5">
                    <FlagIcon lang={langKey} /> {langKey}
                </span>
            ),
        cell: ({ row }) => (
            <WordCell
                row={row.original}
                langKey={langKey}
                isOwn={row.original.user === userId}
                showGender={showGender}
                showProgress={showProgress}
                editable={editable}
                onOpenCell={onOpenCell}
            />
        ),
    }));
}

/**
 * The Tags column: the tag added to the word most recently (the API sends the newest first) and a "+N"
 * for the rest, always in one row so every row has the same height. A click anywhere on the cell opens
 * the word's tags dialog (`onOpenTags`). An own word without tags shows an add button instead; a
 * word without tags that is not the user's own shows nothing.
 */
export function buildTagsColumn(
    t: TFunction,
    userId: string,
    onOpenTags?: (wordId: string) => void,
): ColumnDef<WordSimpleBE> {
    return {
        id: 'tags',
        header: () => t('review:table.tags'),
        cell: ({ row }) => {
            const tags = row.original.tags;
            const [latest] = tags;
            if (!latest) {
                if (row.original.user !== userId) return null;
                return (
                    <button
                        type="button"
                        className="cell-add"
                        aria-label={t('review:table.tagsOpenAdd')}
                        onClick={() => onOpenTags?.(row.original.id)}
                    >
                        <PlusIcon size={14} weight="bold" />
                    </button>
                );
            }
            const overflow = tags.length - 1;
            return (
                <button
                    type="button"
                    className="cell-tags"
                    aria-label={t('review:table.tagsOpen')}
                    onClick={() => onOpenTags?.(row.original.id)}
                >
                    <TagChip label={latest.label} locked={latest.visibility === 'Private'} />
                    {overflow > 0 && <span className="hint text-xs">+{overflow}</span>}
                </button>
            );
        },
    };
}

/**
 * select (desktop) -> owner -> Type -> one column per language -> Tags (D1), in that order. The owner
 * and Type columns come and go with their display switches.
 */
export function buildWordColumns(options: BuildColumnsOptions): ColumnDef<WordSimpleBE>[] {
    const { languages, userId, userName, showGender, showProgress, selectable, showOwner, showPos, t, onOpenCell, onOpenTags, sort, onSort } =
        options;

    const selectColumn: ColumnDef<WordSimpleBE> = {
        id: 'select',
        size: 44,
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllRowsSelected()}
                indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
                onCheckedChange={(checked) => table.toggleAllRowsSelected(Boolean(checked))}
                aria-label={t('review:table.selectAll')}
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                disabled={!row.getCanSelect()}
                onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
                aria-label={t('review:table.selectRow')}
            />
        ),
    };

    const ownerColumn: ColumnDef<WordSimpleBE> = {
        id: 'owner',
        size: 32,
        header: '',
        cell: ({ row }) => {
            const isOwn = row.original.user === userId;
            return (
                <span
                    className={`owner-dot ${isOwn ? 'owner-me' : 'owner-group'}`}
                    title={isOwn ? t('review:table.ownerMe') : t('review:table.ownerGroup')}
                >
                    {isOwn ? avatarInitials(userName) : 'G'}
                </span>
            );
        },
    };

    const languageColumns = buildLanguageColumns({ languages, userId, showGender, showProgress, onOpenCell, sort, onSort, t });

    return [
        ...(selectable ? [selectColumn] : []),
        ...(showOwner ? [ownerColumn] : []),
        ...(showPos ? [buildPartOfSpeechColumn(t, 52)] : []),
        ...languageColumns,
        buildTagsColumn(t, userId, onOpenTags),
    ];
}
