/**
 * `/tag/:id`'s "Add words" action (owned tags only) — `MOCKUPS/tag-detail.html`'s
 * `#addwords-dialog`. Wraps `WordPicker` (D18) in real dialog chrome with its
 * own Save/Cancel footer, the one piece `WordPicker` deliberately doesn't own
 * itself (Slice 5's note: it renders no dialog chrome so either call site can
 * host it). `excludeIds` keeps words already on the tag out of the pool —
 * distinct from `selected`, which is only this session's picks.
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
import { useLinkTagsToWords } from '../hooks';
import { tagErrorKey } from '../errors';
import { WordPicker, type PickedWord } from './WordPicker';

export interface AddWordsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tagId: string;
    tagLabel: string;
    /** Word ids already on the tag — excluded from the picker's pool. */
    existingWordIds: ReadonlySet<string>;
    onAdded?: (added: PickedWord[]) => void;
}

export function AddWordsDialog({
    open,
    onOpenChange,
    tagId,
    tagLabel,
    existingWordIds,
    onAdded,
}: AddWordsDialogProps) {
    const { t } = useTranslation();
    const linkTagsToWords = useLinkTagsToWords();
    const [selected, setSelected] = useState<PickedWord[]>([]);

    useEffect(() => {
        if (open) {
            setSelected([]);
            linkTagsToWords.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, tagId]);

    function handleSave() {
        if (selected.length === 0) {
            onOpenChange(false);
            return;
        }
        linkTagsToWords.mutate(
            { tagIds: [tagId], wordIds: selected.map((w) => w.id) },
            {
                onSuccess: () => {
                    onOpenChange(false);
                    onAdded?.(selected);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('tags:addWords.title', { label: tagLabel })}</DialogTitle>
                </DialogHeader>

                <WordPicker selected={selected} onSelectedChange={setSelected} excludeIds={existingWordIds} />

                {linkTagsToWords.isError && (
                    <p className="text-sm text-(--danger)">{t(tagErrorKey(linkTagsToWords.error))}</p>
                )}

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        {t('common:buttons.cancel')}
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={linkTagsToWords.isPending}>
                        {t('tags:addWords.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
