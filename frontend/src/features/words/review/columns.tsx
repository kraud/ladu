import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { FlagIcon } from '@/components/common/FlagIcon';
import { TagChip } from '@/components/common/TagChip';
import { avatarInitials } from '@/lib/avatar';
import { partOfSpeechLabelKey } from '@/lib/words';
import { PartOfSpeech } from '@/ts/enums';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { WordCell } from './WordCell';

/** Review's Tags column shows at most this many chips before collapsing the rest into a "+N" hint (D14). */
const MAX_VISIBLE_TAGS = 2;

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
    t: TFunction;
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
}

export interface BuildLanguageColumnsOptions {
    languages: LangKey[];
    userId: string;
    showGender: boolean;
    showProgress: boolean;
    /** Threaded straight through to `WordCell` — see its own doc comment. */
    editable?: boolean;
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
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
    const { languages, userId, showGender, showProgress, editable, onOpenCell } = options;

    return languages.map((langKey) => ({
        id: `lang_${langKey}`,
        accessorFn: (row) => row[`data${langKey}`] ?? '',
        header: () => (
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
 * Read-only Tags column (D1/D7/D14) — up to `MAX_VISIBLE_TAGS` plain
 * `TagChip`s plus a "+N" text hint for the rest. No click target anywhere in
 * the cell, on the chips or the "+N": the mockup's own click-to-filter-per-
 * chip and overflow-opens-a-dialog behavior was explicitly dropped (D14) —
 * adding/removing a word's tags only ever happens through the sidebar
 * combobox filter (which doesn't touch what's *on* a word, only what's
 * shown) or the bulk "Add tags"/"Remove tags" actions.
 */
export function buildTagsColumn(t: TFunction): ColumnDef<WordSimpleBE> {
    return {
        id: 'tags',
        header: () => t('review:table.tags'),
        cell: ({ row }) => {
            const tags = row.original.tags;
            if (tags.length === 0) return null;
            const visible = tags.slice(0, MAX_VISIBLE_TAGS);
            const overflow = tags.length - visible.length;
            return (
                <div className="flex flex-wrap items-center gap-1">
                    {visible.map((tag) => (
                        <TagChip key={tag.id} label={tag.label} locked={tag.visibility === 'Private'} />
                    ))}
                    {overflow > 0 && (
                        <span className="hint text-xs" title={tags.slice(MAX_VISIBLE_TAGS).map((tag) => tag.label).join(', ')}>
                            +{overflow}
                        </span>
                    )}
                </div>
            );
        },
    };
}

/**
 * select/owner -> Type -> one column per language -> Tags (D1), in that order.
 */
export function buildWordColumns(options: BuildColumnsOptions): ColumnDef<WordSimpleBE>[] {
    const { languages, userId, userName, showGender, showProgress, t, onOpenCell } = options;

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
        cell: ({ row }) => {
            const isOwn = row.original.user === userId;
            return (
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={row.getIsSelected()}
                        disabled={!row.getCanSelect()}
                        onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
                        aria-label={t('review:table.selectRow')}
                    />
                    <span
                        className={`owner-dot ${isOwn ? 'owner-me' : 'owner-group'}`}
                        title={isOwn ? t('review:table.ownerMe') : t('review:table.ownerGroup')}
                    >
                        {isOwn ? avatarInitials(userName) : 'G'}
                    </span>
                </div>
            );
        },
    };

    const typeColumn = buildPartOfSpeechColumn(t, 52);

    const languageColumns = buildLanguageColumns({ languages, userId, showGender, showProgress, onOpenCell });

    return [selectColumn, typeColumn, ...languageColumns, buildTagsColumn(t)];
}
