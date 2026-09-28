/**
 * Review's bulk "Add tags" / "Remove tags" (D5/D17) — a small dialog hosting
 * `TagCombobox` in the matching mode, with its own staged `selected` state
 * (picks apply only once "Apply" is clicked, unlike `FilterBar`'s inline,
 * instant-apply use of the same combobox) and Save/Cancel footer.
 *
 * `wordIds` is optional for `mode="add"` only — `WordForm`'s create flow
 * (phase-4-tags.md Slice 8) has no word id yet to link against, so Apply
 * there skips the mutation entirely and hands the picks straight to
 * `onApplied` for the caller to hold locally until the word itself is
 * created (D4). Every other caller (Review's bulk bar, the word editor's
 * edit-mode "Add tag") always passes `wordIds` and gets the real
 * link/unlink mutation, unchanged.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLinkTagsToWords, useUnlinkTagsFromWords } from '../hooks';
import { tagErrorKey } from '../errors';
import { TagCombobox } from './TagCombobox';
import type { TagSummary } from '../types';

export interface TagPickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'add' | 'remove';
    /** Omit only for `mode="add"` with no word yet (see the file header comment). */
    wordIds?: string[];
    /** `mode="remove"` only — the tags currently common to every selected word. */
    restrictToIds?: ReadonlySet<string>;
    onApplied?: (tags: TagSummary[]) => void;
}

export function TagPickerDialog({ open, onOpenChange, mode, wordIds, restrictToIds, onApplied }: TagPickerDialogProps) {
    const { t } = useTranslation();
    const linkTagsToWords = useLinkTagsToWords();
    const unlinkTagsFromWords = useUnlinkTagsFromWords();
    const mutation = mode === 'add' ? linkTagsToWords : unlinkTagsFromWords;

    const [selected, setSelected] = useState<TagSummary[]>([]);

    useEffect(() => {
        if (open) {
            setSelected([]);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode]);

    function handleSave() {
        if (selected.length === 0) {
            onOpenChange(false);
            return;
        }
        if (!wordIds) {
            // No word to link yet (create flow) — stage the picks locally instead.
            onOpenChange(false);
            onApplied?.(selected);
            return;
        }
        mutation.mutate(
            { tagIds: selected.map((tag) => tag.id), wordIds },
            {
                onSuccess: () => {
                    onOpenChange(false);
                    onApplied?.(selected);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {t(mode === 'add' ? 'tags:picker.addTitle' : 'tags:picker.removeTitle', {
                            count: wordIds?.length ?? 1,
                        })}
                    </DialogTitle>
                </DialogHeader>

                <TagCombobox mode={mode} selected={selected} onSelectedChange={setSelected} restrictToIds={restrictToIds} />

                {mutation.isError && <p className="text-sm text-(--danger)">{t(tagErrorKey(mutation.error))}</p>}

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        {t('common:buttons.cancel')}
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
                        {t('tags:picker.apply')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
