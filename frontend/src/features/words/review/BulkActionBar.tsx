/**
 * The bulk action bar — visible only once one or more rows are selected.
 * View at exactly one selection, Delete at one or more behind a
 * `ConfirmDialog`. "Add tags" (D5/D17, Phase 4 Slice 7) opens
 * `TagPickerDialog` — that dialog owns its own mutation
 * (`useLinkTagsToWords`) and staged selection, the
 * same self-contained shape `AddWordsDialog` already established; this bar
 * only owns which mode is open and bubbles the result up via `onTagsApplied`
 * so `ReviewPage` can toast and clear the selection — the same split
 * Delete already uses (this bar owns the confirm step, `ReviewPage` owns the
 * mutation + toast). "Practice" (Phase 5, C4) is available from one selected
 * word up; `ReviewPage` owns the hand-off to `/practice`. Removing tags is done
 * per word, in the tags dialog of its Tags cell. A button that cannot be used
 * (View with more than one word) is not shown. On a phone (`onClear`) an
 * "Unselect" button clears the selection: rows have no checkboxes there.
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
    onView: () => void;
    onPractice: () => void;
    /** Called once the user has confirmed the delete — this component owns the confirm step. */
    onDelete: () => void;
    onTagsApplied: (tags: TagSummary[]) => void;
    /** Phone only: clears the selection. */
    onClear?: () => void;
}

export function BulkActionBar({
    selectedCount,
    selectedWordIds,
    onView,
    onPractice,
    onDelete,
    onTagsApplied,
    onClear,
}: BulkActionBarProps) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const [tagPickerOpen, setTagPickerOpen] = useState(false);

    if (selectedCount === 0) return null;

    return (
        <>
            <div className="bulkbar">
                <span className="count">{selectedCount}</span>
                <span className="grow" style={{ fontSize: 13 }}>
                    {t('review:bulk.selected')}
                </span>
                {selectedCount === 1 && (
                    <Button type="button" variant="outline" size="sm" onClick={onView}>
                        {t('review:bulk.view')}
                    </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={onPractice}>
                    {t('review:bulk.practice')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setTagPickerOpen(true)}>
                    {t('review:bulk.addTags')}
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
                {onClear && (
                    <Button type="button" variant="outline" size="sm" onClick={onClear}>
                        {t('review:bulk.unselect')}
                    </Button>
                )}
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
            {tagPickerOpen && (
                <TagPickerDialog
                    open
                    onOpenChange={(open) => !open && setTagPickerOpen(false)}
                    mode="add"
                    wordIds={selectedWordIds}
                    onApplied={onTagsApplied}
                />
            )}
        </>
    );
}
