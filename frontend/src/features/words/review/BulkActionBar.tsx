/**
 * The bulk action bar — visible only once one or more rows are selected.
 * View at exactly one selection, Delete at one or more behind a
 * `ConfirmDialog`. "Add tags"/"Remove tags" (D5/D17, Phase 4 Slice 7) open
 * `TagPickerDialog` in the matching mode — that dialog owns its own mutation
 * (`useLinkTagsToWords`/`useUnlinkTagsFromWords`) and staged selection, the
 * same self-contained shape `AddWordsDialog` already established; this bar
 * only owns which mode is open and bubbles the result up via `onTagsApplied`
 * so `ReviewPage` can toast and clear the selection — the same split
 * Delete already uses (this bar owns the confirm step, `ReviewPage` owns the
 * mutation + toast). "Practice" (Phase 5, C4) is available from one selected
 * word up; `ReviewPage` owns the hand-off to `/practice`.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TagPickerDialog } from '@/features/tags/components/TagPickerDialog';
import type { TagSummary } from '@/features/tags/types';

export interface BulkActionBarProps {
    selectedCount: number;
    selectedWordIds: string[];
    /** Tags common to every selected word — "Remove tags"' candidate pool. */
    commonTagIds: ReadonlySet<string>;
    onView: () => void;
    onPractice: () => void;
    /** Called once the user has confirmed the delete — this component owns the confirm step. */
    onDelete: () => void;
    onTagsApplied: (mode: 'add' | 'remove', tags: TagSummary[]) => void;
}

export function BulkActionBar({
    selectedCount,
    selectedWordIds,
    commonTagIds,
    onView,
    onPractice,
    onDelete,
    onTagsApplied,
}: BulkActionBarProps) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const [tagPickerMode, setTagPickerMode] = useState<'add' | 'remove' | null>(null);

    if (selectedCount === 0) return null;

    return (
        <>
            <div className="bulkbar">
                <span className="count">{selectedCount}</span>
                <span className="grow" style={{ fontSize: 13 }}>
                    {t('review:bulk.selected')}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedCount !== 1}
                    onClick={onView}
                >
                    {t('review:bulk.view')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onPractice}>
                    {t('review:bulk.practice')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setTagPickerMode('add')}>
                    {t('review:bulk.addTags')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={commonTagIds.size === 0}
                    onClick={() => setTagPickerMode('remove')}
                >
                    {t('review:bulk.removeTags')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="danger"
                    onClick={() => setConfirming(true)}
                >
                    {t('review:bulk.delete')}
                </Button>
            </div>
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title={t('review:bulk.confirmTitle', { count: selectedCount })}
                description={t('review:bulk.confirmDescription', { count: selectedCount })}
                confirmLabel={t('review:bulk.delete')}
                onConfirm={() => {
                    setConfirming(false);
                    onDelete();
                }}
            />
            {tagPickerMode && (
                <TagPickerDialog
                    open
                    onOpenChange={(open) => !open && setTagPickerMode(null)}
                    mode={tagPickerMode}
                    wordIds={selectedWordIds}
                    restrictToIds={tagPickerMode === 'remove' ? commonTagIds : undefined}
                    onApplied={(tags) => onTagsApplied(tagPickerMode, tags)}
                />
            )}
        </>
    );
}
