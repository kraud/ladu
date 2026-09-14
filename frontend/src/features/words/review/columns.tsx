import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { FlagIcon } from '@/components/common/FlagIcon';
import { avatarInitials } from '@/lib/avatar';
import { partOfSpeechLabelKey } from '@/lib/words';
import { PartOfSpeech } from '@/ts/enums';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { WordCell } from './WordCell';

/** `Noun` -> `"review:table.posAbbr.noun"`, mirroring `lib/words.ts`'s `partOfSpeechLabelKey`. */
function posAbbrKey(pos: PartOfSpeech): string {
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
    t: TFunction;
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
}

/**
 * select/owner -> Type -> one column per language, in that order. Phase 4
 * appends a Tags column after the language columns (D1) — nothing above that
 * point needs to change when it lands.
 */
export function buildWordColumns(options: BuildColumnsOptions): ColumnDef<WordSimpleBE>[] {
    const { languages, userId, userName, showGender, t, onOpenCell } = options;

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

    const typeColumn: ColumnDef<WordSimpleBE> = {
        id: 'partOfSpeech',
        accessorKey: 'partOfSpeech',
        size: 52,
        header: '',
        cell: ({ row }) => (
            <span className="pos-abbr" title={t(partOfSpeechLabelKey(row.original.partOfSpeech))}>
                {t(posAbbrKey(row.original.partOfSpeech))}
            </span>
        ),
    };

    const languageColumns: ColumnDef<WordSimpleBE>[] = languages.map((langKey) => ({
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
                onOpenCell={onOpenCell}
            />
        ),
    }));

    // Phase 4 (D1): a `tagsColumn(options)` is appended here, after the
    // language columns — nothing above this line needs to change.
    return [selectColumn, typeColumn, ...languageColumns];
}
