/**
 * Clone a Public tag (D11) — the caller picks the copy's visibility (default
 * Private) rather than silently inheriting the source's, and confirms the
 * copy is fully independent. `MOCKUPS/tags.html`'s `#clone-dialog`.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningIcon, CheckIcon } from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCloneTag } from '../hooks';
import { tagErrorKey } from '../errors';
import { tagRelation } from './TagBadge';
import type { CloneTagResult, TagSummary, TagVisibility } from '../types';

export interface CloneTagDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tag: TagSummary | null;
    onCloned?: (result: CloneTagResult) => void;
}

export function CloneTagDialog({ open, onOpenChange, tag, onCloned }: CloneTagDialogProps) {
    const { t } = useTranslation();
    const cloneTag = useCloneTag();
    const [visibility, setVisibility] = useState<TagVisibility>('Private');
    const [keepTag, setKeepTag] = useState(true);

    useEffect(() => {
        if (open) {
            setVisibility('Private');
            setKeepTag(true);
            cloneTag.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, tag?.id]);

    if (!tag) return null;

    // Cloning a Followed (or Unavailable) tag ends the follow (D11) — only
    // worth mentioning when it's actually true.
    const relation = tagRelation(tag);
    const endsFollow = relation === 'followed' || relation === 'unavailable';

    function handleConfirm() {
        cloneTag.mutate(
            // Words only: no visibility, since the words have no tag and are private to the caller.
            { id: tag!.id, body: keepTag ? { visibility } : { keepTag: false } },
            {
                onSuccess: (result) => {
                    onOpenChange(false);
                    onCloned?.(result);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('tags:clone.title')}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3 rounded-md bg-(--fg-soft) px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                            <b className="font-display text-sm">{tag.label}</b>
                            <span className="text-xs text-(--muted)">
                                {t('tags:clone.byAuthor', { username: tag.author.username })}
                            </span>
                        </div>
                        <span className="whitespace-nowrap text-xs text-(--muted)">
                            {t('tags:clone.wordAndFollowerCount', {
                                words: tag.wordCount,
                                followers: tag.followerCount,
                            })}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox checked={keepTag} onCheckedChange={(checked) => setKeepTag(Boolean(checked))} />
                            {t('tags:clone.keepTag')}
                        </label>
                        <span className="text-xs text-(--muted)">
                            {t(keepTag ? 'tags:clone.keepTagHintOn' : 'tags:clone.keepTagHintOff')}
                        </span>
                    </div>

                    {keepTag && (
                    <div className="flex flex-col gap-1.5">
                        <span className="label">{t('tags:clone.visibilityLabel')}</span>
                        <RadioGroup
                            className="flex-row gap-4"
                            value={visibility}
                            onValueChange={(next) => setVisibility(next as TagVisibility)}
                        >
                            <label className="flex cursor-pointer items-center gap-1.5">
                                <RadioGroupItem value="Private" />
                                {t('tags:form.visibilityPrivate')}
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5">
                                <RadioGroupItem value="Public" />
                                {t('tags:form.visibilityPublic')}
                            </label>
                        </RadioGroup>
                        <span className="text-xs text-(--muted)">{t('tags:clone.visibilityHint')}</span>
                    </div>
                    )}

                    <div className="flex items-start gap-2 rounded-md bg-(--success-soft) px-3 py-2 text-sm text-(--success)">
                        <CheckIcon size={14} weight="bold" className="mt-0.5 shrink-0" />
                        {t('tags:clone.independentNote')}
                    </div>

                    {endsFollow && (
                        <div className="flex items-start gap-2 rounded-md bg-(--warning-soft) px-3 py-2 text-sm text-(--warning)">
                            <WarningIcon size={14} weight="bold" className="mt-0.5 shrink-0" />
                            {t('tags:clone.endsFollowNote')}
                        </div>
                    )}

                    {cloneTag.isError && (
                        <p className="text-sm text-(--danger)">{t(tagErrorKey(cloneTag.error))}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        {t('common:buttons.cancel')}
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={cloneTag.isPending}>
                        {t(keepTag ? 'tags:clone.confirm' : 'tags:clone.confirmWords')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
