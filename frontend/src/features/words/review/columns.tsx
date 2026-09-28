import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { FlagIcon } from '@/components/common/FlagIcon';
import { avatarInitials } from '@/lib/avatar';
import { partOfSpeechLabelKey } from '@/lib/words';
import { PartOfSpeech } from '@/ts/enums';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { WordCell } from './WordCell';

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
 * WordPicker.tsx`, phase-4-tags.md D18) can reuse the exact same language
 * rendering without also inheriting Review's own select/owner column, which
 * is shaped around `RowSelectionState` + a bulk-action bar, not a picker's
 * own accumulate-then-clear selection model.
 */
export function buildLanguageColumns(options: BuildLanguageColumnsOptions): ColumnDef<WordSimpleBE>[] {
    const { languages, userId, showGender, showProgress, onOpenCell } = options;

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
                onOpenCell={onOpenCell}
            />
        ),
    }));
}

/**
 * select/owner -> Type -> one column per language, in that order. Phase 4
 * appends a Tags column after the language columns (D1) — nothing above that
 * point needs to change when it lands.
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

    // Phase 4 (D1): a `tagsColumn(options)` is appended here, after the
    // language columns — nothing above this line needs to change.
    return [selectColumn, typeColumn, ...languageColumns];
}
